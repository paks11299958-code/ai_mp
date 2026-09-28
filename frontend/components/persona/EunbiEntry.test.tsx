import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import type { EntryGiftContext } from '../PersonaEntrySheet';
import { EunbiEntry } from './EunbiEntry';

const { sendStar } = vi.hoisted(() => ({ sendStar: vi.fn() }));
vi.mock('../../services/pointService', () => ({ pointApi: { sendStar } }));

const noop = () => {};

const renderEntry = () => {
    const props = {
        guide: { title: '신은비', desc: '웹툰 은비', personaName: '신은비' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(),
    };
    const view = render(<EunbiEntry {...props} />);
    return { props, view };
};

describe('EunbiEntry', () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.useRealTimers());

    it('AI 채팅과 이야기 시작하기(인라인·하단 고정)는 onStart를 인자 없이 부른다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: 'AI 채팅' }));
        const ctas = screen.getAllByRole('button', { name: '은비와 이야기 시작하기 ♥', hidden: true });
        expect(ctas).toHaveLength(2);
        ctas.forEach(b => fireEvent.click(b));
        expect(props.onStart).toHaveBeenCalledTimes(3);
        props.onStart.mock.calls.forEach(call => expect(call).toEqual([]));
        expect(props.onFeature).not.toHaveBeenCalled();
    });

    it('헤어 체인지는 hair, 프로필 화보는 outfit 보드를 연다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '헤어 체인지' }));
        fireEvent.click(screen.getByRole('button', { name: '프로필 화보' }));
        expect(props.onFeature.mock.calls).toEqual([['hair'], ['outfit']]);
        expect(props.onStart).not.toHaveBeenCalled();
        expect(screen.getByText('내 사진으로 새 헤어 미리보기')).toBeTruthy();
        expect(screen.getByText('내 얼굴로 실사·지브리 프사')).toBeTruthy();
    });

    it('준비 중 기능과 웹툰은 콜백 없이 토스트만 띄운다', () => {
        const { props } = renderEntry();
        const status = screen.getByRole('status');
        for (const name of [/^스토리 모드/, /^말투 변형/, /^이모티콘/]) {
            fireEvent.click(screen.getByRole('button', { name }));
            expect(status.textContent).toBe('곧 만나요! 준비 중이에요');
        }
        for (const name of [/^웹툰 보기/, /^웹툰 《은비》/, /^은비 웹툰/]) {
            fireEvent.click(screen.getByRole('button', { name }));
            expect(status.textContent).toContain('은비 웹툰 곧 연재');
        }
        expect(props.onStart).not.toHaveBeenCalled();
        expect(props.onFeature).not.toHaveBeenCalled();
    });

    it('닫기 버튼과 Escape가 각각 onClose를 호출한다', () => {
        const { props } = renderEntry();
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).toHaveBeenCalledTimes(2);
    });

    it('모든 버튼은 type=button이고 로그인·회원가입이 없다', () => {
        renderEntry();
        screen.getAllByRole('button', { hidden: true }).forEach(b => expect(b.getAttribute('type')).toBe('button'));
        expect(screen.queryByRole('button', { name: /로그인|회원가입/ })).toBeNull();
    });

    it('언마운트하면 Escape 리스너·말풍선 타이머가 해제된다', () => {
        vi.useFakeTimers();
        const { props, view } = renderEntry();
        view.unmount();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(props.onClose).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('말풍선 대사가 순환한다', () => {
        vi.useFakeTimers();
        renderEntry();
        expect(screen.getByText('안녕~ 난 은비야!')).toBeTruthy();
        act(() => { vi.advanceTimersByTime(2800 + 300); });
        expect(screen.getByText('오늘 하루 어땠어?')).toBeTruthy();
    });

    it('폰트 link는 여러 번 열어도 한 번만 삽입된다', () => {
        renderEntry().view.unmount();
        renderEntry();
        expect(document.querySelectorAll('link#eb-fonts')).toHaveLength(1);
    });
});

describe('PersonaEntrySheet 신은비 분기', () => {
    const base = { onClose: noop, onStart: noop, onFeature: noop, onInvite: noop };
    const isEunbi = () => !!screen.queryByRole('dialog', { name: '웹툰 은비 진입화면' });

    it('신은비면 웹툰 은비 진입화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '' }} {...base} />);
        expect(isEunbi()).toBe(true);
    });

    it('기능 링크(autoRunFeatureKey)로 오면 기본 시트를 유지한다', () => {
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '', autoRunFeatureKey: 'luxury' }} {...base} />);
        expect(isEunbi()).toBe(false);
        expect(screen.getByRole('dialog', { name: '신은비 소개' })).toBeTruthy();
        expect(screen.getByRole('button', { name: /시작하기/ })).toBeTruthy();
    });

    it('다른 페르소나는 은비 화면이 아니다', () => {
        render(<PersonaEntrySheet guide={{ title: '박하진', desc: '' }} {...base} />);
        expect(isEunbi()).toBe(false);
    });
});

describe('EunbiEntry 선물하기', () => {
    const makeGift = (over: Partial<EntryGiftContext> = {}): EntryGiftContext => ({
        personaId: 'p-eunbi', xp: 42, points: 1240, nickname: '민지',
        onGifted: vi.fn(), onNeedCharge: vi.fn(), ...over,
    });
    const renderGift = (gift?: EntryGiftContext, onGuestGate?: ReturnType<typeof vi.fn>) => {
        const props = {
            guide: { title: '신은비', desc: '', personaName: '신은비' },
            onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), onInvite: vi.fn(), gift, onGuestGate,
        };
        return { props, view: render(<EunbiEntry {...props} />) };
    };
    const wallet = () => screen.getByTestId('eb-wallet').textContent;
    const sendBtn = () => screen.getByRole('button', { name: /P로 .+ 선물하기$|충전하기$|받는 중/ });
    const ok = (xp: number, newBalance: number, extra = {}) =>
        ({ balloon: {}, newBalance, xp, leveledUp: false, newStage: 1, levelupBonus: 0, ...extra });

    beforeEach(() => {
        sendStar.mockReset();
        vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
        vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it('카드마다 정확한 amount(1/5/10/30/100)로 보내고, 연타해도 한 번만 호출한다', async () => {
        const cases: [RegExp, number][] = [[/^커피/, 1], [/^조각 케이크/, 5], [/^꽃다발/, 10], [/^곰인형/, 30], [/^특별한 선물/, 100]];
        for (const [name, amount] of cases) {
            sendStar.mockReset();
            let resolve!: (v: unknown) => void;
            sendStar.mockImplementation(() => new Promise(r => { resolve = r; }));
            const { view } = renderGift(makeGift({ points: 5000 }));
            fireEvent.click(screen.getByRole('button', { name }));
            const btn = sendBtn();
            fireEvent.click(btn);
            fireEvent.click(btn);
            expect(sendStar).toHaveBeenCalledTimes(1);
            expect(sendStar).toHaveBeenCalledWith('p-eunbi', amount);
            await act(async () => { resolve(ok(42 + amount * 2, 5000 - amount * 10)); });
            // 반응 영상 재생 중에도 잠겨 있다
            fireEvent.click(sendBtn());
            expect(sendStar).toHaveBeenCalledTimes(1);
            view.unmount();
        }
    }, 30000);

    it('성공하면 onGifted 를 응답값으로 부르고 화면 포인트·호감도를 응답 기준으로 갱신한다', async () => {
        vi.useFakeTimers();
        const gift = makeGift();
        sendStar.mockResolvedValue(ok(62, 1140));
        renderGift(gift);
        fireEvent.click(screen.getByRole('button', { name: /^꽃다발/ }));
        expect(sendBtn().textContent).toBe('100P로 꽃다발 선물하기');
        await act(async () => { fireEvent.click(sendBtn()); });
        expect(gift.onGifted).toHaveBeenCalledWith({ xp: 62, personaId: 'p-eunbi', leveledUp: false, newStage: 1, levelupBonus: 0 });
        expect(wallet()).toBe('1,140P');
        expect(screen.getByTestId('eb-xp').textContent).toBe('62 / 150');
        // 반응 영상이 끝나면 다시 보낼 수 있다
        act(() => { fireEvent.ended(screen.getByTestId('eb-react')); });
        act(() => { vi.advanceTimersByTime(1500); });
        expect(sendBtn().hasAttribute('disabled')).toBe(false);
    });

    it('반응 영상이 곧바로 실패해도 최소 잠금 동안 두 번째 탭은 결제하지 않는다', async () => {
        vi.useFakeTimers();
        sendStar.mockResolvedValue(ok(44, 1230));
        renderGift(makeGift());
        await act(async () => { fireEvent.click(sendBtn()); });
        act(() => { fireEvent.error(screen.getByTestId('eb-react')); });
        fireEvent.click(sendBtn());
        expect(sendStar).toHaveBeenCalledTimes(1);
        act(() => { vi.advanceTimersByTime(1500); });
        expect(sendBtn().hasAttribute('disabled')).toBe(false);
        expect(screen.getByTestId('eb-react').getAttribute('src')).toBeNull();
    });

    it('레벨업이면 진입화면 안 토스트로 알린다', async () => {
        vi.useFakeTimers();
        sendStar.mockResolvedValue(ok(160, 1240 - 1000 + 500, { leveledUp: true, newStage: 2, levelupBonus: 500 }));
        renderGift(makeGift({ xp: 140 }));
        fireEvent.click(screen.getByRole('button', { name: /^특별한 선물/ }));
        await act(async () => { fireEvent.click(sendBtn()); });
        act(() => { vi.advanceTimersByTime(1300); });
        expect(screen.getByRole('status').textContent).toBe('Lv.3 단짝! 보너스 +500P · 손하트 배경화면 열림');
    });

    it('402 면 onNeedCharge, 포인트 표시는 그대로', async () => {
        const gift = makeGift();
        sendStar.mockRejectedValue(new Error('INSUFFICIENT_POINTS'));
        renderGift(gift);
        await act(async () => { fireEvent.click(sendBtn()); });
        expect(gift.onNeedCharge).toHaveBeenCalledTimes(1);
        expect(wallet()).toBe('1,240P');
        expect(screen.getByTestId('eb-xp').textContent).toBe('42 / 150');
    });

    it('그 밖의 오류는 토스트, 포인트 불변, 다시 보낼 수 있다', async () => {
        const gift = makeGift();
        sendStar.mockRejectedValue(new Error('서버 오류 (500)'));
        renderGift(gift);
        await act(async () => { fireEvent.click(sendBtn()); });
        expect(screen.getByRole('status').textContent).toBe('선물을 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
        expect(gift.onNeedCharge).not.toHaveBeenCalled();
        expect(gift.onGifted).not.toHaveBeenCalled();
        expect(wallet()).toBe('1,240P');
        expect(sendBtn().hasAttribute('disabled')).toBe(false);
    });

    it('포인트가 부족하면 sendStar 없이 onNeedCharge', () => {
        const gift = makeGift({ points: 30 });
        renderGift(gift);
        fireEvent.click(screen.getByRole('button', { name: /^조각 케이크/ }));
        expect(sendBtn().textContent).toBe('포인트가 부족해요 · 충전하기');
        fireEvent.click(sendBtn());
        expect(sendStar).not.toHaveBeenCalled();
        expect(gift.onNeedCharge).toHaveBeenCalledTimes(1);
    });

    it('보상: xp=0 이면 배경화면 저장 없음, xp=150 이면 손하트 배경화면 링크', () => {
        const { view } = renderGift(makeGift({ xp: 0 }));
        expect(screen.queryByRole('link', { name: /배경화면 저장/ })).toBeNull();
        expect(screen.getByTestId('eb-rw-3').textContent).toContain('잠김 · 호감도 150');
        view.unmount();
        renderGift(makeGift({ xp: 150 }));
        const a = screen.getByRole('link', { name: '손하트 배경화면 저장' });
        expect(a.getAttribute('href')).toBe('/eunbi/eunbi_wallpaper_heart.jpg');
        expect(a.hasAttribute('download')).toBe(true);
        expect(screen.queryByRole('link', { name: '볼하트 배경화면 저장' })).toBeNull();
        expect(screen.queryByRole('button', { name: /다시 보기/ })).toBeNull();
    });

    it('Lv.5 다시 보기는 sendStar 없이 반응 영상을 튼다', () => {
        renderGift(makeGift({ xp: 1200 }));
        const replays = screen.getAllByRole('button', { name: /영상 다시 보기$/ });
        expect(replays).toHaveLength(4);
        fireEvent.click(replays[3]);
        expect(screen.getByTestId('eb-react').getAttribute('src')).toBe('/eunbi/eunbi_gift_dance.mp4');
        expect(sendStar).not.toHaveBeenCalled();
    });

    it('Lv.2 이상이면 첫 말풍선이 닉네임 인사', () => {
        renderGift(makeGift({ xp: 30 }));
        expect(screen.getByText('민지! 또 와 줬네 ♥')).toBeTruthy();
    });

    it('gift 없음(비로그인): 선물 버튼은 게스트 게이트(paid, gift), 선물 섹션 없음', () => {
        const gate = vi.fn();
        renderGift(undefined, gate);
        expect(screen.queryByRole('region', { name: '은비에게 선물하기' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '선물하기' }));
        expect(gate).toHaveBeenCalledWith('paid', 'gift');
        expect(sendStar).not.toHaveBeenCalled();
    });

    it('PersonaEntrySheet 비로그인 경로도 은비 선물 버튼이 gate 로 간다', () => {
        const gate = vi.fn();
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '' }} onClose={noop} onStart={noop} onFeature={noop} onInvite={noop}
                                  isGuest onGuestGate={gate} />);
        fireEvent.click(screen.getByRole('button', { name: '선물하기' }));
        expect(gate).toHaveBeenCalledWith('paid', 'gift');
    });

    it('PersonaEntrySheet 는 gift 를 은비 화면에 그대로 넘긴다', () => {
        render(<PersonaEntrySheet guide={{ title: '신은비', desc: '' }} onClose={noop} onStart={noop} onFeature={noop} onInvite={noop}
                                  gift={makeGift()} />);
        expect(screen.getByTestId('eb-wallet').textContent).toBe('1,240P');
    });
});
