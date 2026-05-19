import { Persona, PersonaImage, PersonaVideo, User, DbSession, Message, ConversationSummary, UserMemory, SwingAnalysis, UserSwingAnalysis, Category } from '../types';

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

    if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
    return data;
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
        request<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(
                isPhone
                    ? { phone: emailOrPhone, password, username }
                    : { email: emailOrPhone, password, username }
            ),
        }),

    login: (identifier: string, password: string) =>
        request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password }),
        }),

    logout: () =>
        request<{ message: string }>('/auth/logout', { method: 'POST' }),

    me: () =>
        request<{ user: User }>('/auth/me'),

    forgotPassword: (email: string) =>
        request<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        }),

    sendCode: (phone: string) =>
        request<{ message: string }>('/auth/send-code', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        }),

    sendVerify: (type: 'EMAIL' | 'PHONE', identifier: string) =>
        request<{ message: string }>('/auth/send-verify', {
            method: 'POST',
            body: JSON.stringify({ type, identifier }),
        }),

    verifyRegister: (type: 'EMAIL' | 'PHONE', identifier: string, code: string, password: string, username?: string) =>
        request<{ user: User; token: string }>('/auth/verify-register', {
            method: 'POST',
            body: JSON.stringify({ type, identifier, code, password, username }),
        }),

    resetPassword: (token: string, password: string) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
        }),

    changePassword: (currentPassword: string, newPassword: string) =>
        request<{ message: string }>('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        }),
};

// Personas
export const personaApi = {
    getAll: () =>
        withRetry(() => request<Persona[]>('/personas')),

    create: (data: Omit<Persona, 'id'>) =>
        request<Persona>('/personas', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Partial<Persona>) =>
        request<Persona>(`/personas/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        request<{ message: string }>(`/personas/${id}`, { method: 'DELETE' }),

    getIntroVideoUploadUrl: (id: string, mimeType: string) =>
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/intro-video/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveIntroVideoUrl: (id: string, videoUrl: string) =>
        request<Persona>(`/personas/${id}/intro-video`, {
            method: 'POST',
            body: JSON.stringify({ videoUrl }),
        }),

    deleteIntroVideo: (id: string) =>
        request<Persona>(`/personas/${id}/intro-video`, { method: 'DELETE' }),

    getStarVideoUploadUrl: (id: string, mimeType: string) =>
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/star-video/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveStarVideoUrl: (id: string, videoUrl: string) =>
        request<Persona>(`/personas/${id}/star-video`, {
            method: 'POST',
            body: JSON.stringify({ videoUrl }),
        }),

    deleteStarVideo: (id: string) =>
        request<Persona>(`/personas/${id}/star-video`, { method: 'DELETE' }),

    getFaceReadingBgUploadUrl: (id: string, mimeType: string) =>
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/face-reading-bg/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveFaceReadingBgUrl: (id: string, imageUrl: string) =>
        request<Persona>(`/personas/${id}/face-reading-bg`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl }),
        }),

    deleteFaceReadingBg: (id: string) =>
        request<Persona>(`/personas/${id}/face-reading-bg`, { method: 'DELETE' }),

    getChatBgUploadUrl: (id: string, mimeType: string) =>
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${id}/chat-bg/upload-url?mimeType=${encodeURIComponent(mimeType)}`),

    saveChatBgUrl: (id: string, imageUrl: string) =>
        request<Persona>(`/personas/${id}/chat-bg`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl }),
        }),

    removeChatBgItem: (id: string, url: string) =>
        request<Persona>(`/personas/${id}/chat-bg/remove`, {
            method: 'POST',
            body: JSON.stringify({ url }),
        }),

    deleteChatBg: (id: string) =>
        request<Persona>(`/personas/${id}/chat-bg`, { method: 'DELETE' }),
};

// Categories
export const categoryApi = {
    getAll: () =>
        request<Category[]>('/categories'),

    create: (name: string, order?: number) =>
        request<Category>('/categories', {
            method: 'POST',
            body: JSON.stringify({ name, order }),
        }),

    update: (id: number, data: { name?: string; order?: number }) =>
        request<Category>(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ message: string }>(`/categories/${id}`, { method: 'DELETE' }),
};

// Persona Images
export const personaImageApi = {
    getAll: (personaId: string) =>
        request<PersonaImage[]>(`/personas/${personaId}/images`),

    getSignedUrl: (personaId: string, mimeType: string, filename: string) =>
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${personaId}/images/signed-url`, {
            method: 'POST',
            body: JSON.stringify({ mimeType, filename }),
        }),

    create: (personaId: string, imageUrl: string, description: string, isMain?: boolean) =>
        request<PersonaImage>(`/personas/${personaId}/images`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl, description, isMain }),
        }),

    setMain: (personaId: string, imageId: number) =>
        request<PersonaImage>(`/personas/${personaId}/images`, {
            method: 'PUT',
            body: JSON.stringify({ imageId, isMain: true }),
        }),

    updateDescription: (personaId: string, imageId: number, description: string) =>
        request<PersonaImage>(`/personas/${personaId}/images`, {
            method: 'PUT',
            body: JSON.stringify({ imageId, description }),
        }),

    updateRequiredLevel: (personaId: string, imageId: number, requiredLevel: number) =>
        request<PersonaImage>(`/personas/${personaId}/images`, {
            method: 'PUT',
            body: JSON.stringify({ imageId, requiredLevel }),
        }),

    updateOrder: (personaId: string, imageId: number, order: number) =>
        request<PersonaImage>(`/personas/${personaId}/images`, {
            method: 'PUT',
            body: JSON.stringify({ imageId, order }),
        }),

    delete: (personaId: string, imageId: number) =>
        request<{ message: string }>(`/personas/${personaId}/images`, {
            method: 'DELETE',
            body: JSON.stringify({ imageId }),
        }),
};

// Persona Videos
export const personaVideoApi = {
    getAll: (imageId: number) =>
        request<PersonaVideo[]>(`/persona-videos/${imageId}`),

    getSignedUrl: (mimeType: string, filename: string) =>
        request<{ signedUrl: string; publicUrl: string }>('/persona-videos/signed-url', {
            method: 'POST',
            body: JSON.stringify({ mimeType, filename }),
        }),

    create: (imageId: number, data: { videoUrl?: string; videoBase64?: string; mimeType?: string; title?: string }) =>
        request<PersonaVideo>('/persona-videos', {
            method: 'POST',
            body: JSON.stringify({ imageId, ...data }),
        }),

    update: (videoId: number, data: { title?: string; order?: number; requiredLevel?: number }) =>
        request<PersonaVideo>(`/persona-videos/${videoId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (videoId: number) =>
        request<{ message: string }>(`/persona-videos/${videoId}`, { method: 'DELETE' }),
};

// Sessions
export const sessionApi = {
    getAll: () =>
        request<{ sessions: DbSession[]; firstChatMap: Record<string, string> }>('/sessions'),

    create: (personaId: string, title?: string) =>
        request<DbSession>('/sessions', {
            method: 'POST',
            body: JSON.stringify({ personaId, title }),
        }),

    getMessages: (sessionId: number, cursor?: number, limit?: number) =>
        request<{ messages: Message[]; hasMore: boolean }>(
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
        if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
        return data;
    },

    getSummary: (sessionId: number) =>
        request<ConversationSummary | null>(`/sessions/${sessionId}/summary`),

    saveSummary: (sessionId: number, summary: string, messageCount: number) =>
        request<ConversationSummary>(`/sessions/${sessionId}/summary`, {
            method: 'POST',
            body: JSON.stringify({ summary, messageCount }),
        }),

    extractMemories: (sessionId: number, userText: string, aiText: string) =>
        request<{ saved: number }>(`/sessions/${sessionId}/extract-memories`, {
            method: 'POST',
            body: JSON.stringify({ userText, aiText }),
        }),

    greet: (sessionId: number) =>
        request<Message>(`/sessions/${sessionId}/greet`, { method: 'POST' }),

    quickTrigger: (sessionId: number, menuLabel: string, menuPrompt: string) =>
        request<Message>(`/sessions/${sessionId}/quick-trigger`, {
            method: 'POST',
            body: JSON.stringify({ menuLabel, menuPrompt }),
        }),

    summarize: (sessionId: number) =>
        request<ConversationSummary | null>(`/sessions/${sessionId}/summarize`, {
            method: 'POST',
        }),

    starThanks: (personaId: string, amount: number) =>
        request<{ message: Message; sessionId: number }>('/star-thanks', {
            method: 'POST',
            body: JSON.stringify({ personaId, amount }),
        }),

    cleanup: (days: number = 30, keepCount: number = 10) =>
        request<{ cleanedSessions: number; deletedMessages: number }>('/sessions/cleanup', {
            method: 'POST',
            body: JSON.stringify({ days, keepCount }),
        }),
};

// Settings
export const settingsApi = {
    get: () =>
        request<Record<string, string>>('/settings'),

    update: (data: Record<string, string>) =>
        request<{ message: string }>('/settings', {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
};

// Memory
export const memoryApi = {
    getAll: () =>
        request<UserMemory[]>('/memory'),

    save: (content: string, category?: string) =>
        request<UserMemory>('/memory', {
            method: 'POST',
            body: JSON.stringify({ content, category }),
        }),

    search: (query: string) =>
        request<UserMemory[]>('/memory/search', {
            method: 'POST',
            body: JSON.stringify({ query }),
        }),

    delete: (id: number) =>
        request<{ message: string }>(`/memory/${id}`, { method: 'DELETE' }),
};

// Knowledge
export const knowledgeApi = {
    upload: (personaId: string, title: string, text: string) =>
        request<{ saved: number; total: number; sourceId: string }>('/knowledge', {
            method: 'POST',
            body: JSON.stringify({ personaId, title, text }),
        }),

    getAll: (personaId: string) =>
        request<{ sourceId: string | null; title: string | null; chunkCount: number; preview: string; createdAt: string }[]>(
            `/knowledge/${personaId}`
        ),

    deleteSource: (sourceId: string) =>
        request<{ message: string; deleted: number }>(`/knowledge/source/${sourceId}`, { method: 'DELETE' }),

    delete: (id: number) =>
        request<{ message: string }>(`/knowledge/${id}`, { method: 'DELETE' }),

    search: (personaId: string, query: string) =>
        request<{ id: number; content: string; similarity: number }[]>('/knowledge/search', {
            method: 'POST',
            body: JSON.stringify({ personaId, query }),
        }),
};

// Trigger Videos
export const triggerVideoApi = {
    getAll: (personaId: string) =>
        request<import('../types').TriggerVideo[]>(`/trigger-videos/${personaId}`),

    getSignedUrl: (mimeType: string, filename: string) =>
        request<{ signedUrl: string; publicUrl: string }>('/trigger-videos/signed-url', {
            method: 'POST',
            body: JSON.stringify({ mimeType, filename }),
        }),

    extractKeywords: (title: string, description: string) =>
        request<{ keywords: string[] }>('/trigger-videos/extract-keywords', {
            method: 'POST',
            body: JSON.stringify({ title, description }),
        }),

    create: (data: { personaId: string; videoUrl: string; title?: string; description?: string; keywords: string; tag?: string }) =>
        request<import('../types').TriggerVideo>('/trigger-videos', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: number, data: { title?: string; description?: string; keywords?: string; tag?: string }) =>
        request<import('../types').TriggerVideo>(`/trigger-videos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ ok: boolean }>(`/trigger-videos/${id}`, { method: 'DELETE' }),
};

// Stock Report (RAG)
export const stockReportApi = {
    consult: (analysisId: number) =>
        request<{ ok: boolean; chunks: number; stockName: string; ticker: string; personaId: string }>(
            '/stock-report/consult',
            { method: 'POST', body: JSON.stringify({ analysisId }) }
        ),

    search: (q: string) =>
        request<{ content: string; stockName: string; ticker: string; reportDate: string; quarter: string; similarity: number }[]>(
            `/stock-report/search?q=${encodeURIComponent(q)}`
        ),

    list: () =>
        request<{ ticker: string; stockName: string; reportDate: string; chunkCount: number }[]>(
            '/stock-report/list'
        ),
};

// Swing Analysis
export const swingAnalysisApi = {
    getSignedUrl: (mimeType: string, filename: string) =>
        request<{ signedUrl: string; publicUrl: string }>('/swing-analysis/signed-url', {
            method: 'POST',
            body: JSON.stringify({ mimeType, filename }),
        }),

    analyze: async (videoUrl: string, personaId: string, mimeType: string, fileName: string): Promise<{ id: number; analysis: SwingAnalysis; createdAt: string }> => {
        const cfUrl = import.meta.env.VITE_GOLF_CF_URL as string | undefined;
        if (cfUrl) {
            // 프로덕션: Cloud Function 직접 호출 (Vercel 타임아웃 우회)
            const token = getToken();
            const res = await fetch(cfUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ videoUrl, personaId, mimeType, fileName }),
            });
            const text = await res.text();
            let data: any;
            try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(`서버 응답 오류: ${text.slice(0, 200)}`); }
            if (!res.ok) throw new Error(data.error || `오류 (${res.status})`);
            return data;
        }
        // 로컬 개발: Express 서버 사용 (타임아웃 없음)
        return request<{ id: number; analysis: SwingAnalysis; createdAt: string }>('/swing-analysis/analyze', {
            method: 'POST',
            body: JSON.stringify({ videoUrl, personaId, mimeType, fileName }),
        });
    },

    getHistory: (personaId: string) =>
        request<UserSwingAnalysis[]>(`/swing-analysis?personaId=${encodeURIComponent(personaId)}`),

    delete: (id: number) =>
        request<{ ok: boolean }>(`/swing-analysis/${id}`, { method: 'DELETE' }),
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
        request<{ analysis: FaceReadingResult; newBalance: number; paidBalance: number; bonusBalance: number }>('/face-reading', {
            method: 'POST',
            body: JSON.stringify({ imageBase64, mimeType, personaId }),
        }),
};

export const quickMenuApi = {
    generate: (personaId: string, prompt: string) =>
        request<{ result: string; newBalance: number; paidBalance: number; bonusBalance: number }>('/quick-menu-result', {
            method: 'POST',
            body: JSON.stringify({ personaId, prompt }),
        }),
    activate: (cost: number, description: string) =>
        request<{ newBalance: number; paidBalance: number; bonusBalance: number }>('/quick-menu-activate', {
            method: 'POST',
            body: JSON.stringify({ cost, description }),
        }),
};

// Announcements
export const announcementApi = {
    getAll: (all?: boolean) =>
        request<import('../types').Announcement[]>(`/announcements${all ? '?all=true' : ''}`),

    create: (data: { title: string; content: string; category: string; isPinned?: boolean; isVisible?: boolean }) =>
        request<import('../types').Announcement>('/announcements', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: number, data: Partial<{ title: string; content: string; category: string; isPinned: boolean; isVisible: boolean }>) =>
        request<import('../types').Announcement>(`/announcements/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: number) =>
        request<{ ok: boolean }>(`/announcements/${id}`, { method: 'DELETE' }),
};

// User Profile
export const userProfileApi = {
    getBirthInfo: () =>
        request<{ birthInfoJson: string | null }>('/user/birth-info'),

    saveBirthInfo: (birthInfoJson: string) =>
        request<{ ok: boolean }>('/user/birth-info', {
            method: 'PUT',
            body: JSON.stringify({ birthInfoJson }),
        }),
};

// Board
export const boardApi = {
    getList: (personaId: string) =>
        request<{ id: number; title: string; createdAt: string; userId: number; user: { username?: string; email: string }; _count: { replies: number } }[]>(`/board?personaId=${encodeURIComponent(personaId)}`),

    getPost: (id: number) =>
        request<import('../types').BoardPost>(`/board/${id}`),

    create: (title: string, content: string, personaId: string) =>
        request<{ id: number }>('/board', { method: 'POST', body: JSON.stringify({ title, content, personaId }) }),

    update: (id: number, title: string, content: string) =>
        request<{ ok: boolean }>(`/board/${id}`, { method: 'PUT', body: JSON.stringify({ title, content }) }),

    delete: (id: number) =>
        request<{ ok: boolean }>(`/board/${id}`, { method: 'DELETE' }),

    addReply: (postId: number, content: string) =>
        request<{ id: number }>(`/board/${postId}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),

    deleteReply: (postId: number, replyId: number) =>
        request<{ ok: boolean }>(`/board/${postId}/reply/${replyId}`, { method: 'DELETE' }),
};

// Partner Board
export const partnerBoardApi = {
    getList: () =>
        request<{ id: number; title: string; createdAt: string; userId: number; user: { username?: string; email: string }; _count: { replies: number } }[]>('/partner-board'),

    getPost: (id: number) =>
        request<import('../types').PartnerPost>(`/partner-board/${id}`),

    create: (title: string, content: string, contact?: string) =>
        request<{ id: number }>('/partner-board', { method: 'POST', body: JSON.stringify({ title, content, contact }) }),

    update: (id: number, title: string, content: string) =>
        request<{ ok: boolean }>(`/partner-board/${id}`, { method: 'PUT', body: JSON.stringify({ title, content }) }),

    delete: (id: number) =>
        request<{ ok: boolean }>(`/partner-board/${id}`, { method: 'DELETE' }),

    addReply: (postId: number, content: string) =>
        request<{ id: number }>(`/partner-board/${postId}/reply`, { method: 'POST', body: JSON.stringify({ content }) }),

    deleteReply: (postId: number, replyId: number) =>
        request<{ ok: boolean }>(`/partner-board/${postId}/reply/${replyId}`, { method: 'DELETE' }),
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

export const pointsApi = {
    getStats: () => request<PointsStats>('/points/stats'),
};

export const adminApi = {
    getUsers: () =>
        request<AdminUser[]>('/admin/users'),

    grantPoints: (identifier: string, amount: number, description?: string) => {
        const isPhone = /^[0-9+\-\s]+$/.test(identifier.replace(/\s/g, ''));
        const body = isPhone ? { phone: identifier, amount, description } : { email: identifier, amount, description };
        return request<{ email: string; granted: number; newBalance: number }>('/points/admin-grant', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    bulkGrant: (amount: number, description?: string) =>
        request<{ granted: number; userCount: number }>('/admin/bulk-grant', {
            method: 'POST',
            body: JSON.stringify({ amount, description }),
        }),

    changeRole: (userId: number, role: string) =>
        request<{ id: number; role: string }>('/admin/change-role', {
            method: 'POST',
            body: JSON.stringify({ userId, role }),
        }),

    getMonitorMetrics: () =>
        request<any>('/admin/monitor/metrics'),

    getLogDates: () =>
        request<{ dates: string[] }>('/admin/monitor/logs'),

    getLogs: (date: string, page = 1, level = '') =>
        request<{ lines: string[]; total: number; page: number; pageSize: number }>(
            `/admin/monitor/logs/${date}?page=${page}&level=${level}`
        ),
};
