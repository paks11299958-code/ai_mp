import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { HajinShowroomEntry } from './HajinShowroomEntry';
import { HAJIN_MENU } from './hajinMenu';
import { entryStartDestination, getEntryChatTheme } from '../../lib/entryChatThemes';

const PERSONA_ID = 'hajin-test-id';
const media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
const makeProps = () => ({
    guide: { title: '박하진', desc: '', personaId: PERSONA_ID, imageUrl: '/persona/hajin.jpg' },
    onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
});

beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn(() => media));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('박하진 완성작 쇼룸 진입화면', () => {
    it('PersonaEntrySheet가 승인된 전용 화면으로 분기하고 guide 프로필을 쓴다', () => {
        const props = makeProps();
        const { container } = render(<PersonaEntrySheet {...props} />);
        expect(screen.getByRole('dialog', { name: '박하진 완성작 쇼룸' })).toBeInTheDocument();
        expect(container.querySelector('.hj-header img')).toHaveAttribute('src', '/persona/hajin.jpg');
        expect(screen.queryByRole('dialog', { name: '박하진 소개' })).toBeNull();
    });

    it('카드 4장이 homepage form·intro·list와 learn으로 정확히 연결된다', () => {
        const props = makeProps();
        const { container } = render(<HajinShowroomEntry {...props} />);
        expect(container.querySelectorAll('[data-menu-key]')).toHaveLength(4);
        const expected = [
            ['create', 'homepage', 'form'], ['samples', 'homepage', 'intro'],
            ['edit', 'homepage', 'list'], ['learn', 'learn', null],
        ] as const;
        for (const [key, feature, step] of expected) {
            sessionStorage.removeItem('homepage:start-step');
            fireEvent.click(container.querySelector(`[data-menu-key="${key}"]`)!);
            expect(props.onFeature).toHaveBeenLastCalledWith(feature);
            expect(sessionStorage.getItem('homepage:start-step')).toBe(step);
        }
        expect(HAJIN_MENU.map(item => item.key)).toEqual(['create', 'samples', 'edit', 'learn']);
    });

    it('승인 v2의 카드 배지를 네 메뉴 모두 표시한다', () => {
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        const expectedBadges = {
            create: '3,000P',
            samples: '[예시]',
            edit: '고치는 중',
            learn: '학습자료',
        } as const;

        for (const [key, badge] of Object.entries(expectedBadges)) {
            expect(container.querySelector(`[data-menu-key="${key}"] .hj-card-badge`)).toHaveTextContent(badge);
        }
    });

    it('배우기 페이지 이동은 현재 뒤로가기 가드만 소비하고 손님 안내에서는 유지한다', () => {
        window.history.replaceState({ aiLayer: true, keep: 'value' }, '');
        const member = makeProps();
        const view = render(<HajinShowroomEntry {...member} />);
        fireEvent.click(view.container.querySelector('[data-menu-key="learn"]')!);
        expect(window.history.state).toEqual({ aiLayer: false, keep: 'value' });
        view.unmount();

        window.history.replaceState({ aiLayer: true }, '');
        const guest = makeProps();
        render(<HajinShowroomEntry {...guest} isGuest />);
        fireEvent.click(screen.getByRole('button', { name: /배우기/ }));
        expect(window.history.state).toEqual({ aiLayer: true });
        expect(guest.onFeature).toHaveBeenCalledWith('learn');
    });

    it('비로그인 손님의 홈페이지 카드 클릭은 시작 단계를 세션에 남기지 않는다', () => {
        const guest = makeProps();
        const { container } = render(<HajinShowroomEntry {...guest} isGuest />);

        for (const key of ['create', 'samples', 'edit'] as const) {
            sessionStorage.removeItem('homepage:start-step');
            fireEvent.click(container.querySelector(`[data-menu-key="${key}"]`)!);
            expect(guest.onFeature).toHaveBeenLastCalledWith('homepage');
            expect(sessionStorage.getItem('homepage:start-step')).toBeNull();
        }
    });

    it('4초 자동 전환, 버튼·터치 전환, 자동 전환 끄기를 제공한다', () => {
        vi.useFakeTimers();
        const props = makeProps();
        const { container } = render(<HajinShowroomEntry {...props} />);
        expect(screen.getByText('동네 카페')).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(4000));
        expect(screen.getByText('미용실')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '다음 예시' }));
        expect(screen.getByText('공인중개사무소')).toBeInTheDocument();
        const phone = container.querySelector('.hj-phone')!;
        fireEvent.pointerDown(phone, { clientX: 200 }); fireEvent.pointerUp(phone, { clientX: 80 });
        expect(screen.getByText('동네 카페')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /자동 넘김/ }));
        act(() => vi.advanceTimersByTime(8000));
        expect(screen.getByText('동네 카페')).toBeInTheDocument();
    });

    it('reduced-motion이면 자동 전환을 처음부터 끈다', () => {
        vi.mocked(matchMedia).mockReturnValue({ ...media, matches: true } as unknown as MediaQueryList);
        vi.useFakeTimers();
        render(<HajinShowroomEntry {...makeProps()} />);
        expect(screen.getByRole('button', { name: /자동 넘김/ })).toHaveAttribute('aria-pressed', 'true');
        act(() => vi.advanceTimersByTime(8000));
        expect(screen.getByText('동네 카페')).toBeInTheDocument();
    });

    it('채팅 CTA가 DB guide id·사진을 등록하고 전용 모달 목적지를 연다', () => {
        const props = makeProps();
        render(<HajinShowroomEntry {...props} />);
        fireEvent.click(screen.getByRole('button', { name: '하진에게 물어보기' }));
        expect(props.onStart).toHaveBeenCalledWith();
        expect(entryStartDestination(PERSONA_ID)).toBe('modal');
        expect(getEntryChatTheme(PERSONA_ID)).toMatchObject({ visualPreset: 'showroom', fallbackPortrait: '/persona/hajin.jpg' });
    });

    it('닫기와 Escape는 진입화면을 한 단계 닫는다', () => {
        const props = makeProps();
        render(<HajinShowroomEntry {...props} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });
});
