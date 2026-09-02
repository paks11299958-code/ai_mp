import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    SEOA_IDLE_URL,
    SEOA_REFERENCE_URL,
    SEOA_SPEAKING_URL,
    cancelJob,
    createProject,
    emptyState,
    enqueueJob,
    estimateJob,
    findActiveJob,
    hasActiveJobs,
    jobsForProject,
    latestPublication,
    publishProject,
    rollbackPublication,
    seedState,
    tick,
} from './aiAvatarMockRepo';

const T0 = Date.parse('2026-09-02T00:00:00.000Z');
const at = (seconds: number) => T0 + seconds * 1000;

const newProject = () => createProject(
    emptyState(),
    { name: '테스트 아바타', personaName: '서아', referenceImageUrl: SEOA_REFERENCE_URL },
    T0,
);

describe('aiAvatarMockRepo 자산 경로', () => {
    // 없는 파일을 mock에 박으면 화면에서는 빈 영상으로만 보여 발견이 늦는다(Phase 1 실렌더에서 실제로 겪음).
    it('mock이 참조하는 자산은 저장소에 실제로 존재한다', () => {
        const publicDir = join(__dirname, '../../../public');
        for (const url of [SEOA_IDLE_URL, SEOA_SPEAKING_URL, SEOA_REFERENCE_URL]) {
            expect(existsSync(join(publicDir, url)), `${url} 없음`).toBe(true);
        }
    });
});

describe('aiAvatarMockRepo 프로젝트', () => {
    it('프로젝트를 만들면 REFERENCE 단계로 시작한다', () => {
        const state = newProject();
        expect(state.projects).toHaveLength(1);
        expect(state.projects[0].stage).toBe('REFERENCE');
        expect(state.projects[0].idleVideoUrl).toBeUndefined();
    });

    it('이름이 비면 거부한다', () => {
        expect(() => createProject(emptyState(), { name: '  ', personaName: '서아', referenceImageUrl: 'x' }, T0))
            .toThrow('프로젝트 이름');
    });

    it('시드 상태는 운영에 반영된 서아 프로젝트를 담는다', () => {
        const state = seedState(T0);
        expect(state.projects[0].stage).toBe('PUBLISHED');
        expect(latestPublication(state, 'seoa', 'consult')?.assetUrl).toBe('/seoa/avatar/idle.mp4');
        expect(latestPublication(state, 'seoa', 'aiworld')).toBeTruthy();
    });
});

describe('aiAvatarMockRepo 작업 큐', () => {
    it('작업은 QUEUED로 들어가 시간이 지나면 RUNNING → READY가 된다', () => {
        const created = enqueueJob(newProject(), 'proj-1', 'GENERATE_IDLE', T0);
        expect(created.jobs[0].status).toBe('QUEUED');
        expect(created.jobs[0].progress).toBe(0);

        const midway = tick(created, at(12));
        expect(midway.jobs[0].status).toBe('RUNNING');
        expect(midway.jobs[0].progress).toBe(50);

        const done = tick(midway, at(30));
        expect(done.jobs[0].status).toBe('READY');
        expect(done.jobs[0].progress).toBe(100);
        expect(done.jobs[0].completedAt).toBeTruthy();
    });

    it('작업이 끝나면 프로젝트 단계와 산출물 URL이 갱신된다', () => {
        const idleDone = tick(enqueueJob(newProject(), 'proj-1', 'GENERATE_IDLE', T0), at(30));
        expect(idleDone.projects[0].stage).toBe('IDLE');
        expect(idleDone.projects[0].idleVideoUrl).toBe('/seoa/avatar/idle.mp4');

        const lipsyncDone = tick(enqueueJob(idleDone, 'proj-1', 'GENERATE_LIPSYNC', at(30)), at(80));
        expect(lipsyncDone.projects[0].stage).toBe('LIPSYNC');
        expect(lipsyncDone.projects[0].speakingVideoUrl).toBe('/seoa/avatar/speaking-poc.mp4');
    });

    it('같은 프로젝트·kind의 진행 중 작업은 중복 생성하지 않는다', () => {
        const first = enqueueJob(newProject(), 'proj-1', 'GENERATE_IDLE', T0);
        const second = enqueueJob(first, 'proj-1', 'GENERATE_IDLE', at(1));
        expect(second).toBe(first);
        expect(jobsForProject(second, 'proj-1')).toHaveLength(1);
    });

    it('완료 후에는 같은 kind를 다시 실행할 수 있다', () => {
        const done = tick(enqueueJob(newProject(), 'proj-1', 'GENERATE_IDLE', T0), at(30));
        const again = enqueueJob(done, 'proj-1', 'GENERATE_IDLE', at(31));
        expect(jobsForProject(again, 'proj-1')).toHaveLength(2);
        expect(findActiveJob(again, 'proj-1', 'GENERATE_IDLE')).toBeTruthy();
    });

    it('취소한 작업은 더 이상 진행하지 않는다', () => {
        const running = tick(enqueueJob(newProject(), 'proj-1', 'GENERATE_IDLE', T0), at(12));
        const cancelled = cancelJob(running, running.jobs[0].id, at(13));
        expect(cancelled.jobs[0].status).toBe('CANCELLED');

        const later = tick(cancelled, at(90));
        expect(later.jobs[0].status).toBe('CANCELLED');
        expect(later.jobs[0].progress).toBe(50);
        expect(later.projects[0].stage).toBe('REFERENCE');
        expect(hasActiveJobs(later)).toBe(false);
    });

    it('없는 프로젝트에는 작업을 걸 수 없다', () => {
        expect(() => enqueueJob(emptyState(), 'nope', 'GENERATE_IDLE', T0)).toThrow('프로젝트를 찾을 수 없습니다');
    });

    it('변화가 없으면 같은 상태 객체를 그대로 돌려준다', () => {
        const idle = newProject();
        expect(tick(idle, at(999))).toBe(idle);
    });

    it('GPU 작업은 예상 시간과 비용을 미리 알려준다', () => {
        const estimate = estimateJob('GENERATE_IDLE');
        expect(estimate.gpuSeconds).toBeGreaterThan(0);
        expect(estimate.estimatedCostKrw).toBeGreaterThanOrEqual(0);
        expect(estimateJob('PREPARE_REFERENCE').gpuSeconds).toBe(0);
    });
});

describe('aiAvatarMockRepo 게시·롤백', () => {
    const reviewed = () => {
        let state = newProject();
        state = tick(enqueueJob(state, 'proj-1', 'GENERATE_IDLE', T0), at(30));
        state = tick(enqueueJob(state, 'proj-1', 'BUILD_REVIEW', at(30)), at(40));
        return state;
    };

    it('검수를 통과하지 않으면 게시할 수 없다', () => {
        expect(() => publishProject(newProject(), 'proj-1', 'consult', T0)).toThrow('검수 단계');
    });

    it('검수 통과 후 허용 대상에 게시하면 PUBLISHED가 된다', () => {
        const published = publishProject(reviewed(), 'proj-1', 'consult', at(50));
        expect(published.projects[0].stage).toBe('PUBLISHED');
        expect(latestPublication(published, 'proj-1', 'consult')?.assetUrl).toBe('/seoa/avatar/idle.mp4');
    });

    it('게시 이력이 없으면 롤백을 거부한다', () => {
        expect(() => rollbackPublication(reviewed(), 'proj-1', 'consult', at(50))).toThrow('게시 이력이 없습니다');
    });

    it('첫 게시만 있으면 되돌릴 이전 버전이 없다', () => {
        const published = publishProject(reviewed(), 'proj-1', 'consult', at(50));
        expect(() => rollbackPublication(published, 'proj-1', 'consult', at(60))).toThrow('되돌릴 이전 버전이 없습니다');
    });

    it('두 번째 게시 후에는 직전 자산으로 되돌린다', () => {
        const seeded = seedState(T0);
        const republished = publishProject(
            { ...seeded, projects: [{ ...seeded.projects[0], idleVideoUrl: '/seoa/avatar/idle-v2.mp4' }] },
            'seoa', 'consult', at(50),
        );
        expect(latestPublication(republished, 'seoa', 'consult')?.assetUrl).toBe('/seoa/avatar/idle-v2.mp4');

        const rolled = rollbackPublication(republished, 'seoa', 'consult', at(60));
        expect(latestPublication(rolled, 'seoa', 'consult')?.assetUrl).toBe('/seoa/avatar/idle.mp4');
    });

    it('게시 대상은 서로 독립적으로 관리된다', () => {
        const published = publishProject(reviewed(), 'proj-1', 'consult', at(50));
        expect(latestPublication(published, 'proj-1', 'aiworld')).toBeUndefined();
    });
});
