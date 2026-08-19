/**
 * 인버스 ETF 1호가 스캘핑 — 시뮬레이션 브로커(가상매매 전용).
 *
 * ★ 증권사 주문 API를 호출하지 않는다. 모든 주문·체결은 이 프로세스 메모리 안에서만
 *   일어나며, 시세는 quote-feed.ts 의 '가상 호가 생성기(SIMULATED)'를 사용한다.
 *
 * 체결 규칙
 *  1) 즉시체결(마케터블): 매수 지정가 >= 최우선 매도호가 → 매도호가로 체결.
 *                          매도 지정가 <= 최우선 매수호가 → 매수호가로 체결.
 *     체결수량은 해당 호가 잔량까지만 — 잔량이 모자라면 부분체결로 남는다.
 *  2) 대기 후 체결(패시브, 1호가 스캘핑의 기본): 지정가가 1호가에 걸려 있으면
 *     matchOpenOrders() 호출 시 큐 체결 확률에 따라 일부/전량 체결된다.
 *  3) 시장이 반대로 밀려와 주문이 마케터블해지면(예: 매수 대기 중 매도호가가 내 가격
 *     이하로 하락) 즉시 체결된다.
 *
 * 부분체결 시 잔량은 남고 상태는 PARTIAL 로 유지된다. 체결 결과는 InverseFill 과
 * 같은 형태(FillRecord)로 반환한다.
 */

import type {
    Broker,
    BrokerOrder,
    CancelOrderResult,
    FillRecord,
    PlaceOrderParams,
    PlaceOrderResult,
    Quote,
} from './broker.js';
import {
    TICK_SIZE,
    TRADING_MODE,
    type TradingMode,
    createRng,
    resolveTradingMode,
} from './constants.js';
import { getDefaultQuoteFeed, type QuoteFeed } from './quote-feed.js';

export interface SimulationBrokerOptions {
    /** 시세 소스. 기본은 프로세스 공용 가상 호가 생성기 */
    feed?: QuoteFeed;
    /** 난수 시드(체결 확률/부분체결 비율 재현용) */
    seed?: number;
    /** 1호가에 걸린 대기 주문이 한 번의 매칭에서 체결될 확률 (0~1) */
    queueFillProb?: number;
    /** 호가단위(원) */
    tick?: number;
}

/** 주문 검증 실패(잘못된 수량/호가단위 등). */
export class InvalidOrderError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidOrderError';
    }
}

interface InternalOrder extends BrokerOrder {}

export class SimulationBroker implements Broker {
    readonly mode: TradingMode;

    private readonly feed: QuoteFeed;
    private readonly rng: () => number;
    private readonly queueFillProb: number;
    private readonly tick: number;
    private readonly orders = new Map<string, InternalOrder>();
    private seq = 0;

    constructor(options: SimulationBrokerOptions = {}) {
        // 부팅 시점에 실거래 모드 진입을 차단한다(환경변수로 LIVE가 들어오면 예외).
        this.mode = resolveTradingMode();
        this.feed = options.feed ?? getDefaultQuoteFeed();
        this.rng = createRng(options.seed ?? 424242);
        this.queueFillProb = options.queueFillProb ?? 0.35;
        this.tick = options.tick ?? TICK_SIZE;
    }

    /** 현재 1호가 조회(가상 호가 생성기). */
    async getQuote(symbol: string): Promise<Quote> {
        return this.feed.getQuote(symbol);
    }

    /**
     * 지정가 주문 접수.
     * 호가와 비교해 즉시 체결 가능하면 체결까지 처리하고, 아니면 대기 주문으로 남긴다.
     */
    async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
        const { symbol, side, price, qty } = params;
        if (!symbol) throw new InvalidOrderError('종목코드가 없습니다.');
        if (!Number.isInteger(qty) || qty <= 0) {
            throw new InvalidOrderError(`주문수량이 올바르지 않습니다: ${qty}`);
        }
        if (!Number.isInteger(price) || price <= 0) {
            throw new InvalidOrderError(`지정가가 올바르지 않습니다: ${price}`);
        }
        if (price % this.tick !== 0) {
            throw new InvalidOrderError(
                `지정가가 호가단위(${this.tick}원)에 맞지 않습니다: ${price}`
            );
        }

        const now = new Date();
        const order: InternalOrder = {
            orderId: this.nextOrderId(),
            symbol,
            side,
            price,
            qty,
            filledQty: 0,
            remainingQty: qty,
            status: 'PENDING',
            parentOrderId: params.parentOrderId ?? null,
            clientTag: params.clientTag,
            createdAt: now,
            updatedAt: now,
        };
        this.orders.set(order.orderId, order);

        // 접수 즉시 마케터블이면 그 자리에서 체결시킨다(대기 큐 체결은 여기서 하지 않는다).
        const quote = await this.feed.getQuote(symbol);
        const fills = this.tryMarketableFill(order, quote);

        return { order: this.snapshot(order), fills };
    }

    /**
     * 대기 주문 매칭. 전략 엔진이 시세 틱마다 호출한다.
     * 마케터블해진 주문은 즉시 체결, 1호가에 걸린 주문은 확률적으로 큐 체결된다.
     * @returns 이번 매칭에서 발생한 체결 목록
     */
    async matchOpenOrders(symbol: string): Promise<FillRecord[]> {
        const quote = await this.feed.getQuote(symbol);
        const fills: FillRecord[] = [];

        for (const order of this.orders.values()) {
            if (order.symbol !== symbol) continue;
            if (order.status !== 'PENDING' && order.status !== 'PARTIAL') continue;

            // 1) 시장이 내 가격까지 와서 마케터블해진 경우
            fills.push(...this.tryMarketableFill(order, quote));
            if (order.remainingQty <= 0) continue;

            // 2) 1호가에 걸려 있는 대기 주문 — 큐 체결(부분체결 가능)
            const atTouch =
                (order.side === 'BUY' && order.price === quote.bidPrice) ||
                (order.side === 'SELL' && order.price === quote.askPrice);
            if (!atTouch) continue;
            if (this.rng() >= this.queueFillProb) continue;

            const levelQty = order.side === 'BUY' ? quote.bidQty : quote.askQty;
            // 큐 앞에 선 물량 때문에 호가 잔량의 일부만 내 몫이 된다 → 부분체결이 흔하다.
            const myShare = Math.max(1, Math.floor(levelQty * (0.1 + this.rng() * 0.9)));
            const fillQty = Math.min(order.remainingQty, myShare);
            fills.push(this.applyFill(order, order.price, fillQty, quote.ts));
        }

        return fills;
    }

    /** 미체결 주문 취소. 이미 전량체결/취소면 canceled=false. */
    async cancelOrder(orderId: string): Promise<CancelOrderResult> {
        const order = this.orders.get(orderId);
        if (!order) throw new InvalidOrderError(`주문을 찾을 수 없습니다: ${orderId}`);
        if (order.status === 'FILLED' || order.status === 'CANCELED') {
            return { order: this.snapshot(order), canceled: false };
        }
        order.status = 'CANCELED';
        order.updatedAt = new Date();
        return { order: this.snapshot(order), canceled: true };
    }

    /** 미체결(PENDING/PARTIAL) 주문 목록. */
    async getOpenOrders(symbol?: string): Promise<BrokerOrder[]> {
        const result: BrokerOrder[] = [];
        for (const order of this.orders.values()) {
            if (symbol && order.symbol !== symbol) continue;
            if (order.status === 'PENDING' || order.status === 'PARTIAL') {
                result.push(this.snapshot(order));
            }
        }
        return result;
    }

    /** 주문 단건 조회. */
    async getOrder(orderId: string): Promise<BrokerOrder | null> {
        const order = this.orders.get(orderId);
        return order ? this.snapshot(order) : null;
    }

    /** 전 주문 초기화(세션 재시작/테스트용). */
    reset(): void {
        this.orders.clear();
        this.seq = 0;
    }

    // ── 내부 구현 ──────────────────────────────────────────────

    /** 지정가가 반대편 1호가를 먹을 수 있으면 그 잔량만큼 체결시킨다. */
    private tryMarketableFill(order: InternalOrder, quote: Quote): FillRecord[] {
        if (order.remainingQty <= 0) return [];
        if (order.status !== 'PENDING' && order.status !== 'PARTIAL') return [];

        let fillPrice: number;
        let levelQty: number;
        if (order.side === 'BUY') {
            if (order.price < quote.askPrice) return [];
            fillPrice = quote.askPrice; // 지정가보다 유리하게 체결(가격 개선)
            levelQty = quote.askQty;
        } else {
            if (order.price > quote.bidPrice) return [];
            fillPrice = quote.bidPrice;
            levelQty = quote.bidQty;
        }

        // 호가 잔량이 주문수량보다 적으면 그만큼만 체결 → 나머지는 잔량으로 남는다.
        const fillQty = Math.min(order.remainingQty, levelQty);
        if (fillQty <= 0) return [];
        return [this.applyFill(order, fillPrice, fillQty, quote.ts)];
    }

    /** 체결 반영 + InverseFill 형태의 체결 객체 생성. */
    private applyFill(
        order: InternalOrder,
        fillPrice: number,
        fillQty: number,
        ts: Date
    ): FillRecord {
        order.filledQty += fillQty;
        order.remainingQty = order.qty - order.filledQty;
        order.status = order.remainingQty > 0 ? 'PARTIAL' : 'FILLED';
        order.updatedAt = ts;

        return {
            orderId: order.orderId,
            symbol: order.symbol,
            side: order.side,
            fillPrice,
            fillQty,
            filledAt: ts,
        };
    }

    /** 외부로 넘길 때는 복사본을 준다(내부 상태 외부 변조 방지). */
    private snapshot(order: InternalOrder): BrokerOrder {
        return { ...order };
    }

    private nextOrderId(): string {
        this.seq += 1;
        return `SIM-${TRADING_MODE}-${Date.now().toString(36)}-${this.seq}`;
    }
}

/**
 * 시뮬레이션 브로커 생성 헬퍼.
 * ★ 이 시스템에 존재하는 유일한 Broker 구현체다 — 실거래 구현체는 만들지 않는다.
 */
export function createSimulationBroker(options: SimulationBrokerOptions = {}): SimulationBroker {
    return new SimulationBroker(options);
}
