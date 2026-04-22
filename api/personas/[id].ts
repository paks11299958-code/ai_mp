import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../lib/auth.js';

async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<number | null> {
  const token = getTokenFromRequest(req);
  if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
  const { userId } = verifyToken(token);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
  return userId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query as { id: string };

  if (req.method === 'PUT') {
    try {
      const userId = await requireAdmin(req, res);
      if (!userId) return;

      const { name, description, systemInstruction, iconName, colorClass, imageUrl, order } = req.body;
      const persona = await prisma.persona.update({
        where: { id },
        data: { name, description, systemInstruction, iconName, colorClass, imageUrl, order },
      });
      return res.status(200).json(persona);
    } catch (error: any) {
      console.error('[personas PUT]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const userId = await requireAdmin(req, res);
      if (!userId) return;

      const persona = await prisma.persona.findUnique({ where: { id } });
      if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });
      if (persona.isDefault) return res.status(400).json({ error: '기본 페르소나는 삭제할 수 없습니다.' });

      await prisma.persona.delete({ where: { id } });
      return res.status(200).json({ message: '삭제 완료' });
    } catch (error: any) {
      console.error('[personas DELETE]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  return res.status(405).end();
}
