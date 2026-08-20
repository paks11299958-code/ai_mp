/**
 * 인버스 ETF 1호가 스캘핑 — 당일 강제정산.
 *
 * ★ 이 프로젝트의 최우선 요구사항이다. 장 마감 전 버퍼(기본 10분)에 들어가면
 *   세션을 FORCE_SETTLEMENT 로 전환하고 보유수량을 0으로 만든다.
 *
 * 순서
 *   ① 신규 매수 완전 중단  — 세션 상태를 FORCE_SETTLEMENT 로 바꾸고, 정산 루틴은
 *      전략(strategy)을 거치지 않고 브로커로 직접 매도한다.
 *      (전략을 태우면 매도 체결마다 후속 '매수' 주문이 다시 생겨 정산이 끝나지 않는다)
 *   ② 미체결 주문 전부 취소
 *   ③ 보유수량 0 이 될 때까지 호가 추종 지정가 매도 반복
 *      — 시장가는 쓰지 않는다. 최우선 매수호가(bid)에 붙여 파는 방식이며,
 *        몇 번 실패하면 1호가씩 더 낮춰 건다(공격도 상승).
 *      — ★무한루프 금지: 시도횟수 상한 / 무진전 연속 상한 / 총 소요시간 상한
 *        3가지 독립 이탈 조건을 둔다.
 *   ④ 최종 보유수량 0 확인
 *   ⑤ InverseDailyStat 에 실현손익·체결건수·강제정산 성공여부 기록
 *
 * 마감 후에도 보유수량이 0이 아니면 강제정산 '실패'로 기록한다
 * (forceSettled=false, closingQty=잔여수량) — 세션 lastError 에도 사유를 남긴다.
 *
 * ★ 증권사 주문 API 호출 없음. 주문은 simulation-broker 를 통해서만 나간다.
 */

import type { Broker, FillRecord } from '../_lib/inverse-trader/broker.js';
import type { OrderSide } from '../_lib/inverse-trader/constants.js';
import {
    LIVE_ORDER_STATUSES,
    type InverseDailyStatRow,
    type InverseOrderRow,
    type InverseTraderDb,
} from '../_lib/inverse-trader/db.js';
import { loadSessionPnl } from '../_lib/inverse-trader/guards.js';
import { applyFill, loadPosition, recordOrder } from '../_lib/inverse-trader/position-manager.js';
import { ETF_TICK_BANDS, alignToTick, tickDown, type TickBand } from '../_lib/inverse-trader/strategy.js';

// ─────────────────────────────────────────────────────────────
// KST 시각 유틸 (서버는 UTC 로 도는데 장 시간은 KST 기준이다)
// ─────────────────────────────────────────────────────────────

/** KST = UTC+9 (서머타임 없음) */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 정규장 마감 시각(KST 분 단위). 15:30 */
export const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

/** 정규장 개장 시각(KST 분 단위). 09:00 */
export const MARKET_OPEN_MINUTES = 9 * 60;

/** 주어진 시각의 KST 기준 '자정부터의 분'. */
export function kstMinutesOfDay(now: Date): number {
    const kst = new Date(now.getTime() + KST_OFFSET_MS);
    return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

/**
 * KST 달력일을 @db.Date 컬럼에 넣을 값(UTC 자정)으로 변환한다.
 * 예) 2026-08-20 01:00 KST → 2026-08-20T00:00:00Z
 */
export function kstDateOnly(now: Date): Date {
    const kst = new Date(now.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

/** KST 달력일 하루의 실제 UTC 구간 [start, end). 체결내역 필터에 쓴다. */
export function kstDayRangeUtc(now: Date): { start: Date; end: Date } {
    const dateOnly = kstDateOnly(now); // UTC 자정으로 라벨링된 KST 날짜
    const start = new Date(dateOnly.getTime() - KST_OFFSET_MS);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/**
 * 강제정산 구간에 들어왔는지. (마감 - 버퍼분) 이후면 true. 마감 이후에도 true.
 * @param closeBufferMin 마감 전 버퍼(분). InverseTraderConfig.closeBufferMin
 */
export function isForceSettlementWindow(
    now: Date,
    closeBufferMin: number,
    closeMinutes: number = MARKET_CLOSE_MINUTES
): boolean {
    return kstMinutesOfDay(now) >= closeMinutes - Math.max(0, closeBufferMin);
}

/** 정규장 마감 시각을 지났는지. */
export function isAfterMarketClose(
    now: Date,
    closeMinutes: number = MARKET_CLOSE_MINUTES
): boolean {
    return kstMinutesOfDay(now) >= closeMinutes;
}

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

/** 정산에 필요한 브로커 기능. 시뮬레이션 브로커가 이 모양을 만족한다. */
export type SettlementBroker = Broker & {
    matchOpenOrders?(symbol: string): Promise<FillRecord[]>;
};

export interface SettlementOptions {
    db: InverseTraderDb;
    broker: SettlementBroker;
    sessionId: string;
    symbol: string;
    /** 마감 전 버퍼(분). 기록/로그용 */
    closeBufferMin: number;
    /** 호가단위 표. 기본 ETF(5원 단일) */
    bands?: TickBand[];
    /** 매도 시도 횟수 상한. 기본 20 */
    maxSellAttempts?: number;
    /** 보유수량이 줄지 않는 시도가 연속 몇 번이면 포기할지. 기본 5 */
    noProgressLimit?: number;
    /** 정산 전체 소요시간 상한(ms). 기본 60초 */
    timeLimitMs?: number;
    /** 몇 번째 시도부터 호가를 더 낮춰 공격적으로 걸지. 기본 3 */
    aggressiveAfterAttempts?: number;
    /** 마감 시각(KST 분). 테스트에서 조정 */
    closeMinutes?: number;
    /** 현재시각 주입(테스트용) */
    now?: () => Date;
    logger?: (message: string, meta?: Record<string, any>) => void;
}

export interface SettlementResult {
    sessionId: string;
    symbol: string;
    startedAt: Date;
    finishedAt: Date;
    /** 정산 진입 시 취소한 미체결 주문 수 */
    canceledOrders: number;
    /** 정산 중 낸 매도 주문 수 */
    sellOrders: number;
    /** 정산 중 발생한 체결 건수 */
    sellFills: number;
    /** 정산으로 처분한 수량(주) */
    soldQty: number;
    /** 정산 시작 시점 보유수량(주) */
    startQty: number;
    /** 정산 종료 후 잔여수량(주). 0이어야 성공 */
    remainingQty: number;
    /** ★강제정산 성공 여부. 잔여수량 0 이어야 true */
    success: boolean;
    /** 매도 시도 횟수 */
    attempts: number;
    /** 실패/조기이탈 사유(성공이면 undefined) */
    reason?: string;
    /** 기록된 일일 통계(기록 실패 시 null) */
    dailyStat: InverseDailyStatRow | null;
}

// ─────────────────────────────────────────────────────────────
// ② 미체결 주문 전부 취소
// ─────────────────────────────────────────────────────────────

/**
 * 세션×종목의 살아있는 주문(PENDING/PARTIAL)을 브로커·DB 양쪽에서 취소한다.
 * 부분체결된 주문도 잔량을 0으로 만들어 이후 체결이 반영되지 않게 한다.
 * @returns 취소된 주문 수
 */
export async function cancelAllLiveOrders(
    db: InverseTraderDb,
    broker: SettlementBroker,
    sessionId: string,
    symbol?: string,
    logger?: (message: string, meta?: Record<string, any>) => void
): Promise<number> {
    const where: Record<string, any> = { sessionId, status: { in: LIVE_ORDER_STATUSES } };
    if (symbol) where.symbol = symbol;
    const orders: InverseOrderRow[] = await db.inverseOrder.findMany({ where });

    let canceled = 0;
    for (const order of orders) {
        if (order.brokerOrderId) {
            try {
                await broker.cancelOrder(order.brokerOrderId);
            } catch (e: any) {
                // 브로커에 없는 주문(재시작으로 메모리 유실 등)이라도 DB 는 정리한다.
                logger?.('브로커 주문 취소 실패 — DB만 정리합니다', {
                    orderId: order.id,
                    brokerOrderId: order.brokerOrderId,
                    error: e?.message ?? String(e),
                });
            }
        }
        await db.inverseOrder.update({
            where: { id: order.id },
            data: { status: 'CANCELED', remainingQty: 0 },
        });
        canceled += 1;
    }
    return canceled;
}

// ─────────────────────────────────────────────────────────────
// ⑤ InverseDailyStat 기록
// ─────────────────────────────────────────────────────────────

export interface DailyStatInput {
    sessionId: string;
    /** 기준 시각. KST 달력일로 환산해 저장한다 */
    now: Date;
    /** ★강제정산 성공 여부 */
    forceSettled: boolean;
    /** 마감 시 잔여수량(주) */
    closingQty: number;
    note?: string | null;
}

/**
 * 세션의 오늘자 체결을 집계해 InverseDailyStat 에 upsert 한다.
 * 실현손익은 InversePosition 누적값(세션 기준)을 그대로 쓴다.
 */
export async function writeDailyStat(
    db: InverseTraderDb,
    input: DailyStatInput
): Promise<InverseDailyStatRow> {
    const { sessionId, now, forceSettled, closingQty } = input;
    const date = kstDateOnly(now);
    const { start, end } = kstDayRangeUtc(now);

    // InverseFill 에는 sessionId 가 없다 → 세션의 주문 id 로 역참조한다.
    const orders = await db.inverseOrder.findMany({ where: { sessionId } });
    const orderIds = orders.map((o) => o.id);

    let buyQty = 0;
    let buyAmount = 0;
    let sellQty = 0;
    let sellAmount = 0;
    let fillCount = 0;

    if (orderIds.length > 0) {
        const fills = await db.inverseFill.findMany({
            where: { orderId: { in: orderIds }, filledAt: { gte: start, lt: end } },
        });
        for (const f of fills) {
            fillCount += 1;
            const amount = f.fillPrice * f.fillQty;
            if ((f.side as OrderSide) === 'BUY') {
                buyQty += f.fillQty;
                buyAmount += amount;
            } else {
                sellQty += f.fillQty;
                sellAmount += amount;
            }
        }
    }

    const pnl = await loadSessionPnl(db, sessionId);

    const data = {
        sessionId,
        buyQty,
        buyAmount,
        sellQty,
        sellAmount,
        realizedPnl: pnl.realizedPnl,
        fillCount,
        forceSettled,
        closingQty,
        note: input.note ?? null,
    };

    return db.inverseDailyStat.upsert({
        where: { date },
        create: { date, ...data },
        update: data,
    });
}

// ─────────────────────────────────────────────────────────────
// ③④ 강제정산 본체
// ─────────────────────────────────────────────────────────────

/**
 * 당일 강제정산을 실행한다.
 * 호출 전에 세션 상태를 FORCE_SETTLEMENT 로 바꿔 두는 것은 호출측(engine) 책임이다.
 *
 * ★ 여기서는 전략(strategy)을 절대 태우지 않는다 — 매도 체결마다 후속 매수가
 *   다시 생기면 보유수량이 0으로 수렴하지 않기 때문이다.
 */
export async function runForceSettlement(options: SettlementOptions): Promise<SettlementResult> {
    const {
        db,
        broker,
        sessionId,
        symbol,
        closeBufferMin,
        bands = ETF_TICK_BANDS,
        maxSellAttempts = 20,
        noProgressLimit = 5,
        timeLimitMs = 60_000,
        aggressiveAfterAttempts = 3,
        closeMinutes = MARKET_CLOSE_MINUTES,
        logger,
    } = options;
    const nowFn = options.now ?? (() => new Date());

    const startedAt = nowFn();
    const startedMs = Date.now();
    const log = (message: string, meta?: Record<string, any>) => logger?.(message, meta);

    log('강제정산 시작', { sessionId, symbol, closeBufferMin });

    // ② 미체결 주문 전부 취소
    let canceledOrders = await cancelAllLiveOrders(db, broker, sessionId, symbol, logger);

    const startPosition = await loadPosition(db, sessionId, symbol);
    const startQty = startPosition.qty;

    // 브로커 주문번호 → InverseOrder.id (정산 중에 낸 주문만 추적하면 된다)
    const orderIdMap = new Map<string, number>();

    let sellOrders = 0;
    let sellFills = 0;
    let attempts = 0;
    let noProgress = 0;
    let reason: string | undefined;

    // ③ 보유수량이 0이 될 때까지 호가 추종 지정가 매도
    //    ★이탈 조건 3종: 시도횟수 상한 / 무진전 연속 상한 / 총 소요시간 상한
    let remainingQty = startQty;
    while (remainingQty > 0) {
        if (attempts >= maxSellAttempts) {
            reason = `매도 시도 횟수 상한(${maxSellAttempts}회)에 도달해 정산 루프를 종료합니다.`;
            break;
        }
        if (Date.now() - startedMs >= timeLimitMs) {
            reason = `정산 소요시간 상한(${timeLimitMs}ms)을 넘겨 루프를 종료합니다.`;
            break;
        }
        if (noProgress >= noProgressLimit) {
            reason = `보유수량이 ${noProgressLimit}회 연속 줄지 않아 정산 루프를 종료합니다.`;
            break;
        }
        attempts += 1;

        // 직전 시도에서 남은 매도 주문은 정리하고 새 호가로 다시 건다(중복 적체 방지).
        if (attempts > 1) {
            canceledOrders += await cancelAllLiveOrders(db, broker, sessionId, symbol, logger);
        }

        const quote = await broker.getQuote(symbol);
        // 호가 추종: 최우선 매수호가에 붙여 판다. 시장가는 쓰지 않는다.
        // 시도가 거듭될수록 1호가씩 더 낮춰(=더 공격적으로) 건다.
        const extraSteps = Math.max(0, attempts - aggressiveAfterAttempts);
        const limitPrice =
            extraSteps > 0
                ? tickDown(quote.bidPrice, extraSteps, bands)
                : alignToTick(quote.bidPrice, bands);

        let placedOrderId: number | null = null;
        try {
            const placed = await broker.placeOrder({
                symbol,
                side: 'SELL',
                price: limitPrice,
                qty: remainingQty,
                clientTag: 'FORCE_SETTLEMENT_SELL',
            });
            const row = await recordOrder(db, {
                sessionId,
                symbol,
                side: 'SELL',
                limitPrice,
                orderQty: remainingQty,
                brokerOrderId: placed.order.orderId,
            });
            placedOrderId = row.id;
            orderIdMap.set(placed.order.orderId, row.id);
            sellOrders += 1;

            sellFills += await applyFills(db, sessionId, placed.fills, orderIdMap, log);
        } catch (e: any) {
            log('정산 매도 주문 실패', { attempt: attempts, limitPrice, error: e?.message ?? String(e) });
        }

        // 대기 주문 매칭(큐 체결분 수거)
        if (typeof broker.matchOpenOrders === 'function' && placedOrderId !== null) {
            try {
                const fills = await broker.matchOpenOrders(symbol);
                sellFills += await applyFills(db, sessionId, fills, orderIdMap, log);
            } catch (e: any) {
                log('정산 매칭 실패', { attempt: attempts, error: e?.message ?? String(e) });
            }
        }

        const after = await loadPosition(db, sessionId, symbol);
        if (after.qty >= remainingQty) noProgress += 1;
        else noProgress = 0;
        remainingQty = after.qty;
        log('정산 매도 시도', { attempt: attempts, limitPrice, remainingQty, noProgress });
    }

    // 루프를 빠져나온 뒤 남아 있는 매도 주문도 정리한다(미체결 방치 금지).
    canceledOrders += await cancelAllLiveOrders(db, broker, sessionId, symbol, logger);

    // ④ 최종 보유수량 0 확인
    const finalPosition = await loadPosition(db, sessionId, symbol);
    remainingQty = finalPosition.qty;
    const success = remainingQty === 0;
    if (!success && !reason) {
        reason = `정산 루프 종료 후에도 보유수량이 ${remainingQty}주 남았습니다.`;
    }

    const finishedAt = nowFn();
    const afterClose = isAfterMarketClose(finishedAt, closeMinutes);
    if (!success) {
        reason =
            `강제정산 실패: 잔여수량 ${remainingQty}주` +
            (afterClose ? ' (정규장 마감 이후)' : ' (마감 전)') +
            (reason ? ` — ${reason}` : '');
    }

    // ⑤ 일일 통계 기록 (실패해도 결과 반환은 막지 않는다)
    let dailyStat: InverseDailyStatRow | null = null;
    try {
        dailyStat = await writeDailyStat(db, {
            sessionId,
            now: finishedAt,
            forceSettled: success,
            closingQty: remainingQty,
            note: success ? null : reason ?? null,
        });
    } catch (e: any) {
        log('일일 통계 기록 실패', { error: e?.message ?? String(e) });
    }

    const result: SettlementResult = {
        sessionId,
        symbol,
        startedAt,
        finishedAt,
        canceledOrders,
        sellOrders,
        sellFills,
        soldQty: Math.max(0, startQty - remainingQty),
        startQty,
        remainingQty,
        success,
        attempts,
        reason,
        dailyStat,
    };
    log(success ? '강제정산 완료' : '★강제정산 실패', result as any);
    return result;
}

/** 체결 목록을 DB에 반영한다. @returns 반영된 체결 건수 */
async function applyFills(
    db: InverseTraderDb,
    sessionId: string,
    fills: FillRecord[],
    orderIdMap: Map<string, number>,
    log: (message: string, meta?: Record<string, any>) => void
): Promise<number> {
    let applied = 0;
    for (const fill of fills) {
        const dbOrderId = orderIdMap.get(fill.orderId);
        if (dbOrderId === undefined) {
            // 정산 중 낸 주문이 아니면(취소 전에 남아 있던 주문 등) 건너뛴다.
            log('정산 중 알 수 없는 주문의 체결 — 건너뜁니다', { brokerOrderId: fill.orderId });
            continue;
        }
        try {
            await applyFill(db, {
                sessionId,
                orderId: dbOrderId,
                fillPrice: fill.fillPrice,
                fillQty: fill.fillQty,
                filledAt: fill.filledAt,
            });
            applied += 1;
        } catch (e: any) {
            log('정산 체결 반영 실패', { orderId: dbOrderId, error: e?.message ?? String(e) });
        }
    }
    return applied;
}

// ─────────────────────────────────────────────────────────────
// Vercel 방어용 기본 export
// ─────────────────────────────────────────────────────────────
/**
 * ★이 파일은 모듈이지 HTTP 엔드포인트가 아니다.
 *   다만 Vercel 은 api/ 아래 .ts 를 전부 서버리스 함수로 잡기 때문에,
 *   default export 가 없으면 /api/inverse-trader/settlement 호출 시 런타임 오류가 난다.
 *   실제 API 는 2026-08-20 서버1(shared-api/routes/aimp/admin-inverse-trader.ts)로
 *   옮겼다. 이 파일은 백테스트·테스트(scripts/inverse-trader/)가 쓰는 **라이브러리**로
 *   남아 있는 것이며, HTTP 로는 404 로 막는다.
 */
export default async function notAnEndpoint(_req: any, res: any) {
    return res.status(404).json({ error: 'Not found', hint: '/api/admin/inverse-trader/status 를 사용하세요.' });
}
