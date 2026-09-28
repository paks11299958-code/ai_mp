import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryGiftContext } from '../PersonaEntrySheet';
import { PersonaEntrySheet } from '../PersonaEntrySheet';
import { ChaerinClinicEntry, MIN_SCAN_MS } from './ChaerinClinicEntry';

// 윤채린 진입화면 v2 "뷰티 클리닉 & 스튜디오"(2026-09-28).
// ★지키는 계약:
//   1. 스튜디오 4종은 App.tsx 가 아는 기능키를 넘긴다(틀리면 눌러도 아무 일이 없다).
//   2. 견적 요청은 한 번만 나가고(연타 차단), 서버 오류 형식(402·422·503)대로 갈린다.
//   3. 비로그인은 서버를 부르지 않고 guestGate 로 간다.
//   4. 총액은 서버가 준 가격으로, 체크된 항목의 합이다.

const json = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const REPORT = {
    asOf: '2026-09',
    charm: '눈매가 또렷하고 인상이 부드러워요.',
    landmarks: { eyeL: [0.4, 0.4], eyeR: [0.6, 0.4], nose: [0.5, 0.5], mouth: [0.5, 0.6], chin: [0.5, 0.7] },
    parts: [
        { part: 'eye', name: '눈', feature: '홑꺼풀이고 눈매가 가로로 긴 편이에요.', items: [
            { id: 'eye-burial', name: '쌍꺼풀 매몰법', min: 50, max: 100, suggested: true },
            { id: 'eye-incision', name: '쌍꺼풀 절개법', min: 100, max: 150, suggested: false },
        ] },
        { part: 'nose', name: '코', feature: '콧대가 낮은 편이에요.', items: [
            { id: 'nose-bridge', name: '콧대(보형물)', min: 94, max: 220, suggested: true },
            { id: 'nose-tip', name: '코끝(자가연골 포함)', min: 100, max: 300, suggested: false },
        ] },
    ],
    suggestedTotal: { min: 144, max: 320 },
    pointsCharged: 300,
    newBalance: 940,
};
const CATALOG = {
    asOf: '2026-09',
    parts: [{ part: 'eye', name: '눈', items: [{ id: 'eye-burial', name: '쌍꺼풀 매몰법', min: 50, max: 100, singleSource: true }] }],
    sources: ['isclinic 2026 가이드'],
};

let fetchMock: ReturnType<typeof vi.fn>;
let postImpl: () => Promise<Response>;
let prices: Record<string, number>;
const posts = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

const setReduced = (on: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
}));

const makeGift = (over: Partial<EntryGiftContext> = {}): EntryGiftContext => ({
    personaId: 'p-chaerin', xp: 0, points: 1240, onGifted: vi.fn(), onNeedCharge: vi.fn(), onPointsChanged: vi.fn(), ...over,
});

const renderEntry = (over: Partial<React.ComponentProps<typeof ChaerinClinicEntry>> = {}) => {
    const props = {
        guide: { title: '윤채린', desc: '', personaName: '윤채린' },
        onClose: vi.fn(), onStart: vi.fn(), onFeature: vi.fn(), gift: makeGift(), onGuestGate: undefined,
        ...over,
    };
    render(<ChaerinClinicEntry {...props as any} />);
    return props as any;
};

const btn = (name: RegExp | string) => screen.getByRole('button', { name });

/** 입구 → 성형 → 견적 → 동의 → 사진·부위 화면까지. */
const toPick = async () => {
    fireEvent.click(btn(/성형 — 병원으로 들어가기/));
    fireEvent.click(btn(/내 성형 견적 뽑아보기/));
    for (const c of screen.getAllByRole('checkbox')) fireEvent.click(c);
    fireEvent.click(btn('동의하고 시작하기'));
    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    await act(async () => { fireEvent.change(screen.getByLabelText('정면 사진 고르기'), { target: { files: [file] } }); });
    await screen.findByAltText('올린 사진 미리보기');
};
const analyzeBtn = () => btn(/^분석/);

describe('ChaerinClinicEntry', () => {
    beforeEach(() => {
        setReduced(true);
        prices = { 'beauty-estimate': 300 };
        postImpl = () => json(200, REPORT);
        fetchMock = vi.fn((url: string, init?: RequestInit) => {
            if (url === '/api/points/menu-prices') return json(200, { prices });
            if (url === '/api/beauty-estimate/catalog') return json(200, CATALOG);
            if (url === '/api/beauty-estimate' && init?.method === 'POST') return postImpl();
            return json(404, { error: 'nope' });
        });
        vi.stubGlobal('fetch', fetchMock);
        vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1600, height: 2000, close: vi.fn() })));
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJDRA==');
        (URL as any).createObjectURL = vi.fn(() => 'blob:preview');
        (URL as any).revokeObjectURL = vi.fn();
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

    it('문을 누르면 하위 메뉴로, 뒤로·Escape 는 한 단계 위, 입구에서만 닫는다', () => {
        const p = renderEntry();
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        expect(screen.getByRole('region', { name: '성형 메뉴' })).toBeTruthy();
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(p.onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('region', { name: '채린 뷰티 클리닉 입구' })).toBeTruthy();

        fireEvent.click(btn(/스튜디오 — 사진 변신 기능 보기/));
        expect(screen.getByRole('region', { name: '스튜디오 메뉴' })).toBeTruthy();
        fireEvent.click(btn('← 입구로'));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(p.onClose).toHaveBeenCalledTimes(1);

        fireEvent.click(btn('닫기'));
        expect(p.onClose).toHaveBeenCalledTimes(2);
    });

    it('스튜디오 4종이 App.tsx 와 같은 기능키를 넘긴다', () => {
        const p = renderEntry();
        fireEvent.click(btn(/스튜디오 — 사진 변신 기능 보기/));
        const cases: [RegExp, string][] = [[/헤어 체인지/, 'hair'], [/프로필 화보/, 'outfit'], [/시간여행/, 'agetransform'], [/닮은꼴 찾기/, 'lookalike']];
        for (const [label, key] of cases) {
            p.onFeature.mockClear();
            fireEvent.click(btn(label));
            expect(p.onFeature, `${label} → ${key}`).toHaveBeenCalledWith(key);
        }
        expect(btn(/헤어 체인지/).textContent).toContain('200P');
        expect(btn(/시간여행/).textContent).toContain('100P');
        expect(btn(/닮은꼴 찾기/).textContent).toContain('무료');
    });

    it('채린에게 물어보기 → onStart(채팅)', () => {
        const p = renderEntry();
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        fireEvent.click(btn(/채린에게 물어보기/));
        expect(p.onStart).toHaveBeenCalledWith();
        expect(p.onFeature).not.toHaveBeenCalled();
    });

    it('견적 버튼에 menu-prices 단가를 표시한다', async () => {
        renderEntry();
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        await waitFor(() => expect(btn(/내 성형 견적 뽑아보기/).textContent).toContain('300P'));
    });

    it('단가 행이 없으면 "준비 중" 배지 + 안내만, 동의 화면으로 가지 않는다', async () => {
        prices = {};
        renderEntry();
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        await waitFor(() => expect(btn(/내 성형 견적 뽑아보기/).textContent).toContain('준비 중'));
        fireEvent.click(btn(/내 성형 견적 뽑아보기/));
        expect(screen.getByText(/준비 중인 기능이에요/)).toBeTruthy();
        expect(screen.queryByText('시작 전에 확인해 주세요')).toBeNull();
    });

    it('동의 3개 전엔 시작 비활성, 부위 0개면 분석 비활성', async () => {
        renderEntry();
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        fireEvent.click(btn(/내 성형 견적 뽑아보기/));
        const boxes = screen.getAllByRole('checkbox');
        expect(boxes).toHaveLength(3);
        const start = btn('동의하고 시작하기') as HTMLButtonElement;
        fireEvent.click(boxes[0]); fireEvent.click(boxes[1]);
        expect(start.disabled).toBe(true);
        fireEvent.click(boxes[2]);
        expect(start.disabled).toBe(false);
        fireEvent.click(start);

        // 사진 전·부위 0개 → 비활성
        expect((analyzeBtn() as HTMLButtonElement).disabled).toBe(true);
        const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
        await act(async () => { fireEvent.change(screen.getByLabelText('정면 사진 고르기'), { target: { files: [file] } }); });
        await screen.findByAltText('올린 사진 미리보기');
        expect((analyzeBtn() as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(btn('눈'));
        expect((analyzeBtn() as HTMLButtonElement).disabled).toBe(false);
        fireEvent.click(btn('눈'));
        expect((analyzeBtn() as HTMLButtonElement).disabled).toBe(true);
        // 사진은 긴 변 1280 JPEG 0.85 로 줄였다
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    });

    it('분석: 연타해도 POST 1회, 본문 규약, 리포트 합계=suggested 합, 체크 변경 시 재계산, 잔액 갱신', async () => {
        let resolvePost!: (r: Response) => void;
        postImpl = () => new Promise<Response>(r => { resolvePost = r; });
        const p = renderEntry();
        await toPick();
        fireEvent.click(btn('눈'));
        fireEvent.click(btn('코'));
        const a = analyzeBtn();
        fireEvent.click(a); fireEvent.click(a);
        expect(posts()).toHaveLength(1);
        const body = JSON.parse(String((posts()[0][1] as RequestInit).body));
        expect(body).toEqual({ imageBase64: 'QUJDRA==', mimeType: 'image/jpeg', parts: ['eye', 'nose'], adultConfirmed: true });
        expect(screen.getByRole('region', { name: '얼굴 분석 중' })).toBeTruthy();

        await act(async () => { resolvePost(new Response(JSON.stringify(REPORT), { status: 200 })); });
        await screen.findByRole('region', { name: '견적 리포트' });
        expect(screen.getByTestId('cc-total').textContent).toBe('예상 총액 144만 ~ 320만 원');
        expect(screen.getByText(/눈매가 또렷하고/)).toBeTruthy();
        expect(p.gift.onPointsChanged).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('checkbox', { name: /쌍꺼풀 매몰법/ }));
        expect(screen.getByTestId('cc-total').textContent).toBe('예상 총액 94만 ~ 220만 원');
        fireEvent.click(screen.getByRole('checkbox', { name: /코끝/ }));
        expect(screen.getByTestId('cc-total').textContent).toBe('예상 총액 194만 ~ 520만 원');
        expect(posts()).toHaveLength(1);

        // 다시 해보기 → 사진 단계, 채린에게 물어보기 → onStart
        fireEvent.click(btn('채린에게 물어보기'));
        expect(p.onStart).toHaveBeenCalled();
        fireEvent.click(btn('다시 해보기'));
        expect(screen.getByRole('region', { name: '사진과 관심 부위' })).toBeTruthy();
    });

    it('스캔 화면은 응답이 빨라도 최소 4.5초 머문다(모션 켜짐)', async () => {
        setReduced(false);
        renderEntry();
        // 모션이 켜져 있으면 문 연출 뒤에 넘어간다
        vi.useFakeTimers({ shouldAdvanceTime: true });
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
        fireEvent.click(btn(/내 성형 견적 뽑아보기/));
        for (const c of screen.getAllByRole('checkbox')) fireEvent.click(c);
        fireEvent.click(btn('동의하고 시작하기'));
        const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
        await act(async () => { fireEvent.change(screen.getByLabelText('정면 사진 고르기'), { target: { files: [file] } }); });
        await screen.findByAltText('올린 사진 미리보기');
        fireEvent.click(btn('눈'));
        vi.useFakeTimers();
        fireEvent.click(analyzeBtn());
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        expect(screen.queryByRole('region', { name: '견적 리포트' })).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(MIN_SCAN_MS - 1000); });
        expect(screen.queryByRole('region', { name: '견적 리포트' })).toBeNull();
        await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
        expect(screen.getByRole('region', { name: '견적 리포트' })).toBeTruthy();
    });

    it('402 → onNeedCharge', async () => {
        postImpl = () => json(402, { error: '포인트가 부족합니다.' });
        const p = renderEntry();
        await toPick();
        fireEvent.click(btn('눈'));
        fireEvent.click(analyzeBtn());
        await waitFor(() => expect(p.gift.onNeedCharge).toHaveBeenCalledTimes(1));
        expect(p.gift.onPointsChanged).not.toHaveBeenCalled();
    });

    it('422 → 서버 message 를 보여주고 사진 단계로(차감 없음 안내)', async () => {
        postImpl = () => json(422, { error: 'UNCLEAR_IMAGE', message: '얼굴이 또렷하게 보이지 않아요. 밝은 곳에서 정면을 바라본 사진으로 다시 올려 주세요.', pointsCharged: 0 });
        renderEntry();
        await toPick();
        fireEvent.click(btn('눈'));
        fireEvent.click(analyzeBtn());
        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toContain('얼굴이 또렷하게 보이지 않아요');
        expect(alert.textContent).toContain('차감되지 않았어요');
        expect(screen.getByRole('region', { name: '사진과 관심 부위' })).toBeTruthy();
    });

    it('422 MINOR_SUSPECTED 도 서버 문구 그대로', async () => {
        postImpl = () => json(422, { error: 'MINOR_SUSPECTED', message: '이 기능은 성인만 이용할 수 있어요.', pointsCharged: 0 });
        renderEntry();
        await toPick();
        fireEvent.click(btn('입·입술'));
        fireEvent.click(analyzeBtn());
        expect((await screen.findByRole('alert')).textContent).toContain('성인만 이용할 수 있어요');
    });

    it('503 PRICE_NOT_SET → 준비 중 안내', async () => {
        postImpl = () => json(503, { error: 'PRICE_NOT_SET', message: '준비 중인 기능이에요.' });
        renderEntry();
        await toPick();
        fireEvent.click(btn('피부·탄력'));
        fireEvent.click(analyzeBtn());
        expect((await screen.findByRole('alert')).textContent).toContain('준비 중');
    });

    it('그 밖 오류(500)는 공통 문구', async () => {
        postImpl = () => json(500, { error: '견적 리포트를 만들지 못했어요.' });
        renderEntry();
        await toPick();
        fireEvent.click(btn('코'));
        fireEvent.click(analyzeBtn());
        expect((await screen.findByRole('alert')).textContent).toContain('잠시 후 다시 시도');
    });

    it('비로그인: 견적 → guestGate(paid, beauty-estimate), 서버 호출 0 · 가격표는 열람 가능', async () => {
        const gate = vi.fn();
        renderEntry({ gift: undefined, onGuestGate: gate });
        fireEvent.click(btn(/성형 — 병원으로 들어가기/));
        fireEvent.click(btn(/내 성형 견적 뽑아보기/));
        expect(gate).toHaveBeenCalledWith('paid', 'beauty-estimate');
        expect(screen.queryByText('시작 전에 확인해 주세요')).toBeNull();
        expect(posts()).toHaveLength(0);
        expect(fetchMock.mock.calls.some(([u]) => u === '/api/points/menu-prices')).toBe(false);

        fireEvent.click(btn(/부위별 평균 가격표/));
        expect(await screen.findByText('쌍꺼풀 매몰법 *')).toBeTruthy();
        expect(screen.getByText('50~100만')).toBeTruthy();
        expect(fetchMock).toHaveBeenCalledWith('/api/beauty-estimate/catalog');
    });

    it('사진 base64 를 콘솔·localStorage 에 남기지 않는다', async () => {
        const logs = ['log', 'info', 'warn', 'error', 'debug'].map(k => vi.spyOn(console, k as 'log'));
        const setItem = vi.spyOn(Storage.prototype, 'setItem');
        renderEntry();
        await toPick();
        fireEvent.click(btn('눈'));
        fireEvent.click(analyzeBtn());
        await screen.findByRole('region', { name: '견적 리포트' });
        for (const s of logs) for (const call of s.mock.calls) expect(JSON.stringify(call)).not.toContain('QUJDRA==');
        expect(setItem).not.toHaveBeenCalled();
    });

    it('언마운트 시 미리보기 objectURL 을 해제한다', async () => {
        const r = render(<ChaerinClinicEntry guide={{ title: '윤채린', desc: '' }} onClose={vi.fn()} onStart={vi.fn()} onFeature={vi.fn()} gift={makeGift()} />);
        await toPick();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        r.unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
});

describe('PersonaEntrySheet 분기', () => {
    const base = { onClose: () => {}, onStart: () => {}, onFeature: () => {}, onInvite: () => {} };
    beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => json(200, { prices: {} }))); });
    afterEach(() => vi.unstubAllGlobals());

    it('윤채린이면 뷰티 클리닉 화면이 뜬다', () => {
        render(<PersonaEntrySheet guide={{ title: '윤채린', desc: '' }} {...base} />);
        expect(screen.getByText('CHAERIN BEAUTY CLINIC & STUDIO')).toBeTruthy();
    });

    it('비로그인 시트면 guestGate 가 견적 버튼까지 전달된다', () => {
        setReduced(true);   // 문 연출 없이 바로 넘어가게
        const gate = vi.fn();
        render(<PersonaEntrySheet guide={{ title: '윤채린', desc: '' }} {...base} isGuest onGuestGate={gate} />);
        fireEvent.click(screen.getByRole('button', { name: /성형 — 병원으로 들어가기/ }));
        fireEvent.click(screen.getByRole('button', { name: /내 성형 견적 뽑아보기/ }));
        expect(gate).toHaveBeenCalledWith('paid', 'beauty-estimate');
    });

    it('회원 시트면 gift 가 전달돼 견적 동의 화면으로 들어간다', () => {
        setReduced(true);
        const gate = vi.fn();
        render(<PersonaEntrySheet guide={{ title: '윤채린', desc: '' }} {...base} onGuestGate={gate} gift={makeGift()} />);
        fireEvent.click(screen.getByRole('button', { name: /성형 — 병원으로 들어가기/ }));
        fireEvent.click(screen.getByRole('button', { name: /내 성형 견적 뽑아보기/ }));
        expect(gate).not.toHaveBeenCalled();
        expect(screen.getByText('시작 전에 확인해 주세요')).toBeTruthy();
    });

    it('★다른 페르소나의 기존 화면을 뺏지 않는다', () => {
        render(<PersonaEntrySheet guide={{ title: '윤채원', desc: '' }} {...base} />);
        expect(screen.queryByText('CHAERIN BEAUTY CLINIC & STUDIO')).toBeNull();
    });
});
