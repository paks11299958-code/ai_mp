/**
 * 답장 글자를 **부드럽게 풀어 보여 준다**(2026-10-08 사장 지시 "긴 문장은 앞 문장부터 순차적으로").
 *
 * 모델은 답장을 큰 덩어리(400자 답 = 6~8조각)로 보내 화면에 툭툭 붙었다. 받은 글은 그대로 두고
 * **보여 주는 속도만** 고르게 한다 — 실제 속도는 같고, 체감만 매끄럽다.
 *   - 첫 덩어리가 오면 바로 풀기 시작한다(첫 글자를 늦추지 않는다).
 *   - 밀린 글이 많을수록 한 번에 더 많이 보여 줘 약 0.5초 안에 따라잡는다(받은 글보다 크게 뒤처지지 않게).
 *   - 모션 줄이기 설정·백그라운드 탭이면 즉시 다 보여 준다.
 */
export const TICK_MS = 30;

/** 한 번에 보여 줄 글자 수 — 밀린 양의 18%(최소 2자). 300자 밀림 ≈ 0.5초 안에 소진. */
export const revealStep = (backlog: number) => Math.max(2, Math.ceil(backlog * 0.18));

const instant = () => {
    try {
        if (typeof document !== 'undefined' && document.hidden) return true;
        return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch { return false; }
};

export interface Revealer {
    /** 지금까지 받은 전체 글 */
    push: (fullText: string) => void;
    /** 다 받았다 — 남은 글을 마저 풀고 onDone 을 부른다. */
    finish: (finalText: string, onDone: () => void) => void;
    /** 오류 등 — 남은 글 없이 즉시 멈춘다. */
    cancel: () => void;
}

export const createRevealer = (onText: (shown: string) => void): Revealer => {
    let target = '';
    let shown = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done: (() => void) | null = null;
    let stopped = false;

    const tick = () => {
        timer = null;
        if (stopped) return;
        const backlog = target.length - shown;
        if (backlog > 0) {
            shown = instant() ? target.length : Math.min(target.length, shown + revealStep(backlog));
            onText(target.slice(0, shown));
        }
        if (shown < target.length) { timer = setTimeout(tick, TICK_MS); return; }
        if (done) { const d = done; done = null; stopped = true; d(); }
    };
    const kick = () => { if (!timer && !stopped) tick(); };

    return {
        push: (fullText) => { target = fullText; kick(); },
        finish: (finalText, onDone) => { target = finalText; done = onDone; kick(); },
        cancel: () => { stopped = true; if (timer) clearTimeout(timer); timer = null; },
    };
};
