/**
 * 테스트용 고정 호가 피드.
 *
 * SimulatedQuoteFeed 는 난수로 호가를 움직이므로 "매수호가 -1호가에 주문이 났는가",
 * "부분체결 30주만 났는가" 같은 판정에 쓸 수 없다. 그래서 테스트에서는 호가를
 * 손으로 놓을 수 있는 이 피드를 브로커에 주입한다.
 *
 * ★QuoteFeed 인터페이스는 실제 코드와 동일하다 — 브로커·전략은 이걸 시뮬레이션
 *   피드와 구분하지 못하며, 체결 판정 로직은 전부 실제 SimulationBroker 가 한다.
 */

import type { Quote } from '../../api/_lib/inverse-trader/broker.js';
import type { QuoteFeed } from '../../api/_lib/inverse-trader/quote-feed.js';
import { QUOTE_SOURCE_SIMULATED } from '../../api/_lib/inverse-trader/constants.js';

export interface StaticBook {
    bidPrice: number;
    askPrice: number;
    bidQty: number;
    askQty: number;
    lastPrice?: number;
}

export class StaticQuoteFeed implements QuoteFeed {
    private book: StaticBook;

    constructor(book: StaticBook) {
        this.book = { ...book };
    }

    /** 호가를 통째로 갈아끼운다(다음 틱의 시장 상황). */
    set(book: Partial<StaticBook>): void {
        this.book = { ...this.book, ...book };
    }

    async getQuote(symbol: string): Promise<Quote> {
        const b = this.book;
        return {
            symbol,
            bidPrice: b.bidPrice,
            bidQty: b.bidQty,
            askPrice: b.askPrice,
            askQty: b.askQty,
            lastPrice: b.lastPrice ?? b.bidPrice,
            ts: new Date(),
            source: `${QUOTE_SOURCE_SIMULATED} / 테스트 고정호가`,
        };
    }
}
