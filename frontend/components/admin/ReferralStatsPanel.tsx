import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/apiService';

// 레퍼럴(추천인) 지표 패널 (2026-07-07 바이럴 측정 Phase1)
// 퍼널: 링크 방문 → 추천 가입 → 보상 지급(활성). 방문은 ReferralVisit(IP해시 일1회 dedupe) 기준.

interface Funnel {
    visits: number; visitCodes: number; visits7d: number;
    signups: number; signups7d: number; rewarded: number; codeHolders: number;
}
interface TopRow { code: string; invited: number; rewarded: number; owner_name: string | null }
interface DailyRow { day: string; n: number }
interface ChannelRow { code: string; visits: number; signups: number }

export const ReferralStatsPanel: React.FC = () => {
    const [funnel, setFunnel] = useState<Funnel | null>(null);
    const [top, setTop] = useState<TopRow[]>([]);
    const [daily, setDaily] = useState<DailyRow[]>([]);
    const [channels, setChannels] = useState<ChannelRow[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        adminApi.referralStats()
            .then(d => { setFunnel(d.funnel); setTop(d.top); setDaily(d.dailyVisits); setChannels(d.channels || []); })
            .catch(e => setError(e?.message || '조회 실패'));
    }, []);

    if (error) return <div className="p-4 text-red-400 text-sm">레퍼럴 통계 조회 실패: {error}</div>;
    if (!funnel) return <div className="p-4 text-gray-400 text-sm">불러오는 중…</div>;

    const conv = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '—');
    const maxDaily = Math.max(1, ...daily.map(d => d.n));

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
                <p className="text-sm font-semibold text-white mb-1">레퍼럴 퍼널</p>
                <p className="text-xs text-gray-500 mb-3">방문(링크 클릭) → 가입(추천 코드로) → 활성(보상 지급). 방문은 07-07부터 집계.</p>
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">링크 방문</p>
                        <p className="text-2xl font-bold text-white">{funnel.visits}</p>
                        <p className="text-[11px] text-gray-500">최근 7일 {funnel.visits7d} · 코드 {funnel.visitCodes}종</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">추천 가입</p>
                        <p className="text-2xl font-bold text-purple-300">{funnel.signups}</p>
                        <p className="text-[11px] text-gray-500">최근 7일 {funnel.signups7d} · 방문→가입 {conv(funnel.signups, funnel.visits)}</p>
                    </div>
                    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                        <p className="text-xs text-gray-400">보상 지급(활성)</p>
                        <p className="text-2xl font-bold text-yellow-300">{funnel.rewarded}</p>
                        <p className="text-[11px] text-gray-500">가입→활성 {conv(funnel.rewarded, funnel.signups)} · 코드 보유 {funnel.codeHolders}명</p>
                    </div>
                </div>
            </div>

            <div>
                <p className="text-sm font-semibold text-white mb-2">일별 링크 방문 (최근 14일)</p>
                {daily.length === 0 ? (
                    <p className="text-xs text-gray-500">아직 방문 기록이 없습니다.</p>
                ) : (
                    <div className="flex items-end gap-1 h-24 pb-14">
                        {daily.map(d => {
                            const dateStr = String(d.day).slice(0, 10); // "2026-01-02"
                            return (
                                <div key={dateStr} className="flex-1 flex flex-col items-center gap-1 relative" title={`${dateStr}: ${d.n}회`}>
                                    <span className="text-[10px] font-semibold text-purple-300">{d.n}</span>
                                    <div className="w-full bg-purple-500/60 rounded-t"
                                         style={{ height: `${Math.max(6, (d.n / maxDaily) * 64)}px` }} />
                                    <span className="text-[9px] text-gray-500 absolute top-full mt-1 origin-top-left rotate-45 whitespace-nowrap">{dateStr}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div>
                <p className="text-sm font-semibold text-white mb-2">마케팅 채널 유입 (유튜브 QR 등)</p>
                <p className="text-xs text-gray-500 mb-2">?ref=YOUTUBE 같은 채널 링크의 방문→가입 전환. 보상 없이 측정만 하는 코드입니다.</p>
                {channels.length === 0 ? (
                    <p className="text-xs text-gray-500">아직 채널 유입이 없습니다. — 숏츠 QR이 나가면 여기에 잡힙니다.</p>
                ) : (
                    <table className="w-full text-xs text-gray-300">
                        <thead>
                            <tr className="text-gray-500 border-b border-gray-700">
                                <th className="text-left py-1.5">채널</th>
                                <th className="text-right">방문</th>
                                <th className="text-right">가입</th>
                                <th className="text-right">전환율</th>
                            </tr>
                        </thead>
                        <tbody>
                            {channels.map(c => (
                                <tr key={c.code} className="border-b border-gray-800">
                                    <td className="py-1.5 font-mono text-gray-400">{c.code}</td>
                                    <td className="text-right">{c.visits}</td>
                                    <td className="text-right text-purple-300">{c.signups}</td>
                                    <td className="text-right">{conv(c.signups, c.visits)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div>
                <p className="text-sm font-semibold text-white mb-2">초대 순위 (가입 기여)</p>
                {top.length === 0 ? (
                    <p className="text-xs text-gray-500">아직 추천 가입이 없습니다. — 402 충전모달 초대 CTA·공유 안내로 유입을 늘려보세요.</p>
                ) : (
                    <table className="w-full text-xs text-gray-300">
                        <thead>
                            <tr className="text-gray-500 border-b border-gray-700">
                                <th className="text-left py-1.5">코드 주인</th>
                                <th className="text-left">코드</th>
                                <th className="text-right">초대 가입</th>
                                <th className="text-right">보상 성사</th>
                            </tr>
                        </thead>
                        <tbody>
                            {top.map(r => (
                                <tr key={r.code} className="border-b border-gray-800">
                                    <td className="py-1.5">{r.owner_name || '(탈퇴/미상)'}</td>
                                    <td className="font-mono text-gray-400">{r.code}</td>
                                    <td className="text-right">{r.invited}</td>
                                    <td className="text-right text-yellow-300">{r.rewarded}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
