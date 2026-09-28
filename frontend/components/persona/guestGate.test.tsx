import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 비로그인 진입화면(2026-09-28) — 화면 안에서 직접 서버를 부르는 동작이 gate 로 가는지.
const { select } = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('./sajuHero', async importOriginal => {
    const actual = await importOriginal<typeof import('./sajuHero')>();
    return { ...actual, prefersReducedMotion: () => true,
        mountSajuHero: vi.fn(() => () => undefined), mountSajuLoadingSmoke: vi.fn(() => () => undefined) };
});
vi.mock('./useSajuRunner', () => ({
    usePersonaMenus: () => ({ id: 'dogyeol', menus: [{ label: '📅 운세', prompt: 'p', resultCard: true }] }),
    useSavedBirth: () => [null, vi.fn()],
    useSajuRunner: () => ({ loading: false, picking: null, result: null, error: null,
        select, pick: vi.fn(), run: vi.fn(), reset: vi.fn() }),
    // 회원이면 창 안에서 바로 풀이(유료 API)로 가는 메뉴가 있다고 가정한다.
    sheetMenuFor: () => ({ label: '📅 운세', prompt: 'p', resultCard: true }),
    inputKindFor: () => undefined,
    dreamPlaceholder: () => '',
    withPartner: vi.fn(), withTwoPartners: vi.fn(),
}));

import { PersonaEntrySheet } from '../PersonaEntrySheet';

const base = () => ({ onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(), onGuestGate: vi.fn() });
const sajuGuide = { title: '도결(道潔) 선생', desc: '사주', features: [{ key: 'siwoon', name: '시운의 흐름', icon: 'x', accent: '#000', bg: '#fff' }] };

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('도결 진입화면 — 비로그인 gate', () => {
    beforeEach(() => select.mockClear());

    it('비로그인: 풀이 칩을 누르면 유료 API 대신 gate(paid, 키)', () => {
        const p = base();
        render(<PersonaEntrySheet guide={sajuGuide} {...p} isGuest />);
        fireEvent.click(screen.getAllByRole('button', { name: /시운의 흐름/ })[0]);
        expect(p.onGuestGate).toHaveBeenCalledWith('paid', 'siwoon');
        expect(select).not.toHaveBeenCalled();
    });

    it('회원(isGuest 없음): onGuestGate 를 넘겨도 종전처럼 창 안 풀이로 간다', () => {
        const p = base();
        render(<PersonaEntrySheet guide={sajuGuide} {...p} />);
        fireEvent.click(screen.getAllByRole('button', { name: /시운의 흐름/ })[0]);
        expect(select).toHaveBeenCalledTimes(1);
        expect(p.onGuestGate).not.toHaveBeenCalled();
    });
});

describe('서아 진입화면 — 비로그인 gate', () => {
    beforeEach(() => {
        localStorage.removeItem('token');
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url === '/api/news/categories') return Promise.resolve(jsonResponse({ categories: [{ key: '국내뉴스', label: '국내 뉴스' }] }));
            if (url === '/api/news/status') return Promise.resolve(jsonResponse({ slot: 'am', slots: ['am'] }));
            if (url === '/api/desk/summary') return Promise.resolve(jsonResponse({ markets: [] }));
            return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }));
    });
    afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

    it('비로그인: 뉴스 본문(유료)은 gate(paid, news), 듣기는 gate(free) — 인증 요청을 보내지 않는다', async () => {
        const p = base();
        render(<PersonaEntrySheet guide={{ title: '서아', desc: '뉴스' }} {...p} isGuest />);
        fireEvent.click(await screen.findByRole('button', { name: '국내 뉴스' }));
        expect(p.onGuestGate).toHaveBeenLastCalledWith('paid', 'news');
        fireEvent.click(screen.getByRole('button', { name: '국내 뉴스 들려주기' }));
        expect(p.onGuestGate).toHaveBeenLastCalledWith('free');
        const urls = (fetch as any).mock.calls.map((c: any[]) => String(c[0]));
        expect(urls.some((u: string) => u.startsWith('/api/news/tts') || u === '/api/points/menu-prices')).toBe(false);
        expect(screen.queryByText('오늘 뉴스 본문은 로그인 후에 보실 수 있어요.')).toBeNull();
    });

    it('isGuest 없이(종전) 토큰이 없으면 기존 needLogin 힌트를 띄운다', async () => {
        const p = base();
        render(<PersonaEntrySheet guide={{ title: '서아', desc: '뉴스' }} {...p} />);
        fireEvent.click(await screen.findByRole('button', { name: '국내 뉴스' }));
        expect(p.onGuestGate).not.toHaveBeenCalled();
        expect(screen.getByText('오늘 뉴스 본문은 로그인 후에 보실 수 있어요.')).toBeTruthy();
    });
});
