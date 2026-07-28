import React, { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../services/apiService';

// ⏰ 배치 작업 대시보드 (2026-07-29 신설)
// 서버 크론(우리가 건 정기 작업)과 사용자 배치(회원 신청 큐)를 탭으로 구분해 본다.
// ★크론 시각은 UTC로 저장되지만 화면에는 KST로 환산해 보여준다(서버 TZ=UTC).
// ★수정은 시각(분/시/요일)만 가능 — 명령어·경로는 서버에서 잠가 오타 사고를 막는다.

interface Job {
    id: string; server: string; name: string; desc: string; kind: string;
    cycle: string; when: string; log: string; cron: string;
    minute: string; hour: string; dom: string; mon: string; dow: string; cmd: string;
}
interface UserRow { kind: string; id: string; status: string; user: string; title: string; createdAt: string }

const KIND_STYLE: Record<string, string> = {
    보고: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    백업: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    배치: 'bg-gray-600/20 text-gray-300 border-gray-600/40',
};
const CYCLES = ['매일', '주간', '매시', '매분', '월간', '재부팅', '기타'];

const STATUS_STYLE: Record<string, string> = {
    pending: 'text-yellow-300', running: 'text-blue-300', producing: 'text-blue-300',
    waiting: 'text-yellow-300', done: 'text-emerald-300', failed: 'text-red-400',
};

export const BatchJobsPanel: React.FC = () => {
    const [tab, setTab] = useState<'server' | 'user'>('server');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [now, setNow] = useState('');
    const [srv1Ok, setSrv1Ok] = useState(true);
    const [users, setUsers] = useState<UserRow[]>([]);
    const [pending, setPending] = useState(0);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('전체');
    const [editing, setEditing] = useState<Job | null>(null);
    const [form, setForm] = useState({ hour: '0', minute: '0', dow: '*' });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            adminApi.cronJobs().catch(e => { setErr(e?.message || '조회 실패'); return null; }),
            adminApi.userBatches().catch(() => null),
        ]).then(([c, u]) => {
            if (c) { setJobs(c.jobs || []); setNow(c.now); setSrv1Ok(c.server1Ok); setErr(''); }
            if (u) { setUsers(u.rows || []); setPending(u.pending || 0); }
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    // KST 입력 → UTC 크론 필드로 환산(서버 crontab이 UTC 기준이라 반드시 필요)
    const openEdit = (j: Job) => {
        const utcH = parseInt(j.hour, 10);
        const kstH = Number.isFinite(utcH) ? (utcH + 9) % 24 : 0;
        setForm({ hour: String(kstH), minute: j.minute, dow: j.dow || '*' });
        setMsg('');
        setEditing(j);
    };
    const save = async () => {
        if (!editing) return;
        setSaving(true); setMsg('');
        try {
            const kstH = parseInt(form.hour, 10);
            const utcH = ((kstH - 9) % 24 + 24) % 24;   // KST → UTC
            // 요일 지정 작업은 KST 기준 요일이 UTC로 하루 당겨질 수 있다.
            let dow = form.dow;
            if (dow !== '*' && kstH < 9) {
                dow = dow.split(',').map(d => (d.trim().match(/^\d$/) ? String((parseInt(d, 10) + 6) % 7) : d)).join(',');
            }
            const r = await adminApi.setCronSchedule({
                server: editing.server,
                cmdMatch: editing.cmd.split(/\s+/).find(s => /\.(py|sh|js|cjs)$/.test(s)) || editing.name,
                minute: String(parseInt(form.minute, 10) || 0),
                hour: String(utcH), dom: editing.dom || '*', mon: editing.mon || '*', dow,
            });
            setMsg(`✅ 변경됨 — ${r.when}`);
            setEditing(null);
            load();
        } catch (e: any) {
            setMsg(`❌ ${e?.message || '변경 실패'}`);
        } finally { setSaving(false); }
    };

    if (loading) return <div className="p-4 text-gray-400 text-sm">불러오는 중…</div>;

    const shown = jobs.filter(j => filter === '전체' || j.cycle === filter);
    const byCycle = (c: string) => jobs.filter(j => j.cycle === c).length;
    const count = (k: string) => jobs.filter(j => j.kind === k).length;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">⏰ 배치 작업 대시보드</p>
                    <p className="text-xs text-gray-500">
                        현재 {now} (KST) · 시각은 모두 한국시간 표시
                        {!srv1Ok && <span className="text-red-400 ml-2">· ⚠️ 서버1 조회 실패</span>}
                    </p>
                </div>
                <button onClick={load} className="px-3 py-1 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-300 hover:text-white">
                    새로고침
                </button>
            </div>

            {err && <div className="text-red-400 text-sm">{err}</div>}
            {msg && <div className={`text-sm ${msg.startsWith('✅') ? 'text-emerald-300' : 'text-red-400'}`}>{msg}</div>}

            {/* 탭: 서버 배치 vs 사용자 배치 */}
            <div className="flex gap-1 border-b border-gray-700">
                {([['server', `서버 배치 (${jobs.length})`], ['user', `사용자 배치 (${pending} 대기)`]] as const).map(([k, label]) => (
                    <button key={k} onClick={() => setTab(k as any)}
                        className={`px-4 py-2 text-xs rounded-t-lg border-b-2 ${tab === k
                            ? 'border-purple-500 text-white bg-gray-800/50'
                            : 'border-transparent text-gray-400 hover:text-white'}`}>
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'server' && (
                <>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                            <p className="text-xs text-gray-400">📤 텔레그램 보고</p>
                            <p className="text-xl font-bold text-blue-300">{count('보고')}</p>
                        </div>
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                            <p className="text-xs text-gray-400">💾 백업</p>
                            <p className="text-xl font-bold text-amber-300">{count('백업')}</p>
                        </div>
                        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                            <p className="text-xs text-gray-400">⚙️ 처리 배치</p>
                            <p className="text-xl font-bold text-gray-300">{count('배치')}</p>
                        </div>
                    </div>

                    {/* 주기 필터 — 매일/주간 구분해서 보기 */}
                    <div className="flex flex-wrap gap-1">
                        {['전체', ...CYCLES.filter(c => byCycle(c) > 0)].map(c => (
                            <button key={c} onClick={() => setFilter(c)}
                                className={`px-3 py-1 rounded-lg text-xs border ${filter === c
                                    ? 'bg-purple-600 border-purple-500 text-white'
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                                {c} {c !== '전체' && `(${byCycle(c)})`}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[720px]">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-700">
                                    <th className="text-left py-2 px-2">종류</th>
                                    <th className="text-left py-2 px-2">작업</th>
                                    <th className="text-left py-2 px-2">서버</th>
                                    <th className="text-left py-2 px-2">주기</th>
                                    <th className="text-left py-2 px-2">실행 시각 (KST)</th>
                                    <th className="text-right py-2 px-2">수정</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map(j => (
                                    <tr key={j.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                                        <td className="py-2 px-2">
                                            <span className={`px-2 py-0.5 rounded border text-[10px] ${KIND_STYLE[j.kind] || KIND_STYLE.배치}`}>
                                                {j.kind}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2">
                                            <div className="text-gray-100">{j.name}</div>
                                            {j.desc && <div className="text-[10px] text-gray-500 max-w-[280px] truncate" title={j.desc}>{j.desc}</div>}
                                        </td>
                                        <td className="py-2 px-2 text-gray-400">{j.server}</td>
                                        <td className="py-2 px-2 text-gray-400">{j.cycle}</td>
                                        <td className="py-2 px-2 text-white font-medium">{j.when}</td>
                                        <td className="text-right py-2 px-2">
                                            {j.cycle === '재부팅' ? (
                                                <span className="text-gray-600">—</span>
                                            ) : (
                                                <button onClick={() => openEdit(j)}
                                                    className="px-2 py-1 rounded bg-gray-700 hover:bg-purple-600 text-gray-200 text-[11px]">
                                                    시간 변경
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[11px] text-gray-500">
                        ※ 변경 가능한 건 <b className="text-gray-400">실행 시각</b>뿐입니다(명령어·경로는 잠금).
                        수정 시 서버 crontab이 자동 백업됩니다.
                    </p>
                </>
            )}

            {tab === 'user' && (
                <div className="overflow-x-auto">
                    <p className="text-xs text-gray-500 mb-2">회원이 신청해 큐에 쌓인 작업입니다(최근 20건씩).</p>
                    <table className="w-full text-xs min-w-[560px]">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="text-left py-2 px-2">종류</th>
                                <th className="text-left py-2 px-2">신청자</th>
                                <th className="text-left py-2 px-2">내용</th>
                                <th className="text-left py-2 px-2">상태</th>
                                <th className="text-left py-2 px-2">신청 시각</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr><td colSpan={5} className="py-6 text-center text-gray-500">신청된 작업이 없습니다.</td></tr>
                            ) : users.map((r, i) => (
                                <tr key={`${r.kind}-${r.id}-${i}`} className="border-b border-gray-800 hover:bg-gray-800/40">
                                    <td className="py-2 px-2 text-gray-200">{r.kind}</td>
                                    <td className="py-2 px-2 text-gray-400">{r.user}</td>
                                    <td className="py-2 px-2 text-gray-400 max-w-[240px] truncate" title={r.title}>{r.title || '—'}</td>
                                    <td className={`py-2 px-2 font-medium ${STATUS_STYLE[r.status] || 'text-gray-400'}`}>{r.status}</td>
                                    <td className="py-2 px-2 text-gray-500">{r.createdAt}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 시각 변경 모달 */}
            {editing && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"
                    onClick={() => setEditing(null)}>
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 w-full max-w-sm"
                        onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-semibold text-white mb-1">실행 시각 변경</p>
                        <p className="text-xs text-gray-400 mb-4">
                            {editing.name} <span className="text-gray-600">({editing.server})</span>
                            <br />현재: <span className="text-gray-300">{editing.when}</span>
                        </p>
                        <div className="flex items-end gap-2 mb-3">
                            <div className="flex-1">
                                <label className="block text-[11px] text-gray-400 mb-1">시 (KST)</label>
                                <select value={form.hour} onChange={e => setForm({ ...form, hour: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white">
                                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[11px] text-gray-400 mb-1">분</label>
                                <select value={form.minute} onChange={e => setForm({ ...form, minute: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-white">
                                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => (
                                        <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        {editing.dow !== '*' && (
                            <p className="text-[11px] text-amber-300/80 mb-3">
                                ※ 요일 지정 작업입니다(현재 {editing.cycle}). 요일은 유지되며 시각만 바뀝니다.
                            </p>
                        )}
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(null)}
                                className="flex-1 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm">
                                취소
                            </button>
                            <button onClick={save} disabled={saving}
                                className="flex-1 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm">
                                {saving ? '변경 중…' : '변경'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
