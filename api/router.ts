import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './_lib/prisma.js';
import { signToken, setTokenCookie, clearTokenCookie, getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { sendEmail } from './_lib/email.js';
import { generateEmbedding } from './_lib/embedding.js';
import { extractMemories, generateSummary } from './_lib/gemini.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const domain = req.query.d as string;
    const seg1 = req.query.s1 as string | undefined;
    const seg2 = req.query.s2 as string | undefined;

    // ── Auth ──────────────────────────────────────────────────

    if (domain === 'auth') {

        // POST /api/auth/login
        if (seg1 === 'login' && req.method === 'POST') {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
            try {
                const user = await prisma.user.findUnique({ where: { email } });
                if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                return res.status(200).json({ user: { id: user.id, email: user.email, username: user.username, role: user.role }, token });
            } catch (e: any) {
                console.error('[login]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/auth/register
        if (seg1 === 'register' && req.method === 'POST') {
            const { email, password, username } = req.body;
            if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
            try {
                const existing = await prisma.user.findUnique({ where: { email } });
                if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
                const hashed = await bcrypt.hash(password, 10);
                const user = await prisma.user.create({
                    data: { email, password: hashed, username },
                    select: { id: true, email: true, username: true, role: true },
                });
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                return res.status(201).json({ user, token });
            } catch (e: any) {
                console.error('[register]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/auth/logout
        if (seg1 === 'logout' && req.method === 'POST') {
            res.setHeader('Set-Cookie', clearTokenCookie());
            return res.status(200).json({ message: '로그아웃 완료' });
        }

        // GET /api/auth/me
        if (seg1 === 'me' && req.method === 'GET') {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { id: true, email: true, username: true, role: true },
                });
                if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                return res.status(200).json({ user });
            } catch {
                return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
            }
        }

        // POST /api/auth/forgot-password
        if (seg1 === 'forgot-password' && req.method === 'POST') {
            const { email } = req.body || {};
            if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });
            try {
                const user = await prisma.user.findUnique({ where: { email } });
                if (user) {
                    const token = crypto.randomBytes(32).toString('hex');
                    const expiry = new Date(Date.now() + 30 * 60 * 1000);
                    await prisma.user.update({ where: { email }, data: { resetToken: token, resetTokenExpiry: expiry } });
                    const baseUrl = process.env.APP_BASE_URL || 'https://ai-mp.vercel.app';
                    await sendEmail(
                        email,
                        '[AI 페르소나] 비밀번호 재설정',
                        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111827;color:#f9fafb;border-radius:12px;"><h2 style="color:#60a5fa;margin-bottom:16px;">비밀번호 재설정</h2><p style="color:#9ca3af;margin-bottom:24px;">아래 버튼을 클릭해 비밀번호를 재설정하세요.<br>링크는 30분 후 만료됩니다.</p><a href="${baseUrl}/?token=${token}" style="display:inline-block;background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none;">비밀번호 재설정하기</a><p style="margin-top:24px;font-size:12px;color:#6b7280;">이 요청을 하지 않으셨다면 무시하셔도 됩니다.</p></div>`
                    );
                }
                return res.json({ message: '입력한 이메일로 재설정 링크를 전송했습니다.' });
            } catch (e: any) {
                console.error('[forgot-password]', e.message);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/auth/reset-password
        if (seg1 === 'reset-password' && req.method === 'POST') {
            const { token, password } = req.body || {};
            if (!token || !password) return res.status(400).json({ error: '토큰과 새 비밀번호를 입력해주세요.' });
            if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
            try {
                const user = await prisma.user.findFirst({
                    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
                });
                if (!user) return res.status(400).json({ error: '유효하지 않거나 만료된 링크입니다.' });
                const hashed = await bcrypt.hash(password, 10);
                await prisma.user.update({
                    where: { id: user.id },
                    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
                });
                return res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
            } catch (e: any) {
                console.error('[reset-password]', e.message);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Personas ──────────────────────────────────────────────

    if (domain === 'personas') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/personas (public)
        if (!seg1 && req.method === 'GET') {
            try {
                const personas = await prisma.persona.findMany({ orderBy: { order: 'asc' } });
                return res.status(200).json(personas);
            } catch (e: any) {
                console.error('[personas GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, description, systemInstruction, iconName, colorClass, imageUrl, order } = req.body;
                if (!name || !systemInstruction) return res.status(400).json({ error: '이름과 시스템 프롬프트는 필수입니다.' });
                const count = await prisma.persona.count();
                const persona = await prisma.persona.create({
                    data: { name, description, systemInstruction, iconName: iconName || 'Bot', colorClass: colorClass || 'from-blue-500 to-cyan-500', imageUrl, order: order ?? count, isDefault: false, createdBy: userId },
                });
                return res.status(201).json(persona);
            } catch (e: any) {
                console.error('[personas POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/personas/:id
        if (seg1 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, description, systemInstruction, iconName, colorClass, imageUrl, order, isVisible } = req.body;
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { name, description, systemInstruction, iconName, colorClass, imageUrl, order, ...(isVisible !== undefined && { isVisible }) },
                });
                return res.status(200).json(persona);
            } catch (e: any) {
                console.error('[personas PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
                if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });
                if (persona.isDefault) return res.status(400).json({ error: '기본 페르소나는 삭제할 수 없습니다.' });
                await prisma.persona.delete({ where: { id: seg1 } });
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[personas DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/personas/:id/images
        if (seg1 && seg2 === 'images' && req.method === 'GET') {
            try {
                const images = await prisma.personaImage.findMany({
                    where: { personaId: seg1 },
                    orderBy: [{ isMain: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
                });
                return res.status(200).json(images);
            } catch (e: any) {
                console.error('[persona images GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/images
        if (seg1 && seg2 === 'images' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageUrl, description, isMain } = req.body;
                if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
                if (isMain) {
                    await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
                }
                const count = await prisma.personaImage.count({ where: { personaId: seg1 } });
                const image = await prisma.personaImage.create({
                    data: { personaId: seg1, imageUrl, description, isMain: isMain ?? count === 0, order: count },
                });
                return res.status(201).json(image);
            } catch (e: any) {
                console.error('[persona images POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/personas/:id/images  (body: { imageId, isMain?, description? })
        if (seg1 && seg2 === 'images' && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageId, isMain, description } = req.body;
                if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
                if (isMain) {
                    await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
                }
                const image = await prisma.personaImage.update({
                    where: { id: Number(imageId) },
                    data: { ...(isMain !== undefined && { isMain }), ...(description !== undefined && { description }) },
                });
                return res.status(200).json(image);
            } catch (e: any) {
                console.error('[persona images PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id/images  (body: { imageId })
        if (seg1 && seg2 === 'images' && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageId } = req.body;
                if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
                const deleted = await prisma.personaImage.delete({ where: { id: Number(imageId) } });
                // 삭제된 이미지가 대표였으면 첫 번째 이미지를 대표로 설정
                if (deleted.isMain) {
                    const first = await prisma.personaImage.findFirst({
                        where: { personaId: seg1 },
                        orderBy: { order: 'asc' },
                    });
                    if (first) await prisma.personaImage.update({ where: { id: first.id }, data: { isMain: true } });
                }
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[persona images DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Sessions ──────────────────────────────────────────────

    if (domain === 'sessions') {
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
                return res.status(200).json(sessions);
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
                    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
                    await prisma.$queryRawUnsafe(
                        `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
                         VALUES ($1, $2, $3::vector, $4, NOW())`,
                        userId, content, vectorStr, null
                    );
                    saved++;
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
                const messages = await prisma.message.findMany({
                    where: { sessionId },
                    orderBy: { createdAt: 'asc' },
                    take: 30,
                });
                const summaryText = await generateSummary(messages.map(m => ({ role: m.role, text: m.text })));
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
                    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
                    await prisma.$queryRawUnsafe(
                        `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
                         VALUES ($1, $2, $3::vector, $4, NOW())`,
                        userId, content, vectorStr, '요약추출'
                    );
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
                const message = await prisma.message.create({ data: { sessionId, role, text } });
                await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
                return res.status(201).json(message);
            } catch (e: any) {
                console.error('[messages POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Memory ────────────────────────────────────────────────
    if (domain === 'memory') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/memory — 기억 저장 (임베딩 생성 후 저장)
        if (req.method === 'POST' && !seg1) {
            try {
                const { content, category } = req.body;
                if (!content) return res.status(400).json({ error: 'content는 필수입니다.' });
                const embedding = await generateEmbedding(content);
                const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
                const result = await prisma.$queryRawUnsafe<any[]>(
                    `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
                     VALUES ($1, $2, $3::vector, $4, NOW())
                     RETURNING "id", "userId", "content", "category", "createdAt"`,
                    userId, content, vectorStr, category || null
                );
                return res.status(201).json(result[0]);
            } catch (e: any) {
                console.error('[memory POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/memory — 전체 기억 조회
        if (req.method === 'GET' && !seg1) {
            try {
                const memories = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "userId", "content", "category", "createdAt"
                     FROM "UserMemory" WHERE "userId" = $1
                     ORDER BY "createdAt" DESC LIMIT 50`,
                    userId
                );
                return res.status(200).json(memories);
            } catch (e: any) {
                console.error('[memory GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/memory/search — 유사도 검색
        if (req.method === 'POST' && seg1 === 'search') {
            try {
                const { query } = req.body;
                if (!query) return res.status(400).json({ error: 'query는 필수입니다.' });
                const embedding = await generateEmbedding(query);
                if (!embedding) return res.status(200).json([]);
                const vectorStr = `[${embedding.join(',')}]`;
                const memories = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "content", "category",
                            1 - ("embedding" <=> $2::vector) AS similarity
                     FROM "UserMemory"
                     WHERE "userId" = $1 AND "embedding" IS NOT NULL
                     ORDER BY "embedding" <=> $2::vector
                     LIMIT 5`,
                    userId, vectorStr
                );
                return res.status(200).json(memories);
            } catch (e: any) {
                console.error('[memory search]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/memory/:id
        if (req.method === 'DELETE' && seg1) {
            try {
                await prisma.$queryRawUnsafe(
                    `DELETE FROM "UserMemory" WHERE "id" = $1 AND "userId" = $2`,
                    Number(seg1), userId
                );
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[memory DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
