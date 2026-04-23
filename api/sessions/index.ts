import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

  let userId: number;
  try {
    ({ userId } = verifyToken(token));
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  if (req.method === 'GET') {
    try {
      const sessions = await prisma.chatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        include: { persona: { select: { id: true, name: true, iconName: true, colorClass: true } } },
      });
      return res.status(200).json(sessions);
    } catch (error: any) {
      console.error('[sessions GET]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { personaId, title } = req.body;
      if (!personaId) return res.status(400).json({ error: 'personaId는 필수입니다.' });

      const session = await prisma.chatSession.create({
        data: { userId, personaId, title: title || '새 대화' },
        include: { persona: { select: { id: true, name: true, iconName: true, colorClass: true } } },
      });
      return res.status(201).json(session);
    } catch (error: any) {
      console.error('[sessions POST]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  return res.status(405).end();
}
