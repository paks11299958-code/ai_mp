import React, { useState, useEffect } from 'react';
import { X, Trash2, ChevronLeft, Activity, Lock, ChevronDown } from 'lucide-react';
import { SwingAnalysis, SwingAnalysisSection, UserSwingAnalysis } from '../types';
import { swingAnalysisApi } from '../services/apiService';

// ── Design tokens ──────────────────────────────────────────
const T = {
    bg: '#FBF8F3',
    card: '#FFFFFF',
    border: '#EAE2D3',
    accent: '#8E6FB7',
    accentLight: 'rgba(142,111,183,0.10)',
    accentBorder: 'rgba(142,111,183,0.25)',
    ink: '#2D2438',
    muted: '#9089A1',
    gold: '#8E6FB7',        // 포인트 컬러(앱 퍼플로 통일)
    goldLine: '#8E6FB7',    // 차트 라인
    goldSoft: 'rgba(142,111,183,0.10)',
    goldBorder: 'rgba(142,111,183,0.4)',
    green: '#2E7D32',
    greenBg: 'rgba(46,125,50,0.08)',
    greenBorder: 'rgba(46,125,50,0.2)',
    amber: '#92600A',
    amberBg: 'rgba(146,96,10,0.08)',
    amberBorder: 'rgba(146,96,10,0.2)',
    blue: '#1A5FA8',
    blueBg: 'rgba(26,95,168,0.08)',
    blueBorder: 'rgba(26,95,168,0.2)',
};

// ── Helpers ────────────────────────────────────────────────
const fmtDate = (s: string) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtDateTime = (s: string) => new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const scoreGrade = (s: number) => {
    if (s >= 80) return { color: T.green, bg: T.greenBg, border: T.greenBorder, label: '우수' };
    if (s >= 60) return { color: T.amber, bg: T.amberBg, border: T.amberBorder, label: '보통' };
    return { color: '#C62828', bg: 'rgba(198,40,40,0.08)', border: 'rgba(198,40,40,0.2)', label: '개선필요' };
};

// ── Pentagon Chart (크림 테마) ──────────────────────────────
const PentagonChart: React.FC<{ sections: SwingAnalysisSection[] }> = ({ sections }) => {
    const cx = 130, cy = 130, maxR = 85, labelR = 112;
    const n = 5;
    const ang = (i: number) => (-90 + i * 72) * Math.PI / 180;
    const pt = (r: number, i: number) => ({ x: cx + r * Math.cos(ang(i)), y: cy + r * Math.sin(ang(i)) });
    const grids = [0.25, 0.5, 0.75, 1];
    const dataPath = sections.map((sec, i) => {
        const p = pt((sec.score / 100) * maxR, i);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ') + 'Z';
    const labelLines = (name: string) => name.includes('어드레스') ? ['어드레스', '& 셋업'] : [name];
    const getAnchor = (i: number): 'start' | 'end' | 'middle' => {
        const cos = Math.cos(ang(i));
        return cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    };
    return (
        <svg viewBox="0 0 260 260" className="w-full h-full" style={{ maxWidth: 260, maxHeight: 260 }}>
            {grids.map((f, gi) => (
                <polygon key={gi}
                    points={Array.from({ length: n }, (_, i) => { const p = pt(f * maxR, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ')}
                    fill={gi === 3 ? T.accentLight : 'none'}
                    stroke={gi === 3 ? T.accentBorder : T.border}
                    strokeWidth={gi === 3 ? 1 : 0.7}
                />
            ))}
            {Array.from({ length: n }, (_, i) => { const o = pt(maxR, i); return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke={T.border} strokeWidth="0.7" />; })}
            <path d={dataPath} fill="rgba(142,111,183,0.2)" stroke={T.goldLine} strokeWidth="2.2" strokeLinejoin="round" />
            {sections.map((sec, i) => { const p = pt((sec.score / 100) * maxR, i); return <circle key={i} cx={p.x} cy={p.y} r={3.4} fill={T.goldLine} />; })}
            {sections.map((sec, i) => {
                const lp = pt(labelR, i);
                const lines = labelLines(sec.name);
                const anchor = getAnchor(i);
                const sinA = Math.sin(ang(i));
                const baselineDy = lines.length > 1 ? '-0.55em' : sinA > 0.3 ? '1em' : sinA < -0.3 ? '-0.2em' : '0.35em';
                return (
                    <text key={i} x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} textAnchor={anchor} fontSize="8.5" fill={T.muted} fontWeight="500">
                        {lines.map((line, li) => (
                            <tspan key={li} x={lp.x.toFixed(1)} dy={li === 0 ? baselineDy : '1.2em'}>{line}</tspan>
                        ))}
                    </text>
                );
            })}
        </svg>
    );
};

// ── Score Ring ─────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
    const r = 46, circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const g = scoreGrade(score);
    return (
        <svg viewBox="0 0 110 110" className="w-28 h-28">
            <circle cx="55" cy="55" r={r} fill="none" stroke={T.border} strokeWidth="9" />
            <circle cx="55" cy="55" r={r} fill="none" stroke={g.color} strokeWidth="9"
                strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`}
                strokeLinecap="round" strokeDashoffset={circ / 4}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '55px 55px' }} />
            <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="800" fill={g.color}>{score}</text>
            <text x="55" y="66" textAnchor="middle" fontSize="8" fill={T.muted}>/ 100</text>
        </svg>
    );
};

// ── Interfaces ─────────────────────────────────────────────
interface Props {
    onClose: () => void;
    personaId: string;
    initialResult?: { id: number; analysis: SwingAnalysis; createdAt: string } | null;
}

// ── Main Component ─────────────────────────────────────────
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
        await swingAnalysisApi.delete(id).catch(() => {});
        setHistory(prev => prev.filter(r => r.id !== id));
        if (selected?.id === id) { setSelected(null); setMobileDetail(false); }
    };

    const handleSelect = (record: UserSwingAnalysis) => {
        setSelected({ id: record.id, analysis: record.analysis, createdAt: record.createdAt });
        setMobileDetail(true);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[60px] md:pt-[84px] md:px-6 md:pb-6"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="relative w-full max-w-5xl h-[calc(100vh-60px)] md:h-auto md:max-h-[calc(100vh-108px)] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden shadow-2xl"
                style={{ background: T.bg, border: `1px solid ${T.border}` }}>

                {/* ── Header ── */}
                <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-4"
                    style={{ borderBottom: `1px solid ${T.border}`, background: '#FFFFFF' }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {selected ? (
                            <button onClick={() => { setSelected(null); setMobileDetail(false); }}
                                className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg hover:bg-black/5 transition-colors shrink-0"
                                style={{ color: T.accent }}>
                                <ChevronLeft size={16} /> 목록으로
                            </button>
                        ) : null}
                        <Activity size={18} style={{ color: T.gold, flexShrink: 0 }} />
                        <span className="font-bold text-base truncate" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.02em' }}>
                            정밀 스윙 진단 <span className="text-[11px] tracking-[0.2em]" style={{ color: T.gold }}>SWING MASTER</span>
                        </span>
                        <span className="hidden md:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
                            style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                            <Lock size={10} />
                            영상은 분석 후 즉시 삭제됩니다
                        </span>
                    </div>
                    <button onClick={onClose} className="shrink-0 p-1.5 rounded-xl hover:bg-black/5 transition-colors">
                        <X size={18} style={{ color: T.muted }} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex flex-1 min-h-0">

                    {/* Left — List (선택 전 전체폭, 선택 후 좁은 사이드바) */}
                    <div className={`${mobileDetail ? 'hidden md:flex' : 'flex'} md:flex w-full ${selected ? 'md:w-64 lg:w-72' : ''} flex-col`}
                        style={{ borderRight: selected ? `1px solid ${T.border}` : 'none' }}>
                        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.muted }}>분석 기록</p>
                        </div>
                        <div className="flex-1 overflow-y-auto" style={selected ? { padding: 8 } : { padding: 16 }}>
                          <div style={selected ? {} : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxWidth: 1100, margin: '0 auto' }}>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <div key={i} className="h-16 rounded-xl mb-2 animate-pulse" style={{ background: T.border }} />
                                ))
                            ) : history.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-4">
                                    <Activity size={32} style={{ color: T.border }} />
                                    <div>
                                        <p className="text-sm font-medium mb-1" style={{ color: T.ink }}>분석 기록이 없습니다</p>
                                        <p className="text-xs leading-relaxed" style={{ color: T.muted }}>스윙 영상을 업로드하면<br />AI가 자동으로 분석해 드립니다</p>
                                    </div>
                                </div>
                            ) : (
                                history.map(record => {
                                    const isActive = selected?.id === record.id;
                                    const g = scoreGrade(record.analysis.overallScore);
                                    const title = record.title || 'Untitled';
                                    return (
                                        <button key={record.id}
                                            onClick={() => handleSelect(record)}
                                            className="w-full text-left flex flex-col gap-2 px-3 py-3 rounded-xl mb-1 transition-all group"
                                            style={{
                                                background: isActive ? T.accentLight : 'transparent',
                                                border: `1px solid ${isActive ? T.accentBorder : T.border}`,
                                            }}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center"
                                                        style={{ background: g.bg, border: `1px solid ${g.border}` }}>
                                                        <span className="text-sm font-black leading-none" style={{ color: g.color }}>{record.analysis.overallScore}</span>
                                                        <span className="text-[8px]" style={{ color: T.muted }}>점</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold truncate" style={{ color: T.ink }}>{title}</p>
                                                        <p className="text-[10px] truncate" style={{ color: T.muted }}>{fmtDate(record.createdAt)} · <span style={{ color: g.color, fontWeight: 700 }}>{g.label}</span></p>
                                                    </div>
                                                </div>
                                                <span onClick={e => handleDelete(record.id, e)}
                                                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 transition-all"
                                                    title="삭제">
                                                    <Trash2 size={13} style={{ color: '#C62828' }} />
                                                </span>
                                            </div>
                                            {/* 단계별 점수 요약 (어드레스·백스윙 등) */}
                                            {record.analysis.sections?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {record.analysis.sections.map((sec, i) => {
                                                        const sg = scoreGrade(sec.score);
                                                        return (
                                                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-md"
                                                                style={{ background: '#fff', border: `1px solid ${T.border}`, color: T.ink, fontWeight: 600 }}>
                                                                {sec.name.replace(' & 셋업', '')} <b style={{ color: sg.color }}>{sec.score}</b>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                          </div>
                        </div>
                    </div>

                    {/* Right — Detail (선택했을 때만 표시. 선택 전엔 좌측 목록이 전체폭) */}
                    {selected && (
                    <div className={`${mobileDetail ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 overflow-y-auto`}>
                        <DetailView selected={selected} />
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Detail View ────────────────────────────────────────────
const DetailView: React.FC<{ selected: { id: number; analysis: SwingAnalysis; createdAt: string } }> = ({ selected }) => {
    const { analysis, createdAt } = selected;
    const g = scoreGrade(analysis.overallScore);
    const [expandedSec, setExpandedSec] = useState<string | null>(null);

    return (
        <div className="flex flex-col gap-0" style={{ padding: '20px 20px 32px' }}>

            {/* ── 헤더: 제목 + 날짜 ── */}
            <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold" style={{ color: T.ink, fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.03em' }}>
                        통합 스윙 정밀 진단 <span className="text-[10px] tracking-[0.18em]" style={{ color: T.gold }}>SWING INTELLIGENCE</span>
                    </span>
                </div>
                <p className="text-[11px]" style={{ color: T.muted }}>{fmtDateTime(createdAt)} 분석 완료</p>
            </div>

            {/* ── 스코어 + 레이더 차트 ── */}
            <div className="rounded-2xl p-5 mb-4 flex flex-col md:flex-row items-center gap-6"
                style={{ background: T.card, border: `1px solid ${T.border}` }}>

                {/* 레이더 */}
                <div className="shrink-0 w-52 h-52">
                    <PentagonChart sections={analysis.sections} />
                </div>

                {/* 점수 카드 3개 */}
                <div className="flex-1 w-full flex flex-col gap-3">
                    <p className="text-xs font-semibold tracking-wider" style={{ color: T.gold }}>스윙 지오메트리 분석 · GEOMETRY</p>

                    {/* 종합 점수 + 구간 요약 */}
                    <div className="flex items-center gap-4">
                        <ScoreRing score={analysis.overallScore} />
                        <div>
                            <div className="text-[11px] font-semibold mb-1" style={{ color: T.muted }}>종합 점수</div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: g.bg, color: g.color, border: `1px solid ${g.border}` }}>
                                {g.label}
                            </span>
                        </div>
                    </div>

                    {/* 구간 점수 미니 배지 */}
                    <div className="flex flex-wrap gap-2">
                        {analysis.sections.map(sec => {
                            const sg = scoreGrade(sec.score);
                            return (
                                <div key={sec.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs"
                                    style={{ background: T.goldSoft, border: `1px solid ${T.goldBorder}` }}>
                                    <span style={{ color: T.ink, fontWeight: 500 }}>{sec.name.replace(' & 셋업', '')}</span>
                                    <span className="font-bold" style={{ color: sg.color }}>{sec.score}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── 총평 ── */}
            <div className="rounded-2xl p-5 mb-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-xs font-bold tracking-wider mb-3" style={{ color: T.gold, fontFamily: '"Nanum Myeongjo", serif' }}>AI 마스터 소견 · MASTER VERDICT</p>
                <p className="text-sm leading-relaxed" style={{ color: T.ink }}>{analysis.overallComment}</p>
            </div>

            {/* ── 구간별 분석 테이블 ── */}
            <div className="rounded-2xl overflow-hidden mb-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
                    <p className="text-xs font-bold tracking-wider" style={{ color: T.gold, fontFamily: '"Nanum Myeongjo", serif' }}>세부 지표 정밀 진단 · DETAIL</p>
                </div>

                {/* 테이블 헤더 */}
                <div className="hidden md:grid grid-cols-[140px_60px_1fr_1fr] gap-0 text-[10px] font-semibold uppercase tracking-widest px-4 py-2"
                    style={{ color: T.muted, borderBottom: `1px solid ${T.border}`, background: T.bg }}>
                    <span>구간</span>
                    <span>점수</span>
                    <span>잘된 점</span>
                    <span>개선점</span>
                </div>

                {analysis.sections.map((sec, idx) => {
                    const sg = scoreGrade(sec.score);
                    const isLast = idx === analysis.sections.length - 1;
                    const isExpanded = expandedSec === sec.name;
                    return (
                        <div key={sec.name} style={{ borderBottom: isLast ? 'none' : `1px solid ${T.border}` }}>
                            {/* 모바일: 아코디언 */}
                            <button className="md:hidden w-full flex items-center justify-between px-4 py-3 text-left"
                                onClick={() => setExpandedSec(isExpanded ? null : sec.name)}>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold" style={{ color: T.ink }}>{sec.name}</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: sg.bg, color: sg.color }}>{sec.score}점</span>
                                </div>
                                <ChevronDown size={14} style={{ color: T.muted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                            {isExpanded && (
                                <div className="md:hidden px-4 pb-4">
                                    <p className="text-xs mb-2 leading-relaxed" style={{ color: T.muted }}>{sec.comment}</p>
                                    {sec.good.map((g, i) => <p key={i} className="text-xs mb-0.5 flex gap-1.5" style={{ color: T.green }}><span>✓</span>{g}</p>)}
                                    {sec.improve.map((im, i) => <p key={i} className="text-xs mb-0.5 flex gap-1.5" style={{ color: T.amber }}><span>△</span>{im}</p>)}
                                </div>
                            )}

                            {/* 데스크탑: 테이블 행 */}
                            <div className="hidden md:grid grid-cols-[140px_60px_1fr_1fr] gap-0 px-4 py-4 items-start">
                                <div>
                                    <p className="text-sm font-semibold mb-1" style={{ color: T.ink }}>{sec.name}</p>
                                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
                                        <div className="h-full rounded-full" style={{ width: `${sec.score}%`, background: sg.color }} />
                                    </div>
                                    <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: T.muted }}>{sec.comment}</p>
                                </div>
                                <div className="flex items-start pt-0.5">
                                    <span className="text-sm font-black" style={{ color: sg.color }}>{sec.score}<span className="text-xs font-normal ml-0.5" style={{ color: T.muted }}>점</span></span>
                                </div>
                                <div className="pr-3">
                                    {sec.good.map((g, i) => (
                                        <p key={i} className="text-xs mb-1 flex gap-1.5 leading-relaxed" style={{ color: T.green }}>
                                            <span className="shrink-0">✓</span>{g}
                                        </p>
                                    ))}
                                </div>
                                <div>
                                    {sec.improve.map((im, i) => (
                                        <p key={i} className="text-xs mb-1 flex gap-1.5 leading-relaxed" style={{ color: T.amber }}>
                                            <span className="shrink-0">△</span>{im}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Vertex AI 분석 요약 (총평 상세) ── */}
            {analysis.topPriorities.length > 0 && (
                <div className="rounded-2xl p-5 mb-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: T.muted }}>Vertex AI 분석 요약</p>
                    <p className="text-sm leading-relaxed" style={{ color: T.ink }}>
                        {analysis.topPriorities.join(' ')}
                    </p>
                </div>
            )}

            {/* ── 핵심 수순 ── */}
            {analysis.recommendedDrills.length > 0 && (
                <div className="rounded-2xl p-5 mb-4" style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}` }}>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: T.amber }}>핵심 수순</p>
                    <ol className="flex flex-col gap-3">
                        {analysis.recommendedDrills.map((d, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm" style={{ color: T.ink }}>
                                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ background: T.amber, color: '#fff' }}>{i + 1}</span>
                                <span className="leading-relaxed pt-0.5">{d}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}

            {/* ── Privacy badge ── */}
            <div className="flex justify-end">
                <span className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full"
                    style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}`, color: T.green }}>
                    <Lock size={10} />
                    영상은 분석 후 즉시 삭제됩니다
                </span>
            </div>
        </div>
    );
};
