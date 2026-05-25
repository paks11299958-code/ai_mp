import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../_lib/prisma.js';
import { signToken, setTokenCookie, clearTokenCookie, getTokenFromRequest, verifyToken } from '../_lib/auth.js';
import { sendEmail } from '../_lib/email.js';
import { sendSms } from '../_lib/sms.js';

export async function handler(
    req: VercelRequest,
    res: VercelResponse,
    seg1: string | undefined,
) {
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
            const { grantSignupPoints } = await import('../_lib/points.js');
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
            console.log('[forgot-password] step1: findUnique', email);
            const user = await prisma.user.findUnique({ where: { email } });
            console.log('[forgot-password] step2: user found=', !!user);
            if (user) {
                const token = crypto.randomBytes(32).toString('hex');
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const expiry = new Date(Date.now() + 30 * 60 * 1000);
                console.log('[forgot-password] step3: update resetToken');
                await prisma.user.update({ where: { email }, data: { resetToken: tokenHash, resetTokenExpiry: expiry } });
                const baseUrl = process.env.APP_BASE_URL || 'https://ai-mp.vercel.app';
                console.log('[forgot-password] step4: sendEmail baseUrl=', baseUrl);
                await sendEmail(
                    email,
                    '[AI 페르소나] 비밀번호 재설정',
                    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111827;color:#f9fafb;border-radius:12px;"><h2 style="color:#60a5fa;margin-bottom:16px;">비밀번호 재설정</h2><p style="color:#9ca3af;margin-bottom:24px;">아래 버튼을 클릭해 비밀번호를 재설정하세요.<br>링크는 30분 후 만료됩니다.</p><a href="${baseUrl}/?token=${token}" style="display:inline-block;background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none;">비밀번호 재설정하기</a><p style="margin-top:24px;font-size:12px;color:#6b7280;">이 요청을 하지 않으셨다면 무시하셔도 됩니다.</p></div>`
                );
                console.log('[forgot-password] step5: email sent ok');
            }
            return res.json({ message: '입력한 이메일로 재설정 링크를 전송했습니다.' });
        } catch (e: any) {
            console.error('[forgot-password] ERROR at step, message:', e.message, 'stack:', e.stack);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/auth/send-code
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

    // POST /api/auth/send-verify
    if (seg1 === 'send-verify' && req.method === 'POST') {
        const { type, identifier } = req.body || {};
        if (!type || !identifier) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
        if (type !== 'EMAIL' && type !== 'PHONE') return res.status(400).json({ error: '유효하지 않은 인증 유형입니다.' });
        const normalizedId = type === 'PHONE' ? identifier.replace(/-/g, '') : identifier.toLowerCase().trim();
        try {
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

    // POST /api/auth/verify-register
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
            const { grantSignupPoints } = await import('../_lib/points.js');
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
