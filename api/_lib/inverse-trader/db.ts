/**
 * 인버스 ETF 1호가 스캘핑 — DB 접근 타입(구조적 인터페이스).
 *
 * 왜 PrismaClient 를 직접 import 하지 않는가:
 *  - 생성된 클라이언트(src/generated/prisma)는 현재 Inverse* 모델을 포함하지 않는다
 *    (prisma generate 전 상태). 여기서 PrismaClient 타입에 의존하면 타입체크가
 *    'prisma generate 를 돌렸는지'에 좌우된다.
 *  - 전략/포지션/가드 모듈이 필요한 델리게이트 메서드만 구조적으로 선언해 두면
 *    실제 PrismaClient 를 그대로 넘길 수 있고(구조적 타이핑), 테스트에서는 가짜
 *    객체를 넘겨 DB 없이 검증할 수 있다.
 *
 * ★ 여기에는 어떤 HTTP 호출도, 증권사 API 도 없다. DB 스키마 미러링 전용.
 */

import type { OrderSide, OrderStatus, SessionStatus } from './constants.js';

// ── 행(Row) 타입: prisma/schema.prisma 의 Inverse* 모델과 1:1 ───────────────

export interface InverseOrderRow {
    id: number;
    sessionId: string;
    symbol: string;
    side: OrderSide;
    limitPrice: number;
    orderQty: number;
    filledQty: number;
    remainingQty: number;
    status: OrderStatus;
    parentOrderId: number | null;
    brokerOrderId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface InverseFillRow {
    id: number;
    orderId: number;
    symbol: string;
    side: OrderSide;
    fillPrice: number;
    fillQty: number;
    filledAt: Date;
}

export interface InversePositionRow {
    id: number;
    sessionId: string;
    symbol: string;
    qty: number;
    avgPrice: number;
    realizedPnl: number;
    unrealizedPnl: number;
    updatedAt: Date;
}

export interface InverseTraderSessionRow {
    id: string;
    status: SessionStatus | string;
    startedAt: Date | null;
    endedAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface InverseTraderConfigRow {
    id: number;
    symbol: string;
    symbolName: string;
    defaultQty: number;
    closeBufferMin: number;
    maxPositionQty: number;
    dailyLossLimit: number;
    tradingMode: string;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface InverseDailyStatRow {
    id: number;
    /** 영업일(@db.Date). KST 달력일을 UTC 자정으로 표현한 값을 넣는다 */
    date: Date;
    sessionId: string | null;
    buyQty: number;
    buyAmount: number;
    sellQty: number;
    sellAmount: number;
    realizedPnl: number;
    fillCount: number;
    /** 마감 강제정산 성공 여부 */
    forceSettled: boolean;
    /** 마감 시 잔여수량(주). 강제정산 실패 시 0이 아니다 */
    closingQty: number;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// ── 델리게이트 인터페이스 ──────────────────────────────────────────────────
// where/data 는 Prisma 의 실제 입력 타입을 그대로 받기 위해 느슨하게 둔다.
// (엄격히 좁히면 실제 PrismaClient 를 넘길 때 구조적 호환이 깨진다)

type Args = Record<string, any>;

export interface OrderDelegate {
    create(args: { data: Args }): Promise<InverseOrderRow>;
    update(args: { where: Args; data: Args }): Promise<InverseOrderRow>;
    updateMany(args: { where: Args; data: Args }): Promise<{ count: number }>;
    findUnique(args: { where: Args }): Promise<InverseOrderRow | null>;
    findFirst(args: { where?: Args; orderBy?: Args }): Promise<InverseOrderRow | null>;
    findMany(args?: { where?: Args; orderBy?: Args; take?: number }): Promise<InverseOrderRow[]>;
}

export interface FillDelegate {
    create(args: { data: Args }): Promise<InverseFillRow>;
    findMany(args?: { where?: Args; orderBy?: Args; take?: number }): Promise<InverseFillRow[]>;
}

export interface PositionDelegate {
    upsert(args: { where: Args; create: Args; update: Args }): Promise<InversePositionRow>;
    update(args: { where: Args; data: Args }): Promise<InversePositionRow>;
    findUnique(args: { where: Args }): Promise<InversePositionRow | null>;
    findMany(args?: { where?: Args; orderBy?: Args }): Promise<InversePositionRow[]>;
}

export interface SessionDelegate {
    create(args: { data: Args }): Promise<InverseTraderSessionRow>;
    update(args: { where: Args; data: Args }): Promise<InverseTraderSessionRow>;
    updateMany(args: { where: Args; data: Args }): Promise<{ count: number }>;
    findUnique(args: { where: Args }): Promise<InverseTraderSessionRow | null>;
    findFirst(args?: { where?: Args; orderBy?: Args }): Promise<InverseTraderSessionRow | null>;
    findMany(args?: { where?: Args; orderBy?: Args; take?: number }): Promise<InverseTraderSessionRow[]>;
}

export interface ConfigDelegate {
    create(args: { data: Args }): Promise<InverseTraderConfigRow>;
    update(args: { where: Args; data: Args }): Promise<InverseTraderConfigRow>;
    findFirst(args?: { where?: Args; orderBy?: Args }): Promise<InverseTraderConfigRow | null>;
    findUnique(args: { where: Args }): Promise<InverseTraderConfigRow | null>;
}

/** 일자별 집계. 강제정산 성공여부/잔여수량이 여기에 남는다. */
export interface DailyStatDelegate {
    upsert(args: { where: Args; create: Args; update: Args }): Promise<InverseDailyStatRow>;
    findUnique(args: { where: Args }): Promise<InverseDailyStatRow | null>;
    findFirst(args?: { where?: Args; orderBy?: Args }): Promise<InverseDailyStatRow | null>;
    findMany(args?: { where?: Args; orderBy?: Args; take?: number }): Promise<InverseDailyStatRow[]>;
}

/**
 * 전략/포지션/가드가 요구하는 최소 DB 인터페이스.
 * 실제로는 PrismaClient 를 그대로 넘긴다(구조적 호환).
 */
export interface InverseTraderDb {
    inverseOrder: OrderDelegate;
    inverseFill: FillDelegate;
    inversePosition: PositionDelegate;
    inverseTraderSession: SessionDelegate;
    inverseTraderConfig: ConfigDelegate;
    inverseDailyStat: DailyStatDelegate;
    /** 세션ID 단위로 주문·체결·포지션 쓰기를 한 트랜잭션으로 묶는다. */
    $transaction?<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}

/** 살아있는(추가 체결이 가능한) 주문 상태. 중복주문 판정 기준. */
export const LIVE_ORDER_STATUSES: OrderStatus[] = ['PENDING', 'PARTIAL'];

/**
 * $transaction 이 있으면 트랜잭션으로, 없으면(테스트용 가짜 DB 등) 그대로 실행한다.
 * 세션ID 기준 묶음 쓰기를 한 곳에서 처리하기 위한 헬퍼.
 */
export async function runInTransaction<T>(
    db: InverseTraderDb,
    fn: (tx: InverseTraderDb) => Promise<T>
): Promise<T> {
    if (typeof db.$transaction === 'function') {
        return db.$transaction((tx: any) => fn(tx as InverseTraderDb));
    }
    return fn(db);
}
