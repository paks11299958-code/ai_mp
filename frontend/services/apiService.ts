import { Persona, User, DbSession, Message } from '../types';

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

// Sessions
export const sessionApi = {
    getAll: () =>
        request<DbSession[]>('/sessions'),

    create: (personaId: string, title?: string) =>
        request<DbSession>('/sessions', {
            method: 'POST',
            body: JSON.stringify({ personaId, title }),
        }),

    getMessages: (sessionId: number) =>
        request<Message[]>(`/sessions/${sessionId}/messages`),

    saveMessage: (sessionId: number, role: string, text: string) =>
        request<Message>(`/sessions/${sessionId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ role, text }),
        }),
};
