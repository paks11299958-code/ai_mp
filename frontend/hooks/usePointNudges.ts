import { useEffect, useRef, useState } from 'react';
import type { User } from '../types';
import {
    LOW_BALANCE_REARM, CHAT_MILESTONES, nudgeAudienceOf, crossedLowBalance, crossedMilestone,
    chatCountOf, nudgeSeen, markNudgeSeen, clearNudgeSeen, type NudgeKind,
} from '../lib/pointNudges';

export interface ActiveNudge {
    kind: NudgeKind;
    audience: 'member' | 'guest';
    balance?: number;
    count?: number;
}

/**
 * 포인트 넛지 A(소진 임박)·C(대화 횟수 도달) 판정. 규칙·기준값은 lib/pointNudges.ts.
 *
 * ★"변화"로만 판정한다 — 이전 값을 기억해 두고 기준을 **넘는 순간**에만 띄운다.
 *   포인트 상태는 0으로 시작해 로드 후 채워지므로, "현재 값 < 기준"으로 판정하면
 *   로그인 직후 모든 사용자에게 오탐이 뜬다. 같은 이유로 계정이 바뀌면(로그인·로그아웃)
 *   이전 값을 버리고 새로 잡는다(로그아웃 시 잔액이 0으로 리셋되는 것도 걸리지 않게).
 *   → 한계: 이미 기준 아래인 채로 접속한 사용자에겐 A가 뜨지 않는다(그다음은 B가 받는다).
 */
export function usePointNudges(user: User | null, totalPoints: number) {
    const [nudge, setNudge] = useState<ActiveNudge | null>(null);
    const prev = useRef<{ userId: number | null; balance: number | null; chat: number | null }>(
        { userId: null, balance: null, chat: null });

    const audience = nudgeAudienceOf(user);
    const userId = user?.id ?? null;
    const chatCount = chatCountOf(user?.personaXp);

    useEffect(() => {
        const p = prev.current;
        if (userId === null || p.userId !== userId) {
            prev.current = { userId, balance: null, chat: null };
            // 첫 관측값은 아래에서 그대로 기록만 한다(판정 없음).
        }
        const before = prev.current;
        const lastBalance = before.balance;
        const lastChat = before.chat;
        before.balance = userId === null ? null : totalPoints;
        before.chat = userId === null ? null : chatCount;
        if (userId === null || !audience || audience === 'admin') return;

        // A. 소진 임박
        // 재노출 조건: 잔액이 LOW_BALANCE_REARM(1,000P) 이상으로 올라오면(대표적으로 충전) 기록을
        // 지운다 → 이후 다시 기준 아래로 떨어지면 한 번 더 뜬다.
        if (totalPoints >= LOW_BALANCE_REARM) clearNudgeSeen(userId, 'low');
        if (lastBalance !== null && totalPoints !== lastBalance && crossedLowBalance(lastBalance, totalPoints)) {
            if (!nudgeSeen(userId, 'low')) {
                markNudgeSeen(userId, 'low');
                setNudge({ kind: 'low', audience, balance: totalPoints });
                return;
            }
        }

        // C. 대화 횟수 도달 — 기준별 1회, 재노출 없음. 넘은 기준 이하는 모두 본 것으로 처리.
        const hit = crossedMilestone(lastChat, chatCount);
        if (hit !== null && !nudgeSeen(userId, `chat_${hit}`)) {
            for (const m of CHAT_MILESTONES) if (m <= hit) markNudgeSeen(userId, `chat_${m}`);
            setNudge({ kind: 'milestone', audience, count: hit });
        }
    }, [userId, audience, totalPoints, chatCount]);

    return { nudge, dismissNudge: () => setNudge(null) };
}
