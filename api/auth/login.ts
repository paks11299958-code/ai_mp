import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { signToken, setTokenCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const token = signToken(user.id);
    res.setHeader('Set-Cookie', setTokenCookie(token));
    return res.status(200).json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token,
    });
  } catch (error: any) {
    console.error('[login]', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
