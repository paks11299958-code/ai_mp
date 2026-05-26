import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { deleteFromGCS } from './_lib/storage.js';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { logAiUsage } from './_lib/aiUsage.js';

export const maxDuration = 300;

// ── AI 클라이언트 ────────────────────────────────────────────

function getGemini(): GoogleGenAI {
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set');
    const creds = JSON.parse(credsJson);
    return new GoogleGenAI({
        vertexai: true,
        project: creds.project_id,
        location: 'us-central1',
        googleAuthOptions: { credentials: creds },
    });
}

function getOpenAI(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    return new OpenAI({ apiKey });
}

// ── 안전 래퍼 ────────────────────────────────────────────────

async function safeAnalyze(name: string, fn: () => Promise<any>): Promise<any | null> {
    try {
        return await fn();
    } catch (e) {
        console.warn(`[used-item] ${name} 실패 (건너뜀): ${String(e).slice(0, 120)}`);
        return null;
    }
}

function guessMime(url: string): string {
    const u = url.toLowerCase();
    if (u.includes('.png')) return 'image/png';
    if (u.includes('.gif')) return 'image/gif';
    if (u.includes('.webp')) return 'image/webp';
    return 'image/jpeg';
}

// ── 가격 추정 프롬프트 (Claude/GPT용 간결 버전) ──────────────

function buildPricePrompt(itemHint: string | null): string {
    const hint = itemHint ? `사용자 입력 품목명: ${itemHint}\n` : '';
    return `${hint}위 사진을 보고 중고 거래 가격을 추정해주세요.

다음 JSON 형식으로만 답변하세요 (마크다운 코드블록 없이):
{
  "category": "스마트폰|노트북|태블릿|스마트워치|카메라|가전|게임기|의류|잡화|기타",
  "brand": "브랜드명 또는 null",
  "condition": "상|중|하",
  "suggestedPrice": 추천가격(정수, 원),
  "minPrice": 최저가(정수, 원),
  "maxPrice": 최고가(정수, 원)
}`;
}

// ── Gemini 2nd 가격 추정 (URL 방식) ─────────────────────────

async function getPriceFromGemini2nd(imageUrls: string[], itemHint: string | null): Promise<any> {
    const ai = getGemini();
    const imageParts = imageUrls.map(url => ({
        fileData: { fileUri: url, mimeType: guessMime(url) },
    }));
    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [...imageParts, { text: buildPricePrompt(itemHint) }] }],
    });
    const geminiMeta = (res as any).usageMetadata;
    if (geminiMeta) {
        await logAiUsage({
            service: 'gemini', model: 'gemini-2.5-flash', feature: 'used-item-price',
            promptTokens: geminiMeta.promptTokenCount ?? 0,
            completionTokens: geminiMeta.candidatesTokenCount ?? 0,
        });
    }
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

// ── GPT-4o 가격 추정 (URL 방식) ─────────────────────────────

async function getPriceFromOpenAI(imageUrls: string[], itemHint: string | null): Promise<any> {
    const client = getOpenAI();
    const imageContent = imageUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
    }));
    const res = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 400,
        messages: [
            { role: 'system', content: '당신은 중고 거래 전문 감정사입니다. 이미지를 보고 정확한 시세를 제시합니다.' },
            { role: 'user', content: [...imageContent, { type: 'text', text: buildPricePrompt(itemHint) }] },
        ],
    });
    await logAiUsage({
        service: 'openai', model: 'gpt-4o', feature: 'used-item',
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
    });
    const text = res.choices[0]?.message?.content || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

// ── 메인 분석 함수 ────────────────────────────────────────────

async function analyzeUsedItem(taskId: number): Promise<void> {
    console.log(`[used-item] 시작: id=${taskId}`);
    const listing = await prisma.usedItemListing.findUnique({ where: { id: taskId } });
    if (!listing) throw new Error('레코드 없음');

    await prisma.usedItemListing.update({ where: { id: taskId }, data: { status: 'processing' } });

    const imageUrls: string[] = JSON.parse(listing.imageUrls || '[]');
    if (!imageUrls.length) throw new Error('이미지가 없습니다');

    const urls = imageUrls.slice(0, 5);
    const ai = getGemini();
    const model = 'gemini-2.5-flash';

    // 1단계: Gemini Vision 상품 분석
    const imageParts = urls.map(url => ({
        fileData: { fileUri: url, mimeType: guessMime(url) },
    }));

    const itemHint = listing.itemName ? `사용자 입력 품목명: ${listing.itemName}\n` : '';
    const analysisPrompt = `${itemHint}위 사진을 보고 중고 거래용 상품 정보를 분석해주세요.

다음 JSON 형식으로만 답변하세요 (마크다운 코드블록 없이):
{
  "category": "스마트폰|노트북|태블릿|스마트워치|카메라|가전|게임기|의류|잡화|기타",
  "brand": "브랜드명 또는 null",
  "modelName": "모델명 또는 null",
  "condition": "상|중|하",
  "conditionDetail": "외관 상태 한 줄 설명",
  "visibleDamage": ["발견된 하자 목록, 없으면 빈 배열"],
  "includedItems": ["포함 구성품 목록, 모르면 빈 배열"],
  "confidence": 0.0에서 1.0 사이 숫자
}`;

    const analysisRes = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [...imageParts, { text: analysisPrompt }] }],
    });

    const analysisMeta = (analysisRes as any).usageMetadata;
    if (analysisMeta) {
        await logAiUsage({
            service: 'gemini', model: 'gemini-2.5-flash', feature: 'used-item',
            promptTokens: analysisMeta.promptTokenCount ?? 0,
            completionTokens: analysisMeta.candidatesTokenCount ?? 0,
        });
    }
    const analysisText = analysisRes.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let analysis: any = {};
    try {
        const clean = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        analysis = JSON.parse(clean);
    } catch {
        throw new Error('상품 분석 결과 파싱 실패: ' + analysisText.slice(0, 100));
    }

    // 2단계: Gemini 가격 + 판매글 생성 / Claude + GPT 가격 추정 병렬 실행
    const itemDesc = [
        analysis.brand, analysis.modelName,
        `상태: ${analysis.condition}`,
        analysis.conditionDetail,
        analysis.visibleDamage?.length ? `하자: ${analysis.visibleDamage.join(', ')}` : '',
        analysis.includedItems?.length ? `구성품: ${analysis.includedItems.join(', ')}` : '',
    ].filter(Boolean).join(', ');

    const listingPrompt = `중고 거래 플랫폼(당근마켓)에 올릴 판매글과 가격을 생성해주세요.

상품 정보: ${itemDesc}
${listing.itemName ? `사용자 입력: ${listing.itemName}` : ''}

다음 JSON 형식으로만 답변하세요 (마크다운 코드블록 없이):
{
  "suggestedPrice": 추천가격(정수, 원),
  "minPrice": 최저가(정수, 원),
  "maxPrice": 최고가(정수, 원),
  "priceReason": "가격 책정 근거 한 줄",
  "title": "판매 제목 (30자 이내, ~판매합니다 형식)",
  "description": "판매 본문 (자연스러운 한국어, 줄바꿈 포함, 상태→기능→구성품→거래방식 순, 100~200자)",
  "hashtags": ["#태그1", "#태그2", "#태그3"]
}`;

    const [listingRes, gemini2ndPrice, gptPrice] = await Promise.all([
        ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: listingPrompt }] }],
        }),
        safeAnalyze('Gemini-2nd', () => getPriceFromGemini2nd(urls, listing.itemName)),
        safeAnalyze('GPT-4o', () => getPriceFromOpenAI(urls, listing.itemName)),
    ]);

    const listingText = listingRes.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let listingData: any = {};
    try {
        const clean = listingText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        listingData = JSON.parse(clean);
    } catch {
        throw new Error('판매글 생성 결과 파싱 실패: ' + listingText.slice(0, 100));
    }

    // 3개 AI 가격 평균
    const prices = [
        listingData.suggestedPrice,
        gemini2ndPrice?.suggestedPrice,
        gptPrice?.suggestedPrice,
    ].filter((p): p is number => typeof p === 'number' && p > 0);

    const avgPrice = prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length / 100) * 100
        : listingData.suggestedPrice || null;

    console.log(`[used-item] 가격 — Gemini: ${listingData.suggestedPrice}, Gemini-2nd: ${gemini2ndPrice?.suggestedPrice ?? '실패'}, GPT: ${gptPrice?.suggestedPrice ?? '실패'}, 평균: ${avgPrice}`);

    await prisma.usedItemListing.update({
        where: { id: taskId },
        data: {
            status: 'completed',
            category: analysis.category || null,
            brand: analysis.brand || null,
            modelName: analysis.modelName || null,
            condition: analysis.condition || null,
            conditionDetail: analysis.conditionDetail || null,
            visibleDamage: JSON.stringify(analysis.visibleDamage || []),
            includedItems: JSON.stringify(analysis.includedItems || []),
            confidence: typeof analysis.confidence === 'number' ? analysis.confidence : null,
            suggestedPrice: avgPrice,
            claudePrice: gemini2ndPrice?.suggestedPrice || null,
            gptPrice: gptPrice?.suggestedPrice || null,
            minPrice: listingData.minPrice || null,
            maxPrice: listingData.maxPrice || null,
            priceReason: listingData.priceReason || null,
            aiTitle: listingData.title || null,
            aiDescription: listingData.description || null,
            aiHashtags: JSON.stringify(listingData.hashtags || []),
            finalTitle: listingData.title || null,
            finalPrice: avgPrice,
            finalDescription: listingData.description || null,
        },
    });

    await Promise.allSettled(imageUrls.map(url => deleteFromGCS(url)));
    console.log(`[used-item] 완료: id=${taskId}`);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    const pending = await prisma.usedItemListing.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 3,
    });

    if (!pending.length) return res.status(200).json({ processed: 0 });

    const results = await Promise.allSettled(pending.map(t => analyzeUsedItem(t.id)));

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'rejected') {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[used-item] 실패 id=${pending[i].id}: ${msg}`);
            await prisma.usedItemListing.update({
                where: { id: pending[i].id },
                data: { status: 'failed', errorMessage: msg },
            });
        }
    }

    return res.status(200).json({ processed: pending.length });
}
