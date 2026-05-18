import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './_lib/prisma.js';
import { signToken, setTokenCookie, clearTokenCookie, getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { sendEmail } from './_lib/email.js';
import { sendSms } from './_lib/sms.js';
import { generateEmbedding } from './_lib/embedding.js';
import { extractMemories, generateSummary, extractTriggerKeywords, analyzeGolfSwing, compareDocuments, analyzeFaceReading, generateQuickMenuResult } from './_lib/gemini.js';
import { uploadToGCS, deleteFromGCS, generateSignedUrl } from './_lib/storage.js';

const MEMORY_ANALYSIS_CATS = ['swing_analysis', 'saju_analysis'];
const MAX_USER_MEMORIES = 100;

async function saveMemoryIfNew(
    userId: number,
    content: string,
    embedding: number[] | null,
    category: string | null
): Promise<boolean> {
    const isAnalysis = category !== null && MEMORY_ANALYSIS_CATS.includes(category);

    // 유사도 0.95 이상인 기억이 이미 있으면 중복으로 스킵 (분석 카테고리 제외)
    if (!isAnalysis && embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        const similar = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "UserMemory"
             WHERE "userId" = $1 AND "embedding" IS NOT NULL
               AND "category" != ALL($3::text[])
               AND 1 - ("embedding" <=> $2::vector) > 0.95
             LIMIT 1`,
            userId, vectorStr, MEMORY_ANALYSIS_CATS
        );
        if (similar.length > 0) return false;
    }

    // 저장
    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
    await prisma.$queryRawUnsafe(
        `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
         VALUES ($1, $2, $3::vector, $4, NOW())`,
        userId, content, vectorStr, category
    );

    // 일반 기억만 100개 제한 — 초과분 중 가장 오래된 것 삭제 (분석 카테고리 제외)
    if (!isAnalysis) {
        const excess = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "UserMemory"
             WHERE "userId" = $1 AND ("category" IS NULL OR "category" != ALL($2::text[]))
             ORDER BY "createdAt" ASC
             OFFSET $3`,
            userId, MEMORY_ANALYSIS_CATS, MAX_USER_MEMORIES
        );
        if (excess.length > 0) {
            const ids = excess.map((r: any) => r.id);
            await prisma.$queryRawUnsafe(
                `DELETE FROM "UserMemory" WHERE "id" = ANY($1::int[])`,
                ids
            );
        }
    }

    return true;
}

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
            const { identifier, password } = req.body;
            if (!identifier || !password) return res.status(400).json({ error: '이메일(전화번호)과 비밀번호를 입력해주세요.' });
            const normalized = identifier.replace(/-/g, '');
            const isPhoneId = /^\d{10,11}$/.test(normalized);
            try {
                const user = await prisma.user.findUnique({
                    where: isPhoneId ? { phone: normalized } : { email: identifier },
                    include: { personaXps: { select: { personaId: true, xp: true } } },
                });
                if (!user) return res.status(401).json({ error: '이메일(전화번호) 또는 비밀번호가 올바르지 않습니다.' });
                const valid = await bcrypt.compare(password, user.password);
                if (!valid) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
                return res.status(200).json({ user: { id: user.id, email: user.email, phone: user.phone, username: user.username, role: user.role, paidPoints: user.paidPoints, bonusPoints: user.bonusPoints, personaXp }, token });
            } catch (e: any) {
                console.error('[login]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/auth/register
        if (seg1 === 'register' && req.method === 'POST') {
            const { email, phone, password, username } = req.body;
            if (!password) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
            if (!email && !phone) return res.status(400).json({ error: '이메일 또는 전화번호를 입력해주세요.' });
            const rawPhone = phone?.replace(/-/g, '');
            try {
                if (email) {
                    const ex = await prisma.user.findUnique({ where: { email } });
                    if (ex) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
                }
                if (rawPhone) {
                    const ex = await prisma.user.findUnique({ where: { phone: rawPhone } });
                    if (ex) return res.status(409).json({ error: '이미 사용 중인 전화번호입니다.' });
                }
                const hashed = await bcrypt.hash(password, 10);
                const user = await prisma.user.create({
                    data: { email: email || null, phone: rawPhone || null, password: hashed, username },
                    select: { id: true, email: true, phone: true, username: true, role: true, paidPoints: true, bonusPoints: true },
                });
                const { grantSignupPoints } = await import('./_lib/points.js');
                await grantSignupPoints(prisma, user.id);
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                return res.status(201).json({ user: { ...user, bonusPoints: 500, personaXp: {} }, token });
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
                return res.status(200).json({ user: { id: user.id, email: user.email, phone: user.phone, username: user.username, role: user.role, personaXp } });
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
                    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                    const expiry = new Date(Date.now() + 30 * 60 * 1000);
                    await prisma.user.update({ where: { email }, data: { resetToken: tokenHash, resetTokenExpiry: expiry } });
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

        // POST /api/auth/send-code (전화번호 비밀번호 찾기용 SMS 인증코드)
        if (seg1 === 'send-code' && req.method === 'POST') {
            const { phone } = req.body || {};
            if (!phone) return res.status(400).json({ error: '전화번호를 입력해주세요.' });
            const rawPhone = phone.replace(/-/g, '');
            try {
                const user = await prisma.user.findUnique({ where: { phone: rawPhone } });
                if (user) {
                    const code = Math.floor(100000 + Math.random() * 900000).toString();
                    const tokenHash = crypto.createHash('sha256').update(code).digest('hex');
                    const expiry = new Date(Date.now() + 10 * 60 * 1000);
                    await prisma.user.update({ where: { phone: rawPhone }, data: { resetToken: tokenHash, resetTokenExpiry: expiry } });
                    await sendSms(rawPhone, `[AI 페르소나] 인증번호: ${code} (10분 유효)`);
                }
                return res.json({ message: '인증코드를 발송했습니다.' });
            } catch (e: any) {
                console.error('[send-code]', e.message);
                return res.status(500).json({ error: 'SMS 전송에 실패했습니다.' });
            }
        }

        // POST /api/auth/send-verify (회원가입 인증코드 발송 — 이메일/전화 공용)
        if (seg1 === 'send-verify' && req.method === 'POST') {
            const { type, identifier } = req.body || {};
            if (!type || !identifier) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
            if (type !== 'EMAIL' && type !== 'PHONE') return res.status(400).json({ error: '유효하지 않은 인증 유형입니다.' });
            const normalizedId = type === 'PHONE' ? identifier.replace(/-/g, '') : identifier.toLowerCase().trim();
            try {
                // 이미 가입된 계정 확인
                if (type === 'EMAIL') {
                    const ex = await prisma.user.findUnique({ where: { email: normalizedId } });
                    if (ex) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
                } else {
                    const ex = await prisma.user.findUnique({ where: { phone: normalizedId } });
                    if (ex) return res.status(409).json({ error: '이미 사용 중인 전화번호입니다.' });
                }
                const existing = await prisma.pendingVerification.findUnique({ where: { identifier: normalizedId } });
                const now = new Date();
                if (existing) {
                    const secondsSinceLast = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
                    if (secondsSinceLast < 60) {
                        const wait = Math.ceil(60 - secondsSinceLast);
                        return res.status(429).json({ error: `${wait}초 후에 다시 시도해주세요.` });
                    }
                    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    if (existing.lastSentAt > dayAgo && existing.sentCount >= 5) {
                        return res.status(429).json({ error: '일일 발송 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.' });
                    }
                }
                const code = String(Math.floor(100000 + Math.random() * 900000));
                const codeHash = crypto.createHash('sha256').update(code).digest('hex');
                const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
                const newSentCount = existing && existing.lastSentAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    ? existing.sentCount + 1 : 1;
                await prisma.pendingVerification.upsert({
                    where: { identifier: normalizedId },
                    create: { type, identifier: normalizedId, codeHash, expiresAt, sentCount: 1, lastSentAt: now },
                    update: { type, codeHash, expiresAt, attempts: 0, sentCount: newSentCount, lastSentAt: now },
                });
                if (type === 'EMAIL') {
                    await sendEmail(normalizedId, '[AI 페르소나] 이메일 인증번호',
                        `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:32px;background:#0f0f1a;border-radius:12px;color:#e2e8f0;">
                            <h2 style="color:#a78bfa;margin:0 0 16px;">이메일 인증</h2>
                            <p style="margin:0 0 24px;color:#94a3b8;">아래 6자리 인증번호를 입력해주세요. (10분 유효)</p>
                            <div style="font-size:36px;font-weight:900;letter-spacing:10px;text-align:center;padding:24px;background:#1e1b4b;border-radius:8px;color:#c4b5fd;">${code}</div>
                            <p style="margin:24px 0 0;font-size:12px;color:#64748b;">본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
                        </div>`
                    );
                } else {
                    await sendSms(normalizedId, `[AI 페르소나] 인증번호: ${code} (10분 유효)`);
                }
                return res.json({ message: '인증코드를 발송했습니다.' });
            } catch (e: any) {
                console.error('[send-verify]', e.message);
                return res.status(500).json({ error: '인증코드 발송에 실패했습니다.' });
            }
        }

        // POST /api/auth/verify-register (인증 확인 + 계정 생성)
        if (seg1 === 'verify-register' && req.method === 'POST') {
            const { type, identifier, code, password, username } = req.body || {};
            if (!type || !identifier || !code || !password) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
            if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
            const normalizedId = type === 'PHONE' ? identifier.replace(/-/g, '') : identifier.toLowerCase().trim();
            try {
                const pending = await prisma.pendingVerification.findUnique({ where: { identifier: normalizedId } });
                if (!pending) return res.status(400).json({ error: '인증을 먼저 요청해주세요.' });
                if (new Date() > pending.expiresAt) {
                    await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
                    return res.status(400).json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' });
                }
                if (pending.attempts >= 5) {
                    await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
                    return res.status(400).json({ error: '인증번호 입력 횟수를 초과했습니다. 다시 요청해주세요.' });
                }
                const codeHash = crypto.createHash('sha256').update(code).digest('hex');
                if (codeHash !== pending.codeHash) {
                    await prisma.pendingVerification.update({
                        where: { identifier: normalizedId },
                        data: { attempts: { increment: 1 } },
                    });
                    const remaining = 4 - pending.attempts;
                    return res.status(400).json({ error: `인증번호가 올바르지 않습니다. (남은 시도: ${remaining}회)` });
                }
                // 가입 처리
                if (type === 'EMAIL') {
                    const ex = await prisma.user.findUnique({ where: { email: normalizedId } });
                    if (ex) { await prisma.pendingVerification.delete({ where: { identifier: normalizedId } }); return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' }); }
                } else {
                    const ex = await prisma.user.findUnique({ where: { phone: normalizedId } });
                    if (ex) { await prisma.pendingVerification.delete({ where: { identifier: normalizedId } }); return res.status(409).json({ error: '이미 사용 중인 전화번호입니다.' }); }
                }
                const hashed = await bcrypt.hash(password, 10);
                const userData = type === 'EMAIL'
                    ? { email: normalizedId, phone: null as string | null, password: hashed, username: username || undefined }
                    : { email: null as string | null, phone: normalizedId, password: hashed, username: username || undefined };
                const user = await prisma.user.create({
                    data: userData,
                    select: { id: true, email: true, phone: true, username: true, role: true, paidPoints: true, bonusPoints: true },
                });
                const { grantSignupPoints } = await import('./_lib/points.js');
                await grantSignupPoints(prisma, user.id);
                await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
                const token = signToken(user.id);
                res.setHeader('Set-Cookie', setTokenCookie(token));
                return res.status(201).json({ user: { ...user, bonusPoints: 500, personaXp: {} }, token });
            } catch (e: any) {
                console.error('[verify-register]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/auth/reset-password
        if (seg1 === 'reset-password' && req.method === 'POST') {
            const { token, password } = req.body || {};
            if (!token || !password) return res.status(400).json({ error: '토큰과 새 비밀번호를 입력해주세요.' });
            if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
            try {
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const user = await prisma.user.findFirst({
                    where: { resetToken: tokenHash, resetTokenExpiry: { gt: new Date() } },
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

        // POST /api/auth/change-password
        if (seg1 === 'change-password' && req.method === 'POST') {
            const { currentPassword, newPassword } = req.body || {};
            if (!currentPassword || !newPassword) return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
            if (newPassword.length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                const match = await bcrypt.compare(currentPassword, user.password);
                if (!match) return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
                const hashed = await bcrypt.hash(newPassword, 10);
                await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
                return res.json({ message: '비밀번호가 변경되었습니다.' });
            } catch {
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Categories ────────────────────────────────────────────
    if (domain === 'categories') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/categories (public)
        if (!seg1 && req.method === 'GET') {
            try {
                const categories = await prisma.category.findMany({
                    orderBy: { order: 'asc' },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
                return res.status(200).json(categories);
            } catch (e: any) {
                console.error('[categories GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/categories
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, order } = req.body;
                if (!name?.trim()) return res.status(400).json({ error: '카테고리 이름은 필수입니다.' });
                const count = await prisma.category.count();
                const category = await prisma.category.create({
                    data: { name: name.trim(), order: order ?? count },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                return res.status(201).json(category);
            } catch (e: any) {
                if (e.code === 'P2002') return res.status(400).json({ error: '이미 존재하는 카테고리 이름입니다.' });
                console.error('[categories POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/categories/:id
        if (seg1 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, order } = req.body;
                const category = await prisma.category.update({
                    where: { id: Number(seg1) },
                    data: { ...(name !== undefined && { name: name.trim() }), ...(order !== undefined && { order }) },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                return res.status(200).json(category);
            } catch (e: any) {
                console.error('[categories PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/categories/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const catId = Number(seg1);
                await prisma.persona.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
                await prisma.category.delete({ where: { id: catId } });
                return res.status(200).json({ message: '삭제되었습니다.' });
            } catch (e: any) {
                console.error('[categories DELETE]', e?.message, e?.code);
                return res.status(500).json({ error: e?.message || '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── App Settings ──────────────────────────────────────────
    if (domain === 'settings') {
        if (req.method === 'GET') {
            const configs = await prisma.appConfig.findMany();
            const result: Record<string, string> = {};
            configs.forEach((c: any) => {
                if (!c.key.startsWith('memory_enabled_')) result[c.key] = c.value;
            });
            // 로그인된 유저라면 자신의 memory_enabled 읽기
            try {
                const token = getTokenFromRequest(req);
                if (token) {
                    const { userId } = verifyToken(token);
                    const userCfg = await prisma.appConfig.findUnique({ where: { key: `memory_enabled_${userId}` } });
                    if (userCfg) result.memory_enabled = userCfg.value;
                }
            } catch {}
            return res.json(result);
        }
        if (req.method === 'PUT') {
            const token = getTokenFromRequest(req);
            if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
            let userId: number;
            let isAdmin = false;
            try {
                const payload = verifyToken(token);
                userId = payload.userId;
                const user = await prisma.user.findUnique({ where: { id: userId } });
                isAdmin = user?.role === 'ADMIN';
            } catch {
                return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
            }
            const updates = req.body as Record<string, string>;
            await Promise.all(
                Object.entries(updates).map(async ([key, value]) => {
                    if (key === 'memory_enabled') {
                        // 유저별 독립 저장
                        const userKey = `memory_enabled_${userId}`;
                        return prisma.appConfig.upsert({
                            where: { key: userKey },
                            update: { value: String(value), updatedAt: new Date() },
                            create: { key: userKey, value: String(value) },
                        });
                    }
                    if (!isAdmin) return Promise.resolve();
                    if (key === 'heroImageUrl' && String(value).startsWith('data:')) {
                        const mimeType = String(value).split(';')[0].split(':')[1] || 'image/jpeg';
                        const ext = mimeType.split('/')[1] || 'jpg';
                        const base64Data = String(value).split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');
                        const gcsUrl = await uploadToGCS(buffer, `hero/hero-image.${ext}`, mimeType);
                        return prisma.appConfig.upsert({
                            where: { key },
                            update: { value: gcsUrl, updatedAt: new Date() },
                            create: { key, value: gcsUrl },
                        });
                    }
                    return prisma.appConfig.upsert({
                        where: { key },
                        update: { value: String(value), updatedAt: new Date() },
                        create: { key, value: String(value) },
                    });
                })
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

        // GET /api/personas — 전체 반환, 필터링은 프론트에서 처리
        if (!seg1 && req.method === 'GET') {
            try {
                const personas = await prisma.persona.findMany({
                    orderBy: { order: 'asc' },
                    include: { category: true },
                });
                res.setHeader('Cache-Control', 'no-store');
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
                const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, introVideoUrl, chatBgUrl, order } = req.body;
                if (!name || !systemInstruction) return res.status(400).json({ error: '이름과 시스템 프롬프트는 필수입니다.' });
                const count = await prisma.persona.count();
                const persona = await prisma.persona.create({
                    data: { name, jobTitle: jobTitle || null, description, systemInstruction, iconName: iconName || 'Bot', colorClass: colorClass || 'from-blue-500 to-cyan-500', imageUrl, introVideoUrl: introVideoUrl || null, chatBgUrl: chatBgUrl || null, order: order ?? count, isDefault: false, createdBy: userId },
                });
                return res.status(201).json(persona);
            } catch (e: any) {
                console.error('[personas POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/personas/:id
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, introVideoUrl, starVideoUrl, faceReadingBgUrl, chatBgUrl, quickMenuJson, order, isVisible, adminOnly, categoryId } = req.body;
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: {
                        name, jobTitle: jobTitle ?? null, description, systemInstruction, iconName, colorClass,
                        imageUrl, introVideoUrl: introVideoUrl ?? null, starVideoUrl: starVideoUrl ?? null,
                        faceReadingBgUrl: faceReadingBgUrl ?? null,
                        chatBgUrl: chatBgUrl ?? null,
                        quickMenuJson: quickMenuJson ?? null, order,
                        ...(isVisible !== undefined && { isVisible }),
                        ...(adminOnly !== undefined && { adminOnly }),
                        categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
                    },
                    include: { category: true },
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

        // GET /api/personas/:id/intro-video/upload-url
        if (seg1 && seg2 === 'intro-video' && seg3 === 'upload-url' && req.method === 'GET') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const mimeType = (req.query.mimeType as string) || 'video/mp4';
                const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
                const destPath = `personas/${seg1}/intro/${Date.now()}.${ext}`;
                const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json({ signedUrl, publicUrl });
            } catch (e: any) {
                console.error('[personas intro-video upload-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/intro-video — GCS 직접 업로드 후 publicUrl 저장
        if (seg1 && seg2 === 'intro-video' && !seg3 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { videoUrl } = req.body;
                if (!videoUrl) return res.status(400).json({ error: 'videoUrl은 필수입니다.' });
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { introVideoUrl: videoUrl },
                });
                return res.status(200).json(persona);
            } catch (e: any) {
                console.error('[personas intro-video POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id/intro-video
        if (seg1 && seg2 === 'intro-video' && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
                if (persona?.introVideoUrl) {
                    await deleteFromGCS(persona.introVideoUrl).catch(() => {});
                }
                const updated = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { introVideoUrl: null },
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error('[personas intro-video DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/personas/:id/star-video/upload-url
        if (seg1 && seg2 === 'star-video' && seg3 === 'upload-url' && req.method === 'GET') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const mimeType = (req.query.mimeType as string) || 'video/mp4';
                const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
                const destPath = `personas/${seg1}/balloon/${Date.now()}.${ext}`;
                const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json({ signedUrl, publicUrl });
            } catch (e: any) {
                console.error('[personas star-video upload-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/star-video — GCS 직접 업로드 후 publicUrl 저장
        if (seg1 && seg2 === 'star-video' && !seg3 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { videoUrl } = req.body;
                if (!videoUrl) return res.status(400).json({ error: 'videoUrl은 필수입니다.' });
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { starVideoUrl: videoUrl },
                });
                return res.status(200).json(persona);
            } catch (e: any) {
                console.error('[personas star-video POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id/star-video
        if (seg1 && seg2 === 'star-video' && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
                if (persona?.starVideoUrl) {
                    await deleteFromGCS(persona.starVideoUrl).catch(() => {});
                }
                const updated = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { starVideoUrl: null },
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error('[personas star-video DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/personas/:id/face-reading-bg/upload-url
        if (seg1 && seg2 === 'face-reading-bg' && seg3 === 'upload-url' && req.method === 'GET') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const mimeType = (req.query.mimeType as string) || 'image/jpeg';
                const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
                const destPath = `personas/${seg1}/face-reading-bg/${Date.now()}.${ext}`;
                const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json({ signedUrl, publicUrl });
            } catch (e: any) {
                console.error('[personas face-reading-bg upload-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/face-reading-bg
        if (seg1 && seg2 === 'face-reading-bg' && !seg3 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageUrl } = req.body;
                if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { faceReadingBgUrl: imageUrl },
                });
                return res.status(200).json(persona);
            } catch (e: any) {
                console.error('[personas face-reading-bg POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id/face-reading-bg
        if (seg1 && seg2 === 'face-reading-bg' && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
                if (persona?.faceReadingBgUrl) {
                    await deleteFromGCS(persona.faceReadingBgUrl).catch(() => {});
                }
                const updated = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { faceReadingBgUrl: null },
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error('[personas face-reading-bg DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/personas/:id/chat-bg/upload-url
        if (seg1 && seg2 === 'chat-bg' && seg3 === 'upload-url' && req.method === 'GET') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const mimeType = (req.query.mimeType as string) || 'image/png';
                const ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
                const destPath = `personas/${seg1}/bg/${Date.now()}.${ext}`;
                const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json({ signedUrl, publicUrl });
            } catch (e: any) {
                console.error('[personas chat-bg upload-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/chat-bg — JSON 배열 전체 저장
        if (seg1 && seg2 === 'chat-bg' && !seg3 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageUrl } = req.body;
                if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
                const persona = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { chatBgUrl: imageUrl },
                });
                return res.status(200).json(persona);
            } catch (e: any) {
                console.error('[personas chat-bg POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/personas/:id/chat-bg/remove — 특정 URL 제거 + GCS 삭제
        if (seg1 && seg2 === 'chat-bg' && seg3 === 'remove' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { url } = req.body as { url: string };
                if (!url) return res.status(400).json({ error: 'url은 필수입니다.' });
                const persona = await prisma.persona.findUnique({ where: { id: seg1 }, select: { chatBgUrl: true } });
                let urls: string[] = [];
                try { urls = JSON.parse(persona?.chatBgUrl || '[]'); } catch { urls = persona?.chatBgUrl ? [persona.chatBgUrl] : []; }
                const newUrls = urls.filter(u => u !== url);
                await deleteFromGCS(url).catch(() => {});
                const updated = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { chatBgUrl: newUrls.length ? JSON.stringify(newUrls) : null },
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error('[personas chat-bg/remove POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/personas/:id/chat-bg — 전체 제거
        if (seg1 && seg2 === 'chat-bg' && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
                if (persona?.chatBgUrl) {
                    let urls: string[] = [];
                    try { urls = JSON.parse(persona.chatBgUrl); } catch { urls = [persona.chatBgUrl]; }
                    for (const u of urls) await deleteFromGCS(u).catch(() => {});
                }
                const updated = await prisma.persona.update({
                    where: { id: seg1 },
                    data: { chatBgUrl: null },
                });
                return res.status(200).json(updated);
            } catch (e: any) {
                console.error('[personas chat-bg DELETE]', e);
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
                        const { deductPointsForMessage } = await import('./_lib/points.js');
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

    // ── User Profile ──────────────────────────────────────────
    if (domain === 'user') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // GET /api/user/birth-info
        if (seg1 === 'birth-info' && req.method === 'GET') {
            try {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { birthInfoJson: true } });
                return res.status(200).json({ birthInfoJson: user?.birthInfoJson ?? null });
            } catch (e) {
                console.error('[user/birth-info GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // PUT /api/user/birth-info
        if (seg1 === 'birth-info' && req.method === 'PUT') {
            try {
                const { birthInfoJson } = req.body;
                if (typeof birthInfoJson !== 'string') return res.status(400).json({ error: '잘못된 요청' });
                await prisma.user.update({ where: { id: userId }, data: { birthInfoJson } });
                return res.status(200).json({ ok: true });
            } catch (e) {
                console.error('[user/birth-info PUT]', e);
                return res.status(500).json({ error: '서버 오류' });
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
                const ok = await saveMemoryIfNew(userId, content, embedding, category || null);
                if (!ok) return res.status(200).json({ skipped: true, message: '유사한 기억이 이미 존재합니다.' });
                const result = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "userId", "content", "category", "createdAt"
                     FROM "UserMemory" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
                    userId
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
                const ANALYSIS_CATEGORIES = ['swing_analysis', 'saju_analysis'];

                // 분석 카테고리는 유사도 무관 항상 포함 (임베딩 실패해도 누락 방지)
                const analysisMemories = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "content", "category", 1.0 AS similarity
                     FROM "UserMemory"
                     WHERE "userId" = $1 AND "category" = ANY($2::text[])`,
                    userId, ANALYSIS_CATEGORIES
                );

                // 쿼리 ①: 사용자 메시지 기반 유사도 검색 (대화 맥락 관련 기억)
                // 쿼리 ②: 고정 신상 쿼리로 이름·직업 등 핵심 정보 항상 검색
                const IDENTITY_QUERY = '이름 나이 직업 거주지 가족';
                const identityEmbedding = await generateEmbedding(IDENTITY_QUERY);

                let contextMemories: any[] = [];
                let identityMemories: any[] = [];

                if (embedding) {
                    const vectorStr = `[${embedding.join(',')}]`;
                    contextMemories = await prisma.$queryRawUnsafe<any[]>(
                        `SELECT "id", "content", "category",
                                1 - ("embedding" <=> $2::vector) AS similarity
                         FROM "UserMemory"
                         WHERE "userId" = $1 AND "embedding" IS NOT NULL
                           AND "category" != ALL($3::text[])
                           AND 1 - ("embedding" <=> $2::vector) > 0.72
                         ORDER BY "embedding" <=> $2::vector
                         LIMIT 4`,
                        userId, vectorStr, ANALYSIS_CATEGORIES
                    );
                }

                if (identityEmbedding) {
                    const idVectorStr = `[${identityEmbedding.join(',')}]`;
                    identityMemories = await prisma.$queryRawUnsafe<any[]>(
                        `SELECT "id", "content", "category",
                                1 - ("embedding" <=> $2::vector) AS similarity
                         FROM "UserMemory"
                         WHERE "userId" = $1 AND "embedding" IS NOT NULL
                           AND "category" != ALL($3::text[])
                           AND 1 - ("embedding" <=> $2::vector) > 0.72
                         ORDER BY "embedding" <=> $2::vector
                         LIMIT 2`,
                        userId, idVectorStr, ANALYSIS_CATEGORIES
                    );
                }

                // 합쳐서 반환 (분석 > 신상 > 맥락 순, 중복 제거)
                const seen = new Set<number>();
                const memories = [...analysisMemories, ...identityMemories, ...contextMemories].filter(r => {
                    if (seen.has(r.id)) return false;
                    seen.add(r.id);
                    return true;
                });
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

        // POST /api/knowledge — 텍스트 업로드 → 중복 제목 비교 → 청크 분할 → 임베딩 → 저장
        if (req.method === 'POST' && !seg1) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { personaId, title, text } = req.body;
                if (!personaId || !text) return res.status(400).json({ error: 'personaId와 text는 필수입니다.' });

                let isReplaced = false;
                // 같은 제목의 문서가 이미 있으면 Gemini로 품질 비교
                if (title) {
                    const existing = await prisma.$queryRawUnsafe<{ sourceId: string; fullText: string }[]>(
                        `SELECT "sourceId", STRING_AGG("content", E'\n\n' ORDER BY "id") AS "fullText"
                         FROM "PersonaKnowledge"
                         WHERE "personaId" = $1 AND "title" = $2
                         GROUP BY "sourceId" LIMIT 1`,
                        personaId, title
                    );
                    if (existing.length > 0) {
                        const winner = await compareDocuments(existing[0].fullText, text);
                        if (winner === 'OLD') {
                            return res.status(200).json({ saved: 0, total: 0, action: 'kept_existing', message: '기존 문서가 더 품질이 높아 유지했습니다.' });
                        }
                        // 새 문서가 더 나음 → 기존 삭제 후 교체
                        await prisma.personaKnowledge.deleteMany({ where: { sourceId: existing[0].sourceId } });
                        isReplaced = true;
                    }
                }

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
                return res.status(201).json({ saved, total: chunks.length, sourceId, action: isReplaced ? 'replaced' : 'created' });
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
                        user: { select: { username: true } },
                        replies: {
                            include: { user: { select: { username: true } } },
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

    // ── Partner Board ─────────────────────────────────────────

    if (domain === 'partner-board') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
        const payload = verifyToken(token);
        const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
        if (!me) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        const isAdmin = me.role === 'ADMIN';

        // GET /api/partner-board — 목록 (본인 글만, 관리자는 전체)
        if (!seg1 && req.method === 'GET') {
            try {
                const posts = await prisma.partnerPost.findMany({
                    where: isAdmin ? undefined : { userId: me.id },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, title: true, createdAt: true, userId: true,
                        user: { select: { username: true, email: true } },
                        _count: { select: { replies: true } },
                    },
                });
                return res.status(200).json(posts);
            } catch (e: any) {
                console.error('[partner-board GET]', e);
                return res.status(500).json({ error: '목록 조회 실패' });
            }
        }

        // POST /api/partner-board — 게시글 작성
        if (!seg1 && req.method === 'POST') {
            try {
                const { title, content, contact } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                const post = await prisma.partnerPost.create({
                    data: { userId: me.id, title: title.trim(), content: content.trim(), contact: contact?.trim() || null },
                });
                try {
                    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
                    for (const admin of admins) {
                        await sendEmail(admin.email, '[AI 페르소나] 제휴 게시판 새 문의가 등록되었습니다',
                            `<div style="font-family:sans-serif;padding:24px;"><h2>새 제휴 문의가 등록되었습니다</h2><p>제목: <strong>${title.trim()}</strong></p></div>`
                        ).catch(() => {});
                    }
                } catch {}
                return res.status(200).json({ id: post.id });
            } catch (e: any) {
                console.error('[partner-board POST]', e);
                return res.status(500).json({ error: '게시글 등록 실패' });
            }
        }

        // GET /api/partner-board/:id — 상세 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const post = await prisma.partnerPost.findUnique({
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
                console.error('[partner-board GET detail]', e);
                return res.status(500).json({ error: '불러오기 실패' });
            }
        }

        // PUT /api/partner-board/:id — 수정
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '수정 권한이 없습니다.' });
                const { title, content } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                await prisma.partnerPost.update({
                    where: { id: parseInt(seg1) },
                    data: { title: title.trim(), content: content.trim() },
                });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board PUT]', e);
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/partner-board/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.partnerPost.delete({ where: { id: parseInt(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }

        // POST /api/partner-board/:id/reply — 답글 작성
        if (seg1 && seg2 === 'reply' && !seg3 && req.method === 'POST') {
            try {
                const postId = parseInt(seg1);
                const { content } = req.body;
                if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
                const post = await prisma.partnerPost.findUnique({
                    where: { id: postId },
                    include: { user: { select: { email: true, username: true } } },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                const isAuthor = post.userId === me.id;
                if (!isAdmin && !isAuthor)
                    return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
                const reply = await prisma.partnerReply.create({
                    data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
                });
                if (isAdmin && !isAuthor) {
                    sendEmail(post.user.email, '[AI 페르소나] 제휴 게시판 답글이 등록되었습니다',
                        `<div style="font-family:sans-serif;padding:24px;"><h2>관리자 답글이 등록되었습니다</h2><p>게시글: <strong>${post.title}</strong></p></div>`
                    ).catch(() => {});
                }
                return res.status(200).json({ id: reply.id });
            } catch (e: any) {
                console.error('[partner-board reply POST]', e);
                return res.status(500).json({ error: '답글 등록 실패' });
            }
        }

        // DELETE /api/partner-board/:id/reply/:replyId — 답글 삭제
        if (seg1 && seg2 === 'reply' && seg3 && req.method === 'DELETE') {
            try {
                const reply = await prisma.partnerReply.findUnique({ where: { id: parseInt(seg3) } });
                if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
                if (reply.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.partnerReply.delete({ where: { id: parseInt(seg3) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board reply DELETE]', e);
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
                const { videoUrl, personaId, mimeType, fileName } = req.body;
                if (!videoUrl || !personaId) return res.status(400).json({ error: '필수 항목 누락' });
                const swingUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                try {
                    const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                    const { deductMenuPoints } = await import('./_lib/points.js');
                    const { pointsCost } = await checkMenuAccess(prisma, userId, swingUser?.role ?? 'USER', 'golf');
                    await deductMenuPoints(prisma, userId, pointsCost, '스윙 분석');
                } catch (e: any) {
                    if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                    if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                    throw e;
                }
                const gcsUri = videoUrl.replace(
                    'https://storage.googleapis.com/ai-mp-media/',
                    'gs://ai-mp-media/'
                );
                const analysis = await analyzeGolfSwing(gcsUri, mimeType || 'video/mp4');
                // 분석 완료 즉시 GCS에서 영상 삭제 (개인정보 보호)
                await deleteFromGCS(videoUrl).catch(() => {});
                const record = await prisma.userSwingAnalysis.create({
                    data: { userId, personaId, fileName: fileName || null, analysisJson: JSON.stringify(analysis) },
                });

                // UserMemory에 최신 스윙 분석 요약 upsert
                try {
                    const a = analysis as any;
                    const date = new Date().toISOString().slice(0, 10);
                    const secs: any[] = a.sections || [];
                    const scoresStr = secs.map((s: any) => `${s.name.replace(' & 셋업', '')} ${s.score}점`).join(' / ');
                    const priorities = (a.topPriorities || []).slice(0, 3).join(' / ');
                    const memContent = `[골프 스윙 분석 - ${date}] 종합 ${a.overallScore}점\n구간: ${scoresStr}\n주요 개선점: ${priorities}`;
                    const embedding = await generateEmbedding(memContent);
                    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
                    await prisma.$executeRawUnsafe(
                        `DELETE FROM "UserMemory" WHERE "userId" = $1 AND "category" = 'swing_analysis'`,
                        userId
                    );
                    await prisma.$executeRawUnsafe(
                        `INSERT INTO "UserMemory" ("userId","content","embedding","category","createdAt") VALUES ($1,$2,$3::vector,'swing_analysis',NOW())`,
                        userId, memContent, vectorStr
                    );
                } catch (memErr: any) {
                    console.warn('[swing memory upsert]', memErr.message);
                }

                return res.status(200).json({ id: record.id, analysis, createdAt: record.createdAt });
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
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
                    fileName: r.fileName,
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

    // ── Announcements ─────────────────────────────────────────
    if (domain === 'announcements') {
        // GET /api/announcements  → 공개: visible만 / 어드민: ?all=true 로 전체
        if (!seg1 && req.method === 'GET') {
            try {
                let isAdmin = false;
                try {
                    const token = getTokenFromRequest(req);
                    if (token) {
                        const { userId } = verifyToken(token);
                        const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                        isAdmin = u?.role === 'ADMIN';
                    }
                } catch {}
                const showAll = isAdmin && req.query.all === 'true';
                const list = await prisma.announcement.findMany({
                    where: showAll ? {} : { isVisible: true },
                    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                if (!showAll) res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
                return res.status(200).json(list);
            } catch (e: any) {
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const u = await prisma.user.findUnique({ where: { id: userId } });
            if (!u || u.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // POST /api/announcements
        if (!seg1 && req.method === 'POST') {
            try {
                if (!await requireAdmin()) return;
                const { title, content, category, isPinned, isVisible, personaId } = req.body;
                if (!title || !content) return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
                const item = await prisma.announcement.create({
                    data: { title, content, category: category || 'update', isPinned: isPinned ?? false, isVisible: isVisible ?? true, personaId: personaId || null },
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                return res.status(201).json(item);
            } catch (e: any) { return res.status(500).json({ error: '저장 실패' }); }
        }

        // PUT /api/announcements/:id
        if (seg1 && req.method === 'PUT') {
            try {
                if (!await requireAdmin()) return;
                const { title, content, category, isPinned, isVisible, personaId } = req.body;
                const item = await prisma.announcement.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(content !== undefined && { content }),
                        ...(category !== undefined && { category }),
                        ...(isPinned !== undefined && { isPinned }),
                        ...(isVisible !== undefined && { isVisible }),
                        ...(personaId !== undefined && { personaId: personaId || null }),
                    },
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                return res.status(200).json(item);
            } catch (e: any) { return res.status(500).json({ error: '수정 실패' }); }
        }

        // DELETE /api/announcements/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                if (!await requireAdmin()) return;
                await prisma.announcement.delete({ where: { id: Number(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) { return res.status(500).json({ error: '삭제 실패' }); }
        }
    }

    // ── Cron Cleanup ───────────────────────────────────────────
    if (domain === 'cron-cleanup') {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: '인증 실패' });
        }
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const staleSessions = await prisma.chatSession.findMany({
                where: { updatedAt: { lt: cutoff }, summary: { isNot: null } },
                select: { id: true },
            });
            let deletedMessages = 0, cleanedSessions = 0;
            for (const s of staleSessions) {
                const keep = await prisma.message.findMany({
                    where: { sessionId: s.id },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
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
            console.log(`[cron-cleanup] ${cleanedSessions}개 세션, ${deletedMessages}개 메시지 삭제`);
            return res.status(200).json({ cleanedSessions, deletedMessages });
        } catch (e: any) {
            console.error('[cron-cleanup]', e);
            return res.status(500).json({ error: '서버 오류' });
        }
    }

    // ── Points ────────────────────────────────────────────────
    if (domain === 'points') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // GET /api/points — 잔액 + 최근 거래 내역
        if (req.method === 'GET' && !seg1) {
            try {
                const [userData, transactions] = await Promise.all([
                    prisma.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } }),
                    prisma.pointTransaction.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        take: 50,
                        include: { persona: { select: { id: true, name: true } } },
                    }),
                ]);
                return res.json({ paidPoints: userData?.paidPoints ?? 0, bonusPoints: userData?.bonusPoints ?? 0, points: (userData?.paidPoints ?? 0) + (userData?.bonusPoints ?? 0), transactions });
            } catch (e: any) {
                console.error('[points GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/points/stats — 사용 통계
        if (req.method === 'GET' && seg1 === 'stats') {
            try {
                const [txByPersona, received] = await Promise.all([
                    prisma.pointTransaction.groupBy({
                        by: ['personaId', 'type'],
                        where: { userId, amount: { lt: 0 }, personaId: { not: null } },
                        _sum: { amount: true },
                    }),
                    prisma.pointTransaction.groupBy({
                        by: ['type'],
                        where: { userId, amount: { gt: 0 } },
                        _sum: { amount: true },
                    }),
                ]);

                // 페르소나별 집계
                const personaMap: Record<string, { chat: number; menu: number; balloon: number }> = {};
                for (const row of txByPersona) {
                    const pid = row.personaId!;
                    if (!personaMap[pid]) personaMap[pid] = { chat: 0, menu: 0, balloon: 0 };
                    const abs = Math.abs(row._sum.amount ?? 0);
                    if (row.type === 'CHAT') personaMap[pid].chat += abs;
                    else if (row.type === 'MENU') personaMap[pid].menu += abs;
                    else if (row.type === 'BALLOON') personaMap[pid].balloon += abs;
                }

                const personaIds = Object.keys(personaMap);
                const [personas, firstSessions, xpRows] = await Promise.all([
                    prisma.persona.findMany({
                        where: { id: { in: personaIds } },
                        select: { id: true, name: true, imageUrl: true },
                    }),
                    prisma.chatSession.findMany({
                        where: { userId, personaId: { in: personaIds } },
                        orderBy: { createdAt: 'asc' },
                        distinct: ['personaId'],
                        select: { personaId: true, createdAt: true },
                    }),
                    prisma.userPersonaXp.findMany({
                        where: { userId, personaId: { in: personaIds } },
                        select: { personaId: true, xp: true },
                    }),
                ]);

                const firstChatMap: Record<string, string> = {};
                for (const s of firstSessions) firstChatMap[s.personaId] = s.createdAt.toISOString();
                const xpMap: Record<string, number> = {};
                for (const x of xpRows) xpMap[x.personaId] = x.xp;

                const byPersona = personaIds.map(pid => {
                    const d = personaMap[pid];
                    return {
                        personaId: pid,
                        persona: personas.find(p => p.id === pid),
                        chat: d.chat,
                        menu: d.menu,
                        balloon: d.balloon,
                        total: d.chat + d.menu + d.balloon,
                        xp: xpMap[pid] ?? 0,
                        firstChatAt: firstChatMap[pid] ?? null,
                    };
                }).sort((a, b) => b.total - a.total);

                // 수신 집계 (유형별)
                const receivedMap: Record<string, number> = {};
                for (const row of received) {
                    receivedMap[row.type] = row._sum.amount ?? 0;
                }

                return res.json({
                    byPersona,
                    received: {
                        charge: receivedMap['CHARGE'] ?? 0,
                        signup: receivedMap['SIGNUP'] ?? 0,
                        levelup: receivedMap['LEVELUP'] ?? 0,
                        admin: receivedMap['ADMIN'] ?? 0,
                    },
                });
            } catch (e: any) {
                console.error('[points/stats GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // POST /api/points/admin-grant — 어드민 포인트 직접 지급
        if (req.method === 'POST' && seg1 === 'admin-grant') {
            try {
                const requestUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                if (requestUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const { email, phone, amount, description } = req.body as { email?: string; phone?: string; amount: number; description?: string };
                const identifier = email || phone;
                if (!identifier || !amount || amount <= 0) return res.status(400).json({ error: 'email 또는 phone과 양수 amount가 필요합니다.' });
                const target = email
                    ? await prisma.user.findUnique({ where: { email }, select: { id: true, paidPoints: true, bonusPoints: true, email: true, phone: true } })
                    : await prisma.user.findUnique({ where: { phone: phone! }, select: { id: true, paidPoints: true, bonusPoints: true, email: true, phone: true } });
                if (!target) return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
                const newBonus = target.bonusPoints + amount;
                const newBalance = target.paidPoints + newBonus;
                await prisma.$transaction([
                    prisma.user.update({ where: { id: target.id }, data: { bonusPoints: newBonus } }),
                    prisma.pointTransaction.create({ data: { userId: target.id, amount, type: 'ADMIN', description: description || '관리자 지급', balanceAfter: newBalance } }),
                ]);
                return res.json({ email: target.email ?? target.phone, granted: amount, newBalance });
            } catch (e: any) {
                console.error('[points/admin-grant POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/points/cost?personaId=... — 현재 메시지 비용 조회
        if (req.method === 'GET' && seg1 === 'cost') {
            try {
                const { personaId } = req.query as { personaId?: string };
                if (!personaId) return res.status(400).json({ error: 'personaId 필요' });
                const xpRecord = await prisma.userPersonaXp.findUnique({
                    where: { userId_personaId: { userId, personaId } },
                });
                const xp = xpRecord?.xp ?? 0;
                const { getMessageCost, getStageIndex } = await import('./_lib/points.js');
                return res.json({ cost: getMessageCost(xp), stage: getStageIndex(xp) + 1, xp });
            } catch (e: any) {
                console.error('[points/cost GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Star Balloon ──────────────────────────────────────────
    if (domain === 'star') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/star — 스타 전송
        if (req.method === 'POST' && !seg1) {
            try {
                const { personaId, amount, message: msg } = req.body as { personaId: string; amount: number; message?: string };
                if (!personaId || !amount || amount < 1) return res.status(400).json({ error: '잘못된 요청' });
                const pointsSpent = amount * 10;
                const xpGain = amount * 2;

                const { getStageIndex, LEVELUP_BONUS } = await import('./_lib/points.js');

                const result = await prisma.$transaction(async (tx) => {
                    const userData = await tx.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
                    if (!userData || (userData.paidPoints + userData.bonusPoints) < pointsSpent) throw new Error('INSUFFICIENT_POINTS');
                    const bonusDeduct = Math.min(pointsSpent, userData.bonusPoints);
                    const paidDeduct = pointsSpent - bonusDeduct;
                    const newBonus = userData.bonusPoints - bonusDeduct;
                    const newPaid = userData.paidPoints - paidDeduct;
                    let newBalance = newBonus + newPaid;
                    await tx.user.update({ where: { id: userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
                    await tx.pointTransaction.create({
                        data: { userId, amount: -pointsSpent, type: 'STAR', personaId, balanceAfter: newBalance, description: `스타 ${amount}개` },
                    });
                    const balloon = await tx.star.create({
                        data: { fromUserId: userId, personaId, amount, pointsSpent, message: msg },
                    });

                    // XP 적립 (별스타 1개 = 2 XP) + 레벨업 체크
                    const xpRecord = await tx.userPersonaXp.findUnique({ where: { userId_personaId: { userId, personaId } } });
                    const currentXp = xpRecord?.xp ?? 0;
                    const oldStage = getStageIndex(currentXp);
                    const newXp = currentXp + xpGain;
                    await tx.userPersonaXp.upsert({
                        where: { userId_personaId: { userId, personaId } },
                        create: { userId, personaId, xp: newXp },
                        update: { xp: newXp },
                    });
                    const newStage = getStageIndex(newXp);
                    const leveledUp = newStage > oldStage;
                    let levelupBonus = 0;
                    if (leveledUp) {
                        levelupBonus = LEVELUP_BONUS[newStage] ?? 0;
                        if (levelupBonus > 0) {
                            const finalBonus = newBonus + levelupBonus;
                            await tx.user.update({ where: { id: userId }, data: { bonusPoints: finalBonus } });
                            await tx.pointTransaction.create({
                                data: { userId, amount: levelupBonus, type: 'LEVELUP', personaId, balanceAfter: newPaid + finalBonus, description: `${newStage}단계 달성 보너스` },
                            });
                            newBalance = newPaid + finalBonus;
                        }
                    }

                    return { balloon, newBalance, xp: newXp, leveledUp, newStage, levelupBonus };
                });

                return res.json(result);
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') {
                    return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
                }
                console.error('[star POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/star/:personaId/ranking — 페르소나 스타 랭킹
        if (req.method === 'GET' && seg1) {
            try {
                const ranking = await prisma.star.groupBy({
                    by: ['fromUserId'],
                    where: { personaId: seg1 },
                    _sum: { amount: true },
                    orderBy: { _sum: { amount: 'desc' } },
                    take: 10,
                });
                const userIds = ranking.map(r => r.fromUserId);
                const users = await prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, username: true },
                });
                const rankingResult = ranking.map(r => ({
                    user: users.find(u => u.id === r.fromUserId),
                    totalBalloons: r._sum.amount ?? 0,
                }));
                return res.json(rankingResult);
            } catch (e: any) {
                console.error('[star ranking GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Balloon Thanks ────────────────────────────────────────
    if (domain === 'star-thanks' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }
        try {
            const { personaId, amount } = req.body as { personaId: string; amount: number };
            if (!personaId || !amount) return res.status(400).json({ error: '잘못된 요청' });

            const persona = await prisma.persona.findUnique({ where: { id: personaId } });
            if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

            // 세션 찾기 또는 생성
            let session = await prisma.chatSession.findFirst({
                where: { userId, personaId },
                orderBy: { updatedAt: 'desc' },
            });
            if (!session) {
                session = await prisma.chatSession.create({
                    data: { userId, personaId, title: `${persona.name}와의 대화` },
                });
            }

            // 수량별 감사 멘트 톤 결정
            const tone = amount >= 100
                ? `사용자가 무려 별스타 ${amount}개를 보내줬습니다! 당신의 캐릭터 감성을 극대화하여, 매우 감격하고 설레는 감사 인사를 세 문장 이내로 해주세요.`
                : amount >= 10
                ? `사용자가 별스타 ${amount}개를 보내줬습니다. 당신의 캐릭터에 맞게 따뜻하고 진심 어린 감사 인사를 두 문장으로 해주세요.`
                : `사용자가 별스타 ${amount}개를 보내줬습니다. 당신의 캐릭터에 맞게 짧고 가볍게 감사 인사를 한 문장으로 해주세요.`;

            const { GoogleGenAI } = await import('@google/genai');
            const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
            if (!credsJson) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });
            const creds = JSON.parse(credsJson);
            const ai = new GoogleGenAI({ vertexai: true, project: creds.project_id, location: 'us-central1', googleAuthOptions: { credentials: creds } });

            const sysPrompt = [persona.systemInstruction, persona.identityPrompt].filter(Boolean).join('\n\n');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: sysPrompt },
                contents: [{ role: 'user', parts: [{ text: tone }] }],
            });
            const thanksText = response.text?.trim();
            if (!thanksText) return res.status(500).json({ error: '응답 생성 실패' });

            const message = await prisma.message.create({
                data: { sessionId: session.id, role: 'assistant', text: thanksText },
            });
            await prisma.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });

            return res.json({ message, sessionId: session.id });
        } catch (e: any) {
            console.error('[star-thanks]', e);
            return res.status(500).json({ error: '서버 오류' });
        }
    }

    // ── Payments (Toss) ──────────────────────────────────────
    if (domain === 'payments') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/payments/confirm — Toss 결제 확인 후 paidPoints 지급
        if (req.method === 'POST' && seg1 === 'confirm') {
            const { paymentKey, orderId, amount } = req.body as { paymentKey: string; orderId: string; amount: number };
            if (!paymentKey || !orderId || !amount) return res.status(400).json({ error: '필수 파라미터 누락' });

            const PACKAGES: Record<number, number> = { 5000: 500, 10000: 1100, 50000: 6000 };
            const points = PACKAGES[amount];
            if (!points) return res.status(400).json({ error: '유효하지 않은 결제 금액' });

            try {
                // 중복 처리 방지
                const existing = await prisma.pointTransaction.findFirst({
                    where: { userId, type: 'CHARGE', description: { contains: orderId } },
                });
                if (existing) return res.status(409).json({ error: '이미 처리된 결제입니다.' });

                // Toss 결제 서버 확인
                const secretKey = process.env.TOSS_SECRET_KEY;
                if (!secretKey) return res.status(500).json({ error: '결제 설정 오류' });
                const encoded = Buffer.from(`${secretKey}:`).toString('base64');
                const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
                    method: 'POST',
                    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentKey, orderId, amount }),
                });
                if (!tossRes.ok) {
                    const err: any = await tossRes.json().catch(() => ({}));
                    console.error('[payments/confirm] Toss API error', err);
                    return res.status(402).json({ error: err.message || '결제 확인 실패' });
                }

                // paidPoints 지급
                const userData = await prisma.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
                if (!userData) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                const newPaid = userData.paidPoints + points;
                const newBalance = newPaid + userData.bonusPoints;
                await prisma.$transaction([
                    prisma.user.update({ where: { id: userId }, data: { paidPoints: newPaid } }),
                    prisma.pointTransaction.create({
                        data: { userId, amount: points, type: 'CHARGE', description: `충전 ${orderId}`, balanceAfter: newBalance },
                    }),
                ]);
                return res.json({ success: true, points, newPaidBalance: newPaid, newBonusBalance: userData.bonusPoints, newBalance });
            } catch (e: any) {
                console.error('[payments/confirm]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Admin ─────────────────────────────────────────────────
    if (domain === 'admin') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try { ({ userId } = verifyToken(token)); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }
        const adminUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (adminUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

        // GET /api/admin/users — 전체 유저 목록
        if (req.method === 'GET' && seg1 === 'users') {
            try {
                const users = await prisma.user.findMany({
                    select: {
                        id: true, email: true, phone: true, username: true, role: true,
                        paidPoints: true, bonusPoints: true, createdAt: true,
                        _count: { select: { sessions: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                return res.json(users.map(u => ({
                    id: u.id, email: u.email, phone: u.phone, username: u.username, role: u.role,
                    paidPoints: u.paidPoints, bonusPoints: u.bonusPoints,
                    createdAt: u.createdAt, sessionCount: u._count.sessions,
                })));
            } catch (e: any) {
                console.error('[admin/users GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // POST /api/admin/change-role — 유저 역할 변경
        if (req.method === 'POST' && seg1 === 'change-role') {
            const { userId, role } = req.body as { userId: number; role: string };
            if (!userId || !role) return res.status(400).json({ error: 'userId, role 필수' });
            if (!['USER', 'ADMIN', 'MANAGE'].includes(role)) return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
            const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
            return res.json({ id: updated.id, role: updated.role });
        }

        // POST /api/admin/bulk-grant — 전체 유저 일괄 포인트 지급
        if (req.method === 'POST' && seg1 === 'bulk-grant') {
            try {
                const { amount, description } = req.body as { amount: number; description?: string };
                if (!amount || amount <= 0) return res.status(400).json({ error: '양수 amount가 필요합니다.' });
                const users = await prisma.user.findMany({ select: { id: true, paidPoints: true, bonusPoints: true } });
                await prisma.$transaction(
                    users.flatMap(u => {
                        const newBonus = u.bonusPoints + amount;
                        const newBalance = u.paidPoints + newBonus;
                        return [
                            prisma.user.update({ where: { id: u.id }, data: { bonusPoints: newBonus } }),
                            prisma.pointTransaction.create({ data: { userId: u.id, amount, type: 'ADMIN', description: description || '관리자 일괄 지급', balanceAfter: newBalance } }),
                        ];
                    })
                );
                return res.json({ granted: amount, userCount: users.length });
            } catch (e: any) {
                console.error('[admin/bulk-grant POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/admin/menu-limits — 메뉴권한 목록
        if (req.method === 'GET' && seg1 === 'menu-limits') {
            try {
                const limits = await (prisma as any).menuLimit.findMany({
                    orderBy: [{ feature: 'asc' }, { role: 'asc' }],
                });
                return res.json(limits);
            } catch (e: any) {
                console.error('[admin/menu-limits GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // PUT /api/admin/menu-limits — 메뉴권한 수정
        if (req.method === 'PUT' && seg1 === 'menu-limits') {
            try {
                const { feature, role, dailyLimit, pointsCost } = req.body;
                if (!feature || !role) return res.status(400).json({ error: 'feature, role 필수' });
                const updated = await (prisma as any).menuLimit.upsert({
                    where: { feature_role: { feature, role } },
                    update: {
                        dailyLimit: dailyLimit === null || dailyLimit === '' ? null : Number(dailyLimit),
                        pointsCost: Number(pointsCost ?? 50),
                    },
                    create: {
                        feature, role,
                        dailyLimit: dailyLimit === null || dailyLimit === '' ? null : Number(dailyLimit),
                        pointsCost: Number(pointsCost ?? 50),
                    },
                });
                return res.json(updated);
            } catch (e: any) {
                console.error('[admin/menu-limits PUT]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // POST /api/face-reading
    if (domain === 'face-reading' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { imageBase64, mimeType, personaId } = req.body;
            if (!imageBase64 || !mimeType || !personaId) return res.status(400).json({ error: '필수 항목 누락' });

            const faceUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            let newBalance = (faceUser?.paidPoints ?? 0) + (faceUser?.bonusPoints ?? 0);
            let paidBalance = faceUser?.paidPoints ?? 0;
            let bonusBalance = faceUser?.bonusPoints ?? 0;
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, faceUser?.role ?? 'USER', 'face');
                ({ newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, pointsCost, '관상 분석'));
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            const persona = await prisma.persona.findUnique({ where: { id: personaId }, select: { systemInstruction: true } });
            const sysInstruction = persona?.systemInstruction ?? '';

            const analysis = await analyzeFaceReading(imageBase64, mimeType, sysInstruction);
            return res.json({ analysis, newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[face-reading POST]', e);
            return res.status(500).json({ error: '관상 분석 실패: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // POST /api/quick-menu-result
    if (domain === 'quick-menu-result' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { personaId, prompt } = req.body;
            const persona = await prisma.persona.findUnique({ where: { id: personaId }, select: { systemInstruction: true } });
            if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

            const qmUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            let newBalance = (qmUser?.paidPoints ?? 0) + (qmUser?.bonusPoints ?? 0);
            let paidBalance = qmUser?.paidPoints ?? 0;
            let bonusBalance = qmUser?.bonusPoints ?? 0;
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, qmUser?.role ?? 'USER', 'quick-menu');
                ({ newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, pointsCost, '퀵메뉴 분석'));
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            const result = await generateQuickMenuResult(persona.systemInstruction, prompt);
            return res.json({ result, newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[quick-menu-result POST]', e);
            return res.status(500).json({ error: '분석 실패: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // POST /api/quick-menu-activate (꿈해몽 등 채팅 진입 전 포인트 차감)
    if (domain === 'quick-menu-activate' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { cost, description } = req.body;
            if (!cost || cost <= 0) return res.status(400).json({ error: '잘못된 요청' });

            const qaUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            if (qaUser?.role === 'MANAGE' || qaUser?.role === 'ADMIN') {
                const newBalance = (qaUser.paidPoints) + (qaUser.bonusPoints);
                return res.json({ newBalance, paidBalance: qaUser.paidPoints, bonusBalance: qaUser.bonusPoints });
            }
            const { deductMenuPoints } = await import('./_lib/points.js');
            const { newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, cost, description ?? '퀵메뉴');
            return res.json({ newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[quick-menu-activate POST]', e);
            return res.status(500).json({ error: '서버 오류: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // ── Stock Analysis ────────────────────────────────────────
    if (domain === 'stock-analysis') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // GET /api/stock-analysis/suggest?q=... — 종목명 자동완성
        if (seg1 === 'suggest' && req.method === 'GET') {
            const q = ((req.query.q as string) || '').trim();
            if (q.length < 2) return res.status(200).json([]);
            const rows = await prisma.corpCode.findMany({
                where: { OR: [{ corpName: { contains: q } }, { corpNameEng: { contains: q, mode: 'insensitive' } }] },
                take: 20,
                select: { corpName: true, corpNameEng: true, stockCode: true },
            });
            const sorted = [
                ...rows.filter(r => r.stockCode),
                ...rows.filter(r => !r.stockCode),
            ].slice(0, 10);
            return res.status(200).json(sorted);
        }

        // POST /api/stock-analysis — 분석 요청
        if (!seg1 && req.method === 'POST') {
            const { stockName } = req.body || {};
            if (!stockName?.trim()) return res.status(400).json({ error: '종목명을 입력해주세요.' });
            const corp = await prisma.corpCode.findFirst({ where: { corpName: stockName.trim() } });
            if (!corp) return res.status(400).json({ error: `'${stockName.trim()}'은(는) 등록된 종목명이 아닙니다.\n정확한 종목명을 입력하거나 목록에서 선택해주세요.` });
            const stockUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, stockUser?.role ?? 'USER', 'stock');
                await deductMenuPoints(prisma, userId, pointsCost, '주식 분석');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            try {
                const task = await prisma.stockAnalysis.create({
                    data: { userId, stockName: stockName.trim() },
                });
                return res.status(201).json({ id: task.id, status: 'pending' });
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                return res.status(500).json({ error: '요청 저장 실패' });
            }
        }

        // GET /api/stock-analysis — 내 분석 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.stockAnalysis.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true, stockName: true, status: true, createdAt: true, updatedAt: true, corpCode: true, errorMessage: true },
            });
            return res.status(200).json(list);
        }

        // GET /api/stock-analysis/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.stockAnalysis.findFirst({
                where: { id: Number(seg1), userId },
            });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // GET /api/stock-analysis/:id/download — .md 파일 다운로드
        if (seg1 && seg2 === 'download' && req.method === 'GET') {
            const task = await prisma.stockAnalysis.findFirst({
                where: { id: Number(seg1), userId },
            });
            if (!task || !task.analysisReport) return res.status(404).json({ error: '없음' });
            const filename = `${task.stockName}_분석_${task.createdAt.toISOString().slice(0, 10)}.md`;
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            return res.status(200).send(task.analysisReport);
        }

        // POST /api/stock-analysis/:id/retry — 실패 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.stockAnalysis.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null, yahooSymbol: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/stock-analysis/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            await prisma.stockAnalysis.deleteMany({ where: { id: Number(seg1), userId } });
            return res.status(200).json({ ok: true });
        }
    }

    // ── Luxury Verification ───────────────────────────────────
    if (domain === 'luxury-verify') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/luxury-verify/upload-urls — GCS 서명 URL 요청
        if (seg1 === 'upload-urls' && req.method === 'POST') {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length)
                return res.status(400).json({ error: '파일 정보가 필요합니다.' });
            const results = await Promise.all(
                files.slice(0, 8).map(async (f: { name: string; type: string }, idx: number) => {
                    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
                    const path = `luxury-verify/${userId}/${Date.now()}_${idx}.${ext}`;
                    return generateSignedUrl(path, f.type);
                })
            );
            return res.status(200).json(results);
        }

        // POST /api/luxury-verify — 검증 요청 생성
        if (!seg1 && req.method === 'POST') {
            const { imageUrls, brandHint } = req.body || {};
            if (!Array.isArray(imageUrls) || !imageUrls.length)
                return res.status(400).json({ error: '이미지가 필요합니다.' });
            const reqUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, reqUser?.role ?? 'USER', 'luxury');
                await deductMenuPoints(prisma, userId, pointsCost, '명품 감정');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            const task = await prisma.luxuryVerification.create({
                data: { userId, imageUrls: JSON.stringify(imageUrls), brandHint: brandHint?.trim() || null },
            });
            return res.status(201).json(task);
        }

        // GET /api/luxury-verify — 내 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.luxuryVerification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, brandHint: true, geminiBrand: true, status: true,
                    finalScore: true, finalVerdict: true,
                    imageUrls: true, createdAt: true, updatedAt: true, errorMessage: true,
                },
            });
            return res.status(200).json(list);
        }

        // GET /api/luxury-verify/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.luxuryVerification.findFirst({ where: { id: Number(seg1), userId } });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // POST /api/luxury-verify/:id/retry — 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.luxuryVerification.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/luxury-verify/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            const target = await prisma.luxuryVerification.findFirst({ where: { id: Number(seg1), userId } });
            if (target) {
                const urls: string[] = JSON.parse(target.imageUrls || '[]');
                await Promise.allSettled(urls.map(url => deleteFromGCS(url)));
                await prisma.luxuryVerification.delete({ where: { id: target.id } });
            }
            return res.status(200).json({ ok: true });
        }
    }

    // ── Used Item Listing ─────────────────────────────────────
    if (domain === 'used-item') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/used-item/upload-urls — GCS 서명 URL 요청
        if (seg1 === 'upload-urls' && req.method === 'POST') {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length)
                return res.status(400).json({ error: '파일 정보가 필요합니다.' });
            const results = await Promise.all(
                files.slice(0, 5).map(async (f: { name: string; type: string }, idx: number) => {
                    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
                    const path = `used-items/${userId}/${Date.now()}_${idx}.${ext}`;
                    return generateSignedUrl(path, f.type);
                })
            );
            return res.status(200).json(results);
        }

        // POST /api/used-item — 분석 요청 생성
        if (!seg1 && req.method === 'POST') {
            const { imageUrls, itemName } = req.body || {};
            if (!Array.isArray(imageUrls) || !imageUrls.length)
                return res.status(400).json({ error: '이미지가 필요합니다.' });
            const usedUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, usedUser?.role ?? 'USER', 'used-item');
                await deductMenuPoints(prisma, userId, pointsCost, '중고 판매 분석');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            const task = await prisma.usedItemListing.create({
                data: { userId, imageUrls: JSON.stringify(imageUrls), itemName: itemName?.trim() || null },
            });
            return res.status(201).json(task);
        }

        // GET /api/used-item — 내 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.usedItemListing.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, itemName: true, modelName: true, brand: true,
                    status: true, suggestedPrice: true, finalPrice: true,
                    imageUrls: true, createdAt: true, updatedAt: true, errorMessage: true,
                },
            });
            return res.status(200).json(list);
        }

        // GET /api/used-item/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.usedItemListing.findFirst({ where: { id: Number(seg1), userId } });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // PATCH /api/used-item/:id — 제목/가격/본문 수정
        if (seg1 && !seg2 && req.method === 'PATCH') {
            const { finalTitle, finalPrice, finalDescription } = req.body || {};
            await prisma.usedItemListing.updateMany({
                where: { id: Number(seg1), userId },
                data: {
                    ...(finalTitle !== undefined && { finalTitle }),
                    ...(finalPrice !== undefined && { finalPrice: Number(finalPrice) }),
                    ...(finalDescription !== undefined && { finalDescription }),
                },
            });
            return res.status(200).json({ ok: true });
        }

        // POST /api/used-item/:id/retry — 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.usedItemListing.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/used-item/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            const target = await prisma.usedItemListing.findFirst({ where: { id: Number(seg1), userId } });
            if (target) {
                const urls: string[] = JSON.parse(target.imageUrls || '[]');
                await Promise.allSettled(urls.map(url => deleteFromGCS(url)));
                await prisma.usedItemListing.delete({ where: { id: target.id } });
            }
            return res.status(200).json({ ok: true });
        }
    }

    // GET /api/dart-test/종목명 — corp_code DB 조회 테스트
    if (domain === 'dart-test' && req.method === 'GET') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { findCorpCode } = await import('./_lib/dartService.js');
        const name = seg1 || (req.query.name as string) || '삼성전자';
        const corpCode = await findCorpCode(name);
        const total = await prisma.corpCode.count();
        return res.status(200).json({ name, corpCode, totalInDb: total });
    }

    // POST /api/dart-import — DART 전체 기업 코드 DB 갱신 (어드민)
    if (domain === 'dart-import' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { importCorpCodes } = await import('./_lib/dartService.js');
        const count = await importCorpCodes();
        return res.status(200).json({ ok: true, count });
    }

    // ── Hot Keyword ───────────────────────────────────────────
    if (domain === 'hot-keyword') {
        // GET /api/hot-keyword/categories — 네이버 쇼핑 카테고리 목록
        if (seg1 === 'categories' && req.method === 'GET') {
            const cats = await prisma.naverShoppingCategory.findMany({
                orderBy: { order: 'asc' },
                select: { code: true, name: true, emoji: true, keywords: true },
            });
            return res.status(200).json(cats);
        }

        // POST /api/hot-keyword/run — n8n webhook 호출 (일회성 발송)
        if (seg1 === 'run' && req.method === 'POST') {
            const token = getTokenFromRequest(req);
            if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
            const { userId } = verifyToken(token);

            const { categories, deliveryMethod, email, phone } = req.body || {};
            if (!categories || !Array.isArray(categories) || categories.length === 0)
                return res.status(400).json({ error: '카테고리를 1개 이상 선택해주세요.' });
            if (categories.length > 3)
                return res.status(400).json({ error: '카테고리는 최대 3개까지 선택 가능합니다.' });
            if (!deliveryMethod || !['email', 'sms'].includes(deliveryMethod))
                return res.status(400).json({ error: '발송 방법을 선택해주세요.' });
            if (deliveryMethod === 'email' && !email)
                return res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
            if (deliveryMethod === 'sms' && !phone)
                return res.status(400).json({ error: '전화번호를 입력해주세요.' });

            const N8N_WEBHOOK_URL = process.env.N8N_HOT_KEYWORD_WEBHOOK_URL;
            if (!N8N_WEBHOOK_URL) return res.status(500).json({ error: 'n8n webhook URL이 설정되지 않았습니다.' });

            // 기능 접근 정책 체크 (1일 1회 + 포인트 차감)
            const hkUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, hkUser?.role ?? 'USER', 'hot-keyword');
                await deductMenuPoints(prisma, userId, pointsCost, '핫쇼핑키워드');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            // 카테고리별 TOP 5 키워드로 제한 후 이메일/SMS 내용 사전 포맷
            const top5Categories = categories.map((cat: any) => ({
                ...cat,
                keywords: Array.isArray(cat.keywords) ? cat.keywords.slice(0, 5) : [],
            }));

            const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            const emailSubject = `[핫쇼핑키워드] ${todayStr} 네이버 쇼핑 인기 키워드 TOP 5`;

            const categoryHtmlBlocks = top5Categories.map((cat: any) => {
                const keywordRows = cat.keywords.map((kw: string, i: number) =>
                    `<tr><td style="padding:6px 12px;color:#888;font-size:13px;">${i + 1}</td><td style="padding:6px 12px;font-size:14px;color:#1a1a1a;">${kw}</td></tr>`
                ).join('');
                return `
<div style="margin-bottom:24px;">
  <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${cat.emoji} ${cat.name} TOP 5</div>
  <table style="border-collapse:collapse;width:100%;background:#f9f9f9;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#ff6b00;"><td style="padding:8px 12px;color:#fff;font-size:12px;font-weight:600;">순위</td><td style="padding:8px 12px;color:#fff;font-size:12px;font-weight:600;">키워드</td></tr></thead>
    <tbody>${keywordRows}</tbody>
  </table>
</div>`;
            }).join('');

            const emailHtml = `
<div style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
  <div style="background:#ff6b00;padding:24px;text-align:center;">
    <div style="font-size:22px;font-weight:800;color:#fff;">🛒 핫쇼핑키워드</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${todayStr} 기준 네이버 쇼핑 인기 키워드</div>
  </div>
  <div style="padding:24px;">
    ${categoryHtmlBlocks}
    <div style="margin-top:16px;padding:12px;background:#fff8f3;border-radius:8px;font-size:12px;color:#888;text-align:center;">
      본 메일은 AI.MP 핫쇼핑키워드 서비스에서 발송되었습니다.
    </div>
  </div>
</div>`;

            const smsText = top5Categories.map((cat: any) =>
                `[${cat.emoji}${cat.name} TOP5]\n${cat.keywords.map((kw: string, i: number) => `${i + 1}. ${kw}`).join('\n')}`
            ).join('\n\n') + `\n\n- AI.MP 핫쇼핑키워드`;

            const payload = {
                categories: top5Categories,
                deliveryMethod,
                email: email || null,
                phone: phone || null,
                emailSubject,
                emailHtml,
                smsText,
            };
            const n8nRes = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!n8nRes.ok) {
                const errText = await n8nRes.text();
                console.error('n8n webhook 오류:', errText);
                return res.status(502).json({ error: '발송 요청 실패. 잠시 후 다시 시도해주세요.' });
            }
            // n8n이 "Respond to Webhook" 노드로 응답할 경우 ok 필드 확인
            let n8nBody: any = {};
            try { n8nBody = await n8nRes.json(); } catch { /* 빈 응답 무시 */ }
            if (n8nBody?.ok === false) {
                const errMsg = n8nBody?.error || '발송 중 오류가 발생했습니다.';
                console.error('n8n 워크플로우 오류:', errMsg);
                return res.status(502).json({ error: errMsg });
            }
            return res.status(200).json({ ok: true, message: '발송이 완료되었습니다.', content: n8nBody?.content || null, subject: n8nBody?.subject || null });
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
