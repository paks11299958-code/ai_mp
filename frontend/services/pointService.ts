const BASE = '/api';

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
    if (!res.ok) throw new Error(data.error || `서버 오류 (${res.status})`);
    return data;
}

export const pointApi = {
    getBalance: () => req<{ paidPoints: number; bonusPoints: number; points: number; transactions: any[] }>('/points'),
    getMenuPrices: () => req<{ prices: Record<string, number> }>('/points/menu-prices'),
    getStats: () => req<any>('/points/stats'),
    getCost: (personaId: string) => req<{ cost: number; stage: number; xp: number }>(`/points/cost?personaId=${personaId}`),
    sendStar: (personaId: string, amount: number, message?: string) =>
        req<{ balloon: any; newBalance: number; xp: number; leveledUp: boolean; newStage: number; levelupBonus: number }>('/star', {
            method: 'POST',
            body: JSON.stringify({ personaId, amount, message }),
        }),
    getRanking: (personaId: string) => req<{ user: { id: number; username?: string } | undefined; totalBalloons: number }[]>(`/star/${personaId}/ranking`),
    adminGrant: (email: string, amount: number, description?: string) =>
        req<{ email: string; granted: number; newBalance: number }>('/points/admin-grant', {
            method: 'POST',
            body: JSON.stringify({ email, amount, description }),
        }),
    confirmPayment: (paymentKey: string, orderId: string, amount: number) =>
        req<{ success: boolean; points: number; newPaidBalance: number; newBonusBalance: number; newBalance: number }>('/payments/confirm', {
            method: 'POST',
            body: JSON.stringify({ paymentKey, orderId, amount }),
        }),
};
