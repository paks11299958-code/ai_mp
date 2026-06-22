// 웹툰 등 보호 콘텐츠 워터마크 텍스트 생성.
// 유출 시 추적용으로 '사이트명 · user#<id>'를 은은히 새긴다. userId는 JWT(localStorage token)에서 디코드.
// (서명·검증 목적 아님 — 표시 전용이라 payload만 base64 디코드)

const SITE = 'aichat.dbzone.kr';

function userIdFromToken(): number | null {
    try {
        const token = localStorage.getItem('token');
        if (!token) return null;
        const payload = token.split('.')[1];
        if (!payload) return null;
        // base64url → base64
        const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = JSON.parse(decodeURIComponent(escape(atob(b64))));
        return typeof json.userId === 'number' ? json.userId : null;
    } catch {
        return null;
    }
}

/** 워터마크 문구. 로그인 유저면 'aichat.dbzone.kr · user#1234', 아니면 사이트명만. */
export function getWatermarkText(): string {
    const id = userIdFromToken();
    return id != null ? `${SITE} · user#${id}` : SITE;
}
