import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { deleteFromGCS } from './_lib/storage.js';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
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

// ── URL에서 mimeType 추론 ─────────────────────────────────────

function guessMime(url: string): string {
    const u = url.toLowerCase();
    if (u.includes('.png')) return 'image/png';
    if (u.includes('.gif')) return 'image/gif';
    if (u.includes('.webp')) return 'image/webp';
    return 'image/jpeg';
}

// ── 프롬프트 ─────────────────────────────────────────────────

function buildPrompt(brandHint: string | null): string {
    const hint = brandHint ? `사용자 입력 브랜드: ${brandHint}\n` : '';
    return `${hint}위 사진들을 보고 명품 진위 여부를 분석해주세요.

다음 JSON 형식으로만 답변하세요 (마크다운 코드블록 없이):
{
  "brand": "브랜드명",
  "model": "모델명 또는 null",
  "score": 정품 가능성 0~100 숫자,
  "verdict": "정품가능" 또는 "위조의심" 또는 "전문감정권고",
  "points": [
    { "item": "체크 항목명", "result": "정상" 또는 "이상" 또는 "확인불가", "detail": "설명" }
  ],
  "summary": "전체 종합 의견 2~3줄"
}

체크 항목 예시: 로고 형태, 로고 위치, 스티칭 패턴, 하드웨어 색상/질감, 시리얼 넘버, 소재/질감, 봉제선, 안감, 태그, 지퍼

판정 기준:
- 정품가능: score 75 이상, 이상 항목 없음
- 전문감정권고: score 50~74, 일부 불확실
- 위조의심: score 49 이하, 명확한 이상 징후`;
}

// ── Gemini 분석 (URL 방식) ────────────────────────────────────

async function analyzeWithGemini(imageUrls: string[], brandHint: string | null): Promise<any> {
    const ai = getGemini();
    const imageParts = imageUrls.map(url => ({
        fileData: { fileUri: url, mimeType: guessMime(url) },
    }));

    const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [...imageParts, { text: buildPrompt(brandHint) }] }],
    });

    const geminiMeta = (res as any).usageMetadata;
    if (geminiMeta) {
        await logAiUsage({
            service: 'gemini', model: 'gemini-2.5-flash', feature: 'luxury',
            promptTokens: geminiMeta.promptTokenCount ?? 0,
            completionTokens: geminiMeta.candidatesTokenCount ?? 0,
        });
    }
    const text = res.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

// ── Claude 분석 (URL 방식) ────────────────────────────────────

async function analyzeWithClaude(imageUrls: string[], brandHint: string | null): Promise<any> {
    const client = getClaude();

    const imageBlocks = imageUrls.map(url => ({
        type: 'image' as const,
        source: { type: 'url' as const, url },
    }));

    const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{
            role: 'user',
            content: [...imageBlocks, { type: 'text', text: buildPrompt(brandHint) }],
        }],
    });

    await logAiUsage({
        service: 'anthropic', model: 'claude-sonnet-4-6', feature: 'luxury',
        promptTokens: res.usage?.input_tokens ?? 0,
        completionTokens: res.usage?.output_tokens ?? 0,
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

// ── GPT-4o 분석 (URL 방식) ───────────────────────────────────

async function analyzeWithOpenAI(imageUrls: string[], brandHint: string | null): Promise<any> {
    const client = getOpenAI();

    const imageContent = imageUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
    }));

    const res = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        messages: [
            {
                role: 'system',
                content: '당신은 명품 브랜드 인증 전문가입니다. 사진을 보고 정품 품질 기준에 따라 객관적으로 감정합니다.',
            },
            {
                role: 'user',
                content: [...imageContent, { type: 'text', text: buildPrompt(brandHint) }],
            },
        ],
    });

    await logAiUsage({
        service: 'openai', model: 'gpt-4o', feature: 'luxury',
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
    });
    const text = res.choices[0]?.message?.content || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
}

// ── 안전 래퍼 (개별 AI 실패 허용) ────────────────────────────

async function safeAnalyze(
    name: string,
    fn: () => Promise<any>,
): Promise<any | null> {
    try {
        return await fn();
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[luxury] ${name} 실패 (건너뜀): ${msg.slice(0, 120)}`);
        return null;
    }
}

// ── 결과 비교 (3중 AI, null 허용) ────────────────────────────

function compareResults(gemini: any | null, claude: any | null, gpt: any | null) {
    const available = [
        gemini ? { name: 'Gemini', data: gemini } : null,
        claude  ? { name: 'Claude',  data: claude  } : null,
        gpt     ? { name: 'GPT-4o', data: gpt     } : null,
    ].filter(Boolean) as { name: string; data: any }[];

    const allItems = new Set(
        available.flatMap(({ data }) => (data.points || []).map((p: any) => p.item)),
    );

    const agreements: string[] = [];
    const disagreements: string[] = [];

    for (const item of allItems) {
        const hits = available.map(({ name, data }) => {
            const p = (data.points || []).find((pp: any) => pp.item === item);
            return p ? { name, result: p.result } : null;
        }).filter(Boolean) as { name: string; result: string }[];

        if (hits.length < 2) continue;

        if (hits.every(h => h.result === hits[0].result)) {
            agreements.push(`${item}: ${hits[0].result}`);
        } else {
            disagreements.push(`${item} — ${hits.map(h => `${h.name}: ${h.result}`).join(' / ')}`);
        }
    }

    const scores = available.map(({ data }) => data.score || 0);
    const finalScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    let finalVerdict: string;
    if (finalScore >= 75 && disagreements.length === 0) {
        finalVerdict = '정품가능';
    } else if (finalScore < 50 || disagreements.length >= 3) {
        finalVerdict = '위조의심';
    } else {
        finalVerdict = '전문감정권고';
    }

    return { finalScore, finalVerdict, agreements, disagreements };
}

// ── 메인 분석 함수 ────────────────────────────────────────────

async function analyzeLuxury(taskId: number): Promise<void> {
    console.log(`[luxury] 시작: id=${taskId}`);
    const task = await prisma.luxuryVerification.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('레코드 없음');

    await prisma.luxuryVerification.update({ where: { id: taskId }, data: { status: 'processing' } });

    const imageUrls: string[] = JSON.parse(task.imageUrls || '[]');
    if (!imageUrls.length) throw new Error('이미지가 없습니다');

    const urls = imageUrls.slice(0, 8);

    // Gemini + Claude + GPT-4o 병렬 실행 (개별 실패 허용)
    const [geminiResult, claudeResult, gptResult] = await Promise.all([
        safeAnalyze('Gemini', () => analyzeWithGemini(urls, task.brandHint)),
        safeAnalyze('Claude', () => analyzeWithClaude(urls, task.brandHint)),
        safeAnalyze('GPT-4o', () => analyzeWithOpenAI(urls, task.brandHint)),
    ]);

    if (!geminiResult && !claudeResult && !gptResult) {
        throw new Error('모든 AI 분석 실패');
    }

    if (geminiResult) console.log(`[luxury] Gemini: ${geminiResult.score}점 ${geminiResult.verdict}`);
    if (claudeResult) console.log(`[luxury] Claude: ${claudeResult.score}점 ${claudeResult.verdict}`);
    if (gptResult)    console.log(`[luxury] GPT-4o: ${gptResult.score}점 ${gptResult.verdict}`);

    const { finalScore, finalVerdict, agreements, disagreements } = compareResults(geminiResult, claudeResult, gptResult);

    await prisma.luxuryVerification.update({
        where: { id: taskId },
        data: {
            status: 'completed',
            geminiBrand:  geminiResult?.brand   || null,
            geminiModel:  geminiResult?.model   || null,
            geminiScore:  geminiResult?.score   || null,
            geminiPoints: JSON.stringify(geminiResult?.points || []),
            geminiVerdict: geminiResult?.verdict || null,
            geminiSummary: geminiResult?.summary || null,
            claudeBrand:  claudeResult?.brand   || null,
            claudeModel:  claudeResult?.model   || null,
            claudeScore:  claudeResult?.score   || null,
            claudePoints: JSON.stringify(claudeResult?.points || []),
            claudeVerdict: claudeResult?.verdict || null,
            claudeSummary: claudeResult?.summary || null,
            gptBrand:  gptResult?.brand   || null,
            gptModel:  gptResult?.model   || null,
            gptScore:  gptResult?.score   || null,
            gptPoints: JSON.stringify(gptResult?.points || []),
            gptVerdict: gptResult?.verdict || null,
            gptSummary: gptResult?.summary || null,
            finalScore,
            finalVerdict,
            agreements: JSON.stringify(agreements),
            disagreements: JSON.stringify(disagreements),
        },
    });

    // 분석 완료 후 GCS 이미지 삭제
    await Promise.allSettled(imageUrls.map(url => deleteFromGCS(url)));
    console.log(`[luxury] 완료: id=${taskId} 종합 ${finalScore}점 ${finalVerdict}`);
}

// ── Cron 핸들러 ──────────────────────────────────────────────

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    const pending = await prisma.luxuryVerification.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        take: 3,
    });

    if (!pending.length) return res.status(200).json({ processed: 0 });

    const results = await Promise.allSettled(pending.map(t => analyzeLuxury(t.id)));

    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'rejected') {
            const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[luxury] 실패 id=${pending[i].id}: ${msg}`);
            await prisma.luxuryVerification.update({
                where: { id: pending[i].id },
                data: { status: 'failed', errorMessage: msg },
            });
        }
    }

    return res.status(200).json({ processed: pending.length });
}
