import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getPrisma } from '../lib/prisma';
import { sendEmail } from '../lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });

    const prisma = getPrisma();
    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiry = new Date(Date.now() + 30 * 60 * 1000);

            await prisma.user.update({
                where: { email },
                data: { resetToken: token, resetTokenExpiry: expiry },
            });

            const baseUrl = process.env.APP_BASE_URL || 'https://ai-mp.vercel.app';
            const resetUrl = `${baseUrl}/?token=${token}`;

            await sendEmail(
                email,
                '[AI 페르소나] 비밀번호 재설정',
                `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111827;color:#f9fafb;border-radius:12px;">
                    <h2 style="color:#60a5fa;margin-bottom:16px;">비밀번호 재설정</h2>
                    <p style="color:#9ca3af;margin-bottom:24px;">아래 버튼을 클릭해 비밀번호를 재설정하세요.<br>링크는 30분 후 만료됩니다.</p>
                    <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none;">비밀번호 재설정하기</a>
                    <p style="margin-top:24px;font-size:12px;color:#6b7280;">이 요청을 하지 않으셨다면 무시하셔도 됩니다.</p>
                </div>`
            );
        }

        return res.json({ message: '입력한 이메일로 재설정 링크를 전송했습니다.' });
    } catch (e: any) {
        console.error('[forgot-password]', e.message);
        return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}
