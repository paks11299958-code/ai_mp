import { adminApi } from '../../services/apiService';

export interface AiUsage {
    total?: { cost: number; calls: number; tokens: number };
    daily?: { date: string; service: string; cost: number; calls: number }[];
}
async function aiUsage(): Promise<AiUsage> {
    const res = await fetch('/api/admin/ai-usage?days=30', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
    });
    const json = await res.json();
    if (!res.ok || json?.error) throw new Error('조회 실패');
    return json;
}
export const sources = {
    reports: () => adminApi.bizDailyReports(30),
    directives: () => adminApi.bizDirectives(),
    users: () => adminApi.getUsers(),
    referral: () => adminApi.referralStats(),
    marketing: () => adminApi.marketingDaily(30),
    points: () => adminApi.getPointSettlement(30),
    ai: aiUsage,
    server1: () => adminApi.getMonitorMetrics(),
    server2: () => adminApi.getServer2Metrics(),
    balances: () => adminApi.getBalances(),
    errors: () => adminApi.getErrorSummary(),
    cron: () => adminApi.cronJobs(),
    batches: () => adminApi.userBatches(),
    approvals: () => adminApi.listDevApprovals(),
};
export type SourceKey = keyof typeof sources;
export type DashboardData = { [K in SourceKey]?: Awaited<ReturnType<typeof sources[K]>> };
export interface Snapshot { data: DashboardData; failed: SourceKey[]; queriedAt: Date }
export async function loadDashboard(): Promise<Snapshot> {
    const keys = Object.keys(sources) as SourceKey[];
    const results = await Promise.allSettled(keys.map(key => Promise.resolve().then(() => sources[key]())));
    const data: DashboardData = {};
    const failed: SourceKey[] = [];
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') Object.assign(data, { [keys[i]]: result.value });
        else failed.push(keys[i]);
    });
    return { data, failed, queriedAt: new Date() };
}
export const dateKey = (value: string | Date) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
export const number = (n: unknown): number | undefined => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n)) ? Number(n) : undefined;
export const fmt = (n: unknown, unit = '') => number(n) === undefined ? '미연결' : `${Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 3 })}${unit}`;
export function summarize(data: DashboardData, now = new Date()) {
    const today = dateKey(now);
    const month = today.slice(0, 7);
    const reports = data.reports?.reports;
    const current = reports?.find(r => r.reportDate.slice(0, 10) === today);
    const monthly = reports?.filter(r => r.reportDate.startsWith(month));
    // Only report a month total when every elapsed day is present (reports are usually one day behind).
    const completeMonth = monthly && new Set(monthly.map(r => r.reportDate.slice(0, 10))).size === Number(today.slice(8));
    const features = new Map<string, number>();
    data.marketing?.rows.forEach(r => r.features.forEach(f => features.set(f.name, (features.get(f.name) || 0) + f.n)));
    const members = data.users?.filter(u => u.provider !== 'guest');
    return {
        todayRevenue: current?.revenueKrw,
        monthRevenue: completeMonth ? monthly.reduce((s, r) => s + r.revenueKrw, 0) : undefined,
        members: members?.length,
        joined: members?.filter(u => dateKey(u.createdAt) === today).length,
        features: [...features].sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
}
export type Destination = 'monitor' | 'batch-jobs' | 'herdr';
export interface Attention { label: string; count: number; tab: Destination }
export function attention(data: DashboardData): Attention[] {
    const items: Attention[] = [];
    const add = (label: string, count: number | undefined, tab: Destination) => { if (count && count > 0) items.push({ label, count, tab }); };
    add('오늘 오류', data.errors?.today, 'monitor');
    const sol = data.balances?.solapi;
    if (sol && !sol.error && number(sol.balance) !== undefined && number(sol.lowBalanceThreshold) !== undefined)
        add('솔라피 잔액 부족', Number(sol.balance) < Number(sol.lowBalanceThreshold) ? 1 : 0, 'monitor');
    if (!data.balances?.googleTts?.error) add('TTS 무료한도 임박', Number(data.balances?.googleTts?.usedPercent) >= 80 ? 1 : 0, 'monitor');
    add('실패 배치', data.batches?.rows.filter(r => r.status === 'failed').length, 'batch-jobs');
    add('배치 대기', data.batches?.pending, 'batch-jobs');
    add('승인 대기', data.approvals?.approvals.length, 'herdr');
    if (data.cron?.server1Ok === false) add('서버1 크론 조회 불가', 1, 'batch-jobs');
    return items;
}
