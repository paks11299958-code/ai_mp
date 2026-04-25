import { Persona, PersonaImage, PersonaVideo, User, DbSession, Message, ConversationSummary, UserMemory } from '../types';

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
        request<Persona[]>('/personas'),

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
};

// Persona Images
export const personaImageApi = {
    getAll: (personaId: string) =>
        request<PersonaImage[]>(`/personas/${personaId}/images`),

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

    create: (imageId: number, videoUrl: string, title?: string) =>
        request<PersonaVideo>('/persona-videos', {
            method: 'POST',
            body: JSON.stringify({ imageId, videoUrl, title }),
        }),

    update: (videoId: number, data: { title?: string; order?: number }) =>
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
        request<Message>(`/sessions/${sessionId}/messages`, {
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
