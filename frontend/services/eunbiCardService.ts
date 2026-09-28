// 은비 축하 카드(2026-09-28) — shared-api `/api/aimp/eunbi-card` (vercel.json 프록시 `/api/eunbi-card`).
// pointService 의 req 와 같은 방식(토큰 헤더, res.ok 아니면 서버 error 문구를 담은 Error).
// ★402(포인트 부족)의 error 문구는 '포인트가 부족합니다.' 라 문구로는 못 가른다 — status 를 함께 싣는다.

const BASE = '/api/eunbi-card';

export type CardOccasion = 'birthday' | 'cheer' | 'pass' | 'thanks' | 'comfort';

export interface EunbiCardQuota { freeLeft: number; price: number; todayCount: number; dailyCap: number }

export interface EunbiCardCreated {
    id: string; url: string; message: string; occasion: CardOccasion; toName: string; fromName: string;
    isFree: boolean; pointsCharged: number; freeLeft: number;
}

export class EunbiCardError extends Error {
    status: number;
    reason?: string;
    constructor(message: string, status: number, reason?: string) {
        super(message);
        this.status = status;
        this.reason = reason;
    }
}

function authHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new EunbiCardError(data.error || `서버 오류 (${res.status})`, res.status, data.reason);
    return data;
}

export const eunbiCardApi = {
    getQuota: () => req<EunbiCardQuota>('/quota'),
    create: (body: { occasion: CardOccasion; toName: string; fromName: string; story?: string }) =>
        req<EunbiCardCreated>('', { method: 'POST', body: JSON.stringify(body) }),
};
