import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { SeolaGolfEntry } from './SeolaGolfEntry';

const noop = () => {};

const renderEntry = () => {
    const props = {
        guide: { title: '설아', desc: 'AI 골프 코치', personaName: '설아' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
    };
    render(<SeolaGolfEntry {...props} />);
    return props;
};

describe('SeolaGolfEntry', () => {
    beforeEach(() => vi.clearAllMocks());

    it('스윙·골프장·대화 CTA를 기존 계약으로 연결한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '내 스윙 점검하기' }));
        expect(props.onFeature).toHaveBeenCalledWith('swing');
        fireEvent.click(screen.getByRole('button', { name: '오늘의 코스 찾기' }));
        expect(props.onFeature).toHaveBeenCalledWith('golf-course');
        fireEvent.click(screen.getByRole('button', { name: '설아와 대화하기' }));
        expect(props.onStart).toHaveBeenCalledWith();
    });

    it('예시 클럽을 바꾸면 코칭 노트가 갱신된다', () => {
        renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '아이언' }));
        expect(screen.getByText('아이언의 낮은 지점을 앞으로')).toBeTruthy();
        expect(screen.getByRole('button', { name: '아이언' }).getAttribute('aria-pressed')).toBe('true');
    });

    it('닫기 버튼과 Escape가 각각 onClose를 호출한다', () => {
        const props = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('첫 퍼팅 자세 뒤 게임 모달이 뜨고 홀인 후 성공 장면이 남는다', () => {
        vi.useFakeTimers();
        renderEntry();
        expect(screen.queryByRole('dialog', { name: '설아의 퍼팅 게임' })).toBeNull();
        expect(screen.getByRole('img', { name: '정석 어드레스로 퍼팅을 준비하는 설아' })).toBeTruthy();
        act(() => vi.advanceTimersByTime(900));
        expect(screen.getByRole('dialog', { name: '설아의 퍼팅 게임' })).toBeTruthy();
        // 스트로크 4프레임은 전부 같은 어드레스 판에서 나온 합성본이다.
        for (const phase of ['back', 'thru', 'follow']) {
            expect(document.querySelector(`source[srcSet="/seola/putt-${phase}-mobile-v6.webp"]`)).toBeTruthy();
            expect(document.querySelector(`img[src="/seola/putt-${phase}-desktop-v6.webp"]`)).toBeTruthy();
        }
        expect(document.querySelectorAll('.sg-game-stage .sg-stroke').length).toBe(3);
        act(() => vi.advanceTimersByTime(5200));
        expect(screen.queryByRole('dialog', { name: '설아의 퍼팅 게임' })).toBeNull();
        expect(screen.queryByRole('img', { name: '정석 어드레스로 퍼팅을 준비하는 설아' })).toBeNull();
        expect(screen.getByRole('img', { name: '퍼팅에 성공해 기뻐하는 설아' })).toBeTruthy();
        expect(document.querySelector('source[srcSet="/seola/celebrate-mobile-v3.png"]')).toBeTruthy();
        vi.useRealTimers();
    });

    it('첫 화면에 데스크톱과 모바일 전용 퍼팅 이미지를 제공한다', () => {
        renderEntry();
        expect(document.querySelector('source[srcSet="/seola/putt-address-mobile-v6.webp"]')).toBeTruthy();
        expect(document.querySelector('img[src="/seola/putt-address-desktop-v6.webp"]')).toBeTruthy();
    });
});

describe('PersonaEntrySheet 설아 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };

    it('설아면 새벽 티하우스 진입화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '설아', desc: '' }} {...base} />);
        expect(screen.getByRole('heading', { name: /감이 아니라/ })).toBeTruthy();
    });

    it('한 글자 차이인 서아 화면을 뺏지 않는다', () => {
        render(<PersonaEntrySheet guide={{ title: '서아', desc: '' }} {...base} />);
        expect(screen.queryByRole('heading', { name: /감이 아니라/ })).toBeNull();
    });
});
