/**
 * 학습코칭(/learning/*) 을 나갈 때 방문 기록을 **되감는다**(2026-10-08 사장 지적).
 *
 * 전엔 ✕·"메인" 이 `href='/'` 라 기록이 메인 → /learning → 메인 으로 쌓였다.
 * 그래서 메인에서 다른 페르소나 진입화면을 보다가 뒤로가기를 누르면 /learning 이 다시 떴다.
 *
 * 규칙: 각 학습 화면 기록 항목에 "메인에서 몇 칸 들어왔나"(lcDepth)를 history.state 로 찍는다.
 *   - 메인에서 들어옴 → 1, 학습 화면끼리 이동 → 직전 칸 + 1
 *   - 뒤로/앞으로/새로고침으로 돌아온 항목은 찍어 둔 값을 그대로 쓴다
 *   - 출처를 모르면(주소 직접 입력·외부 링크) 0 → 나갈 때 메인으로 **교체**(기록 추가 없음)
 */
const KEY = 'lc-nav-depth';

const sameOriginPath = (url: string): string | null => {
    try {
        const u = new URL(url);
        return u.origin === window.location.origin ? u.pathname.replace(/(.)\/+$/, '$1') : null;
    } catch { return null; }
};
const readPrev = (): number => {
    try { return Number(sessionStorage.getItem(KEY)) || 0; } catch { return 0; }
};
const savePrev = (depth: number) => {
    try { sessionStorage.setItem(KEY, String(depth)); } catch { /* 사생활 보호 모드 — 깊이만 잃는다 */ }
};
const stateDepth = (): number | null => {
    const d = (window.history.state as { lcDepth?: unknown } | null)?.lcDepth;
    return typeof d === 'number' ? d : null;
};

/** 학습 화면이 처음 그려질 때 한 번 부른다(App 의 /learning 라우트). */
export const trackLearningDepth = () => {
    let depth = stateDepth();
    if (depth === null) {
        const from = sameOriginPath(document.referrer);
        if (from === '/') depth = 1;
        else if (from?.startsWith('/learning')) { const prev = readPrev(); depth = prev > 0 ? prev + 1 : 0; }
        else depth = 0;
        try { window.history.replaceState({ ...(window.history.state || {}), lcDepth: depth }, ''); } catch { /* 무시 */ }
    }
    savePrev(depth);
};

if (typeof window !== 'undefined') {
    // bfcache 로 되살아난 학습 화면은 모듈이 다시 돌지 않는다 — 다음 화면이 쓸 깊이를 이 항목 값으로 맞춘다.
    window.addEventListener('pageshow', (e) => {
        if (!e.persisted) return;
        const d = stateDepth();
        if (d !== null) savePrev(d);
    });
}

/** ✕·"메인" — 들어온 만큼 되감아 메인 기록 항목으로 돌아간다. 모르면 메인으로 교체. */
export const leaveLearning = () => {
    const depth = stateDepth() ?? 0;
    if (depth > 0) window.history.go(-depth);
    else window.location.replace('/');
};
