/**
 * 인버스 ETF 1호가 스캘핑 — 전략 엔진.
 *
 * 전략 규칙
 *  1) 세션 시작: 현재 최우선 매수호가에서 **-1호가** 지정가 매수 주문
 *  2) 매수 체결: (체결가 +1호가) 매도 + (체결가 -1호가) 추가 매수 — 2건
 *  3) 매도 체결: (체결가 -1호가) 매수 + (체결가 +1호가) 매도 — 2건
 *  4) 부분체결: 후속 주문 수량은 **실제 체결된 수량** 기준. 잔량이 남은 원주문은
 *     취소하지 않고 살아있는 상태(PARTIAL)로 유지한다.
 *  5) 중복 차단: 같은 (세션, 종목, side, 지정가) 조합의 살아있는 주문(PENDING/PARTIAL)이
 *     있으면 새 주문을 만들지 않는다. 판정은 **DB 조회 기준**(hasLiveOrderAt).
 *
 * ★★ 증권사 주문 API / 외부 브로커 HTTP 호출은 이 파일에 없다. ★★
 *    주문은 오직 Broker 인터페이스(구현체는 simulation-broker.ts 하나) 로만 나간다.
 */

import type { Broker, FillRecord, Quote } from './broker.js';
import { TICK_SIZE, type OrderSide } from './constants.js';
import { LIVE_ORDER_STATUSES, type InverseOrderRow, type InverseTraderDb } from './db.js';
import {
    assertSessionTradable,
    assertSimulationBroker,
    assertSimulationTrading,
    enforceDailyLossLimit,
    evaluateBuyGuard,
    evaluateSellGuard,
    type OrderIntent,
} from './guards.js';
import {
    applyFill,
    loadOpenOrderQty,
    loadPosition,
    markToMarket,
    recordOrder,
} from './position-manager.js';

export type { OrderIntent } from './guards.js';

// ─────────────────────────────────────────────────────────────
// 호가단위(tick) 계산 — 별도 함수로 분리(테스트 가능)
// ─────────────────────────────────────────────────────────────

/** 호가단위 구간. `under` 미만 가격에 `tick` 을 적용한다. under=null 이면 그 이상 전부. */
export interface TickBand {
    under: number | null;
    tick: number;
}

/**
 * 국내 **ETF/ETN** 호가가격단위 표.
 * KRX 규정상 ETF·ETN 은 가격대와 무관하게 5원 단일이다(2023년 호가단위 개편 이후에도 동일).
 * 그래서 구간이 하나뿐이지만, 규정이 바뀌거나 다른 상품군에 재사용할 때를 위해
 * '구간 표 + 조회 함수' 형태를 유지한다.
 */
export const ETF_TICK_BANDS: TickBand[] = [{ under: null, tick: TICK_SIZE }];

/**
 * 참고용 — 일반 주식(코스피/코스닥) 호가가격단위 표(2023-01-25 개편 기준).
 * 이 전략은 ETF 전용이라 기본값으로 쓰지 않는다. getTickSize 의 두 번째 인자로
 * 명시해서 넘길 때만 적용된다.
 */
export const KRX_STOCK_TICK_BANDS: TickBand[] = [
    { under: 2_000, tick: 1 },
    { under: 5_000, tick: 5 },
    { under: 20_000, tick: 10 },
    { under: 50_000, tick: 50 },
    { under: 200_000, tick: 100 },
    { under: 500_000, tick: 500 },
    { under: null, tick: 1_000 },
];

/** 가격대별 호가단위(원)를 구한다. */
export function getTickSize(price: number, bands: TickBand[] = ETF_TICK_BANDS): number {
    const p = Math.max(0, price);
    for (const band of bands) {
        if (band.under === null || p < band.under) return band.tick;
    }
    return bands[bands.length - 1]?.tick ?? TICK_SIZE;
}

/** 가격을 해당 가격대의 호가단위 격자에 맞춘다(내림). */
export function alignToTick(price: number, bands: TickBand[] = ETF_TICK_BANDS): number {
    const tick = getTickSize(price, bands);
    return Math.floor(price / tick) * tick;
}

/** 지정 가격에서 위로 n호가. 구간 경계를 넘어가면 그 구간의 호가단위로 다시 정렬한다. */
export function tickUp(price: number, steps = 1, bands: TickBand[] = ETF_TICK_BANDS): number {
    let p = alignToTick(price, bands);
    for (let i = 0; i < steps; i++) {
        p = alignToTick(p + getTickSize(p, bands), bands);
    }
    return p;
}

/** 지정 가격에서 아래로 n호가. 0 이하로는 내려가지 않는다. */
export function tickDown(price: number, steps = 1, bands: TickBand[] = ETF_TICK_BANDS): number {
    let p = alignToTick(price, bands);
    for (let i = 0; i < steps; i++) {
        const next = p - getTickSize(p, bands);
        const tick = getTickSize(next, bands);
        p = Math.max(tick, alignToTick(next, bands));
    }
    return p;
}

// ─────────────────────────────────────────────────────────────
// 중복 주문 차단 — DB 조회 기준, 별도 함수로 분리(테스트 가능)
// ─────────────────────────────────────────────────────────────

export interface LiveOrderKey {
    sessionId: string;
    symbol: string;
    side: OrderSide;
    limitPrice: number;
}

/**
 * 같은 (세션, 종목, side, 지정가) 조합의 살아있는 주문(PENDING/PARTIAL)이 DB에 있는지 검사한다.
 * ★ 브로커 메모리가 아니라 **DB** 를 기준으로 판정한다 — 재시작/다중 워커에서도
 *   같은 호가에 주문이 겹치지 않게 하기 위함이다.
 */
export async function hasLiveOrderAt(db: InverseTraderDb, key: LiveOrderKey): Promise<boolean> {
    const existing = await db.inverseOrder.findFirst({
        where: {
            sessionId: key.sessionId,
            symbol: key.symbol,
            side: key.side,
            limitPrice: key.limitPrice,
            status: { in: LIVE_ORDER_STATUSES },
        },
    });
    return existing !== null && existing !== undefined;
}

// ─────────────────────────────────────────────────────────────
// 주문 계획 — 순수 함수(DB/브로커 없이 테스트 가능)
// ─────────────────────────────────────────────────────────────

export interface PlanContext {
    sessionId: string;
    symbol: string;
    bands?: TickBand[];
}

/** 세션 시작 주문: 현재 최우선 매수호가에서 -1호가 매수. */
export function planSessionStartOrder(
    ctx: PlanContext,
    bidPrice: number,
    qty: number
): OrderIntent {
    const bands = ctx.bands ?? ETF_TICK_BANDS;
    return {
        sessionId: ctx.sessionId,
        symbol: ctx.symbol,
        side: 'BUY',
        limitPrice: tickDown(bidPrice, 1, bands),
        qty,
        parentOrderId: null,
        reason: 'SESSION_START_BUY_MINUS_1',
    };
}

export interface FollowUpInput {
    side: OrderSide;
    /** 체결가(원) */
    fillPrice: number;
    /** ★실제 체결된 수량(주). 부분체결이면 그 부분만 */
    fillQty: number;
    /** 이 체결이 발생한 주문의 InverseOrder.id */
    parentOrderId?: number | null;
}

/**
 * 체결 1건에 대한 후속 주문 2건을 만든다.
 *  - 매수 체결 → [ (체결가 +1호가) 매도, (체결가 -1호가) 매수 ]
 *  - 매도 체결 → [ (체결가 -1호가) 매수, (체결가 +1호가) 매도 ]
 * 수량은 항상 **실제 체결된 수량**(fillQty)을 쓴다(부분체결 지원).
 */
export function planFollowUpOrders(ctx: PlanContext, input: FollowUpInput): OrderIntent[] {
    const bands = ctx.bands ?? ETF_TICK_BANDS;
    const qty = input.fillQty;
    if (!(qty > 0)) return [];

    const base = {
        sessionId: ctx.sessionId,
        symbol: ctx.symbol,
        qty,
        parentOrderId: input.parentOrderId ?? null,
    };
    const sellIntent: OrderIntent = {
        ...base,
        side: 'SELL',
        limitPrice: tickUp(input.fillPrice, 1, bands),
        reason: input.side === 'BUY' ? 'AFTER_BUY_SELL_PLUS_1' : 'AFTER_SELL_SELL_PLUS_1',
    };
    const buyIntent: OrderIntent = {
        ...base,
        side: 'BUY',
        limitPrice: tickDown(input.fillPrice, 1, bands),
        reason: input.side === 'BUY' ? 'AFTER_BUY_BUY_MINUS_1' : 'AFTER_SELL_BUY_MINUS_1',
    };

    // 매수 체결이면 이익 실현(매도)을 먼저, 매도 체결이면 재진입(매수)을 먼저 건다.
    return input.side === 'BUY' ? [sellIntent, buyIntent] : [buyIntent, sellIntent];
}

// ─────────────────────────────────────────────────────────────
// 전략 엔진
// ─────────────────────────────────────────────────────────────

/** 대기 주문 매칭까지 지원하는 브로커(시뮬레이션 브로커). */
export type ScalpingBroker = Broker & {
    matchOpenOrders?(symbol: string): Promise<FillRecord[]>;
};

export interface StrategyConfig {
    sessionId: string;
    symbol: string;
    /** 기본 주문수량(주). InverseTraderConfig.defaultQty (기본 100만주) */
    defaultQty: number;
    /** 최대 보유수량(주) */
    maxPositionQty: number;
    /** 일일 최대 손실액(원, 양수) */
    dailyLossLimit: number;
    /** DB 설정의 tradingMode. SIMULATION 이 아니면 즉시 에러 */
    tradingMode?: string;
    /** 호가단위 표. 기본 ETF(5원 단일) */
    bands?: TickBand[];
    /**
     * 한 번의 체결 처리에서 파생 주문을 몇 단계까지 이어갈지.
     * 즉시체결이 연쇄되면 무한 재귀가 되므로 상한을 둔다. 기본 4단계.
     */
    maxChainDepth?: number;
    /** 공매도 허용 여부. 기본 false(국내 ETF 개인 공매도 불가) */
    allowShort?: boolean;
    /** 평가손익을 일일손실 판정에 포함할지. 기본 true */
    includeUnrealizedInLossGuard?: boolean;
    /** 로그 훅(선택). 미지정이면 조용히 동작한다. */
    logger?: (message: string, meta?: Record<string, any>) => void;
}

/** 주문 제출 결과 — 차단된 경우 order=null 과 사유가 담긴다. */
export interface SubmitResult {
    intent: OrderIntent;
    order: InverseOrderRow | null;
    /** 접수 즉시 발생한 체결 건수 */
    immediateFills: number;
    skipped: boolean;
    reason?: string;
}

export class InverseScalpingStrategy {
    private readonly db: InverseTraderDb;
    private readonly broker: ScalpingBroker;
    private readonly config: Required<Pick<StrategyConfig, 'sessionId' | 'symbol' | 'defaultQty' | 'maxPositionQty' | 'dailyLossLimit'>> & StrategyConfig;
    private readonly bands: TickBand[];
    /** 브로커 주문번호 → InverseOrder.id 매핑(체결을 DB 주문에 연결) */
    private readonly orderIdMap = new Map<string, number>();
    /** 일일손실 한도 초과로 정지된 상태 */
    private halted = false;

    constructor(db: InverseTraderDb, broker: ScalpingBroker, config: StrategyConfig) {
        // ★ 가장 먼저 모드 가드 — SIMULATION 이 아니면 여기서 끝난다.
        assertSimulationTrading(config.tradingMode);
        assertSimulationBroker(broker);
        this.db = db;
        this.broker = broker;
        this.config = config as any;
        this.bands = config.bands ?? ETF_TICK_BANDS;
    }

    /** 정지 상태(일일손실 한도 초과) 여부. */
    get isHalted(): boolean {
        return this.halted;
    }

    private log(message: string, meta?: Record<string, any>): void {
        this.config.logger?.(message, meta);
    }

    private get planCtx(): PlanContext {
        return { sessionId: this.config.sessionId, symbol: this.config.symbol, bands: this.bands };
    }

    /**
     * 세션 시작 — 현재 매수호가 -1호가에 매수 주문 1건.
     * @returns 접수 결과(차단됐으면 skipped=true)
     */
    async start(): Promise<SubmitResult> {
        assertSimulationTrading(this.config.tradingMode);
        await assertSessionTradable(this.db, this.config.sessionId);

        const quote = await this.broker.getQuote(this.config.symbol);
        const intent = planSessionStartOrder(this.planCtx, quote.bidPrice, this.config.defaultQty);
        this.log('세션 시작 주문', { intent, bidPrice: quote.bidPrice, source: quote.source });
        return this.submitOrder(intent, 0);
    }

    /**
     * 시세 틱 처리 — 대기 주문 매칭 후 체결분에 대해 후속 주문을 만든다.
     * @returns 이번 틱에서 처리한 체결 건수
     */
    async onTick(): Promise<number> {
        if (this.halted) return 0;
        assertSimulationTrading(this.config.tradingMode);

        const quote = await this.broker.getQuote(this.config.symbol);
        await markToMarket(this.db, this.config.sessionId, this.config.symbol, quote.lastPrice);

        if (typeof this.broker.matchOpenOrders !== 'function') return 0;
        const fills = await this.broker.matchOpenOrders(this.config.symbol);
        let handled = 0;
        for (const fill of fills) {
            await this.processFill(fill, 0);
            handled += 1;
        }
        return handled;
    }

    /** 현재 1호가 조회(가상 호가 생성기). */
    async getQuote(): Promise<Quote> {
        return this.broker.getQuote(this.config.symbol);
    }

    /**
     * 체결 1건 처리: DB 반영(주문상태·체결·포지션) → 손실가드 → 후속 주문 2건.
     * @param depth 즉시체결 연쇄 깊이(무한 재귀 방지)
     */
    async processFill(fill: FillRecord, depth = 0): Promise<void> {
        const dbOrderId = await this.resolveDbOrderId(fill.orderId);
        if (dbOrderId === null) {
            this.log('DB 주문을 찾지 못해 체결을 건너뜁니다', { brokerOrderId: fill.orderId });
            return;
        }

        const applied = await applyFill(this.db, {
            sessionId: this.config.sessionId,
            orderId: dbOrderId,
            fillPrice: fill.fillPrice,
            fillQty: fill.fillQty,
            filledAt: fill.filledAt,
        });
        this.log('체결 반영', {
            orderId: dbOrderId,
            side: fill.side,
            fillPrice: fill.fillPrice,
            fillQty: fill.fillQty,
            remainingQty: applied.remainingQty, // >0 이면 원주문은 살아있다
            realizedPnlDelta: applied.realizedPnlDelta,
        });

        // 일일 최대손실 초과면 세션을 EMERGENCY_STOP 으로 돌리고 신규 주문을 전면 중단한다.
        const loss = await enforceDailyLossLimit(this.db, {
            sessionId: this.config.sessionId,
            dailyLossLimit: this.config.dailyLossLimit,
            includeUnrealized: this.config.includeUnrealizedInLossGuard ?? true,
        });
        if (loss.breached) {
            this.halted = true;
            this.log('일일 최대손실 초과 — 매매 정지(EMERGENCY_STOP)', { reason: loss.reason });
            return;
        }

        const maxDepth = this.config.maxChainDepth ?? 4;
        if (depth >= maxDepth) {
            this.log('연쇄 주문 깊이 상한 도달 — 후속 주문을 만들지 않습니다', { depth });
            return;
        }

        // ★ 후속 주문 수량은 '실제 체결된 수량' 기준. 원주문 잔량은 그대로 살려둔다.
        const intents = planFollowUpOrders(this.planCtx, {
            side: fill.side,
            fillPrice: fill.fillPrice,
            fillQty: fill.fillQty,
            parentOrderId: dbOrderId,
        });
        for (const intent of intents) {
            await this.submitOrder(intent, depth + 1);
        }
    }

    /**
     * 주문 의도 1건을 가드 → 중복검사 → 브로커 접수 → DB 기록 순으로 처리한다.
     * 접수 즉시 체결이 나오면 그 체결도 이어서 처리한다(깊이 상한 적용).
     */
    async submitOrder(intent: OrderIntent, depth = 0): Promise<SubmitResult> {
        // 0) 모드 가드 — 매 주문마다 확인한다.
        assertSimulationTrading(this.config.tradingMode);

        if (this.halted) {
            return { intent, order: null, immediateFills: 0, skipped: true, reason: '일일 최대손실 초과로 매매가 정지된 상태입니다.' };
        }

        // 1) 일일손실 가드 — 신규 주문 전면 차단 여부
        const loss = await enforceDailyLossLimit(this.db, {
            sessionId: this.config.sessionId,
            dailyLossLimit: this.config.dailyLossLimit,
            includeUnrealized: this.config.includeUnrealizedInLossGuard ?? true,
        });
        if (loss.breached) {
            this.halted = true;
            return { intent, order: null, immediateFills: 0, skipped: true, reason: loss.reason };
        }

        // 2) 중복 차단 — DB 조회 기준
        const duplicated = await hasLiveOrderAt(this.db, {
            sessionId: intent.sessionId,
            symbol: intent.symbol,
            side: intent.side,
            limitPrice: intent.limitPrice,
        });
        if (duplicated) {
            const reason = `같은 호가에 살아있는 주문이 있어 건너뜁니다: ${intent.side} ${intent.limitPrice}원`;
            this.log('중복 주문 차단', { intent, reason });
            return { intent, order: null, immediateFills: 0, skipped: true, reason };
        }

        // 3) 수량 가드 (최대보유수량 / 매도가능수량)
        const position = await loadPosition(this.db, this.config.sessionId, intent.symbol);
        const open = await loadOpenOrderQty(this.db, this.config.sessionId, intent.symbol);
        const decision =
            intent.side === 'BUY'
                ? evaluateBuyGuard({
                      currentQty: position.qty,
                      pendingBuyQty: open.buyQty,
                      requestedQty: intent.qty,
                      maxPositionQty: this.config.maxPositionQty,
                  })
                : evaluateSellGuard({
                      currentQty: position.qty,
                      pendingSellQty: open.sellQty,
                      requestedQty: intent.qty,
                      allowShort: this.config.allowShort ?? false,
                  });
        if (!decision.allowed || decision.allowedQty <= 0) {
            this.log('수량 가드로 주문 차단', { intent, reason: decision.reason });
            return { intent, order: null, immediateFills: 0, skipped: true, reason: decision.reason };
        }
        const qty = decision.allowedQty;
        if (qty !== intent.qty) this.log('주문수량 축소', { intent, qty, reason: decision.reason });

        // 4) 브로커 접수 — ★simulation-broker 를 통해서만 나간다(외부 HTTP 없음)
        const placed = await this.broker.placeOrder({
            symbol: intent.symbol,
            side: intent.side,
            price: intent.limitPrice,
            qty,
            parentOrderId: intent.parentOrderId ?? null,
            clientTag: intent.reason,
        });

        // 5) DB 기록 (세션ID 기준)
        const order = await recordOrder(this.db, {
            sessionId: intent.sessionId,
            symbol: intent.symbol,
            side: intent.side,
            limitPrice: intent.limitPrice,
            orderQty: qty,
            parentOrderId: intent.parentOrderId ?? null,
            brokerOrderId: placed.order.orderId,
        });
        this.orderIdMap.set(placed.order.orderId, order.id);

        // 6) 접수 즉시 체결분 처리
        for (const fill of placed.fills) {
            await this.processFill(fill, depth + 1);
        }

        return {
            intent: { ...intent, qty },
            order,
            immediateFills: placed.fills.length,
            skipped: false,
        };
    }

    /** 브로커 주문번호를 InverseOrder.id 로 변환한다(메모리 맵 → DB 조회 순). */
    private async resolveDbOrderId(brokerOrderId: string): Promise<number | null> {
        const cached = this.orderIdMap.get(brokerOrderId);
        if (cached !== undefined) return cached;
        const row = await this.db.inverseOrder.findFirst({
            where: { sessionId: this.config.sessionId, brokerOrderId },
        });
        if (!row) return null;
        this.orderIdMap.set(brokerOrderId, row.id);
        return row.id;
    }
}

/** 전략 엔진 생성 헬퍼. */
export function createStrategy(
    db: InverseTraderDb,
    broker: ScalpingBroker,
    config: StrategyConfig
): InverseScalpingStrategy {
    return new InverseScalpingStrategy(db, broker, config);
}
