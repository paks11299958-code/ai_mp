import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EntryChatModal } from './EntryChatModal';
import { CHAEWON_ID, entryStartDestination, getEntryChatTheme } from '../../lib/entryChatThemes';
import type { Message } from '../../types';

const props = {
    theme: getEntryChatTheme(CHAEWON_ID)!, messages: [] as Message[], isTyping: false, balance: 100,
    draftOwner: 'review', onSend: vi.fn(async () => 'sent' as const), onClose: vi.fn(), onNeedCharge: vi.fn(),
    onOpenFullChat: vi.fn(), onFeature: vi.fn(),
};
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); Element.prototype.scrollTo = vi.fn(); });
afterEach(cleanup);
describe('채원 desk 채팅', () => {
    it('실제 ID로 모달에 진입하고 기능 키 진입은 기존 채팅 경로다', () => {
        expect(entryStartDestination(CHAEWON_ID)).toBe('modal');
        expect(entryStartDestination(CHAEWON_ID, 'stock')).toBe('chat');
        const { container } = render(<EntryChatModal {...props} />); expect(container.querySelector('.cw-chat')).toBeTruthy();
        expect(screen.getByText(/투자 권유가 아닙니다/)).toBeInTheDocument(); expect(screen.getByText(/대화 10P/)).toBeInTheDocument();
    });
    it('메뉴 펼침·각 기능·대화 접기·Escape 한 단계 닫기', () => {
        render(<EntryChatModal {...props} />);
        const menu = screen.getByRole('button', { name: /메뉴/ }); fireEvent.click(menu);
        fireEvent.click(screen.getByRole('button', { name: /내 종목 분석/ })); expect(props.onFeature).toHaveBeenCalledWith('stock');
        fireEvent.click(menu); fireEvent.click(screen.getByRole('button', { name: /AI 관심 종목/ }));
        expect(props.onFeature).toHaveBeenCalledWith('stock-picks');
        fireEvent.click(menu); fireEvent.click(screen.getByRole('button', { name: /채원과 대화/ }));
        expect(menu).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(menu); fireEvent.keyDown(window, { key: 'Escape' }); expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: 'Escape' }); expect(props.onClose).toHaveBeenCalledTimes(1);
    });
    it('마크다운 답변과 인사 접기를 렌더하고 원격 이미지는 그리지 않는다', () => {
        const { container } = render(<EntryChatModal {...props} messages={[
            { id: 'a', role: 'assistant', text: '옛 인사' }, { id: 'b', role: 'assistant', text: '새 인사' },
            { id: 'u', role: 'user', text: '자료 설명' },
            { id: 'm', role: 'model', text: '**실적**을 확인해요.\n\n- 매출\n- 위험\n\n![원격](https://example.com/image.png)' },
        ] as Message[]} />);
        expect(screen.queryByText('옛 인사')).toBeNull(); expect(screen.getByText('새 인사')).toBeInTheDocument();
        expect(container.querySelector('strong')?.textContent).toBe('윤채원');
        expect(container.querySelector('.cw-body strong')?.textContent).toBe('실적');
        expect(container.querySelectorAll('.cw-body li')).toHaveLength(2); expect(container.querySelector('img')).toBeNull();
    });
    it('보드 왕복·부족·오류에서 초안을 보존하고 성공에만 삭제한다', async () => {
        const blocked = vi.fn(async () => 'insufficient' as const);
        const first = render(<EntryChatModal {...props} onSend={blocked} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '초안' } }); first.unmount();
        const second = render(<EntryChatModal {...props} onSend={blocked} />);
        expect(screen.getByRole('textbox')).toHaveValue('초안');
        fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }));
        await screen.findByText('포인트가 부족해요. 입력한 내용은 보관했어요.');
        fireEvent.click(screen.getByRole('button', { name: '포인트 충전하기' })); expect(props.onNeedCharge).toHaveBeenCalled();
        expect(screen.getByRole('textbox')).toHaveValue('초안'); second.unmount();
        render(<EntryChatModal {...props} />); fireEvent.click(screen.getByRole('button', { name: '메시지 보내기' }));
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    });
    it('초안은 회원별로 분리하고 전체 채팅 콜백을 사용한다', () => {
        sessionStorage.setItem(`chaewon-draft:review:${CHAEWON_ID}`, '비공개 초안');
        render(<EntryChatModal {...props} draftOwner="different" />); expect(screen.getByRole('textbox')).toHaveValue('');
        fireEvent.click(screen.getByRole('button', { name: /전체 채팅 화면/ })); expect(props.onOpenFullChat).toHaveBeenCalled();
    });
    it('전송 중 중복 요청을 막는다', async () => {
        let complete!: (value: 'sent') => void;
        const send = vi.fn(() => new Promise<'sent'>(resolve => { complete = resolve; }));
        render(<EntryChatModal {...props} onSend={send} />);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: '질문' } });
        const button = screen.getByRole('button', { name: '메시지 보내기' }); fireEvent.click(button); fireEvent.click(button);
        expect(send).toHaveBeenCalledTimes(1); complete('sent'); await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    });
});
