import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/apiService';

// 일자별 마케팅 통계 (2026-07-28 신설)
// 사장이 매일 아침 체크하는 화면. 퍼널 한 줄 = 방문 → 가입 → 실사용 → 정식전환.
// ★게스트는 가입 7일 후 삭제되므로 과거분은 GuestCohortStat 보존값으로 채워진다(fromArchive).

interface Row {
    day: string; visits: number; signups: number; guests: number; members: number;
    referred: number; channels: Record<string, number>; usedUsers: number;
    uses: number; spent: number; features: { name: string; n: number }[];
    hourly: Record<string, number>;
    fromArchive: boolean;
}

const CHANNEL_LABEL: Record<string, string> = {
    KIN: '지식iN', YOUTUBE: '유튜브', SHORTS: '쇼츠', INSTA: '인스타',
    INSTAGRAM: '인스타', THREADS: '스레드', BLOG: '블로그', NAVER: '네이버',
};

export const MarketingDailyPanel: React.FC = () => {
    const [rows, setRows] = useState<Row[]>([]);
    const [days, setDays] = useState(14);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        adminApi.marketingDaily(days)
            .then(d => { setRows(d.rows || []); setError(''); })
            .catch(e => setError(e?.message || '조회 실패'))
            .finally(() => setLoading(false));
    }, [days]);

    if (error) return <div className="p-4 text-red-400 text-sm">마케팅 통계 조회 실패: {error}</div>;
    if (loading) return <div className="p-4 text-gray-400 text-sm">불러오는 중…</div>;

    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const today = rows[0];
    const yday = rows[1];
    // 어제 대비 증감 — "20배" 같은 변화를 눈에 띄게
    const delta = (a: number, b: number) => {
        if (!b) return a > 0 ? '신규' : '—';
        const r = a / b;
        if (r >= 2) return `▲ ${r.toFixed(1)}배`;
        if (a === b) return '—';
        return `${a > b ? '▲' : '▼'} ${Math.abs(a - b)}`;
    };
    const maxSign = Math.max(1, ...rows.map(r => r.signups));

    // 기간 합계 — 채널별 유입은 어느 채널이 실제로 먹히는지 판단하는 핵심 근거
    const totalCh: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.channels)) totalCh[k] = (totalCh[k] || 0) + v;
    const sum = (f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <p className="text-sm font-semibold text-white">📊 일자별 마케팅 성과</p>
                    <p className="text-xs text-gray-500">유입 → 실사용 → 정식전환을 하루 한 줄로. 날짜 클릭 시 상세.</p>
                </div>
                <div className="flex gap-1">
                    {[7, 14, 30].map(d => (
                        <button key={d} onClick={() => setDays(d)}
                            className={`px-3 py-1 rounded-lg text-xs border ${days === d
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'}`}>
                            {d}일
                        </button>
                    ))}
                </div>
            </div>

            {/* 오늘 요약 — 어제 대비 증감까지 */}
            {today && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">오늘 유입</p>
                        <p className="text-2xl font-bold text-white">{today.signups}</p>
                        <p className="text-[11px] text-gray-500">어제 {yday?.signups ?? 0} · {delta(today.signups, yday?.signups ?? 0)}</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">실제 사용</p>
                        <p className="text-2xl font-bold text-emerald-300">{today.usedUsers}</p>
                        <p className="text-[11px] text-gray-500">사용률 {pct(today.usedUsers, today.signups)}% · {today.uses}건</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">정식 전환</p>
                        <p className={`text-2xl font-bold ${today.members > 0 ? 'text-yellow-300' : 'text-red-400'}`}>{today.members}</p>
                        <p className="text-[11px] text-gray-500">전환율 {pct(today.members, today.signups)}%</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">소진 포인트</p>
                        <p className="text-2xl font-bold text-purple-300">{today.spent.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-500">링크 방문 {today.visits}</p>
                    </div>
                </div>
            )}

            {/* 채널별 유입 — 어디에 힘을 쏟을지 판단하는 근거 */}
            <div>
                <p className="text-sm font-semibold text-white mb-2">채널별 유입 ({days}일 합계)</p>
                {Object.keys(totalCh).length === 0 ? (
                    <p className="text-xs text-gray-500">채널 태그가 붙은 유입이 아직 없습니다.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(totalCh).sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                            <div key={code} className="bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                                <span className="text-xs text-gray-400">{CHANNEL_LABEL[code] || code}</span>
                                <span className="ml-2 text-sm font-bold text-white">{n}명</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 일별 표 */}
            <div>
                <p className="text-sm font-semibold text-white mb-2">일별 상세</p>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[640px]">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="text-left py-2 px-2">날짜</th>
                                <th className="text-right py-2 px-2">방문</th>
                                <th className="text-right py-2 px-2">유입</th>
                                <th className="text-right py-2 px-2">사용자</th>
                                <th className="text-right py-2 px-2">사용률</th>
                                <th className="text-right py-2 px-2">전환</th>
                                <th className="text-left py-2 px-2 w-32">추이</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const rate = pct(r.usedUsers, r.signups);
                                return (
                                    <React.Fragment key={r.day}>
                                        <tr onClick={() => setOpen(open === r.day ? null : r.day)}
                                            className="border-b border-gray-800 hover:bg-gray-800/40 cursor-pointer">
                                            <td className="py-2 px-2 text-gray-200">
                                                {r.day.slice(5)}
                                                {r.fromArchive && <span className="ml-1 text-[10px] text-gray-500" title="게스트 삭제분 — 보존 통계">📦</span>}
                                            </td>
                                            <td className="text-right py-2 px-2 text-gray-400">{r.visits || '—'}</td>
                                            <td className="text-right py-2 px-2 font-semibold text-white">{r.signups || '—'}</td>
                                            <td className="text-right py-2 px-2 text-emerald-300">{r.usedUsers || '—'}</td>
                                            <td className={`text-right py-2 px-2 ${rate >= 20 ? 'text-emerald-300' : 'text-gray-500'}`}>
                                                {r.signups ? `${rate}%` : '—'}
                                            </td>
                                            <td className={`text-right py-2 px-2 font-semibold ${r.members > 0 ? 'text-yellow-300' : 'text-gray-600'}`}>
                                                {r.members || 0}
                                            </td>
                                            <td className="py-2 px-2">
                                                <div className="h-2 bg-purple-500/70 rounded"
                                                    style={{ width: `${Math.max(2, (r.signups / maxSign) * 100)}%` }} />
                                            </td>
                                        </tr>
                                        {open === r.day && (
                                            <tr className="bg-gray-900/60">
                                                <td colSpan={7} className="px-4 py-3">
                                                    <div className="space-y-2">
                                                        <div>
                                                            <span className="text-gray-400">채널: </span>
                                                            {Object.keys(r.channels).length === 0
                                                                ? <span className="text-gray-600">태그 없음(직접 유입)</span>
                                                                : Object.entries(r.channels).map(([c, n]) => (
                                                                    <span key={c} className="mr-2 text-gray-200">
                                                                        {CHANNEL_LABEL[c] || c} {n}
                                                                    </span>
                                                                ))}
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">사용 기능: </span>
                                                            {r.features.length === 0
                                                                ? <span className="text-gray-600">없음</span>
                                                                : r.features.map(f => (
                                                                    <span key={f.name} className="mr-2 text-gray-200">{f.name} {f.n}</span>
                                                                ))}
                                                        </div>
                                                        <div className="text-gray-400">
                                                            게스트 {r.guests} · 정식 {r.members} · 추천 경유 {r.referred} · 소진 {r.spent.toLocaleString()}P
                                                        </div>
                                                        {/* 시간대별 유입 — 몰린 시간을 보면 유입 경로의 성격이 보인다 */}
                                                        {Object.keys(r.hourly || {}).length > 0 && (
                                                            <div>
                                                                <span className="text-gray-400">시간대: </span>
                                                                <div className="inline-flex items-end gap-[2px] h-8 ml-1 align-bottom">
                                                                    {Array.from({ length: 24 }, (_, h) => {
                                                                        const n = Number(r.hourly?.[String(h)] || 0);
                                                                        const mx = Math.max(1, ...Object.values(r.hourly || {}).map(Number));
                                                                        return (
                                                                            <div key={h} title={`${h}시 ${n}명`}
                                                                                className={`w-2 rounded-sm ${n > 0 ? 'bg-purple-400' : 'bg-gray-700'}`}
                                                                                style={{ height: `${n > 0 ? Math.max(12, (n / mx) * 100) : 6}%` }} />
                                                                        );
                                                                    })}
                                                                </div>
                                                                <span className="ml-2 text-[11px] text-gray-500">
                                                                    최다 {Object.entries(r.hourly).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0]}시
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="text-gray-300 font-semibold border-t border-gray-700">
                                <td className="py-2 px-2">합계</td>
                                <td className="text-right py-2 px-2">{sum(r => r.visits)}</td>
                                <td className="text-right py-2 px-2">{sum(r => r.signups)}</td>
                                <td className="text-right py-2 px-2">{sum(r => r.usedUsers)}</td>
                                <td className="text-right py-2 px-2">{pct(sum(r => r.usedUsers), sum(r => r.signups))}%</td>
                                <td className="text-right py-2 px-2">{sum(r => r.members)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                    📦 = 게스트가 삭제돼 보존 통계로 채운 날. 전환 = 정식 회원가입 수(게스트→정식 포함).
                </p>
            </div>
        </div>
    );
};
