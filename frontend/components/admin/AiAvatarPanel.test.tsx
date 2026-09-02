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
    ok: true, project: project(), assets: [asset()], jobs: [], publications: [], ...over,
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
