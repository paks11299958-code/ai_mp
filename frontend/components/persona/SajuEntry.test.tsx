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

vi.mock('./useSajuRunner', () => ({
    usePersonaMenus: () => ({ personaId: 'dogyeol', menus: [] }),
    useSavedBirth: () => [null, vi.fn()],
    useSajuRunner: () => ({
        loading: false, picking: null, result: null, error: null,
        select: vi.fn(), pick: vi.fn(), run: vi.fn(), reset: vi.fn(),
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
