import AdmZip from 'adm-zip';
import { prisma } from './prisma.js';

const DART_KEY = process.env.DART_API_KEY!;
const BASE = 'https://opendart.fss.or.kr/api';

export interface DartFiling {
    rcept_no: string;
    report_nm: string;
    rcept_dt: string;
    flr_nm: string;
    rm?: string;
}

export interface DartFinancial {
    account_nm: string;
    thstrm_amount: string;
    frmtrm_amount: string;
}

// DB에서 기업 코드 조회
export async function findCorpCode(stockName: string): Promise<string | null> {
    // 정확히 일치
    const exact = await prisma.corpCode.findFirst({ where: { corpName: stockName } });
    if (exact) return exact.corpCode;

    // 입력값 포함 (예: "레인보우" → "레인보우로보틱스")
    const partial = await prisma.corpCode.findFirst({
        where: { corpName: { contains: stockName } },
    });
    if (partial) return partial.corpCode;

    return null;
}

// corpCode.xml 다운로드 → DB upsert (어드민 갱신용)
export async function importCorpCodes(): Promise<number> {
    console.log('[dart] corpCode.xml 다운로드 중...');
    const url = `${BASE}/corpCode.xml?crtfc_key=${DART_KEY}`;
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();

    const zip = new AdmZip(Buffer.from(buffer));
    const xmlContent = zip.readAsText('CORPCODE.xml');

    const entries: { corpCode: string; corpName: string; stockCode: string | null; modifyDt: string }[] = [];
    for (const listMatch of xmlContent.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
        const block = listMatch[1];
        const corpCode = block.match(/<corp_code>(\d+)<\/corp_code>/)?.[1];
        const corpName = block.match(/<corp_name>([^<]+)<\/corp_name>/)?.[1]?.trim();
        const stockCode = block.match(/<stock_code>\s*([^<]*?)\s*<\/stock_code>/)?.[1]?.trim() || null;
        const modifyDt = block.match(/<modify_date>([^<]+)<\/modify_date>/)?.[1]?.trim() || '';
        if (corpCode && corpName) {
            entries.push({ corpCode, corpName, stockCode: stockCode || null, modifyDt });
        }
    }
    console.log(`[dart] 파싱 완료: ${entries.length}개`);

    // 기존 데이터 전체 삭제 후 bulk insert (upsert보다 10배 이상 빠름)
    await prisma.corpCode.deleteMany({});
    console.log('[dart] 기존 데이터 삭제 완료');

    const BATCH = 5000;
    for (let i = 0; i < entries.length; i += BATCH) {
        await prisma.corpCode.createMany({ data: entries.slice(i, i + BATCH) });
        console.log(`[dart] 진행: ${Math.min(i + BATCH, entries.length)}/${entries.length}`);
    }
    console.log(`[dart] DB insert 완료: ${entries.length}개`);
    return entries.length;
}

// 최근 공시 목록 — corp_code 있으면 날짜 제한 없음
export async function getRecentFilings(corpCode: string, count = 5): Promise<DartFiling[]> {
    const url = `${BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bgn_de=20230101&last_reprt_at=N&page_count=${count}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '000') return [];
    return (data.list ?? []).slice(0, count);
}

// Yahoo Finance 주가·밸류에이션 데이터 (KOSPI .KS / KOSDAQ .KQ 자동 탐색)
export async function getYahooFinanceData(stockCode: string): Promise<any> {
    for (const suffix of ['.KS', '.KQ']) {
        try {
            const symbol = encodeURIComponent(stockCode + suffix);
            const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price,summaryDetail,financialData,defaultKeyStatistics`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const json = await res.json();
            const result = json?.quoteSummary?.result?.[0];
            if (!result) continue;
            const p = result.price ?? {};
            const sd = result.summaryDetail ?? {};
            const fd = result.financialData ?? {};
            const ks = result.defaultKeyStatistics ?? {};
            return {
                symbol: stockCode + suffix,
                currentPrice: p.regularMarketPrice?.raw,
                changePercent: p.regularMarketChangePercent?.raw,
                marketCap: p.marketCap?.raw,
                week52High: sd.fiftyTwoWeekHigh?.raw,
                week52Low: sd.fiftyTwoWeekLow?.raw,
                per: sd.trailingPE?.raw,
                pbr: ks.priceToBook?.raw,
                roe: fd.returnOnEquity?.raw,
                eps: ks.trailingEps?.raw,
                revenueGrowth: fd.revenueGrowth?.raw,
            };
        } catch { continue; }
    }
    return null;
}

// 단일 재무제표 (연간)
export async function getFinancials(corpCode: string): Promise<DartFinancial[]> {
    const year = new Date().getFullYear() - 1;
    const url = `${BASE}/fnlttSinglAcnt.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== '000') return [];
    const targets = ['매출액', '영업이익', '당기순이익', '부채총계', '자본총계'];
    return (data.list ?? []).filter((r: any) => targets.includes(r.account_nm));
}

// 기업 기본정보
export async function getCorpInfo(corpCode: string): Promise<any> {
    const url = `${BASE}/company.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.status === '000' ? data : null;
}
