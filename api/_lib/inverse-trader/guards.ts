/**
 * 인버스 ETF 1호가 스캘핑 — 안전장치(가드).
 *
 * ★★ 이 파일에도, 이 디렉터리 어디에도 증권사 주문 API / 외부 브로커 HTTP 호출은 없다. ★★
 *    주문은 오직 simulation-broker.ts 를 통해서만 나간다. 가드는 그 앞단에서
 *    '주문을 만들어도 되는가'만 판정한다.
 *
 * 가드 3종
 *  1) TRADING_MODE 가드 — SIMULATION 이 아니면 어떤 주문도 만들지 않고 즉시 에러.
 *  2) 최대보유수량 가드 — 초과 예상이면 신규 매수 차단(보유 청산 매도는 허용).
 *  3) 일일 최대손실 가드 — 초과 시 신규 주문 전면 차단 + 세션 EMERGENCY_STOP 전환.
 */

import {
    TRADING_MODE,
    assertSimulationMode,
    resolveTradingMode,
    type OrderSide,
    type TradingMode,
} from './constants.js';
import type { InverseTraderDb } from './db.js';

// ── 에러 타입 ──────────────────────────────────────────────────────────────

/** 최대보유수량 초과로 신규 매수가 차단됨. */
export class PositionLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PositionLimitError';
    }
}

/** 일일 최대손실 초과로 매매가 정지됨(세션 EMERGENCY_STOP). */
export class DailyLossLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DailyLossLimitError';
    }
}

/** 세션이 매매 가능한 상태가 아님(STOPPED / EMERGENCY_STOP 등). */
export class SessionNotTradableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionNotTradableError';
    }
}

// ── 공용 타입 ──────────────────────────────────────────────────────────────

/**
 * 전략이 만들어낸 '주문 의도'. 가드를 통과해야 브로커로 나간다.
 * (strategy.ts 가 이 타입을 재수출한다 — 순환 import 를 피하려고 여기에 둔다)
 */
export interface OrderIntent {
    sessionId: string;
    symbol: string;
    side: OrderSide;
    /** 지정가(원, 호가단위 정렬됨) */
    limitPrice: number;
    /** 주문수량(주) */
    qty: number;
    /** 이 주문을 낳은 체결의 주문ID(InverseOrder.id) */
    parentOrderId?: number | null;
    /** 로그/추적용 태그 (예: 'SESSION_START', 'AFTER_BUY_SELL') */
    reason?: string;
}

/** 가드 판정 결과. */
export interface GuardDecision {
    allowed: boolean;
    /** 허용된 수량(차단이면 0). 축소 허용 가드(매도)만 원수량과 달라질 수 있다. */
    allowedQty: number;
    /** 차단/축소 사유(사람이 읽는 문구). 허용이면 undefined */
    reason?: string;
}

export interface RiskLimits {
    /** 최대 보유수량(주). InverseTraderConfig.maxPositionQty */
    maxPositionQty: number;
    /** 일일 최대 손실액(원, 양수). InverseTraderConfig.dailyLossLimit */
    dailyLossLimit: number;
}

// ── 1) TRADING_MODE 가드 ───────────────────────────────────────────────────

/**
 * 매매 모드가 SIMULATION 인지 확정한다.
 * 환경변수(INVERSE_TRADING_MODE)와 DB 설정(InverseTraderConfig.tradingMode)
 * 두 경로를 모두 검사하고, 하나라도 SIMULATION 이 아니면 예외를 던진다.
 *
 * ★ 주문을 만드는 모든 경로는 이 함수를 가장 먼저 호출해야 한다.
 */
export function assertSimulationTrading(configuredMode?: string | null): TradingMode {
    resolveTradingMode(); // 환경변수 경로 (LIVE 면 LiveTradingBlockedError)
    return assertSimulationMode(configuredMode); // DB 설정 경로
}

/** 브로커가 시뮬레이션 구현체인지 확인한다(실거래 구현체 주입 방지). */
export function assertSimulationBroker(broker: { mode?: string } | null | undefined): void {
    if (!broker || broker.mode !== TRADING_MODE) {
        throw new Error(
            `시뮬레이션 브로커가 아닙니다(mode=${broker?.mode ?? 'undefined'}). ` +
            `이 시스템은 ${TRADING_MODE} 전용이며 증권사 주문 API를 호출하지 않습니다.`
        );
    }
}

// ── 2) 최대보유수량 가드 ───────────────────────────────────────────────────

export interface BuyGuardParams {
    /** 현재 보유수량(주). 매도 포지션이면 음수 */
    currentQty: number;
    /** 이미 접수되어 살아있는 매수주문 잔량 합계(주) */
    pendingBuyQty: number;
    /** 이번에 내려는 매수수량(주) */
    requestedQty: number;
    maxPositionQty: number;
}

/**
 * 신규 매수 판정.
 * (보유 + 미체결 매수잔량 + 신규수량) 이 최대보유수량을 넘으면 **차단**한다.
 * 수량을 줄여서 통과시키지 않는다 — 사양이 '차단'이므로 부분 허용은 하지 않는다.
 * 남은 여유분은 reason 에 적어 로그에서 확인할 수 있게 한다.
 */
export function evaluateBuyGuard(params: BuyGuardParams): GuardDecision {
    const { currentQty, pendingBuyQty, requestedQty, maxPositionQty } = params;
    if (requestedQty <= 0) {
        return { allowed: false, allowedQty: 0, reason: '매수수량이 0 이하입니다.' };
    }
    const projected = currentQty + pendingBuyQty + requestedQty;
    if (projected > maxPositionQty) {
        const headroom = Math.max(0, maxPositionQty - currentQty - pendingBuyQty);
        return {
            allowed: false,
            allowedQty: 0,
            reason:
                `최대보유수량 초과 예상으로 신규 매수 차단: ` +
                `보유 ${currentQty} + 미체결매수 ${pendingBuyQty} + 신규 ${requestedQty} ` +
                `= ${projected} > 한도 ${maxPositionQty} (여유 ${headroom}주)`,
        };
    }
    return { allowed: true, allowedQty: requestedQty };
}

export interface SellGuardParams {
    /** 현재 보유수량(주) */
    currentQty: number;
    /** 이미 접수되어 살아있는 매도주문 잔량 합계(주) */
    pendingSellQty: number;
    /** 이번에 내려는 매도수량(주) */
    requestedQty: number;
    /**
     * 보유수량을 넘는 매도(공매도) 허용 여부. 기본 false.
     * 국내 ETF 개인 공매도는 불가하므로 시뮬레이션도 기본 차단한다.
     */
    allowShort?: boolean;
}

/**
 * 매도 판정. 청산 매도는 최대보유수량 가드의 영향을 받지 않는다(항상 허용).
 * 다만 보유수량을 넘는 매도는 기본적으로 보유 잔량까지 축소한다.
 */
export function evaluateSellGuard(params: SellGuardParams): GuardDecision {
    const { currentQty, pendingSellQty, requestedQty, allowShort = false } = params;
    if (requestedQty <= 0) {
        return { allowed: false, allowedQty: 0, reason: '매도수량이 0 이하입니다.' };
    }
    if (allowShort) return { allowed: true, allowedQty: requestedQty };

    const sellable = Math.max(0, currentQty - pendingSellQty);
    if (sellable <= 0) {
        return {
            allowed: false,
            allowedQty: 0,
            reason:
                `매도 가능 수량이 없습니다(보유 ${currentQty} - 미체결매도 ${pendingSellQty}). ` +
                `공매도는 허용하지 않습니다.`,
        };
    }
    if (requestedQty > sellable) {
        return {
            allowed: true,
            allowedQty: sellable,
            reason: `보유 잔량에 맞춰 매도수량을 ${requestedQty} → ${sellable} 로 축소했습니다.`,
        };
    }
    return { allowed: true, allowedQty: requestedQty };
}

// ── 3) 일일 최대손실 가드 ──────────────────────────────────────────────────

export interface DailyLossParams {
    /** 실현손익(원). 손실이면 음수 */
    realizedPnl: number;
    /** 평가손익(원). 손실이면 음수 */
    unrealizedPnl?: number;
    /** 일일 최대손실액(원, 양수) */
    dailyLossLimit: number;
    /** 평가손익을 손실 판정에 포함할지. 기본 true */
    includeUnrealized?: boolean;
}

/** 일일 손실 한도 초과 여부. 한도는 양수로 주고 손익 합계가 -한도 이하이면 초과. */
export function isDailyLossBreached(params: DailyLossParams): boolean {
    const { realizedPnl, unrealizedPnl = 0, dailyLossLimit, includeUnrealized = true } = params;
    if (!(dailyLossLimit > 0)) return false; // 한도 미설정(0/음수)이면 판정하지 않는다
    const total = realizedPnl + (includeUnrealized ? unrealizedPnl : 0);
    return total <= -Math.abs(dailyLossLimit);
}

/** 세션 누적 손익(포지션 테이블 기준). */
export interface SessionPnl {
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
}

/** 세션ID 기준으로 실현/평가손익을 합산한다. */
export async function loadSessionPnl(db: InverseTraderDb, sessionId: string): Promise<SessionPnl> {
    const positions = await db.inversePosition.findMany({ where: { sessionId } });
    let realizedPnl = 0;
    let unrealizedPnl = 0;
    for (const p of positions) {
        realizedPnl += p.realizedPnl ?? 0;
        unrealizedPnl += p.unrealizedPnl ?? 0;
    }
    return { realizedPnl, unrealizedPnl, totalPnl: realizedPnl + unrealizedPnl };
}

/** 세션을 EMERGENCY_STOP 으로 전환한다(중복 호출해도 안전). */
export async function emergencyStopSession(
    db: InverseTraderDb,
    sessionId: string,
    reason: string
): Promise<void> {
    await db.inverseTraderSession.update({
        where: { id: sessionId },
        data: { status: 'EMERGENCY_STOP', lastError: reason },
    });
}

export interface DailyLossGuardResult {
    breached: boolean;
    pnl: SessionPnl;
    reason?: string;
}

/**
 * 일일 손실 한도를 검사하고, 초과하면 세션을 EMERGENCY_STOP 으로 전환한다.
 * 반환값의 breached 가 true 면 호출측은 **신규 주문을 전면 중단**해야 한다.
 * (throwOnBreach=true 로 주면 DailyLossLimitError 를 던진다)
 */
export async function enforceDailyLossLimit(
    db: InverseTraderDb,
    params: {
        sessionId: string;
        dailyLossLimit: number;
        includeUnrealized?: boolean;
        throwOnBreach?: boolean;
    }
): Promise<DailyLossGuardResult> {
    const { sessionId, dailyLossLimit, includeUnrealized = true, throwOnBreach = false } = params;
    const pnl = await loadSessionPnl(db, sessionId);
    const breached = isDailyLossBreached({
        realizedPnl: pnl.realizedPnl,
        unrealizedPnl: pnl.unrealizedPnl,
        dailyLossLimit,
        includeUnrealized,
    });
    if (!breached) return { breached: false, pnl };

    const reason =
        `일일 최대손실 초과로 매매를 정지합니다: ` +
        `실현 ${Math.round(pnl.realizedPnl)}원 + 평가 ${Math.round(pnl.unrealizedPnl)}원 ` +
        `= ${Math.round(pnl.totalPnl)}원 (한도 -${Math.abs(dailyLossLimit)}원)`;
    await emergencyStopSession(db, sessionId, reason);
    if (throwOnBreach) throw new DailyLossLimitError(reason);
    return { breached: true, pnl, reason };
}

// ── 세션 상태 가드 ─────────────────────────────────────────────────────────

/** 신규 주문을 낼 수 있는 세션 상태. */
export const TRADABLE_SESSION_STATUSES = ['IDLE', 'RUNNING'];

/**
 * 세션이 신규 주문을 낼 수 있는 상태인지 확인한다.
 * EMERGENCY_STOP / STOPPED / FORCE_SETTLEMENT 에서는 신규 주문을 만들지 않는다.
 * (FORCE_SETTLEMENT 중 청산 매도는 다음 묶음의 정산 루틴이 별도 경로로 처리한다)
 */
export async function assertSessionTradable(
    db: InverseTraderDb,
    sessionId: string
): Promise<void> {
    const session = await db.inverseTraderSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new SessionNotTradableError(`세션을 찾을 수 없습니다: ${sessionId}`);
    if (!TRADABLE_SESSION_STATUSES.includes(String(session.status))) {
        throw new SessionNotTradableError(
            `세션 상태가 ${session.status} 라 신규 주문을 만들지 않습니다(세션 ${sessionId}).`
        );
    }
}
