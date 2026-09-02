import { describe, expect, it } from 'vitest';
import { PUBLISH_TARGETS, estimateJob } from './aiAvatarPlan';

describe('aiAvatarPlan', () => {
    it('GPU 작업은 예상 시간과 비용을 알려준다', () => {
        const idle = estimateJob('GENERATE_IDLE');
        expect(idle.gpuSeconds).toBeGreaterThan(0);
        expect(idle.estimatedCostKrw).toBeGreaterThanOrEqual(0);
        expect(idle.label).toBe('대기 동작 생성');
    });

    it('GPU 를 쓰지 않는 작업은 0초라 확인 절차를 건너뛴다', () => {
        expect(estimateJob('PREPARE_REFERENCE').gpuSeconds).toBe(0);
        expect(estimateJob('BUILD_REVIEW').gpuSeconds).toBe(0);
    });

    // ★서버의 allowlist 와 어긋나면 게시가 400 으로 막힌다. 값이 바뀌면 양쪽을 함께 고칠 것.
    it('게시 대상은 서버 allowlist 와 같다', () => {
        expect([...PUBLISH_TARGETS]).toEqual(['consult', 'aiworld']);
    });
});
