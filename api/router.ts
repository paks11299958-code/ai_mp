import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const domain = req.query.d as string;
    const seg1 = req.query.s1 as string | undefined;

    // GET /api/dart-test/종목명 — corp_code DB 조회 테스트
    if (domain === 'dart-test' && req.method === 'GET') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { findCorpCode } = await import('./_lib/dartService.js');
        const name = seg1 || (req.query.name as string) || '삼성전자';
        const corpCode = await findCorpCode(name);
        const total = await prisma.corpCode.count();
        return res.status(200).json({ name, corpCode, totalInDb: total });
    }

    // POST /api/dart-import — DART 전체 기업 코드 DB 갱신 (어드민)
    if (domain === 'dart-import' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { importCorpCodes } = await import('./_lib/dartService.js');
        const count = await importCorpCodes();
        return res.status(200).json({ ok: true, count });
    }

    return res.status(404).json({ error: 'Not found' });
}
