import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    });

describe('SeolaGolfEntry', () => {

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

    it('처음부터 무음 인라인 인트로와 두 화면 소스를 제공한다', () => {
        renderEntry();
        const video = document.querySelector<HTMLVideoElement>('.sg-intro-video')!;
        expect(video.autoplay).toBe(true); expect(video.muted).toBe(true);
        expect(video.hasAttribute('playsinline')).toBe(true);
        expect(video.preload).toBe('auto');
        expect(document.querySelector('source[src="/seola/intro-mobile-v9.mp4"]')).toBeTruthy();
        expect(document.querySelector('source[src="/seola/intro-desktop-v9.mp4"]')).toBeTruthy();
        expect(document.querySelector('.sg-game')).toBeNull();
        expect(screen.getByRole('button', { name: '설아와 대화하기' })).toBeTruthy();
    });
    it('건너뛰기와 종료는 마지막 이미지로 바뀌고 다시 보기로 재생한다', () => {
        renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
        expect(document.querySelector('.sg-intro-video')).toBeNull();
        expect(document.querySelector('img[src="/seola/intro-end-desktop-v9.webp"]')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '다시 보기' }));
        fireEvent.ended(document.querySelector('.sg-intro-video')!);
        expect(screen.getByRole('img', { name: '퍼팅을 마치고 미소 짓는 설아' })).toBeTruthy();
    });
    it('reduced-motion이면 영상 없이 끝 정지만 표시한다', () => {
        vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('reduced-motion'), addEventListener: vi.fn(), removeEventListener: vi.fn() })));
        renderEntry();
        expect(document.querySelector('video')).toBeNull();
        expect(document.querySelector('img[src="/seola/intro-end-desktop-v9.webp"]')).toBeTruthy();
    });
    it('자동재생 거부 시 포스터와 기능 버튼을 유지한다', async () => {
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
        const props = renderEntry();
        await waitFor(() => expect(document.querySelector('video')).toBeNull());
        expect(document.querySelector('img[src="/seola/intro-poster-desktop-v9.webp"]')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: '내 스윙 점검하기' }));
        expect(props.onFeature).toHaveBeenCalledWith('swing');
    });

    it('소스 선택 중 취소는 포스터 실패로 오인하지 않는다', async () => {
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new DOMException('selection changed', 'AbortError'));
        await act(async () => { renderEntry(); });
        expect(document.querySelector('video')).toBeTruthy();
    });
    it('자식 소스 오류는 허용하고 실제 영상 오류만 포스터로 대체한다', () => {
        renderEntry();
        const video = document.querySelector<HTMLVideoElement>('video')!;
        fireEvent.error(video.querySelector('source')!);
        expect(document.querySelector('video')).toBeTruthy();
        Object.defineProperty(video, 'error', { value: { code: 4 }, configurable: true });
        fireEvent.error(video);
        expect(document.querySelector('video')).toBeNull();
        expect(document.querySelector('img[src="/seola/intro-poster-desktop-v9.webp"]')).toBeTruthy();
    });

});

describe('PersonaEntrySheet 설아 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };

    it('설아면 새벽 티하우스 진입화면이 뜬다', async () => {
        await act(async () => { render(<PersonaEntrySheet guide={{ title: '설아', desc: '' }} {...base} />); });
        expect(screen.getByRole('heading', { name: /감이 아니라/ })).toBeTruthy();
    });

    it('한 글자 차이인 서아 화면을 뺏지 않는다', async () => {
        await act(async () => { render(<PersonaEntrySheet guide={{ title: '서아', desc: '' }} {...base} />); });
        expect(screen.queryByRole('heading', { name: /감이 아니라/ })).toBeNull();
    });
});
