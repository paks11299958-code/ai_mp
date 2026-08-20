/**
 * 실시세 호가 피드 — 네이버 금융 폴링 API 기반.
 *
 * ★★ 한계를 먼저 밝힌다(2026-08-20 확인). ★★
 *  네이버·다음 모두 **호가창(매수/매도 1호가와 잔량)을 무료로 주지 않는다.**
 *  받을 수 있는 것은 현재가·시가·고가·저가·거래량뿐이다.
 *  그래서 이 피드는 **현재가에서 호가를 근사**한다:
 *      bid = 현재가, ask = 현재가 + 1틱
 *
 *  근사가 성립하는 근거: KODEX 200선물인버스2X 는 1호가 잔량이 1.5억~3억주로
 *  유동성이 매우 좋아 실제 스프레드가 1틱에 붙어 있다(실측 호가창 확인).
 *
 *  ★그러나 **잔량은 알 수 없다.** 실제로는 내 주문 앞에 수억 주가 줄 서 있어
 *  1호가에 걸어둬도 체결되지 않는 경우가 많은데, 이 피드는 그것을 모른다.
 *  → **실제보다 체결이 후하게 나온다.** 결과를 볼 때 반드시 감안할 것.
 *
 *  진짜 호가가 필요하면 증권사 API(한국투자증권 등) 연동이 필요하다.
 */

import type { Quote } from './broker.js';
import type { QuoteFeed } from './quote-feed.js';
import { ETF_TICK_BANDS, getTickSize } from './strategy.js';

const POLL_URL = 'https://polling.finance.naver.com/api/realtime/domestic/stock/';

/** 시세 출처 표기 — 가상 생성기와 반드시 구분되어야 한다. */
export const QUOTE_SOURCE_NAVER = '네이버 실시세(REAL) / 호가는 현재가 근사';

export interface NaverQuoteFeedOptions {
    /** 같은 종목을 이 밀리초 안에 다시 물으면 캐시를 준다. 기본 5초 */
    cacheMs?: number;
    /** 네트워크 타임아웃(ms). 기본 8초 */
    timeoutMs?: number;
}

export interface MarketSnapshot {
    price: number;
    open: number;
    high: number;
    low: number;
    prevClose: number;
    /** 'OPEN' 이면 장중 */
    marketStatus: string;
    volume: number;
    name: string;
    at: Date;
}

interface CacheEntry {
    snap: MarketSnapshot;
    at: number;
}

export class NaverQuoteFeed implements QuoteFeed {
    readonly source = QUOTE_SOURCE_NAVER;
    private readonly cacheMs: number;
    private readonly timeoutMs: number;
    private readonly cache = new Map<string, CacheEntry>();

    constructor(options: NaverQuoteFeedOptions = {}) {
        this.cacheMs = options.cacheMs ?? 5_000;
        this.timeoutMs = options.timeoutMs ?? 8_000;
    }

    /** 원시 시세 조회(호가 근사 전). 어드민 화면·알림에서도 쓴다. */
    async getSnapshot(symbol: string): Promise<MarketSnapshot> {
        const hit = this.cache.get(symbol);
        if (hit && Date.now() - hit.at < this.cacheMs) return hit.snap;

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
        let json: any;
        try {
            const res = await fetch(POLL_URL + encodeURIComponent(symbol), {
                signal: ctrl.signal,
                headers: { 'user-agent': 'Mozilla/5.0', referer: 'https://m.stock.naver.com/' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            json = await res.json();
        } finally {
            clearTimeout(timer);
        }

        const d = json?.datas?.[0];
        if (!d) throw new Error(`시세 응답에 종목 데이터가 없습니다: ${symbol}`);

        const n = (v: any) => {
            const x = Number(String(v ?? '').replace(/,/g, ''));
            return Number.isFinite(x) ? x : 0;
        };
        const snap: MarketSnapshot = {
            price: n(d.closePrice),
            open: n(d.openPrice),
            high: n(d.highPrice),
            low: n(d.lowPrice),
            prevClose: n(d.closePrice) - n(d.compareToPreviousClosePrice),
            marketStatus: String(d.marketStatus ?? ''),
            volume: n(d.accumulatedTradingVolume),
            name: String(d.stockName ?? symbol),
            at: new Date(),
        };
        if (!(snap.price > 0)) throw new Error(`시세 가격이 올바르지 않습니다: ${d.closePrice}`);

        this.cache.set(symbol, { snap, at: Date.now() });
        return snap;
    }

    /** 장중 여부. 시뮬레이션 루프가 장 밖에서 헛돌지 않게 한다. */
    async isMarketOpen(symbol: string): Promise<boolean> {
        const s = await this.getSnapshot(symbol);
        return s.marketStatus === 'OPEN';
    }

    async getQuote(symbol: string): Promise<Quote> {
        const s = await this.getSnapshot(symbol);
        const tick = getTickSize(s.price, ETF_TICK_BANDS);
        // ★잔량은 알 수 없다. 주문이 잔량에 막히는 상황을 흉내낼 수 없으므로
        //   충분히 큰 값을 넣는다 — 그래서 실제보다 체결이 잘 된다(위 주석 참고).
        const UNKNOWN_LEVEL_QTY = 100_000_000;
        return {
            symbol,
            bidPrice: s.price,
            bidQty: UNKNOWN_LEVEL_QTY,
            askPrice: s.price + tick,
            askQty: UNKNOWN_LEVEL_QTY,
            lastPrice: s.price,
            ts: s.at,
            source: this.source,
        };
    }
}
