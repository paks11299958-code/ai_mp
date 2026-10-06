import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SajuEntry } from './SajuEntry';

vi.mock('./sajuHero', async importOriginal => {
    const actual = await importOriginal<typeof import('./sajuHero')>();
    return {
        ...actual,
        prefersReducedMotion: () => true,
        mountSajuHero: vi.fn(() => () => undefined),
        mountSajuLoadingSmoke: vi.fn(() => () => undefined),
    };
});

const runnerState = vi.hoisted(() => ({ result: null as null | { title: string; body: string }, reset: (() => {}) as () => void }));

vi.mock('./useSajuRunner', () => ({
    usePersonaMenus: () => ({ personaId: 'dogyeol', menus: [] }),
    useSavedBirth: () => [null, vi.fn()],
    useSajuRunner: () => ({
        loading: false, picking: null, result: runnerState.result, error: null,
        select: vi.fn(), pick: vi.fn(), run: vi.fn(), reset: runnerState.reset,
    }),
    sheetMenuFor: () => null,
    inputKindFor: () => null,
    dreamPlaceholder: () => '',
    withPartner: vi.fn(),
    withTwoPartners: vi.fn(),
}));

describe('SajuEntry 기본 CTA', () => {
    it('채팅과 친구 초대를 각각 독립된 버튼으로 실행한다', () => {
        const onStart = vi.fn();
        const onInvite = vi.fn();

        render(
            <SajuEntry
                guide={{ title: '도결(道潔) 선생', desc: '인생 멘토', autoRunFeatureKey: 'saju' }}
                onClose={vi.fn()}
                onStart={onStart}
                onFeature={vi.fn()}
                onInvite={onInvite}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: '도결 선생과 대화하기' }));
        expect(onStart).toHaveBeenCalledWith('saju');
        expect(onInvite).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: '🎁 친구 초대 +1000P' }));
        expect(onInvite).toHaveBeenCalledOnce();
    });
});

// ★2026-10-06 사장 지적: 풀이 결과가 떠 있을 때 ✕ 가 진입화면을 통째로 닫았다 → 차례 메뉴로 돌아가야 한다
describe('SajuEntry ✕ 와 풀이 패널', () => {
    const renderWith = (onClose = vi.fn()) => {
        render(<SajuEntry guide={{ title: '도결(道潔) 선생', desc: '' }} onClose={onClose} onStart={vi.fn()} onFeature={vi.fn()} onInvite={vi.fn()} />);
        return onClose;
    };
    it('결과 패널이 열려 있으면 ✕·Esc 는 진입화면을 닫지 않고 패널만 닫는다', () => {
        const reset = vi.fn();
        runnerState.result = { title: '오늘의 운세', body: '본문' }; runnerState.reset = reset;
        const onClose = renderWith();
        fireEvent.click(screen.getByRole('button', { name: '차례로 돌아가기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(reset).toHaveBeenCalledTimes(2);
        expect(onClose).not.toHaveBeenCalled();
        runnerState.result = null; runnerState.reset = () => {};
    });
    it('패널이 없으면 ✕ 는 진입화면을 닫는다', () => {
        const onClose = renderWith();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        expect(onClose).toHaveBeenCalledOnce();
    });
});
