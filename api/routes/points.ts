import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { requireAuth } from '../_lib/auth.js';

export async function handler(
    req: VercelRequest,
    res: VercelResponse,
    seg1: string | undefined,
) {
    const userId = requireAuth(req, res);
    if (userId === null) return;

        // GET /api/points — 잔액 + 최근 거래 내역
        if (req.method === 'GET' && !seg1) {
            try {
                const [userData, transactions] = await Promise.all([
                    prisma.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } }),
                    prisma.pointTransaction.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'desc' },
                        take: 50,
                        include: { persona: { select: { id: true, name: true } } },
                    }),
                ]);
                return res.json({ paidPoints: userData?.paidPoints ?? 0, bonusPoints: userData?.bonusPoints ?? 0, points: (userData?.paidPoints ?? 0) + (userData?.bonusPoints ?? 0), transactions });
            } catch (e: any) {
                console.error('[points GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/points/stats — 사용 통계
        if (req.method === 'GET' && seg1 === 'stats') {
            try {
                const [txByPersona, received] = await Promise.all([
                    prisma.pointTransaction.groupBy({
                        by: ['personaId', 'type'],
                        where: { userId, amount: { lt: 0 }, personaId: { not: null } },
                        _sum: { amount: true },
                    }),
                    prisma.pointTransaction.groupBy({
                        by: ['type'],
                        where: { userId, amount: { gt: 0 } },
                        _sum: { amount: true },
                    }),
                ]);

                // 페르소나별 집계
                const personaMap: Record<string, { chat: number; menu: number; balloon: number }> = {};
                for (const row of txByPersona) {
                    const pid = row.personaId!;
                    if (!personaMap[pid]) personaMap[pid] = { chat: 0, menu: 0, balloon: 0 };
                    const abs = Math.abs(row._sum.amount ?? 0);
                    if (row.type === 'CHAT') personaMap[pid].chat += abs;
                    else if (row.type === 'MENU') personaMap[pid].menu += abs;
                    else if (row.type === 'BALLOON') personaMap[pid].balloon += abs;
                }

                const personaIds = Object.keys(personaMap);
                const [personas, firstSessions, xpRows] = await Promise.all([
                    prisma.persona.findMany({
                        where: { id: { in: personaIds } },
                        select: { id: true, name: true, imageUrl: true },
                    }),
                    prisma.chatSession.findMany({
                        where: { userId, personaId: { in: personaIds } },
                        orderBy: { createdAt: 'asc' },
                        distinct: ['personaId'],
                        select: { personaId: true, createdAt: true },
                    }),
                    prisma.userPersonaXp.findMany({
                        where: { userId, personaId: { in: personaIds } },
                        select: { personaId: true, xp: true },
                    }),
                ]);

                const firstChatMap: Record<string, string> = {};
                for (const s of firstSessions) firstChatMap[s.personaId] = s.createdAt.toISOString();
                const xpMap: Record<string, number> = {};
                for (const x of xpRows) xpMap[x.personaId] = x.xp;

                const byPersona = personaIds.map(pid => {
                    const d = personaMap[pid];
                    return {
                        personaId: pid,
                        persona: personas.find(p => p.id === pid),
                        chat: d.chat,
                        menu: d.menu,
                        balloon: d.balloon,
                        total: d.chat + d.menu + d.balloon,
                        xp: xpMap[pid] ?? 0,
                        firstChatAt: firstChatMap[pid] ?? null,
                    };
                }).sort((a, b) => b.total - a.total);

                // 수신 집계 (유형별)
                const receivedMap: Record<string, number> = {};
                for (const row of received) {
                    receivedMap[row.type] = row._sum.amount ?? 0;
                }

                return res.json({
                    byPersona,
                    received: {
                        charge: receivedMap['CHARGE'] ?? 0,
                        signup: receivedMap['SIGNUP'] ?? 0,
                        levelup: receivedMap['LEVELUP'] ?? 0,
                        admin: receivedMap['ADMIN'] ?? 0,
                    },
                });
            } catch (e: any) {
                console.error('[points/stats GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // POST /api/points/admin-grant — 어드민 포인트 직접 지급
        if (req.method === 'POST' && seg1 === 'admin-grant') {
            try {
                const requestUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                if (requestUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const { email, phone, amount, description } = req.body as { email?: string; phone?: string; amount: number; description?: string };
                const identifier = email || phone;
                if (!identifier || !amount || amount <= 0) return res.status(400).json({ error: 'email 또는 phone과 양수 amount가 필요합니다.' });
                const target = email
                    ? await prisma.user.findUnique({ where: { email }, select: { id: true, paidPoints: true, bonusPoints: true, email: true, phone: true } })
                    : await prisma.user.findUnique({ where: { phone: phone! }, select: { id: true, paidPoints: true, bonusPoints: true, email: true, phone: true } });
                if (!target) return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
                const newBonus = target.bonusPoints + amount;
                const newBalance = target.paidPoints + newBonus;
                await prisma.$transaction([
                    prisma.user.update({ where: { id: target.id }, data: { bonusPoints: newBonus } }),
                    prisma.pointTransaction.create({ data: { userId: target.id, amount, type: 'ADMIN', description: description || '관리자 지급', balanceAfter: newBalance } }),
                ]);
                return res.json({ email: target.email ?? target.phone, granted: amount, newBalance });
            } catch (e: any) {
                console.error('[points/admin-grant POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/points/cost?personaId=... — 현재 메시지 비용 조회
        if (req.method === 'GET' && seg1 === 'cost') {
            try {
                const { personaId } = req.query as { personaId?: string };
                if (!personaId) return res.status(400).json({ error: 'personaId 필요' });
                const xpRecord = await prisma.userPersonaXp.findUnique({
                    where: { userId_personaId: { userId, personaId } },
                });
                const xp = xpRecord?.xp ?? 0;
                const { getMessageCost, getStageIndex } = await import('../_lib/points.js');
                return res.json({ cost: getMessageCost(xp), stage: getStageIndex(xp) + 1, xp });
            } catch (e: any) {
                console.error('[points/cost GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }
