/**
 * 인버스 ETF 1호가 스캘핑 — 테스트용 인메모리 DB.
 *
 * 왜 필요한가: 이 저장소의 개발 컨테이너에서는 프로덕션 GCP DB 로 직접 접속이 되지 않고,
 * Inverse* 모델은 아직 `prisma migrate` 전이라 실제 테이블도 없다. 그래서 7종 시나리오를
 * "실제로 실행"하려면 InverseTraderDb 인터페이스를 구조적으로 만족하는 가짜 DB 가 필요하다.
 *
 * ★가짜인 것은 **저장소뿐**이다. 전략·포지션·가드·정산 로직은 전부 실제 코드가 돈다.
 *   테스트를 통과시키려고 로직을 우회하는 분기는 여기에 하나도 없다.
 */

import { randomUUID } from 'node:crypto';
import type {
    ConfigDelegate,
    DailyStatDelegate,
    FillDelegate,
    InverseDailyStatRow,
    InverseFillRow,
    InverseOrderRow,
    InversePositionRow,
    InverseTraderConfigRow,
    InverseTraderDb,
    InverseTraderSessionRow,
    OrderDelegate,
    PositionDelegate,
    SessionDelegate,
} from '../../api/_lib/inverse-trader/db.js';

type Args = Record<string, any>;

/** Prisma 의 복합 유니크 키(모델당 1개)를 평평한 where 로 펼친다. */
const COMPOUND_KEYS = ['sessionId_symbol'];

function expandWhere(where: Args | undefined): Args {
    if (!where) return {};
    const out: Args = {};
    for (const [k, v] of Object.entries(where)) {
        if (COMPOUND_KEYS.includes(k) && v && typeof v === 'object') {
            Object.assign(out, v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function toComparable(v: any): number {
    if (v instanceof Date) return v.getTime();
    return typeof v === 'number' ? v : Number(v);
}

/** Prisma where 절의 부분집합(등호 / in / gte·gt·lte·lt / not)을 해석한다. */
function matchValue(rowVal: any, cond: any): boolean {
    if (cond === undefined) return true;
    if (cond === null) return rowVal === null || rowVal === undefined;
    if (cond instanceof Date) return rowVal instanceof Date && rowVal.getTime() === cond.getTime();
    if (typeof cond === 'object' && !Array.isArray(cond)) {
        if ('in' in cond) return (cond.in as any[]).some((v) => matchValue(rowVal, v));
        let ok = true;
        if ('gte' in cond) ok = ok && toComparable(rowVal) >= toComparable(cond.gte);
        if ('gt' in cond) ok = ok && toComparable(rowVal) > toComparable(cond.gt);
        if ('lte' in cond) ok = ok && toComparable(rowVal) <= toComparable(cond.lte);
        if ('lt' in cond) ok = ok && toComparable(rowVal) < toComparable(cond.lt);
        if ('not' in cond) ok = ok && !matchValue(rowVal, cond.not);
        return ok;
    }
    return rowVal === cond;
}

function matchRow(row: Args, where: Args): boolean {
    for (const [k, cond] of Object.entries(where)) {
        if (!matchValue(row[k], cond)) return false;
    }
    return true;
}

function applyOrderBy<T extends Args>(rows: T[], orderBy?: Args): T[] {
    if (!orderBy) return rows;
    const entries = Object.entries(orderBy);
    if (entries.length === 0) return rows;
    const [field, dir] = entries[0];
    const sign = dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const an = av instanceof Date ? av.getTime() : av;
        const bn = bv instanceof Date ? bv.getTime() : bv;
        return an < bn ? -sign : sign;
    });
}

interface TableOptions<T> {
    /** id 생성기. 생략하면 1부터 증가하는 정수 */
    idFactory?: (seq: number) => any;
    /** create 시 채워 넣을 기본값 */
    defaults?: (data: Args, seq: number) => Partial<T>;
}

/**
 * Prisma 델리게이트의 최소 부분집합을 구현한 인메모리 테이블.
 * createdAt/updatedAt 은 호출 순서대로 1ms 씩 증가시켜 정렬이 항상 결정적이 되게 한다.
 */
class Table<T extends Args> {
    readonly rows: T[] = [];
    private seq = 0;
    private clock = Date.UTC(2026, 7, 20, 1, 0, 0); // 2026-08-20 10:00 KST

    constructor(private readonly options: TableOptions<T> = {}) {}

    private nextId(): any {
        this.seq += 1;
        return this.options.idFactory ? this.options.idFactory(this.seq) : this.seq;
    }

    private tick(): Date {
        this.clock += 1;
        return new Date(this.clock);
    }

    async create(args: { data: Args }): Promise<T> {
        const now = this.tick();
        const row = {
            id: this.nextId(),
            ...(this.options.defaults ? this.options.defaults(args.data, this.seq) : {}),
            ...args.data,
            createdAt: args.data.createdAt ?? now,
            updatedAt: args.data.updatedAt ?? now,
        } as unknown as T;
        this.rows.push(row);
        return { ...row };
    }

    async update(args: { where: Args; data: Args }): Promise<T> {
        const where = expandWhere(args.where);
        const row = this.rows.find((r) => matchRow(r, where));
        if (!row) throw new Error(`[fake-db] update 대상이 없습니다: ${JSON.stringify(args.where)}`);
        Object.assign(row, args.data, { updatedAt: this.tick() });
        return { ...row };
    }

    async updateMany(args: { where: Args; data: Args }): Promise<{ count: number }> {
        const where = expandWhere(args.where);
        let count = 0;
        for (const row of this.rows) {
            if (!matchRow(row, where)) continue;
            Object.assign(row, args.data, { updatedAt: this.tick() });
            count += 1;
        }
        return { count };
    }

    async upsert(args: { where: Args; create: Args; update: Args }): Promise<T> {
        const where = expandWhere(args.where);
        const row = this.rows.find((r) => matchRow(r, where));
        if (row) {
            Object.assign(row, args.update, { updatedAt: this.tick() });
            return { ...row };
        }
        return this.create({ data: { ...where, ...args.create } });
    }

    async findUnique(args: { where: Args }): Promise<T | null> {
        const where = expandWhere(args.where);
        const row = this.rows.find((r) => matchRow(r, where));
        return row ? { ...row } : null;
    }

    async findFirst(args: { where?: Args; orderBy?: Args } = {}): Promise<T | null> {
        const rows = await this.findMany(args);
        return rows[0] ?? null;
    }

    async findMany(args: { where?: Args; orderBy?: Args; take?: number } = {}): Promise<T[]> {
        const where = expandWhere(args.where);
        let rows = this.rows.filter((r) => matchRow(r, where));
        rows = applyOrderBy(rows, args.orderBy);
        if (typeof args.take === 'number') rows = rows.slice(0, args.take);
        return rows.map((r) => ({ ...r }));
    }
}

/** 테스트용 InverseTraderDb 구현. rows 로 내부 상태를 직접 들여다볼 수 있다. */
export class FakeInverseDb implements InverseTraderDb {
    readonly inverseOrder: OrderDelegate & Table<InverseOrderRow>;
    readonly inverseFill: FillDelegate & Table<InverseFillRow>;
    readonly inversePosition: PositionDelegate & Table<InversePositionRow>;
    readonly inverseTraderSession: SessionDelegate & Table<InverseTraderSessionRow>;
    readonly inverseTraderConfig: ConfigDelegate & Table<InverseTraderConfigRow>;
    readonly inverseDailyStat: DailyStatDelegate & Table<InverseDailyStatRow>;

    constructor() {
        this.inverseOrder = new Table<InverseOrderRow>({
            defaults: (data) => ({
                filledQty: 0,
                remainingQty: data.orderQty,
                status: 'PENDING',
                parentOrderId: null,
                brokerOrderId: null,
            }) as Partial<InverseOrderRow>,
        }) as any;
        this.inverseFill = new Table<InverseFillRow>() as any;
        this.inversePosition = new Table<InversePositionRow>({
            defaults: () => ({ qty: 0, avgPrice: 0, realizedPnl: 0, unrealizedPnl: 0 }) as Partial<InversePositionRow>,
        }) as any;
        this.inverseTraderSession = new Table<InverseTraderSessionRow>({
            idFactory: () => randomUUID(),
            defaults: () => ({ status: 'IDLE', startedAt: null, endedAt: null, lastError: null }) as Partial<InverseTraderSessionRow>,
        }) as any;
        this.inverseTraderConfig = new Table<InverseTraderConfigRow>() as any;
        this.inverseDailyStat = new Table<InverseDailyStatRow>({
            defaults: () => ({ note: null }) as Partial<InverseDailyStatRow>,
        }) as any;
    }

    // $transaction 은 일부러 구현하지 않는다 — runInTransaction 이 그대로 실행 경로를 탄다.
}

/** 설정 1건을 심어 둔다(엔진 기본값 대신 테스트가 원하는 값으로 돌리기 위함). */
export async function seedConfig(
    db: FakeInverseDb,
    overrides: Partial<InverseTraderConfigRow> = {}
): Promise<InverseTraderConfigRow> {
    return db.inverseTraderConfig.create({
        data: {
            symbol: '252670',
            symbolName: 'KODEX 200선물인버스2X',
            defaultQty: 100,
            closeBufferMin: 10,
            maxPositionQty: 1000,
            dailyLossLimit: 500_000,
            tradingMode: 'SIMULATION',
            enabled: true,
            ...overrides,
        },
    });
}
