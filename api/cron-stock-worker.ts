import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { findCorpCode, getRecentFilings, getFinancials, getCorpInfo, getNaverFinanceData } from './_lib/dartService.js';
import { uploadToGCS } from './_lib/storage.js';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export const maxDuration = 300;

const DISCLAIMER = `\n\n---\n> ⚠️ **투자 유의사항**: 이 보고서는 AI가 공개된 공시 자료를 바탕으로 자동 생성한 참고용 정보입니다. 투자 권유 또는 매수·매도 추천이 아니며, 투자 결과에 대한 책임은 투자자 본인에게 있습니다. 중요한 투자 결정 전 반드시 전문가 상담을 받으시기 바랍니다.`;

// ── AI 클라이언트 ────────────────────────────────────────────

function getGemini(): GoogleGenAI {
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
    const creds = JSON.parse(credsJson);
    return new GoogleGenAI({
        vertexai: true,
        project: creds.project_id || process.env.VERTEX_PROJECT_ID,
        location: 'us-central1',
        googleAuthOptions: { credentials: creds },
    });
}

function getClaude(): Anthropic {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    return new Anthropic({ apiKey });
}

function getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    return new OpenAI({ apiKey });
}

// ── 안전 래퍼 ────────────────────────────────────────────────

async function safeAnalyze(name: string, fn: () => Promise<string>): Promise<string | null> {
    try {
        return await fn();
    } catch (e) {
        console.warn(`[stock] ${name} 실패 (건너뜀): ${String(e).slice(0, 120)}`);
        return null;
    }
}

// ── 포맷 유틸 ────────────────────────────────────────────────

function fmt(n: number | undefined, unit = '') {
    if (n === undefined || n === null) return '—';
    return n.toLocaleString('ko-KR') + unit;
}

function fmtPct(n: number | undefined) {
    if (n === undefined || n === null) return '—';
    return (n * 100).toFixed(1) + '%';
}

// ── Claude 투자 의견 ─────────────────────────────────────────

async function getClaudeOpinion(stockName: string, dataSection: string): Promise<string> {
    const client = getClaude();
    const prompt = `당신은 국내 주식 전문 애널리스트입니다. 아래 데이터만을 기반으로 간결한 투자 의견을 작성하세요.

## 분석 대상: ${stockName}

${dataSection}

아래 마크다운 형식으로만 답변하세요:

### 투자의견
매수 (74점) — 핵심 근거 한 줄

※ 점수 기준: 강력매수 85~100 / 매수 65~84 / 중립 40~64 / 매도 20~39 / 강력매도 0~19
※ 반드시 "매수 (74점)" 형식으로 의견 뒤 괄호 안에 숫자만 표기

### 목표주가 추정
XX,000 ~ XX,000원

### 핵심 강점
-
-

### 핵심 리스크
-
-

### 종합 코멘트
2~3문장`;

    const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
    });
    return res.content[0].type === 'text' ? res.content[0].text : '';
}

// ── GPT-4o 투자 의견 ─────────────────────────────────────────

async function getGptOpinion(stockName: string, dataSection: string): Promise<string> {
    const client = getOpenAI();
    const prompt = `당신은 국내 주식 전문 애널리스트입니다. 아래 데이터만을 기반으로 간결한 투자 의견을 작성하세요.

## 분석 대상: ${stockName}

${dataSection}

아래 마크다운 형식으로만 답변하세요:

### 투자의견
매수 (74점) — 핵심 근거 한 줄

※ 점수 기준: 강력매수 85~100 / 매수 65~84 / 중립 40~64 / 매도 20~39 / 강력매도 0~19
※ 반드시 "매수 (74점)" 형식으로 의견 뒤 괄호 안에 숫자만 표기

### 목표주가 추정
XX,000 ~ XX,000원

### 핵심 강점
-
-

### 핵심 리스크
-
-

### 종합 코멘트
2~3문장`;

    const res = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [
            { role: 'system', content: '당신은 한국 증권 시장 전문 애널리스트입니다.' },
            { role: 'user', content: prompt },
        ],
    });
    return res.choices[0]?.message?.content || '';
}

// ── 메인 분석 함수 ────────────────────────────────────────────

async function analyzeStock(taskId: number, stockName: string): Promise<void> {
    console.log(`[stock] 시작: id=${taskId}, stock=${stockName}`);
    await prisma.stockAnalysis.update({ where: { id: taskId }, data: { status: 'processing' } });

    // 1단계: DART 기업 코드 조회
    const corpCode = await findCorpCode(stockName);
    if (corpCode) await prisma.stockAnalysis.update({ where: { id: taskId }, data: { corpCode } });

    // 2단계: DART + 네이버 금융 병렬 수집
    let filings: any[] = [];
    let financials: any[] = [];
    let corpInfo: any = null;
    let naver: any = null;

    const dartPromise = corpCode
        ? Promise.all([getRecentFilings(corpCode, 6), getFinancials(corpCode), getCorpInfo(corpCode)])
            .then(([f, fin, ci]) => { filings = f; financials = fin; corpInfo = ci; })
        : Promise.resolve();

    const stockCode = corpCode
        ? await prisma.corpCode.findUnique({ where: { corpCode }, select: { stockCode: true } }).then(r => r?.stockCode?.trim() || null)
        : null;

    const naverPromise = stockCode
        ? getNaverFinanceData(stockCode).then(n => { naver = n; })
        : Promise.resolve();

    await Promise.all([dartPromise, naverPromise]);
    console.log(`[stock] 공시 ${filings.length}건, 재무 ${financials.length}건, Naver: ${naver?.stockName ?? '없음'}`);

    // 3단계: 텍스트 구성
    const filingsText = filings.length
        ? filings.map(f => `- ${f.rcept_dt} [${f.report_nm}] 제출자: ${f.flr_nm}`).join('\n')
        : '최근 공시 없음';

    const financialsText = financials.length
        ? financials.map(f => `| ${f.account_nm} | ${fmt(Number(f.thstrm_amount || 0), '원')} | ${fmt(Number(f.frmtrm_amount || 0), '원')} |`).join('\n')
        : '재무 데이터 없음';

    const naverText = naver ? `
### 실시간 시장 데이터 (네이버 금융: ${naver.stockName} ${stockCode})
| 항목 | 값 |
|------|-----|
| 현재 주가 | ${fmt(naver.currentPrice, '원')} (${naver.changePercent != null ? (naver.changePercent >= 0 ? '+' : '') + naver.changePercent.toFixed(2) + '%' : '—'}) |
| 52주 최고 | ${fmt(naver.week52High, '원')} |
| 52주 최저 | ${fmt(naver.week52Low, '원')} |
| 시가총액 | ${naver.marketCapEok != null ? naver.marketCapEok.toLocaleString('ko-KR') + '억원' : '—'} |
| PER | ${naver.per != null ? naver.per.toFixed(2) + '배' : '—'} |
| 컨센서스 PER | ${naver.cnsPer != null ? naver.cnsPer.toFixed(2) + '배' : '—'} |
| PBR | ${naver.pbr != null ? naver.pbr.toFixed(2) + '배' : '—'} |
| EPS | ${fmt(naver.eps, '원')} |
| 컨센서스 EPS | ${fmt(naver.cnsEps, '원')} |
| 외국인 보유 | ${naver.foreignRate ?? '—'} |` : '### 실시간 시장 데이터\n조회 불가 (비상장 또는 네이버 금융 미지원)';

    const researchText = naver?.researches?.length ? `
### 최신 증권사 리포트
${naver.researches.map((r: any) => `- [${r.date.slice(0,4)}.${r.date.slice(4,6)}.${r.date.slice(6,8)}] **${r.broker}** — ${r.title}`).join('\n')}` : '';

    // Claude/GPT에 전달할 구조화 데이터
    const dataSection = `${naverText}
${researchText}

### 최근 공시 (${filings.length}건)
${filingsText}

### 재무제표 (직전 연도)
| 항목 | 당기 | 전기 |
|------|------|------|
${financialsText}`;

    // Gemini용 전체 보고서 프롬프트
    const geminiPrompt = `당신은 국내 증권사 수준의 전문 주식 애널리스트입니다. 아래 데이터를 바탕으로 한국 개인 투자자들이 실제로 활용할 수 있는 심층 주식 분석 보고서를 작성하세요.

---
## 수집된 데이터

### 기업 정보 (DART)
- 기업명: ${corpInfo?.corp_name ?? stockName}
- 업종코드: ${corpInfo?.induty_code ?? '—'}
- 설립일: ${corpInfo?.est_dt ?? '—'}
- 상장일: ${corpInfo?.listing_dt ?? '—'}

${dataSection}

---
## 보고서 작성 지침

Google Search로 ${stockName}의 최신 뉴스, 증권사 리포트, 목표주가, 수급 동향을 추가 수집한 후 아래 형식으로 작성하세요.

# ${stockName} 주식 분석 보고서
> 분석일: ${new Date().toLocaleDateString('ko-KR')} | 데이터 출처: DART 공시, 네이버 금융, Google Search

## 📊 투자 요약
| 구분 | 내용 |
|------|------|
| 투자의견 | **매수 (74점)** — 근거 한 줄 (점수기준: 강력매수 85~100 / 매수 65~84 / 중립 40~64 / 매도 20~39 / 강력매도 0~19) |
| 목표주가 | 증권사 평균 또는 AI 추정 범위 (예: 85,000 ~ 95,000원) |
| 현재주가 | 위 데이터 기준 |
| 상승여력 | 현재가 대비 목표주가 괴리율 |
| 핵심 리스크 | 한 줄 요약 |

## 1. 기업 개요
(사업 모델, 주요 제품/서비스, 경쟁 우위 2~3개)

## 2. 실적 & 재무 분석
- DART 재무제표 수치를 중심으로 매출/영업이익/순이익 추이 분석
- PER/PBR/ROE를 동종업계 평균과 비교
- 부채비율, 유동비율 등 재무 건전성 코멘트

## 3. 최근 주요 공시 & 이슈
- 공시 내용 요약 및 주가 영향 분석

## 4. 기술적 분석
- 52주 최고/최저 대비 현재 위치 (%)
- 주요 지지/저항 구간
- 최근 주가 흐름 요약 (Google Search 활용)

## 5. 최신 뉴스 & 시장 동향
- 최근 1개월 주요 뉴스 3~5건 (날짜 포함)
- 기관/외인 수급 동향 (파악 가능한 경우)
- 증권사 최신 리포트 요약

## 6. 리스크 분석
| 리스크 | 내용 | 수준 |
|--------|------|------|
| 시장 리스크 | | 높음/중간/낮음 |
| 실적 리스크 | | 높음/중간/낮음 |
| 업종 리스크 | | 높음/중간/낮음 |
| 기타 리스크 | | 높음/중간/낮음 |

## 7. 종합 의견
(투자의견 재확인, 단기/중기/장기 관점, 투자자 유형별 조언)`;

    // 4단계: Gemini(검색 포함) + Claude + GPT 병렬 실행
    const ai = getGemini();
    const [geminiResponse, claudeOpinion, gptOpinion] = await Promise.all([
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: geminiPrompt }] }],
            config: { tools: [{ googleSearch: {} }] },
        }),
        safeAnalyze('Claude', () => getClaudeOpinion(stockName, dataSection)),
        safeAnalyze('GPT-4o', () => getGptOpinion(stockName, dataSection)),
    ]);

    const geminiReport = geminiResponse.text ?? '';
    console.log(`[stock] Gemini 완료 ${geminiReport.length}자, Claude: ${claudeOpinion ? 'OK' : '실패'}, GPT: ${gptOpinion ? 'OK' : '실패'}`);

    // 5단계: 보고서 합산
    let combinedReport = geminiReport;
    if (claudeOpinion) combinedReport += `\n\n---\n\n## 🤖 Claude Sonnet 투자 의견\n\n${claudeOpinion}`;
    if (gptOpinion) combinedReport += `\n\n---\n\n## 🤖 GPT-4o 투자 의견\n\n${gptOpinion}`;
    combinedReport += DISCLAIMER;

    // 6단계: 소스 링크 추출
    const sources: string[] = [];
    const candidates = (geminiResponse as any).candidates;
    if (candidates?.[0]?.groundingMetadata?.groundingChunks) {
        for (const chunk of candidates[0].groundingMetadata.groundingChunks) {
            if (chunk.web?.uri) sources.push(chunk.web.uri);
        }
    }

    // 7단계: 차트 이미지 저장
    let chartImageUrl: string | null = null;
    if (stockCode) {
        try {
            const imgRes = await fetch(
                `https://ssl.pstatic.net/imgfinance/chart/mobile/candle/day/${stockCode}_end.png`,
                { headers: { Referer: 'https://finance.naver.com/' } }
            );
            if (imgRes.ok) {
                const buf = Buffer.from(await imgRes.arrayBuffer());
                chartImageUrl = await uploadToGCS(buf, `stock-charts/${taskId}_${stockCode}.png`, 'image/png');
            }
        } catch (e) {
            console.warn(`[stock] 차트 이미지 저장 실패: ${e}`);
        }
    }

    await prisma.stockAnalysis.update({
        where: { id: taskId },
        data: {
            status: 'completed',
            analysisReport: combinedReport,
            claudeReport: claudeOpinion,
            gptReport: gptOpinion,
            sourceLinks: JSON.stringify(sources),
            yahooSymbol: stockCode ? `${stockCode}.KS` : null,
            chartImageUrl,
            updatedAt: new Date(),
        },
    });
    console.log(`[stock] 완료: id=${taskId}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const pending = await prisma.stockAnalysis.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 3,
    });
    if (pending.length === 0) return res.status(200).json({ processed: 0 });

    const results = await Promise.allSettled(
        pending.map(task => analyzeStock(task.id, task.stockName).catch(e => {
            console.error(`[stock] 오류 id=${task.id}:`, e?.message || e);
            return prisma.stockAnalysis.update({
                where: { id: task.id },
                data: { status: 'failed', errorMessage: e?.message || '알 수 없는 오류' },
            });
        }))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    return res.status(200).json({ processed: pending.length, succeeded });
}
