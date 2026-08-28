import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeoaNewsDeskEntry } from './SeoaNewsDeskEntry';

class FakeAudio {
    static latest: FakeAudio | null = null;
    dataset: Record<string, string> = {};
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onloadedmetadata: (() => void) | null = null;
    ontimeupdate: (() => void) | null = null;
    src = '';
    duration = 120;
    currentTime = 0;
    pause = vi.fn();
    play = vi.fn().mockResolvedValue(undefined);

    constructor() { FakeAudio.latest = this; }
}

const jsonResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
    blob: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
});

describe('SeoaNewsDeskEntry 뉴스룸 재생', () => {
    beforeEach(() => {
        localStorage.setItem('token', 'test-token');
        FakeAudio.latest = null;
        vi.stubGlobal('Audio', FakeAudio);
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1; });
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url === '/api/news/categories') return Promise.resolve(jsonResponse({ categories: [{ key: '국내뉴스', label: '국내 뉴스' }] }));
            if (url === '/api/news/status') return Promise.resolve(jsonResponse({ available: true, slot: 'am', slots: ['am'] }));
            if (url === '/api/points/menu-prices') return Promise.resolve(jsonResponse({ prices: { news: 50 } }));
            if (url.startsWith('/api/news/tts?')) return Promise.resolve(jsonResponse(null));
            return Promise.reject(new Error(`unexpected fetch: ${url}`));
        }));
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
            configurable: true,
            value: vi.fn(),
        });
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-audio') });
        Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    });

    afterEach(() => {
        localStorage.clear();
        delete (HTMLElement.prototype as { scrollTo?: unknown }).scrollTo;
        delete (URL as { createObjectURL?: unknown }).createObjectURL;
        delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('최신 슬롯으로 재생하고 종료되면 누른 버튼으로 돌아간다', async () => {
        render(
            <SeoaNewsDeskEntry
                guide={{ title: '서아', desc: '뉴스 브리핑' }}
                onClose={vi.fn()}
                onInvite={vi.fn()}
                onFeature={vi.fn()}
            />,
        );

        const playButton = await screen.findByRole('button', { name: '국내 뉴스 들려주기' });
        fireEvent.click(playButton);

        await waitFor(() => expect(fetch).toHaveBeenCalledWith(
            '/api/news/tts?category=%EA%B5%AD%EB%82%B4%EB%89%B4%EC%8A%A4&slot=am',
            expect.any(Object),
        ));
        await screen.findByLabelText('서아 뉴스룸 재생 중');
        expect(FakeAudio.latest?.play).toHaveBeenCalledTimes(1);

        act(() => {
            if (!FakeAudio.latest) return;
            FakeAudio.latest.currentTime = 30;
            FakeAudio.latest.onloadedmetadata?.();
            FakeAudio.latest.ontimeupdate?.();
        });
        expect(screen.getByText('오전 브리핑')).toBeTruthy();
        expect(screen.getByText('0:30 · 남은 1:30')).toBeTruthy();
        expect(screen.getByRole('progressbar', { name: '뉴스 음성 재생 진행률' }).getAttribute('aria-valuenow')).toBe('25');

        act(() => { FakeAudio.latest?.onended?.(); });
        await waitFor(() => expect(screen.queryByLabelText('서아 뉴스룸 재생 중')).toBeNull());
        expect(screen.getAllByLabelText('서아 뉴스데스크').length).toBeGreaterThan(0);
        expect(document.activeElement).toBe(playButton);
        expect(document.body.textContent).toContain('글로 볼 때만 50P가 차감되고, ▶ 듣기는 무료예요.');
    });
});
