import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePersonaEmotion } from './usePersonaEmotion';
import { EMOTIONS, EUNBI_ID, emotionImageFor, isGreetingMessage } from '../lib/personaEmotion';

const OTHER = 'persona-without-images';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ emotion: 'shy' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('personaEmotion 매핑', () => {
    it('은비는 10개 카테고리 사진을 모두 가진다', () => {
        for (const e of EMOTIONS) expect(emotionImageFor(EUNBI_ID, e)).toBe(`/eunbi/emo/${e}.jpg`);
        expect(emotionImageFor(EUNBI_ID, undefined)).toBeUndefined();
        expect(emotionImageFor(OTHER, 'happy')).toBeUndefined();
    });
    it('인사말은 assistant 역할만', () => {
        expect(isGreetingMessage({ role: 'assistant' })).toBe(true);
        expect(isGreetingMessage({ role: 'model' })).toBe(false);
        expect(isGreetingMessage(undefined)).toBe(false);
    });
});

describe('usePersonaEmotion', () => {
    it('처음엔 감정 없음 = 기본 사진', () => {
        const { result } = renderHook(() => usePersonaEmotion(EUNBI_ID, { id: '1', role: 'model' }));
        expect(result.current.emotionImageUrl).toBeUndefined();
    });

    it('새 인사말이 마지막이면 greeting — AI 호출 없음', () => {
        const { result } = renderHook(() => usePersonaEmotion(EUNBI_ID, { id: 'g1', role: 'assistant' }));
        expect(result.current.emotion).toBe('greeting');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('답장이 끝나면 판정 결과 사진으로 바뀐다', async () => {
        const { result } = renderHook(() => usePersonaEmotion(EUNBI_ID, undefined));
        act(() => result.current.onReplyDone(EUNBI_ID, '예쁘다', '헤헤 부끄러워요'));
        await waitFor(() => expect(result.current.emotionImageUrl).toBe('/eunbi/emo/shy.jpg'));
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/persona-emotion');
        expect(JSON.parse(init.body)).toEqual({ userText: '예쁘다', replyText: '헤헤 부끄러워요' });
    });

    it('사진 없는 페르소나는 판정 API 를 부르지 않는다(비용 0)', () => {
        const { result } = renderHook(() => usePersonaEmotion(OTHER, { id: 'g', role: 'assistant' }));
        act(() => result.current.onReplyDone(OTHER, 'a', 'b'));
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.emotion).toBeUndefined();
    });

    it('판정 실패·목록 밖 값이면 사진을 바꾸지 않는다', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ emotion: 'angry' }), { status: 200 }));
        fetchMock.mockRejectedValueOnce(new Error('network'));
        const { result } = renderHook(() => usePersonaEmotion(EUNBI_ID, undefined));
        act(() => result.current.onReplyDone(EUNBI_ID, 'a', 'b'));
        act(() => result.current.onReplyDone(EUNBI_ID, 'a', 'c'));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        await new Promise(r => setTimeout(r, 10));
        expect(result.current.emotion).toBeUndefined();
    });

    it('판정 도중 다른 페르소나로 옮겨도 원래 페르소나에 기록된다', async () => {
        let resolve!: (r: Response) => void;
        fetchMock.mockReturnValueOnce(new Promise<Response>(r => { resolve = r; }));
        const { result, rerender } = renderHook(({ pid }) => usePersonaEmotion(pid, undefined), { initialProps: { pid: EUNBI_ID } });
        act(() => result.current.onReplyDone(EUNBI_ID, 'a', 'b'));
        rerender({ pid: OTHER });
        await act(async () => { resolve(new Response(JSON.stringify({ emotion: 'love' }), { status: 200 })); });
        expect(result.current.emotion).toBeUndefined();          // 지금 보는 페르소나는 그대로
        rerender({ pid: EUNBI_ID });
        expect(result.current.emotion).toBe('love');             // 돌아오면 반영돼 있다
    });

    it('갤러리에서 직접 고르면 감정 사진을 걷는다', () => {
        const { result } = renderHook(() => usePersonaEmotion(EUNBI_ID, { id: 'g2', role: 'assistant' }));
        expect(result.current.emotion).toBe('greeting');
        act(() => result.current.clearEmotion(EUNBI_ID));
        expect(result.current.emotionImageUrl).toBeUndefined();
    });

    it('같은 인사말이 다시 렌더돼도 한 번만 반영(clear 후 되살아나지 않음)', () => {
        const { result, rerender } = renderHook(() => usePersonaEmotion(EUNBI_ID, { id: 'g3', role: 'assistant' }));
        act(() => result.current.clearEmotion(EUNBI_ID));
        rerender();
        expect(result.current.emotion).toBeUndefined();
    });
});
