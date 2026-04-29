import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './_lib/prisma.js';
import { signToken, setTokenCookie, clearTokenCookie, getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { sendEmail } from './_lib/email.js';
import { generateEmbedding } from './_lib/embedding.js';
import { extractMemories, generateSummary, extractTriggerKeywords, analyzeGolfSwing } from './_lib/gemini.js';
import { uploadToGCS, deleteFromGCS, generateSignedUrl } from './_lib/storage.js';

function chunkText(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
    const chunks: string[] = [];
    for (const para of paragraphs) {
        if (para.length <= 600) {
            chunks.push(para);
        } else {
            let i = 0;
            while (i < para.length) {
                chunks.push(para.slice(i, i + 600));
                i += 600 - 50;
            }
        }
    }
    return chunks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const domain = req.query.d as string;
    const seg1 = req.query.s1 as string | undefined;
    const seg2 = req.query.s2 as string | undefined;
    const seg3 = req.query.s3 as string | undefined;

    // ── Auth ──────────────────────────────────────────────────

    if (domain === 'auth') {

        // POST /api/auth/login
        if (seg1 === 'login' && req.method === 'POST') {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
            try {
                const user = await prisma.user.findUnique({
                    where: { email },
                    include: { personaXps: { select: { personaId: true, xp: true } } },
                });
                if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
                return res.status(200).json({ user: { id: user.id, email: user.email, username: user.username, role: user.role, personaXp }, token });
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
                return res.status(201).json({ user: { ...user, personaXp: {} }, token });
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
                    include: { personaXps: { select: { personaId: true, xp: true } } },
                });
                if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
                return res.status(200).json({ user: { id: user.id, email: user.email, username: user.username, role: user.role, personaXp } });
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

    // ── App Settings ──────────────────────────────────────────
    if (domain === 'settings') {
        if (req.method === 'GET') {
            const configs = await prisma.appConfig.findMany();
            const result: Record<string, string> = {};
            configs.forEach((c: any) => { result[c.key] = c.value; });
            return res.json(result);
        }
        if (req.method === 'PUT') {
            const token = getTokenFromRequest(req);
            if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
            const updates = req.body as Record<string, string>;
            await Promise.all(
                Object.entries(updates).map(([key, value]) =>
                    prisma.appConfig.upsert({
                        where: { key },
                        update: { value: String(value), updatedAt: new Date() },
                        create: { key, value: String(value) },
                    })
                )
            );
            return res.json({ message: '저장 완료' });
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
                const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, order } = req.body;
                if (!name || !systemInstruction) return res.status(400).json({ error: '이름과 시스템 프롬프트는 필수입니다.' });
                const count = await prisma.persona.count();
                const persona = await prisma.persona.create({
                    data: { name, jobTitle: jobTitle || null, description, systemInstruction, iconName: iconName || 'Bot', colorClass: colorClass || 'from-blue-500 to-cyan-500', imageUrl, order: order ?? count, isDefault: false, createdBy: userId },
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
                const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, order, isVisible } = req.body;
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { name, jobTitle: jobTitle ?? null, description, systemInstruction, iconName, colorClass, imageUrl, order, ...(isVisible !== undefined && { isVisible }) },
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
                    include: { _count: { select: { videos: true } } },
                });
                return res.status(200).json(images);
            } catch (e: any) {
                console.error('[persona images GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/images/signed-url
        if (seg1 && seg2 === 'images' && req.query.action === 'signed-url' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'jpg';
                const destPath = `personas/${seg1}/images/${Date.now()}_${filename || 'image'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                console.error('[persona images signed-url]', e);
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

                let finalUrl = imageUrl;
                // base64 이미지이면 GCS에 업로드
                if (imageUrl.startsWith('data:')) {
                    const mimeType = imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                    const ext = mimeType.split('/')[1] || 'jpg';
                    const base64Data = imageUrl.split(',')[1];
                    const buffer = Buffer.from(base64Data, 'base64');
                    const destPath = `personas/${seg1}/images/${Date.now()}.${ext}`;
                    finalUrl = await uploadToGCS(buffer, destPath, mimeType);
                }

                if (isMain) {
                    await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
                }
                const count = await prisma.personaImage.count({ where: { personaId: seg1 } });
                const image = await prisma.personaImage.create({
                    data: { personaId: seg1, imageUrl: finalUrl, description, isMain: isMain ?? count === 0, order: count },
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
                const { imageId, isMain, description, requiredLevel, order } = req.body;
                if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
                if (isMain) {
                    await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
                }
                const image = await prisma.personaImage.update({
                    where: { id: Number(imageId) },
                    data: {
                        ...(isMain !== undefined && { isMain }),
                        ...(description !== undefined && { description }),
                        ...(requiredLevel !== undefined && { requiredLevel: Number(requiredLevel) }),
                        ...(order !== undefined && { order: Number(order) }),
                    },
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
                // GCS 파일 삭제
                await deleteFromGCS(deleted.imageUrl);
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
                // 사용자 메시지 1개 = 해당 페르소나 1 XP
                let updatedXp: number | undefined;
                if (role === 'user') {
                    const upserted = await prisma.userPersonaXp.upsert({
                        where: { userId_personaId: { userId, personaId: session.personaId } },
                        update: { xp: { increment: 1 } },
                        create: { userId, personaId: session.personaId, xp: 1 },
                        select: { xp: true },
                    });
                    updatedXp = upserted.xp;
                }
                return res.status(201).json({ ...message, personaId: session.personaId, xp: updatedXp });
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
                       AND 1 - ("embedding" <=> $2::vector) > 0.75
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

    // ── Persona Videos ────────────────────────────────────────
    // GET    /api/persona-videos/:imageId  → 이미지에 연결된 동영상 목록
    // POST   /api/persona-videos           → 동영상 추가 (body: { imageId, videoUrl, title })
    // PUT    /api/persona-videos/:videoId  → 동영상 수정 (body: { title, order })
    // DELETE /api/persona-videos/:videoId  → 동영상 삭제

    if (domain === 'persona-videos') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/persona-videos/:imageId
        if (seg1 && req.method === 'GET') {
            try {
                const videos = await prisma.personaVideo.findMany({
                    where: { imageId: Number(seg1) },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                });
                return res.status(200).json(videos);
            } catch (e: any) {
                console.error('[persona-videos GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/persona-videos/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `personas/videos/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                console.error('[persona-videos signed-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/persona-videos
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageId, videoUrl, videoBase64, mimeType, title } = req.body;
                if (!imageId || (!videoUrl && !videoBase64)) return res.status(400).json({ error: 'imageId와 videoUrl 또는 videoBase64는 필수입니다.' });

                let finalUrl = videoUrl || '';
                // base64 동영상이면 GCS에 업로드
                if (videoBase64) {
                    const type = mimeType || 'video/mp4';
                    const ext = type.split('/')[1] || 'mp4';
                    const buffer = Buffer.from(videoBase64, 'base64');
                    const destPath = `personas/videos/${Date.now()}.${ext}`;
                    finalUrl = await uploadToGCS(buffer, destPath, type);
                }

                const count = await prisma.personaVideo.count({ where: { imageId: Number(imageId) } });
                const video = await prisma.personaVideo.create({
                    data: { imageId: Number(imageId), videoUrl: finalUrl, title: title || null, order: count },
                });
                return res.status(201).json(video);
            } catch (e: any) {
                console.error('[persona-videos POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/persona-videos/:videoId
        if (seg1 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, order, requiredLevel } = req.body;
                const video = await prisma.personaVideo.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(order !== undefined && { order }),
                        ...(requiredLevel !== undefined && { requiredLevel: Number(requiredLevel) }),
                    },
                });
                return res.status(200).json(video);
            } catch (e: any) {
                console.error('[persona-videos PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/persona-videos/:videoId
        if (seg1 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const deleted = await prisma.personaVideo.delete({ where: { id: Number(seg1) } });
                await deleteFromGCS(deleted.videoUrl);
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[persona-videos DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Knowledge ─────────────────────────────────────────────
    if (domain === 'knowledge') {

        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // POST /api/knowledge — 텍스트 업로드 → 청크 분할 → 임베딩 → 저장
        if (req.method === 'POST' && !seg1) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { personaId, title, text } = req.body;
                if (!personaId || !text) return res.status(400).json({ error: 'personaId와 text는 필수입니다.' });
                const sourceId = crypto.randomUUID();
                const chunks = chunkText(text);
                let saved = 0;
                for (const content of chunks) {
                    const embedding = await generateEmbedding(content);
                    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
                    await prisma.$queryRawUnsafe(
                        `INSERT INTO "PersonaKnowledge" ("personaId", "sourceId", "title", "content", "embedding", "createdAt")
                         VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
                        personaId, sourceId, title || null, content, vectorStr
                    );
                    saved++;
                }
                return res.status(201).json({ saved, total: chunks.length, sourceId });
            } catch (e: any) {
                console.error('[knowledge POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/knowledge/:personaId — 문서 단위 목록 (sourceId 기준 그룹)
        if (req.method === 'GET' && seg1) {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const list = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "sourceId", "title",
                            COUNT(*)::int AS "chunkCount",
                            LEFT(MIN("content"), 100) AS "preview",
                            MIN("createdAt") AS "createdAt"
                     FROM "PersonaKnowledge"
                     WHERE "personaId" = $1
                     GROUP BY "sourceId", "title"
                     ORDER BY MIN("createdAt") DESC`,
                    seg1
                );
                return res.status(200).json(list);
            } catch (e: any) {
                console.error('[knowledge GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/knowledge/source/:sourceId — 문서 단위 전체 삭제
        if (req.method === 'DELETE' && seg1 === 'source' && seg2) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { count } = await prisma.personaKnowledge.deleteMany({ where: { sourceId: seg2 } });
                return res.status(200).json({ message: '삭제 완료', deleted: count });
            } catch (e: any) {
                console.error('[knowledge DELETE source]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/knowledge/:id — 청크 단건 삭제 (하위 호환)
        if (req.method === 'DELETE' && seg1) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                await prisma.personaKnowledge.delete({ where: { id: Number(seg1) } });
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[knowledge DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/knowledge/search — 채팅 시 관련 지식 검색
        if (req.method === 'POST' && seg1 === 'search') {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                verifyToken(token);
                const { personaId, query } = req.body;
                if (!personaId || !query) return res.status(400).json({ error: 'personaId와 query는 필수입니다.' });
                const embedding = await generateEmbedding(query);
                if (!embedding) return res.status(200).json([]);
                const vectorStr = `[${embedding.join(',')}]`;
                const results = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "content",
                            1 - ("embedding" <=> $2::vector) AS similarity
                     FROM "PersonaKnowledge"
                     WHERE "personaId" = $1 AND "embedding" IS NOT NULL
                       AND 1 - ("embedding" <=> $2::vector) > 0.70
                     ORDER BY "embedding" <=> $2::vector
                     LIMIT 3`,
                    personaId, vectorStr
                );
                return res.status(200).json(results);
            } catch (e: any) {
                console.error('[knowledge search]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Board ─────────────────────────────────────────────────

    if (domain === 'board') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
        const payload = verifyToken(token);
        const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
        if (!me) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        const isAdmin = me.role === 'ADMIN';

        // GET /api/board — 목록 (제목만, 비밀글)
        if (!seg1 && req.method === 'GET') {
            try {
                const personaIdFilter = req.query.personaId as string | undefined;
                const posts = await prisma.boardPost.findMany({
                    where: personaIdFilter ? { personaId: personaIdFilter } : undefined,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, title: true, createdAt: true, userId: true,
                        user: { select: { username: true, email: true } },
                        _count: { select: { replies: true } },
                    },
                });
                return res.status(200).json(posts);
            } catch (e: any) {
                console.error('[board GET]', e);
                return res.status(500).json({ error: '목록 조회 실패' });
            }
        }

        // POST /api/board — 게시글 작성
        if (!seg1 && req.method === 'POST') {
            try {
                const { title, content, personaId: postPersonaId } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                if (!postPersonaId)
                    return res.status(400).json({ error: 'personaId는 필수입니다.' });
                const post = await prisma.boardPost.create({
                    data: { userId: me.id, personaId: postPersonaId, title: title.trim(), content: content.trim() },
                });
                try {
                    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
                    for (const admin of admins) {
                        await sendEmail(admin.email, '[AI 페르소나] 소통게시판 새 글이 등록되었습니다',
                            `<div style="font-family:sans-serif;padding:24px;"><h2>새 문의글이 등록되었습니다</h2><p>제목: <strong>${title.trim()}</strong></p></div>`
                        ).catch(() => {});
                    }
                } catch {}
                return res.status(200).json({ id: post.id });
            } catch (e: any) {
                console.error('[board POST]', e);
                return res.status(500).json({ error: '게시글 등록 실패' });
            }
        }

        // GET /api/board/:id — 상세 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const post = await prisma.boardPost.findUnique({
                    where: { id: parseInt(seg1) },
                    include: {
                        user: { select: { username: true, email: true } },
                        replies: {
                            include: { user: { select: { username: true, email: true } } },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '열람 권한이 없습니다.' });
                return res.status(200).json(post);
            } catch (e: any) {
                console.error('[board GET detail]', e);
                return res.status(500).json({ error: '불러오기 실패' });
            }
        }

        // PUT /api/board/:id — 수정 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const post = await prisma.boardPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '수정 권한이 없습니다.' });
                const { title, content } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                await prisma.boardPost.update({
                    where: { id: parseInt(seg1) },
                    data: { title: title.trim(), content: content.trim() },
                });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board PUT]', e);
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/board/:id — 삭제 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const post = await prisma.boardPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.boardPost.delete({ where: { id: parseInt(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }

        // POST /api/board/:id/reply — 답글 작성 (작성자 또는 관리자)
        if (seg1 && seg2 === 'reply' && !seg3 && req.method === 'POST') {
            try {
                const postId = parseInt(seg1);
                const { content } = req.body;
                if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
                const post = await prisma.boardPost.findUnique({
                    where: { id: postId },
                    include: { user: { select: { email: true, username: true } } },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                const isAuthor = post.userId === me.id;
                if (!isAdmin && !isAuthor)
                    return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
                const reply = await prisma.boardReply.create({
                    data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
                });
                if (isAdmin && !isAuthor) {
                    sendEmail(post.user.email, '[AI 페르소나] 소통게시판 답글이 등록되었습니다',
                        `<div style="font-family:sans-serif;padding:24px;"><h2>관리자 답글이 등록되었습니다</h2><p>게시글: <strong>${post.title}</strong></p></div>`
                    ).catch(() => {});
                }
                return res.status(200).json({ id: reply.id });
            } catch (e: any) {
                console.error('[board reply POST]', e);
                return res.status(500).json({ error: '답글 등록 실패' });
            }
        }

        // DELETE /api/board/:id/reply/:replyId — 답글 삭제 (작성자 또는 관리자)
        if (seg1 && seg2 === 'reply' && seg3 && req.method === 'DELETE') {
            try {
                const reply = await prisma.boardReply.findUnique({ where: { id: parseInt(seg3) } });
                if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
                if (reply.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.boardReply.delete({ where: { id: parseInt(seg3) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board reply DELETE]', e);
                return res.status(500).json({ error: '답글 삭제 실패' });
            }
        }
    }

    // ── Trigger Videos ────────────────────────────────────────
    if (domain === 'trigger-videos') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/trigger-videos/:personaId
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const list = await prisma.personaTriggerVideo.findMany({
                    where: { personaId: seg1 },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                });
                return res.status(200).json(list);
            } catch (e: any) {
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        // POST /api/trigger-videos/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `personas/triggers/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                return res.status(500).json({ error: '서명 URL 생성 실패' });
            }
        }

        // POST /api/trigger-videos/extract-keywords
        if (seg1 === 'extract-keywords' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, description } = req.body;
                if (!title) return res.status(400).json({ error: 'title은 필수입니다.' });
                const keywords = await extractTriggerKeywords(title, description || '');
                return res.status(200).json({ keywords });
            } catch (e: any) {
                return res.status(500).json({ error: '키워드 추출 실패' });
            }
        }

        // POST /api/trigger-videos
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { personaId, videoUrl, title, description, keywords, tag } = req.body;
                if (!personaId || !videoUrl || !keywords)
                    return res.status(400).json({ error: 'personaId, videoUrl, keywords는 필수입니다.' });
                const count = await prisma.personaTriggerVideo.count({ where: { personaId } });
                const video = await prisma.personaTriggerVideo.create({
                    data: { personaId, videoUrl, title: title || null, description: description || null, keywords, tag: tag || null, order: count },
                });
                return res.status(201).json(video);
            } catch (e: any) {
                return res.status(500).json({ error: '저장 실패' });
            }
        }

        // PUT /api/trigger-videos/:id
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, description, keywords, tag } = req.body;
                const video = await prisma.personaTriggerVideo.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(description !== undefined && { description }),
                        ...(keywords !== undefined && { keywords }),
                        ...(tag !== undefined && { tag }),
                    },
                });
                return res.status(200).json(video);
            } catch (e: any) {
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/trigger-videos/:id
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const deleted = await prisma.personaTriggerVideo.delete({ where: { id: Number(seg1) } });
                await deleteFromGCS(deleted.videoUrl);
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                return res.status(500).json({ error: '삭제 실패' });
            }
        }
    }

    // ── Swing Analysis ────────────────────────────────────────
    if (domain === 'swing-analysis') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/swing-analysis/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `users/${userId}/swing/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                console.error('[swing signed-url]', e);
                return res.status(500).json({ error: '서명 URL 생성 실패' });
            }
        }

        // POST /api/swing-analysis/analyze
        if (seg1 === 'analyze' && req.method === 'POST') {
            try {
                const { videoUrl, personaId, mimeType } = req.body;
                if (!videoUrl || !personaId) return res.status(400).json({ error: '필수 항목 누락' });
                const gcsUri = videoUrl.replace(
                    'https://storage.googleapis.com/ai-mp-media/',
                    'gs://ai-mp-media/'
                );
                const analysis = await analyzeGolfSwing(gcsUri, mimeType || 'video/mp4');
                const record = await prisma.userSwingAnalysis.create({
                    data: { userId, personaId, videoUrl, analysisJson: JSON.stringify(analysis) },
                });
                return res.status(200).json({ id: record.id, analysis, createdAt: record.createdAt });
            } catch (e: any) {
                console.error('[swing analyze]', e);
                return res.status(500).json({ error: '분석 실패: ' + (e.message || '알 수 없는 오류') });
            }
        }

        // GET /api/swing-analysis?personaId=xxx
        if (!seg1 && req.method === 'GET') {
            try {
                const personaId = req.query.personaId as string | undefined;
                const records = await prisma.userSwingAnalysis.findMany({
                    where: { userId, ...(personaId ? { personaId } : {}) },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                });
                return res.status(200).json(records.map(r => ({
                    id: r.id,
                    videoUrl: r.videoUrl,
                    createdAt: r.createdAt,
                    analysis: JSON.parse(r.analysisJson),
                })));
            } catch (e: any) {
                console.error('[swing GET]', e);
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        // DELETE /api/swing-analysis/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                const record = await prisma.userSwingAnalysis.findFirst({
                    where: { id: parseInt(seg1), userId },
                });
                if (!record) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
                await prisma.userSwingAnalysis.delete({ where: { id: record.id } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[swing DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
