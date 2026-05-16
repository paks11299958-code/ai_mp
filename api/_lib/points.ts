import type { PrismaClient } from '../../src/generated/prisma/index.js';

const STAGE_THRESHOLDS = [0, 30, 150, 500, 1200, 2500];
const STAGE_COSTS      = [10,  9,   8,   7,    6,    5];
export const LEVELUP_BONUS    = [ 0, 20,  50, 100,  200,  500];

export function getStageIndex(xp: number): number {
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= STAGE_THRESHOLDS[i]) return i;
  }
  return 0;
}

export function getMessageCost(xp: number): number {
  return STAGE_COSTS[getStageIndex(xp)];
}

export async function deductPointsForMessage(
  prisma: PrismaClient,
  userId: number,
  personaId: string
): Promise<{ success: boolean; newBalance: number; paidBalance: number; bonusBalance: number; cost: number; leveledUp: boolean; newStage: number; levelupBonus: number }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
    if (!user) throw new Error('USER_NOT_FOUND');

    const xpRecord = await tx.userPersonaXp.findUnique({
      where: { userId_personaId: { userId, personaId } },
    });
    const currentXp = xpRecord?.xp ?? 0;
    const cost = getMessageCost(currentXp);
    const totalBalance = user.paidPoints + user.bonusPoints;

    if (totalBalance < cost) throw new Error('INSUFFICIENT_POINTS');

    // 보너스 먼저 차감, 부족하면 유료에서 차감
    const bonusDeduct = Math.min(cost, user.bonusPoints);
    const paidDeduct = cost - bonusDeduct;
    const newBonus = user.bonusPoints - bonusDeduct;
    const newPaid = user.paidPoints - paidDeduct;

    await tx.user.update({ where: { id: userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
    await tx.pointTransaction.create({
      data: { userId, amount: -cost, type: 'CHAT', personaId, balanceAfter: newBonus + newPaid },
    });

    const oldStage = getStageIndex(currentXp);
    const newXp = currentXp + 1;
    await tx.userPersonaXp.upsert({
      where: { userId_personaId: { userId, personaId } },
      create: { userId, personaId, xp: newXp },
      update: { xp: newXp },
    });
    const newStage = getStageIndex(newXp);

    let levelupBonus = 0;
    if (newStage > oldStage) {
      levelupBonus = LEVELUP_BONUS[newStage];
      if (levelupBonus > 0) {
        const finalBonus = newBonus + levelupBonus;
        await tx.user.update({ where: { id: userId }, data: { bonusPoints: finalBonus } });
        await tx.pointTransaction.create({
          data: { userId, amount: levelupBonus, type: 'LEVELUP', personaId, balanceAfter: newPaid + finalBonus, description: `${newStage}단계 달성 보너스` },
        });
        return { success: true, newBalance: newPaid + finalBonus, paidBalance: newPaid, bonusBalance: finalBonus, cost, leveledUp: true, newStage, levelupBonus };
      }
    }

    return { success: true, newBalance: newBonus + newPaid, paidBalance: newPaid, bonusBalance: newBonus, cost, leveledUp: newStage > oldStage, newStage, levelupBonus };
  });
}

export async function grantSignupPoints(prisma: PrismaClient, userId: number): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { bonusPoints: 500 } }),
    prisma.pointTransaction.create({
      data: { userId, amount: 500, type: 'SIGNUP', description: '신규 가입 보너스', balanceAfter: 500 },
    }),
  ]);
}

export async function deductMenuPoints(
  prisma: PrismaClient,
  userId: number,
  cost: number,
  description: string
): Promise<{ newBalance: number; paidBalance: number; bonusBalance: number }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.paidPoints + user.bonusPoints < cost) throw new Error('INSUFFICIENT_POINTS');
    const bonusDeduct = Math.min(cost, user.bonusPoints);
    const paidDeduct = cost - bonusDeduct;
    const newBonus = user.bonusPoints - bonusDeduct;
    const newPaid = user.paidPoints - paidDeduct;
    await tx.user.update({ where: { id: userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
    await tx.pointTransaction.create({
      data: { userId, amount: -cost, type: 'MENU', description, balanceAfter: newBonus + newPaid },
    });
    return { newBalance: newBonus + newPaid, paidBalance: newPaid, bonusBalance: newBonus };
  });
}
