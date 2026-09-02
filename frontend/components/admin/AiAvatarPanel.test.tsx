import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ★서버 원장에 연결된 패널이므로 apiService 를 통째로 가짜로 세운다.
//   테스트가 실제 네트워크를 타면 안 된다.
const api = {
    listAiAvatarProjects: vi.fn(),
    getAiAvatarProject: vi.fn(),
    createAiAvatarProject: vi.fn(),
    enqueueAiAvatarJob: vi.fn(),
    getAiAvatarJob: vi.fn(),
    cancelAiAvatarJob: vi.fn(),
    publishAiAvatar: vi.fn(),
    rollbackAiAvatar: vi.fn(),
    reviewAiAvatar: vi.fn(),
};
vi.mock('../../services/apiService', () => ({ adminApi: api }));

const { AiAvatarPanel } = await import('./AiAvatarPanel');

const project = (over: Partial<any> = {}) => ({
    id: 'p1', name: '서아 상담 아바타', personaName: '서아', stage: 'REVIEW',
    createdBy: 2, createdAt: '2026-09-02T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z', ...over,
});
const asset = (over: Partial<any> = {}) => ({
    id: 'a1', projectId: 'p1', kind: 'IDLE_VIDEO', storageKey: 'ai-avatar/p1/IDLE_VIDEO/abc',
    mime: 'video/mp4', bytes: 1234, sha256: 'abc', createdAt: '2026-09-02T00:00:00Z', ...over,
});
const job = (over: Partial<any> = {}) => ({
    id: 'j1', projectId: 'p1', kind: 'GENERATE_IDLE', status: 'QUEUED', progress: 0,
    errorCode: null, createdAt: '2026-09-02T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
    completedAt: null, ...over,
});

const detail = (over: Partial<any> = {}) => ({
    ok: true, project: project(), assets: [asset()], jobs: [], publications: [], reviews: [], ...over,
});

const review = (over: Partial<any> = {}) => ({
    id: 'r1', projectId: 'p1', identity: 5, temporal: 4, lipsync: 4, passed: true,
    note: null, reviewedBy: 2, createdAt: '2026-09-02T00:00:00Z', ...over,
});

beforeEach(() => {
    vi.clearAllMocks();
    api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
    api.getAiAvatarProject.mockResolvedValue(detail());
});

afterEach(() => { vi.restoreAllMocks(); });

/** 상세 로딩이 끝나 버튼이 눌릴 수 있게 될 때까지 기다린다(로딩 중엔 비활성). */
async function clickWhenEnabled(name: string | RegExp) {
    const btn = await screen.findByRole('button', { name }) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    fireEvent.click(btn);
}

describe('AiAvatarPanel — 서버 원장 연결', () => {
    it('서버에서 받은 프로젝트를 보여준다', async () => {
        render(<AiAvatarPanel />);
        expect(await screen.findByRole('heading', { name: '서아 상담 아바타' })).toBeTruthy();
        expect(api.listAiAvatarProjects).toHaveBeenCalled();
        expect(screen.getByText('GPU 미연결 · 큐 적재만')).toBeTruthy();
    });

    it('목록 조회가 실패하면 오류를 보여준다', async () => {
        api.listAiAvatarProjects.mockRejectedValue(new Error('권한이 없습니다.'));
        render(<AiAvatarPanel />);
        expect((await screen.findByRole('alert')).textContent).toContain('권한이 없습니다.');
    });

    it('프로젝트를 만들면 서버에 보내고 목록을 다시 읽는다', async () => {
        api.createAiAvatarProject.mockResolvedValue({ ok: true, project: project({ id: 'p2', name: '유나' }) });
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
        fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: '유나 아바타' } });
        fireEvent.change(screen.getByLabelText(/페르소나 이름/), { target: { value: '유나' } });
        fireEvent.click(screen.getByRole('button', { name: '만들기' }));

        await waitFor(() => expect(api.createAiAvatarProject).toHaveBeenCalledWith('유나 아바타', '유나'));
        expect(api.listAiAvatarProjects).toHaveBeenCalledTimes(2);
    });

    it('서버가 이름을 거부하면 그 메시지를 그대로 보여준다', async () => {
        api.createAiAvatarProject.mockRejectedValue(new Error('프로젝트 이름을 입력하세요.'));
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
        fireEvent.click(screen.getByRole('button', { name: '만들기' }));

        expect((await screen.findByRole('alert')).textContent).toContain('프로젝트 이름을 입력하세요.');
    });

    it('GPU 작업은 예상 비용 확인을 받고, 취소하면 서버를 부르지 않는다', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled(/대기 동작 생성/);

        expect(confirmSpy.mock.calls[0][0]).toContain('예상 비용');
        expect(api.enqueueAiAvatarJob).not.toHaveBeenCalled();
    });

    it('작업을 큐에 넣으면 서버에 보내고 상세를 다시 읽는다', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        api.enqueueAiAvatarJob.mockResolvedValue({ ok: true, job: job() });
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled(/대기 동작 생성/);

        await waitFor(() => expect(api.enqueueAiAvatarJob).toHaveBeenCalledWith('p1', 'GENERATE_IDLE'));
    });

    it('★이미 진행 중인 작업이면 중복 안내를 보여준다', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        api.enqueueAiAvatarJob.mockResolvedValue({ ok: true, job: job(), deduplicated: true });
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled(/대기 동작 생성/);

        expect((await screen.findByRole('status')).textContent).toContain('이미 같은 작업이 진행 중입니다.');
    });

    it('진행 중 작업이 있으면 폴링하고, 언마운트하면 타이머를 정리한다', async () => {
        api.getAiAvatarProject.mockResolvedValue(detail({ jobs: [job({ status: 'RUNNING', progress: 40 })] }));
        const clearSpy = vi.spyOn(globalThis, 'clearInterval');
        const { unmount } = render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });
        await waitFor(() => expect(screen.getByLabelText('작업 이력').textContent).toContain('진행 40%'));

        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });

    it('서버가 게시를 거부하면 그 이유를 보여준다', async () => {
        api.publishAiAvatar.mockRejectedValue(new Error('검수 단계를 통과한 프로젝트만 게시할 수 있습니다.'));
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled('공용 상담 (/consult) 게시');

        expect((await screen.findByRole('alert')).textContent).toContain('검수 단계를 통과한 프로젝트만');
    });

    it('게시할 자산이 없으면 서버를 부르지 않고 막는다', async () => {
        api.getAiAvatarProject.mockResolvedValue(detail({ assets: [] }));
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled('공용 상담 (/consult) 게시');

        expect((await screen.findByRole('alert')).textContent).toContain('게시할 자산이 없습니다');
        expect(api.publishAiAvatar).not.toHaveBeenCalled();
    });

    it('롤백은 대상별로 서버에 요청한다', async () => {
        api.rollbackAiAvatar.mockResolvedValue({ ok: true, publicationId: 'pub2' });
        render(<AiAvatarPanel />);
        await screen.findByRole('heading', { name: '서아 상담 아바타' });

        await clickWhenEnabled('AI월드 사업 상담 되돌리기');

        await waitFor(() => expect(api.rollbackAiAvatar).toHaveBeenCalledWith('p1', 'aiworld'));
    });
});

// ── 검수 점수표 (Phase 4) ──────────────────────────────────────────
// ★여기서 지키는 것: 점수 게이트가 **화면에서** 무력화되지 않는 것.
//   판정은 서버가 하므로, 화면은 "서버가 준 결과를 그대로 보여주는가"를 검증한다.
describe('검수 점수표', () => {
    it('세 축을 모두 보여주고 합격선을 함께 안내한다', async () => {
        api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
        api.getAiAvatarProject.mockResolvedValue(detail());
        render(<AiAvatarPanel />);
        await screen.findByText('검수 점수표');
        // ★1~5 버튼이 축마다 있는지로 본다(텍스트는 단계 설명과 겹친다).
        for (const label of ['정체성', '시간축', '립싱크']) {
            for (const n of [1, 2, 3, 4, 5]) {
                expect(screen.getByLabelText(`${label} ${n}점`)).toBeTruthy();
            }
        }
        // 정체성만 4점 이상이라는 것이 화면에 드러나야 한다.
        expect(screen.getByText(/얼굴이 그 사람으로 보이는가 · 4점 이상/)).toBeTruthy();
    });

    it('점수를 눌러 저장하면 서버로 보낸다', async () => {
        api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
        api.getAiAvatarProject.mockResolvedValue(detail());
        api.reviewAiAvatar.mockResolvedValue({
            ok: true, reviewId: 'r1', passed: true, stage: 'REVIEW',
            reason: '', failedAxes: [], missingAxes: [],
        });
        render(<AiAvatarPanel />);
        await screen.findByText('검수 점수표');
        fireEvent.click(screen.getByLabelText('정체성 5점'));
        fireEvent.click(screen.getByLabelText('시간축 4점'));
        fireEvent.click(screen.getByLabelText('립싱크 3점'));
        fireEvent.click(screen.getByLabelText('검수 점수 저장'));
        await waitFor(() => expect(api.reviewAiAvatar).toHaveBeenCalledWith(
            'p1', { identity: 5, temporal: 4, lipsync: 3 }));
    });

    it('★미통과 사유를 서버 문구 그대로 보여준다', async () => {
        api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
        api.getAiAvatarProject.mockResolvedValue(detail());
        api.reviewAiAvatar.mockResolvedValue({
            ok: true, reviewId: 'r2', passed: false, stage: 'LIPSYNC',
            reason: '합격선 미달: 정체성(4점 이상)', failedAxes: ['identity'], missingAxes: [],
        });
        render(<AiAvatarPanel />);
        await screen.findByText('검수 점수표');
        fireEvent.click(screen.getByLabelText('정체성 3점'));
        fireEvent.click(screen.getByLabelText('검수 점수 저장'));
        // 화면이 자체 판정으로 다른 말을 하면 안 된다.
        await screen.findByText(/합격선 미달: 정체성\(4점 이상\)/);
    });

    it('최근 검수 결과를 통과/미통과로 표시한다', async () => {
        api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
        api.getAiAvatarProject.mockResolvedValue(detail({ reviews: [review({ passed: false })] }));
        render(<AiAvatarPanel />);
        await screen.findByText(/미통과 — 게시 잠김/);
    });

    it('통과한 검수는 게시 가능으로 표시한다', async () => {
        api.listAiAvatarProjects.mockResolvedValue({ ok: true, projects: [project()] });
        api.getAiAvatarProject.mockResolvedValue(detail({ reviews: [review()] }));
        render(<AiAvatarPanel />);
        await screen.findByText(/통과 — 게시 가능/);
    });
});
