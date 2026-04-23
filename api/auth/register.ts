import bcrypt from 'bcryptjs';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { signToken, setTokenCookie } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, username } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, username },
      select: { id: true, email: true, username: true, role: true },
    });

    const token = signToken(user.id);
    res.setHeader('Set-Cookie', setTokenCookie(token));
    return res.status(201).json({ user, token });
  } catch (error: any) {
    console.error('[register]', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
