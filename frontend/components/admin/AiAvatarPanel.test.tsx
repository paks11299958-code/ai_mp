import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAvatarPanel } from './AiAvatarPanel';

describe('AiAvatarPanel Phase 1 mock 연결', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('시드된 서아 프로젝트 자산을 보여주고 네트워크를 호출하지 않는다', () => {
        render(<AiAvatarPanel />);

        expect(screen.getByRole('heading', { name: 'AI 아바타' })).toBeTruthy();
        expect(screen.getByLabelText('서아 대기 동작 미리보기').getAttribute('src')).toBe('/seoa/avatar/idle.mp4');
        expect(screen.getByLabelText('서아 말하기 동작 미리보기').getAttribute('src')).toBe('/seoa/avatar/speaking-poc.mp4');
        expect(screen.getByText('Mock 원장 · 백엔드 미연결')).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('새 프로젝트를 만들면 목록에 추가되고 선택된다', () => {
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
        fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: '유나 아바타' } });
        fireEvent.change(screen.getByLabelText(/페르소나 이름/), { target: { value: '유나' } });
        fireEvent.click(screen.getByRole('button', { name: '만들기' }));

        expect(screen.getByRole('heading', { name: '유나 아바타' })).toBeTruthy();
        expect(screen.getByRole('status').textContent).toContain('프로젝트를 만들었습니다');
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('이름 없이 만들면 오류를 보여주고 프로젝트를 만들지 않는다', () => {
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
        fireEvent.click(screen.getByRole('button', { name: '만들기' }));

        expect(screen.getByRole('alert').textContent).toContain('프로젝트 이름');
    });

    it('GPU 작업은 예상 비용 확인을 받고, 취소하면 큐에 넣지 않는다', () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: /대기 동작 생성/ }));

        expect(confirmSpy).toHaveBeenCalledOnce();
        expect(confirmSpy.mock.calls[0][0]).toContain('예상 비용');
        expect(screen.queryByLabelText('작업 이력')).toBeNull();
    });

    it('작업을 실행하면 진행률이 올라가고 완료 시 단계가 갱신된다', async () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.useFakeTimers({ shouldAdvanceTime: true });
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: /대기 동작 생성/ }));
        expect(screen.getByLabelText('작업 이력').textContent).toContain('대기 중');

        await act(async () => { await vi.advanceTimersByTimeAsync(25_000); });

        await waitFor(() => expect(screen.getByLabelText('작업 이력').textContent).toContain('완료'));
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('검수를 통과하지 않은 프로젝트는 게시를 거부한다', () => {
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: '새 프로젝트' }));
        fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: '신규' } });
        fireEvent.change(screen.getByLabelText(/페르소나 이름/), { target: { value: '테스트' } });
        fireEvent.click(screen.getByRole('button', { name: '만들기' }));

        fireEvent.click(screen.getByRole('button', { name: '공용 상담 (/consult) 게시' }));

        expect(screen.getByRole('alert').textContent).toContain('검수 단계');
    });

    it('되돌릴 이전 버전이 없으면 롤백을 거부한다', () => {
        render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: '공용 상담 (/consult) 되돌리기' }));

        expect(screen.getByRole('alert').textContent).toContain('되돌릴 이전 버전이 없습니다');
    });

    it('언마운트하면 폴링 타이머를 정리한다', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        const clearSpy = vi.spyOn(globalThis, 'clearInterval');
        const { unmount } = render(<AiAvatarPanel />);

        fireEvent.click(screen.getByRole('button', { name: /대기 동작 생성/ }));
        unmount();

        expect(clearSpy).toHaveBeenCalled();
    });
});
