import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const token = getTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
      verifyToken(token);
      const personas = await prisma.persona.findMany({
        orderBy: { order: 'asc' },
      });
      return res.status(200).json(personas);
    } catch (error: any) {
      console.error('[personas GET]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const token = getTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

      const { userId } = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'ADMIN') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { name, description, systemInstruction, iconName, colorClass, imageUrl, order } = req.body;
      if (!name || !systemInstruction) {
        return res.status(400).json({ error: '이름과 시스템 프롬프트는 필수입니다.' });
      }

      const count = await prisma.persona.count();
      const persona = await prisma.persona.create({
        data: {
          name,
          description,
          systemInstruction,
          iconName: iconName || 'Bot',
          colorClass: colorClass || 'from-blue-500 to-cyan-500',
          imageUrl,
          order: order ?? count,
          isDefault: false,
          createdBy: userId,
        },
      });
      return res.status(201).json(persona);
    } catch (error: any) {
      console.error('[personas POST]', error);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  }

  return res.status(405).end();
}
