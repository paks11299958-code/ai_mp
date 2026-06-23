// 추천(레퍼럴) 프론트 유틸 — ?ref 코드 보관/조회.
// 공유 링크(?ref=코드)로 들어온 방문자가 나중에 가입할 때 그 코드를 가입 요청에 동봉한다.
// 보관처: localStorage(브라우저 닫았다 와도 유지). 가입 완료 후엔 호출부에서 clearStoredRef().

const KEY = 'referralCode';

/**
 * URL에 ?ref=코드가 있으면 localStorage에 보관하고 URL에서 제거한다(앱 부팅 시 1회).
 * 반환: 이번 진입이 추천 링크였는지(=방금 ref를 캡처했는지). true면 호출부에서 가입 안내 화면으로 유도.
 */
export function captureRefFromUrl(): boolean {
    try {
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        if (!ref) return false;
        const code = ref.trim().toUpperCase().slice(0, 16);
        if (code) localStorage.setItem(KEY, code);
        params.delete('ref');
        const qs = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
        return !!code;
    } catch { return false; }
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

// ── 내 추천코드 캐시 ─────────────────────────────────────────────
// App이 로그인 시 GET /referral로 받아 보관. 공개값(공유링크에 그대로 노출)이라 localStorage 보관 OK.
// 결과 카드 공유 버튼 등 App 밖 컴포넌트가 ref를 붙일 때 참조.
const MY_CODE_KEY = 'myReferralCode';
export function setMyReferralCode(code: string | null): void {
    try { if (code) localStorage.setItem(MY_CODE_KEY, code); else localStorage.removeItem(MY_CODE_KEY); } catch { /* 무시 */ }
}
export function getMyReferralCode(): string | undefined {
    try { return localStorage.getItem(MY_CODE_KEY) || undefined; } catch { return undefined; }
}

/** 기능 딥링크(+내 추천코드) 생성. 결과물 공유의 도착지. */
export function buildFeatureShareLink(featureKey: string): string {
    const ref = getMyReferralCode();
    const refQs = ref ? `&ref=${encodeURIComponent(ref)}` : '';
    return `${window.location.origin}/?f=${encodeURIComponent(featureKey)}${refQs}`;
}

/**
 * 결과 이미지 + 딥링크를 함께 공유(순간 진입점의 핵심).
 * 모바일: navigator.share로 이미지 파일까지 첨부(결과물이 곧 광고) → 미지원/실패 시 링크만.
 * 데스크탑/폴백: 링크 클립보드 복사.
 * 반환: 사용자에게 보일 짧은 안내 문구('' = 네이티브 시트가 떠서 안내 불필요).
 */
export async function shareResultImage(imageUrl: string, featureKey: string, caption: string): Promise<string> {
    const link = buildFeatureShareLink(featureKey);
    const shareData: ShareData = { title: 'AI 페르소나 채팅', text: `${caption}\n${link}` };

    // 1) 이미지 파일까지 첨부 시도(모바일 네이티브 공유). canShare(files)로 가능 여부 확인.
    try {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `result.${(blob.type.split('/')[1] || 'jpg')}`, { type: blob.type || 'image/jpeg' });
        const withFile: ShareData = { ...shareData, files: [file] };
        if (navigator.canShare && navigator.canShare(withFile) && navigator.share) {
            await navigator.share(withFile);
            return '';
        }
    } catch { /* 이미지 fetch/공유 실패 → 아래 링크 공유로 폴백 */ }

    // 2) 링크만 네이티브 공유
    try {
        if (navigator.share) { await navigator.share({ title: shareData.title, text: caption, url: link }); return ''; }
    } catch { return ''; } // 사용자가 시트 닫음 → 추가 안내 없음

    // 3) 클립보드 복사 폴백
    try { await navigator.clipboard.writeText(link); return '공유 링크가 복사되었습니다'; }
    catch { return link; }
}
