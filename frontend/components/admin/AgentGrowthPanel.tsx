import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 직원 성장 탭(읽기 전용) — 지우/지훈/아린/채원 서브탭: 레벨·XP 카드+주간 추이+종류별 통계+학습 이력.
// 데이터 = 서버1 AgentGrowth (아침 조회 크론·복기·아이디어 채택이 기록). XP 규칙 정본=rag/agent_growth.py.

const AGENTS: { key: string; label: string; emoji: string; role: string }[] = [
    { key: 'dev',       label: '지우',   emoji: '🛠️', role: '개발' },
    { key: 'search',    label: '강지훈', emoji: '🔎', role: '리서치' },
    { key: 'marketing', label: '이아린', emoji: '📣', role: '마케팅' },
    { key: 'stock',     label: '윤채원', emoji: '📈', role: '주식투자' },
];

const KIND_LABELS: Record<string, string> = {
    study: '학습', review: '복기', daily_content: '콘텐츠 발행',
    proposal_approved: '개선안 승인', proposal_rejected: '개선안 반려',
    idea_adopted: '아이디어 채택', work_done: '작업 완수',
};

interface Summary {
    totalXp: number; level: number; nextLevelXp: number; levelBase: number; levelNext: number;
    xp7: number; xp30: number;
    kinds: Record<string, { n: number; xp: number }>;
    weekly: { week: string; xp: number }[];
}
interface GrowthLog { id: number; kind: string; topic: string; summary: string; wikiPath: string; xp: number; createdAt: string }

export const AgentGrowthPanel: React.FC = () => {
    const [agent, setAgent] = useState('dev');
    const [summary, setSummary] = useState<Record<string, Summary> | null>(null);
    const [logs, setLogs] = useState<GrowthLog[] | null>(null);
    const [openLog, setOpenLog] = useState<number | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        adminApi.getAgentGrowthSummary().then(setSummary).catch(() => setError('요약 불러오기 실패'));
    }, []);
    useEffect(() => {
        setLogs(null); setOpenLog(null);
        adminApi.getAgentGrowthLogs(agent).then(setLogs).catch(() => setError('이력 불러오기 실패'));
    }, [agent]);

    const s = summary?.[agent];
    const meta = AGENTS.find(a => a.key === agent)!;
    const levelPct = s && s.levelNext > s.levelBase
        ? Math.min(100, Math.round(((s.totalXp - s.levelBase) / (s.levelNext - s.levelBase)) * 100)) : 100;
    const maxWeek = s ? Math.max(1, ...s.weekly.map(w => w.xp)) : 1;

    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
                {/* 직원 서브탭 */}
                <div className="flex gap-1.5 flex-wrap mb-4">
                    {AGENTS.map(a => (
                        <button key={a.key} onClick={() => setAgent(a.key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${agent === a.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:text-gray-200'}`}>
                            {a.emoji} {a.label} <span className="font-normal opacity-70">{a.role}</span>
                            {summary?.[a.key] && <span className="ml-1 opacity-80">Lv{summary[a.key].level}</span>}
                        </button>
                    ))}
                </div>

                {error && <div className="text-xs text-red-400 mb-3">{error}</div>}
                {!summary && !error && <div className="text-sm text-gray-500 py-8 text-center">불러오는 중…</div>}

                {s && (
                    <>
                        {/* 레벨·XP 카드 */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <div className="text-lg font-bold text-white">{meta.emoji} {meta.label} <span className="text-blue-400">Lv{s.level}</span></div>
                                    <div className="text-xs text-gray-400 mt-0.5">누적 {s.totalXp} XP
                                        {s.nextLevelXp > 0 && <> · 다음 레벨까지 <b className="text-amber-300">{s.nextLevelXp} XP</b></>}
                                    </div>
                                </div>
                                <div className="text-right text-xs text-gray-400">
                                    <div>최근 7일 <b className="text-emerald-300">+{s.xp7}</b></div>
                                    <div>최근 30일 <b className="text-emerald-300">+{s.xp30}</b></div>
                                </div>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${levelPct}%`, background: 'linear-gradient(90deg,#8E6FB7,#60a5fa)' }} />
                            </div>
                            <div className="text-[10px] text-gray-500 mt-1">{s.levelBase} XP → {s.levelNext} XP ({levelPct}%)</div>
                        </div>

                        {/* 주간 XP 추이(8주, div 막대) */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
                            <div className="text-xs font-bold text-gray-300 mb-2">📊 주간 XP 추이 (최근 8주)</div>
                            {s.weekly.length === 0 && <div className="text-xs text-gray-500">아직 데이터 없음</div>}
                            <div className="flex items-end gap-2 h-24">
                                {s.weekly.map(w => (
                                    <div key={w.week} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                                        <div className="text-[10px] text-emerald-300">{w.xp}</div>
                                        <div className="w-full rounded-t bg-blue-500/70" style={{ height: `${Math.max(4, (w.xp / maxWeek) * 70)}px` }} />
                                        <div className="text-[9px] text-gray-500 whitespace-nowrap">{w.week}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 종류별 통계 */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3">
                            <div className="text-xs font-bold text-gray-300 mb-2">🏷️ 활동 종류별</div>
                            <div className="flex gap-1.5 flex-wrap">
                                {Object.entries(s.kinds).map(([k, v]) => (
                                    <span key={k} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-gray-200">
                                        {KIND_LABELS[k] ?? k} <b>{v.n}회</b> <span className="text-emerald-300">+{v.xp}</span>
                                    </span>
                                ))}
                                {Object.keys(s.kinds).length === 0 && <span className="text-xs text-gray-500">기록 없음</span>}
                            </div>
                        </div>
                    </>
                )}

                {/* 이력 테이블(topic 클릭 → summary 펼침) */}
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 text-xs font-bold text-gray-300 border-b border-white/10">📚 성장 이력 (최근 50건)</div>
                    {logs === null && <div className="text-sm text-gray-500 py-6 text-center">불러오는 중…</div>}
                    {logs && logs.length === 0 && <div className="text-sm text-gray-500 py-6 text-center">아직 이력이 없어요.</div>}
                    {logs && logs.map(l => (
                        <div key={l.id} className="border-b border-white/5 last:border-0">
                            <button onClick={() => setOpenLog(openLog === l.id ? null : l.id)}
                                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 shrink-0">{KIND_LABELS[l.kind] ?? l.kind}</span>
                                <span className="text-xs text-gray-200 truncate flex-1">{l.topic || '(제목 없음)'}</span>
                                <span className="text-[10px] text-emerald-300 shrink-0">+{l.xp}</span>
                                <span className="text-[10px] text-gray-500 shrink-0">{String(l.createdAt).slice(0, 10)}</span>
                                <Icon name="ChevronDown" size={12} className={`text-gray-500 shrink-0 transition-transform ${openLog === l.id ? '' : '-rotate-90'}`} />
                            </button>
                            {openLog === l.id && (
                                <div className="px-4 pb-3 text-xs text-gray-400 whitespace-pre-wrap leading-relaxed">
                                    {l.summary || '요약 없음'}
                                    {l.wikiPath && <div className="text-[10px] text-gray-600 mt-1.5">📄 {l.wikiPath}</div>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
