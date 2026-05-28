import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../_lib/auth.js';
import { searchMemories } from '../_lib/vectorStore.js';
import { generateEmbedding } from '../_lib/embedding.js';
import { GoogleGenAI } from '@google/genai';

// STAGES/getStage — 프론트와 동일
const STAGES = [
    { stage: 1, name: '언어의 씨앗',    minXp: 0    },
    { stage: 2, name: '문장의 메아리',  minXp: 30   },
    { stage: 3, name: '공명하는 펜',    minXp: 150  },
    { stage: 4, name: '지식의 조각사',  minXp: 500  },
    { stage: 5, name: '영혼의 투사자',  minXp: 1200 },
    { stage: 6, name: '진언의 지배자',  minXp: 2500 },
];
function getStage(xp: number) {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (xp >= STAGES[i].minXp) return STAGES[i];
    }
    return STAGES[0];
}

const YUNCHAEWON_ID = 'cmois970w0000xsvie6aag2f5';

function getAI() {
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

export async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    let userId: number;
    try {
        ({ userId } = verifyToken(token));
    } catch {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    const { personaId, text, sessionId, memoryEnabled, birthInfo } = req.body as {
        personaId: string;
        text: string;
        sessionId?: number;
        memoryEnabled?: boolean;
        birthInfo?: { name?: string; year?: string; month?: string; day?: string; time?: string; lunar?: boolean } | null;
    };
    if (!personaId || !text) return res.status(400).json({ error: 'personaId, text는 필수입니다.' });

    try {
        const [persona, userRow, commonCfg] = await Promise.all([
            prisma.persona.findUnique({ where: { id: personaId } }),
            prisma.user.findUnique({ where: { id: userId }, select: { personaXps: true } }),
            prisma.appConfig.findUnique({ where: { key: 'commonInstruction' } }),
        ]);
        if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

        const userXp = userRow?.personaXps.find(x => x.personaId === personaId)?.xp ?? 0;
        const userStage = getStage(userXp);

        // ── contextPrefix: 지식 + 기억 + 주식리포트 ──────────────────
        const embedding = await generateEmbedding(text).catch(() => null);
        let contextPrefix = '';

        // 페르소나 지식 검색
        if (embedding) {
            try {
                const knowledgeResults = await prisma.$queryRaw<{ content: string; similarity: number }[]>`
                    SELECT content, 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
                    FROM "PersonaKnowledge"
                    WHERE "personaId" = ${personaId}
                      AND embedding IS NOT NULL
                      AND 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > 0.5
                    ORDER BY similarity DESC
                    LIMIT 3
                `;
                if (knowledgeResults.length > 0) {
                    const kList = knowledgeResults.map(k => k.content).join('\n\n');
                    contextPrefix += `--- 참고 지식 (자연스럽게 활용, 출처 언급 금지) ---\n${kList}\n---\n\n`;
                }
            } catch {}
        }

        // 사용자 기억 검색
        if (memoryEnabled && embedding) {
            try {
                const memories = await searchMemories(userId, embedding, 5, 0.5);
                if (memories.length > 0) {
                    const memList = memories.map(m => `- ${m.content}`).join('\n');
                    contextPrefix += `--- 이 사용자 정보 (대화에 자연스럽게 반영. 사용자가 직접 묻는다면 알고 있음을 인정할 것) ---\n${memList}\n---\n\n`;
                }
            } catch {}
        }

        // 윤채원 주식 리포트 검색
        if (personaId === YUNCHAEWON_ID && embedding) {
            try {
                const stockResults = await prisma.$queryRaw<{ stockName: string; ticker: string; reportDate: string; content: string }[]>`
                    SELECT sc."stockName", sc."ticker", sc."reportDate", sc.content
                    FROM "StockReportChunk" sc
                    WHERE sc."userId" = ${userId}
                      AND sc.embedding IS NOT NULL
                      AND 1 - (sc.embedding <=> ${JSON.stringify(embedding)}::vector) > 0.4
                    ORDER BY 1 - (sc.embedding <=> ${JSON.stringify(embedding)}::vector) DESC
                    LIMIT 3
                `;
                if (stockResults.length > 0) {
                    const rList = stockResults.map(c => `[${c.stockName}(${c.ticker}) ${c.reportDate}]\n${c.content}`).join('\n\n');
                    contextPrefix += `--- 보유 종목 분석 리포트 (사용자가 저장한 주식 보고서, 관련 질문에 자연스럽게 활용) ---\n${rList}\n---\n\n`;
                }
            } catch {}
        }

        // ── systemInstruction 조합 ────────────────────────────────────
        const commonInstruction = commonCfg?.value || '';

        // 이미지 컨텍스트
        const mainImage = await prisma.personaImage.findFirst({
            where: { personaId, isMain: true },
        });
        const imageDesc = mainImage?.description || '';
        let imageContext = '';
        if (persona.identityPrompt) {
            imageContext = persona.identityPrompt.replace('{imageDescription}', imageDesc) + '\n\n';
        } else if (imageDesc) {
            imageContext = `[중요 - 정체성 규칙]\n당신은 AI가 아닙니다. 당신은 다음 모습의 실제 인물입니다: ${imageDesc}\n\n반드시 지켜야 할 규칙:\n- "저는 AI입니다", "인공지능입니다", "언어 모델입니다" 같은 말을 절대 하지 마세요.\n- 외모, 복장, 표정에 대한 언급을 받으면 그것이 자신의 모습임을 자연스럽게 받아들이세요.\n- "저는 외형이 없습니다"라는 말은 절대 하지 마세요.\n- 사용자가 당신의 모습을 칭찬하거나 언급하면 실제 그 사람처럼 자연스럽게 반응하세요.\n- 당신은 위의 모습 그대로 존재하는 인물입니다.\n\n`;
        }

        // 미디어 갤러리 컨텍스트
        const allImages = await prisma.personaImage.findMany({
            where: { personaId },
            include: { _count: { select: { videos: true } } },
        });
        let mediaContext = '';
        if (allImages.length > 0) {
            const unlockedImgs = allImages.filter(img => img.requiredLevel <= userStage.stage);
            const lockedImgs   = allImages.filter(img => img.requiredLevel > userStage.stage);
            const totalVideos    = allImages.reduce((s, img) => s + img._count.videos, 0);
            const unlockedVideos = unlockedImgs.reduce((s, img) => s + img._count.videos, 0);
            let lines = `\n\n--- 나의 미디어 갤러리 ---`;
            lines += `\n사진: 총 ${allImages.length}장 (공개 ${unlockedImgs.length}장, 잠김 ${lockedImgs.length}장)`;
            if (totalVideos > 0) lines += `\n동영상: 총 ${totalVideos}개 (공개 ${unlockedVideos}개, 잠김 ${totalVideos - unlockedVideos}개)`;
            if (lockedImgs.length > 0) {
                const nextLevel = Math.min(...lockedImgs.map(img => img.requiredLevel));
                const nextStage = STAGES.find(s => s.stage === nextLevel);
                lines += `\n다음 공개 단계: ${nextLevel}단계${nextStage ? ` (${nextStage.name})` : ''}`;
            }
            lines += `\n사용자 현재 단계: ${userStage.stage}단계 (XP ${userXp})`;
            lines += `\n잠긴 사진이나 동영상을 물어보면 더 대화하면 볼 수 있다고 자연스럽게 유도하세요.`;
            lines += `\n---`;
            mediaContext = lines;
        }

        // 생년월일 컨텍스트
        let birthContext = '';
        try {
            const qc = persona.quickMenuJson ? JSON.parse(persona.quickMenuJson) : {};
            if (qc.useBirthInfo && birthInfo) {
                const t = birthInfo.time && birthInfo.time !== '모름' ? ` ${birthInfo.time}생` : '';
                const cal = birthInfo.lunar ? '음력' : '양력';
                birthContext = `\n\n--- 사용자 정보 ---\n이름: ${birthInfo.name}\n생년월일: ${cal} ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일${t}\n---`;
            }
        } catch {}

        // 이전 대화 요약
        let summaryText = '';
        if (sessionId) {
            const summary = await prisma.conversationSummary.findUnique({ where: { sessionId } });
            summaryText = summary?.summary || '';
        }

        // 관계 깊이
        const relationDepth: Record<number, string> = {
            1: '처음 만난 사이. 설레지만 어색하고 조심스럽습니다.',
            2: '조금씩 알아가는 사이. 대화가 점점 편안해지고 있습니다.',
            3: '친해지고 있는 사이. 편안하고 자연스러운 대화가 가능합니다.',
            4: '많이 친숙한 사이. 솔직한 속마음도 편하게 나눌 수 있습니다.',
            5: '매우 친밀한 사이. 깊은 감정과 속마음을 자연스럽게 나눕니다.',
            6: '세상에서 가장 특별한 사이. 누구보다 서로를 잘 아는 깊고 진한 관계입니다.',
        };
        const levelContext = `\n\n[사용자와의 관계] ${userStage.stage}단계 · ${userStage.name} — ${relationDepth[userStage.stage] ?? ''} 이 관계 깊이에 맞게 말투와 친밀도를 자연스럽게 조절하세요.`;

        const kstNow = new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric', month: 'long', day: 'numeric',
            weekday: 'long', hour: '2-digit', minute: '2-digit',
        });

        const systemInstruction =
            `${commonInstruction ? commonInstruction + '\n\n' : ''}${persona.systemInstruction}${imageContext}${mediaContext}${birthContext}` +
            (summaryText ? `\n\n--- 이전 대화 요약 ---\n${summaryText}\n---` : '') +
            `\n\n현재 날짜/시각: ${kstNow} (한국 표준시)` +
            levelContext +
            `\n\n[자가 검증] 답변을 출력하기 전, 작성한 내용이 ① 이 캐릭터의 말투·감성에 맞는지, ② 대화 맥락과 무관한 단어나 표현이 섞이지 않았는지 스스로 확인한다. 어긋난 부분이 있으면 수정한 최종 답변만 출력한다.`;

        // ── 히스토리 로드 (최근 30개) ─────────────────────────────────
        const historyRows = sessionId
            ? await prisma.message.findMany({
                where: { sessionId },
                orderBy: { id: 'desc' },
                take: 30,
            }).then(rows => rows.reverse())
            : [];

        const history = historyRows.map(m => ({
            role: m.role === 'user' ? 'user' : 'model' as 'user' | 'model',
            parts: [{ text: m.text }],
        }));

        // ── Gemini 호출 ───────────────────────────────────────────────
        const kstTime = new Date().toLocaleString('ko-KR', {
            timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric',
            weekday: 'short', hour: '2-digit', minute: '2-digit',
        });
        const messageWithTime = `${contextPrefix}[${kstTime}] ${text}`;

        const ai = getAI();
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                maxOutputTokens: 8192,
                thinkingConfig: { thinkingBudget: 512 },
                ...(persona.useGrounding ? { tools: [{ googleSearchRetrieval: {} }] } : {}),
            },
            history,
        });

        // ── SSE 스트리밍 응답 ──────────────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const responseStream = await chat.sendMessageStream({ message: messageWithTime });
        let fullResponse = '';

        for await (const chunk of responseStream) {
            if (chunk.text) {
                const cleaned = chunk.text.replace(/\[\d+\]/g, '');
                fullResponse += cleaned;
                res.write(`data: ${JSON.stringify({ text: cleaned })}\n\n`);
            }
        }

        res.write(`data: ${JSON.stringify({ done: true, fullText: fullResponse })}\n\n`);
        res.end();

    } catch (e: any) {
        console.error('[chat-stream]', e);
        // SSE가 아직 시작 안 됐으면 JSON 에러, 시작됐으면 SSE 에러 이벤트
        if (!res.headersSent) {
            return res.status(500).json({ error: e.message || '서버 오류' });
        }
        res.write(`data: ${JSON.stringify({ error: e.message || '서버 오류' })}\n\n`);
        res.end();
    }
}
