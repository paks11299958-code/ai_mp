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
    // 한글명 정확히 일치
    const exact = await prisma.corpCode.findFirst({ where: { corpName: stockName } });
    if (exact) return exact.corpCode;

    // 영문명 정확히 일치 (대소문자 무시)
    const exactEng = await prisma.corpCode.findFirst({
        where: { corpNameEng: { equals: stockName, mode: 'insensitive' } },
    });
    if (exactEng) return exactEng.corpCode;

    // 한글명 부분 일치
    const partial = await prisma.corpCode.findFirst({
        where: { corpName: { contains: stockName } },
    });
    if (partial) return partial.corpCode;

    // 영문명 부분 일치
    const partialEng = await prisma.corpCode.findFirst({
        where: { corpNameEng: { contains: stockName, mode: 'insensitive' } },
    });
    if (partialEng) return partialEng.corpCode;

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

// 네이버 금융 주가·밸류에이션 데이터 (Yahoo Finance 대체 — crumb 인증 문제)
export async function getNaverFinanceData(stockCode: string): Promise<any> {
    const parseNum = (s: string | undefined): number | null => {
        if (!s || s === 'N/A') return null;
        const clean = s.replace(/[배원%,\s]/g, '');
        const n = parseFloat(clean);
        return isNaN(n) ? null : n;
    };
    const parseMarketCap = (s: string | undefined): number | null => {
        if (!s) return null;
        let total = 0;
        const jo = s.match(/([0-9,]+)조/);
        const eok = s.match(/([0-9,]+)억/);
        if (jo) total += parseInt(jo[1].replace(/,/g, '')) * 10000;
        if (eok) total += parseInt(eok[1].replace(/,/g, ''));
        return total || null;
    };
    try {
        const res = await fetch(`https://m.stock.naver.com/api/stock/${stockCode}/integration`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://m.stock.naver.com',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const infoMap: Record<string, string> = {};
        for (const item of data.totalInfos ?? []) {
            infoMap[item.code] = item.value ?? '';
        }
        return {
            stockCode,
            stockName: data.stockName,
            currentPrice: parseNum(data.closePrice),
            changePercent: parseNum(infoMap.fluctuationsRatio),
            week52High: parseNum(infoMap.highPriceOf52Weeks),
            week52Low: parseNum(infoMap.lowPriceOf52Weeks),
            marketCapEok: parseMarketCap(infoMap.marketValue),
            foreignRate: infoMap.foreignRate,
            per: parseNum(infoMap.per),
            eps: parseNum(infoMap.eps),
            cnsPer: parseNum(infoMap.cnsPer),
            cnsEps: parseNum(infoMap.cnsEps),
            pbr: parseNum(infoMap.pbr),
            bps: parseNum(infoMap.bps),
            researches: (data.researches ?? []).slice(0, 3).map((r: any) => ({
                broker: r.bnm,
                title: r.tit,
                date: r.wdt,
            })),
        };
    } catch {
        return null;
    }
}

// 계정명 정규화 맵 (DART 기업마다 표기가 다름)
const ACCOUNT_NORMALIZE: Record<string, string> = {
    '매출액': '매출액', '매출수익': '매출액', '영업수익': '매출액',
    '영업이익': '영업이익', '영업손익': '영업이익', '영업이익(손실)': '영업이익',
    '당기순이익': '당기순이익', '당기순이익(손실)': '당기순이익',
    '분기순이익': '당기순이익', '반기순이익': '당기순이익',
    '부채총계': '부채총계', '자본총계': '자본총계',
};

// 단일 재무제표 (연간) — 연결 우선, 없으면 별도
export async function getFinancials(corpCode: string): Promise<DartFinancial[]> {
    const year = new Date().getFullYear() - 1;
    for (const reprtCode of ['11011']) {  // 사업보고서
        for (const fsDiv of ['CFS', 'OFS']) {  // 연결(CFS) 우선, 별도(OFS) 차선
            try {
                const url = `${BASE}/fnlttSinglAcntAll.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprtCode}&fs_div=${fsDiv}`;
                const res = await fetch(url);
                const data = await res.json();
                if (data.status !== '000' || !data.list?.length) continue;
                const results: DartFinancial[] = [];
                const seen = new Set<string>();
                for (const r of data.list) {
                    const normalized = ACCOUNT_NORMALIZE[r.account_nm];
                    if (normalized && !seen.has(normalized)) {
                        seen.add(normalized);
                        results.push({ ...r, account_nm: normalized });
                    }
                }
                if (results.length >= 3) return results;
            } catch { continue; }
        }
    }
    return [];
}

// 기업 기본정보
export async function getCorpInfo(corpCode: string): Promise<any> {
    const url = `${BASE}/company.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.status === '000' ? data : null;
}
