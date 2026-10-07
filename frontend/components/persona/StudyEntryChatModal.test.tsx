import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntryChatModal } from './EntryChatModal';
import { getEntryChatTheme, entryStartDestination } from '../../lib/entryChatThemes';
import type { Message } from '../../types';
const props = {
    theme: getEntryChatTheme('learning-coach')!, messages: [] as Message[], isTyping: false, balance: 100,
    draftOwner: 'review', onSend: vi.fn(async () => 'sent' as const), onClose: vi.fn(), onNeedCharge: vi.fn(), onOpenFullChat: vi.fn(),
};
beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); Element.prototype.scrollTo = vi.fn();
});
afterEach(cleanup);
describe('study paid-chat contract', () => {
    it('opens the study preset and routes the six learning tools with a foldable menu', () => {
        expect(entryStartDestination('learning-coach')).toBe('modal'); render(<EntryChatModal {...props} />);
        const menu = screen.getByRole('button', { name: /^메뉴/ }); fireEvent.click(menu);
        const links = screen.getByRole('navigation', { name: '학습 메뉴' }).querySelectorAll('a'); expect(links).toHaveLength(6);
        expect(links[0]).toHaveAttribute('href', '/learning/onboarding');
        expect(links[1]).toHaveAttribute('href', '/learning/dashboard');
        expect(links[2]).toHaveAttribute('href', '/learning/curriculum');
        expect(links[3]).toHaveAttribute('href', '/learning/review');
        expect(links[4]).toHaveAttribute('href', '/learning/dashboard?report=unavailable');
        fireEvent.click(links[5]); expect(menu).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(menu); fireEvent.keyDown(window, { key: 'Escape' }); expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: 'Escape' }); expect(props.onClose).toHaveBeenCalledOnce();
    });
    it('folds repeated greetings and renders markdown without remote images', () => {
        const { container } = render(<EntryChatModal {...props} messages={[
            { id: 'a', role: 'assistant', text: '옛 인사' }, { id: 'b', role: 'assistant', text: '새 인사' },
            { id: 'u', role: 'user', text: '질문' }, { id: 'm', role: 'model', text: '**참조**\n\n- 상대\n- 절대\n\n![원격](https://x.test/image)' },
        ] as Message[]} />);
        expect(screen.queryByText('옛 인사')).toBeNull(); expect(screen.getByText('새 인사')).toBeInTheDocument();
        expect(container.querySelector('.sc-body strong')?.textContent).toBe('참조');
        expect(container.querySelectorAll('.sc-body li')).toHaveLength(2); expect(container.querySelector('.sc-body img')).toBeNull();
    });
    it('preserves the draft on insufficient and only removes it after a confirmed send', async () => {
        const blocked = vi.fn(async () => 'insufficient' as const);
        const first = render(<EntryChatModal {...props} onSend={blocked} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '이해가 안 돼요' } });
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }));
        await screen.findByText('포인트가 부족해요. 입력한 내용은 보관했어요.');
        fireEvent.click(screen.getByRole('button', { name: '포인트 충전하기' })); expect(props.onNeedCharge).toHaveBeenCalledOnce();
        expect(screen.getByRole('textbox')).toHaveValue('이해가 안 돼요'); first.unmount();
        render(<EntryChatModal {...props} />); expect(screen.getByRole('textbox')).toHaveValue('이해가 안 돼요');
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }));
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    });
    it('retains the draft if App blocks a persona-mismatched send', async () => {
        render(<EntryChatModal {...props} onSend={vi.fn(async () => 'blocked' as const)} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '초안' } });
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }));
        await waitFor(() => expect(screen.getByRole('textbox')).not.toBeDisabled());
        expect(screen.getByRole('textbox')).toHaveValue('초안');
    });
    it('blocks duplicate sends while the existing callback is pending', async () => {
        let finish!: (value: 'sent') => void;
        const send = vi.fn(() => new Promise<'sent'>(resolve => { finish = resolve; }));
        render(<EntryChatModal {...props} onSend={send} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '질문' } });
        const button = screen.getByRole('button', { name: '메시지 보내기' }); fireEvent.click(button); fireEvent.click(button);
        expect(send).toHaveBeenCalledOnce(); finish('sent'); await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    });
    it('separates drafts by owner and preserves full-chat callback', () => {
        sessionStorage.setItem('study-draft:other:learning-coach', '다른 사람 초안'); render(<EntryChatModal {...props} />);
        expect(screen.getByRole('textbox')).toHaveValue('');
        fireEvent.click(screen.getByRole('button', { name: /전체 채팅 화면/ })); expect(props.onOpenFullChat).toHaveBeenCalledOnce();
    });
});
