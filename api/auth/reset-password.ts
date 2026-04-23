import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, password } = req.body || {};
    if (!token || !password) return res.status(400).json({ error: '토큰과 새 비밀번호를 입력해주세요.' });
    if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });

    try {
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: { gt: new Date() },
            },
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
