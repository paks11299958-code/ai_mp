import React, { useEffect, useState } from 'react';
import { homepageApi, type HomepageAdminRow } from '../../services/apiService';

// 🛠️ 홈페이지 신청 관리 — 회원들이 만든 홈페이지 신청을 사장이 한눈에.
// 누가·언제·상태·결과주소·과금 + 밀린 건(대기 경과분) 감지. 데이터=HomepageRequest(운영 DB).
// 정본 메모리=[[project_homepage_builder]].

const STATUS_META: Record<string, { label: string; cls: string }> = {
    pending:    { label: '대기', cls: 'bg-amber-950 text-amber-100' },
    processing: { label: '제작 중', cls: 'bg-blue-950 text-blue-100' },
    done:       { label: '완료', cls: 'bg-green-950 text-green-100' },
    failed:     { label: '실패', cls: 'bg-red-950 text-red-100' },
};

const FILTERS = [
    { key: '', label: '전체' },
    { key: 'pending', label: '대기' },
    { key: 'processing', label: '제작 중' },
    { key: 'done', label: '완료' },
    { key: 'failed', label: '실패' },
];

function parseForm(json?: string): Record<string, string> {
    try { return json ? JSON.parse(json) : {}; } catch { return {}; }
}
function fmtDate(s?: string | null): string {
    if (!s) return '';
    try { return new Date(s).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return s; }
}

export const HomepageRequestsPanel: React.FC = () => {
    const [filter, setFilter] = useState('');
    const [rows, setRows] = useState<HomepageAdminRow[]>([]);
    const [summary, setSummary] = useState<{ byStatus: Record<string, number>; withinOpsHours: boolean; opsWaitMinutes: number; opsHours: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [openId, setOpenId] = useState<number | null>(null);

    const load = React.useCallback(() => {
        setLoading(true);
        Promise.all([homepageApi.adminList(filter), homepageApi.adminSummary()])
            .then(([list, sum]) => { setRows(list); setSummary(sum); setErr(''); })
            .catch(e => setErr(e?.message || '목록을 불러오지 못했어요.'))
            .finally(() => setLoading(false));
    }, [filter]);
    useEffect(load, [load]);

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white">🏠 홈페이지 신청 관리</h2>
                    <p className="text-xs text-gray-400 mt-0.5">회원들이 만든 홈페이지 신청 내역이에요.</p>
                </div>
                <button onClick={load} className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-700 text-gray-200 hover:bg-gray-800">🔄 새로고침</button>
            </div>

            {/* 상단 요약 — 상태별 건수 + 운영시간 */}
            {summary && (
                <div className="flex items-center gap-2 flex-wrap">
                    {['pending', 'processing', 'done', 'failed'].map(s => (
                        <span key={s} className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_META[s].cls}`}>
                            {STATUS_META[s].label} {summary.byStatus[s] || 0}
                        </span>
                    ))}
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${summary.withinOpsHours ? 'bg-green-950 text-green-200' : 'bg-gray-800 text-gray-300'}`}>
                        {summary.withinOpsHours ? '🟢 제작 시간대 가동 중' : `🌙 제작 정지(${summary.opsHours})`}
                    </span>
                </div>
            )}

            {/* 밀림 경고 — 대기/제작 중인데 60분 넘게 안 끝난 건 */}
            {rows.some(r => (r.waitingMinutes ?? 0) >= 60) && (
                <div className="bg-red-950 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-100">
                    ⚠️ 60분 넘게 진행 중인 신청이 있어요. 워커 상태를 확인해 주세요.
                </div>
            )}

            {/* 필터 */}
            <div className="flex gap-2 flex-wrap">
                {FILTERS.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${filter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {err && (
                <div className="bg-red-950 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-100 flex justify-between gap-3">
                    <span>{err}</span>
                    <button onClick={() => setErr('')} className="text-xs font-bold underline flex-shrink-0">닫기</button>
                </div>
            )}

            {loading ? (
                <p className="text-sm text-gray-500 py-8 text-center">불러오는 중...</p>
            ) : rows.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">신청 내역이 없어요.</p>
            ) : (
                <div className="space-y-2">
                    {rows.map(r => {
                        const form = parseForm(r.formJson);
                        const meta = STATUS_META[r.status] || { label: r.status, cls: 'bg-gray-800 text-gray-200' };
                        const stuck = (r.waitingMinutes ?? 0) >= 60;
                        const open = openId === r.id;
                        return (
                            <div key={r.id} className={`bg-gray-800/60 border rounded-xl overflow-hidden ${stuck ? 'border-red-500/60' : 'border-gray-700'}`}>
                                <button onClick={() => setOpenId(open ? null : r.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-700/50">
                                    <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-md ${meta.cls}`}>{meta.label}</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm truncate text-gray-100">
                                            {form.name || '(상호 미상)'} <span className="font-normal text-gray-400">· {form.biz || '업종?'}</span>
                                        </div>
                                        <div className="text-[11px] text-gray-400 truncate">
                                            {r.userName || r.userEmail || `회원#${r.userId}`} · {fmtDate(r.createdAt)}
                                            {r.waitingMinutes != null && ` · ${r.waitingMinutes}분 경과`}
                                        </div>
                                    </div>
                                    <span className="text-gray-400 flex-shrink-0">{open ? '▲' : '▼'}</span>
                                </button>

                                {open && (
                                    <div className="px-4 pb-4 pt-1 border-t border-gray-700 bg-gray-900/40 text-sm space-y-2 text-gray-200">
                                        <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 text-xs">
                                            <span className="text-gray-400">한 줄 소개</span><span>{form.tagline || '-'}</span>
                                            {form.menu && (<><span className="text-gray-400">메뉴/가격</span><span className="whitespace-pre-wrap">{form.menu}</span></>)}
                                            {form.address && (<><span className="text-gray-400">주소</span><span>{form.address}</span></>)}
                                            {form.phone && (<><span className="text-gray-400">전화</span><span>{form.phone}</span></>)}
                                            {form.mood && (<><span className="text-gray-400">분위기</span><span>{form.mood}</span></>)}
                                            <span className="text-gray-400">과금</span><span>{r.pointsCharged?.toLocaleString()}P</span>
                                        </div>

                                        {r.status === 'done' && r.url && (
                                            <div className="flex gap-2 flex-wrap pt-1">
                                                <a href={r.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700">🌐 홈페이지 보기</a>
                                                {r.zipUrl && <a href={r.zipUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-300 border border-indigo-500/40 px-3 py-1.5 rounded-lg hover:bg-indigo-500/10">📦 소스 zip</a>}
                                            </div>
                                        )}
                                        {r.status === 'failed' && r.errorMessage && (
                                            <div className="text-xs text-red-100 bg-red-950 rounded-lg px-3 py-2">❌ {r.errorMessage}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
