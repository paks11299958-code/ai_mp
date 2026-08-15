// 리버스 프롬프트 — API 클라이언트 + 공용 타입 (app/reverse-prompt/PRD.md 9장)
//
// ★기존 services/apiService.ts의 get/post/del을 재사용한다.
//   authHeaders()가 localStorage.token을 Bearer로 붙이고, 에러에 status·body를 실어준다.
//   새 fetch 래퍼를 만들지 않는다.

import { get, post, del } from '../../services/apiService';

// ★apiService의 request()가 이미 '/api'를 앞에 붙인다(apiService.ts:4 `const BASE='/api'`).
//   여기서 '/api'를 또 쓰면 '/api/api/...'가 되어 404다(2026-08-15 브라우저 실측으로 발견 —
//   타입체크·빌드로는 절대 잡히지 않는다).
const BASE = '/aimp/reverse-prompt';

// ── 서버와 맞춰야 하는 값 ─────────────────────────────────────────────
// ★서버(lib/reverse-prompt/constants.ts)와 동일해야 한다. 한쪽만 바꾸면
//   클라이언트가 통과시킨 파일이 서버에서 413으로 튕긴다.

/** 업로드 원본 상한 5MB. PRD 2.1의 sessionStorage 상한과 같은 값이다. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** 허용 형식. 그 외는 서버에 보내지 않는다. */
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// ── 응답 타입 ─────────────────────────────────────────────────────────

export interface RpAnalysis {
    subject: string;
    style: string;
    composition: string;
    lighting: string;
    color: string;
    mood: string;
    details: string[];
    aspectRatio: string;
    midjourney: string;
    stableDiffusion: { positive: string; negative: string };
}

export interface RpQuota {
    limit: number;
    used: number;
    remaining: number;
    isLoggedIn: boolean;
}

export interface RpAnalyzeResult extends RpAnalysis {
    /** true면 이전 분석 결과를 그대로 돌려준 것(AI 미호출). 화면에 표시한다. */
    cached: boolean;
    /** 로그인 사용자면 보관함 항목 id, 비로그인이면 null. */
    itemId: string | null;
    quota: RpQuota;
}

export interface RpItemSummary {
    id: string;
    thumbnail: string | null;
    createdAt: string;
    /** 목록은 앞부분만 준다. 전문은 상세에서. */
    mjPreview: string;
    sdPreview: string;
}

export interface RpItemsPage {
    items: RpItemSummary[];
    page: number;
    size: number;
    total: number;
    hasNext: boolean;
}

export interface RpItemDetail {
    id: string;
    thumbnail: string | null;
    imageHash: string;
    createdAt: string;
    midjourney: string;
    stableDiffusion: { positive: string; negative: string };
    analysis: RpAnalysis | null;
}

// ── 호출 ──────────────────────────────────────────────────────────────

export const reversePromptApi = {
    quota: () => get<RpQuota>(`${BASE}/quota`),

    analyze: (imageBase64: string, mimeType: string) =>
        post<RpAnalyzeResult>(`${BASE}/analyze`, { imageBase64, mimeType }),

    items: (page = 1, size = 20) =>
        get<RpItemsPage>(`${BASE}/items?page=${page}&size=${size}`),

    itemDetail: (id: string) => get<RpItemDetail>(`${BASE}/items/${id}`),

    deleteItem: (id: string) => del<{ ok: boolean; id: string }>(`${BASE}/items/${id}`),
};

// ── 파일 검증 (클라이언트에서 먼저 거른다) ────────────────────────────

export type FileCheckError =
    | { kind: 'too_large'; sizeMb: string }
    | { kind: 'bad_type'; type: string };

/**
 * ★서버에 보내기 전에 크기·형식을 먼저 본다 — 사용자가 413을 보지 않게 한다(PRD 7장).
 *   서버 검사를 대체하는 것이 아니라 앞단에서 한 번 더 거르는 것이다.
 *   (클라이언트 검사는 우회 가능하므로 서버 검사가 진짜 방어선이다)
 */
export function checkFile(file: File): FileCheckError | null {
    if (!ALLOWED_MIME.includes(file.type)) {
        return { kind: 'bad_type', type: file.type || '알 수 없음' };
    }
    if (file.size > MAX_FILE_BYTES) {
        return { kind: 'too_large', sizeMb: (file.size / 1024 / 1024).toFixed(1) };
    }
    return null;
}

export function fileCheckMessage(e: FileCheckError): string {
    return e.kind === 'too_large'
        ? `이미지는 5MB까지 올릴 수 있어요. (선택한 파일 ${e.sizeMb}MB)`
        : 'JPG, PNG, WEBP 형식만 올릴 수 있어요.';
}

/** File → base64(접두사 없음). 서버가 순수 base64 문자열을 기대한다. */
export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result);
            // "data:image/png;base64,XXXX" → "XXXX"
            const comma = result.indexOf(',');
            resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'));
        reader.readAsDataURL(file);
    });
}

// ── 로그인 이탈 대비 임시 보관 (PRD 2.1) ──────────────────────────────

const PENDING_KEY = 'rp_pending_upload';

export interface PendingUpload {
    base64: string;
    mimeType: string;
    name: string;
}

/**
 * 로그인 모달을 띄우기 **전에** 파일을 보관한다. 로그인 복귀 후 자동으로 이어서 분석한다.
 * ★상한 5MB. base64는 원본보다 33% 크므로 sessionStorage 용량(보통 5~10MB)에 걸릴 수 있다.
 *   저장에 실패하면 조용히 넘기지 말고 false를 돌려줘 화면이 안내하게 한다.
 */
export function savePendingUpload(p: PendingUpload): boolean {
    try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
        return true;
    } catch {
        return false; // QuotaExceededError 등
    }
}

export function loadPendingUpload(): PendingUpload | null {
    try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as PendingUpload;
        return p && typeof p.base64 === 'string' && p.base64 ? p : null;
    } catch {
        return null;
    }
}

export function clearPendingUpload(): void {
    try {
        sessionStorage.removeItem(PENDING_KEY);
    } catch {
        /* 무시 — 지우기 실패가 흐름을 막을 이유는 없다 */
    }
}

/** 로그인 여부. ★토큰 존재만 본다(만료 검증은 서버가 401로 알려준다). */
export function isLoggedIn(): boolean {
    try {
        return !!localStorage.getItem('token');
    } catch {
        return false;
    }
}
