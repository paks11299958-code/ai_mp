import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../_lib/auth.js';
import { extractMemories, generateSummary } from '../_lib/gemini.js';
import { generateEmbedding } from '../_lib/embedding.js';
import { saveMemoryIfNew } from '../_lib/vectorStore.js';

export async function handler(
    req: VercelRequest,
    res: VercelResponse,
    seg1: string | undefined,
    seg2: string | undefined,
) {
    const token = getTokenFromRequest(req);
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
    let userId: number;
    try {
        ({ userId } = verifyToken(token));
    } catch {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    const sessionId = seg1 ? Number(seg1) : null;

        // GET /api/sessions
        if (!sessionId && req.method === 'GET') {
            try {
                const sessions = await prisma.chatSession.findMany({
                    where: { userId },
                    orderBy: { updatedAt: 'desc' },
                    include: { persona: { select: { id: true, name: true, iconName: true, colorClass: true } } },
                });
                // 페르소나별 첫 세션 날짜 계산 (D-Day용)
                const firstChatMap: Record<string, string> = {};
                for (const s of sessions) {
                    if (!firstChatMap[s.personaId] || s.createdAt < new Date(firstChatMap[s.personaId])) {
                        firstChatMap[s.personaId] = s.createdAt.toISOString();
                    }
                }
                return res.status(200).json({ sessions, firstChatMap });
            } catch (e: any) {
                console.error('[sessions GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions
        if (!sessionId && req.method === 'POST') {
            try {
                const { personaId, title } = req.body;
                if (!personaId) return res.status(400).json({ error: 'personaId는 필수입니다.' });
                const session = await prisma.chatSession.create({
                    data: { userId, personaId, title: title || '새 대화' },
                    include: { persona: { select: { id: true, name: true, iconName: true, colorClass: true } } },
                });
                return res.status(201).json(session);
            } catch (e: any) {
                console.error('[sessions POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/sessions/:id/messages
        if (sessionId && seg2 === 'messages' && req.method === 'GET') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

                const limit = Math.min(Number(req.query.limit) || 50, 100);
                const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

                const where: any = { sessionId };
                if (cursor) where.id = { lt: cursor };

                const raw = await prisma.message.findMany({
                    where,
                    orderBy: { id: 'desc' },
                    take: limit + 1,
                });
                const hasMore = raw.length > limit;
                const messages = raw.slice(0, limit).reverse();

                return res.status(200).json({ messages, hasMore });
            } catch (e: any) {
                console.error('[messages GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/sessions/:id/summary
        if (sessionId && seg2 === 'summary' && req.method === 'GET') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
                const summary = await prisma.conversationSummary.findUnique({ where: { sessionId } });
                return res.status(200).json(summary || null);
            } catch (e: any) {
                console.error('[summary GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/summary
        if (sessionId && seg2 === 'summary' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
                const { summary, messageCount } = req.body;
                if (!summary || !messageCount) return res.status(400).json({ error: 'summary와 messageCount는 필수입니다.' });
                const saved = await prisma.conversationSummary.upsert({
                    where: { sessionId },
                    update: { summary, messageCount, updatedAt: new Date() },
                    create: { sessionId, summary, messageCount },
                });
                return res.status(200).json(saved);
            } catch (e: any) {
                console.error('[summary POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/extract-memories
        if (sessionId && seg2 === 'extract-memories' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
                const { userText, aiText } = req.body;
                if (!userText) return res.status(400).json({ error: 'userText는 필수입니다.' });
                const memories = await extractMemories(userText, aiText || '');
                let saved = 0;
                for (const content of memories) {
                    const embedding = await generateEmbedding(content);
                    const ok = await saveMemoryIfNew(userId, content, embedding, null);
                    if (ok) saved++;
                }
                return res.status(200).json({ saved });
            } catch (e: any) {
                console.error('[extract-memories]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/summarize
        if (sessionId && seg2 === 'summarize' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
                const existingSummary = await prisma.conversationSummary.findUnique({ where: { sessionId } });
                const messages = (await prisma.message.findMany({
                    where: { sessionId },
                    orderBy: { createdAt: 'desc' },
                    take: 30,
                })).reverse();
                const previousSummary = (existingSummary && messages.length < 20) ? existingSummary.summary : undefined;
                const summaryText = await generateSummary(messages.map(m => ({ role: m.role, text: m.text })), previousSummary);
                if (!summaryText) return res.status(200).json({ summary: null });
                const saved = await prisma.conversationSummary.upsert({
                    where: { sessionId },
                    update: { summary: summaryText, messageCount: messages.length, updatedAt: new Date() },
                    create: { sessionId, summary: summaryText, messageCount: messages.length },
                });
                // 요약에서 기억 추출
                const memories = await extractMemories(summaryText, '');
                for (const content of memories) {
                    const embedding = await generateEmbedding(content);
                    await saveMemoryIfNew(userId, content, embedding, '요약추출');
                }
                return res.status(200).json(saved);
            } catch (e: any) {
                console.error('[summarize]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/messages
        if (sessionId && seg2 === 'messages' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
                const { role, text } = req.body;
                if (!role || !text) return res.status(400).json({ error: 'role과 text는 필수입니다.' });

                // 사용자 메시지: 포인트 차감 + XP 적립 (atomic)
                let pointsInfo: { balance: number; paidBalance: number; bonusBalance: number; cost: number; leveledUp: boolean; newStage: number; levelupBonus: number } | undefined;
                let updatedXp: number | undefined;
                if (role === 'user') {
                    const msgUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                    const isManage = msgUser?.role === 'MANAGE' || msgUser?.role === 'ADMIN';
                    if (!isManage) {
                        const { deductPointsForMessage } = await import('../_lib/points.js');
                        try {
                            const result = await deductPointsForMessage(prisma, userId, session.personaId);
                            pointsInfo = { balance: result.newBalance, paidBalance: result.paidBalance, bonusBalance: result.bonusBalance, cost: result.cost, leveledUp: result.leveledUp, newStage: result.newStage, levelupBonus: result.levelupBonus };
                            const xpRecord = await prisma.userPersonaXp.findUnique({
                                where: { userId_personaId: { userId, personaId: session.personaId } },
                            });
                            updatedXp = xpRecord?.xp;
                        } catch (e: any) {
                            if (e.message === 'INSUFFICIENT_POINTS') {
                                return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
                            }
                            throw e;
                        }
                    }
                }

                const message = await prisma.message.create({ data: { sessionId, role, text } });
                await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
                return res.status(201).json({ ...message, personaId: session.personaId, xp: updatedXp, points: pointsInfo });
            } catch (e: any) {
                console.error('[messages POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/greet
        if (sessionId && seg2 === 'greet' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

                const [persona, userRow] = await Promise.all([
                    prisma.persona.findUnique({ where: { id: session.personaId } }),
                    prisma.user.findUnique({ where: { id: userId }, select: { username: true } }),
                ]);
                if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

                // 마지막 메시지 확인 — 2시간 이내이면 재인사 생략
                const lastMsg = await prisma.message.findFirst({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
                const isFirstVisit = !lastMsg;
                if (lastMsg) {
                    const elapsed = Date.now() - new Date(lastMsg.createdAt).getTime();
                    if (elapsed < 2 * 60 * 60 * 1000) return res.status(200).json({ skipped: true });
                }

                const { GoogleGenAI } = await import('@google/genai');
                const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
                if (!credsJson) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });
                const creds = JSON.parse(credsJson);
                const ai = new GoogleGenAI({ vertexai: true, project: creds.project_id, location: 'us-central1', googleAuthOptions: { credentials: creds } });

                const sysPrompt = [persona.systemInstruction, persona.identityPrompt].filter(Boolean).join('\n\n') +
                    `\n\n[자가 검증] 답변을 출력하기 전, 작성한 내용이 ① 이 캐릭터의 말투·감성에 맞는지, ② 대화 맥락과 무관한 단어나 표현이 섞이지 않았는지 스스로 확인한다. 어긋난 부분이 있으면 수정한 최종 답변만 출력한다.`;

                let greetPrompt: string;

                if (persona.name === '신은비') {
                    const callAs = userRow?.username || '';
                    const callStr = callAs ? `상대방 호칭은 "${callAs}"야.` : '';
                    const elapsed = lastMsg ? Date.now() - new Date(lastMsg.createdAt).getTime() : Infinity;

                    // D-Day 기념일 체크
                    const firstSession = await prisma.chatSession.findFirst({
                        where: { userId, personaId: session.personaId },
                        orderBy: { createdAt: 'asc' },
                        select: { createdAt: true },
                    });
                    const MILESTONES = [7, 14, 22, 30, 50, 100];
                    if (firstSession) {
                        const daysElapsed = Math.floor((Date.now() - new Date(firstSession.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                        if (MILESTONES.includes(daysElapsed)) {
                            const milestonePrompt = `오늘은 우리가 처음 대화한 지 ${daysElapsed}일이 되는 날입니다. "벌써 우리 대화한 지 ${daysElapsed}일이나 됐어!" 같은 감성으로 기념일을 축하하며, 신은비의 말투로 두세 문장 멘트를 해주세요. ${callStr}`;
                            const milestoneRes = await ai.models.generateContent({
                                model: 'gemini-2.5-flash',
                                config: { systemInstruction: sysPrompt },
                                contents: [{ role: 'user', parts: [{ text: milestonePrompt }] }],
                            });
                            const milestoneText = milestoneRes.text?.trim();
                            if (milestoneText) {
                                const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text: milestoneText } });
                                return res.status(201).json(message);
                            }
                        }
                    }

                    // KST 시간 (UTC+9)
                    const kstHour = (new Date().getUTCHours() + 9) % 24;

                    if (isFirstVisit) {
                        greetPrompt = `사용자가 처음 입장했습니다. 신은비의 말투로 짧고 인상적인 첫인사를 해주세요. ${callStr}`;
                    } else if (elapsed > 24 * 60 * 60 * 1000) {
                        greetPrompt = `사용자가 24시간 이상 만에 돌아왔습니다. "나 잊어버린 줄 알았잖아... 오늘 올 줄 알았어!" 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
                    } else if (kstHour >= 7 && kstHour < 9) {
                        greetPrompt = `아침 시간입니다. "굿모닝! 오늘 하루도 힘내서 잘 다녀와!" 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
                    } else if (kstHour >= 22) {
                        greetPrompt = `늦은 밤입니다. "오늘 하루는 어땠어? 자기 전에 목소리 듣고 싶었어." 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
                    } else {
                        greetPrompt = `사용자가 다시 돌아왔습니다. 신은비의 말투로 짧고 반갑게 맞이해주세요. 한두 문장만 해주세요. ${callStr}`;
                    }
                } else {
                    greetPrompt = isFirstVisit
                        ? '사용자가 처음 입장했습니다. 당신의 정체성에 맞게 짧고 인상적인 첫인사를 한 문단으로 해주세요.'
                        : '사용자가 다시 돌아왔습니다. 이전 대화를 기억하며 짧고 반갑게 맞이해주세요. 한 문장 또는 두 문장으로만 해주세요.';
                }

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction: sysPrompt },
                    contents: [{ role: 'user', parts: [{ text: greetPrompt }] }],
                });
                const greetText = response.text?.trim();
                if (!greetText) return res.status(500).json({ error: '인사말 생성 실패' });

                const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text: greetText } });
                return res.status(201).json(message);
            } catch (e: any) {
                console.error('[greet]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/:id/quick-trigger
        if (sessionId && seg2 === 'quick-trigger' && req.method === 'POST') {
            try {
                if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });
                const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
                if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

                const { menuLabel, menuPrompt } = req.body;
                if (!menuLabel) return res.status(400).json({ error: '메뉴 정보가 필요합니다.' });

                const [persona, userRow] = await Promise.all([
                    prisma.persona.findUnique({ where: { id: session.personaId } }),
                    prisma.user.findUnique({ where: { id: userId }, select: { birthInfoJson: true } }),
                ]);
                if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

                const birthInfo = userRow?.birthInfoJson ? JSON.parse(userRow.birthInfoJson) : null;
                const birthContext = birthInfo
                    ? `\n사용자 정보: ${birthInfo.name || '사용자'}씨, ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일 ${birthInfo.time}생`
                    : '';

                const sysPrompt = [persona.systemInstruction, persona.identityPrompt, birthContext].filter(Boolean).join('\n\n') +
                    `\n\n[자가 검증] 답변을 출력하기 전, 작성한 내용이 ① 이 캐릭터의 말투·감성에 맞는지, ② 대화 맥락과 무관한 단어나 표현이 섞이지 않았는지 스스로 확인한다. 어긋난 부분이 있으면 수정한 최종 답변만 출력한다.`;
                const triggerPrompt = `사용자가 [${menuLabel}] 주제로 대화를 시작하고 싶어합니다. 사주 정보를 바탕으로 자연스럽고 흥미롭게 이 주제의 대화를 열어주세요. 한두 문장으로 짧게 시작하세요.`;

                const { GoogleGenAI } = await import('@google/genai');
                const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
                if (!credsJson) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });
                const creds = JSON.parse(credsJson);
                const ai = new GoogleGenAI({ vertexai: true, project: creds.project_id, location: 'us-central1', googleAuthOptions: { credentials: creds } });

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction: sysPrompt },
                    contents: [{ role: 'user', parts: [{ text: triggerPrompt }] }],
                });
                const text = response.text?.trim();
                if (!text) return res.status(500).json({ error: '응답 생성 실패' });

                const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text } });
                await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
                return res.status(201).json(message);
            } catch (e: any) {
                console.error('[quick-trigger]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/sessions/cleanup (admin only)
        if (seg1 === 'cleanup' && req.method === 'POST') {
            try {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const { days = 30, keepCount = 10 } = req.body;
                const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
                const staleSessions = await prisma.chatSession.findMany({
                    where: { updatedAt: { lt: cutoff }, summary: { isNot: null } },
                    select: { id: true },
                });
                let deletedMessages = 0;
                let cleanedSessions = 0;
                for (const s of staleSessions) {
                    const keep = await prisma.message.findMany({
                        where: { sessionId: s.id },
                        orderBy: { createdAt: 'desc' },
                        take: Number(keepCount),
                        select: { id: true },
                    });
                    const keepIds = keep.map(m => m.id);
                    const result = await prisma.message.deleteMany({
                        where: { sessionId: s.id, ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}) },
                    });
                    if (result.count > 0) {
                        deletedMessages += result.count;
                        cleanedSessions++;
                        await prisma.conversationSummary.update({
                            where: { sessionId: s.id },
                            data: { messageCount: keep.length },
                        });
                    }
                }
                return res.status(200).json({ cleanedSessions, deletedMessages });
            } catch (e: any) {
                console.error('[sessions cleanup]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

}
