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
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('동네 카페');
        act(() => vi.advanceTimersByTime(4000));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('미용실');
        fireEvent.click(screen.getByRole('button', { name: '다음 예시' }));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('공인중개사무소');
        const phone = container.querySelector('.hj-phone')!;
        fireEvent.pointerDown(phone, { clientX: 200 }); fireEvent.pointerUp(phone, { clientX: 80 });
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('렌탈핏');
        expect(screen.getByRole('button', { name: /자동 넘김/ })).toHaveAttribute('aria-pressed', 'true');
        act(() => vi.advanceTimersByTime(8000));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('렌탈핏');
    });

    it('reduced-motion이면 자동 전환을 처음부터 끈다', () => {
        vi.mocked(matchMedia).mockReturnValue({ ...media, matches: true } as unknown as MediaQueryList);
        vi.useFakeTimers();
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        expect(screen.getByRole('button', { name: /자동 넘김/ })).toHaveAttribute('aria-pressed', 'true');
        act(() => vi.advanceTimersByTime(8000));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('동네 카페');
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

    it('샘플 3종 다음에 스튜디오 3곳을 두 묶음으로 구성하고 기존 그림 경로를 보존한다', () => {
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        const slides = [...container.querySelectorAll('.hj-slide')];
        expect(slides.map(item => item.getAttribute('data-group'))).toEqual([
            'samples', 'samples', 'samples', 'studio', 'studio', 'studio',
        ]);
        expect(slides.map(item => item.querySelector('img')?.getAttribute('src'))).toEqual([
            '/hajin/showroom/cafe.webp', '/hajin/showroom/salon.webp', '/hajin/showroom/realty.webp',
            '/hajin/showroom/rentalfit-v2.webp', '/hajin/showroom/ainara-partner.webp', '/hajin/showroom/new-ainara.webp',
        ]);
        expect(container.querySelector('.hj-slide.active')).toBe(slides[0]);
    });

    it('모든 장면에서 정확한 묶음 이름표를 폰 바깥 HTML 제목으로 표시하고 순환한다', () => {
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        const names = ['동네 카페', '미용실', '공인중개사무소', '렌탈핏', 'AI Companion Partner', 'AINARA'];
        for (const [index, name] of names.entries()) {
            const label = screen.getByRole('heading', {
                name: index < 3 ? '신청하면 받는 예시' : '하진 스튜디오 작업 · 맞춤 제작',
            });
            expect(container.querySelector('.hj-phone')).not.toContainElement(label);
            expect(container.querySelector('.hj-slide.active')).toHaveTextContent(name);
            expect(container.querySelectorAll('.hj-slide[aria-hidden="false"]')).toHaveLength(1);
            fireEvent.click(screen.getByRole('button', { name: '다음 예시' }));
        }
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent(names[0]);
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent(names[5]);
    });

    it('스튜디오 장면에는 가격을 넣지 않고 샘플 카드와 기존 3,000P 및 채팅 CTA를 유지한다', () => {
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        for (const studio of container.querySelectorAll('[data-group="studio"]')) {
            expect(studio).not.toHaveTextContent(/3,000|3000|가격|원|\d+P/);
            expect(studio.querySelector('.hj-example')).toBeNull();
        }
        fireEvent.click(screen.getByRole('button', { name: '렌탈핏 예시' }));
        expect(container.querySelector('.hj-showroom')).not.toHaveTextContent(/3,000|3000|가격|\d+P/);
        expect(screen.getByRole('button', { name: /샘플 둘러보기/ })).toBeInTheDocument();
        expect(container.querySelector('[data-menu-key="create"]')).toHaveTextContent('3,000P');
        expect(screen.getAllByText('3,000P')).toHaveLength(1);
        expect(container.querySelectorAll('[data-menu-key]')).toHaveLength(4);
        expect(screen.getByRole('button', { name: '하진에게 물어보기' })).toBeInTheDocument();
    });

    it('승인 v1처럼 진입 즉시 쇼룸·질문·메뉴를 공개하고 수동 선택 뒤 자동 넘김을 멈춘다', () => {
        vi.useFakeTimers();
        const { container } = render(<HajinShowroomEntry {...makeProps()} />);
        expect(screen.getByText('무엇을 도와드릴까요?')).toBeVisible();
        expect(screen.getByRole('heading', { name: '신청하면 받는 예시' })).toBeVisible();
        expect(container.querySelector('form')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'AINARA 예시' }));
        act(() => vi.advanceTimersByTime(12000));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('AINARA');
        expect(screen.getByRole('button', { name: /자동 넘김/ })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: /자동 넘김/ }));
        act(() => vi.advanceTimersByTime(4000));
        expect(container.querySelector('.hj-slide.active')).toHaveTextContent('동네 카페');
    });

});
