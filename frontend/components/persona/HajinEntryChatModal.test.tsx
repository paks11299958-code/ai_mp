import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../types';
import { EntryChatModal } from './EntryChatModal';
import { getEntryChatTheme, registerHajinEntryChatTheme } from '../../lib/entryChatThemes';

const ID = 'hajin-chat-test';
const props = () => ({
    theme: getEntryChatTheme(ID)!, messages: [] as Message[], isTyping: false, balance: 3200, draftOwner: 'owner',
    onSend: vi.fn(async () => 'sent' as const), onClose: vi.fn(), onNeedCharge: vi.fn(), onOpenFullChat: vi.fn(), onFeature: vi.fn(),
});

beforeEach(() => { registerHajinEntryChatTheme(ID, '/persona/hajin.webp'); sessionStorage.clear(); Element.prototype.scrollTo = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('박하진 전용 채팅', () => {
    it('뒤로·프로필·이름·닫기를 한 줄로 표시하고 메뉴 4개를 접어 둔다', () => {
        const p = props(); const { container } = render(<EntryChatModal {...p} />);
        expect(container.querySelectorAll('.hj-chat-header')).toHaveLength(1);
        expect(container.querySelector('.hj-chat-header img')).toHaveAttribute('src', '/persona/hajin.webp');
        expect(screen.getByRole('dialog', { name: '박하진' })).toBeInTheDocument();
        expect(container.querySelectorAll('#hj-chat-menu')).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: '메뉴 펼치기 ⌄' }));
        expect(container.querySelectorAll('#hj-chat-menu [data-menu-key]')).toHaveLength(4);
    });

    it('메뉴 Escape는 메뉴만 접고 다음 Escape는 진입화면으로 돌아간다', () => {
        const p = props(); render(<EntryChatModal {...p} />);
        const toggle = screen.getByRole('button', { name: '메뉴 펼치기 ⌄' });
        fireEvent.click(toggle);
        screen.getByRole('button', { name: /우리 가게 홈페이지 만들기/ }).focus();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(toggle).toHaveFocus();
        expect(p.onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(p.onClose).toHaveBeenCalledOnce();
    });

    it('저장된 첫 인사만 있으면 고정 인사를 겹쳐 표시하지 않는다', () => {
        const p = props();
        render(<EntryChatModal {...p} messages={[{ id: 'hello', role: 'assistant', text: '저장된 첫 인사' } as Message]} />);
        expect(screen.getByText('저장된 첫 인사')).toBeInTheDocument();
        expect(screen.queryByText(/안녕하세요, 박하진입니다/)).toBeNull();
    });

    it('반복 열기·닫기 뒤 Esc 이벤트는 현재 모달에 한 번만 전달된다', () => {
        const first = props();
        const view = render(<EntryChatModal {...first} />);
        view.unmount();
        const second = props();
        render(<EntryChatModal {...second} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(first.onClose).not.toHaveBeenCalled();
        expect(second.onClose).toHaveBeenCalledOnce();
    });

    it('마크다운·인사 접기·초안 보존·기존 전송 계약을 유지한다', async () => {
        const p = props();
        const messages = [
            { id: 'g1', role: 'assistant', text: '옛 인사' }, { id: 'g2', role: 'assistant', text: '새 인사' },
            { id: 'u', role: 'user', text: '질문' }, { id: 'm', role: 'model', text: '**핵심**\n\n- 하나\n- 둘' },
        ] as Message[];
        render(<EntryChatModal {...p} messages={messages} />);
        expect(screen.queryByText('옛 인사')).toBeNull();
        expect(screen.getByText('핵심').tagName).toBe('STRONG');
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: '홈페이지 질문' } });
        await act(async () => fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' })));
        expect(p.onSend).toHaveBeenCalledWith('홈페이지 질문');
        await waitFor(() => expect(input).toHaveValue(''));
    });
});
