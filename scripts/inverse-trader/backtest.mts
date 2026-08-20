/**
 * 인버스 1호가 스캘핑 — 하루치 백테스트.
 *
 * 목적: "이 전략이 초단타 스캘핑으로 돈이 되는가"를 숫자로 답한다.
 *
 * ★모킹이 아니다. 실제 전략 함수(planSessionStartOrder / planFollowUpOrders)와
 *   실제 SimulationBroker·체결 판정을 그대로 쓴다. 갈아끼우는 것은 **시장 시나리오**뿐이다.
 *   그래서 여기서 나온 손익은 어드민 탭에서 돌렸을 때와 같은 로직의 결과다.
 *
 * 스캘핑 관점에서 특별히 보는 것:
 *   - 하루 왕복 횟수(회전율) — 스캘핑은 횟수가 수익의 분모다
 *   - 1틱 이익 대비 **슬리피지·비용**이 남기는가
 *   - 하락 추세에서 포지션이 얼마나 쌓이고, 마감 청산에서 얼마를 토해내는가
 *
 * 실행: npx tsx scripts/inverse-trader/backtest.mts
 */

import { FakeInverseDb } from './fake-db.mts';
import { StaticQuoteFeed } from './static-feed.mts';
import { SimulationBroker } from '../../api/_lib/inverse-trader/simulation-broker.js';
import {
    planSessionStartOrder, planFollowUpOrders, ETF_TICK_BANDS, alignToTick,
} from '../../api/_lib/inverse-trader/strategy.js';
import { evaluateBuyGuard, evaluateSellGuard } from '../../api/_lib/inverse-trader/guards.js';
import { TICK_SIZE } from '../../api/_lib/inverse-trader/constants.js';

// ── 거래비용 가정 ────────────────────────────────────────────────
// 토스 국내주식 실측: 수수료 0 / 세금 0 (memory: project_toss_no_trading_cost).
// ETF는 매도 증권거래세도 면제다. 그래서 명시적 비용은 0으로 둔다.
// ★그러나 스캘핑의 진짜 비용은 수수료가 아니라 **슬리피지**다.
//   지정가가 체결되려면 상대 호가가 내 가격까지 와야 하는데, 100만주 같은 대량은
//   1호가 잔량을 넘겨 다음 호가까지 먹으며 체결된다(= 불리한 가격).
const FEE_RATE = 0;          // 수수료율(왕복 각각)
const TAX_RATE = 0;          // 매도 거래세율(ETF 면제)

interface Scenario {
    name: string;
    desc: string;
    /** 하루 동안의 중심가 경로(원). 각 원소가 1틱(시장 스텝) */
    path: number[];
    /** 최우선 호가 잔량(주). 주문수량이 이보다 크면 부분체결된다 */
    levelQty: number;
}

const ORDER_QTY = 1_000_000;
const BASE = 5_000;
const STEPS = 240;           // 하루 시장 스텝 수(대략 1.5분봉 × 6시간)

/** 시드 고정 난수 — 시나리오를 재현 가능하게 */
function rng(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** 추세 + 잡음으로 하루 가격 경로를 만든다 */
function makePath(seed: number, driftTicksPerDay: number, volTicks: number): number[] {
    const r = rng(seed);
    const drift = (driftTicksPerDay * TICK_SIZE) / STEPS;
    const out: number[] = [];
    let p = BASE;
    for (let i = 0; i < STEPS; i++) {
        p += drift + (r() - 0.5) * 2 * volTicks * TICK_SIZE;
        out.push(alignToTick(Math.max(BASE * 0.9, Math.min(BASE * 1.1, p)), ETF_TICK_BANDS));
    }
    return out;
}

const SCENARIOS: Scenario[] = [
    { name: '횡보',      desc: '추세 없음, 1틱 안팎 진동 — 스캘핑에 가장 유리',
      path: makePath(1, 0, 1.0), levelQty: 2_000_000 },
    { name: '완만한 상승', desc: '하루 +20틱(+2%)',
      path: makePath(2, 20, 1.0), levelQty: 2_000_000 },
    { name: '완만한 하락', desc: '하루 -20틱(-2%) — 매수만 계속 체결되는 구간',
      path: makePath(3, -20, 1.0), levelQty: 2_000_000 },
    { name: '급락',      desc: '하루 -60틱(-6%) — 최악의 경우',
      path: makePath(4, -60, 1.2), levelQty: 2_000_000 },
    { name: '횡보(얇은 호가)', desc: '횡보지만 잔량이 주문의 30% — 부분체결·슬리피지 발생',
      path: makePath(1, 0, 1.0), levelQty: 300_000 },
];

interface Result {
    scenario: string;
    fills: number;
    roundTrips: number;
    maxPosition: number;
    endPositionBeforeSettle: number;
    grossPnl: number;
    cost: number;
    netPnl: number;
    settleLoss: number;
    maxOpenOrders: number;
    blockedByCap: number;
    blockedByRisk: number;
}

async function runScenario(sc: Scenario, MAX_POS: number): Promise<Result> {
    const db = new FakeInverseDb();
    const sessionId = `bt-${sc.name}`;
    const symbol = '252670';
    const feed = new StaticQuoteFeed({
        bidPrice: sc.path[0], askPrice: sc.path[0] + TICK_SIZE,
        bidQty: sc.levelQty, askQty: sc.levelQty, lastPrice: sc.path[0],
    });
    // ★옵션 이름은 `feed` 다. `quoteFeed` 로 넘기면 **조용히 무시되고**
    //   기본 랜덤 호가 생성기가 쓰여, 내가 놓은 시나리오가 전혀 반영되지 않는다
    //   (체결 0건의 진범이었다. 에러도 경고도 없어서 시나리오 탓으로 오독하기 쉽다).
    const broker = new SimulationBroker({ feed });

    let position = 0;
    let cashFlow = 0;          // 매도 유입 - 매수 유출 (원)
    let fills = 0;
    let buyFills = 0, sellFills = 0;
    let maxPosition = 0;
    let cost = 0;

    const applyFill = (side: string, price: number, qty: number) => {
        // ★필드명을 잘못 읽으면 조용히 NaN이 퍼진다(FillRecord는 fillPrice/fillQty).
        if (!Number.isFinite(price) || !Number.isFinite(qty)) {
            throw new Error(`체결 값이 숫자가 아님: price=${price} qty=${qty}`);
        }
        fills++;
        if (side === 'BUY') { position += qty; cashFlow -= price * qty; buyFills++; }
        else { position -= qty; cashFlow += price * qty; sellFills++; }
        cost += price * qty * FEE_RATE + (side === 'SELL' ? price * qty * TAX_RATE : 0);
        maxPosition = Math.max(maxPosition, position);
    };

    // ① 세션 시작 주문
    //    ★시그니처는 (ctx, bidPrice, qty) — 위치 인자다. 객체로 넘기면 조용히
    //      limitPrice:null / qty:undefined 가 되어 체결 0건이 된다(실제로 당했다).
    const ctx = { symbol, sessionId, bands: ETF_TICK_BANDS };
    const first = planSessionStartOrder(ctx, sc.path[0], ORDER_QTY);
    // ★예외를 삼키지 않는다. 조용한 catch 때문에 "체결 0건"의 원인을
    //   시나리오 탓으로 오독할 뻔했다(실제로 인자 위치 버그였다).
    let rejected = 0;
    let maxOpenOrders = 0;
    let blockedByCap = 0;
    // ★미체결 주문 상한. 이 전략은 체결 1건마다 주문 2건을 낳아 취소 없이 쌓인다.
    //   상한이 없으면 주문 수가 폭증한다(실제로 힙 OOM으로 죽었다 — 전략의 성질이다).
    const MAX_OPEN = 200;
    const rejectReasons = new Map<string, number>();
    let blockedByRisk = 0;
    const placeIntent = async (it: any) => {
        // ★실제 운영 경로와 같은 가드를 태운다. 이게 없으면 보유가 무한히 불어나
        //   계좌에 있지도 않은 돈으로 매수한 결과가 나온다(처음에 5,600만주가 찍혔다).
        if (it.side === 'BUY') {
            const opens = await broker.getOpenOrders(symbol);
            const pendingBuy = opens.filter((o: any) => o.side === 'BUY')
                                    .reduce((a: number, o: any) => a + o.remainingQty, 0);
            const g = evaluateBuyGuard({
                currentQty: position, pendingBuyQty: pendingBuy,
                requestedQty: Math.min(it.qty, ORDER_QTY), maxPositionQty: MAX_POS,
            });
            if (!g.allowed) { blockedByRisk++; return null; }
        } else {
            // ★공매도 차단. 이걸 안 태우면 보유하지도 않은 물량을 팔아
            //   하루 수천억이라는 허구의 수익이 나온다(실제로 그렇게 찍혔다).
            const opens = await broker.getOpenOrders(symbol);
            const pendingSell = opens.filter((o: any) => o.side === 'SELL')
                                     .reduce((a: number, o: any) => a + o.remainingQty, 0);
            const g = evaluateSellGuard({
                currentQty: position, pendingSellQty: pendingSell,
                requestedQty: Math.min(it.qty, ORDER_QTY), allowShort: false,
            });
            if (!g.allowed || g.allowedQty <= 0) { blockedByRisk++; return null; }
            it = { ...it, qty: g.allowedQty };   // 보유 잔량에 맞춰 축소
        }
        const open = (await broker.getOpenOrders(symbol)).length;
        maxOpenOrders = Math.max(maxOpenOrders, open);
        if (open >= MAX_OPEN) { blockedByCap++; return null; }
        try {
            const r = await broker.placeOrder({
                symbol, side: it.side, price: it.limitPrice,
                qty: Math.min(it.qty, ORDER_QTY), clientTag: 'BT',
            });
            for (const f of r.fills) applyFill(f.side ?? it.side, f.fillPrice, f.fillQty);
            return r;
        } catch (e: any) {
            rejected++;
            const k = String(e?.message ?? e).slice(0, 60);
            rejectReasons.set(k, (rejectReasons.get(k) ?? 0) + 1);
            return null;
        }
    };
    if (first) await placeIntent(first);

    // ② 하루 진행 — 매 스텝마다 호가를 옮기고, 대기 주문을 매칭한다
    for (const px of sc.path) {
        feed.set({
            bidPrice: px, askPrice: px + TICK_SIZE,
            bidQty: sc.levelQty, askQty: sc.levelQty, lastPrice: px,
        });
        let matched: any[] = [];
        matched = await broker.matchOpenOrders(symbol);
        for (const f of matched) {
            applyFill(f.side, f.fillPrice, f.fillQty);
            // 체결 → 후속 주문 2건 (실제 전략 함수 그대로)
            const ups = planFollowUpOrders(ctx, {
                side: f.side, fillPrice: f.fillPrice, fillQty: f.fillQty,
            });
            for (const it of ups) await placeIntent(it);
        }
    }

    const endPositionBeforeSettle = position;

    // ③ 장 마감 강제청산 — 남은 물량을 최우선 매수호가에 던진다
    //    ★대량이면 1호가 잔량을 넘겨 다음 호가까지 먹으며 체결된다(슬리피지).
    //      잔량을 초과한 만큼은 1틱씩 불리하게 계산한다.
    const closePx = sc.path[sc.path.length - 1];
    let settleLoss = 0;
    if (position > 0) {
        const levels = Math.ceil(position / Math.max(1, sc.levelQty));
        let left = position, gross = 0;
        for (let i = 0; i < levels && left > 0; i++) {
            const q = Math.min(left, sc.levelQty);
            gross += (closePx - i * TICK_SIZE) * q;   // 호가를 타고 내려가며 판다
            left -= q;
        }
        settleLoss = closePx * position - gross;      // 슬리피지로 덜 받은 금액
        cashFlow += gross;
        cost += gross * (FEE_RATE + TAX_RATE);
        position = 0;
    }

    const grossPnl = cashFlow;
    if (rejected) {
        console.log(`   ⚠ 주문 거절 ${rejected}건:`,
            [...rejectReasons].map(([k,v])=>`${k}×${v}`).join(' | '));
    }
    return {
        scenario: sc.name,
        fills, roundTrips: Math.min(buyFills, sellFills),
        maxPosition, endPositionBeforeSettle,
        grossPnl, cost, netPnl: grossPnl - cost, settleLoss,
        maxOpenOrders, blockedByCap, blockedByRisk,
    };
}

// ── 실행 ─────────────────────────────────────────────────────────
const won = (n: number) => {
    const a = Math.abs(n);
    const u = a >= 1e8 ? [1e8,'억'] as const : a >= 1e4 ? [1e4,'만'] as const : [1,''] as const;
    const v = a / (u[0] as number);
    return (n < 0 ? '-' : '+') + (u[1] ? v.toFixed(1) + u[1] : Math.round(v).toLocaleString()) + '원';
};
const num = (n: number) => Math.round(n).toLocaleString();

console.log('='.repeat(80));
console.log('인버스 1호가 스캘핑 — 하루치 백테스트');
console.log(`주문 ${num(ORDER_QTY)}주 · 기준가 ${num(BASE)}원 · 1틱 ${TICK_SIZE}원 ` +
            `(= ${((TICK_SIZE/BASE)*100).toFixed(2)}%, 1회 왕복 최대 ${won(TICK_SIZE*ORDER_QTY)})`);
console.log(`거래비용: 수수료 0% / 거래세 0% (토스 실측, ETF 매도세 면제) — 비용은 슬리피지뿐`);
console.log('='.repeat(80));

// 최대보유 한도를 바꿔가며 비교한다 — 스캘핑에서 "얼마나 물릴 각오를 하는가"가 핵심 변수다.
const CAPS: [string, number][] = [
    ['보수 200만주(≈100억)', 2_000_000],
    ['기본 500만주(≈250억)', 5_000_000],
];

for (const [capName, cap] of CAPS) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`▣ 최대보유 ${capName}`);
    console.log('─'.repeat(80));
    console.log('시나리오              체결   왕복    최대보유       당일손익   비고');
    let sum = 0;
    for (const sc of SCENARIOS) {
        const r = await runScenario(sc, cap);
        sum += r.netPnl;
        const note = r.settleLoss > 0 ? `마감청산 ${won(-r.settleLoss)}` :
                     r.blockedByRisk ? `한도차단 ${num(r.blockedByRisk)}건` : '';
        console.log(
            sc.name.padEnd(20) + num(r.fills).padStart(6) + num(r.roundTrips).padStart(7) +
            num(r.maxPosition).padStart(12) + won(r.netPnl).padStart(14) + '   ' + note);
    }
    console.log('-'.repeat(80));
    console.log(`합계(5일 가정): ${won(sum)}`);
}
