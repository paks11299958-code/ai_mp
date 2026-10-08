import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TICK_MS, createRevealer, revealStep } from './smoothReveal';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('smoothReveal', () => {
    it('첫 덩어리가 오면 기다리지 않고 바로 보여 주기 시작한다', () => {
        const seen: string[] = [];
        const r = createRevealer(t => seen.push(t));
        r.push('안녕하세요. 오늘 공부는 영어 단어부터 해 볼까요?');
        expect(seen.length).toBe(1);
        expect(seen[0].length).toBeGreaterThan(0);
    });

    it('300자 밀려도 0.6초 안에 다 따라잡는다(크게 뒤처지지 않음)', () => {
        let shown = '';
        const r = createRevealer(t => { shown = t; });
        const text = '가'.repeat(300);
        r.push(text);
        vi.advanceTimersByTime(600);
        expect(shown).toBe(text);
        expect(revealStep(300)).toBeGreaterThan(revealStep(10));
    });

    it('다 받은 뒤에는 남은 글을 마저 풀고 나서 onDone 을 부른다', () => {
        let shown = '';
        const onDone = vi.fn();
        const r = createRevealer(t => { shown = t; });
        r.push('가'.repeat(100));
        r.finish('가'.repeat(200), onDone);
        expect(onDone).not.toHaveBeenCalled();
        vi.advanceTimersByTime(TICK_MS * 40);
        expect(shown).toBe('가'.repeat(200));
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('빈 답장으로 끝나도 onDone 은 부른다(입력 잠김 방지)', () => {
        const onDone = vi.fn();
        createRevealer(() => {}).finish('', onDone);
        expect(onDone).toHaveBeenCalledTimes(1);
    });

    it('모션 줄이기 설정이면 즉시 다 보여 준다', () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
        let shown = '';
        createRevealer(t => { shown = t; }).push('가'.repeat(500));
        expect(shown.length).toBe(500);
    });

    it('cancel 뒤에는 더 그리지 않는다', () => {
        const seen: string[] = [];
        const r = createRevealer(t => seen.push(t));
        r.push('가'.repeat(300));
        r.cancel();
        const n = seen.length;
        vi.advanceTimersByTime(1000);
        expect(seen.length).toBe(n);
    });
});
