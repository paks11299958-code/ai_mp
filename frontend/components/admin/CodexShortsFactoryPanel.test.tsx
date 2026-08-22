import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CodexShortsFactoryPanel } from './CodexShortsFactoryPanel';

describe('CodexShortsFactoryPanel', () => {
    beforeEach(() => localStorage.clear());

    it('빈 상태에서 작업을 만들고 대본을 장면으로 나눈다', async () => {
        render(<CodexShortsFactoryPanel />);
        fireEvent.click(screen.getByRole('button', { name: '첫 작업 만들기' }));

        const script = screen.getByPlaceholderText(/\[장면 1\]/);
        fireEvent.change(script, {
            target: { value: '[장면 1]\n화면 연출: 저녁 식탁\n화면 자막: 마음이 씁쓸해요\n내레이션 (지은): 솔직하게 이야기해 보세요.' },
        });
        fireEvent.click(screen.getByRole('button', { name: '장면으로 나누기' }));

        expect(await screen.findByText('장면 1')).toBeTruthy();
        expect(screen.getByDisplayValue('마음이 씁쓸해요')).toBeTruthy();
        await waitFor(() => expect(localStorage.getItem('aichat:codex-shorts-factory:v1')).toContain('솔직하게'));
    });
});
