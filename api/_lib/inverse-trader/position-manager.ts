/**
 * 인버스 ETF 1호가 스캘핑 — 주문·포지션 관리.
 *
 * 하는 일
 *  - 체결이 들어오면 InverseOrder 상태를 PENDING → PARTIAL → FILLED 로 갱신
 *  - InverseFill 기록
 *  - InversePosition 의 보유수량 / 평균단가 / 실현손익 갱신
 *
 * 평균단가 규칙
 *  - 같은 방향으로 늘릴 때(매수→매수): 가중평균
 *  - 반대 방향(매도): 청산분에 대해 실현손익 반영, 평균단가는 유지
 *  - 포지션이 0이 되면 평균단가 0, 방향이 뒤집히면 체결가가 새 평균단가
 *
 * ★ 모든 DB 쓰기는 세션ID 기준으로 묶는다.
 *   - 주문/체결/포지션 갱신을 한 트랜잭션(runInTransaction)으로 처리
 *   - 주문의 sessionId 가 요청 sessionId 와 다르면 쓰기 자체를 거부
 *
 * ★ 증권사 주문 API / 외부 HTTP 호출 없음. DB 쓰기만 한다.
 */

import type { OrderSide, OrderStatus } from './constants.js';
import {
    LIVE_ORDER_STATUSES,
    runInTransaction,
    type InverseFillRow,
    type InverseOrderRow,
    type InversePositionRow,
    type InverseTraderDb,
} from './db.js';

/** 체결 수량이 주문 잔량을 초과했을 때(브로커/DB 불일치 신호). */
export class OverFillError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OverFillError';
    }
}

/** 다른 세션의 주문에 쓰기를 시도했을 때. */
export class SessionMismatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionMismatchError';
    }
}

// ── 순수 계산부 (DB 없이 테스트 가능) ──────────────────────────────────────

export interface PositionState {
    /** 보유수량(주). 매도 포지션이면 음수 */
    qty: number;
    /** 평균단가(원) */
    avgPrice: number;
    /** 누적 실현손익(원) */
    realizedPnl: number;
}

export interface PositionUpdateResult extends PositionState {
    /** 이번 체결로 발생한 실현손익(원) */
    realizedPnlDelta: number;
    /** 이번 체결로 청산된 수량(주) */
    closedQty: number;
}

/**
 * 체결 하나를 포지션에 반영한 결과를 계산한다(순수 함수).
 * @param side 체결 방향
 * @param fillPrice 체결가(원)
 * @param fillQty 체결수량(주, 양수)
 */
export function computePositionUpdate(
    prev: PositionState,
    side: OrderSide,
    fillPrice: number,
    fillQty: number
): PositionUpdateResult {
    if (!(fillQty > 0)) {
        return { ...prev, realizedPnlDelta: 0, closedQty: 0 };
    }
    const delta = side === 'BUY' ? fillQty : -fillQty;
    const prevQty = prev.qty;
    const nextQty = prevQty + delta;

    // 1) 무포지션이거나 같은 방향으로 늘리는 경우 → 가중평균
    if (prevQty === 0 || Math.sign(prevQty) === Math.sign(delta)) {
        const totalCost = Math.abs(prevQty) * prev.avgPrice + Math.abs(delta) * fillPrice;
        const avgPrice = nextQty === 0 ? 0 : totalCost / Math.abs(nextQty);
        return {
            qty: nextQty,
            avgPrice,
            realizedPnl: prev.realizedPnl,
            realizedPnlDelta: 0,
            closedQty: 0,
        };
    }

    // 2) 반대 방향 → 겹치는 수량만큼 실현손익 확정
    const closedQty = Math.min(Math.abs(prevQty), Math.abs(delta));
    const realizedPnlDelta =
        prevQty > 0
            ? (fillPrice - prev.avgPrice) * closedQty // 롱 청산
            : (prev.avgPrice - fillPrice) * closedQty; // 숏 청산

    let avgPrice: number;
    if (nextQty === 0) {
        avgPrice = 0; // 전량 청산
    } else if (Math.sign(nextQty) !== Math.sign(prevQty)) {
        avgPrice = fillPrice; // 방향이 뒤집힘 → 남은 수량은 체결가로 새로 잡는다
    } else {
        avgPrice = prev.avgPrice; // 부분 청산 → 평균단가 유지
    }

    return {
        qty: nextQty,
        avgPrice,
        realizedPnl: prev.realizedPnl + realizedPnlDelta,
        realizedPnlDelta,
        closedQty,
    };
}

/** 체결 반영 후 주문 상태를 계산한다(순수 함수). */
export function computeOrderStatus(orderQty: number, filledQty: number): OrderStatus {
    if (filledQty <= 0) return 'PENDING';
    if (filledQty >= orderQty) return 'FILLED';
    return 'PARTIAL';
}

/** 평가손익(원). 보유수량이 0이면 0. */
export function computeUnrealizedPnl(qty: number, avgPrice: number, markPrice: number): number {
    if (!qty) return 0;
    return (markPrice - avgPrice) * qty; // 숏(qty<0)이면 부호가 자동으로 뒤집힌다
}

// ── DB 반영부 ──────────────────────────────────────────────────────────────

export interface ApplyFillParams {
    /** 세션ID — 모든 쓰기의 묶음 기준 */
    sessionId: string;
    /** InverseOrder.id */
    orderId: number;
    /** 체결가(원) */
    fillPrice: number;
    /** 체결수량(주) */
    fillQty: number;
    /** 체결시각. 없으면 현재시각 */
    filledAt?: Date;
}

export interface ApplyFillResult {
    order: InverseOrderRow;
    fill: InverseFillRow;
    position: InversePositionRow;
    /** 이번 체결로 발생한 실현손익(원) */
    realizedPnlDelta: number;
    /** 체결 후 남은 잔량(주). >0 이면 원주문은 살아있다(PARTIAL) */
    remainingQty: number;
}

/**
 * 체결 1건을 DB에 반영한다(주문 상태 + 체결기록 + 포지션).
 * 부분체결이면 원주문은 PARTIAL 로 남고 잔량이 유지된다 — 취소하지 않는다.
 */
export async function applyFill(
    db: InverseTraderDb,
    params: ApplyFillParams
): Promise<ApplyFillResult> {
    const { sessionId, orderId, fillPrice, fillQty } = params;
    const filledAt = params.filledAt ?? new Date();

    if (!(fillQty > 0)) throw new OverFillError(`체결수량이 올바르지 않습니다: ${fillQty}`);

    return runInTransaction(db, async (tx) => {
        const order = await tx.inverseOrder.findUnique({ where: { id: orderId } });
        if (!order) throw new OverFillError(`주문을 찾을 수 없습니다: id=${orderId}`);
        if (order.sessionId !== sessionId) {
            throw new SessionMismatchError(
                `주문 ${orderId} 는 세션 ${order.sessionId} 소속인데 ${sessionId} 로 체결을 반영하려 했습니다.`
            );
        }
        if (fillQty > order.remainingQty) {
            throw new OverFillError(
                `체결수량이 잔량을 초과합니다: 주문 ${orderId} 잔량 ${order.remainingQty}, 체결 ${fillQty}`
            );
        }

        // 1) 주문 상태 갱신 (PENDING → PARTIAL → FILLED)
        const filledQty = order.filledQty + fillQty;
        const remainingQty = order.orderQty - filledQty;
        const status = computeOrderStatus(order.orderQty, filledQty);
        const updatedOrder = await tx.inverseOrder.update({
            where: { id: order.id },
            data: { filledQty, remainingQty, status },
        });

        // 2) 체결 기록
        const fill = await tx.inverseFill.create({
            data: {
                orderId: order.id,
                symbol: order.symbol,
                side: order.side,
                fillPrice,
                fillQty,
                filledAt,
            },
        });

        // 3) 포지션 갱신 (세션ID + 종목 단위)
        const prevRow = await tx.inversePosition.findUnique({
            where: { sessionId_symbol: { sessionId, symbol: order.symbol } },
        });
        const prev: PositionState = {
            qty: prevRow?.qty ?? 0,
            avgPrice: prevRow?.avgPrice ?? 0,
            realizedPnl: prevRow?.realizedPnl ?? 0,
        };
        const next = computePositionUpdate(prev, order.side as OrderSide, fillPrice, fillQty);
        const unrealizedPnl = computeUnrealizedPnl(next.qty, next.avgPrice, fillPrice);

        const position = await tx.inversePosition.upsert({
            where: { sessionId_symbol: { sessionId, symbol: order.symbol } },
            create: {
                sessionId,
                symbol: order.symbol,
                qty: next.qty,
                avgPrice: next.avgPrice,
                realizedPnl: next.realizedPnl,
                unrealizedPnl,
            },
            update: {
                qty: next.qty,
                avgPrice: next.avgPrice,
                realizedPnl: next.realizedPnl,
                unrealizedPnl,
            },
        });

        return {
            order: updatedOrder,
            fill,
            position,
            realizedPnlDelta: next.realizedPnlDelta,
            remainingQty,
        };
    });
}

// ── 조회 헬퍼 (가드·전략이 함께 쓴다) ──────────────────────────────────────

/** 세션×종목의 현재 포지션. 없으면 0 상태를 돌려준다. */
export async function loadPosition(
    db: InverseTraderDb,
    sessionId: string,
    symbol: string
): Promise<PositionState> {
    const row = await db.inversePosition.findUnique({
        where: { sessionId_symbol: { sessionId, symbol } },
    });
    return {
        qty: row?.qty ?? 0,
        avgPrice: row?.avgPrice ?? 0,
        realizedPnl: row?.realizedPnl ?? 0,
    };
}

/** 세션×종목의 살아있는(PENDING/PARTIAL) 주문 목록. */
export async function loadLiveOrders(
    db: InverseTraderDb,
    sessionId: string,
    symbol: string
): Promise<InverseOrderRow[]> {
    return db.inverseOrder.findMany({
        where: { sessionId, symbol, status: { in: LIVE_ORDER_STATUSES } },
        orderBy: { createdAt: 'asc' },
    });
}

export interface OpenOrderQty {
    /** 살아있는 매수주문 잔량 합계(주) */
    buyQty: number;
    /** 살아있는 매도주문 잔량 합계(주) */
    sellQty: number;
}

/** 살아있는 주문의 방향별 잔량 합계. 최대보유수량 가드가 쓴다. */
export async function loadOpenOrderQty(
    db: InverseTraderDb,
    sessionId: string,
    symbol: string
): Promise<OpenOrderQty> {
    const orders = await loadLiveOrders(db, sessionId, symbol);
    let buyQty = 0;
    let sellQty = 0;
    for (const o of orders) {
        if (o.side === 'BUY') buyQty += o.remainingQty;
        else sellQty += o.remainingQty;
    }
    return { buyQty, sellQty };
}

/**
 * 현재가 기준으로 평가손익을 갱신한다.
 * (실현손익·보유수량은 건드리지 않는다 — 체결 반영 경로와 분리)
 */
export async function markToMarket(
    db: InverseTraderDb,
    sessionId: string,
    symbol: string,
    markPrice: number
): Promise<InversePositionRow | null> {
    const row = await db.inversePosition.findUnique({
        where: { sessionId_symbol: { sessionId, symbol } },
    });
    if (!row) return null;
    const unrealizedPnl = computeUnrealizedPnl(row.qty, row.avgPrice, markPrice);
    return db.inversePosition.update({
        where: { sessionId_symbol: { sessionId, symbol } },
        data: { unrealizedPnl },
    });
}

/** 주문 레코드 생성(브로커 접수 결과를 DB에 남긴다). 세션ID 필수. */
export async function recordOrder(
    db: InverseTraderDb,
    params: {
        sessionId: string;
        symbol: string;
        side: OrderSide;
        limitPrice: number;
        orderQty: number;
        parentOrderId?: number | null;
        brokerOrderId?: string | null;
    }
): Promise<InverseOrderRow> {
    return db.inverseOrder.create({
        data: {
            sessionId: params.sessionId,
            symbol: params.symbol,
            side: params.side,
            limitPrice: params.limitPrice,
            orderQty: params.orderQty,
            filledQty: 0,
            remainingQty: params.orderQty,
            status: 'PENDING',
            parentOrderId: params.parentOrderId ?? null,
            brokerOrderId: params.brokerOrderId ?? null,
        },
    });
}
