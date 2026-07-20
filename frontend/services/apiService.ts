import { Persona, PersonaImage, PersonaVideo, User, DbSession, Message, ConversationSummary, UserMemory, SwingAnalysis, UserSwingAnalysis, Category } from '../types';
import { getStoredRef } from './referral';

const BASE = '/api';

function getToken(): string | null {
    return localStorage.getItem('token');
}

function authHeaders(): HeadersInit {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
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
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('insufficient-points'));
        const err: any = new Error('INSUFFICIENT_POINTS');
        err.code = 'INSUFFICIENT_POINTS';
        throw err;
    }
    if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
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
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('insufficient-points'));
            throw new Error('포인트가 부족합니다.');
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

// ── 전통의상 체험(윤채린) ── 얼굴 사진 → 나라별 전통의상 전신 화보
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
};

export interface HomepageAdminRow extends HomepageRequestRow {
    userId: number;
    userName?: string | null;
    userEmail?: string | null;
    updatedAt?: string | null;
    waitingMinutes?: number | null;  // 대기·처리중 경과분(밀림 감지)
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
export interface EbookProject {
    id: number; topic: string; title: string | null; author?: string | null; status: string;
    coverUrl?: string | null; // 표지 이미지 URL(사용자 업로드)
    docxUrl?: string | null; // 생성된 .docx URL(재방문 시 바로 다운로드, 본문/표지/판형 변경 시 null)
    scheduledHour?: number | null; // 탭4 자료 일괄수집 예약 시각(KST 1~5)
    pageSize?: string | null; // 책 판형: sinkuk(신국판) | a5 | gukbae
    createdAt: string; updatedAt: string; chapters?: EbookTocChapter[];
}
export const ebookApi = {
    create: (topic: string) =>
        post<{ project: EbookProject }>('/ebook', { topic }),
    list: () =>
        get<EbookProject[]>('/ebook'),
    get: (id: number) =>
        get<EbookProject>(`/ebook/${id}`),
    updateToc: (id: number, title: string, chapters: EbookTocChapter[], author?: string | null) =>
        put<EbookProject>(`/ebook/${id}/toc`, { title, chapters, ...(author !== undefined ? { author } : {}) }),
    remove: (id: number) =>
        del<{ deleted: boolean }>(`/ebook/${id}`),
    collectSources: (id: number, no: number) =>
        post<{ no: number; sourceStatus: EbookSourceStatus; sources: EbookSource[] }>(`/ebook/${id}/chapters/${no}/sources`, {}),
    // ※ 즉시 본문생성/다시쓰기/일괄생성(generateContent·rewriteChapter·generateDraft) 제거 — 본문은 야간 예약 배치에서만 생성.
    //    백엔드 라우트는 409(예약 안내)를 반환하므로 프론트에서 호출하지 않는다.
    // 최종본 직접 수정 저장(편집기에서 사용 — 유지)
    saveContentMd: (id: number, no: number, contentMd: string) =>
        put<{ no: number; contentMd: string }>(`/ebook/${id}/chapters/${no}/content-md`, { contentMd }),
    // 이미지 프롬프트 뽑기 — 본문 [그림:설명] 자리별 ChatGPT용 프롬프트 생성
    imagePrompts: (id: number) =>
        post<{ prompts: { no: number; chapterNo: number; chapterTitle: string; caption: string; prompt: string }[]; message?: string }>(`/ebook/${id}/image-prompts`, {}),
    // 탭3: 표지 이미지 업로드 — signed-url 발급 → GCS PUT → coverUrl 저장
    coverUploadUrl: (id: number, mimeType: string) =>
        post<{ signedUrl: string; publicUrl: string }>(`/ebook/${id}/cover-url`, { mimeType }),
    saveCoverUrl: (id: number, coverUrl: string | null) =>
        put<{ coverUrl: string | null }>(`/ebook/${id}/cover`, { coverUrl }),
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
    paidPoints: number;
    bonusPoints: number;
    createdAt: string;
    sessionCount: number;
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

export const adminApi = {
    getUsers: () =>
        get<AdminUser[]>('/admin/users'),

    grantPoints: (identifier: string, amount: number, description?: string) => {
        const isPhone = /^[0-9+\-\s]+$/.test(identifier.replace(/\s/g, ''));
        const body = isPhone ? { phone: identifier, amount, description } : { email: identifier, amount, description };
        return post<{ email: string; granted: number; newBalance: number }>('/points/admin-grant', body);
    },

    bulkGrant: (amount: number, description?: string) =>
        post<{ granted: number; userCount: number }>('/admin/bulk-grant', { amount, description }),

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
    // 📊 헤르메스 일일 경영 리포트 (2026-07-11)
    bizDailyReports: (days = 30) =>
        get<{ reports: { reportDate: string; revenueKrw: number; chargeCount: number; aiCostUsd: number; newUsers: number; dau: number; chatCount: number; pointSpent: number; topFeatures: { name: string; count: number }[]; errorCount: number; tossPnlKrw: number | null; reportMd: string | null }[] }>(`/biz/daily-reports?days=${days}`),
    bizDirectives: () =>
        get<{ directives: { id: number; createdDate: string; source: string; title: string; detail: string | null; assignee: string | null; status: string; devRequestId: number | null; resultNote: string | null; effectNote: string | null }[] }>('/biz/directives'),
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
    getTossSelection: () =>
        get<{ exists: boolean; selection: { symbols: string[]; halt: boolean; params?: Record<string, Record<string, number>>; updatedAt?: string }; max: number; paramBounds?: Record<string, [number, number]> }>('/admin/toss-trader/selection'),
    saveTossSelection: (payload: { symbols?: string[]; halt?: boolean; params?: Record<string, Record<string, number>> }) =>
        post<{ ok: boolean; selection: { symbols: string[]; halt: boolean; params?: Record<string, Record<string, number>>; updatedAt?: string } }>('/admin/toss-trader/selection', payload),
    // 🔴긴급정지 해제 + 봇 재시작(래치 해제)을 한 번에. force=리스크 정지도 무시하고 재시작.
    restartTossBot: (force = false) =>
        post<{ ok: boolean; restarted: boolean; halted: boolean; message: string }>('/admin/toss-trader/restart', { force }),
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
        del<{ ok: boolean; id: number }>(`/admin/sites/${name}`),
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
