import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../../lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

  let userId: number;
  try {
    ({ userId } = verifyToken(token));
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }

  const sessionId = Number(req.query.id);
  if (isNaN(sessionId)) return res.status(400).json({ error: '유효하지 않은 세션 ID입니다.' });

  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  if (req.method === 'GET') {
    try {
      const messages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });
      return res.status(200).json(messages);
    } catch (error: any) {
      console.error('[messages GET]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { role, text } = req.body;
      if (!role || !text) return res.status(400).json({ error: 'role과 text는 필수입니다.' });

      const message = await prisma.message.create({
        data: { sessionId, role, text },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      return res.status(201).json(message);
    } catch (error: any) {
      console.error('[messages POST]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  return res.status(405).end();
}
