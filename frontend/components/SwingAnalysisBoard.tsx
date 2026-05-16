import React, { useState, useEffect } from 'react';
import { X, Trash2, ChevronLeft, Activity, Lock } from 'lucide-react';
import { SwingAnalysis, SwingAnalysisSection, UserSwingAnalysis } from '../types';
import { swingAnalysisApi } from '../services/apiService';

interface Props {
    onClose: () => void;
    personaId: string;
    initialResult?: { id: number; analysis: SwingAnalysis; createdAt: string } | null;
}

const PentagonChart: React.FC<{ sections: SwingAnalysisSection[] }> = ({ sections }) => {
    const cx = 120, cy = 120, maxR = 78, labelR = 103;
    const n = 5;
    const ang = (i: number) => (-90 + i * 72) * Math.PI / 180;
    const pt = (i: number, r: number) => ({ x: cx + r * Math.cos(ang(i)), y: cy + r * Math.sin(ang(i)) });
    const grids = [0.25, 0.5, 0.75, 1];
    const dataPath = sections.map((sec, i) => {
        const p = pt(i, (sec.score / 100) * maxR);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + 'Z';
    const getAnchor = (i: number): 'start' | 'end' | 'middle' => {
        const cos = Math.cos(ang(i));
        return cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    };
    const labelLines = (name: string) => name.includes('어드레스') ? ['어드레스', '& 셋업'] : [name];
    return (
        <svg viewBox="0 0 240 240" className="w-48 h-48">
            {grids.map((f, gi) => (
                <polygon key={gi}
                    points={Array.from({ length: n }, (_, i) => { const p = pt(i, f * maxR); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
                    fill="none" stroke={gi === 3 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'} strokeWidth={gi === 3 ? 0.8 : 0.5}
                />
            ))}
            {Array.from({ length: n }, (_, i) => { const o = pt(i, maxR); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />; })}
            <path d={dataPath} fill="rgba(74,222,128,0.18)" stroke="rgb(74,222,128)" strokeWidth="1.5" strokeLinejoin="round" />
            {sections.map((sec, i) => { const p = pt(i, (sec.score / 100) * maxR); return <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="rgb(74,222,128)" />; })}
            {sections.map((sec, i) => {
                const lp = pt(i, labelR);
                const lines = labelLines(sec.name);
                const anchor = getAnchor(i);
                const sinA = Math.sin(ang(i));
                const baselineDy = lines.length > 1 ? '-0.55em' : sinA > 0.3 ? '1em' : sinA < -0.3 ? '-0.2em' : '0.35em';
                return (
                    <text key={i} x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} textAnchor={anchor} fontSize="7.5" fill="rgb(156,163,175)">
                        {lines.map((line, li) => (
                            <tspan key={li} x={lp.x.toFixed(1)} dy={li === 0 ? baselineDy : '1.15em'}>{line}</tspan>
                        ))}
                    </text>
                );
            })}
        </svg>
    );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
    const r = 44, circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171';
    return (
        <svg viewBox="0 0 110 110" className="w-28 h-28">
            <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
            <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="9"
                strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
                strokeLinecap="round" strokeDashoffset={circ / 4}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px' }} />
            <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>{score}</text>
            <text x="55" y="66" textAnchor="middle" fontSize="8" fill="rgb(156,163,175)">/ 100</text>
        </svg>
    );
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
const fmtDateTime = (s: string) => new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const scoreColor = (s: number) => s >= 80 ? 'text-green-400' : s >= 60 ? 'text-yellow-400' : 'text-red-400';
const barColor = (s: number) => s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-yellow-500' : 'bg-red-500';

export const SwingAnalysisBoard: React.FC<Props> = ({ onClose, personaId, initialResult }) => {
    const [history, setHistory] = useState<UserSwingAnalysis[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<{ id: number; analysis: SwingAnalysis; createdAt: string } | null>(initialResult ?? null);
    const [mobileDetail, setMobileDetail] = useState(!!initialResult);

    useEffect(() => {
        swingAnalysisApi.getHistory(personaId)
            .then(setHistory)
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [personaId]);

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('이 분석 기록을 삭제하시겠습니까?')) return;
        try {
            await swingAnalysisApi.delete(id);
            setHistory(prev => prev.filter(r => r.id !== id));
            if (selected?.id === id) { setSelected(null); setMobileDetail(false); }
        } catch (err: any) {
            alert(err.message || '삭제 실패');
        }
    };

    const handleSelect = (record: UserSwingAnalysis) => {
        setSelected({ id: record.id, analysis: record.analysis, createdAt: record.createdAt });
        setMobileDetail(true);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-3 md:p-6">
            <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60"
                style={{ background: 'linear-gradient(160deg,#060b14 0%,#080d18 100%)' }}>

                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-700/50"
                    style={{ background: 'linear-gradient(90deg,#0d1b2e 0%,#0a1628 100%)' }}>
                    <div className="flex items-center gap-3">
                        {mobileDetail && (
                            <button onClick={() => setMobileDetail(false)} className="md:hidden text-slate-400 hover:text-white mr-1">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <Activity size={18} className="text-green-400" />
                        <span className="text-white font-bold text-base tracking-wide">골프 스윙 분석 리포트</span>
                        <span className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/40">
                            <Lock size={10} className="text-emerald-400" />
                            영상은 분석 후 즉시 삭제됩니다
                        </span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0">
                    {/* Left panel — list */}
                    <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} md:flex w-full md:w-64 lg:w-72 flex-col border-r border-slate-700/40`}>
                        <div className="px-4 py-3 border-b border-slate-700/30">
                            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">분석 기록</p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col gap-2 p-3">
                                    {[0,1,2].map(i => (
                                        <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />
                                    ))}
                                </div>
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-800/60 flex items-center justify-center">
                                        <Activity size={24} className="text-slate-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-400 font-medium mb-1">분석 기록이 없습니다</p>
                                        <p className="text-xs text-slate-600 leading-relaxed">스윙 영상을 업로드하면<br />AI가 자동으로 분석해 드립니다</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-500/80 bg-emerald-900/20 border border-emerald-800/30 px-3 py-2 rounded-full">
                                        <Lock size={10} />
                                        영상은 분석 후 즉시 삭제됩니다
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 p-2">
                                    {history.map(record => {
                                        const isActive = selected?.id === record.id;
                                        return (
                                            <button key={record.id}
                                                onClick={() => handleSelect(record)}
                                                className={`w-full text-left flex items-center justify-between px-3 py-3 rounded-xl transition-colors group ${
                                                    isActive
                                                        ? 'bg-slate-700/60 border border-slate-600/50'
                                                        : 'hover:bg-slate-800/50 border border-transparent'
                                                }`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center text-center ${
                                                        record.analysis.overallScore >= 80 ? 'bg-green-900/30 border border-green-700/30'
                                                        : record.analysis.overallScore >= 60 ? 'bg-yellow-900/30 border border-yellow-700/30'
                                                        : 'bg-red-900/30 border border-red-700/30'
                                                    }`}>
                                                        <span className={`text-sm font-black leading-none ${scoreColor(record.analysis.overallScore)}`}>
                                                            {record.analysis.overallScore}
                                                        </span>
                                                        <span className="text-[8px] text-slate-500 mt-0.5">점</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs text-slate-300 font-medium truncate">{fmtDate(record.createdAt)}</p>
                                                        <p className="text-[10px] text-slate-600 mt-0.5 truncate">{record.analysis.overallComment.slice(0, 28)}...</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={e => handleDelete(record.id, e)}
                                                    className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all p-1 ml-1"
                                                    title="삭제">
                                                    <Trash2 size={13} />
                                                </button>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right panel — detail */}
                    <div className={`${mobileDetail ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0`}>
                        {!selected ? (
                            <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-slate-800/40 border border-slate-700/30 flex items-center justify-center">
                                    <Activity size={28} className="text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-slate-400 font-medium mb-1">좌측 목록에서 분석 결과를 선택하세요</p>
                                    <p className="text-sm text-slate-600">스윙 분석 버튼으로 새 영상을 업로드할 수 있습니다</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-emerald-500/80 bg-emerald-900/15 border border-emerald-800/25 px-4 py-2.5 rounded-full">
                                    <Lock size={11} />
                                    영상은 분석 후 즉시 삭제됩니다 — 결과 데이터만 안전하게 보관됩니다
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                                {/* Score header */}
                                <div className="flex items-center gap-5 bg-slate-800/30 rounded-2xl p-5 border border-slate-700/30">
                                    <ScoreRing score={selected.analysis.overallScore} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">종합 점수</span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed">{selected.analysis.overallComment}</p>
                                        <p className="mt-2 text-[11px] text-slate-600">{fmtDateTime(selected.createdAt)}</p>
                                    </div>
                                    <div className="hidden lg:flex shrink-0">
                                        <PentagonChart sections={selected.analysis.sections} />
                                    </div>
                                </div>

                                {/* Pentagon chart — mobile/medium */}
                                <div className="flex justify-center lg:hidden">
                                    <PentagonChart sections={selected.analysis.sections} />
                                </div>

                                {/* Section scores */}
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-widest mb-3 px-1">구간별 분석</p>
                                    <div className="flex flex-col gap-3">
                                        {selected.analysis.sections.map(sec => (
                                            <div key={sec.name} className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-slate-200">{sec.name}</span>
                                                    <span className={`text-sm font-bold tabular-nums ${scoreColor(sec.score)}`}>{sec.score}점</span>
                                                </div>
                                                <div className="w-full bg-slate-700/60 rounded-full h-1.5 mb-2.5">
                                                    <div className={`h-1.5 rounded-full transition-all ${barColor(sec.score)}`}
                                                        style={{ width: `${sec.score}%` }} />
                                                </div>
                                                <p className="text-xs text-slate-400 mb-2 leading-relaxed">{sec.comment}</p>
                                                {sec.good.length > 0 && (
                                                    <div className="flex flex-col gap-0.5 mb-1.5">
                                                        {sec.good.map((g, i) => (
                                                            <span key={i} className="text-xs text-green-400 flex items-start gap-1.5">
                                                                <span className="shrink-0 mt-0.5">✓</span>{g}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {sec.improve.length > 0 && (
                                                    <div className="flex flex-col gap-0.5">
                                                        {sec.improve.map((im, i) => (
                                                            <span key={i} className="text-xs text-amber-400 flex items-start gap-1.5">
                                                                <span className="shrink-0 mt-0.5">△</span>{im}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top priorities */}
                                {selected.analysis.topPriorities.length > 0 && (
                                    <div className="bg-amber-950/30 border border-amber-800/30 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">핵심 우선순위</p>
                                        <ol className="flex flex-col gap-2">
                                            {selected.analysis.topPriorities.map((p, i) => (
                                                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                                                    <span className="shrink-0 w-5 h-5 rounded-full bg-amber-800/50 text-amber-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    {p}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Recommended drills */}
                                {selected.analysis.recommendedDrills.length > 0 && (
                                    <div className="bg-blue-950/30 border border-blue-800/30 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">추천 드릴</p>
                                        <ol className="flex flex-col gap-2">
                                            {selected.analysis.recommendedDrills.map((d, i) => (
                                                <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                                                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-900/50 text-blue-300 flex items-center justify-center text-[10px] font-bold mt-0.5">
                                                        {i + 1}
                                                    </span>
                                                    {d}
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-[11px] text-emerald-600/70 bg-emerald-900/10 border border-emerald-900/20 px-3 py-2 rounded-full self-start">
                                    <Lock size={10} />
                                    영상은 분석 후 즉시 삭제됩니다
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
