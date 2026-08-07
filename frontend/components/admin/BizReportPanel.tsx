import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/apiService';

// 📊 경영 리포트 패널 (2026-07-11 헤르메스 경영 루프 Phase 1)
// 데이터 = 서버2 biz_report.py(매일 KST09:03)가 쌓는 DailyBizReport.
// 지시 추적 = biz_council.py(화·금 09:30)가 쌓는 BizDirective. (사장 요구: 당일 매출·비용 한눈에)

interface Report {
    reportDate: string; revenueKrw: number; chargeCount: number; aiCostUsd: number;
    // ★newUsers=정회원만, guestUsers=레퍼럴 체험계정. 합산 표시 금지(2026-08-07).
    //   합쳐 보여주던 시절 7월 "43명"이 실회원 17명이었고, 8월 실회원 0명을 17명으로 오독했다.
    newUsers: number; guestUsers?: number; dau: number; chatCount: number; pointSpent: number;
    topFeatures: { name: string; count: number }[]; errorCount: number; tossPnlKrw: number | null;
}
interface Directive {
    id: number; createdDate: string; title: string; detail: string | null; assignee: string | null;
    status: string; devRequestId: number | null; resultNote: string | null; effectNote: string | null;
}

const USD_KRW = 1400; // 표시용 환율(biz_report.py와 동일)
const won = (n: number) => `${n.toLocaleString()}원`;
const d10 = (s: string) => String(s).slice(0, 10);

const STATUS_LABEL: Record<string, [string, string]> = {
    proposed: ['제안됨', 'text-gray-300 bg-gray-700/60'],
    queued: ['큐 대기', 'text-blue-300 bg-blue-900/40'],
    boss_decision: ['사장 결정', 'text-yellow-300 bg-yellow-900/40'],
    done: ['완료', 'text-green-300 bg-green-900/40'],
    failed: ['실패', 'text-red-300 bg-red-900/40'],
    evaluated: ['자평 완료', 'text-purple-300 bg-purple-900/40'],
};

export const BizReportPanel: React.FC = () => {
    const [reports, setReports] = useState<Report[]>([]);
    const [directives, setDirectives] = useState<Directive[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        adminApi.bizDailyReports(30).then(d => setReports(d.reports)).catch(e => setError(e?.message || '조회 실패'));
        adminApi.bizDirectives().then(d => setDirectives(d.directives)).catch(() => {});
    }, []);

    if (error) return <div className="p-4 text-red-400 text-sm">경영 리포트 조회 실패: {error}</div>;
    if (!reports.length) {
        return <div className="p-4 text-gray-400 text-sm">아직 리포트가 없습니다 — 헤르메스가 매일 아침 09:03에 전날 집계를 쌓습니다.</div>;
    }

    const latest = reports[0];
    const aiKrw = (r: Report) => Math.round(r.aiCostUsd * USD_KRW);
    const profit = (r: Report) => r.revenueKrw - aiKrw(r);
    const sum = (f: (r: Report) => number) => reports.reduce((a, r) => a + f(r), 0);
    const trend = [...reports.slice(0, 14)].reverse();
    const maxRev = Math.max(1, ...trend.map(r => r.revenueKrw));

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 최신일 카드 */}
            <div>
                <p className="text-sm font-semibold text-white mb-1">최근 집계 — {d10(latest.reportDate)}</p>
                <p className="text-xs text-gray-500 mb-3">헤르메스가 매일 아침 전날(KST) 숫자를 실측 집계합니다. 순익 = 매출 − AI비용.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">매출</p>
                        <p className="text-2xl font-bold text-green-300">{won(latest.revenueKrw)}</p>
                        <p className="text-[11px] text-gray-500">충전 {latest.chargeCount}건 · 30일 누적 {won(sum(r => r.revenueKrw))}</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">AI 비용</p>
                        <p className="text-2xl font-bold text-red-300">{won(aiKrw(latest))}</p>
                        <p className="text-[11px] text-gray-500">${latest.aiCostUsd} · 30일 누적 {won(sum(aiKrw))}</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">순익(개략)</p>
                        <p className={`text-2xl font-bold ${profit(latest) >= 0 ? 'text-white' : 'text-red-300'}`}>{won(profit(latest))}</p>
                        <p className="text-[11px] text-gray-500">30일 누적 {won(sum(profit))}</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">활동</p>
                        <p className="text-2xl font-bold text-purple-300">{latest.dau}<span className="text-sm font-medium text-gray-400"> DAU</span></p>
                        <p className="text-[11px] text-gray-500">신규 정회원 {latest.newUsers}(체험 {latest.guestUsers ?? 0}) · 채팅 {latest.chatCount} · 에러 {latest.errorCount}</p>
                    </div>
                </div>
            </div>

            {/* 14일 매출 추이 */}
            <div>
                <p className="text-sm font-semibold text-white mb-2">일별 매출 (최근 14일)</p>
                <div className="flex items-end gap-1.5 h-24 bg-gray-800/40 border border-gray-700 rounded-xl p-3">
                    {trend.map(r => (
                        <div key={r.reportDate} className="flex-1 flex flex-col items-center gap-1" title={`${d10(r.reportDate)} ${won(r.revenueKrw)}`}>
                            <div className="w-full bg-green-500/70 rounded-t" style={{ height: `${Math.max(2, (r.revenueKrw / maxRev) * 100)}%` }} />
                            <span className="text-[9px] text-gray-500">{d10(r.reportDate).slice(8)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 일별 상세 표 */}
            <div>
                <p className="text-sm font-semibold text-white mb-2">일별 상세</p>
                <div className="overflow-x-auto border border-gray-700 rounded-xl">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-800 text-gray-400">
                            <tr>{['날짜', '매출', 'AI비용', '순익', '신규(정회원)', '체험', 'DAU', '채팅', '포인트소비', '기능 TOP', '에러', '토스봇'].map(h => (
                                <th key={h} className="px-3 py-2 text-left whitespace-nowrap">{h}</th>))}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {reports.map(r => (
                                <tr key={r.reportDate} className="text-gray-300">
                                    <td className="px-3 py-2 whitespace-nowrap">{d10(r.reportDate)}</td>
                                    <td className={`px-3 py-2 ${r.revenueKrw > 0 ? 'text-green-300 font-bold' : ''}`}>{won(r.revenueKrw)}</td>
                                    <td className="px-3 py-2">{won(aiKrw(r))}</td>
                                    <td className={`px-3 py-2 ${profit(r) < 0 ? 'text-red-300' : ''}`}>{won(profit(r))}</td>
                                    <td className={`px-3 py-2 ${r.newUsers > 0 ? 'text-green-300 font-bold' : 'text-gray-600'}`}>{r.newUsers}</td>
                                    <td className="px-3 py-2 text-gray-500">{r.guestUsers ?? 0}</td>
                                    <td className="px-3 py-2">{r.dau}</td>
                                    <td className="px-3 py-2">{r.chatCount}</td>
                                    <td className="px-3 py-2">{r.pointSpent.toLocaleString()}P</td>
                                    <td className="px-3 py-2 max-w-[220px] truncate">{r.topFeatures.map(f => `${f.name}(${f.count})`).join(', ') || '—'}</td>
                                    <td className={`px-3 py-2 ${r.errorCount > 0 ? 'text-yellow-300' : ''}`}>{r.errorCount}</td>
                                    <td className="px-3 py-2">{r.tossPnlKrw != null ? won(r.tossPnlKrw) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 헤르메스 지시 추적 (Phase 2·3) */}
            <div>
                <p className="text-sm font-semibold text-white mb-1">헤르메스 지시 추적</p>
                <p className="text-xs text-gray-500 mb-2">화·금 09:30 경영 회의에서 헤르메스가 낸 지시와 처리 현황입니다.</p>
                {directives.length === 0 ? (
                    <p className="text-xs text-gray-500 bg-gray-800/40 border border-gray-700 rounded-xl p-3">아직 지시가 없습니다 — 다음 경영 회의(화·금 09:30)에서 생성됩니다.</p>
                ) : (
                    <div className="space-y-2">
                        {directives.map(d => {
                            const [label, cls] = STATUS_LABEL[d.status] ?? [d.status, 'text-gray-300 bg-gray-700/60'];
                            return (
                                <details key={d.id} className="bg-gray-800/40 border border-gray-700 rounded-xl px-3 py-2">
                                    <summary className="cursor-pointer text-xs text-gray-200 flex items-center gap-2 list-none">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{label}</span>
                                        <span className="font-semibold flex-1 truncate">#{d.id} {d.title}</span>
                                        <span className="text-gray-500">{d10(d.createdDate)}{d.assignee ? ` · ${d.assignee}` : ''}</span>
                                    </summary>
                                    <div className="mt-2 text-[11px] text-gray-400 whitespace-pre-wrap">{d.detail}</div>
                                    {d.resultNote && <div className="mt-1.5 text-[11px] text-green-300/80">처리: {d.resultNote}</div>}
                                    {d.effectNote && <div className="mt-1 text-[11px] text-purple-300/80">자평: {d.effectNote}</div>}
                                </details>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
