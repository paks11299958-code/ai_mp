/**
 * 인버스 ETF 1호가 스캘핑 — 브로커 인터페이스.
 *
 * ★ 여기에는 인터페이스와 공용 타입만 둔다. 구현체는 시뮬레이션 하나뿐이며
 *   (simulation-broker.ts), 실거래 구현체는 만들지 않는다(자리표시자도 두지 않는다).
 */

import type { OrderSide, OrderStatus, TradingMode } from './constants.js';

export type { OrderSide, OrderStatus } from './constants.js';

/** 1호가(최우선 매수/매도) 스냅샷. 실 시세로 교체되더라도 이 형태를 유지한다. */
export interface Quote {
    symbol: string;
    /** 최우선 매수호가(원) */
    bidPrice: number;
    /** 최우선 매수호가 잔량(주) */
    bidQty: number;
    /** 최우선 매도호가(원) */
    askPrice: number;
    /** 최우선 매도호가 잔량(주) */
    askQty: number;
    /** 최근 체결가(원) */
    lastPrice: number;
    /** 호가 시각 */
    ts: Date;
    /** 시세 출처 표기. 가상 생성기는 '가상 호가 생성기(SIMULATED)' */
    source: string;
}

/** 주문 접수 요청. */
export interface PlaceOrderParams {
    symbol: string;
    side: OrderSide;
    /** 지정가(원). 호가단위로 정렬되어 있어야 한다. */
    price: number;
    /** 주문수량(주) */
    qty: number;
    /** 이 주문을 낳은 부모 주문ID(후속주문 추적용). InverseOrder.parentOrderId 에 대응 */
    parentOrderId?: number | null;
    /** 호출측 참조용 태그(전략 단계 등). 브로커는 그대로 되돌려준다. */
    clientTag?: string;
}

/** 브로커가 관리하는 주문 상태. InverseOrder 레코드와 1:1로 대응된다. */
export interface BrokerOrder {
    /** 브로커 주문번호. InverseOrder.brokerOrderId 에 저장한다. */
    orderId: string;
    symbol: string;
    side: OrderSide;
    /** 지정가(원) */
    price: number;
    /** 주문수량 */
    qty: number;
    /** 누적 체결수량 */
    filledQty: number;
    /** 잔량 (qty - filledQty) */
    remainingQty: number;
    status: OrderStatus;
    parentOrderId?: number | null;
    clientTag?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * 체결 결과. InverseFill 모델과 같은 형태로 만들어
 * 그대로 prisma.inverseFill.create({ data }) 에 넘길 수 있게 한다.
 * (orderId만 브로커 주문번호 → InverseOrder.id 로 치환해서 저장한다)
 */
export interface FillRecord {
    /** 브로커 주문번호 */
    orderId: string;
    symbol: string;
    side: OrderSide;
    /** 체결가(원) */
    fillPrice: number;
    /** 체결수량(주) */
    fillQty: number;
    /** 체결시각 */
    filledAt: Date;
}

/** 주문 접수 결과 — 접수된 주문과 즉시 발생한 체결(있다면). */
export interface PlaceOrderResult {
    order: BrokerOrder;
    /** 접수 즉시 체결된 내역. 즉시체결이 없으면 빈 배열(대기 주문으로 남음). */
    fills: FillRecord[];
}

/** 주문 취소 결과. */
export interface CancelOrderResult {
    order: BrokerOrder;
    /** 이미 체결/취소되어 취소가 적용되지 않았으면 false */
    canceled: boolean;
}

/**
 * 브로커 인터페이스.
 * 전략 엔진은 이 인터페이스에만 의존한다.
 */
export interface Broker {
    /** 이 브로커가 동작하는 매매 모드. 구현체는 'SIMULATION' 만 존재한다. */
    readonly mode: TradingMode;

    /** 지정가 주문 접수. 호가와 비교해 즉시 체결 가능하면 체결까지 함께 반환한다. */
    placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult>;

    /** 미체결(잔량) 주문 취소. */
    cancelOrder(orderId: string): Promise<CancelOrderResult>;

    /** 현재 1호가 조회. 실 시세로 교체되어도 시그니처는 동일하게 유지한다. */
    getQuote(symbol: string): Promise<Quote>;

    /** 미체결 주문 목록(PENDING/PARTIAL). symbol 을 주면 해당 종목만. */
    getOpenOrders(symbol?: string): Promise<BrokerOrder[]>;

    /** 주문 단건 조회. 없으면 null. */
    getOrder(orderId: string): Promise<BrokerOrder | null>;
}
