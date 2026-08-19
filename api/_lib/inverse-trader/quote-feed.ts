/**
 * 인버스 ETF 1호가 스캘핑 — 시세 소스.
 *
 * ★★ 이 파일의 시세는 전부 '가상 호가 생성기(SIMULATED)'다. ★★
 *    실제 증권사/거래소 시세 API 연동은 하지 않는다. 랜덤워크로 중심가를 움직이고
 *    호가단위(5원)를 적용해 1호가(최우선 매수/매도)를 만들어낸다.
 *    반환되는 Quote.source 에는 항상 '가상 호가 생성기(SIMULATED)' 가 박힌다 —
 *    화면·로그에서 실시세와 절대 혼동되지 않게 하기 위함이다.
 *
 * 나중에 실 시세로 교체할 때는 QuoteFeed 인터페이스(getQuote 시그니처)만 맞추면 되고,
 * 브로커/전략 코드는 손대지 않아도 된다.
 */

import type { Quote } from './broker.js';
import {
    TICK_SIZE,
    DEFAULT_BASE_PRICE,
    QUOTE_SOURCE_SIMULATED,
    createRng,
    roundToTick,
} from './constants.js';

/** 시세 소스 공통 인터페이스. 실 시세 구현으로 교체할 때 이 시그니처를 그대로 쓴다. */
export interface QuoteFeed {
    getQuote(symbol: string): Promise<Quote>;
}

export interface SimulatedQuoteFeedOptions {
    /** 시작 중심가(원). 인버스 ETF 가격대 가정. 기본 5,000원 */
    basePrice?: number;
    /** 호가단위(원). 국내 ETF는 5원 */
    tick?: number;
    /** 난수 시드. 같은 시드 → 같은 호가 흐름(재현 가능) */
    seed?: number;
    /** 한 스텝에서 중심가가 움직일 수 있는 최대 틱 수 */
    maxStepTicks?: number;
    /** 1호가 스프레드(틱). 유동성 좋은 인버스 ETF는 보통 1틱 */
    spreadTicks?: number;
    /** 가격 하한/상한(원). 랜덤워크가 비현실적으로 흘러가지 않게 가둔다 */
    minPrice?: number;
    maxPrice?: number;
    /** 호가 잔량 범위(주) */
    minLevelQty?: number;
    maxLevelQty?: number;
    /**
     * 몇 ms마다 한 스텝 진행할지. 같은 스텝 안에서는 같은 호가를 돌려준다.
     * 0을 주면 시간 기반 진행을 끄고 step() 으로만 호가를 움직인다(테스트·재현용).
     */
    stepIntervalMs?: number;
    /** 현재시각 주입(테스트용) */
    now?: () => number;
}

interface SymbolState {
    /** 최우선 매수호가(원) */
    bidPrice: number;
    lastPrice: number;
    bidQty: number;
    askQty: number;
    /** 마지막으로 스텝을 진행한 시각(ms) */
    lastStepAt: number;
    stepCount: number;
}

/**
 * 가상 호가 생성기(SIMULATED).
 * 랜덤워크 + 호가단위 적용으로 1호가를 만든다.
 */
export class SimulatedQuoteFeed implements QuoteFeed {
    /** 이 피드가 만들어내는 시세의 출처 표기 — 실시세가 아님을 명시 */
    readonly source = QUOTE_SOURCE_SIMULATED;
    /** 가상 시세임을 코드로 판별할 때 쓰는 플래그 */
    readonly simulated = true;

    private readonly tick: number;
    private readonly basePrice: number;
    private readonly maxStepTicks: number;
    private readonly spreadTicks: number;
    private readonly minPrice: number;
    private readonly maxPrice: number;
    private readonly minLevelQty: number;
    private readonly maxLevelQty: number;
    private readonly stepIntervalMs: number;
    private readonly now: () => number;
    private readonly rng: () => number;
    private readonly states = new Map<string, SymbolState>();

    constructor(options: SimulatedQuoteFeedOptions = {}) {
        this.tick = options.tick ?? TICK_SIZE;
        this.basePrice = roundToTick(options.basePrice ?? DEFAULT_BASE_PRICE, this.tick);
        this.maxStepTicks = options.maxStepTicks ?? 1;
        this.spreadTicks = options.spreadTicks ?? 1;
        this.minPrice = roundToTick(options.minPrice ?? Math.max(this.tick, this.basePrice * 0.8), this.tick);
        this.maxPrice = roundToTick(options.maxPrice ?? this.basePrice * 1.2, this.tick);
        this.minLevelQty = options.minLevelQty ?? 20_000;
        this.maxLevelQty = options.maxLevelQty ?? 800_000;
        // 0 이하면 시간 기반 진행을 끄고 step() 호출로만 움직인다(결정적 재현 모드).
        this.stepIntervalMs = Math.max(0, options.stepIntervalMs ?? 1000);
        this.now = options.now ?? (() => Date.now());
        this.rng = createRng(options.seed ?? 20260819);
    }

    /** 현재 1호가 스냅샷. 경과 시간만큼 랜덤워크를 진행시킨 뒤 반환한다. */
    async getQuote(symbol: string): Promise<Quote> {
        const nowMs = this.now();
        const state = this.advance(symbol, nowMs);
        const bidPrice = state.bidPrice;
        const askPrice = bidPrice + this.spreadTicks * this.tick;
        return {
            symbol,
            bidPrice,
            bidQty: state.bidQty,
            askPrice,
            askQty: state.askQty,
            lastPrice: state.lastPrice,
            ts: new Date(nowMs),
            source: this.source,
        };
    }

    /**
     * 랜덤워크를 n스텝 강제로 진행시킨다(테스트/시뮬레이션 구동용).
     * 시간 경과를 기다리지 않고 호가를 움직이고 싶을 때 쓴다.
     */
    step(symbol: string, steps = 1): void {
        const state = this.ensureState(symbol, this.now());
        for (let i = 0; i < steps; i++) this.applyStep(state);
    }

    /** 특정 종목 상태 초기화(없으면 전체 초기화). */
    reset(symbol?: string): void {
        if (symbol) this.states.delete(symbol);
        else this.states.clear();
    }

    // ── 내부 구현 ──────────────────────────────────────────────

    private ensureState(symbol: string, nowMs: number): SymbolState {
        let state = this.states.get(symbol);
        if (!state) {
            state = {
                bidPrice: this.basePrice,
                lastPrice: this.basePrice,
                bidQty: this.randomLevelQty(),
                askQty: this.randomLevelQty(),
                lastStepAt: nowMs,
                stepCount: 0,
            };
            this.states.set(symbol, state);
        }
        return state;
    }

    /** 경과 시간만큼 스텝을 몰아서 진행. 같은 스텝 구간 안에서는 호가가 고정된다. */
    private advance(symbol: string, nowMs: number): SymbolState {
        const state = this.ensureState(symbol, nowMs);
        // stepIntervalMs=0 은 '시간으로는 진행하지 않음' — step() 으로만 움직인다.
        if (this.stepIntervalMs <= 0) return state;
        const elapsed = nowMs - state.lastStepAt;
        if (elapsed < this.stepIntervalMs) return state;
        // 오래 쉬었다가 재개해도 폭주하지 않게 따라잡기 스텝 수를 제한한다.
        const steps = Math.min(Math.floor(elapsed / this.stepIntervalMs), 60);
        for (let i = 0; i < steps; i++) this.applyStep(state);
        state.lastStepAt = nowMs;
        return state;
    }

    /** 한 스텝: 중심가 랜덤워크 + 호가단위 적용 + 잔량 갱신. */
    private applyStep(state: SymbolState): void {
        // -maxStepTicks ~ +maxStepTicks 사이 정수 틱 이동. 0(제자리)도 나온다.
        const span = this.maxStepTicks * 2 + 1;
        const deltaTicks = Math.floor(this.rng() * span) - this.maxStepTicks;
        let next = state.bidPrice + deltaTicks * this.tick;

        // 가격대 밖으로 나가면 반대 방향으로 튕겨 되돌린다.
        if (next < this.minPrice) next = this.minPrice + this.tick;
        if (next > this.maxPrice - this.spreadTicks * this.tick) {
            next = this.maxPrice - (this.spreadTicks + 1) * this.tick;
        }

        state.bidPrice = roundToTick(next, this.tick);
        // 최근 체결가는 매수/매도 어느 쪽이 먹었는지에 따라 1호가 양쪽을 오간다.
        state.lastPrice =
            this.rng() < 0.5 ? state.bidPrice : state.bidPrice + this.spreadTicks * this.tick;
        state.bidQty = this.randomLevelQty();
        state.askQty = this.randomLevelQty();
        state.stepCount += 1;
    }

    /** 1호가 잔량(주). 기본 주문수량(100만주)보다 작은 경우가 흔해 부분체결이 발생한다. */
    private randomLevelQty(): number {
        const span = this.maxLevelQty - this.minLevelQty;
        return this.minLevelQty + Math.floor(this.rng() * span);
    }
}

let defaultFeed: SimulatedQuoteFeed | null = null;

/** 프로세스 공용 가상 호가 생성기. 전략 엔진/브로커가 같은 호가를 보게 한다. */
export function getDefaultQuoteFeed(): SimulatedQuoteFeed {
    if (!defaultFeed) defaultFeed = new SimulatedQuoteFeed();
    return defaultFeed;
}

/** 테스트에서 공용 피드를 갈아끼울 때 사용. */
export function setDefaultQuoteFeed(feed: SimulatedQuoteFeed | null): void {
    defaultFeed = feed;
}
