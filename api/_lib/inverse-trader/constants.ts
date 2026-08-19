/**
 * 인버스 ETF 1호가 스캘핑 자동매매 — 공통 상수 및 모드 가드.
 *
 * ★ 이 프로젝트는 가상매매(SIMULATION) 전용이다.
 *   증권사 실주문 API는 호출하지 않으며, 'LIVE' 모드는 상수·환경변수 어느 경로로도
 *   허용되지 않는다. resolveTradingMode()/assertSimulationMode()가 예외를 던져 거부한다.
 */

/** 유일하게 허용되는 매매 모드. */
export const TRADING_MODE = 'SIMULATION' as const;

/** 매매 모드 타입. 'LIVE'는 타입 수준에서도 존재하지 않는다. */
export type TradingMode = typeof TRADING_MODE;

/** 국내 ETF 호가단위(원). 전 가격대 동일하게 5원. */
export const TICK_SIZE = 5;

/** 인버스 ETF 기본 가격대 가정(원). 가상 호가 생성기의 시작 중심가. */
export const DEFAULT_BASE_PRICE = 5000;

/** 시세 소스 표기 — 실 시세가 아님을 화면·로그에서 즉시 구분하기 위한 라벨. */
export const QUOTE_SOURCE_SIMULATED = '가상 호가 생성기(SIMULATED)';

/** 주문 방향. */
export type OrderSide = 'BUY' | 'SELL';

/** 주문 상태. InverseOrder.status 와 값이 일치해야 한다. */
export type OrderStatus = 'PENDING' | 'PARTIAL' | 'FILLED' | 'CANCELED';

/** 세션 상태. InverseTraderSession.status 와 값이 일치해야 한다. */
export type SessionStatus =
    | 'IDLE'
    | 'RUNNING'
    | 'FORCE_SETTLEMENT'
    | 'STOPPED'
    | 'EMERGENCY_STOP';

/** 실거래 모드가 요청됐을 때 던지는 전용 에러(로그에서 구분 가능하게 별도 타입). */
export class LiveTradingBlockedError extends Error {
    constructor(requested: string) {
        super(
            `실거래 모드가 거부되었습니다: 요청된 모드='${requested}'. ` +
            `이 시스템은 ${TRADING_MODE} 전용이며 증권사 주문 API를 호출하지 않습니다.`
        );
        this.name = 'LiveTradingBlockedError';
    }
}

/**
 * 입력값이 SIMULATION인지 검사한다.
 * 비어 있으면 SIMULATION으로 간주하고, 그 외 값(LIVE 포함)은 예외로 거부한다.
 */
export function assertSimulationMode(mode?: string | null): TradingMode {
    if (mode === undefined || mode === null || mode === '') return TRADING_MODE;
    const normalized = String(mode).trim().toUpperCase();
    if (normalized !== TRADING_MODE) throw new LiveTradingBlockedError(String(mode));
    return TRADING_MODE;
}

/**
 * 환경변수 INVERSE_TRADING_MODE 를 읽어 매매 모드를 확정한다.
 * 미설정이면 SIMULATION, 'LIVE' 등 다른 값이면 예외를 던진다.
 * (엔진 부팅 시 가장 먼저 호출해 실거래 진입 자체를 차단하는 용도)
 */
export function resolveTradingMode(env: NodeJS.ProcessEnv = process.env): TradingMode {
    return assertSimulationMode(env.INVERSE_TRADING_MODE);
}

/** 가격을 호가단위(5원)로 내림 정렬. */
export function floorToTick(price: number, tick: number = TICK_SIZE): number {
    return Math.floor(price / tick) * tick;
}

/** 가격을 호가단위(5원)로 반올림 정렬. */
export function roundToTick(price: number, tick: number = TICK_SIZE): number {
    return Math.round(price / tick) * tick;
}

/**
 * 결정적 난수 생성기(mulberry32).
 * 시뮬레이션 재현성을 위해 시드를 받는다 — 같은 시드면 같은 호가/체결 흐름이 나온다.
 */
export function createRng(seed: number): () => number {
    let a = seed >>> 0;
    return function next(): number {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
