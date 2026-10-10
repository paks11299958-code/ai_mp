import { beforeEach, describe, expect, it } from 'vitest';
import { setHomepageBoardStartStep, takeHomepageBoardStartStep } from './homepageStart';

describe('HomepageBoard 시작 단계 연결', () => {
    beforeEach(() => sessionStorage.clear());

    it('기존 호출은 intro로 시작한다', () => {
        expect(takeHomepageBoardStartStep()).toBe('intro');
    });

    it.each(['intro', 'form', 'list'] as const)('%s 요청은 한 번만 소비한다', step => {
        setHomepageBoardStartStep(step);
        expect(takeHomepageBoardStartStep()).toBe(step);
        expect(takeHomepageBoardStartStep()).toBe('intro');
    });

    it('허용되지 않은 값은 intro로 안전하게 폴백한다', () => {
        sessionStorage.setItem('homepage:start-step', 'waiting');
        expect(takeHomepageBoardStartStep()).toBe('intro');
    });
});
