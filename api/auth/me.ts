import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

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
  } catch (error: any) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}
