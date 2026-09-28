import { describe, it, expect } from 'vitest';
import { crossedLowBalance, crossedMilestone, chatCountOf, nudgeAudienceOf, nudgeCopy, LOW_BALANCE_THRESHOLD } from './pointNudges';

describe('pointNudges 판정', () => {
    it('A: 기준 이상→미만으로 떨어지는 순간만 참', () => {
        const T = LOW_BALANCE_THRESHOLD;
        expect(crossedLowBalance(T + 100, T - 1)).toBe(true);
        expect(crossedLowBalance(T, T - 1)).toBe(true);
        expect(crossedLowBalance(T - 50, T - 100)).toBe(false);   // 이미 아래
        expect(crossedLowBalance(null, 0)).toBe(false);          // 첫 관측(로드 전 0)
        expect(crossedLowBalance(0, 5000)).toBe(false);          // 로드로 올라감
    });
    it('C: 넘은 기준 중 가장 높은 것 하나', () => {
        expect(crossedMilestone(9, 10)).toBe(10);
        expect(crossedMilestone(9, 31)).toBe(30);
        expect(crossedMilestone(10, 11)).toBeNull();
        expect(crossedMilestone(null, 10)).toBeNull();          // 첫 관측은 판정 안 함
        expect(crossedMilestone(99, 100)).toBe(100);
    });
    it('누적 대화 수 = personaXp 합', () => {
        expect(chatCountOf({ a: 3, b: 7 })).toBe(10);
        expect(chatCountOf(undefined)).toBe(0);
    });
    it('대상 구분: 체험=provider, 어드민=ADMIN/MANAGE', () => {
        expect(nudgeAudienceOf({ role: 'USER', provider: 'guest' })).toBe('guest');
        expect(nudgeAudienceOf({ role: 'USER', provider: 'local' })).toBe('member');
        expect(nudgeAudienceOf({ role: 'ADMIN', provider: 'local' })).toBe('admin');
        expect(nudgeAudienceOf({ role: 'MANAGE' })).toBe('admin');
        expect(nudgeAudienceOf(null)).toBeNull();
    });
    it('체험계정 문구는 충전이 아니라 가입으로 유도', () => {
        expect(nudgeCopy('low', 'guest', { balance: 200 }).primary).toBe('회원가입하기');
        expect(nudgeCopy('low', 'member', { balance: 200 }).primary).toBe('충전하기');
        expect(nudgeCopy('milestone', 'guest', { count: 10 }).primary).toBe('회원가입하기');
    });
});
