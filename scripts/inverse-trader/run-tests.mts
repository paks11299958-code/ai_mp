/**
 * 인버스 ETF 1호가 스캘핑 — 시나리오 7종 실행 테스트.
 *
 *   npx tsx scripts/inverse-trader/run-tests.ts
 *   (또는 npm run test:inverse)
 *
 * 무엇이 진짜로 도는가:
 *   - 전략(InverseScalpingStrategy) / 포지션(applyFill) / 가드 / 정산(runForceSettlement) /
 *     런루프(tickSession) 는 **실제 운영 코드 그대로** 실행된다.
 *   - 바뀐 것은 둘뿐이다. ① DB → 인메모리 FakeInverseDb ② 호가 → StaticQuoteFeed.
 *     (개발 컨테이너에서 프로덕션 DB 접속이 막혀 있고, Inverse* 테이블은 아직 migrate 전이다)
 *   - 시세는 어느 경로로도 실제 증권사 API 를 타지 않는다(가상 호가 생성기 전용).
 */

import {
    ETF_TICK_BANDS,
    createStrategy,
    planFollowUpOrders,
    tickDown,
    tickUp,
    type InverseScalpingStrategy,
} from '../../api/_lib/inverse-trader/strategy.js';
import { createSimulationBroker } from '../../api/_lib/inverse-trader/simulation-broker.js';
import { assertSessionTradable } from '../../api/_lib/inverse-trader/guards.js';
import { runForceSettlement } from '../../api/inverse-trader/settlement.js';
import {
    resetEngineState,
    startSession,
    tickSession,
    getStatusSnapshot,
} from '../../api/inverse-trader/engine.js';
import type { InverseOrderRow } from '../../api/_lib/inverse-trader/db.js';
import { FakeInverseDb, seedConfig } from './fake-db.mjs';
import { StaticQuoteFeed } from './static-feed.mjs';

// ─────────────────────────────────────────────────────────────
// 초소형 테스트 하네스 (러너 의존성 없이 tsx 로 바로 돈다)
// ─────────────────────────────────────────────────────────────

interface Case {
    no: number;
    title: string;
    fn: () => Promise<void>;
}

const cases: Case[] = [];
function test(no: number, title: string, fn: () => Promise<void>): void {
    cases.push({ no, title, fn });
}

class AssertionError extends Error {}

function ok(cond: any, message: string): void {
    if (!cond) throw new AssertionError(message);
}
function eq(actual: any, expected: any, label: string): void {
    if (actual !== expected) {
        throw new AssertionError(`${label}: 기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
    }
}

const SYMBOL = '252670';
const steps: string[] = [];
function step(line: string): void {
    steps.push(line);
}

/** 주문 1건을 한 줄로 요약(실패 시 화면에 그대로 찍는다). */
function fmt(o: InverseOrderRow): string {
    return `#${o.id} ${o.side} ${o.limitPrice}원 ${o.filledQty}/${o.orderQty}(잔${o.remainingQty}) ${o.status}` +
        (o.parentOrderId ? ` ←#${o.parentOrderId}` : '');
}

async function dumpOrders(db: FakeInverseDb, sessionId: string): Promise<InverseOrderRow[]> {
    const rows = await db.inverseOrder.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    for (const r of rows) step(`      ${fmt(r)}`);
    return rows;
}

// ─────────────────────────────────────────────────────────────
// 공통 픽스처 — 세션 1개 + 고정호가 브로커 + 실제 전략 엔진
// ─────────────────────────────────────────────────────────────

interface Fixture {
    db: FakeInverseDb;
    feed: StaticQuoteFeed;
    strategy: InverseScalpingStrategy;
    sessionId: string;
}

async function makeFixture(opts: {
    bidPrice?: number;
    askPrice?: number;
    bidQty?: number;
    askQty?: number;
    defaultQty?: number;
    maxPositionQty?: number;
} = {}): Promise<Fixture> {
    const db = new FakeInverseDb();
    const session = await db.inverseTraderSession.create({
        data: { status: 'RUNNING', startedAt: new Date(), lastError: null },
    });
    const feed = new StaticQuoteFeed({
        bidPrice: opts.bidPrice ?? 5000,
        askPrice: opts.askPrice ?? 5005,
        bidQty: opts.bidQty ?? 1000,
        askQty: opts.askQty ?? 1000,
    });
    const broker = createSimulationBroker({ feed });
    const strategy = createStrategy(db, broker, {
        sessionId: session.id,
        symbol: SYMBOL,
        defaultQty: opts.defaultQty ?? 100,
        maxPositionQty: opts.maxPositionQty ?? 1000,
        dailyLossLimit: 500_000,
        tradingMode: 'SIMULATION',
    });
    return { db, feed, strategy, sessionId: session.id };
}

// ─────────────────────────────────────────────────────────────
// ① 최초 매수 주문이 (매수호가 -1호가)에 생성되는가
// ─────────────────────────────────────────────────────────────

test(1, '최초 매수 주문이 (매수호가 -1호가)에 생성되는가', async () => {
    const { db, strategy, sessionId } = await makeFixture({ bidPrice: 5000, askPrice: 5005 });
    step('    호가: 매수 5000 / 매도 5005, 기본주문수량 100주');

    const result = await strategy.start();
    ok(!result.skipped, `세션 시작 주문이 차단됐습니다: ${result.reason}`);

    const orders = await dumpOrders(db, sessionId);
    eq(orders.length, 1, '주문 건수');
    const o = orders[0];
    eq(o.side, 'BUY', '방향');
    eq(o.limitPrice, tickDown(5000, 1, ETF_TICK_BANDS), '지정가(=매수호가 -1호가)');
    eq(o.limitPrice, 4995, '지정가 실측');
    eq(o.orderQty, 100, '주문수량');
    eq(o.status, 'PENDING', '상태');
    eq(o.parentOrderId, null, '부모주문');
    step('    → 매수호가 5000 - 1호가(5원) = 4995원 매수 1건, 즉시체결 없음');
});

// ─────────────────────────────────────────────────────────────
// ② 매수 체결 후 후속 주문 2건(+1호가 매도 / -1호가 매수)
// ─────────────────────────────────────────────────────────────

test(2, '매수 체결 후 후속 주문 2건(+1호가 매도 / -1호가 매수)이 생성되는가', async () => {
    const { db, feed, strategy, sessionId } = await makeFixture({ bidPrice: 5000, askPrice: 5005 });
    await strategy.start(); // BUY 4995 대기

    // 시장이 내려와 4995 가 매도호가가 되면 대기 매수는 체결된다.
    feed.set({ bidPrice: 4990, askPrice: 4995, askQty: 100 });
    const handled = await strategy.onTick();
    eq(handled, 1, '이번 틱 체결 건수');
    step('    호가를 4990/4995 로 내려 매수 4995 전량(100주) 체결');

    const orders = await dumpOrders(db, sessionId);
    eq(orders.length, 3, '주문 건수(원주문 + 후속 2건)');

    const parent = orders[0];
    eq(parent.status, 'FILLED', '원주문 상태');
    eq(parent.filledQty, 100, '원주문 체결수량');

    const follow = orders.slice(1);
    // 매수 체결이면 이익실현(매도)을 먼저 건다.
    eq(follow[0].side, 'SELL', '후속①  방향');
    eq(follow[0].limitPrice, tickUp(4995, 1, ETF_TICK_BANDS), '후속① 지정가(체결가 +1호가)');
    eq(follow[0].limitPrice, 5000, '후속① 지정가 실측');
    eq(follow[1].side, 'BUY', '후속② 방향');
    eq(follow[1].limitPrice, tickDown(4995, 1, ETF_TICK_BANDS), '후속② 지정가(체결가 -1호가)');
    eq(follow[1].limitPrice, 4990, '후속② 지정가 실측');
    for (const f of follow) {
        eq(f.orderQty, 100, `후속(${f.side}) 수량`);
        eq(f.parentOrderId, parent.id, `후속(${f.side}) 부모주문`);
        eq(f.status, 'PENDING', `후속(${f.side}) 상태`);
    }

    const pos = await db.inversePosition.findUnique({ where: { sessionId_symbol: { sessionId, symbol: SYMBOL } } });
    eq(pos?.qty, 100, '보유수량');
    eq(pos?.avgPrice, 4995, '평균단가');
});

// ─────────────────────────────────────────────────────────────
// ③ 매도 체결 후 후속 주문 2건(-1호가 매수 / +1호가 매도)
// ─────────────────────────────────────────────────────────────

test(3, '매도 체결 후 후속 주문 2건(-1호가 매수 / +1호가 매도)이 생성되는가', async () => {
    const { db, feed, strategy, sessionId } = await makeFixture({ bidPrice: 4990, askPrice: 4995 });

    // 이미 300주를 들고 있는 상태에서 매도가 체결되는 국면을 만든다.
    // (매도 후에도 잔고가 남아야 후속 '+1호가 매도'가 공매도 가드에 걸리지 않는다)
    await db.inversePosition.create({
        data: { sessionId, symbol: SYMBOL, qty: 300, avgPrice: 4990, realizedPnl: 0, unrealizedPnl: 0 },
    });
    const placed = await strategy.submitOrder({
        sessionId, symbol: SYMBOL, side: 'SELL', limitPrice: 5000, qty: 100, reason: 'TEST_SEED_SELL',
    });
    ok(!placed.skipped, `매도 주문이 차단됐습니다: ${placed.reason}`);
    step('    보유 300주 / 매도 5000원 100주 대기');

    feed.set({ bidPrice: 5000, askPrice: 5005, bidQty: 100 });
    const handled = await strategy.onTick();
    eq(handled, 1, '이번 틱 체결 건수');
    step('    호가가 5000/5005 로 올라 매도 5000 전량(100주) 체결');

    const orders = await dumpOrders(db, sessionId);
    eq(orders.length, 3, '주문 건수(원주문 + 후속 2건)');

    const parent = orders[0];
    eq(parent.side, 'SELL', '원주문 방향');
    eq(parent.status, 'FILLED', '원주문 상태');

    const follow = orders.slice(1);
    // 매도 체결이면 재진입(매수)을 먼저 건다.
    eq(follow[0].side, 'BUY', '후속① 방향');
    eq(follow[0].limitPrice, tickDown(5000, 1, ETF_TICK_BANDS), '후속① 지정가(체결가 -1호가)');
    eq(follow[0].limitPrice, 4995, '후속① 지정가 실측');
    eq(follow[1].side, 'SELL', '후속② 방향');
    eq(follow[1].limitPrice, tickUp(5000, 1, ETF_TICK_BANDS), '후속② 지정가(체결가 +1호가)');
    eq(follow[1].limitPrice, 5005, '후속② 지정가 실측');
    for (const f of follow) {
        eq(f.orderQty, 100, `후속(${f.side}) 수량`);
        eq(f.parentOrderId, parent.id, `후속(${f.side}) 부모주문`);
    }

    // 순수함수 자체도 같은 순서를 내는지 함께 확인(엔진 통과 여부와 별개로 규칙 고정)
    const planned = planFollowUpOrders(
        { sessionId, symbol: SYMBOL },
        { side: 'SELL', fillPrice: 5000, fillQty: 100 }
    );
    eq(planned.map((p) => `${p.side}@${p.limitPrice}`).join(','), 'BUY@4995,SELL@5005', 'planFollowUpOrders 순서');
});

// ─────────────────────────────────────────────────────────────
// ④ 부분체결 — 후속 수량이 '실제 체결수량' 기준인가 / 잔량 원주문 유지
// ─────────────────────────────────────────────────────────────

test(4, "부분체결 시 후속 주문 수량이 '실제 체결수량' 기준인가, 잔량 원주문이 유지되는가", async () => {
    const { db, feed, strategy, sessionId } = await makeFixture({ bidPrice: 5000, askPrice: 5005 });
    await strategy.start(); // BUY 4995 × 100주

    // 매도호가 잔량이 30주뿐 → 100주 주문 중 30주만 체결된다.
    feed.set({ bidPrice: 4990, askPrice: 4995, askQty: 30 });
    const handled = await strategy.onTick();
    eq(handled, 1, '이번 틱 체결 건수');
    step('    매도호가 잔량 30주 → 100주 주문 중 30주만 체결');

    const orders = await dumpOrders(db, sessionId);
    eq(orders.length, 3, '주문 건수(잔량 원주문 + 후속 2건)');

    const parent = orders[0];
    eq(parent.status, 'PARTIAL', '원주문 상태(잔량이 남아 살아있어야 한다)');
    eq(parent.filledQty, 30, '원주문 체결수량');
    eq(parent.remainingQty, 70, '원주문 잔량');

    const follow = orders.slice(1);
    eq(follow[0].side, 'SELL', '후속① 방향');
    eq(follow[0].orderQty, 30, '후속① 수량(=실제 체결수량)');
    eq(follow[1].side, 'BUY', '후속② 방향');
    eq(follow[1].orderQty, 30, '후속② 수량(=실제 체결수량)');
    ok(follow.every((f) => f.orderQty !== 100), '후속 수량이 원주문 수량(100)을 따라가면 안 된다');

    // 잔량 원주문이 살아있으므로 중복 판정에도 계속 잡혀야 한다.
    const live = await db.inverseOrder.findMany({
        where: { sessionId, symbol: SYMBOL, status: { in: ['PENDING', 'PARTIAL'] } },
    });
    ok(live.some((o) => o.id === parent.id), '잔량 원주문이 살아있는 주문 목록에 있어야 한다');
    step(`    → 원주문 30/100 체결(잔70, PARTIAL 유지), 후속 2건 모두 30주`);

    const fills = await db.inverseFill.findMany({ where: { orderId: parent.id } });
    eq(fills.length, 1, '체결 기록 건수');
    eq(fills[0].fillQty, 30, '체결 기록 수량');
});

// ─────────────────────────────────────────────────────────────
// ⑤ 같은 종목·방향·가격 주문이 살아있을 때 중복 생성 차단
// ─────────────────────────────────────────────────────────────

test(5, '같은 종목·방향·가격 주문이 살아있을 때 중복 생성이 차단되는가', async () => {
    const { db, strategy, sessionId } = await makeFixture({ bidPrice: 5000, askPrice: 5005 });
    await strategy.start(); // BUY 4995 PENDING

    const before = (await db.inverseOrder.findMany({ where: { sessionId } })).length;
    eq(before, 1, '사전 주문 건수');

    const dup = await strategy.submitOrder({
        sessionId, symbol: SYMBOL, side: 'BUY', limitPrice: 4995, qty: 100, reason: 'TEST_DUPLICATE',
    });
    ok(dup.skipped, '같은 호가 매수는 건너뛰어야 한다');
    eq(dup.order, null, '차단된 주문은 DB 에 남지 않아야 한다');
    ok(/중복|살아있는/.test(dup.reason ?? ''), `차단 사유가 중복임을 알려야 한다: ${dup.reason}`);
    eq((await db.inverseOrder.findMany({ where: { sessionId } })).length, 1, '차단 후 주문 건수');
    step(`    중복 매수 4995 차단 — "${dup.reason}"`);

    // 방향이 다르면(SELL) 막히지 않는다 — 중복 키는 (세션,종목,side,지정가) 이다.
    await db.inversePosition.create({
        data: { sessionId, symbol: SYMBOL, qty: 100, avgPrice: 4995, realizedPnl: 0, unrealizedPnl: 0 },
    });
    const otherSide = await strategy.submitOrder({
        sessionId, symbol: SYMBOL, side: 'SELL', limitPrice: 4995, qty: 100, reason: 'TEST_OTHER_SIDE',
    });
    ok(!otherSide.skipped, `방향이 다른 주문까지 막으면 안 된다: ${otherSide.reason}`);

    // 가격이 다르면 막히지 않는다.
    const otherPrice = await strategy.submitOrder({
        sessionId, symbol: SYMBOL, side: 'BUY', limitPrice: 4990, qty: 100, reason: 'TEST_OTHER_PRICE',
    });
    ok(!otherPrice.skipped, `가격이 다른 주문까지 막으면 안 된다: ${otherPrice.reason}`);

    // 원주문을 취소하면(=살아있지 않으면) 같은 호가에 다시 낼 수 있어야 한다.
    await db.inverseOrder.update({ where: { id: 1 }, data: { status: 'CANCELED', remainingQty: 0 } });
    const again = await strategy.submitOrder({
        sessionId, symbol: SYMBOL, side: 'BUY', limitPrice: 4995, qty: 100, reason: 'TEST_AFTER_CANCEL',
    });
    ok(!again.skipped, `취소 뒤에는 같은 호가에 다시 낼 수 있어야 한다: ${again.reason}`);
    step('    → 취소된 주문은 중복 판정에서 제외됨(재주문 허용) 확인');
});

// ─────────────────────────────────────────────────────────────
// ⑥ 마감버퍼 진입 후 신규 매수 차단 (런루프 tickSession 경유)
// ─────────────────────────────────────────────────────────────

/** KST 시:분 을 UTC Date 로. (KST = UTC+9) */
function kst(hour: number, minute: number): Date {
    return new Date(Date.UTC(2026, 7, 20, hour - 9, minute, 0));
}

test(6, '마감버퍼 진입 후 신규 매수가 차단되는가', async () => {
    resetEngineState();
    const db = new FakeInverseDb();
    await seedConfig(db, { closeBufferMin: 10, defaultQty: 100, maxPositionQty: 1000 });

    const started = await startSession(db, { feedOptions: { seed: 7, basePrice: 5000 } });
    const sessionId = started.session.id;
    eq(started.rehydrated, false, '신규 세션 여부');
    ok(started.seeded, `세션 시작 주문이 접수돼야 한다: ${started.seedReason}`);

    const buysBefore = (await db.inverseOrder.findMany({ where: { sessionId, side: 'BUY' } })).length;
    ok(buysBefore >= 1, '마감 전에는 매수 주문이 나야 한다');
    step(`    마감 전(장중) 매수 주문 ${buysBefore}건`);

    // 평시 틱은 정상 진행(= 아래 차단이 '시각 때문'임을 보이기 위한 대조군)
    const normal = await tickSession(db, sessionId, { now: () => kst(13, 0) });
    eq(normal.skipped, false, '13:00 KST 틱은 진행돼야 한다');
    eq(normal.status, 'RUNNING', '13:00 KST 세션 상태');

    // 마감 15:30 - 버퍼 10분 = 15:20 부터 정산 구간
    const inWindow = await tickSession(db, sessionId, { now: () => kst(15, 25) });
    ok(!!inWindow.settlement, '마감버퍼 진입 틱은 강제정산을 돌려야 한다');
    ok(inWindow.status !== 'RUNNING', `마감버퍼 진입 후 세션이 RUNNING 이면 안 된다(실제: ${inWindow.status})`);
    step(`    15:25 KST 틱 → 강제정산 진입, 세션 상태 ${inWindow.status}`);

    const buysAfterEntry = (await db.inverseOrder.findMany({ where: { sessionId, side: 'BUY' } })).length;
    eq(buysAfterEntry, buysBefore, '정산 진입으로 신규 매수가 늘면 안 된다');

    // 이후 몇 틱을 더 돌려도 매수는 한 건도 늘지 않아야 한다.
    for (const [h, m] of [[15, 26], [15, 27], [15, 28]] as const) {
        const r = await tickSession(db, sessionId, { now: () => kst(h, m) });
        ok(r.skipped, `${h}:${m} 틱은 건너뛰어야 한다(실제 사유: ${r.reason})`);
        eq(r.fills, 0, `${h}:${m} 틱 체결 건수`);
    }
    const buysFinal = (await db.inverseOrder.findMany({ where: { sessionId, side: 'BUY' } })).length;
    eq(buysFinal, buysBefore, '정산 이후 추가 틱에서도 신규 매수가 늘면 안 된다');

    // 세션 상태 가드도 신규 주문을 거부해야 한다.
    let blocked = false;
    try {
        await assertSessionTradable(db, sessionId);
    } catch (e: any) {
        blocked = true;
        step(`    세션 상태 가드: ${e.message}`);
    }
    ok(blocked, '정산 이후 세션은 신규 주문 불가 상태여야 한다');

    // 살아있는 미체결 주문도 남아 있으면 안 된다.
    const live = await db.inverseOrder.findMany({
        where: { sessionId, status: { in: ['PENDING', 'PARTIAL'] } },
    });
    eq(live.length, 0, '정산 후 미체결 주문 건수');

    // 화면 경고 배너 판정에 쓰는 값도 함께 확인
    const snap = await getStatusSnapshot(db, sessionId, { now: () => kst(15, 40) });
    eq(snap.today.settlementFailed, false, '정산 실패 경고 플래그');
    resetEngineState();
});

// ─────────────────────────────────────────────────────────────
// ⑦ 강제정산 후 보유수량 0 + DailyStat 성공 기록
// ─────────────────────────────────────────────────────────────

test(7, '강제정산 후 보유수량이 0이 되고 DailyStat 에 성공으로 기록되는가', async () => {
    const { db, feed, strategy, sessionId } = await makeFixture({ bidPrice: 5000, askPrice: 5005 });
    const broker = (strategy as any).broker;

    // 250주를 보유한 채 미체결 주문 2건이 걸려 있는 상태에서 정산에 들어간다.
    await db.inversePosition.create({
        data: { sessionId, symbol: SYMBOL, qty: 250, avgPrice: 4990, realizedPnl: 0, unrealizedPnl: 0 },
    });
    await strategy.submitOrder({ sessionId, symbol: SYMBOL, side: 'BUY', limitPrice: 4985, qty: 100, reason: 'TEST_OPEN_BUY' });
    await strategy.submitOrder({ sessionId, symbol: SYMBOL, side: 'SELL', limitPrice: 5020, qty: 100, reason: 'TEST_OPEN_SELL' });
    const liveBefore = await db.inverseOrder.findMany({
        where: { sessionId, status: { in: ['PENDING', 'PARTIAL'] } },
    });
    eq(liveBefore.length, 2, '정산 전 미체결 주문 건수');
    step('    보유 250주 + 미체결 2건 상태에서 강제정산 시작');

    feed.set({ bidPrice: 5000, askPrice: 5005, bidQty: 1000 });
    const result = await runForceSettlement({
        db,
        broker,
        sessionId,
        symbol: SYMBOL,
        closeBufferMin: 10,
        now: () => kst(15, 25),
        logger: (m, meta) => step(`      [정산] ${m}${meta ? ' ' + JSON.stringify(meta) : ''}`),
    });

    eq(result.startQty, 250, '정산 시작 보유수량');
    eq(result.remainingQty, 0, '정산 후 잔여수량');
    eq(result.success, true, `강제정산 성공 여부 (사유: ${result.reason})`);
    ok(result.canceledOrders >= 2, `정산 진입 시 미체결 2건이 취소돼야 한다(실제 ${result.canceledOrders}건)`);
    eq(result.soldQty, 250, '정산으로 처분한 수량');

    const pos = await db.inversePosition.findUnique({ where: { sessionId_symbol: { sessionId, symbol: SYMBOL } } });
    eq(pos?.qty, 0, 'DB 보유수량');

    const stat = result.dailyStat;
    ok(stat !== null, 'DailyStat 이 기록돼야 한다');
    eq(stat!.forceSettled, true, 'DailyStat.forceSettled');
    eq(stat!.closingQty, 0, 'DailyStat.closingQty');
    eq(stat!.sellQty, 250, 'DailyStat.sellQty');
    eq(stat!.realizedPnl, (5000 - 4990) * 250, 'DailyStat.realizedPnl(=(5000-4990)×250)');

    const liveAfter = await db.inverseOrder.findMany({
        where: { sessionId, status: { in: ['PENDING', 'PARTIAL'] } },
    });
    eq(liveAfter.length, 0, '정산 후 미체결 주문 건수');
    step(`    → 잔여 0주 / 실현손익 ${stat!.realizedPnl}원 / DailyStat forceSettled=true`);
});

// ─────────────────────────────────────────────────────────────
// 러너
// ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('인버스 ETF 1호가 스캘핑 — 시나리오 7종');
    console.log('시세 소스: 가상 호가 생성기(테스트는 고정호가 주입) — 증권사 API 호출 없음');
    console.log('매매 모드: SIMULATION 고정\n');

    let passed = 0;
    const failures: string[] = [];

    for (const c of cases) {
        steps.length = 0;
        const label = `[${c.no}] ${c.title}`;
        try {
            await c.fn();
            console.log(`  ✅ ${label}`);
            for (const s of steps) console.log(s);
            passed += 1;
        } catch (e: any) {
            console.log(`  ❌ ${label}`);
            for (const s of steps) console.log(s);
            console.log(`      실패: ${e?.message ?? String(e)}`);
            if (!(e instanceof AssertionError)) console.log(e?.stack ?? '');
            failures.push(label);
        }
    }

    console.log(`\n결과: ${passed}/${cases.length} 통과`);
    if (failures.length > 0) {
        console.log('실패:');
        for (const f of failures) console.log(`  - ${f}`);
        process.exitCode = 1;
    }
}

void main();
