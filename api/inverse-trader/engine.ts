/**
 * 인버스 ETF 1호가 스캘핑 — 세션 런루프.
 *
 * 하는 일
 *  - 세션 시작 / 중지 / 긴급정지
 *  - 틱마다: quote-feed 호가 → simulation-broker 체결 판정 → position-manager 반영
 *            → strategy 후속주문 → guards 검사 → 마감버퍼 진입 시 settlement
 *
 * ★ 상시 데몬 프로세스를 새로 띄우지 않는다.
 *   - 기본 구동 방식은 **API 호출로 tick 을 진행**하는 것이다(POST /api/inverse-trader/tick).
 *     Vercel 서버리스에서는 프로세스가 요청 사이에 살아있지 않으므로 이게 유일하게
 *     신뢰할 수 있는 방식이다.
 *   - 프로세스가 계속 떠 있는 환경(로컬 local-api 등)에서는 환경변수
 *     INVERSE_TRADER_TICK_MS 를 주면 인메모리 setInterval 로도 돈다. 기본값 0(비활성).
 *
 * ★ 재진입 방지
 *   - 동시에 살아있는 세션은 1개로 제한한다(activeSessionId).
 *   - 시작 요청이 겹쳐도 하나만 통과한다(startInFlight 락 + DB 활성세션 조회).
 *   - 틱이 겹쳐 들어와도 하나만 돈다(tickInFlight 락). 정산도 1회만 돈다(settlementRunning).
 *
 * ★ 콜드스타트 주의(정직하게 남겨두는 한계)
 *   시뮬레이션 브로커의 주문은 프로세스 메모리에만 있다. 서버리스에서 프로세스가
 *   재활용되면 DB 에는 PENDING 인데 브로커에는 없는 '고아 주문'이 생긴다.
 *   그래서 재수화(rehydrate) 시 고아 주문을 전부 CANCELED 로 정리하고 세션 시작
 *   주문을 다시 낸다. 이 사실은 세션 lastError 와 상태 API 에 그대로 노출한다.
 *
 * ★ 증권사 주문 API 호출 없음. 주문은 simulation-broker 를 통해서만 나간다.
 */

import type { Quote } from '../_lib/inverse-trader/broker.js';
import {
    TRADING_MODE,
    assertSimulationMode,
    type SessionStatus,
    type TradingMode,
} from '../_lib/inverse-trader/constants.js';
import {
    LIVE_ORDER_STATUSES,
    type InverseDailyStatRow,
    type InverseFillRow,
    type InverseOrderRow,
    type InverseTraderConfigRow,
    type InverseTraderDb,
    type InverseTraderSessionRow,
} from '../_lib/inverse-trader/db.js';
import { loadSessionPnl } from '../_lib/inverse-trader/guards.js';
import { computeUnrealizedPnl, loadPosition } from '../_lib/inverse-trader/position-manager.js';
import {
    SimulatedQuoteFeed,
    type SimulatedQuoteFeedOptions,
} from '../_lib/inverse-trader/quote-feed.js';
import {
    createSimulationBroker,
    type SimulationBroker,
} from '../_lib/inverse-trader/simulation-broker.js';
import { createStrategy, type InverseScalpingStrategy } from '../_lib/inverse-trader/strategy.js';
import {
    MARKET_CLOSE_MINUTES,
    cancelAllLiveOrders,
    isForceSettlementWindow,
    kstDateOnly,
    kstMinutesOfDay,
    runForceSettlement,
    writeDailyStat,
    type SettlementResult,
} from './settlement.js';

// ─────────────────────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────────────────────

/** DB 설정이 하나도 없을 때 쓰는 기본값. schema.prisma 의 @default 와 맞춰 둔다. */
export const DEFAULT_TRADER_CONFIG = {
    symbol: '252670',
    symbolName: 'KODEX 200선물인버스2X',
    defaultQty: 1_000_000,
    closeBufferMin: 10,
    maxPositionQty: 3_000_000,
    dailyLossLimit: 500_000,
    tradingMode: TRADING_MODE as string,
    enabled: false,
};

export type TraderConfig = typeof DEFAULT_TRADER_CONFIG & { id?: number };

/** 세션이 이미 돌고 있을 때. API 는 409 로 매핑한다. */
export class SessionAlreadyRunningError extends Error {
    constructor(public readonly sessionId: string) {
        super(`이미 실행 중인 세션이 있습니다: ${sessionId}`);
        this.name = 'SessionAlreadyRunningError';
    }
}

/** 대상 세션이 없을 때. API 는 404 로 매핑한다. */
export class SessionNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionNotFoundError';
    }
}

/** InverseTraderConfig 를 읽어 온다. 없으면 기본값. */
export async function loadTraderConfig(db: InverseTraderDb): Promise<TraderConfig> {
    let row: InverseTraderConfigRow | null = null;
    try {
        row = await db.inverseTraderConfig.findFirst({ orderBy: { id: 'desc' } });
    } catch {
        row = null;
    }
    if (!row) return { ...DEFAULT_TRADER_CONFIG };
    return {
        id: row.id,
        symbol: row.symbol,
        symbolName: row.symbolName,
        defaultQty: row.defaultQty,
        closeBufferMin: row.closeBufferMin,
        maxPositionQty: row.maxPositionQty,
        dailyLossLimit: row.dailyLossLimit,
        // ★DB 에 LIVE 가 들어와 있어도 여기서 예외로 막는다.
        tradingMode: assertSimulationMode(row.tradingMode),
        enabled: row.enabled,
    };
}

// ─────────────────────────────────────────────────────────────
// 런타임(인메모리)
// ─────────────────────────────────────────────────────────────

export interface EngineRuntime {
    sessionId: string;
    config: TraderConfig;
    feed: SimulatedQuoteFeed;
    broker: SimulationBroker;
    strategy: InverseScalpingStrategy;
    status: SessionStatus;
    /** 인메모리 인터벌(있을 때만). 서버리스에서는 null */
    timer: any | null;
    /** ★틱 재진입 방지 */
    tickInFlight: boolean;
    /** ★정산 재진입 방지 */
    settlementRunning: boolean;
    settlementDone: boolean;
    settlement: SettlementResult | null;
    tickCount: number;
    lastTickAt: Date | null;
    lastError: string | null;
    startedAt: Date;
    logs: string[];
}

/** 프로세스 안의 세션 런타임. 동시에 1개만 유지한다. */
const runtimes = new Map<string, EngineRuntime>();
/** ★동시에 살아있는 세션은 1개 — 재진입 방지의 핵심 */
let activeSessionId: string | null = null;
/** 시작 요청 동시 진입 방지 */
let startInFlight = false;

/** 인메모리 인터벌 주기(ms). 0/미설정이면 인터벌을 쓰지 않고 API tick 으로만 돈다. */
export function getTickIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
    const raw = Number(env.INVERSE_TRADER_TICK_MS ?? 0);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.max(200, Math.floor(raw));
}

/** 현재 프로세스가 들고 있는 런타임. */
export function getRuntime(sessionId?: string): EngineRuntime | null {
    const id = sessionId ?? activeSessionId;
    if (!id) return null;
    return runtimes.get(id) ?? null;
}

function pushLog(rt: EngineRuntime, message: string, meta?: Record<string, any>): void {
    const line = `[${new Date().toISOString()}] ${message}${meta ? ' ' + safeJson(meta) : ''}`;
    rt.logs.push(line);
    if (rt.logs.length > 200) rt.logs.splice(0, rt.logs.length - 200);
}

function safeJson(value: any): string {
    try {
        return JSON.stringify(value);
    } catch {
        return '[unserializable]';
    }
}

function buildRuntime(
    db: InverseTraderDb,
    session: InverseTraderSessionRow,
    config: TraderConfig,
    feedOptions?: SimulatedQuoteFeedOptions
): EngineRuntime {
    const feed = new SimulatedQuoteFeed(feedOptions);
    const broker = createSimulationBroker({ feed });
    const rt: EngineRuntime = {
        sessionId: session.id,
        config,
        feed,
        broker,
        strategy: null as any,
        status: (session.status as SessionStatus) ?? 'IDLE',
        timer: null,
        tickInFlight: false,
        settlementRunning: false,
        settlementDone: false,
        settlement: null,
        tickCount: 0,
        lastTickAt: null,
        lastError: session.lastError ?? null,
        startedAt: session.startedAt ?? new Date(),
        logs: [],
    };
    rt.strategy = createStrategy(db, broker, {
        sessionId: session.id,
        symbol: config.symbol,
        defaultQty: config.defaultQty,
        maxPositionQty: config.maxPositionQty,
        dailyLossLimit: config.dailyLossLimit,
        tradingMode: config.tradingMode,
        logger: (message, meta) => pushLog(rt, message, meta),
    });
    return rt;
}

/** 인메모리 인터벌 정지(있으면). */
function clearTimer(rt: EngineRuntime): void {
    if (rt.timer) {
        clearInterval(rt.timer);
        rt.timer = null;
    }
}

/** 인메모리 인터벌 시작. 서버리스에서는 INVERSE_TRADER_TICK_MS 미설정이라 아무 일도 안 한다. */
function maybeStartTimer(db: InverseTraderDb, rt: EngineRuntime): void {
    const intervalMs = getTickIntervalMs();
    if (intervalMs <= 0 || rt.timer) return;
    rt.timer = setInterval(() => {
        // 인터벌 콜백에서도 tickInFlight 락을 그대로 탄다(재진입 방지).
        void tickSession(db, rt.sessionId).catch((e: any) => {
            rt.lastError = e?.message ?? String(e);
            pushLog(rt, '인터벌 틱 실패', { error: rt.lastError });
        });
    }, intervalMs);
    // 프로세스 종료를 막지 않도록(있으면) unref
    if (typeof rt.timer?.unref === 'function') rt.timer.unref();
}

// ─────────────────────────────────────────────────────────────
// 세션 시작
// ─────────────────────────────────────────────────────────────

/** 신규 주문을 낼 수 있는(=아직 살아있는) 세션 상태. */
const LIVE_SESSION_STATUSES: SessionStatus[] = ['RUNNING', 'FORCE_SETTLEMENT'];

export interface StartSessionResult {
    session: InverseTraderSessionRow;
    runtime: EngineRuntime;
    /** 세션 시작 주문이 접수됐는지 */
    seeded: boolean;
    seedReason?: string;
    /** 기존 세션을 이어받아 재수화한 경우 true */
    rehydrated: boolean;
}

/**
 * 세션 시작.
 * ★이미 도는 세션이 있으면 새로 만들지 않는다 — 인메모리와 DB 양쪽을 확인한다.
 */
export async function startSession(
    db: InverseTraderDb,
    options: { feedOptions?: SimulatedQuoteFeedOptions; now?: () => Date } = {}
): Promise<StartSessionResult> {
    if (startInFlight) {
        throw new SessionAlreadyRunningError(activeSessionId ?? '(시작 처리 중)');
    }
    startInFlight = true;
    try {
        const config = await loadTraderConfig(db); // ★LIVE 면 여기서 예외

        // 1) 인메모리에 살아있는 런타임이 있으면 거부
        const existingRt = getRuntime();
        if (existingRt && LIVE_SESSION_STATUSES.includes(existingRt.status)) {
            throw new SessionAlreadyRunningError(existingRt.sessionId);
        }

        // 2) DB 에 살아있는 세션이 있으면 — 같은 프로세스가 아니면 재수화해서 이어받는다
        const dbLive = await db.inverseTraderSession.findFirst({
            where: { status: { in: LIVE_SESSION_STATUSES } },
            orderBy: { startedAt: 'desc' },
        });
        if (dbLive) {
            const rt = await rehydrate(db, dbLive, config, options.feedOptions);
            return { session: dbLive, runtime: rt, seeded: false, rehydrated: true, seedReason: rt.lastError ?? undefined };
        }

        // 3) 새 세션 생성
        const now = (options.now ?? (() => new Date()))();
        const session = await db.inverseTraderSession.create({
            data: { status: 'RUNNING', startedAt: now, lastError: null },
        });
        const rt = buildRuntime(db, session, config, options.feedOptions);
        rt.status = 'RUNNING';
        runtimes.set(session.id, rt);
        activeSessionId = session.id;
        pushLog(rt, '세션 시작', { sessionId: session.id, symbol: config.symbol, mode: config.tradingMode });

        // 세션 시작 주문(현재 매수호가 -1호가 매수)
        let seeded = false;
        let seedReason: string | undefined;
        try {
            const result = await rt.strategy.start();
            seeded = !result.skipped;
            seedReason = result.reason;
        } catch (e: any) {
            seedReason = e?.message ?? String(e);
            rt.lastError = seedReason ?? null;
            await db.inverseTraderSession.update({
                where: { id: session.id },
                data: { lastError: seedReason },
            });
            pushLog(rt, '세션 시작 주문 실패', { error: seedReason });
        }

        maybeStartTimer(db, rt);
        return { session, runtime: rt, seeded, seedReason, rehydrated: false };
    } finally {
        startInFlight = false;
    }
}

/**
 * DB 에는 살아있는데 이 프로세스에 런타임이 없는 세션을 이어받는다.
 * 브로커 메모리가 비어 있으므로 DB 의 고아 주문을 전부 취소하고 시작 주문을 다시 낸다.
 */
async function rehydrate(
    db: InverseTraderDb,
    session: InverseTraderSessionRow,
    config: TraderConfig,
    feedOptions?: SimulatedQuoteFeedOptions
): Promise<EngineRuntime> {
    const cached = runtimes.get(session.id);
    if (cached) {
        activeSessionId = session.id;
        return cached;
    }

    const rt = buildRuntime(db, session, config, feedOptions);
    runtimes.set(session.id, rt);
    activeSessionId = session.id;

    const orphaned = await cancelAllLiveOrders(db, rt.broker, session.id, config.symbol, (m, meta) =>
        pushLog(rt, m, meta)
    );
    if (orphaned > 0) {
        const note =
            `프로세스 재시작으로 브로커 메모리가 비어 있어 고아 주문 ${orphaned}건을 취소했습니다` +
            `(시뮬레이션 브로커는 인메모리라 재시작 시 미체결 주문이 유실됩니다).`;
        rt.lastError = note;
        await db.inverseTraderSession.update({ where: { id: session.id }, data: { lastError: note } });
        pushLog(rt, '세션 재수화 — 고아 주문 정리', { orphaned });
    }

    if (rt.status === 'RUNNING') {
        try {
            await rt.strategy.start();
        } catch (e: any) {
            pushLog(rt, '재수화 후 시작 주문 실패', { error: e?.message ?? String(e) });
        }
    }
    maybeStartTimer(db, rt);
    return rt;
}

/** 상태 조회/틱에서 쓰는 런타임 확보 — 없으면 DB 기준으로 재수화한다. */
export async function ensureRuntime(
    db: InverseTraderDb,
    sessionId?: string
): Promise<EngineRuntime | null> {
    const cached = getRuntime(sessionId);
    if (cached) return cached;

    const session = sessionId
        ? await db.inverseTraderSession.findUnique({ where: { id: sessionId } })
        : await db.inverseTraderSession.findFirst({
              where: { status: { in: LIVE_SESSION_STATUSES } },
              orderBy: { startedAt: 'desc' },
          });
    if (!session) return null;
    if (!LIVE_SESSION_STATUSES.includes(session.status as SessionStatus)) return null;

    const config = await loadTraderConfig(db);
    return rehydrate(db, session, config);
}

// ─────────────────────────────────────────────────────────────
// 틱 런루프
// ─────────────────────────────────────────────────────────────

export interface TickResult {
    sessionId: string | null;
    status: SessionStatus | 'NONE';
    /** 이번 틱에서 처리한 체결 건수 */
    fills: number;
    /** 재진입/비활성 등으로 건너뛴 경우 */
    skipped: boolean;
    reason?: string;
    quote?: Quote;
    /** 이번 틱에서 강제정산이 돌았으면 그 결과 */
    settlement?: SettlementResult;
}

/**
 * 틱 1회 진행.
 *  - 마감버퍼에 들어갔으면 정산으로 넘어간다(전략은 더 이상 돌리지 않는다).
 *  - ★tickInFlight 로 재진입을 막는다.
 */
export async function tickSession(
    db: InverseTraderDb,
    sessionId?: string,
    options: { now?: () => Date } = {}
): Promise<TickResult> {
    const rt = await ensureRuntime(db, sessionId);
    if (!rt) {
        return { sessionId: sessionId ?? null, status: 'NONE', fills: 0, skipped: true, reason: '실행 중인 세션이 없습니다.' };
    }
    if (rt.tickInFlight) {
        return { sessionId: rt.sessionId, status: rt.status, fills: 0, skipped: true, reason: '이전 틱이 아직 처리 중입니다(재진입 방지).' };
    }
    rt.tickInFlight = true;
    const nowFn = options.now ?? (() => new Date());
    try {
        // DB 상태를 기준으로 삼는다(다른 인스턴스가 긴급정지했을 수 있다).
        const session = await db.inverseTraderSession.findUnique({ where: { id: rt.sessionId } });
        if (!session) {
            runtimes.delete(rt.sessionId);
            if (activeSessionId === rt.sessionId) activeSessionId = null;
            return { sessionId: rt.sessionId, status: 'NONE', fills: 0, skipped: true, reason: '세션 레코드가 없습니다.' };
        }
        rt.status = session.status as SessionStatus;
        rt.lastError = session.lastError ?? rt.lastError;

        if (rt.status === 'STOPPED' || rt.status === 'EMERGENCY_STOP') {
            clearTimer(rt);
            return { sessionId: rt.sessionId, status: rt.status, fills: 0, skipped: true, reason: `세션 상태가 ${rt.status} 라 틱을 진행하지 않습니다.` };
        }

        rt.tickCount += 1;
        rt.lastTickAt = nowFn();

        // ── 마감버퍼 진입 → 강제정산 ──────────────────────────
        const now = rt.lastTickAt;
        if (!rt.settlementDone && isForceSettlementWindow(now, rt.config.closeBufferMin)) {
            if (rt.settlementRunning) {
                return { sessionId: rt.sessionId, status: rt.status, fills: 0, skipped: true, reason: '강제정산이 이미 진행 중입니다.' };
            }
            const settlement = await enterForceSettlement(db, rt, now);
            return {
                sessionId: rt.sessionId,
                status: rt.status,
                fills: settlement.sellFills,
                skipped: false,
                settlement,
            };
        }

        if (rt.status !== 'RUNNING') {
            return { sessionId: rt.sessionId, status: rt.status, fills: 0, skipped: true, reason: `세션 상태가 ${rt.status} 입니다.` };
        }

        // ── 평시 틱 ──────────────────────────────────────────
        const quote = await rt.broker.getQuote(rt.config.symbol);
        const fills = await rt.strategy.onTick();

        // 가드가 세션을 EMERGENCY_STOP 으로 돌렸는지 확인(일일 최대손실 등)
        if (rt.strategy.isHalted) {
            const after = await db.inverseTraderSession.findUnique({ where: { id: rt.sessionId } });
            rt.status = (after?.status as SessionStatus) ?? 'EMERGENCY_STOP';
            rt.lastError = after?.lastError ?? rt.lastError;
            clearTimer(rt);
            pushLog(rt, '가드 발동으로 매매 정지', { status: rt.status, lastError: rt.lastError });
        }

        return { sessionId: rt.sessionId, status: rt.status, fills, skipped: false, quote };
    } catch (e: any) {
        const message = e?.message ?? String(e);
        rt.lastError = message;
        pushLog(rt, '틱 처리 실패', { error: message });
        try {
            await db.inverseTraderSession.update({ where: { id: rt.sessionId }, data: { lastError: message } });
        } catch {
            /* 상태 기록 실패는 삼킨다 — 원 에러를 그대로 올린다 */
        }
        throw e;
    } finally {
        rt.tickInFlight = false;
    }
}

/**
 * 마감버퍼 진입 처리 — 세션을 FORCE_SETTLEMENT 로 전환하고 정산을 1회 돌린다.
 * 성공하면 STOPPED, 실패하면 EMERGENCY_STOP(+lastError)으로 마감한다.
 */
async function enterForceSettlement(
    db: InverseTraderDb,
    rt: EngineRuntime,
    now: Date
): Promise<SettlementResult> {
    rt.settlementRunning = true;
    try {
        // ① 신규 매수 완전 중단 — 상태 전환 + 이후 전략을 호출하지 않는다
        await db.inverseTraderSession.update({
            where: { id: rt.sessionId },
            data: { status: 'FORCE_SETTLEMENT' },
        });
        rt.status = 'FORCE_SETTLEMENT';
        clearTimer(rt);
        pushLog(rt, '마감버퍼 진입 — 강제정산 시작', {
            kstMinutes: kstMinutesOfDay(now),
            closeBufferMin: rt.config.closeBufferMin,
            marketClose: MARKET_CLOSE_MINUTES,
        });

        const result = await runForceSettlement({
            db,
            broker: rt.broker,
            sessionId: rt.sessionId,
            symbol: rt.config.symbol,
            closeBufferMin: rt.config.closeBufferMin,
            now: () => new Date(),
            logger: (m, meta) => pushLog(rt, m, meta),
        });

        rt.settlement = result;
        rt.settlementDone = true;

        // 성공 → STOPPED / 실패 → EMERGENCY_STOP(신규주문 전면 차단 + 화면 경고)
        const nextStatus: SessionStatus = result.success ? 'STOPPED' : 'EMERGENCY_STOP';
        rt.status = nextStatus;
        rt.lastError = result.success ? null : result.reason ?? '강제정산 실패';
        await db.inverseTraderSession.update({
            where: { id: rt.sessionId },
            data: { status: nextStatus, endedAt: new Date(), lastError: rt.lastError },
        });
        if (activeSessionId === rt.sessionId) activeSessionId = null;
        return result;
    } finally {
        rt.settlementRunning = false;
    }
}

/** 수동 강제정산(어드민에서 '지금 정산' 을 눌렀을 때). 시각 조건과 무관하게 돈다. */
export async function forceSettleNow(
    db: InverseTraderDb,
    sessionId?: string
): Promise<SettlementResult> {
    const rt = await ensureRuntime(db, sessionId);
    if (!rt) throw new SessionNotFoundError('정산할 세션이 없습니다.');
    if (rt.settlementRunning) throw new SessionAlreadyRunningError(rt.sessionId);
    return enterForceSettlement(db, rt, new Date());
}

// ─────────────────────────────────────────────────────────────
// 중지 / 긴급정지
// ─────────────────────────────────────────────────────────────

export interface StopResult {
    sessionId: string;
    status: SessionStatus;
    canceledOrders: number;
    remainingQty: number;
    reason: string;
}

async function shutdown(
    db: InverseTraderDb,
    sessionId: string | undefined,
    nextStatus: 'STOPPED' | 'EMERGENCY_STOP',
    reason: string
): Promise<StopResult> {
    const rt = await ensureRuntime(db, sessionId);
    if (!rt) {
        // 런타임이 없어도 DB 상 살아있는 세션이면 상태만이라도 내린다.
        const session = sessionId
            ? await db.inverseTraderSession.findUnique({ where: { id: sessionId } })
            : await db.inverseTraderSession.findFirst({
                  where: { status: { in: LIVE_SESSION_STATUSES } },
                  orderBy: { startedAt: 'desc' },
              });
        if (!session) throw new SessionNotFoundError('중지할 세션이 없습니다.');
        await db.inverseTraderSession.update({
            where: { id: session.id },
            data: { status: nextStatus, endedAt: new Date(), lastError: reason },
        });
        const canceled = await db.inverseOrder.updateMany({
            where: { sessionId: session.id, status: { in: LIVE_ORDER_STATUSES } },
            data: { status: 'CANCELED', remainingQty: 0 },
        });
        const pos = await loadPosition(db, session.id, (await loadTraderConfig(db)).symbol);
        return { sessionId: session.id, status: nextStatus, canceledOrders: canceled.count, remainingQty: pos.qty, reason };
    }

    clearTimer(rt);
    // 미체결 전부 취소 → 신규주문 중단(상태 전환으로 보장)
    const canceledOrders = await cancelAllLiveOrders(db, rt.broker, rt.sessionId, rt.config.symbol, (m, meta) =>
        pushLog(rt, m, meta)
    );
    await db.inverseTraderSession.update({
        where: { id: rt.sessionId },
        data: { status: nextStatus, endedAt: new Date(), lastError: reason },
    });
    rt.status = nextStatus;
    rt.lastError = reason;
    if (activeSessionId === rt.sessionId) activeSessionId = null;
    pushLog(rt, nextStatus === 'EMERGENCY_STOP' ? '긴급정지' : '세션 중지', { canceledOrders, reason });

    const position = await loadPosition(db, rt.sessionId, rt.config.symbol);
    // 보유수량이 남은 채로 내려가면 그 사실을 오늘 통계에 남긴다(화면 경고용).
    if (position.qty !== 0) {
        try {
            await writeDailyStat(db, {
                sessionId: rt.sessionId,
                now: new Date(),
                forceSettled: false,
                closingQty: position.qty,
                note: `${reason} — 잔여수량 ${position.qty}주`,
            });
        } catch (e: any) {
            pushLog(rt, '중지 시 일일 통계 기록 실패', { error: e?.message ?? String(e) });
        }
    }
    return { sessionId: rt.sessionId, status: nextStatus, canceledOrders, remainingQty: position.qty, reason };
}

/** 세션 중지 — 미체결 취소 후 STOPPED. */
export async function stopSession(
    db: InverseTraderDb,
    sessionId?: string,
    reason = '사용자 요청으로 세션을 중지했습니다.'
): Promise<StopResult> {
    return shutdown(db, sessionId, 'STOPPED', reason);
}

/** 긴급정지 — 즉시 미체결 취소 + 신규주문 중단(EMERGENCY_STOP). */
export async function emergencyStop(
    db: InverseTraderDb,
    sessionId?: string,
    reason = '긴급정지 요청으로 매매를 즉시 중단했습니다.'
): Promise<StopResult> {
    return shutdown(db, sessionId, 'EMERGENCY_STOP', reason);
}

// ─────────────────────────────────────────────────────────────
// 상태 스냅샷 (어드민 화면 원천)
// ─────────────────────────────────────────────────────────────

export interface StatusSnapshot {
    tradingMode: TradingMode;
    config: TraderConfig;
    session: (InverseTraderSessionRow & { isLive: boolean }) | null;
    engine: {
        hasRuntime: boolean;
        tickCount: number;
        lastTickAt: Date | null;
        /** 0 이면 인메모리 인터벌을 쓰지 않고 API tick 으로만 돈다 */
        intervalMs: number;
        settlementRunning: boolean;
        settlementDone: boolean;
        /** 강제정산 구간(마감 - 버퍼분)에 들어와 있는지 */
        inSettlementWindow: boolean;
        kstMinutes: number;
        marketCloseMinutes: number;
        logs: string[];
    };
    quote: Quote | null;
    position: {
        symbol: string;
        qty: number;
        avgPrice: number;
        realizedPnl: number;
        unrealizedPnl: number;
        totalPnl: number;
    };
    orders: InverseOrderRow[];
    fills: InverseFillRow[];
    today: {
        stat: InverseDailyStatRow | null;
        /** ★강제정산 성공 여부. 통계가 없으면 null */
        forceSettled: boolean | null;
        closingQty: number;
        /** ★강제정산 실패 경고 — 화면에서 이 값으로 경고를 띄운다 */
        settlementFailed: boolean;
        warning: string | null;
    };
    /** 마지막 정산 결과(이 프로세스에서 돌았을 때만) */
    lastSettlement: SettlementResult | null;
}

/** 어드민 화면이 쓰는 상태 스냅샷 1회 조회. */
export async function getStatusSnapshot(
    db: InverseTraderDb,
    sessionId?: string,
    options: { now?: () => Date; orderLimit?: number; fillLimit?: number } = {}
): Promise<StatusSnapshot> {
    const now = (options.now ?? (() => new Date()))();
    const config = await loadTraderConfig(db);

    const session =
        (sessionId
            ? await db.inverseTraderSession.findUnique({ where: { id: sessionId } })
            : await db.inverseTraderSession.findFirst({ orderBy: { createdAt: 'desc' } })) ?? null;

    const rt = session ? runtimes.get(session.id) ?? null : null;

    // 호가는 런타임이 있으면 그 피드에서, 없으면 임시 피드에서 가져온다(참고용).
    let quote: Quote | null = null;
    try {
        quote = rt
            ? await rt.broker.getQuote(config.symbol)
            : await new SimulatedQuoteFeed().getQuote(config.symbol);
    } catch {
        quote = null;
    }

    let position = { symbol: config.symbol, qty: 0, avgPrice: 0, realizedPnl: 0, unrealizedPnl: 0, totalPnl: 0 };
    let orders: InverseOrderRow[] = [];
    let fills: InverseFillRow[] = [];

    if (session) {
        const p = await loadPosition(db, session.id, config.symbol);
        const pnl = await loadSessionPnl(db, session.id);
        position = {
            symbol: config.symbol,
            qty: p.qty,
            avgPrice: p.avgPrice,
            realizedPnl: p.realizedPnl,
            unrealizedPnl: quote ? computeUnrealizedPnl(p.qty, p.avgPrice, quote.lastPrice) : pnl.unrealizedPnl,
            totalPnl: 0,
        };
        position.totalPnl = position.realizedPnl + position.unrealizedPnl;

        orders = await db.inverseOrder.findMany({
            where: { sessionId: session.id },
            orderBy: { createdAt: 'desc' },
            take: options.orderLimit ?? 100,
        });
        const orderIds = orders.map((o) => o.id);
        if (orderIds.length > 0) {
            fills = await db.inverseFill.findMany({
                where: { orderId: { in: orderIds } },
                orderBy: { filledAt: 'desc' },
                take: options.fillLimit ?? 100,
            });
        }
    }

    let stat: InverseDailyStatRow | null = null;
    try {
        stat = await db.inverseDailyStat.findUnique({ where: { date: kstDateOnly(now) } });
    } catch {
        stat = null;
    }

    const settlementFailed = !!stat && stat.forceSettled === false && stat.closingQty !== 0;
    const warning = settlementFailed
        ? `★당일 강제정산 실패 — 잔여수량 ${stat!.closingQty}주가 남아 있습니다.` +
          (session?.lastError ? ` (${session.lastError})` : '')
        : null;

    return {
        tradingMode: TRADING_MODE,
        config,
        session: session ? { ...session, isLive: LIVE_SESSION_STATUSES.includes(session.status as SessionStatus) } : null,
        engine: {
            hasRuntime: !!rt,
            tickCount: rt?.tickCount ?? 0,
            lastTickAt: rt?.lastTickAt ?? null,
            intervalMs: getTickIntervalMs(),
            settlementRunning: rt?.settlementRunning ?? false,
            settlementDone: rt?.settlementDone ?? false,
            inSettlementWindow: isForceSettlementWindow(now, config.closeBufferMin),
            kstMinutes: kstMinutesOfDay(now),
            marketCloseMinutes: MARKET_CLOSE_MINUTES,
            logs: rt?.logs.slice(-50) ?? [],
        },
        quote,
        position,
        orders,
        fills,
        today: {
            stat,
            forceSettled: stat ? stat.forceSettled : null,
            closingQty: stat?.closingQty ?? 0,
            settlementFailed,
            warning,
        },
        lastSettlement: rt?.settlement ?? null,
    };
}

/** 테스트/재시작용 — 프로세스 인메모리 상태만 비운다(DB 는 건드리지 않는다). */
export function resetEngineState(): void {
    for (const rt of runtimes.values()) clearTimer(rt);
    runtimes.clear();
    activeSessionId = null;
    startInFlight = false;
}

// ─────────────────────────────────────────────────────────────
// Vercel 방어용 기본 export
// ─────────────────────────────────────────────────────────────
/**
 * ★이 파일은 모듈이지 HTTP 엔드포인트가 아니다.
 *   다만 Vercel 은 api/ 아래 .ts 를 전부 서버리스 함수로 잡기 때문에,
 *   default export 가 없으면 /api/inverse-trader/engine 호출 시 런타임 오류가 난다.
 *   실제 엔드포인트는 api/inverse-trader/[action].ts 하나뿐이므로 여기서는 404 로 막는다.
 */
export default async function notAnEndpoint(_req: any, res: any) {
    return res.status(404).json({ error: 'Not found', hint: '/api/inverse-trader/status 를 사용하세요.' });
}
