// 추천(레퍼럴) 프론트 유틸 — ?ref 코드 보관/조회.
// 공유 링크(?ref=코드)로 들어온 방문자가 나중에 가입할 때 그 코드를 가입 요청에 동봉한다.
// 보관처: localStorage(브라우저 닫았다 와도 유지). 가입 완료 후엔 호출부에서 clearStoredRef().

const KEY = 'referralCode';

/** URL에 ?ref=코드가 있으면 localStorage에 보관하고 URL에서 제거한다(앱 부팅 시 1회). */
export function captureRefFromUrl(): void {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (!ref) return;
        const code = ref.trim().toUpperCase().slice(0, 16);
        if (code) localStorage.setItem(KEY, code);
        params.delete('ref');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* 무시 */ }
}

/** 보관된 추천코드(없으면 undefined). 가입 요청 body의 ref로 전달. */
export function getStoredRef(): string | undefined {
    try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; }
}

/** 가입 완료 후 보관된 코드 제거(중복 적용 방지). */
export function clearStoredRef(): void {
    try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/** 내 추천 링크 생성. 공유/복사용. */
export function buildReferralLink(code: string): string {
    return `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
}
