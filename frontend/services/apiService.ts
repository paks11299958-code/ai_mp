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
    register: (email: string, password: string, username?: string) =>
        request<{ user: User; token: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, username }),
        }),

    login: (email: string, password: string) =>
        request<{ user: User; token: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
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

    resetPassword: (token: string, password: string) =>
        request<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password }),
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
        request<{ signedUrl: string; publicUrl: string }>(`/personas/${personaId}/images?action=signed-url`, {
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
        request<DbSession[]>('/sessions'),

    create: (personaId: string, title?: string) =>
        request<DbSession>('/sessions', {
            method: 'POST',
            body: JSON.stringify({ personaId, title }),
        }),

    getMessages: (sessionId: number, cursor?: number, limit?: number) =>
        request<{ messages: Message[]; hasMore: boolean }>(
            `/sessions/${sessionId}/messages?limit=${limit || 50}${cursor ? `&cursor=${cursor}` : ''}`
        ),

    saveMessage: (sessionId: number, role: string, text: string) =>
        request<Message & { xp?: number; personaId?: string }>(`/sessions/${sessionId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ role, text }),
        }),

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

    summarize: (sessionId: number) =>
        request<ConversationSummary | null>(`/sessions/${sessionId}/summarize`, {
            method: 'POST',
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
