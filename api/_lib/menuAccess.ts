import type { PrismaClient } from '../../src/generated/prisma/index.js';

export class DailyLimitError extends Error {
    constructor(feature: string, limit: number) {
        super(`오늘 이용 횟수(${limit}회)를 초과했습니다. 내일 다시 시도해주세요.`);
        this.name = 'DAILY_LIMIT_EXCEEDED';
    }
}

/**
 * 메뉴 접근 정책 체크 + 사용 로그 기록
 * - MenuLimit 테이블에서 기능별·역할별 dailyLimit, pointsCost 조회
 * - dailyLimit 초과 시 DailyLimitError throw
 * - 통과 시 MenuUsageLog 기록 후 pointsCost 반환
 */
export async function checkMenuAccess(
    prisma: PrismaClient,
    userId: number,
    userRole: string,
    feature: string
): Promise<{ pointsCost: number }> {
    const policy = await (prisma as any).menuLimit.findUnique({
        where: { feature_role: { feature, role: userRole } },
    });

    const pointsCost: number = policy?.pointsCost ?? 50;
    const dailyLimit: number | null = policy?.dailyLimit ?? null;

    if (dailyLimit !== null) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayCount = await (prisma as any).menuUsageLog.count({
            where: { userId, feature, createdAt: { gte: todayStart } },
        });
        if (todayCount >= dailyLimit) {
            throw new DailyLimitError(feature, dailyLimit);
        }
    }

    await (prisma as any).menuUsageLog.create({ data: { userId, feature } });

    return { pointsCost };
}
