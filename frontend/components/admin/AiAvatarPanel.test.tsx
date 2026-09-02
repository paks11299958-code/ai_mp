import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiAvatarPanel } from './AiAvatarPanel';

describe('AiAvatarPanel 뼈대', () => {
    it('검증된 서아 자산과 비활성 개발 경계를 보여주며 네트워크를 호출하지 않는다', () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        render(<AiAvatarPanel />);

        expect(screen.getByRole('heading', { name: 'AI 아바타' })).toBeTruthy();
        expect(screen.getByLabelText('서아 대기 동작 미리보기').getAttribute('src')).toBe('/seoa/avatar/idle.mp4');
        expect(screen.getByLabelText('서아 말하기 동작 미리보기').getAttribute('src')).toBe('/seoa/avatar/speaking-poc.mp4');
        expect((screen.getByRole('button', { name: '작업 실행' }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('백엔드 미연결')).toBeTruthy();
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
