import { afterEach, describe, expect, it, vi } from 'vitest';
import { leaveLearning, trackLearningDepth } from './learningNav';

// 2026-10-08 회귀: ✕ 가 href='/' 라 기록이 메인→/learning→메인 으로 쌓여,
// 메인에서 다른 페르소나를 보다 뒤로가기를 누르면 공부 책상이 다시 떴다.
const setReferrer = (url: string) => Object.defineProperty(document, 'referrer', { value: url, configurable: true });

afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/');
});

describe('learningNav', () => {
    it('메인에서 들어와 학습 화면 두 칸을 지나면 ✕ 는 그만큼 되감는다(새 기록 없음)', () => {
        window.history.replaceState(null, '', '/learning');
        setReferrer(`${window.location.origin}/`);
        trackLearningDepth();
        expect(window.history.state.lcDepth).toBe(1);

        window.history.pushState(null, '', '/learning/dashboard');
        setReferrer(`${window.location.origin}/learning`);
        trackLearningDepth();
        expect(window.history.state.lcDepth).toBe(2);

        const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
        const push = vi.spyOn(window.history, 'pushState');
        leaveLearning();
        expect(go).toHaveBeenCalledWith(-2);
        expect(push).not.toHaveBeenCalled();
    });

    it('뒤로가기로 돌아온 항목은 찍어 둔 깊이를 그대로 쓴다', () => {
        window.history.replaceState({ lcDepth: 1 }, '', '/learning');
        sessionStorage.setItem('lc-nav-depth', '3');
        setReferrer(`${window.location.origin}/learning/task/x`);
        trackLearningDepth();
        expect(window.history.state.lcDepth).toBe(1);
        expect(sessionStorage.getItem('lc-nav-depth')).toBe('1');
    });

    it('출처를 모르면 메인으로 교체한다(되감기 없음)', () => {
        window.history.replaceState(null, '', '/learning');
        setReferrer('https://example.com/');
        trackLearningDepth();
        expect(window.history.state.lcDepth).toBe(0);
        const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});
        const replace = vi.fn();
        vi.stubGlobal('location', { ...window.location, replace, origin: window.location.origin });
        leaveLearning();
        expect(go).not.toHaveBeenCalled();
        expect(replace).toHaveBeenCalledWith('/');
        vi.unstubAllGlobals();
    });
});
