/**
 * 인버스 1호가 스캘핑 — 실시세 페이퍼 트레이딩 러너.
 *
 * 실제 KODEX 200선물인버스2X 시세로 돌리고, 체결이 날 때마다 텔레그램으로 알린다.
 * ★주문은 메모리 안에서만 일어난다. 증권사 API를 호출하지 않는다(SIMULATION 고정).
 *
 * ★★ 한계 — 결과를 볼 때 반드시 감안할 것 ★★
 *  네이버가 **호가 잔량을 주지 않는다.** 그래서 "내 주문 앞에 수억 주가 줄 서 있어
 *  체결이 안 되는" 현실을 흉내내지 못하고, **실제보다 체결이 후하게 난다.**
 *  진짜 체결률이 필요하면 증권사 API 연동이 필요하다.
 *
 * 실행:
 *   npx tsx scripts/inverse-trader/live-paper.mts
 *   CAPITAL=10000000 STOP_LOSS_PCT=2 npx tsx scripts/inverse-trader/live-paper.mts
 */

import { readFileSync } from 'node:fs';
import { NaverQuoteFeed } from '../../api/_lib/inverse-trader/naver-quote-feed.js';
import { SimulationBroker } from '../../api/_lib/inverse-trader/simulation-broker.js';
import {
    planSessionStartOrder, planFollowUpOrders, ETF_TICK_BANDS, getTickSize,
} from '../../api/_lib/inverse-trader/strategy.js';
import {
    evaluateBuyGuard, evaluateSellGuard, evaluateStopLoss, evaluateAddBuyGuard,
} from '../../api/_lib/inverse-trader/guards.js';

// ── 설정 ─────────────────────────────────────────────────────────
const SYMBOL = process.env.SYMBOL || '252670';       // KODEX 200선물인버스2X
const CAPITAL = Number(process.env.CAPITAL || 10_000_000);
const SPLIT = Number(process.env.SPLIT || 10);        // 투자금을 몇 번에 나눠 넣나
const STOP_LOSS_PCT = Number(process.env.STOP_LOSS_PCT ?? 2);
const MAX_ADD_BUYS = Number(process.env.MAX_ADD_BUYS ?? 10);
const NO_ADD_BUY_BELOW_PCT = Number(process.env.NO_ADD_BUY_BELOW_PCT ?? 3);
const POLL_MS = Number(process.env.POLL_MS || 7_000);  // 네이버 폴링 주기와 맞춘다
const CLOSE_BUFFER_MIN = Number(process.env.CLOSE_BUFFER_MIN || 10);

// ── 텔레그램 (rag/.env 재사용) ───────────────────────────────────
function loadEnv(path: string): Record<string, string> {
    const out: Record<string, string> = {};
    try {
        for (const line of readFileSync(path, 'utf8').split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('#')) continue;
            const i = t.indexOf('=');
            if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        }
    } catch { /* 없으면 알림만 꺼진다 */ }
    return out;
}
const ENV = loadEnv('/home/paks11299958/rag/.env');
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ENV.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || ENV.TELEGRAM_CHAT_ID || '';

async function tg(text: string): Promise<void> {
    if (!TG_TOKEN || !TG_CHAT) { console.log('[텔레그램 미설정]', text); return; }
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT, text }),
        });
    } catch (e: any) {
        console.log('[텔레그램 실패]', e?.message);
    }
}

// ── 유틸 ─────────────────────────────────────────────────────────
const won = (n: number) => (n < 0 ? '-' : '+') + Math.abs(Math.round(n)).toLocaleString() + '원';
const num = (n: number) => Math.round(n).toLocaleString();
const kst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 19);
const kstMinutes = () => {
    const d = new Date(Date.now() + 9 * 3600_000);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const MARKET_CLOSE = 15 * 60 + 30;   // 15:30 KST

// ── 상태 ─────────────────────────────────────────────────────────
let position = 0;
let cashFlow = 0;
let buyCost = 0, buyQtyTotal = 0;
let buyFills = 0, sellFills = 0;
let entryPrice = 0;
let stopped = false;
let settled = false;

const feed = new NaverQuoteFeed({ cacheMs: 3_000 });
const broker = new SimulationBroker({ feed });
const sessionId = `live-${Date.now()}`;
const ctx = { symbol: SYMBOL, sessionId, bands: ETF_TICK_BANDS };

let ORDER_QTY = 0;   // 첫 시세를 본 뒤 확정
let MAX_POS = 0;

const avgPrice = () => (buyQtyTotal > 0 ? buyCost / buyQtyTotal : 0);
const realized = (px: number) => cashFlow + position * px;

function applyFill(side: string, price: number, qty: number): void {
    if (side === 'BUY') {
        position += qty; cashFlow -= price * qty;
        buyCost += price * qty; buyQtyTotal += qty; buyFills++;
    } else {
        position -= qty; cashFlow += price * qty; sellFills++;
    }
}

async function placeIntent(it: any, curPx: number): Promise<void> {
    let qty = Math.min(it.qty, ORDER_QTY);
    if (it.side === 'BUY') {
        const opens = await broker.getOpenOrders(SYMBOL);
        const pendingBuy = opens.filter(o => o.side === 'BUY')
                                .reduce((a, o) => a + o.remainingQty, 0);
        if (!evaluateBuyGuard({
            currentQty: position, pendingBuyQty: pendingBuy,
            requestedQty: qty, maxPositionQty: MAX_POS,
        }).allowed) return;
        if (!evaluateAddBuyGuard({
            buyFillCount: buyFills, maxAddBuys: MAX_ADD_BUYS,
            entryPrice, currentPrice: curPx, noAddBuyBelowPct: NO_ADD_BUY_BELOW_PCT,
        }).allowed) return;
    } else {
        const opens = await broker.getOpenOrders(SYMBOL);
        const pendingSell = opens.filter(o => o.side === 'SELL')
                                 .reduce((a, o) => a + o.remainingQty, 0);
        const g = evaluateSellGuard({
            currentQty: position, pendingSellQty: pendingSell,
            requestedQty: qty, allowShort: false,
        });
        if (!g.allowed || g.allowedQty <= 0) return;
        qty = g.allowedQty;
    }
    try {
        const r = await broker.placeOrder({
            symbol: SYMBOL, side: it.side, price: it.limitPrice, qty, clientTag: 'LIVE_PAPER',
        });
        for (const f of r.fills) await onFill(f);
    } catch { /* 호가단위·수량 거절은 조용히 넘긴다 */ }
}

async function onFill(f: any): Promise<void> {
    applyFill(f.side, f.fillPrice, f.fillQty);
    const emoji = f.side === 'BUY' ? '🔵 매수' : '🔴 매도';
    const pnl = realized(f.fillPrice);
    await tg(
        `${emoji} 체결\n` +
        `${f.fillPrice}원 × ${num(f.fillQty)}주 = ${won(f.fillPrice * f.fillQty)}\n\n` +
        `보유 ${num(position)}주 (평단 ${avgPrice().toFixed(1)}원)\n` +
        `평가손익 ${won(pnl)} (${(pnl / CAPITAL * 100).toFixed(2)}%)\n` +
        `체결 ${buyFills + sellFills}건 · ${kst()} KST`
    );
    console.log(`${kst()} ${emoji} ${f.fillPrice}원 ×${num(f.fillQty)} → 보유 ${num(position)} 손익 ${won(pnl)}`);
}

/** 보유 전량 청산(손절·마감정산 공용) */
async function liquidate(px: number, why: string): Promise<void> {
    for (const o of await broker.getOpenOrders(SYMBOL)) {
        try { await broker.cancelOrder(o.orderId); } catch { /* 이미 체결/취소 */ }
    }
    if (position > 0) {
        const r = await broker.placeOrder({
            symbol: SYMBOL, side: 'SELL', price: px, qty: position, clientTag: 'LIQUIDATE',
        });
        for (const f of r.fills) applyFill(f.side, f.fillPrice, f.fillQty);
        if (position > 0) { cashFlow += px * position; position = 0; }  // 잔량은 그 가격에 청산 가정
    }
    const pnl = cashFlow;
    await tg(
        `⚠️ ${why}\n\n` +
        `전량 청산 완료 · 보유 0주\n` +
        `당일 실현손익 ${won(pnl)} (${(pnl / CAPITAL * 100).toFixed(2)}%)\n` +
        `총 체결 ${buyFills + sellFills}건 (매수 ${buyFills} / 매도 ${sellFills})\n` +
        `${kst()} KST`
    );
    console.log(`${kst()} ★${why} → 손익 ${won(pnl)}`);
}

// ── 메인 루프 ────────────────────────────────────────────────────
async function main(): Promise<void> {
    const snap = await feed.getSnapshot(SYMBOL);
    const tick = getTickSize(snap.price, ETF_TICK_BANDS);
    ORDER_QTY = Math.max(1, Math.floor(CAPITAL / snap.price / SPLIT));
    MAX_POS = Math.floor(CAPITAL / snap.price);
    entryPrice = snap.price;

    await tg(
        `▶️ 인버스 스캘핑 페이퍼 시작\n\n` +
        `${snap.name} (${SYMBOL})\n` +
        `현재가 ${snap.price}원 · 전일 ${snap.prevClose}원 ` +
        `(${((snap.price / snap.prevClose - 1) * 100).toFixed(2)}%)\n` +
        `1틱 ${tick}원 = ${(tick / snap.price * 100).toFixed(2)}%\n\n` +
        `투자금 ${num(CAPITAL)}원\n` +
        `1회 주문 ${num(ORDER_QTY)}주 · 최대보유 ${num(MAX_POS)}주\n` +
        `손절 -${STOP_LOSS_PCT}% · 물타기 ${MAX_ADD_BUYS}회/-${NO_ADD_BUY_BELOW_PCT}%\n\n` +
        `※ 가상매매입니다. 실제 주문은 나가지 않습니다.\n` +
        `※ 호가 잔량을 알 수 없어 실제보다 체결이 잘 됩니다.`
    );

    const first = planSessionStartOrder(ctx, snap.price, ORDER_QTY);
    if (first) await placeIntent(first, snap.price);

    while (true) {
        await new Promise(r => setTimeout(r, POLL_MS));
        let s;
        try { s = await feed.getSnapshot(SYMBOL); } catch { continue; }

        if (s.marketStatus !== 'OPEN') {
            if (!settled) { settled = true; await liquidate(s.price, '장 종료 — 당일정산'); }
            break;
        }
        // 마감 버퍼 진입 → 강제 청산
        if (kstMinutes() >= MARKET_CLOSE - CLOSE_BUFFER_MIN) {
            if (!settled) { settled = true; await liquidate(s.price, `장 마감 ${CLOSE_BUFFER_MIN}분 전 — 강제정산`); }
            break;
        }
        // 손절
        if (!stopped && STOP_LOSS_PCT > 0 && position > 0) {
            const sl = evaluateStopLoss({
                avgPrice: avgPrice(), currentPrice: s.price,
                positionQty: position, stopLossPct: STOP_LOSS_PCT,
            });
            if (sl.triggered) {
                stopped = true;
                await liquidate(s.price, `손절 발동 (평단 ${avgPrice().toFixed(1)} → ${s.price}원, ${sl.changePct.toFixed(2)}%)`);
                break;
            }
        }

        const fills = await broker.matchOpenOrders(SYMBOL);
        for (const f of fills) {
            await onFill(f);
            for (const it of planFollowUpOrders(ctx, {
                side: f.side, fillPrice: f.fillPrice, fillQty: f.fillQty,
            })) await placeIntent(it, s.price);
        }
    }

    await tg(`⏹ 세션 종료 · 최종 손익 ${won(cashFlow)} (${(cashFlow / CAPITAL * 100).toFixed(2)}%)`);
}

main().catch(async (e) => {
    await tg(`❌ 페이퍼 트레이딩 오류\n${String(e?.message ?? e).slice(0, 300)}`);
    console.error(e);
    process.exit(1);
});
