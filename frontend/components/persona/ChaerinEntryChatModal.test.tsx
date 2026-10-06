import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryChatModal, type EntryChatModalProps } from './EntryChatModal';
import { CHAERIN_ID } from './chaerinMenu';
import { entryChatHasFeatureMenu, entryStartDestination, getEntryChatTheme } from '../../lib/entryChatThemes';

const input = () => screen.getByRole('textbox', { name: '윤채린에게 메시지 보내기' }) as HTMLTextAreaElement;
const button = (name: RegExp | string) => screen.getByRole('button', { name });
const renderChat = (over: Partial<EntryChatModalProps & { draftOwner: string }> = {}) => {
    const props = {
        theme: getEntryChatTheme(CHAERIN_ID)!,
        messages: [],
        isTyping: false,
        balance: 1200,
        draftOwner: 'member-1',
        onSend: vi.fn(async () => 'sent' as const),
        onClose: vi.fn(),
        onNeedCharge: vi.fn(),
        onOpenFullChat: vi.fn(),
        onFeature: vi.fn(),
        ...over,
    };
    const view = render(<EntryChatModal {...props} />);
    return { props, ...view };
};

describe('채린 beauty 채팅 기존 계약', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify({ prices: { 'beauty-estimate': 350 } }))),
        );
        HTMLElement.prototype.scrollTo = vi.fn();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        sessionStorage.clear();
    });

    it('채린은 beauty 모달, 기능 딥링크는 기존 경로로 등록된다', () => {
        expect(getEntryChatTheme(CHAERIN_ID)?.visualPreset).toBe('beauty');
        expect(entryChatHasFeatureMenu(getEntryChatTheme(CHAERIN_ID))).toBe(true);
        expect(entryStartDestination(CHAERIN_ID)).toBe('modal');
        expect(entryStartDestination(CHAERIN_ID, 'hair')).toBe('chat');
        renderChat();
        expect(document.querySelector('.cb-chat')).toBeTruthy();
        expect(screen.getAllByText('AI 뷰티 컨설턴트 · 의료인 아님').length).toBeGreaterThan(0);
        expect(screen.queryByRole('button', { name: /성형 견적/ })).toBeNull();
    });

    it('기능 메뉴는 한 곳의 6개 그림 카드이고 정확한 키를 전달한다', async () => {
        const { props } = renderChat();
        for (const [name, key] of [
            ['성형 견적', 'beauty-estimate'],
            ['평균 가격', 'beauty-table'],
            ['헤어 체인지', 'hair'],
            ['프로필 화보', 'outfit'],
            ['시간여행', 'agetransform'],
            ['닮은꼴', 'lookalike'],
        ]) {
            fireEvent.click(button(/기능 메뉴/));
            expect(document.querySelectorAll('.cb-picture-card')).toHaveLength(6);
            await waitFor(() => expect(button(/성형 견적/).textContent).toContain('350P'));
            fireEvent.click(button(new RegExp(name)));
            expect(props.onFeature).toHaveBeenLastCalledWith(key);
        }
        expect(props.onFeature).toHaveBeenCalledTimes(6);
    });

    it('메뉴·보드로 이동해 재마운트해도 같은 회원의 초안은 남는다', () => {
        const first = renderChat();
        fireEvent.change(input(), { target: { value: '보드 닫고 계속 쓰는 말' } });
        fireEvent.click(button(/기능 메뉴/));
        fireEvent.click(button(/헤어 체인지/));
        first.unmount();
        const next = renderChat();
        expect(input().value).toBe('보드 닫고 계속 쓰는 말');
        next.unmount();
        renderChat({ draftOwner: 'member-2' });
        expect(input().value).toBe('');
    });

    it('전송 연타는 onSend 1회, 성공 후만 초안 삭제한다', async () => {
        let finish!: (value: 'sent') => void;
        const send = vi.fn(
            () =>
                new Promise<'sent'>((resolve) => {
                    finish = resolve;
                }),
        );
        renderChat({ onSend: send });
        fireEvent.change(input(), { target: { value: '  피부 고민  ' } });
        fireEvent.click(button('메시지 보내기'));
        fireEvent.click(button('메시지 보내기'));
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith('피부 고민');
        expect(input().value).toBe('  피부 고민  ');
        await act(async () => finish('sent'));
        expect(input().value).toBe('');
    });

    it('부족·차단·실패 시 초안 유지, 충전은 기존 콜백으로만 연다', async () => {
        const send = vi.fn(async () => 'insufficient' as const);
        const { props, rerender } = renderChat({ balance: 5, onSend: send });
        fireEvent.change(input(), { target: { value: '아직 보내지 못한 말' } });
        fireEvent.click(button('메시지 보내기'));
        await screen.findByText('잠깐, 포인트가 부족해.');
        expect(input().value).toBe('아직 보내지 못한 말');
        fireEvent.click(button('포인트 충전하기'));
        expect(props.onNeedCharge).toHaveBeenCalledTimes(1);
        rerender(<EntryChatModal {...props} onSend={async () => 'blocked'} />);
        fireEvent.click(button('메시지 보내기'));
        await screen.findByText(/지금은 보낼 수 없어/);
        expect(input().value).toBe('아직 보내지 못한 말');
        rerender(
            <EntryChatModal
                {...props}
                onSend={async () => {
                    throw new Error('offline');
                }}
            />,
        );
        fireEvent.click(button('메시지 보내기'));
        await screen.findByText(/전송하지 못했어/);
        expect(input().value).toBe('아직 보내지 못한 말');
    });

    it('채팅 뒤 진입 시트는 inert이며 닫으면 복원된다', () => {
        const entry = document.createElement('section');
        entry.className = 'cc-root';
        document.body.appendChild(entry);
        const { unmount } = renderChat();
        expect(entry.hasAttribute('inert')).toBe(true);
        unmount();
        expect(entry.hasAttribute('inert')).toBe(false);
        entry.remove();
    });

    it('전역 충전 창이 위에 있으면 Escape와 Tab을 가로채지 않는다', () => {
        const { props } = renderChat();
        const charge = document.createElement('div');
        charge.className = 'z-[9000]';
        document.body.appendChild(charge);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        window.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        charge.remove();
    });

    it('응답 중엔 메뉴 기능과 메시지를 중복 실행하지 않는다', () => {
        const { props } = renderChat({ isTyping: true });
        fireEvent.change(input(), { target: { value: '기다리는 말' } });
        fireEvent.click(button(/기능 메뉴/));
        fireEvent.click(button(/프로필 화보/));
        fireEvent.click(button('메시지 보내기'));
        expect(props.onFeature).not.toHaveBeenCalled();
        expect(props.onSend).not.toHaveBeenCalled();
    });

    it('Markdown과 인사 run 정리, 전체 채팅, Escape 계약을 유지한다', () => {
        const { props } = renderChat({
            messages: [{ id: 'm1', role: 'model', text: '**성분**을 같이 보자.', timestamp: new Date() }],
        });
        expect(screen.getByText('성분').tagName).toBe('STRONG');
        fireEvent.click(button('전체 채팅 화면으로 →'));
        expect(props.onOpenFullChat).toHaveBeenCalledTimes(1);
        fireEvent.click(button(/기능 메뉴/));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
