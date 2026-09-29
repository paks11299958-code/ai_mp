import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryChatModal } from './EntryChatModal';
import { ENTRY_CHAT_THEMES } from '../../lib/entryChatThemes';
import { EUNBI_ID } from '../../lib/personaEmotion';

const base = () => ({
    theme: ENTRY_CHAT_THEMES[EUNBI_ID],
    messages: [
        { id: '1', role: 'model' as const, text: '(수줍게 웃으며) 안녕!' },
        { id: '2', role: 'user' as const, text: '반가워' },
    ],
    isTyping: false,
    emotion: 'love' as const,
    emotionImageUrl: '/eunbi/emo/love.jpg',
    balance: 123,
    onSend: vi.fn(async () => 'sent' as const),
    onClose: vi.fn(),
    onNeedCharge: vi.fn(),
    onOpenFullChat: vi.fn(),
});

describe('EntryChatModal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
        Element.prototype.scrollTo = vi.fn();
    });
    afterEach(() => { document.body.style.overflow = ''; });

    it('메시지와 괄호 지문, 감정 효과를 렌더한다', () => {
        const { container } = render(<EntryChatModal {...base()} />);
        expect(screen.getByText('(수줍게 웃으며)').classList.contains('ec-direction')).toBe(true);
        expect(screen.getByText('반가워')).toBeTruthy();
        expect(container.querySelector('.ec-overlay')?.classList.contains('ec-fx-love')).toBe(true);
        expect(container.querySelector('.ec-particles')).toBeTruthy();
    });

    it('보내면 onSend를 호출하고 입력을 비운다', async () => {
        const p = base(); render(<EntryChatModal {...p} />);
        const input = screen.getByLabelText('신은비에게 메시지 보내기') as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: '오늘 어때?' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' })); });
        expect(p.onSend).toHaveBeenCalledWith('오늘 어때?');
        expect(input.value).toBe('');
    });

    it('포인트 부족이면 글을 복원하고 충전 콜백을 부른다', async () => {
        const p = base(); p.onSend.mockResolvedValueOnce('insufficient');
        render(<EntryChatModal {...p} />);
        const input = screen.getByLabelText('신은비에게 메시지 보내기') as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: '기다려 줘' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' })); });
        expect(input.value).toBe('기다려 줘');
        expect(p.onNeedCharge).toHaveBeenCalledOnce();
    });

    it('Escape와 닫기 버튼이 onClose를 부른다', async () => {
        const p = base(); render(<EntryChatModal {...p} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 230)); });
        expect(p.onClose).toHaveBeenCalledOnce();
    });

    it('입력 중 표시와 스트리밍 커서를 보여준다', () => {
        const p = base(); p.isTyping = true; p.messages[0] = { ...p.messages[0], isStreaming: true };
        const { container } = render(<EntryChatModal {...p} />);
        expect(screen.getByText(/은비가 입력 중/)).toBeTruthy();
        expect(container.querySelector('.ec-cursor')).toBeTruthy();
    });

    it('관리자·매니저는 단가를 숨기고 잔액은 보인다', () => {
        render(<EntryChatModal {...base()} hideCost />);
        expect(screen.queryByText(/메시지당/)).toBeNull();
        expect(screen.getByText(/잔액 123P/)).toBeTruthy();
    });

    it('reduced motion이면 파티클 DOM을 만들지 않는다', () => {
        vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
        const { container } = render(<EntryChatModal {...base()} />);
        expect(container.querySelector('.ec-overlay')?.classList.contains('ec-reduced')).toBe(true);
        expect(container.querySelector('.ec-particles')).toBeNull();
    });
    it('감정이 새로 정해질 때마다(같은 감정이라도) 연출을 다시 재생한다 — 09-29 검수', () => {
        const p = base();
        const { container, rerender } = render(<EntryChatModal {...p} emotionSeq={1} />);
        const first = container.querySelector('.ec-particles');
        rerender(<EntryChatModal {...p} emotionSeq={1} />);
        expect(container.querySelector('.ec-particles')).toBe(first);          // 같은 순번이면 그대로
        rerender(<EntryChatModal {...p} emotionSeq={2} />);
        expect(container.querySelector('.ec-particles')).not.toBe(first);      // 새 순번이면 새로 그려 재생
    });

    it('응원은 별(★), 애정은 하트(♥) 파티클', () => {
        const { container, rerender } = render(<EntryChatModal {...base()} emotion="cheer" />);
        expect(container.querySelector('.ec-particles i')?.textContent).toBe('★');
        rerender(<EntryChatModal {...base()} emotion="love" emotionSeq={9} />);
        expect(container.querySelector('.ec-particles i')?.textContent).toBe('♥');
    });

    it('처음 열 때만 순서대로 등장, 이후 새 메시지는 지연 없이 — 09-29 검수', () => {
        const p = base();
        const { container, rerender } = render(<EntryChatModal {...p} />);
        const more = [...p.messages, ...Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, role: 'model' as const, text: `새 ${i}` }))];
        rerender(<EntryChatModal {...p} messages={more} />);
        const rows = container.querySelectorAll<HTMLElement>('.ec-row');
        expect(rows[1].style.getPropertyValue('--ec-delay')).toBe('70ms');
        expect(rows[rows.length - 1].style.getPropertyValue('--ec-delay')).toBe('0ms');
    });
});
