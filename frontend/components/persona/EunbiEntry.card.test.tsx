import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryGiftContext } from '../PersonaEntrySheet';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { EunbiEntry } from './EunbiEntry';

// 축하 카드(보내는 사람 화면). 서비스는 실제 코드(eunbiCardService)를 그대로 쓰고 fetch 만 가짜로 둔다
// — 402 판별(status)·오류 문구 전달까지 함께 검증하기 위해서다.

const json = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const QUOTA = { freeLeft: 1, price: 100, todayCount: 0, dailyCap: 20 };
const CREATED = {
    id: 'Abc123Def456', url: 'https://aichat.dbzone.kr/c/Abc123Def456', message: '민지야, 생일 축하해! 🎂\n늘 행복하길 ♥',
    occasion: 'birthday', toName: '민지', fromName: '준호', isFree: true, pointsCharged: 0, freeLeft: 0,
};

let fetchMock: ReturnType<typeof vi.fn>;
const navKeys: string[] = [];
/** navigator.share·clipboard 를 테스트 동안만 붙인다. */
const setNav = (key: 'share' | 'clipboard', value: unknown) => {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
    navKeys.push(key);
};
/** POST 응답을 정한다(quota 는 항상 QUOTA). */
const routes = (post: () => Promise<Response>) => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).endsWith('/quota')) return json(200, QUOTA);
        if (init?.method === 'POST') return post();
        return json(404, { error: 'nope' });
    });
};
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

const makeGift = (over: Partial<EntryGiftContext> = {}): EntryGiftContext => ({
    personaId: 'p-eunbi', xp: 0, points: 1240, nickname: '준호', onGifted: vi.fn(), onNeedCharge: vi.fn(), ...over,
});
const renderCard = (gift?: EntryGiftContext, onGuestGate?: ReturnType<typeof vi.fn>) =>
    render(<EunbiEntry guide={{ title: '신은비', desc: '' }} onClose={vi.fn()} onStart={vi.fn()} onFeature={vi.fn()} onInvite={vi.fn()}
                       gift={gift} onGuestGate={onGuestGate} />);

const makeBtn = () => screen.getByRole('button', { name: /^은비가 카드 쓰기|카드를 쓰는 중/ });
const typeIn = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('EunbiEntry 축하 카드', () => {
    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        routes(() => json(201, CREATED));
    });
    afterEach(() => {
        navKeys.splice(0).forEach(k => { delete (navigator as unknown as Record<string, unknown>)[k]; });
        vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    });

    it('축하 카드 버튼은 카드 섹션으로 스크롤하고, 오늘 무료 표시가 뜬다', async () => {
        const scroll = vi.fn();
        (Element.prototype as unknown as { scrollIntoView: unknown }).scrollIntoView = scroll;
        renderCard(makeGift());
        await act(async () => {});
        fireEvent.click(screen.getByRole('button', { name: '축하 카드 보내기' }));
        expect(scroll).toHaveBeenCalledTimes(1);
        expect((scroll.mock.contexts[0] as HTMLElement).getAttribute('aria-labelledby')).toBe('eb-h-card');
        expect(screen.getByTestId('eb-card-quota').textContent).toBe('오늘 무료 카드 1장 남았어요이후 1장 100P');
        expect(makeBtn().textContent).toBe('은비가 카드 쓰기 · 무료');
        expect(fetchMock).toHaveBeenCalledWith('/api/eunbi-card/quota', expect.anything());
        delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
    });

    it('보내는 이름 기본값은 닉네임, 글자 수를 표시한다', async () => {
        renderCard(makeGift());
        await act(async () => {});
        expect((screen.getByLabelText(/^보내는 사람 이름/) as HTMLInputElement).value).toBe('준호');
        expect(screen.getByTestId('eb-cnt-from').textContent).toBe('2 / 10자');
        typeIn(/^받는 사람 이름/, '민지');
        expect(screen.getByTestId('eb-cnt-to').textContent).toBe('2 / 10자');
        typeIn(/한 줄 사연/, '3년 준비한 시험 합격');
        expect(screen.getByTestId('eb-cnt-story').textContent).toBe('12 / 60자');
        expect((screen.getByLabelText(/^받는 사람 이름/) as HTMLInputElement).maxLength).toBe(10);
        expect((screen.getByLabelText(/한 줄 사연/) as HTMLTextAreaElement).maxLength).toBe(60);
    });

    it('금지어·전화번호가 있으면 경고하고 버튼이 비활성, API 를 부르지 않는다', async () => {
        renderCard(makeGift());
        await act(async () => {});
        typeIn(/^받는 사람 이름/, '민지');
        for (const bad of ['www.spam.com 들어와', '010-1234-5678', '대출 문의', '시발']) {
            typeIn(/한 줄 사연/, bad);
            expect(screen.getByRole('alert').textContent).toContain('카드에 넣을 수 없는 내용');
            expect(makeBtn().hasAttribute('disabled')).toBe(true);
            fireEvent.click(makeBtn());
        }
        // 날짜는 전화번호가 아니다(서버와 같은 예외)
        typeIn(/한 줄 사연/, '2026.03.01에 합격했어');
        expect(screen.queryByRole('alert')).toBeNull();
        expect(makeBtn().hasAttribute('disabled')).toBe(false);
        expect(posts()).toHaveLength(0);
    });

    it('성공하면 결과 영역·공유 버튼이 뜨고 무료 표시가 갱신된다', async () => {
        renderCard(makeGift());
        await act(async () => {});
        fireEvent.click(screen.getByRole('button', { name: '🎓 합격·시험' }));
        typeIn(/^받는 사람 이름/, '  민지 ');
        typeIn(/한 줄 사연/, '시험 붙었어');
        await act(async () => { fireEvent.click(makeBtn()); });
        const [url, init] = posts()[0] as [string, RequestInit];
        expect(url).toBe('/api/eunbi-card');
        expect(JSON.parse(String(init.body))).toEqual({ occasion: 'pass', toName: '민지', fromName: '준호', story: '시험 붙었어' });
        const result = screen.getByTestId('eb-card-result');
        expect(result.textContent).toContain('민지야, 생일 축하해!');
        expect(screen.getByRole('button', { name: '카톡으로 보내기' })).toBeTruthy();
        expect(screen.getByRole('button', { name: '링크 복사' })).toBeTruthy();
        const a = screen.getByRole('link', { name: '카드 미리 보기' });
        expect(a.getAttribute('href')).toBe(CREATED.url);
        expect(a.getAttribute('target')).toBe('_blank');
        expect(a.getAttribute('rel')).toBe('noopener');
        expect((screen.getByLabelText('카드 링크') as HTMLInputElement).value).toBe(CREATED.url);
        expect(screen.getByTestId('eb-card-quota').textContent).toBe('오늘 무료 카드를 다 썼어요추가 1장 100P');
        expect(makeBtn().textContent).toBe('은비가 카드 쓰기 · 100P');
    });

    it('카톡으로 보내기는 navigator.share 를 부르고, 사용자가 닫으면(AbortError) 조용히 넘어간다', async () => {
        const share = vi.fn().mockRejectedValue(Object.assign(new Error('closed'), { name: 'AbortError' }));
        const writeText = vi.fn().mockResolvedValue(undefined);
        setNav('share', share);
        setNav('clipboard', { writeText });
        renderCard(makeGift());
        typeIn(/^받는 사람 이름/, '민지');
        await act(async () => { fireEvent.click(makeBtn()); });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '카톡으로 보내기' })); });
        expect(share).toHaveBeenCalledWith({
            title: '💌 민지에게 은비가 카드를 전해요',
            text: `💌 민지에게 은비가 카드를 전해요\n${CREATED.url}`,
            url: CREATED.url,
        });
        expect(writeText).not.toHaveBeenCalled();
        expect(screen.getByRole('status').textContent).toBe('');
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '링크 복사' })); });
        expect(writeText).toHaveBeenCalledWith(CREATED.url);
        expect(screen.getByRole('status').textContent).toBe('카드 링크를 복사했어요');
    });

    it('링크 복사가 실패하면 링크 칸을 선택해 둔다', async () => {
        setNav('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
        renderCard(makeGift());
        typeIn(/^받는 사람 이름/, '민지');
        await act(async () => { fireEvent.click(makeBtn()); });
        const input = screen.getByLabelText('카드 링크') as HTMLInputElement;
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: '링크 복사' })); });
        expect(document.activeElement).toBe(input);
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(CREATED.url.length);
    });

    it('402 면 onNeedCharge, 결과 영역 없음', async () => {
        routes(() => json(402, { error: '포인트가 부족합니다.', required: 100, balance: 20, shortfall: 80, feature: 'eunbi-card' }));
        const gift = makeGift();
        renderCard(gift);
        typeIn(/^받는 사람 이름/, '민지');
        await act(async () => { fireEvent.click(makeBtn()); });
        expect(gift.onNeedCharge).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId('eb-card-result')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('422·429 는 서버 문구를 화면에 보여 주고 다시 누를 수 있다', async () => {
        const gift = makeGift();
        routes(() => json(422, { error: '카드에 넣을 수 없는 내용이 있어요. 광고성 문구는 카드에 넣을 수 없어요.', reason: 'blocked', field: 'story' }));
        const view = renderCard(gift);
        typeIn(/^받는 사람 이름/, '민지');
        await act(async () => { fireEvent.click(makeBtn()); });
        expect(screen.getByRole('alert').textContent).toBe('카드에 넣을 수 없는 내용이 있어요. 광고성 문구는 카드에 넣을 수 없어요.');
        expect(makeBtn().hasAttribute('disabled')).toBe(false);
        routes(() => json(429, { error: '오늘은 카드를 충분히 보냈어요. 내일 다시 보내 주세요.' }));
        await act(async () => { fireEvent.click(makeBtn()); });
        expect(screen.getByRole('alert').textContent).toBe('오늘은 카드를 충분히 보냈어요. 내일 다시 보내 주세요.');
        routes(() => json(500, { error: 'PrismaClientKnownRequestError: 내부 오류' }));
        await act(async () => { fireEvent.click(makeBtn()); });
        expect(screen.getByRole('alert').textContent).toBe('카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
        expect(gift.onNeedCharge).not.toHaveBeenCalled();
        view.unmount();
    });

    it('연타해도 생성 API 는 한 번만 부른다', async () => {
        let resolve!: (r: Response) => void;
        routes(() => new Promise<Response>(r => { resolve = r; }));
        renderCard(makeGift());
        typeIn(/^받는 사람 이름/, '민지');
        const btn = makeBtn();
        fireEvent.click(btn);
        fireEvent.click(btn);
        fireEvent.click(btn);
        expect(posts()).toHaveLength(1);
        expect(makeBtn().textContent).toBe('은비가 카드를 쓰는 중…');
        await act(async () => { resolve(await json(201, CREATED)); });
        expect(screen.getByTestId('eb-card-result')).toBeTruthy();
        expect(posts()).toHaveLength(1);
    });

    it('비로그인: 카드 버튼·만들기 버튼 모두 guestGate(free, eunbi-card), fetch 0', async () => {
        const gate = vi.fn();
        renderCard(undefined, gate);
        await act(async () => {});
        fireEvent.click(screen.getByRole('button', { name: '축하 카드 보내기' }));
        typeIn(/^받는 사람 이름/, '민지');
        typeIn(/^보내는 사람 이름/, '준호');
        fireEvent.click(makeBtn());
        expect(gate.mock.calls).toEqual([['free', 'eunbi-card'], ['free', 'eunbi-card']]);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('PersonaEntrySheet 비로그인 경로도 카드 버튼이 gate 로 간다', () => {
        const gate = vi.fn();
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '' }} onClose={vi.fn()} onStart={vi.fn()} onFeature={vi.fn()} onInvite={vi.fn()}
                                  isGuest onGuestGate={gate} />);
        fireEvent.click(screen.getByRole('button', { name: '축하 카드 보내기' }));
        expect(gate).toHaveBeenCalledWith('free', 'eunbi-card');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
