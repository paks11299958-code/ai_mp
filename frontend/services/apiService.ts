import { Persona, PersonaImage, PersonaVideo, User, DbSession, Message, ConversationSummary, UserMemory, SwingAnalysis, UserSwingAnalysis, Category } from '../types';
import { getStoredRef } from './referral';
import type {
    AiAvatarAssetRow,
    AiAvatarJobRow,
    AiAvatarProjectRow,
    AiAvatarPublicationRow,
} from '../components/admin/aiAvatarContract';

const BASE = '/api';

function getToken(): string | null {
    return localStorage.getItem('token');
}

function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 포인트 부족(402) 공통 처리 — 전역 충전 모달을 띄우고 표준 에러를 던진다.
 *
 * 2026-08-08 사장 지시로 **필요액·잔액·기능명**을 함께 전달하도록 확장했다.
 * 그 전에는 모달이 그냥 "포인트 충전" 결제창처럼 떠서, 회원 입장에선 기능을 눌렀는데
 * 갑자기 충전창이 뜬 셈이라 **왜 떴는지 알 수 없었다**.
 * ★서버가 값을 안 실어줄 수도 있으므로(구버전 경로·다른 402 지점) 화면은 반드시
 *   '있으면 쓰고 없으면 생략'으로 만든다 — 값이 없다고 안내가 깨지면 안 된다.
 * ★code/message는 그대로 유지: 호출부 12곳이 이 문자열로 분기하므로 바꾸면 조용히 깨진다.
 */
export function throwInsufficientPoints(detail?: any): never {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('insufficient-points', {
            detail: detail && typeof detail === 'object' ? {
                required: detail.required, balance: detail.balance,
                shortfall: detail.shortfall, feature: detail.feature,
            } : undefined,
        }));
    }
    const err: any = new Error('INSUFFICIENT_POINTS');
    err.code = 'INSUFFICIENT_POINTS';
    throw err;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders(),
            ...(options.headers || {}),
        },
    });

    const text = await res.text();
    let data: any;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`서버 응답 오류 (${res.status}): ${text.slice(0, 200)}`);
    }

    // 포인트 부족(402): 모든 기능 공통 — 전역 이벤트로 충전 모달을 띄우게 한다.
    if (res.status === 402) {
        throwInsufficientPoints(data);
    }
    if (!res.ok) {
        // 에러에도 상태·본문을 실어 보낸다(2026-08-02) — 예전엔 message만 남기고 본문을
        // 버려서, 409 중복 응답이 실어 보내는 "어떤 항목과 중복인지"를 호출측이 못 읽었다.
        const err: any = new Error(data.error || `서버 오류 (${res.status})`);
        err.status = res.status;
        err.body = data;
        throw err;
    }
    return data;
}

// ── 메서드 헬퍼 (request 래퍼 — boilerplate 축약, 동작은 request와 동일) ──
// get<T>(path)         = request<T>(path)
// post<T>(path, body)  = request<T>(path, { method:'POST', body: JSON.stringify(body) })
// put / del 동일 패턴. body 생략 시 JSON.stringify 안 함(undefined body).
export function get<T>(path: string): Promise<T> {
    return request<T>(path);
}
export function post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: 'POST',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}
export function put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: 'PUT',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}
export function patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: 'PATCH',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}
export function del<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
        method: 'DELETE',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 1500): Promise<T> {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (e: any) {
            const is5xx = e.message?.includes('500') || e.message?.includes('502') || e.message?.includes('503') || e.message?.includes('서버 오류');
            if (i < retries && is5xx) {
                await new Promise(r => setTimeout(r, delayMs * (i + 1)));
            } else {
                throw e;
            }
        }
    }
    throw new Error('재시도 실패');
}

// Auth
export const authApi = {
    register: (emailOrPhone: string, password: string, username?: string, isPhone = false) =>
        post<{ user: User; token: string }>('/auth/register',
            isPhone
                ? { phone: emailOrPhone, password, username, ref: getStoredRef() }
                : { email: emailOrPhone, password, username, ref: getStoredRef() }
        ),

    login: (identifier: string, password: string) =>
        post<{ user: User; token: string }>('/auth/login', { identifier, password }),

    logout: () =>
        post<{ message: string }>('/auth/logout'),

    me: () =>
        get<{ user: User }>('/auth/me'),

    forgotPassword: (email: string) =>
        post<{ message: string }>('/auth/forgot-password', { email }),

    sendCode: (phone: string) =>
        post<{ message: string }>('/auth/send-code', { phone }),

    sendVerify: (type: 'EMAIL' | 'PHONE', identifier: string) =>
        post<{ message: string }>('/auth/send-verify', { type, identifier }),

    verifyRegister: (type: 'EMAIL' | 'PHONE', identifier: string, code: string, password: string, username?: string) =>
        post<{ user: User; token: string }>('/auth/verify-register', { type, identifier, code, password, username, ref: getStoredRef() }),

    // 레퍼럴 링크(?ref) 방문자 자동 체험 계정 — 가입 없이 임시계정+보너스1000P로 정식 사이트 체험.
    guestRegister: () =>
        post<{ user: User; token: string }>('/auth/guest-register', { ref: getStoredRef() }),

    // 임시(게스트) 계정 → 정식 전환(이메일/전화 인증 후). 전환 완료 시 레퍼럴 보상도 이 시점에 지급됨.
    upgradeGuest: (type: 'EMAIL' | 'PHONE', identifier: string, code: string, password: string, username?: string) =>
        post<{ user: User; token: string }>('/auth/upgrade-guest', { type, identifier, code, password, username }),

    // 내 추천 현황(코드/초대인원/적립pt)
    referral: () =>
        get<{ code: string; invitedCount: number; rewardedCount: number; earnedPoints: number }>('/auth/referral'),

    resetPassword: (token: string, password: string) =>
        post<{ message: string }>('/auth/reset-password', { token, password }),

    changePassword: (currentPassword: string, newPassword: string) =>
        post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
};

// Personas
export const personaApi = {
    getAll: () =>
        withRetry(() => get<Persona[]>('/personas')),

    // 인기 랭킹(세션 수 기준). sessionCount 포함.
    getRanking: (limit = 16) =>
        withRetry(() => get<(Persona & { sessionCount: number })[]>(`/personas/ranking?limit=${limit}`)),

    create: (data: Omit<Persona, 'id'>) =>
        post<Persona>('/personas', data),

    update: (id: string, data: Partial<Persona>) =>
        put<Persona>(`/personas/${id}`, data),

    delete: (id: string) =>
        del<{ message: string }>(`/personas/${id}`),

    getIntroVideoUploadUrl: (id: string, mimeType: string) =>
        get<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/intro-video/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveIntroVideoUrl: (id: string, videoUrl: string) =>
        post<Persona>(`/personas/${id}/intro-video`, { videoUrl }),

    deleteIntroVideo: (id: string) =>
        del<Persona>(`/personas/${id}/intro-video`),

    getStarVideoUploadUrl: (id: string, mimeType: string) =>
        get<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/star-video/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveStarVideoUrl: (id: string, videoUrl: string) =>
        post<Persona>(`/personas/${id}/star-video`, { videoUrl }),

    deleteStarVideo: (id: string) =>
        del<Persona>(`/personas/${id}/star-video`),

    getFaceReadingBgUploadUrl: (id: string, mimeType: string) =>
        get<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/face-reading-bg/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveFaceReadingBgUrl: (id: string, imageUrl: string) =>
        post<Persona>(`/personas/${id}/face-reading-bg`, { imageUrl }),

    deleteFaceReadingBg: (id: string) =>
        del<Persona>(`/personas/${id}/face-reading-bg`),

    getChatBgUploadUrl: (id: string, mimeType: string) =>
        get<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/chat-bg/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveChatBgUrl: (id: string, imageUrl: string) =>
        post<Persona>(`/personas/${id}/chat-bg`, { imageUrl }),

    removeChatBgItem: (id: string, url: string) =>
        post<Persona>(`/personas/${id}/chat-bg/remove`, { url }),

    deleteChatBg: (id: string) =>
        del<Persona>(`/personas/${id}/chat-bg`),
};

// 🔮 타로 리딩 보고서
export const tarotApi = {
    save: (body: { question?: string | null; cards: any[]; interpretations: { position: string; text: string }[] }) =>
        post<{ id: string; createdAt: string }>('/tarot-readings', body),
    share: (id: string) =>
        post<{ shareId: string }>(`/tarot-readings/${id}/share`, {}),
    getShared: (shareId: string) =>
        get<{ question: string | null; cardsJson: string; interpretationsJson: string; createdAt: string }>(`/tarot-readings/shared/${shareId}`),
};

// Categories
export const categoryApi = {
    getAll: () =>
        get<Category[]>('/categories'),

    create: (name: string, order?: number) =>
        post<Category>('/categories', { name, order }),

    update: (id: number, data: { name?: string; order?: number }) =>
        put<Category>(`/categories/${id}`, data),

    delete: (id: number) =>
        del<{ message: string }>(`/categories/${id}`),
};

// Persona Images
export const personaImageApi = {
    getAll: (personaId: string) =>
        get<PersonaImage[]>(`/personas/${personaId}/images`),

    getSignedUrl: (personaId: string, mimeType: string, filename: string) =>
        post<{ signedUrl: string; publicUrl: string }>(`/personas/${personaId}/images/signed-url`, { mimeType, filename }),

    create: (personaId: string, imageUrl: string, description: string, isMain?: boolean) =>
        post<PersonaImage>(`/personas/${personaId}/images`, { imageUrl, description, isMain }),

    setMain: (personaId: string, imageId: number) =>
        put<PersonaImage>(`/personas/${personaId}/images`, { imageId, isMain: true }),

    updateDescription: (personaId: string, imageId: number, description: string) =>
        put<PersonaImage>(`/personas/${personaId}/images`, { imageId, description }),

    updateRequiredLevel: (personaId: string, imageId: number, requiredLevel: number) =>
        put<PersonaImage>(`/personas/${personaId}/images`, { imageId, requiredLevel }),

    updateOrder: (personaId: string, imageId: number, order: number) =>
        put<PersonaImage>(`/personas/${personaId}/images`, { imageId, order }),

    delete: (personaId: string, imageId: number) =>
        del<{ message: string }>(`/personas/${personaId}/images`, { imageId }),
};

// Persona Videos
export const personaVideoApi = {
    getAll: (imageId: number) =>
        get<PersonaVideo[]>(`/persona-videos/${imageId}`),

    getSignedUrl: (mimeType: string, filename: string) =>
        post<{ signedUrl: string; publicUrl: string }>('/persona-videos/signed-url', { mimeType, filename }),

    create: (imageId: number, data: { videoUrl?: string; videoBase64?: string; mimeType?: string; title?: string }) =>
        post<PersonaVideo>('/persona-videos', { imageId, ...data }),

    update: (videoId: number, data: { title?: string; order?: number; requiredLevel?: number }) =>
        put<PersonaVideo>(`/persona-videos/${videoId}`, data),

    delete: (videoId: number) =>
        del<{ message: string }>(`/persona-videos/${videoId}`),
};

// Sessions
export const sessionApi = {
    getAll: () =>
        get<{ sessions: DbSession[]; firstChatMap: Record<string, string> }>('/sessions'),

    create: (personaId: string, title?: string) =>
        post<DbSession>('/sessions', { personaId, title }),

    getMessages: (sessionId: number, cursor?: number, limit?: number) =>
        get<{ messages: Message[]; hasMore: boolean }>(
            `/sessions/${sessionId}/messages?limit=${limit || 50}${cursor ? `&cursor=${cursor}` : ''}`
        ),

    saveMessage: async (sessionId: number, role: string, text: string): Promise<Message & { xp?: number; personaId?: string; points?: import('../types').PointsInfo }> => {
        const res = await fetch(`${BASE}/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ role, text }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) {
            const err: any = new Error('INSUFFICIENT_POINTS');
            err.code = 'INSUFFICIENT_POINTS';
            throw err;
        }
        if (res.status === 429 && data.error === 'DAILY_CHAT_LIMIT') {
            const err: any = new Error(data.message || '오늘의 무료 대화를 모두 사용했어요.');
            err.code = 'DAILY_CHAT_LIMIT';
            throw err;
        }
        if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
        return data;
    },

    getSummary: (sessionId: number) =>
        get<ConversationSummary | null>(`/sessions/${sessionId}/summary`),

    saveSummary: (sessionId: number, summary: string, messageCount: number) =>
        post<ConversationSummary>(`/sessions/${sessionId}/summary`, { summary, messageCount }),

    extractMemories: (sessionId: number, userText: string, aiText: string) =>
        post<{ saved: number }>(`/sessions/${sessionId}/extract-memories`, { userText, aiText }),

    greet: (sessionId: number) =>
        post<Message>(`/sessions/${sessionId}/greet`),

    quickTrigger: (sessionId: number, menuLabel: string, menuPrompt: string) =>
        post<Message>(`/sessions/${sessionId}/quick-trigger`, { menuLabel, menuPrompt }),

    summarize: (sessionId: number) =>
        post<ConversationSummary | null>(`/sessions/${sessionId}/summarize`),

    starThanks: (personaId: string, amount: number) =>
        post<{ message: Message; sessionId: number }>('/star-thanks', { personaId, amount }),

    cleanup: (days: number = 30, keepCount: number = 10) =>
        post<{ cleanedSessions: number; deletedMessages: number }>('/sessions/cleanup', { days, keepCount }),
};

// Settings
export const settingsApi = {
    get: () =>
        get<Record<string, string>>('/settings'),

    update: (data: Record<string, string>) =>
        put<{ message: string }>('/settings', data),
};

// Memory
export const memoryApi = {
    getAll: () =>
        get<UserMemory[]>('/memory'),

    save: (content: string, category?: string) =>
        post<UserMemory>('/memory', { content, category }),

    search: (query: string) =>
        post<UserMemory[]>('/memory/search', { query }),

    delete: (id: number) =>
        del<{ message: string }>(`/memory/${id}`),
};

// Knowledge
export const knowledgeApi = {
    upload: (personaId: string, title: string, text: string) =>
        post<{ saved: number; total: number; sourceId: string }>('/knowledge', { personaId, title, text }),

    getAll: (personaId: string) =>
        get<{ sourceId: string | null; title: string | null; chunkCount: number; preview: string; createdAt: string }[]>(
            `/knowledge/${personaId}`
        ),

    deleteSource: (sourceId: string) =>
        del<{ message: string; deleted: number }>(`/knowledge/source/${sourceId}`),

    delete: (id: number) =>
        del<{ message: string }>(`/knowledge/${id}`),

    search: (personaId: string, query: string) =>
        post<{ id: number; content: string; similarity: number }[]>('/knowledge/search', { personaId, query }),
};

// Trigger Videos
export const triggerVideoApi = {
    getAll: (personaId: string) =>
        get<import('../types').TriggerVideo[]>(`/trigger-videos/${personaId}`),

    getSignedUrl: (mimeType: string, filename: string) =>
        post<{ signedUrl: string; publicUrl: string }>('/trigger-videos/signed-url', { mimeType, filename }),

    extractKeywords: (title: string, description: string) =>
        post<{ keywords: string[] }>('/trigger-videos/extract-keywords', { title, description }),

    create: (data: { personaId: string; videoUrl: string; title?: string; description?: string; keywords: string; tag?: string }) =>
        post<import('../types').TriggerVideo>('/trigger-videos', data),

    update: (id: number, data: { title?: string; description?: string; keywords?: string; tag?: string }) =>
        put<import('../types').TriggerVideo>(`/trigger-videos/${id}`, data),

    delete: (id: number) =>
        del<{ ok: boolean }>(`/trigger-videos/${id}`),
};

// Stock Analysis (정밀분석 — 공유 링크)
export const stockAnalysisApi = {
    share: (id: number) =>
        post<{ shareId: string }>(`/stock-analysis/${id}/share`, {}),
    getShared: (shareId: string) =>
        get<{
            stockName: string; status: string;
            analysisReport: string | null; claudeReport: string | null; gptReport: string | null;
            sourceLinks: string | null; yahooSymbol: string | null; chartImageUrl: string | null;
            createdAt: string; updatedAt: string;
        }>(`/stock-analysis/shared/${shareId}`),
};

// Stock Report (RAG)
export const stockReportApi = {
    consult: (analysisId: number) =>
        post<{ ok: boolean; chunks: number; stockName: string; ticker: string; personaId: string }>(
            '/stock-report/consult', { analysisId }
        ),

    search: (q: string) =>
        get<{ content: string; stockName: string; ticker: string; reportDate: string; quarter: string; similarity: number }[]>(
            `/stock-report/search?q=${encodeURIComponent(q)}`
        ),

    list: () =>
        get<{ ticker: string; stockName: string; reportDate: string; chunkCount: number }[]>(
            '/stock-report/list'
        ),
};

// Swing Analysis
export const swingAnalysisApi = {
    getSignedUrl: (mimeType: string, filename: string) =>
        post<{ signedUrl: string; publicUrl: string }>('/swing-analysis/signed-url', { mimeType, filename }),

    analyze: async (videoUrl: string, personaId: string, mimeType: string, fileName: string, title?: string, gender?: string, skillLevel?: string): Promise<{ id: number; analysis: SwingAnalysis; createdAt: string }> => {
        const cfUrl = import.meta.env.VITE_GOLF_CF_URL as string | undefined;
        const body = { videoUrl, personaId, mimeType, fileName, title, gender, skillLevel };
        if (cfUrl) {
            // 프로덕션: Cloud Function 직접 호출 (Vercel 타임아웃 우회)
            const token = getToken();
            const res = await fetch(cfUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`서버 응답 오류: ${text.slice(0, 200)}`); }
            if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
            // CF는 AI 분석만 수행하고 title/gender/skillLevel을 저장하지 않으므로 별도 업데이트
            if (data.id && (title || gender || skillLevel)) {
                request(`/swing-analysis/${data.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ title, gender, skillLevel }),
                }).catch(() => {});
            }
            return data;
        }
        // 로컬 개발: Express 서버 사용 (타임아웃 없음)
        return post<{ id: number; analysis: SwingAnalysis; createdAt: string }>('/swing-analysis/analyze', body);
    },

    getHistory: (personaId: string) =>
        get<UserSwingAnalysis[]>(`/swing-analysis?personaId=${encodeURIComponent(personaId)}`),

    delete: (id: number) =>
        del<{ ok: boolean }>(`/swing-analysis/${id}`),
};

export interface FaceReadingResult {
    forehead: string;
    eyes: string;
    nose: string;
    mouthChin: string;
    overall: string;
    advice: string;
}

export const faceReadingApi = {
    analyze: (imageBase64: string, mimeType: string, personaId: string) =>
        post<{ analysis: FaceReadingResult; newBalance: number; paidBalance: number; bonusBalance: number }>('/face-reading', { imageBase64, mimeType, personaId }),
};

// ── 닮은 연예인 찾기(윤채린) ──────────────────────────
export interface LookalikeMatch { name: string; percent: number; reason: string }
export interface LookalikeResult { unclear?: boolean; impression: string; matches: LookalikeMatch[]; comment: string }
export type LookalikeAnalyzeOk = { ok: true; analysis: LookalikeResult; paidBalance?: number; bonusBalance?: number };
export type LookalikeAnalyzeUnclear = { ok: false; message: string };
export const lookalikeApi = {
    // 422(사진 불명확)는 에러가 아닌 정상 분기로 반환. 그 외 오류만 throw. (palmReadingApi와 동일 패턴)
    analyze: async (imageBase64: string, mimeType: string, personaId: string): Promise<LookalikeAnalyzeOk | LookalikeAnalyzeUnclear> => {
        const res = await fetch(`${BASE}/lookalike`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ imageBase64, mimeType, personaId }),
        });
        if (res.status === 402) {
            // 본문을 먼저 읽어 필요액·잔액을 모달에 넘긴다(2026-08-08).
            // 기존엔 본문을 읽기 전에 던져서 서버가 준 정보를 통째로 버리고 있었다.
            const d = await res.json().catch(() => ({}));
            throwInsufficientPoints(d);
        }
        const text = await res.text();
        const data: any = text ? JSON.parse(text) : {};
        if (res.status === 422) return { ok: false, message: data.error || '얼굴이 잘 안 보여요. 또렷한 정면 사진으로 다시 시도해 주세요.' };
        if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
        return { ok: true, analysis: data.analysis, paidBalance: data.paidBalance, bonusBalance: data.bonusBalance };
    },
};

export interface HairStyle { id: number; styleKey: string; name: string; gender: string; imageUrl: string; description?: string }
export interface HairMatchResult { unclear?: boolean; faceShape: string; match: string; tips: string; alternative: string; overall: string }
export const hairApi = {
    styles: (gender?: 'male' | 'female') =>
        get<HairStyle[]>(`/hair/styles${gender ? `?gender=${gender}` : ''}`),
    // 합성 가능 상태(신호등) — 폴링용
    status: () => get<{ status: 'ok' | 'busy'; retryAfterSec: number }>('/hair/status'),
    analyze: (imageBase64: string, mimeType: string, hairStyleId: number, personaId?: string, studioBg?: boolean) =>
        post<{ analysis: HairMatchResult; resultImageUrl: string | null }>('/hair/analyze', { imageBase64, mimeType, hairStyleId, personaId, studioBg }),
};

// ── 프로필 사진(윤채린) ── 얼굴 사진 → 배경 컨셉별 상반신 프로필 사진 (2026-07-21: 전통의상 체험에서 교체)
export interface OutfitStyle { id: number; styleKey: string; name: string; country: string; gender?: string; emoji?: string; imageUrl?: string | null; description?: string }
export const outfitApi = {
    styles: (gender?: 'male' | 'female') => get<OutfitStyle[]>(`/outfit/styles${gender ? `?gender=${gender}` : ''}`),
    status: () => get<{ status: 'ok' | 'busy'; retryAfterSec: number }>('/outfit/status'),
    analyze: (imageBase64: string, mimeType: string, outfitStyleId: number) =>
        post<{ resultImageUrl: string | null; outfitName: string; country: string }>('/outfit/analyze', { imageBase64, mimeType, outfitStyleId }),
};

// ── 나이 변환(윤채린) ──
export const ageTransformApi = {
    // 4개 나이대 이미지 생성(DB 저장 안 함). { images: {"10s":url,...}, succeeded }
    // 생성 가능 상태(헤어와 공유 신호등) — 폴링용
    status: () => get<{ status: 'ok' | 'busy'; retryAfterSec: number }>('/age-transform/status'),
    generate: (imageBase64: string, mimeType: string, currentAge: number, selectedAges: number[]) =>
        post<{ images: Record<string, string>; currentAge: number; ages: number[]; total: number; succeeded: number }>('/age-transform/generate', { imageBase64, mimeType, currentAge, selectedAges }),
    // 생성 결과 저장 + 차감
    save: (images: Record<string, string>, originalUrl?: string) =>
        post<{ id: number; saved: boolean; newBalance?: number }>('/age-transform/save', { images, originalUrl }),
    list: () => get<{ id: number; originalUrl: string | null; images: Record<string, string>; createdAt: string }[]>('/age-transform'),
};

// ── 사용자용 마케팅 콘텐츠 (개인 SNS 운영자, 인스타) ──
export interface MarketingRequestRow {
    id: string;
    topic: string;
    channel: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    isFreeTrial: boolean;
    result?: string | null;
    failReason?: string | null;
    sourcesCount?: number;
    createdAt: string;
}
export const marketingApi = {
    // 요청 생성(비동기). 무료체험 1회 or 포인트 차감. 202 → { id, status, isFreeTrial }.
    request: (topic: string) =>
        post<{ id: string; status: string; isFreeTrial: boolean; pointsCharged: number }>('/marketing/request', { topic }),
    // 단건 폴링(본인 것). status가 done/failed 될 때까지 클라이언트가 폴링.
    get: (id: string) => get<MarketingRequestRow>(`/marketing/request/${id}`),
    // 내 요청 이력(경량).
    list: () => get<MarketingRequestRow[]>('/marketing/requests'),
};

// ── 홈페이지 만들기 (신청서 → AI 시안 링크 + 소스 zip) ──
export interface HomepageRequestRow {
    id: number;
    status: 'pending' | 'processing' | 'done' | 'failed';
    slug?: string | null;
    url?: string | null;       // 시안 공개 URL(주인공)
    zipUrl?: string | null;    // 소스 zip URL(보조, 정적 파일)
    errorMessage?: string | null;
    pointsCharged: number;
    formJson?: string;
    imageSlots?: { file: string }[];   // 생성 시 만든 이미지 목록(사진편집 탭 썸네일, 2026-07-20)
    createdAt: string;
    // 대기·처리중일 때만 서버가 얹어줌 — 순번·예상시간 안내(2026-07-20부터 24시간 상시 가동)
    queuePosition?: number;    // 내 순번(1=바로 다음)
    etaMinutes?: number;       // 예상 완료까지 분
}
export const homepageApi = {
    // 신청(비동기). 1,000pt 선차감(MenuLimit 'homepage'), 실패 시 워커가 자동환불. 202 → { id }.
    create: (form: Record<string, string>) =>
        post<{ id: number; status: string; pointsCharged: number }>('/homepage/requests', form),
    // 단건 폴링(본인 것만). done/failed 될 때까지 클라이언트가 폴링.
    get: (id: number) => get<HomepageRequestRow>(`/homepage/requests/${id}`),
    // 내 신청 이력(최근순) — 보드 재진입 시 진행 중/완성본 복원.
    mine: () => get<HomepageRequestRow[]>('/homepage/requests/mine'),
    // 🛠️ 어드민 — 회원 전체 신청 관리(누가·언제·상태·주소·과금).
    adminList: (status = '') =>
        get<HomepageAdminRow[]>(`/homepage/admin/requests${status ? `?status=${status}` : ''}`),
    adminSummary: () =>
        get<{ byStatus: Record<string, number>; opsHours: string }>('/homepage/admin/summary'),
    // ✏️ 채팅 편집 — text(100P)/image(200P)/upload(100P). 202 → { id }.
    createEdit: (requestId: number, body: { kind: 'text' | 'image' | 'upload'; instruction: string; targetFile?: string; imageBase64?: string }) =>
        post<{ id: number; status: string; pointsCharged: number }>(`/homepage/requests/${requestId}/edits`, body),
    getEdit: (requestId: number, editId: number) =>
        get<HomepageEditRow>(`/homepage/requests/${requestId}/edits/${editId}`),
    editHistory: (requestId: number) =>
        get<HomepageEditRow[]>(`/homepage/requests/${requestId}/edits`),
    applyEdit: (requestId: number, editId: number) =>
        post<{ id: number; status: string }>(`/homepage/requests/${requestId}/edits/${editId}/apply`, {}),
    revertEdit: (requestId: number, editId: number) =>
        post<{ id: number; status: string }>(`/homepage/requests/${requestId}/edits/${editId}/revert`, {}),
};

// 이아린 — 쇼츠 만들기(이미지 1장 → 시나리오 5개 → 요금제+스타일 확정 → 5초 미리보기 →
// 결제 → 실제 제작). 2026-08-02 3차 개편: Veo 옵션 폐지, 요금제 스탠다드(3000P)/
// 프리미엄(5000P) 2단계로 단순화, 프리미엄은 화풍 다른 완성본 2개 중 선택.
// 과금: ①리서치+시나리오5개(shorts_maker_research, 100P) ②영상제작
// (shorts_maker_produce_standard/premium, 3000P/5000P — 미리보기 자체는 무료).
export interface ShortsScenario { angle: string; title: string; hook: string; summary: string; }
export interface ShortsPreview { caption?: string; }
export interface UserShortsRow {
    id: number;
    status: 'pending' | 'processing_research' | 'scenarios_ready' | 'previewing' | 'processing_preview'
          | 'preview_ready' | 'producing' | 'processing_produce' | 'done' | 'failed';
    formJson: string;
    scenarios: ShortsScenario[];
    selectedIndex: number | null;
    plan: 'standard' | 'premium';
    preview: ShortsPreview | null;
    hasPreviewVideo: boolean;
    hasVideo: boolean;
    hasVideo2: boolean;               // 프리미엄 2번째 완성본 존재 여부
    selectedVideoSlot: number | null; // 프리미엄에서 최종 선택한 슬롯(0|1)
    errorMessage: string | null;
    pointsChargedResearch: number;
    pointsChargedVideo: number;
    createdAt: string;
    progressStep: 'script' | 'images' | 'tts' | 'verify' | null;
    progressDone: number | null;
    progressTotal: number | null;
}
export const shortsMakerApi = {
    // 1단계: 이미지(최대 3장)+폼 접수(리서치+시나리오5개 생성, 선차감). 202 → { id }.
    // cakeImageBase64(2026-08-02 2차, 생일축하 전용): 케이크 사진 1장을 별도 필드로 보낸다 —
    // shared-api가 images 배열 맨 뒤에 이어붙이고 hasCakePhoto 플래그를 세워, 워커가
    // "마지막 원소 = 케이크"로 식별해 재해석 없이 지정 위치에 고정 배정한다.
    create: (form: Record<string, string>, imagesBase64: string[], cakeImageBase64?: string) =>
        post<{ id: number; status: string; pointsCharged: number }>('/shorts-maker/requests', { ...form, imagesBase64, ...(cakeImageBase64 ? { cakeImageBase64 } : {}) }),
    get: (id: number) => get<UserShortsRow>(`/shorts-maker/requests/${id}`),
    // ★페이징(2026-08-02 3차) — 완성본은 영구 보관이라 회원이 언제든 전체를 볼 수 있어야
    // 한다. offset/limit로 "더 보기" 구현, total로 남은 항목 유무 판단.
    mine: (offset = 0, limit = 30) =>
        get<{ rows: UserShortsRow[]; total: number; offset: number; limit: number }>(
            `/shorts-maker/requests/mine?offset=${offset}&limit=${limit}`),
    // 2단계(2026-08-02 3차 신설): 시나리오+요금제+스타일 확정 → 무료 5초 미리보기 생성.
    // restyleKeys: 스탠다드는 0~1개, 프리미엄은 정확히 2개(화풍 다른 완성본 2개 예고).
    // voiceName(2026-08-03): 회원이 직접 고른 목소리(선택) — 안 넘기면 카테고리/전역 설정 폴백.
    preview: (id: number, scenarioIndex: number, plan: 'standard' | 'premium', restyleKeys: string[], voiceName?: string) =>
        post<{ id: number; status: string }>(`/shorts-maker/requests/${id}/preview`,
            { scenarioIndex, plan, restyleKeys, ...(voiceName ? { voiceName } : {}) }),
    previewVideoUrl: (id: number) => `${BASE}/shorts-maker/requests/${id}/preview-video`,
    // 회원용 목소리 후보(2026-08-03) — 어드민 화면과 같은 검증된 목록, 카테고리 기본값도 함께.
    getVoices: (category = 'default', lang = 'ko') =>
        get<{ lang: string; category: string; defaultVoice: string | null; candidates: { name: string; gender: 'F' | 'M' }[] }>(
            `/shorts-maker/requests/voices?lang=${lang}&category=${category}`),
    previewVoice: async (voiceName: string, text?: string): Promise<string> => {
        const res = await fetch(`${BASE}/shorts-maker/requests/voice-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
            },
            body: JSON.stringify({ voiceName, ...(text ? { text } : {}) }),
        });
        if (!res.ok) {
            const msg = await res.json().catch(() => ({}));
            throw new Error(msg.error || `미리듣기 실패 (${res.status})`);
        }
        return URL.createObjectURL(await res.blob());
    },
    // 3단계: 미리보기 확인 후 결제 확정→실제 제작(선차감). 202 → { id }.
    confirm: (id: number) =>
        post<{ id: number; status: string; pointsCharged: number }>(`/shorts-maker/requests/${id}/confirm`, {}),
    // 프리미엄 2버전 중 최종 선택(완성 후).
    selectFinal: (id: number, slot: 0 | 1) =>
        post<{ id: number; selectedVideoSlot: number }>(`/shorts-maker/requests/${id}/select-final`, { slot }),
    videoUrl: (id: number, opts?: { slot?: 0 | 1; download?: boolean }) => {
        const params = new URLSearchParams();
        if (opts?.slot !== undefined) params.set('slot', String(opts.slot));
        if (opts?.download) params.set('download', '1');
        const qs = params.toString();
        return `${BASE}/shorts-maker/requests/${id}/video${qs ? `?${qs}` : ''}`;
    },
    delete: (id: number) => del<{ ok: boolean }>(`/shorts-maker/requests/${id}`),
};

// ★품질 검수용 임시 기능(2026-07-25 사장 지시) — 회원용 쇼츠 만들기 기능 안정화 전까지만
// 어드민이 완성 영상을 직접 확인할 수 있게 함. 안정화되면 이 인터페이스+API 통째로 제거할 것.
export interface UserShortsAdminRow {
    id: number;
    userId: number;
    status: string;
    biz: string;
    language: string;
    category: string;
    topic: string;
    errorMessage: string | null;
    hasVideo: boolean;
    createdAt: string;
}
export const shortsMakerAdminApi = {
    list: () => get<UserShortsAdminRow[]>('/shorts-maker/admin/requests'),
    videoUrl: (id: number) => `${BASE}/shorts-maker/admin/requests/${id}/video`,
};

// 샘플 영상 보관함(2026-07-25 사장 발안, 어드민 전용) — 잘 나온 완성본을 UserShorts에서
// 복사해 독립적으로 영구 보관. 위 shortsMakerAdminApi(임시 검수용)와 달리 안정화 후에도
// 그대로 남는 정식 기능.
export interface SampleVaultRow {
    id: number;
    title: string;
    description: string | null;
    category: string;
    language: string;
    hasThumbnail: boolean;
    sourceUserShortsId: number | null;
    sourceTaskId: string | null;
    createdAt: string;
}
// 409 중복 응답 본문(2026-08-02) — err.body로 전달된다.
export interface VaultDuplicate {
    id: number; title: string; createdAt: string;
}
export const sampleVaultApi = {
    list: () => get<SampleVaultRow[]>('/sample-vault'),
    update: (id: number, patch: { title?: string; description?: string }) =>
        put<{ ok: boolean }>(`/sample-vault/${id}`, patch),
    remove: (id: number) => del<{ ok: boolean }>(`/sample-vault/${id}`),
    // force=true면 이미 보관된 원본이어도 다시 복사(어드민이 확인창에서 승인한 경우).
    copyFromUserShorts: (userShortsId: number, force = false) =>
        post<{ id: number }>(`/sample-vault/from-user-shorts/${userShortsId}${force ? '?force=1' : ''}`, {}),
    copyFromQueue: (taskId: string, force = false) =>
        post<{ id: number }>(`/sample-vault/from-queue/${encodeURIComponent(taskId)}${force ? '?force=1' : ''}`, {}),
    videoUrl: (id: number) => `${BASE}/sample-vault/${id}/video`,
    thumbnailUrl: (id: number) => `${BASE}/sample-vault/${id}/thumbnail`,
};

export interface HomepageAdminRow extends HomepageRequestRow {
    userId: number;
    userName?: string | null;
    userEmail?: string | null;
    updatedAt?: string | null;
    waitingMinutes?: number | null;  // 대기·처리중 경과분(밀림 감지)
}

export interface HomepageEditRow {
    id: number;
    requestId: number;
    kind: 'text' | 'image' | 'upload';
    instruction: string;
    targetFile?: string | null;
    status: 'pending' | 'processing' | 'applying' | 'reverting' | 'done' | 'failed';
    previewUrl?: string | null;   // image·upload: 확인 대기 중인 미리보기
    errorMessage?: string | null;
    pointsCharged: number;
    createdAt: string;
}

// ── 네이버 지식인 자동 답변 (어드민 전용, 뼈대) ──
export interface KinKeywordRow {
    id: number;
    keyword: string;
    active: boolean;
    personaId: string | null;
    personaName: string | null;
    createdAt: string;
}
export interface KinAnswerRow {
    id: number;
    keywordId: number;
    keyword: string;
    questionUrl: string;
    questionTitle: string | null;
    questionBody: string | null;
    answerDraft: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string;
}
export const kinAnswerApi = {
    keywords: () => get<KinKeywordRow[]>('/kin-answer/keywords'),
    addKeyword: (keyword: string, personaId?: string) =>
        post<KinKeywordRow>('/kin-answer/keywords', { keyword, personaId }),
    updateKeyword: (id: number, patch: { active?: boolean; personaId?: string | null }) =>
        put<{ ok: boolean }>(`/kin-answer/keywords/${id}`, patch),
    deleteKeyword: (id: number) => del<{ ok: boolean }>(`/kin-answer/keywords/${id}`),
    answers: (keywordId?: number) =>
        get<KinAnswerRow[]>(`/kin-answer/answers${keywordId ? `?keywordId=${keywordId}` : ''}`),
};

// ── 문서 QnA 뼈대(2026-07-24 사장 발안, 어드민 전용) ──
// GCP 크레딧 "Trial credit for GenAI App Builder"(Vertex AI Search 전용) 실사용 검증용.
// 포인트 과금·기능카드 없음 — 어드민 패널 임시 탭에서만 접근.
export interface DocQnaDocRow {
    id: number;
    userId: number;
    fileName: string;
    gcsPath: string | null;
    dsDocumentId: string | null;
    status: 'pending' | 'ingesting' | 'ready' | 'failed';
    errorMessage: string | null;
    createdAt: string;
}
export interface DocQnaQuestionRow {
    id: number;
    docId?: number;
    question: string;
    answer: string | null;
    status: 'pending' | 'answered' | 'failed';
    errorMessage: string | null;
    createdAt: string;
}
export const docQnaApi = {
    docs: () => get<DocQnaDocRow[]>('/doc-qna/docs'),
    upload: (fileName: string, fileBase64: string) =>
        post<DocQnaDocRow>('/doc-qna/docs', { fileName, fileBase64 }),
    ask: (docId: number, question: string) =>
        post<DocQnaQuestionRow>(`/doc-qna/docs/${docId}/questions`, { question }),
    questions: (docId: number) =>
        get<DocQnaQuestionRow[]>(`/doc-qna/docs/${docId}/questions`),
};

// ── 손금(手相) 분석 ──
export interface PalmReadingResult {
    lifeLine: string;
    headLine: string;
    heartLine: string;
    fateLine: string;
    moneyMarriage: string;
    overall: string;
    advice: string;
}
export interface PalmAnalyzeOk {
    ok: true;
    analysis: PalmReadingResult;
    paidBalance: number;
    bonusBalance: number;
}
export interface PalmAnalyzeUnclear {
    ok: false;
    message: string;       // 사진 불명확 안내(저장 안 됨, 포인트 환불됨)
    paidBalance?: number;
    bonusBalance?: number;
}
export const palmReadingApi = {
    // 422(사진 불명확)는 에러가 아닌 정상 분기로 반환. 그 외 오류만 throw.
    analyze: async (
        imageBase64: string, mimeType: string, personaId: string, hand: 'left' | 'right',
        gender?: 'male' | 'female' | null,
    ): Promise<PalmAnalyzeOk | PalmAnalyzeUnclear> => {
        const res = await fetch(`${BASE}/palm-reading`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ imageBase64, mimeType, personaId, hand, gender }),
        });
        const text = await res.text();
        const data: any = text ? JSON.parse(text) : {};
        if (res.status === 422) {
            return { ok: false, message: data.message || '사진이 선명하지 않아 분석할 수 없어요.', paidBalance: data.paidBalance, bonusBalance: data.bonusBalance };
        }
        if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
        return { ok: true, analysis: data.analysis, paidBalance: data.paidBalance, bonusBalance: data.bonusBalance };
    },
};

// ── 전자책 만들기 (강지훈) ──
export interface EbookSource { title: string; summary: string; url?: string; tableData?: string; }
export type EbookSourceStatus = 'idle' | 'queued' | 'collecting' | 'done' | 'failed';
export type EbookContentStatus = 'idle' | 'generating' | 'done' | 'failed';
export type EbookProvider = 'gemini' | 'gpt' | 'claude';
export interface EbookVariant { status: EbookContentStatus; md?: string; }
export interface EbookTocChapter {
    no: number; title: string; summary: string;
    sources?: EbookSource[];
    sourceStatus?: EbookSourceStatus;
    contentMd?: string;
    contentStatus?: EbookContentStatus;
    contentVariants?: Partial<Record<EbookProvider, EbookVariant>>;
    finalProvider?: EbookProvider;
    collect?: boolean;  // 자료수집 체크(없으면 true로 간주)
}
export interface EbookImageSlot {
    caption: string; chapterNo: number; prompt: string;
    imageUrl?: string; status: 'queued' | 'done' | 'failed'; retryCount?: number;
}
export interface EbookProject {
    id: number; topic: string; title: string | null; author?: string | null; status: string;
    coverUrl?: string | null; // 표지 이미지 URL(사용자 업로드)
    docxUrl?: string | null; // 생성된 .docx URL(재방문 시 바로 다운로드, 본문/표지/판형 변경 시 null)
    scheduledHour?: number | null; // 탭4 자료 일괄수집 예약 시각(KST 1~5)
    pageSize?: string | null; // 책 판형: sinkuk(신국판) | a5 | gukbae
    imageSlotsJson?: string | null; // 그림 자리 AI생성 이미지 JSON(원본 그대로, 파싱은 프론트에서)
    coverCandidatesJson?: string | null; // AI 표지 후보 2안 JSON [{engine,url}] — 창을 닫았다 와도 고를 수 있게 서버가 저장
    charged?: boolean; // 문서(.docx) 완성 차감 여부 — true라야 그림 프롬프트·이미지 생성 기능 사용 가능
    createdAt: string; updatedAt: string; chapters?: EbookTocChapter[];
}
export const ebookApi = {
    create: (topic: string) =>
        post<{ project: EbookProject }>('/ebook', { topic }),
    list: () =>
        get<EbookProject[]>('/ebook'),
    get: (id: number) =>
        get<EbookProject>(`/ebook/${id}`),
    updateToc: (id: number, title: string, chapters: EbookTocChapter[], author?: string | null, topic?: string) =>
        put<EbookProject>(`/ebook/${id}/toc`, { title, chapters, ...(author !== undefined ? { author } : {}), ...(topic !== undefined ? { topic } : {}) }),
    // 현재(수정된) 제목을 보고 목차를 다시 생성 — 제목은 그대로 두고 chapters만 새로 받는다.
    regenerateToc: (id: number) =>
        post<EbookProject>(`/ebook/${id}/regenerate-toc`, {}),
    remove: (id: number) =>
        del<{ deleted: boolean }>(`/ebook/${id}`),
    collectSources: (id: number, no: number) =>
        post<{ no: number; sourceStatus: EbookSourceStatus; sources: EbookSource[] }>(`/ebook/${id}/chapters/${no}/sources`, {}),
    // ※ 즉시 본문생성/다시쓰기/일괄생성(generateContent·rewriteChapter·generateDraft) 제거 — 본문은 야간 예약 배치에서만 생성.
    //    백엔드 라우트는 409(예약 안내)를 반환하므로 프론트에서 호출하지 않는다.
    // 최종본 직접 수정 저장(편집기에서 사용 — 유지)
    saveContentMd: (id: number, no: number, contentMd: string) =>
        put<{ no: number; contentMd: string }>(`/ebook/${id}/chapters/${no}/content-md`, { contentMd }),
    // 이미지 프롬프트 뽑기 — 본문 [그림:설명] 자리별 ChatGPT용 프롬프트 생성(일괄 과금, 문서완성 후에만 가능)
    imagePrompts: (id: number) =>
        post<{ prompts: { no: number; chapterNo: number; chapterTitle: string; caption: string; prompt: string }[]; message?: string; cost?: number }>(`/ebook/${id}/image-prompts`, {}),
    // 그림 이미지 N개 생성 시 예상 차감액(장당 단가 × N) 견적
    imageCost: (id: number, count: number) =>
        get<{ perImageCost: number; count: number; cost: number }>(`/ebook/${id}/image-cost?count=${count}`),
    // 그림 이미지 여러 개를 한 번에 큐 등록(장당 과금, 전체 선차감). 실제 생성은 서버 백그라운드 타이머가 처리.
    queueImages: (id: number, items: { caption: string; chapterNo: number; prompt: string }[]) =>
        post<{ queued: number; cost: number }>(`/ebook/${id}/generate-images-queue`, { items }),
    // 큐 진행 상태 폴링 — 상태별 개수 + 완료된 자리의 imageUrl
    imageQueueStatus: (id: number) =>
        get<{ counts: { queued: number; done: number; failed: number }; slots: Record<string, { status: string; imageUrl?: string }> }>(`/ebook/${id}/image-queue-status`),
    // docx 만들기 전 예상 차감액(글자수 기준) 견적
    docxEstimate: (id: number) =>
        get<{ totalChars: number; units: number; cost: number; alreadyCharged: boolean }>(`/ebook/${id}/docx-estimate`),
    // AI 표지 생성 — 제목+목차 참고. 견적 → 등록(큐) → 폴링 3단계.
    // GPT high가 ~95초 걸려 동기 응답은 Vercel 프록시 타임아웃(502)에 걸린다(2026-07-25 실사용
    // 재현) — 그림 자리 생성과 같은 방식으로 등록만 즉시 응답(202)하고 백그라운드 큐가 처리,
    // 프론트는 coverQueueStatus로 폴링한다. 고른 쪽을 saveCoverUrl로 확정한다.
    coverCost: (id: number) =>
        get<{ cost: number }>(`/ebook/${id}/cover-cost`),
    generateCover: (id: number) =>
        post<{ queued: true; cost: number }>(`/ebook/${id}/generate-cover`, {}),
    coverQueueStatus: (id: number) =>
        get<{ counts: { queued: number; done: number; failed: number }; candidates: { engine: 'gemini' | 'gpt'; url: string }[] }>(`/ebook/${id}/cover-queue-status`),
    // 탭3: 표지 이미지 업로드 — signed-url 발급 → GCS PUT → coverUrl 저장
    coverUploadUrl: (id: number, mimeType: string) =>
        post<{ signedUrl: string; publicUrl: string }>(`/ebook/${id}/cover-url`, { mimeType }),
    // extractTitle=true면 AI 표지 후보 선택 시 — 이미지 속 카피를 비전으로 읽어 extractedTitle로
    // 함께 받는다. title을 자동으로 덮어쓰지 않으며, 프론트가 draft로만 채워 사용자 확인을 거친다.
    saveCoverUrl: (id: number, coverUrl: string | null, extractTitle?: boolean) =>
        put<{ coverUrl: string | null; extractedTitle?: string | null }>(`/ebook/${id}/cover`, { coverUrl, ...(extractTitle ? { extractTitle: true } : {}) }),
    // 표지 파일을 직접 올리고 coverUrl까지 저장하는 통합 헬퍼
    uploadCover: async (id: number, file: File): Promise<string> => {
        const { signedUrl, publicUrl } = await post<{ signedUrl: string; publicUrl: string }>(`/ebook/${id}/cover-url`, { mimeType: file.type });
        const putRes = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!putRes.ok) throw new Error('표지 업로드에 실패했어요.');
        await put<{ coverUrl: string | null }>(`/ebook/${id}/cover`, { coverUrl: publicUrl });
        return publicUrl;
    },
    // 탭3: 전체 본문 → 북크크 양식 .docx(표지 있으면 첫 페이지 삽입) → GCS URL (서버가 docxUrl도 저장)
    generateDocx: (id: number) =>
        post<{ url: string; bytes: number }>(`/ebook/${id}/docx`, {}),
    // ※ PDF 기능 제거됨(docx만 사용)
    // 시간대별 야간 생성 예약 현황(품절 여부). 프론트가 품절 슬롯 비활성화에 사용.
    getSlots: () =>
        get<{ slots: EbookSlot[]; capacity: number; allSoldOut: boolean }>(`/ebook/slots`),
    // 예약 시각 저장(KST 1~5시, null=해제). 슬롯이 차면 409(품절).
    setSchedule: (id: number, hour: number | null) =>
        put<{ scheduledHour: number | null }>(`/ebook/${id}/schedule`, { hour }),
    // 탭1: 책 판형 저장(sinkuk|a5|gukbae)
    setPageSize: (id: number, pageSize: string) =>
        put<{ pageSize: string }>(`/ebook/${id}/page-size`, { pageSize }),
    // ※ 즉시 자료수집(collectAll) 제거 — 자료수집·본문 모두 새벽 크론에서 처리. 체크(setCollectFlags)=등록만.
    // 챕터별 새벽 생성 등록 체크 상태 저장 ({ "1": true, "2": false, ... })
    setCollectFlags: (id: number, flags: Record<string, boolean>) =>
        put<{ chapters: EbookTocChapter[] }>(`/ebook/${id}/collect-flags`, { flags }),
};

export interface EbookSlot { hour: number; used: number; capacity: number; soldOut: boolean; }

// ── 웹툰 연재 (향기 페르소나 등) ──
export interface WebtoonEpisode { id: number; episodeNo: number; title: string; coverUrl?: string | null; updatedAt?: string; }
export interface WebtoonDetail { id: number; episodeNo: number; title: string; cuts: string[]; }
export interface WebtoonAdminItem extends WebtoonEpisode { personaId: string; cuts: string[]; cutsJson?: string; isVisible: boolean; }

export const webtoonApi = {
    // 사용자: 회차 목록 / 상세
    list: (personaId: string) =>
        get<WebtoonEpisode[]>(`/webtoon?personaId=${encodeURIComponent(personaId)}`),
    get: (id: number) =>
        get<WebtoonDetail>(`/webtoon/${id}`),
    // 어드민: 전체 목록(숨김 포함) / 생성 / 수정 / 삭제
    adminList: (personaId: string) =>
        get<WebtoonAdminItem[]>(`/webtoon/admin?personaId=${encodeURIComponent(personaId)}`),
    create: (personaId: string, episodeNo: number, title: string) =>
        post<WebtoonAdminItem>(`/webtoon`, { personaId, episodeNo, title }),
    update: (id: number, data: { title?: string; episodeNo?: number; cuts?: string[]; coverUrl?: string | null; isVisible?: boolean }) =>
        put<WebtoonAdminItem>(`/webtoon/${id}`, data),
    remove: (id: number) =>
        del<{ deleted: boolean }>(`/webtoon/${id}`),
    // 어드민: 컷 이미지 업로드(signed-url → GCS PUT → publicUrl)
    uploadCut: async (id: number, file: File): Promise<string> => {
        const { signedUrl, publicUrl } = await post<{ signedUrl: string; publicUrl: string }>(`/webtoon/${id}/cut-url`, { mimeType: file.type });
        const r = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!r.ok) throw new Error('컷 업로드에 실패했어요.');
        return publicUrl;
    },
};

// ── 메인 캐러셀 카드(HeroCard) ──
export interface HeroCard { id: number; imageUrl: string; linkType: 'persona' | 'feature'; linkTarget: string; title?: string | null; }
export interface HeroCardAdmin extends HeroCard { sortOrder: number; isVisible: boolean; createdAt: string; }

export const heroCardApi = {
    list: () => get<HeroCard[]>('/hero-cards'),
    adminList: () => get<HeroCardAdmin[]>('/hero-cards/admin'),
    create: (data: { linkType: string; linkTarget: string; title?: string }) =>
        post<HeroCardAdmin>('/hero-cards', data),
    update: (id: number, data: Partial<{ imageUrl: string; linkType: string; linkTarget: string; title: string | null; sortOrder: number; isVisible: boolean }>) =>
        put<HeroCardAdmin>(`/hero-cards/${id}`, data),
    remove: (id: number) => del<{ deleted: boolean }>(`/hero-cards/${id}`),
    reorder: (ids: number[]) => post<{ ok: boolean }>('/hero-cards/reorder', { ids }),
    // 이미지 업로드: signed-url → GCS PUT → imageUrl 저장
    uploadImage: async (id: number, file: File): Promise<string> => {
        const { signedUrl, publicUrl } = await post<{ signedUrl: string; publicUrl: string }>(`/hero-cards/${id}/image-url`, { mimeType: file.type });
        const r = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!r.ok) throw new Error('카드 이미지 업로드에 실패했어요.');
        await put<HeroCardAdmin>(`/hero-cards/${id}`, { imageUrl: publicUrl });
        return publicUrl;
    },
};

// 📸 학습자료 스크린샷 — 사장이 실제 화면(깃허브·버셀)을 캡처해 강의 본문의 고정 자리에 채운다.
// 자리 목록은 서버(SHOT_SLOTS)가 정본. 업로드는 hero-cards와 같은 signed-url 방식.
export interface LearnShotSlot { key: string; label: string; imageUrl: string; updatedAt: string | null; }

export const learnShotApi = {
    adminList: (course: string) => get<LearnShotSlot[]>(`/learn/shots/admin?course=${encodeURIComponent(course)}`),
    save: (course: string, slotKey: string, imageUrl: string) =>
        put<{ ok: boolean }>('/learn/shots', { course, slotKey, imageUrl }),
    upload: async (course: string, slotKey: string, file: File): Promise<string> => {
        const { signedUrl, publicUrl } = await post<{ signedUrl: string; publicUrl: string }>(
            '/learn/shots/upload-url', { course, slotKey, mimeType: file.type });
        const r = await fetch(signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!r.ok) throw new Error('이미지 업로드에 실패했어요.');
        await put<{ ok: boolean }>('/learn/shots', { course, slotKey, imageUrl: publicUrl });
        return publicUrl;
    },
};

export const quickMenuApi = {
    generate: (personaId: string, prompt: string) =>
        post<{ result: string; newBalance: number; paidBalance: number; bonusBalance: number }>('/quick-menu-result', { personaId, prompt }),
    activate: (cost: number, description: string) =>
        post<{ newBalance: number; paidBalance: number; bonusBalance: number }>('/quick-menu-activate', { cost, description }),
};

// Announcements
export const announcementApi = {
    getAll: (all?: boolean) =>
        get<import('../types').Announcement[]>(`/announcements${all ? '?all=true' : ''}`),

    create: (data: { title: string; content: string; category: string; isPinned?: boolean; isVisible?: boolean }) =>
        post<import('../types').Announcement>('/announcements', data),

    update: (id: number, data: Partial<{ title: string; content: string; category: string; isPinned: boolean; isVisible: boolean }>) =>
        put<import('../types').Announcement>(`/announcements/${id}`, data),

    delete: (id: number) =>
        del<{ ok: boolean }>(`/announcements/${id}`),
};

// 유튜브 쇼츠 승인 큐 (어드민 — 서버2 shorts-factory 브릿지)
export interface ShortsQueueItem {
    id: string;
    topic: string;
    video: string;
    title: string;
    description: string;
    hashtags: string[];
    createdAt: string;
    decision?: 'approved' | 'rejected';
    resolvedAt?: string;
    youtubeVideoId?: string;
    youtubeUrl?: string;
}
export interface ShortsStatus {
    agentApi: boolean;
    userShortsWorkerLog: { exists: boolean; ageSeconds: number | null };
    dailyShortCronLog: { exists: boolean; ageSeconds: number | null };
    userShortsQueue: { ok: boolean; waiting?: Record<string, number>; completed?: Record<string, number>; error?: string };
}
export interface CodexShortsRemoteJob {
    jobId: string;
    title: string;
    status: 'draft' | 'awaiting_assets' | 'ready' | 'rendering' | 'completed' | 'failed';
    error?: string | null;
    duration?: number | null;
    assets: { segment: number; image: boolean; audio: boolean }[];
    outputReady: boolean;
    updatedAt: string;
}
export interface AiPromptVariable {
    key: string;
    label: string;
    type: 'text' | 'select';
    required?: boolean;
    default?: string;
    maxLength?: number;
    options?: { value: string; label: string }[];
}
export interface AiPromptTemplate {
    id: string;
    name: string;
    category: 'portrait' | 'product' | 'space' | 'food' | 'content' | 'illustration';
    description: string;
    workflow: 'sdxl_t2i' | 'zimage_t2i';
    enabled: boolean;
    model: string;
    positiveTemplate: string;
    negativeTemplate: string;
    variables: AiPromptVariable[];
    render: { width: number; height: number; steps: number; cfg: number; upscale: boolean };
}
// 🎨 AI 스튜디오(서버3 GPU) — 2026-08-05.
// ★서버가 꺼져 있어도 생성 요청이 가능하다 — 큐에 쌓이면 디스패처가 켠다.
export const aiStudioApi = {
    getPromptTemplates: () =>
        get<{ ok: boolean; templates: AiPromptTemplate[] }>('/admin/ai-studio/prompt-templates'),
    compilePromptTemplate: (id: string, variables: Record<string, string>) =>
        post<{
            ok: boolean; templateId: string; workflow: 'sdxl_t2i' | 'zimage_t2i'; enabled: boolean;
            model: string; render: AiPromptTemplate['render']; variables: Record<string, string>;
            positive: string; negative: string;
        }>(`/admin/ai-studio/prompt-templates/${encodeURIComponent(id)}/compile`, { variables }),
    getStatus: () =>
        get<{
            server: { ok: boolean; status: string; detail: string };
            // 디스크 — ★서버가 켜져 있을 때만 온다(꺼져 있으면 null)
            disk: {
                totalMb: number; usedMb: number; freeMb: number; usedPct: number;
                modelsMb: number; outputsMb: number;
            } | null;
            queue: { pending: number; processing: number; completed: number; failed: number };
            today: { jobs: number; busySec: number };
            krwPerHour: number;
        }>('/admin/ai-studio/status'),
    power: (action: 'start' | 'stop') =>
        post<{ ok: boolean; status: string; detail: string }>('/admin/ai-studio/power', { action }),
    // 일자별 사용량·금액(2026-08-08) — ★금액은 **작업 처리시간** 기준이라
    //   실제 청구액보다 작다(서버가 켜져 있어도 노는 시간은 안 잡힘).
    //   "어느 날 많이 썼나"를 보는 용도.
    getUsage: (days = 14) =>
        get<{ krwPerHour: number; days: { day: string; jobs: number; sec: number; krw: number }[] }>(
            `/admin/ai-studio/usage?days=${days}`),
    // 작업 기록 삭제(2026-08-08) — ★DB 기록만 지운다.
    //   서버3의 이미지 파일은 [AI 보관함] 탭에서 따로 지운다.
    deleteJob: (id: number) =>
        del<{ ok: boolean; id: number }>(`/admin/ai-studio/job/${id}`),
    // models=그림 모델(체크포인트), upscalers=확대 후보정 모델
    getModels: () =>
        get<{ available: boolean; reason?: string; models: string[]; upscalers?: string[] }>(
            '/admin/ai-studio/models'),
    // 모델 관리(2차, 2026-08-05) — ★임의 URL 은 못 넣는다. 서버가 가진
    //   화이트리스트(catalog)의 key 만 내려받을 수 있다.
    // kind: 'checkpoints'(그림 모델) | 'upscale_models'(확대 후보정)
    getCatalog: () =>
        get<{ ok: boolean; catalog: { key: string; file: string; kind?: string }[] }>('/admin/ai-studio/catalog'),
    addModel: (key: string) =>
        post<{ ok: boolean; status: string; detail: string }>('/admin/ai-studio/model', { key }),
    modelProgress: () =>
        get<{ ok: boolean; status: string; detail: string }>('/admin/ai-studio/model-progress'),
    deleteModel: (file: string) =>
        del<{ ok: boolean; status: string; detail: string }>(
            `/admin/ai-studio/model/${encodeURIComponent(file)}`),
    // img2img 원본 올리기(2026-08-05) — base64 를 보내면 서버3에 저장하고 파일명을 준다.
    // ★t2i 와 달리 **서버가 켜져 있어야** 한다(원본을 둘 곳이 서버3 디스크라서).
    uploadImage: (base64: string) =>
        post<{ ok: boolean; file: string }>('/admin/ai-studio/upload', { image: base64 }),
    generate: (payload: {
        prompt: string; negative?: string; model?: string;
        promptMode?: 'composed' | 'raw';
        workflow?: 'sdxl_t2i' | 'sdxl_img2img' | 'zimage_t2i';
        width?: number; height?: number; steps?: number; cfg?: number; count?: number;
        // 업스케일(선택) — 확대 후보정 모델 파일명과 배율
        upscale?: string; upscaleScale?: number;
        // img2img(선택) — uploadImage 가 준 파일명과 디노이징 강도(원본을 얼마나 지울지)
        initImage?: string; denoise?: number;
        // 스타일 참조(선택, IP-Adapter) — ★img2img 와 다른 기능이다.
        //   img2img=올린 사진을 고친다 / 스타일참조=견본의 화풍만 빌려 새로 그린다.
        //   styleMode: 'style transfer'(화풍만) | 'standard'(인물까지) | 'prompt is more important'
        styleImage?: string; styleWeight?: number; styleMode?: string;
    }) => post<{ ok: boolean; ids: number[]; queued: number }>('/admin/ai-studio/generate', payload),
    animate: (sourceFile: string, motion: 'slow_push_in' | 'slow_pull_out' | 'pan_left' | 'pan_right') =>
        post<{ ok: boolean; id: number; queued: number }>('/admin/ai-studio/animate', {
            sourceFile, motion,
        }),
    getJobs: (limit = 20) =>
        get<{
            jobs: {
                id: number; type: string; workflow: string | null;
                status: string; error: string | null; prompt: string;
                model: string; size: string; files: string[]; elapsedSec: number | null;
                videoFile: string | null;
                video: { durationSec: number; width: number; height: number; codec: string; bytes: number } | null;
                createdAt: string; finishedAt: string | null;
            }[];
        }>(`/admin/ai-studio/jobs?limit=${limit}`),
    // 보관함(2026-08-05) — ★/jobs 와 다르다. /jobs 는 DB(GpuJob)를 보므로 큐를 거치지
    //   않고 만든 이미지는 안 뜨고, 최근 N건만 가져온다. 보관함은 **서버3의 실제 파일**이
    //   정본이라 전부 보인다.
    getGallery: () =>
        get<{ ok: boolean; reason?: string; files: { file: string; kb: number; mtime: number }[] }>(
            '/admin/ai-studio/gallery'),
    // 프롬프트 다듬기(2026-08-05) — 한글/거친 문장 → 영어 이미지 프롬프트.
    // ★'번역'과 '고급화'를 나누지 않았다 — 어차피 둘 다 LLM 이고, 직역은 프롬프트로
    //   잘 안 먹는다. 버튼이 둘이면 어느 걸 눌러야 하는지도 헷갈린다.
    // ★mode='negative' 면 **빼고 싶은 것**을 다듬는다(2026-08-08) — 프롬프트와 의미가
    //   정반대라 서버가 다른 지시문을 쓴다("손가락 이상하지 않게" → "deformed hands").
    refinePrompt: (text: string, kind?: string, mode?: 'positive' | 'negative') =>
        post<{ ok: boolean; original: string; refined: string }>(
            '/admin/ai-studio/refine-prompt', { text, kind, mode }),
    // 썸네일 일괄(2026-08-05) — ★한 장씩 원본을 받으면 몹시 느리다. 서버1→서버2→서버3
    //   2단 SSH 라 장당 1.26초에 6~8MB 원본이 그대로 온다(28장이면 35초).
    //   서버3에서 320px JPEG 로 줄여 **한 번에** 받는다(실측 1/575, 전체 약 4초·471KB).
    getThumbs: () =>
        get<{ ok: boolean; reason?: string; thumbs: Record<string, string> }>('/admin/ai-studio/thumbs'),
    // 여러 장 한 번에 삭제 — 한 장씩만 되면 수십 장 정리할 때 못 쓴다
    deleteImages: (files: string[]) =>
        del<{ ok: boolean; deleted: number; failed: number; failedFiles: string[] }>(
            '/admin/ai-studio/gallery', { files }),
    // ★<img src>로 직접 못 쓴다 — 인증이 Authorization 헤더 방식이라 img 태그는
    //   헤더를 못 붙여 401 이 난다. fetch 로 받아 blob URL 을 만들어 쓴다.
    //   (서버3을 인터넷에 노출하지 않고 이미지를 보여주기 위한 중계 경로)
    fetchImage: async (file: string): Promise<string> => {
        const res = await fetch(`/api/admin/ai-studio/image/${encodeURIComponent(file)}`, {
            headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error(`이미지 로드 실패 (${res.status})`);
        return URL.createObjectURL(await res.blob());
    },
    fetchVideo: async (file: string): Promise<string> => {
        const res = await fetch(`/api/admin/ai-studio/video/${encodeURIComponent(file)}`, {
            headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error(`영상 로드 실패 (${res.status})`);
        return URL.createObjectURL(await res.blob());
    },
};

export const shortsApi = {
    getStatus: () => get<ShortsStatus>('/admin/shorts/status'),

    // 🎂 생일 축하카드 배경 관리(2026-08-05) — 목록/미리보기/AI자동추가/저장/삭제.
    // ★미리보기 이미지는 저장하지 않고 base64 로 그때만 받는다(실제 영상은 매번 새로 생성).
    getCardBgList: () =>
        get<{ items: { key: string; label: string; prompt: string; scrim: boolean }[] }>('/admin/shorts/card-bg'),
    previewCardBg: (key: string) =>
        post<{ key: string; image: string }>('/admin/shorts/card-bg/preview', { key }),
    generateCardBg: () =>
        post<{
            candidate: { key: string; label: string; prompt: string; scrim: boolean };
            image: string | null; note?: string | null;
        }>('/admin/shorts/card-bg/generate', {}),
    saveCardBg: (payload: { key: string; label: string; prompt: string; scrim: boolean }) =>
        post<{ ok: boolean; count: number }>('/admin/shorts/card-bg/save', payload),
    deleteCardBg: (key: string) =>
        del<{ ok: boolean; count: number }>(`/admin/shorts/card-bg/${encodeURIComponent(key)}`),

    getQueue: () =>
        get<{ pending: ShortsQueueItem[]; approved: ShortsQueueItem[]; rejected: ShortsQueueItem[] }>('/admin/shorts/queue'),

    getTopics: () =>
        get<{ topics: string[] }>('/admin/shorts/topics'),

    generate: (topic: string) =>
        post<{ started: boolean; topic: string }>('/admin/shorts/generate', { topic }),

    resolve: (id: string, decision: 'approved' | 'rejected') =>
        post<{ result: string }>('/admin/shorts/resolve', { id, decision }),

    delete: (id: string, section: 'approved' | 'rejected') =>
        post<{ result: string }>('/admin/shorts/delete', { id, section }),

    videoUrl: (id: string) => `${BASE}/admin/shorts/video/${id}`,

    // Codex 보조형 쇼츠 공장 — 서버1 ADMIN 인증 → 서버2 agent-api → v2 렌더러.
    saveCodexJob: (job: object) =>
        post<CodexShortsRemoteJob>('/admin/shorts/codex/jobs', job),
    getCodexJob: (id: string) =>
        get<CodexShortsRemoteJob>(`/admin/shorts/codex/jobs/${encodeURIComponent(id)}`),
    listCodexJobs: () =>
        get<{ jobs: CodexShortsRemoteJob[] }>('/admin/shorts/codex/jobs'),
    uploadCodexAsset: async (id: string, segment: number, kind: 'image' | 'audio', blob: Blob) => {
        const res = await fetch(
            `${BASE}/admin/shorts/codex/jobs/${encodeURIComponent(id)}/assets/${segment}/${kind}`,
            { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream', ...authHeaders() }, body: blob },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `파일 업로드 실패 (${res.status})`);
        return data as { ok: boolean; segment: number; kind: string; bytes: number; path: string };
    },
    renderCodexJob: (id: string) =>
        post<{ started: boolean; jobId: string }>(`/admin/shorts/codex/jobs/${encodeURIComponent(id)}/render`, {}),
    sendCodexTelegram: (id: string) =>
        post<{ ok: boolean; jobId: string }>(`/admin/shorts/codex/jobs/${encodeURIComponent(id)}/telegram`, {}),
    fetchCodexVideo: async (id: string): Promise<string> => {
        const res = await fetch(`${BASE}/admin/shorts/codex/jobs/${encodeURIComponent(id)}/video`, {
            headers: { ...authHeaders() },
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `영상 조회 실패 (${res.status})`);
        }
        return URL.createObjectURL(await res.blob());
    },
    synthesizeCodexSpeech: async (text: string, voiceName = 'ko-KR-Chirp3-HD-Leda'): Promise<Blob> => {
        const res = await fetch(`${BASE}/admin/shorts/codex/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ text, voiceName }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `음성 생성 실패 (${res.status})`);
        }
        return res.blob();
    },

    // 내레이션 음성(2026-08-02) — 어드민이 직접 들어보고 고른다.
    // category(2026-08-03): 카테고리별 지정 — 생략(또는 'default')이면 언어 전역 설정.
    getVoices: (lang = 'ko', category = 'default') =>
        get<{ lang: string; category: string; current: string | null; fallback: string | null; candidates: { name: string; gender: 'F' | 'M' }[] }>(
            `/admin/shorts/voices?lang=${lang}&category=${category}`),
    // 미리듣기는 mp3 바이너리라 get<T>(JSON 파서)를 못 쓴다 — fetch로 직접 받아 Blob URL을 만든다.
    previewVoice: async (voiceName: string, text?: string): Promise<string> => {
        const res = await fetch(`${BASE}/admin/shorts/voice-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
            },
            body: JSON.stringify({ voiceName, ...(text ? { text } : {}) }),
        });
        if (!res.ok) {
            const msg = await res.json().catch(() => ({}));
            throw new Error(msg.error || `미리듣기 실패 (${res.status})`);
        }
        return URL.createObjectURL(await res.blob());
    },
};

// 온보딩 미션 보상 결과(즐겨찾기 저장 응답에 포함)
export interface MissionResult {
    awarded: boolean;       // 이번에 새로 지급됐는지
    amount: number;
    balanceAfter?: number;
}
export interface FavoriteSaveResult {
    ok: boolean;
    mission: MissionResult | null;
}

// User Profile
export const userProfileApi = {
    getBirthInfo: () =>
        get<{ birthInfoJson: string | null }>('/user/birth-info'),

    saveBirthInfo: (birthInfoJson: string) =>
        put<{ ok: boolean }>('/user/birth-info', { birthInfoJson }),

    // 즐겨찾기(자주가는 메뉴) — 기능 키 문자열 배열의 JSON
    getFavorites: () =>
        get<{ favoritesJson: string | null }>('/user/favorites'),

    saveFavorites: (favoritesJson: string) =>
        put<FavoriteSaveResult>('/user/favorites', { favoritesJson }),

    // 즐겨찾기 페르소나 — 페르소나 id 배열의 JSON
    getFavoritePersonas: () =>
        get<{ favoritePersonasJson: string | null }>('/user/favorite-personas'),

    saveFavoritePersonas: (favoritePersonasJson: string) =>
        put<FavoriteSaveResult>('/user/favorite-personas', { favoritePersonasJson }),

    // 본인 회원 탈퇴(하드 삭제)
    deleteAccount: () =>
        del<{ deleted: boolean }>('/user'),
};

// Board
export const boardApi = {
    getList: (personaId: string) =>
        get<{ id: number; title: string; createdAt: string; userId: number; user: { username?: string; email: string }; _count: { replies: number } }[]>(`/board?personaId=${encodeURIComponent(personaId)}`),

    getPost: (id: number) =>
        get<import('../types').BoardPost>(`/board/${id}`),

    create: (title: string, content: string, personaId: string) =>
        post<{ id: number }>('/board', { title, content, personaId }),

    update: (id: number, title: string, content: string) =>
        put<{ ok: boolean }>(`/board/${id}`, { title, content }),

    delete: (id: number) =>
        del<{ ok: boolean }>(`/board/${id}`),

    addReply: (postId: number, content: string) =>
        post<{ id: number }>(`/board/${postId}/reply`, { content }),

    deleteReply: (postId: number, replyId: number) =>
        del<{ ok: boolean }>(`/board/${postId}/reply/${replyId}`),
};

// Partner Board
export const partnerBoardApi = {
    getList: () =>
        get<{ id: number; title: string; createdAt: string; userId: number; user: { username?: string; email: string }; _count: { replies: number } }[]>('/partner-board'),

    getPost: (id: number) =>
        get<import('../types').PartnerPost>(`/partner-board/${id}`),

    create: (title: string, content: string, contact?: string) =>
        post<{ id: number }>('/partner-board', { title, content, contact }),

    update: (id: number, title: string, content: string) =>
        put<{ ok: boolean }>(`/partner-board/${id}`, { title, content }),

    delete: (id: number) =>
        del<{ ok: boolean }>(`/partner-board/${id}`),

    addReply: (postId: number, content: string) =>
        post<{ id: number }>(`/partner-board/${postId}/reply`, { content }),

    deleteReply: (postId: number, replyId: number) =>
        del<{ ok: boolean }>(`/partner-board/${postId}/reply/${replyId}`),
};

export interface AdminUser {
    id: number;
    email: string | null;
    phone: string | null;
    username: string | null;
    role: string;
    /** 가입 경로. `'guest'` = 레퍼럴 링크로 자동 발급된 체험계정(7일 뒤 크론이 삭제).
     *  ★옛 배포와 섞일 수 있어 optional 이다 — 없으면 정회원으로 취급한다. */
    provider?: string;
    paidPoints: number;
    bonusPoints: number;
    createdAt: string;
    /** 마지막 로그인 시각(2026-07-28 신설). 도입 이전 로그인은 기록이 없어 null. */
    lastLoginAt: string | null;
    sessionCount: number;
}

export type PartnerApplicationStatus = 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED';
export interface PartnerApplicationAdminRow {
    id: string;
    accountId: string;
    loginId: string;
    name: string;
    phone: string;
    email: string;
    referrer: string | null;
    status: PartnerApplicationStatus;
    managerMemo: string | null;
    contactedAt: string | null;
    approvedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
    approvalRole: 'PARTNER' | 'APPROVER' | 'ADMIN';
    referrerLoginId: string | null;
}

export interface UserTransactionRow {
    id: number;
    amount: number;
    type: string;
    description: string | null;
    balanceAfter: number;
    createdAt: string;
    personaName: string | null;
}

export interface PersonaStatRow {
    personaId: string;
    persona?: { id: string; name: string; imageUrl: string | null };
    chat: number;
    menu: number;
    balloon: number;
    total: number;
    xp: number;
    firstChatAt: string | null;
}

export interface PointsStats {
    byPersona: PersonaStatRow[];
    received: { charge: number; signup: number; levelup: number; admin: number };
}

export interface PointTx {
    id: number;
    amount: number;
    type: string;
    description: string | null;
    balanceAfter: number;
    createdAt: string;
    persona?: { id: string; name: string } | null;
}
export const pointsApi = {
    getStats: () => get<PointsStats>('/points/stats'),
    // 내 포인트 잔액 + 최근 거래내역(시간순 50건)
    getHistory: () => get<{ paidPoints: number; bonusPoints: number; points: number; transactions: PointTx[] }>('/points'),
};

/**
 * 인버스 ETF 1호가 스캘핑(가상매매 전용) 상태 스냅샷.
 * 서버(api/inverse-trader/engine.ts 의 StatusSnapshot)를 JSON 으로 받은 형태 —
 * Date 는 전부 ISO 문자열로 온다.
 */
/** 개발AI 콘솔 — 디자인 시안 (design_preview.py 대기 목록) */
export interface DevDesignRow {
    projectName: string;
    slug: string | null;
    description: string;
    /** waiting | approved */
    status: string;
    selectedVersion: string | null;
    createdAt: string | null;
    /** exists=false 면 시안 파일이 정리돼 미리보기가 404 다(메인 페이지로 폴백된다) */
    versions: { version: string; label: string; url: string; exists?: boolean }[];
}

/** 개발AI 콘솔 — 프로젝트 목록 행 (2026-08-20) */
/** 승인 대기 1건 — 파이프라인이 계획을 내고 결재를 기다리는 상태. */
export interface DevApprovalRow {
    /** 예: PLAN-APPROVAL, DEV-001 */
    taskId: string;
    /** 무엇을 승인하는지(계획 전문) */
    description: string;
    command: string;
    requestedAt: string | null;
    timeoutSec: number;
    /** 남은 시간(초). 0이면 곧 자동 거부된다 */
    remainSec: number | null;
}

export interface DevProjectRow {
    id: string;
    title: string;
    /** draft | queued | planned | awaiting_approval | running | review | done | failed | canceled */
    status: string;
    herdrProjectId: string | null;
    workdir: string;
    /** 허드 메이커-체커(Reviewer 검증) 사용 여부 */
    useReview?: boolean;
    latestVersion: number;
    counts: { versions: number; files: number; events: number };
    createdAt: string;
    updatedAt: string;
}

/** 명세 버전 — 비포/애프터의 실체. 수정할 때마다 새 행이 쌓인다. */
export interface DevProjectVersionRow {
    id: number;
    version: number;
    features: string;
    specBody: string;
    /** JSON 배열 문자열 */
    refUrls: string;
    /** 홈페이지 요구사항(JSON 문자열) — devaiBrief.ts 의 BRIEF_FIELDS 참고 */
    brief?: string;
    note: string | null;
    createdAt: string;
}

/** 첨부 파일 — kind: spec | image(참조 이미지) | design | result */
export interface DevProjectFileRow {
    id: number;
    kind: string;
    fileName: string;
    /** 브라우저에서 접근할 경로. 예: /sites/devai/<id>/img/ref-....png */
    url: string;
    size: number;
    mimeType?: string | null;
    createdAt?: string;
}

export interface DevProjectDetail extends Omit<DevProjectRow, 'latestVersion' | 'counts'> {
    versions: DevProjectVersionRow[];
    files?: DevProjectFileRow[];
    events?: { id: number; actor: string; phase: string; message: string; meta: string | null; at: string }[];
    result?: { deployUrl: string | null; summary: string | null; commits: string; designSourceUrl: string | null } | null;
}

export interface DevProjectArtifacts {
    siteSlug: string | null;
    sourceAvailable: boolean;
    images: { name: string; url: string; size: number }[];
    imagesTruncated: boolean;
    spec: { text: string; truncated: boolean } | null;
    reviews: { fileName: string; date: string; text: string; truncated: boolean }[];
}

export interface InverseTraderSnapshot {
    ok: boolean;
    tradingMode: 'SIMULATION';
    config: {
        id?: number;
        symbol: string;
        symbolName: string;
        defaultQty: number;
        closeBufferMin: number;
        maxPositionQty: number;
        dailyLossLimit: number;
        tradingMode: string;
        enabled: boolean;
    };
    session: {
        id: string;
        status: string;
        startedAt: string | null;
        endedAt: string | null;
        lastError: string | null;
        isLive: boolean;
    } | null;
    engine: {
        hasRuntime: boolean;
        tickCount: number;
        lastTickAt: string | null;
        intervalMs: number;
        settlementRunning: boolean;
        settlementDone: boolean;
        inSettlementWindow: boolean;
        kstMinutes: number;
        marketCloseMinutes: number;
        logs: string[];
    };
    quote: {
        symbol: string;
        bidPrice: number;
        bidQty: number;
        askPrice: number;
        askQty: number;
        lastPrice: number;
        ts: string;
        source: string;
    } | null;
    position: {
        symbol: string;
        qty: number;
        avgPrice: number;
        realizedPnl: number;
        unrealizedPnl: number;
        totalPnl: number;
    };
    orders: {
        id: number;
        side: 'BUY' | 'SELL';
        limitPrice: number;
        orderQty: number;
        filledQty: number;
        remainingQty: number;
        status: string;
        parentOrderId: number | null;
        createdAt: string;
    }[];
    fills: {
        id: number;
        orderId: number;
        side: 'BUY' | 'SELL';
        fillPrice: number;
        fillQty: number;
        filledAt: string;
    }[];
    today: {
        stat: { buyQty: number; sellQty: number; realizedPnl: number; fillCount: number; forceSettled: boolean; closingQty: number } | null;
        forceSettled: boolean | null;
        closingQty: number;
        /** ★true 면 화면 상단에 강제정산 실패 경고 배너를 띄운다 */
        settlementFailed: boolean;
        warning: string | null;
    };
}

export const adminApi = {
    getUsers: () =>
        get<AdminUser[]>('/admin/users'),

    // AI 아바타 — 사진 기반 2.5D 아바타 원장(Phase 2).
    // ★서버가 정본이다. 화면 상태를 믿지 말고 응답으로 갱신한다.
    listAiAvatarProjects: () =>
        get<{ ok: boolean; projects: AiAvatarProjectRow[] }>('/admin/ai-avatar/projects'),

    getAiAvatarProject: (id: string) =>
        get<{
            ok: boolean;
            project: AiAvatarProjectRow;
            assets: AiAvatarAssetRow[];
            jobs: AiAvatarJobRow[];
            publications: AiAvatarPublicationRow[];
        }>(`/admin/ai-avatar/projects/${encodeURIComponent(id)}`),

    createAiAvatarProject: (name: string, personaName: string) =>
        post<{ ok: boolean; project: AiAvatarProjectRow }>('/admin/ai-avatar/projects', { name, personaName }),

    enqueueAiAvatarJob: (projectId: string, kind: string) =>
        post<{ ok: boolean; job: AiAvatarJobRow; deduplicated?: boolean }>('/admin/ai-avatar/jobs', { projectId, kind }),

    getAiAvatarJob: (id: string) =>
        get<{ ok: boolean; job: AiAvatarJobRow }>(`/admin/ai-avatar/jobs/${encodeURIComponent(id)}`),

    cancelAiAvatarJob: (id: string) =>
        post<{ ok: boolean }>(`/admin/ai-avatar/jobs/${encodeURIComponent(id)}/cancel`, {}),

    publishAiAvatar: (projectId: string, target: string, assetId: string) =>
        post<{ ok: boolean; publicationId: string }>(
            `/admin/ai-avatar/projects/${encodeURIComponent(projectId)}/publish`, { target, assetId }),

    rollbackAiAvatar: (projectId: string, target: string) =>
        post<{ ok: boolean; publicationId: string }>(
            `/admin/ai-avatar/projects/${encodeURIComponent(projectId)}/rollback`, { target }),

    getPartnerApplications: (status = '') =>
        get<PartnerApplicationAdminRow[]>(`/admin/partner-applications${status ? `?status=${encodeURIComponent(status)}` : ''}`),

    updatePartnerApplication: (id: string, status: PartnerApplicationStatus, managerMemo?: string) =>
        patch<Partial<PartnerApplicationAdminRow>>(`/admin/partner-applications/${encodeURIComponent(id)}`, { status, ...(managerMemo === undefined ? {} : { managerMemo }) }),

    updatePartnerApprovalRole: (accountId: string, approvalRole: 'PARTNER' | 'APPROVER' | 'ADMIN') =>
        patch<{ id: string; approvalRole: string }>(`/admin/partner-accounts/${encodeURIComponent(accountId)}/approval-role`, { approvalRole }),

    grantPoints: (identifier: string, amount: number, description?: string) => {
        const isPhone = /^[0-9+\-\s]+$/.test(identifier.replace(/\s/g, ''));
        const body = isPhone ? { phone: identifier, amount, description } : { email: identifier, amount, description };
        return post<{ email: string; granted: number; newBalance: number }>('/points/admin-grant', body);
    },

    // ★위험 작업(돈·되돌리기 어려움)은 비밀번호 재확인 필수 — adminPassword 동반 (2026-07-29)
    bulkGrant: (amount: number, description?: string, adminPassword?: string) =>
        post<{ granted: number; userCount: number }>('/admin/bulk-grant', { amount, description, adminPassword }),

    changeRole: (userId: number, role: string) =>
        post<{ id: number; role: string }>('/admin/change-role', { userId, role }),

    deleteUser: (userId: number) =>
        del<{ deleted: boolean; id: number; identifier: string }>(`/admin/users/${userId}`),

    getUserTransactions: (userId: number) =>
        get<UserTransactionRow[]>(`/admin/users/${userId}/transactions`),

    getMonitorMetrics: () =>
        get<any>('/admin/monitor/metrics'),

    getServer2Metrics: () =>
        get<any>('/admin/monitor/server2/metrics'),

    getBalances: () =>
        get<{
            solapi: { balance?: number; lowBalanceThreshold?: number; error?: string } | null;
            openai: { monthToDateUsd?: number; error?: string } | null;
            // Google TTS는 '잔액'이 아니라 월 무료한도(100만자) 소진률로 본다(2026-08-08).
            googleTts: {
                monthChars?: number; freeTierChars?: number; usedPercent?: number;
                monthToDateUsd?: number; calls?: number; error?: string;
            } | null;
        }>('/admin/monitor/balances'),

    getLogDates: () =>
        get<{ dates: string[] }>('/admin/monitor/logs'),

    getLogs: (date: string, page = 1, level = '') =>
        get<{ lines: string[]; total: number; page: number; pageSize: number }>(
            `/admin/monitor/logs/${date}?page=${page}&level=${level}`
        ),

    getErrorSummary: () =>
        get<{ today: number; yesterday: number; recent: string[] }>('/admin/monitor/error-summary'),

    // 이아린 마케팅 산출물(리서치+초안) 조회 — 어드민 전용
    getMarketingAssets: () =>
        get<{ id: string; topic: string; channel: string; sourcesCount: number; createdAt: string }[]>('/marketing/assets'),
    getMarketingAsset: (id: string) =>
        get<{ id: string; topic: string; channel: string; report: string; draft: string; sourcesCount: number; filePath: string | null; createdAt: string }>(`/marketing/assets/${id}`),

    // AI 기능 스카우트 일자별 아이디어
    getAiFeatureIdeas: () =>
        get<{ id: number; ideaDate: string; content: string; createdAt: string }[]>('/admin/ai-feature-ideas'),
    // 직원 성장 엔진 (2026-07-17): 성장 요약·이력 + 직원 제안(아이디어 순환)
    getAgentGrowthSummary: () =>
        get<Record<string, { totalXp: number; level: number; nextLevelXp: number; levelBase: number; levelNext: number; xp7: number; xp30: number; kinds: Record<string, { n: number; xp: number }>; weekly: { week: string; xp: number }[] }>>('/admin/agent-growth/summary'),
    getAgentGrowthLogs: (agent: string, limit = 50) =>
        get<{ id: number; kind: string; topic: string; summary: string; wikiPath: string; xp: number; createdAt: string }[]>(`/admin/agent-growth/${agent}/logs?limit=${limit}`),
    getAgentIdeas: () =>
        get<{ id: number; agent: string; title: string; content: string; status: string; devRequestId: number | null; createdAt: string }[]>('/admin/agent-ideas'),
    convertAgentIdea: (id: number, extra?: string) =>
        post<{ ok: boolean; devRequestId: number }>(`/admin/agent-ideas/${id}/convert`, { extra }),
    archiveAgentIdea: (id: number) =>
        post<{ ok: boolean; updated: number }>(`/admin/agent-ideas/${id}/archive`, {}),
    // 레퍼럴 지표 (바이럴 측정, 2026-07-07)
    referralStats: () =>
        get<{
            funnel: { visits: number; visitCodes: number; visits7d: number; signups: number; signups7d: number; rewarded: number; codeHolders: number };
            top: { code: string; invited: number; rewarded: number; owner_name: string | null }[];
            dailyVisits: { day: string; n: number }[];
        }>('/admin/referral-stats'),
    // ⏰ 배치 작업 대시보드 (2026-07-29) — 서버 크론 + 사용자 신청 배치
    cronJobs: () =>
        get<{
            jobs: {
                id: string; server: string; name: string; desc: string; kind: string;
                cycle: string; when: string; log: string; cron: string;
                minute: string; hour: string; dom: string; mon: string; dow: string; cmd: string;
            }[];
            now: string; server1Ok: boolean;
        }>('/admin/cron'),
    setCronSchedule: (body: { server: string; cmdMatch: string; minute: string; hour: string; dom?: string; mon?: string; dow?: string; adminPassword?: string }) =>
        post<{ ok: boolean; when: string; cycle: string; backup: string }>('/admin/cron/schedule', body),
    userBatches: () =>
        get<{
            rows: { kind: string; id: string; status: string; user: string; title: string; createdAt: string }[];
            pending: number;
        }>('/admin/user-batches'),
    // 📊 일자별 마케팅 통계 (2026-07-28) — 유입(채널별)→사용→전환을 하루 한 줄로
    marketingDaily: (days = 14) =>
        get<{
            days: number;
            rows: {
                day: string; visits: number; signups: number; guests: number; members: number;
                referred: number; channels: Record<string, number>; usedUsers: number;
                uses: number; spent: number; features: { name: string; n: number }[];
                fromArchive: boolean;
            }[];
        }>(`/admin/marketing-daily?days=${days}`),
    // 📊 헤르메스 일일 경영 리포트 (2026-07-11)
    bizDailyReports: (days = 30) =>
        get<{ reports: { reportDate: string; revenueKrw: number; chargeCount: number; aiCostUsd: number; newUsers: number; dau: number; chatCount: number; pointSpent: number; topFeatures: { name: string; count: number }[]; errorCount: number; tossPnlKrw: number | null; reportMd: string | null }[] }>(`/biz/daily-reports?days=${days}`),
    bizDirectives: () =>
        get<{ directives: { id: number; createdDate: string; source: string; title: string; detail: string | null; assignee: string | null; status: string; devRequestId: number | null; resultNote: string | null; effectNote: string | null }[] }>('/biz/directives'),
    // ── 개발AI 콘솔 (2026-08-20, 1단계: 프로젝트·명세 버전) ──
    // ★2026-08-20 서버1(shared-api)로 이전 — /api/admin/* 은 vercel.json rewrite 로
    //   서버1을 탄다. Vercel 서버리스는 VPC 밖이라 DB 에 못 붙어 타임아웃 났다.
    listDevProjects: () =>
        get<{ projects: DevProjectRow[]; concurrency: { running: number; max: number; canStart: boolean } }>('/admin/devai/list'),
    getDevProject: (id: string) =>
        get<{ project: DevProjectDetail }>(`/admin/devai/get?id=${encodeURIComponent(id)}`),
    getDevProjectArtifacts: (id: string) =>
        get<{ artifacts: DevProjectArtifacts }>(`/admin/devai/artifacts?id=${encodeURIComponent(id)}`),
    createDevProject: (body: Record<string, unknown>) =>
        post<{ project: DevProjectDetail }>('/admin/devai/create', body),
    updateDevProject: (body: Record<string, unknown>) =>
        post<{ project: DevProjectDetail; versionAdded: boolean }>('/admin/devai/update', body),
    deleteDevProject: (id: string) =>
        post<{ deleted: boolean; id: string }>('/admin/devai/delete', { id }),
    // 2단계 — 파이프라인 연결 / 진행·결과 동기화 / 명세서 내보내기
    linkDevProject: (id: string, herdrProjectId: string) =>
        post<{ project: DevProjectDetail }>('/admin/devai/link', { id, herdrProjectId }),
    syncDevProject: (id: string) =>
        post<{ project: DevProjectDetail; eventsAdded: number; batches: { name: string; title: string; status: string; commit: string | null }[] }>('/admin/devai/sync', { id }),
    devProjectExportUrl: (id: string) => `/api/admin/devai/export?id=${encodeURIComponent(id)}`,
    // 3단계 — 승인/반려. 텔레그램 버튼과 같은 결재 큐에 결정을 쓴다.
    approveDevProject: (id: string, taskId: string, decision: 'approved' | 'rejected') =>
        post<{ ok: boolean; taskId: string; decision: string }>('/admin/devai/approve', { id, taskId, decision }),
    // 승인 대기 목록 — ★이게 없으면 어드민에서 시작한 사람은 무엇을 승인해야 할지 모른다.
    //   (예전엔 텔레그램 메시지로만 나가서 화면엔 아무것도 안 떴다)
    listDevApprovals: () =>
        get<{ approvals: DevApprovalRow[] }>('/admin/devai/approvals'),
    // 4단계 — 디자인 시안 목록/선택. 생성·확정은 design_preview.py 가 맡는다.
    listDevDesigns: () =>
        get<{ designs: DevDesignRow[]; waitingCount?: number }>('/admin/devai/designs'),
    /** 시안 삭제 — version 을 주면 1장만, 없으면 그 제목의 시안 전부. */
    deleteDevDesign: (projectName: string, version?: string) =>
        post<{ deleted: boolean; projectName: string; version: string | null }>(
            '/admin/devai/delete-design', { projectName, version }),
    // 5단계 — 어드민에서 개발 착수(텔레그램 /hermes 와 같은 경로를 탄다)
    startDevProject: (id: string) =>
        post<{ started: boolean; id: string; message: string }>('/admin/devai/start', { id }),
    // 참조 이미지 — 저장소 안 sites/devai/<id>/img/ 에 저장되고 명세·지시문에 경로가 실린다.
    uploadDevImage: (id: string, dataUrl: string) =>
        post<{ file: DevProjectFileRow }>('/admin/devai/upload-image', { id, dataUrl }),
    deleteDevImage: (fileId: number) =>
        post<{ deleted: boolean; fileId: number }>('/admin/devai/delete-image', { fileId }),
    chooseDevDesign: (projectName: string, version: string, id?: string) =>
        post<{ ok: boolean; projectName: string; version: string; message: string }>(
            '/admin/devai/choose-design', { projectName, version, id }),
    // ── 인버스 ETF 1호가 스캘핑 — 가상매매 전용(2026-08-20) ──
    // ★2026-08-20 서버1(shared-api)로 이전 — /api/admin/* 은 vercel.json rewrite 로
    //   서버1을 탄다. Vercel 서버리스는 VPC 밖이라 DB 에 못 붙어 타임아웃 났다(devai 와 동일).
    getInverseStatus: () =>
        get<InverseTraderSnapshot>('/admin/inverse-trader/status'),
    startInverseSession: () =>
        post<InverseTraderSnapshot & { started: boolean; rehydrated: boolean; seeded: boolean; seedReason: string | null }>('/admin/inverse-trader/start', {}),
    stopInverseSession: (reason?: string) =>
        post<InverseTraderSnapshot>('/admin/inverse-trader/stop', { reason }),
    emergencyStopInverse: (reason?: string) =>
        post<InverseTraderSnapshot>('/admin/inverse-trader/emergency-stop', { reason }),
    tickInverseSession: (times = 1) =>
        post<InverseTraderSnapshot & { ticks: { skipped: boolean; reason?: string; fills: number }[] }>('/admin/inverse-trader/tick', { times }),
    settleInverseNow: () =>
        post<InverseTraderSnapshot>('/admin/inverse-trader/settle', {}),
    saveInverseConfig: (body: Record<string, unknown>) =>
        put<{ ok: boolean; config: InverseTraderSnapshot['config']; tradingMode: string }>('/admin/inverse-trader/config', body),
    // 토스 자동매매 봇 (읽기 전용)
    getTossStatus: () =>
        get<{ available: boolean; reason?: string; status?: any; staleSeconds?: number | null }>('/admin/toss-trader/status'),
    getTossLogs: (limit = 100) =>
        get<{ lines: string[]; total?: number }>(`/admin/toss-trader/logs?limit=${limit}`),
    getTossOrders: (limit = 100) =>
        get<{ lines: string[]; total?: number }>(`/admin/toss-trader/orders?limit=${limit}`),
    getTossScan: () =>
        get<{ available: boolean; reason?: string; scan?: any }>('/admin/toss-trader/scan'),
    // 가상매매(P2 페이퍼 봇) — 실봇과 동일 status 형식(파일 격리 status_paper.json)
    getTossPaperStatus: () =>
        get<{ available: boolean; reason?: string; status?: any; staleSeconds?: number | null }>('/admin/toss-trader/paper/status'),
    getTossPaperLogs: (limit = 100) =>
        get<{ lines: string[]; total?: number }>(`/admin/toss-trader/paper/logs?limit=${limit}`),
    getTossPaperOrders: (limit = 100) =>
        get<{ lines: string[]; total?: number }>(`/admin/toss-trader/paper/orders?limit=${limit}`),
    // ★읽기 전용 — 페이퍼는 auto_select 가 매일 실봇 발굴 추천을 자동 반영하므로
    //   수동 선택은 다음 스캔에 덮어써진다(쓰기 API 자체를 만들지 않았다).
    getTossPaperSelection: () =>
        get<{ exists: boolean; selection: { symbols: string[]; halt: boolean; params?: Record<string, Record<string, number>>; updatedAt?: string; autoScanDate?: string }; readOnly?: boolean }>('/admin/toss-trader/paper/selection'),
    // 가상매매 성과 요약(2026-08-05) — 누적/일별 손익 + 체결수 + '왜 안 샀는지'(감시 점수).
    // ★체결 0건이 정상일 수 있어(임계 미달) hasTrades 로 빈 화면과 고장을 구분한다.
    getTossPaperPerformance: () =>
        get<{
            available: boolean; reason?: string;
            mode?: string; alive?: boolean; halted?: boolean; haltReason?: string;
            marketOpen?: boolean; buyThreshold?: number;
            initialCapitalKrw?: number; realizedPnlTotalKrw?: number; realizedPnlTodayKrw?: number;
            unrealizedPnlKrw?: number; equityKrw?: number; returnPct?: number;
            filledCount?: number; orderLogLines?: number; hasTrades?: boolean;
            daily?: { date: string; pnl: number }[];
            watch?: { symbol: string; name: string; lastPrice: number | null; signal: string | null;
                      reason: string; score: number | null; held: boolean;
                      avgPrice: number | null; unrealizedPnlKrw: number | null }[];
            heldSymbols?: string[]; selectionUpdatedAt?: string | null;
            updatedAt?: string | null; staleSeconds?: number | null;
        }>('/admin/toss-trader/paper/performance'),
    // 매매 체결 이력(2026-08-12) — "왜 샀고 왜 팔았는지"를 건별로. 실봇/페이퍼 공용.
    // ★orders 로그(주문 시도 텍스트)와 별개: 여기는 체결 확인분만 구조화돼 있다.
    getTossTrades: (mode: 'live' | 'paper' = 'paper', limit = 100) =>
        get<{
            available: boolean; mode: string; reason?: string;
            trades: {
                at: string; date: string; symbol: string; label: string;
                side: 'BUY' | 'SELL'; quantity: number; price: number; amount: number;
                reason: string; avgPrice?: number; score?: number; threshold?: number;
                detail?: Record<string, any>; mode?: string; dryRun?: boolean;
                realizedPnl?: number; pnlPct?: number; sellRatio?: number; exitAll?: boolean;
                qtyBefore?: number; entryAt?: string; entryPrice?: number;
                entryReason?: string; entryScore?: number; holdingDays?: number;
            }[];
            total: number; updatedAt?: string | null;
            summary?: { buyCount: number; sellCount: number; closedCount: number;
                        winCount: number; winRatePct: number | null; realizedSum: number };
        }>(`/admin/toss-trader/trades?mode=${mode}&limit=${limit}`),
    getTossSelection: () =>
        get<{ exists: boolean; selection: { symbols: string[]; halt: boolean; params?: Record<string, Record<string, number>>; updatedAt?: string }; max: number; paramBounds?: Record<string, [number, number]> }>('/admin/toss-trader/selection'),
    saveTossSelection: (payload: { symbols?: string[]; halt?: boolean; params?: Record<string, Record<string, number>>; adminPassword?: string }) =>
        post<{ ok: boolean; selection: { symbols: string[]; halt: boolean; params?: Record<string, Record<string, number>>; updatedAt?: string } }>('/admin/toss-trader/selection', payload),
    // 🔴긴급정지 해제 + 봇 재시작(래치 해제)을 한 번에. force=리스크 정지도 무시하고 재시작.
    restartTossBot: (force = false, adminPassword?: string) =>
        post<{ ok: boolean; restarted: boolean; halted: boolean; message: string }>('/admin/toss-trader/restart', { force, adminPassword }),
    getTossCustomSymbols: () =>
        get<{ symbols: Record<string, string>; max: number }>('/admin/toss-trader/custom-symbols'),
    saveTossCustomSymbols: (payload: { add?: { symbol: string; name: string }; remove?: string }) =>
        post<{ ok: boolean; symbols: Record<string, string>; max: number }>('/admin/toss-trader/custom-symbols', payload),
    // 종목 통합 분석(봇 추세 점수 + 채원 펀더멘털) — 어드민 전용, 포인트 차감 없음
    requestTossAnalyze: (payload: { symbol?: string; stockName?: string }) =>
        post<{ id: number; status: string; reused?: boolean }>('/admin/toss-trader/analyze', payload),
    getTossAnalyze: (id: number) =>
        get<{ id: number; stockName: string; status: string; analysisReport: string | null; errorMessage: string | null; updatedAt: string }>(`/admin/toss-trader/analyze/${id}`),
    // 채원 발굴 일기(StockDiscovery, 매일 아침 누적)
    getTossDiscovery: () =>
        get<{ dates: string[]; latest: any | null }>('/admin/toss-trader/discovery'),
    getTossDiscoveryByDate: (date: string) =>
        get<any>(`/admin/toss-trader/discovery/${date}`),
    // 발굴 아카이브(DiscoveryRecord — 매 영업일 16:10 수집: 봇 60점↑ 후보+채원 발굴의 당일정보 박제)
    getDiscoveryRecordDates: () =>
        get<{ dates: { tradeDate: string; count: number; recommendedCount: number; recommendedNames: string | null; chaewonNames: string | null }[] }>('/admin/toss-trader/discovery-records'),
    getDiscoveryRecordsByDate: (date: string) =>
        get<{ date: string; market: any | null; records: any[] }>(`/admin/toss-trader/discovery-records/${date}`),
    // 손절·익절·임계 최적값 백테스트(봇 동일 로직, AI 없음)
    getTossBacktest: (symbol: string) =>
        get<any>(`/admin/toss-trader/backtest/${symbol}`),
    // 개발 요청 큐(어드민 → Hermes)
    createDevRequest: (request: string, source?: string) =>
        post<{ ok: boolean; id: number }>('/admin/dev-request', { request, source }),
    getDevRequests: () =>
        get<{ id: number; request: string; source: string; status: string; result: string | null; createdAt: string }[]>('/admin/dev-requests'),
    // 독립사이트 목록(sites/README.md 파싱) + 삭제 요청(큐)
    getSites: () =>
        get<{ name: string; url: string; desc: string }[]>('/admin/sites'),
    deleteSite: (name: string) =>
        del<{ ok: boolean; immediate?: boolean; message?: string; id?: number }>(`/admin/sites/${name}`),
    // 사이트 소스 ZIP 다운로드 — 받은 파일을 새 GitHub 저장소에 올려 Vercel 독립 배포하는 용도.
    // ★<a href>로 직접 못 건다: 인증이 Authorization 헤더 방식이라 링크 클릭은 401이 된다.
    //   fetch로 blob을 받아 임시 <a>로 눌러주는 방식만 동작한다(이미지 조회부와 같은 사정).
    downloadSite: async (name: string): Promise<void> => {
        const res = await fetch(`${BASE}/admin/sites/${name}/download`, { headers: { ...authHeaders() } });
        if (!res.ok) {
            // 에러 응답은 JSON — 서버 사유를 그대로 보여준다(빈 사이트/404 등 구분됨).
            let reason = `다운로드 실패 (${res.status})`;
            try { reason = (await res.json())?.error || reason; } catch { /* 본문이 JSON이 아니면 기본 문구 */ }
            throw new Error(reason);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${name}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);   // ★해제 안 하면 blob이 탭 수명 내내 메모리에 남는다
    },
    // 스킬 카탈로그 동기화 요청(큐) — 서버2 워커가 build_catalog.py 재실행 + 배포
    syncSkills: () =>
        post<{ ok: boolean; id: number }>('/admin/skills/sync'),
    // 동기화 1건의 진행 상태 — pending(대기) / done(완료) / failed(실패, result에 사유)
    getSkillSyncStatus: (id: number) =>
        get<{ id: number; status: string; result: string; createdAt: string; updatedAt: string }>(
            `/admin/skills/sync/${id}`,
        ),
    // 포인트 전사 일별 결산
    getPointSettlement: (days = 30) =>
        get<{
            days: number;
            daily: { date: string; chargeAmount: number; chargeCount: number; spent: number; granted: number; refund: number }[];
            summary: { chargePt: number; spent: number; granted: number; refund: number; outstandingPaid: number; outstandingBonus: number };
        }>(`/admin/point-settlement?days=${days}`),
    // 페르소나 반자동 생성: 이름·직업·카테고리 → AI가 4개 텍스트 필드 생성(검토 후 저장)
    // 카테고리 미지정 시 suggestedCategory(기존명 or 신규명) 추천 포함(2026-07-05)
    generatePersona: (body: { name: string; jobTitle?: string; categoryId?: number | null }) =>
        post<{ description: string; systemInstruction: string; identityPrompt: string; iconName: string; colorClass: string; usedExamples: string[]; suggestedCategory?: string | null; suggestedCategoryIsNew?: boolean }>('/admin/personas/generate', body),
    // 지식창고 AI 구축(비동기): 시작 + 진행률 폴링
    startKnowledgeBuild: (personaId: string) =>
        post<{ started: boolean }>(`/admin/personas/${personaId}/knowledge-build`, {}),
    getKnowledgeBuild: (personaId: string) =>
        get<{ status: 'idle' | 'running' | 'done' | 'failed'; total?: number; done?: number; current?: string; docs?: { title: string; saved: number }[]; needsFactCheck?: boolean; error?: string }>(`/admin/personas/${personaId}/knowledge-build`),
};

export const chatApi = {
    stream: async (
        params: {
            personaId: string;
            text: string;
            sessionId?: number;
            memoryEnabled?: boolean;
            birthInfo?: { name?: string; year?: string; month?: string; day?: string; time?: string; lunar?: boolean } | null;
        },
        onChunk: (text: string) => void,
        onDone: (fullText: string) => void,
        onError: (msg: string) => void,
    ): Promise<void> => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/chat-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(params),
        });

        if (!res.ok) {
            const errText = await res.text();
            try { onError(JSON.parse(errText).error || '서버 오류'); }
            catch { onError(errText || '서버 오류'); }
            return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const payload = JSON.parse(line.slice(6));
                    if (payload.error) { onError(payload.error); return; }
                    if (payload.done) { onDone(payload.fullText); return; }
                    if (payload.text) onChunk(payload.text);
                } catch {}
            }
        }
    },
};
