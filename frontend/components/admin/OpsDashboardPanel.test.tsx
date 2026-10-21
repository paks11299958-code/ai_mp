import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { adminApi } from '../../services/apiService';
import { attention, dateKey, loadDashboard, sources, summarize } from './opsDashboard';
import { OpsDashboardPanel } from './OpsDashboardPanel';
vi.mock('../../services/apiService', () => ({ adminApi: Object.fromEntries(['bizDailyReports','bizDirectives','getUsers','referralStats','marketingDaily','getPointSettlement','getMonitorMetrics','getServer2Metrics','getBalances','getErrorSummary','cronJobs','userBatches','listDevApprovals'].map(k => [k, vi.fn()])) }));
beforeEach(() => {
    Object.values(adminApi).forEach(fn => vi.mocked(fn).mockRejectedValue(new Error('offline')));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('settles every source when all fail', async () => {
    const s = await loadDashboard(); expect(s.failed).toHaveLength(Object.keys(sources).length); expect(s.data).toEqual({});
});
it('retains successful APIs when a sibling fails', async () => {
    vi.mocked(adminApi.getErrorSummary).mockResolvedValue({ today: 3, yesterday: 0, recent: [] });
    const s = await loadDashboard(); expect(s.data.errors?.today).toBe(3); expect(s.failed).not.toContain('errors');
});
it('does not label yesterday revenue as today or incomplete month as total', () => {
    const s = summarize({ reports: { reports: [{ reportDate: '2026-10-20', revenueKrw: 900 }] as any } }, new Date('2026-10-21T03:00Z'));
    expect(s.todayRevenue).toBeUndefined(); expect(s.monthRevenue).toBeUndefined();
});
it('sums complete current month excluding previous month', () => {
    const reports = [{ reportDate: '2026-10-01', revenueKrw: 10 }, { reportDate: '2026-10-02', revenueKrw: 20 }, { reportDate: '2026-09-30', revenueKrw: 100 }] as any;
    expect(summarize({ reports: { reports } }, new Date('2026-10-02T03:00Z')).monthRevenue).toBe(30);
});
it('uses KST and excludes guests', () => {
    expect(dateKey('2026-10-20T16:00Z')).toBe('2026-10-21');
    const users = [{ provider: 'guest', createdAt: '2026-10-21T00:00Z' }, { provider: 'email', createdAt: '2026-10-20T16:00Z' }] as any;
    expect(summarize({ users }, new Date('2026-10-21T01:00Z'))).toMatchObject({ members: 1, joined: 1 });
});
it('aggregates feature counts into descending top eight', () => {
    const rows = [{ features: Array.from({ length: 10 }, (_, i) => ({ name: `f${i}`, n: i })) }, { features: [{ name: 'f0', n: 100 }] }] as any;
    const f = summarize({ marketing: { days: 30, rows } }).features; expect(f).toHaveLength(8); expect(f[0]).toEqual(['f0', 100]);
});
it('does not invent warnings without thresholds or data', () => {
    expect(attention({})).toEqual([]);
    expect(attention({ balances: { solapi: { balance: 0 }, openai: null, googleTts: null } })).toEqual([]);
    expect(attention({ errors: { today: 2, yesterday: 0, recent: [] }, batches: { rows: [{ status: 'failed' }] as any, pending: 3 } }).reduce((n, i) => n + i.count, 0)).toBe(6);
});
it('renders all-failed state and retries without fake zero KPIs', async () => {
    render(<OpsDashboardPanel onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText(/조회 실패 · 다시 시도/).length).toBeGreaterThan(0));
    expect(screen.getAllByText('미연결').length).toBeGreaterThan(0); expect(screen.queryByText('0원')).toBeNull();
    fireEvent.click(screen.getAllByText(/조회 실패 · 다시 시도/)[0]);
    await waitFor(() => expect(adminApi.bizDailyReports).toHaveBeenCalledTimes(2));
});
it('renders partial success and navigates to the relevant tab', async () => {
    vi.mocked(adminApi.getErrorSummary).mockResolvedValue({ today: 7, yesterday: 0, recent: ['QA error summary'] });
    const navigate = vi.fn(); render(<OpsDashboardPanel onNavigate={navigate} />);
    await screen.findByText('7건'); expect(screen.getByText('QA error summary')).toBeTruthy();
    fireEvent.click(screen.getByText('해당 탭으로 →')); expect(navigate).toHaveBeenCalledWith('monitor');
});
it('refreshes every minute and cancels timer on unmount', async () => {
    vi.useFakeTimers(); const view = render(<OpsDashboardPanel onNavigate={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); }); expect(adminApi.bizDailyReports).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(adminApi.bizDailyReports).toHaveBeenCalledTimes(2);
    view.unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(adminApi.bizDailyReports).toHaveBeenCalledTimes(2);
});
