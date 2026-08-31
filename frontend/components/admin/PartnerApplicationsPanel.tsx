import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, type PartnerApplicationAdminRow, type PartnerApplicationStatus } from '../../services/apiService';

const META: Record<PartnerApplicationStatus, { label: string; cls: string }> = {
    PENDING: { label: '접수', cls: 'bg-amber-950 text-amber-200 border-amber-800' },
    CONTACTED: { label: '연락 완료', cls: 'bg-blue-950 text-blue-200 border-blue-800' },
    APPROVED: { label: '승인', cls: 'bg-emerald-950 text-emerald-200 border-emerald-800' },
    REJECTED: { label: '반려', cls: 'bg-red-950 text-red-200 border-red-800' },
};
const FILTERS: { key: '' | PartnerApplicationStatus; label: string }[] = [
    { key: '', label: '전체' }, { key: 'PENDING', label: '접수' },
    { key: 'CONTACTED', label: '연락 완료' }, { key: 'APPROVED', label: '승인' },
    { key: 'REJECTED', label: '반려' },
];

function fmt(value?: string | null) {
    if (!value) return '-';
    return new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const PartnerApplicationsPanel: React.FC = () => {
    const [filter, setFilter] = useState<'' | PartnerApplicationStatus>('');
    const [rows, setRows] = useState<PartnerApplicationAdminRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState('');
    const [openId, setOpenId] = useState('');
    const [memos, setMemos] = useState<Record<string, string>>({});

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await adminApi.getPartnerApplications(filter);
            setRows(list);
            setMemos(Object.fromEntries(list.map(row => [row.id, row.managerMemo || ''])));
            setError('');
        } catch (e: any) { setError(e?.message || '신청 목록을 불러오지 못했습니다.'); }
        finally { setLoading(false); }
    }, [filter]);
    useEffect(() => { void load(); }, [load]);

    const update = async (row: PartnerApplicationAdminRow, status: PartnerApplicationStatus) => {
        setSaving(row.id);
        try {
            await adminApi.updatePartnerApplication(row.id, status, memos[row.id] || '');
            await load();
        } catch (e: any) { setError(e?.message || '상태를 변경하지 못했습니다.'); }
        finally { setSaving(''); }
    };
    const updateRole = async (row: PartnerApplicationAdminRow) => {
        setSaving(row.id);
        try { await adminApi.updatePartnerApprovalRole(row.accountId, row.approvalRole === 'APPROVER' ? 'PARTNER' : 'APPROVER'); await load(); }
        catch (e: any) { setError(e?.message || '승인 담당자 권한을 변경하지 못했습니다.'); }
        finally { setSaving(''); }
    };

    const counts = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-lg font-bold text-white">🤝 B2B 파트너 신청</h2>
                    <p className="text-xs text-gray-400 mt-1">AI World 파트너 계정과 신청은 일반 회원과 분리되어 있습니다.</p>
                </div>
                <button onClick={() => void load()} className="min-h-10 px-3 rounded-lg border border-gray-700 text-xs font-bold text-gray-200 hover:bg-gray-800">새로고침</button>
            </div>
            <div className="flex gap-2 flex-wrap">
                {FILTERS.map(item => (
                    <button key={item.key || 'all'} onClick={() => setFilter(item.key)}
                        className={`min-h-9 px-3 rounded-lg border text-xs font-bold ${filter === item.key ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                        {item.label}{item.key && filter === '' ? ` ${counts[item.key] || 0}` : ''}
                    </button>
                ))}
            </div>
            {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-100">{error}</div>}
            {loading ? <p className="py-10 text-center text-sm text-gray-500">불러오는 중...</p> : rows.length === 0 ?
                <p className="py-10 text-center text-sm text-gray-500">해당 파트너 신청이 없습니다.</p> :
                <div className="space-y-2">{rows.map(row => {
                    const meta = META[row.status];
                    const open = openId === row.id;
                    return <article key={row.id} className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/60">
                        <button onClick={() => setOpenId(open ? '' : row.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-gray-700/50">
                            <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-bold ${meta.cls}`}>{meta.label}</span>
                            <span className="min-w-0 flex-1"><b className="block truncate text-sm text-white">{row.name} · {row.loginId}</b><span className="block truncate text-xs text-gray-400">{row.phone} · {row.email} · {fmt(row.createdAt)}</span></span>
                            <span className="text-gray-500">{open ? '▲' : '▼'}</span>
                        </button>
                        {open && <div className="space-y-4 border-t border-gray-700 bg-gray-900/40 p-4">
                            <dl className="grid grid-cols-[90px_1fr] gap-2 text-xs">
                                <dt className="text-gray-500">추천인</dt><dd className="text-gray-200">{row.referrer || '-'}</dd>
                                <dt className="text-gray-500">연결 추천인</dt><dd className="text-gray-200">{row.referrerLoginId || '-'}</dd>
                                <dt className="text-gray-500">최근 로그인</dt><dd className="text-gray-200">{fmt(row.lastLoginAt)}</dd>
                                <dt className="text-gray-500">연락 완료</dt><dd className="text-gray-200">{fmt(row.contactedAt)}</dd>
                                <dt className="text-gray-500">승인</dt><dd className="text-gray-200">{fmt(row.approvedAt)}</dd>
                            </dl>
                            <label className="block text-xs font-bold text-gray-300">담당자 메모
                                <textarea value={memos[row.id] || ''} maxLength={2000} rows={3} onChange={e => setMemos(m => ({ ...m, [row.id]: e.target.value }))}
                                    className="mt-2 w-full resize-y rounded-lg border border-gray-700 bg-gray-950 p-3 text-sm font-normal text-gray-100" />
                            </label>
                            <div className="flex gap-2 flex-wrap">
                                {(Object.keys(META) as PartnerApplicationStatus[]).map(status => <button key={status} disabled={saving === row.id || row.status === status} onClick={() => void update(row, status)}
                                    className="min-h-10 rounded-lg border border-gray-600 px-3 text-xs font-bold text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40">{META[status].label}</button>)}
                            </div>
                            <button disabled={saving === row.id || row.status !== 'APPROVED'} onClick={() => void updateRole(row)} className="min-h-10 rounded-lg border border-indigo-700 px-3 text-xs font-bold text-indigo-200 disabled:opacity-40">
                                {row.approvalRole === 'APPROVER' ? '승인 담당자 해제' : '승인 담당자로 지정'}
                            </button>
                        </div>}
                    </article>;
                })}</div>}
        </div>
    );
};
