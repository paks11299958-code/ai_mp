import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, TrendingUp, Clock, CheckCircle, XCircle, Loader, Download, Trash2, RefreshCw, RotateCcw, ChevronLeft, BarChart2, MessageCircle } from 'lucide-react';
import { stockReportApi } from '../services/apiService';
import { boardFetch as apiFetch } from '../lib/boardFetch';
import { useTaskList } from '../hooks/useTaskList';
import { parseClaudeGptOpinion, parseGeminiOpinion, opinionColor, type AiOpinion } from '../utils/parsing';

const YUNCHAEWON_PERSONA_ID = 'cmois970w0000xsvie6aag2f5';

// ── 크림 팔레트 ──────────────────────────────────────
const T = {
    bg:        '#FBF8F3',
    surface:   '#F5F0E8',
    card:      '#FFFFFF',
    border:    '#E8DDD0',
    borderSoft:'#EDE5D8',
    ink:       '#2D2520',
    inkSoft:   '#6B5F56',
    inkMute:   '#A0948A',
    gold:      '#8E6FB7',   // 포인트 컬러(앱 퍼플로 통일)
    accent:    '#2E6B32',   // 주식 = 초록
    accentSoft:'#E8F4E9',
};

interface StockTask {
    id: number;
    stockName: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
    corpCode?: string;
    errorMessage?: string | null;
}

interface StockDetail extends StockTask {
    analysisReport: string | null;
    claudeReport: string | null;
    gptReport: string | null;
    sourceLinks: string | null;
    yahooSymbol?: string | null;
    chartImageUrl?: string | null;
}

// ── AI 투자의견 비교 카드 ────────────────────────────
const AiOpinionCard: React.FC<{ geminiReport: string | null; claudeReport: string | null; gptReport: string | null }> = ({ geminiReport, claudeReport, gptReport }) => {
    const gemini = parseGeminiOpinion(geminiReport);
    const claude = parseClaudeGptOpinion(claudeReport);
    const gpt    = parseClaudeGptOpinion(gptReport);

    const ais = [
        { label: 'Gemini 2.5',   dot: '#60a5fa', data: gemini },
        { label: 'Claude Sonnet', dot: '#a78bfa', data: claude },
        { label: 'GPT-4o',       dot: '#34d399', data: gpt   },
    ];

    return (
        <div style={{
            margin: '16px 20px 0',
            borderRadius: 14,
            border: `1px solid ${T.border}`,
            background: T.card,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(45,37,32,0.07)',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px',
                borderBottom: `1px solid ${T.borderSoft}`,
                background: T.surface,
            }}>
                <BarChart2 size={12} style={{ color: T.gold }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: T.gold, letterSpacing: '0.08em' }}>다각도 AI 교차검증 · MULTI-AI</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {ais.map(({ label, dot, data }, idx) => {
                    const color = opinionColor(data.opinion, data.score);
                    const pct = data.score ?? null;
                    return (
                        <div key={label} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            padding: '14px 10px',
                            borderRight: idx < 2 ? `1px solid ${T.borderSoft}` : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: T.inkSoft }}>{label}</span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color }}>{data.opinion}</div>
                                {pct != null && <div style={{ fontSize: 10, fontWeight: 700, color, marginTop: 1 }}>{pct}점</div>}
                            </div>
                            {pct != null && (
                                <div style={{ width: '80%', height: 5, borderRadius: 99, background: T.borderSoft, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 99, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                                </div>
                            )}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 9, color: T.inkMute, marginBottom: 2 }}>목표주가</div>
                                <div style={{ fontSize: 10, color: T.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>{data.target}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface Props {
    onClose: () => void;
    onConsult?: (personaId: string, stockName: string) => void;
}

const API = (path: string) => `/api/stock-analysis${path}`;

const STATUS_CONFIG = {
    pending:    { label: '대기중', icon: Clock,       cls: '#d97706' },
    processing: { label: '분석중', icon: Loader,      cls: '#2563eb' },
    completed:  { label: '완료',   icon: CheckCircle, cls: '#16a34a' },
    failed:     { label: '실패',   icon: XCircle,     cls: '#dc2626' },
};

const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

// ── 인라인 렌더러 ─────────────────────────────────────
function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        const token = m[0];
        if (token.startsWith('**'))
            parts.push(<strong key={m.index} style={{ color: T.ink, fontWeight: 700 }}>{token.slice(2, -2)}</strong>);
        else if (token.startsWith('*'))
            parts.push(<em key={m.index} style={{ color: T.inkSoft }}>{token.slice(1, -1)}</em>);
        else
            parts.push(<code key={m.index} style={{ background: T.surface, color: T.accent, padding: '1px 5px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>{token.slice(1, -1)}</code>);
        last = m.index + token.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
}

// ── 테이블 블록 ──────────────────────────────────────
const TableBlock: React.FC<{ lines: string[] }> = ({ lines }) => {
    const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()));
    const rows = dataRows.map(l => l.split('|').slice(1, -1).map(c => c.trim()));
    if (!rows.length) return null;
    const [header, ...body] = rows;
    return (
        <div style={{ margin: '10px 0', overflowX: 'auto', borderRadius: 8, border: `1px solid ${T.border}` }}>
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: T.surface }}>
                        {header.map((cell, i) => (
                            <th key={i} style={{ padding: '7px 12px', textAlign: 'left', color: T.ink, fontWeight: 700, borderRight: i < header.length - 1 ? `1px solid ${T.border}` : 'none', whiteSpace: 'nowrap' }}>
                                {renderInline(cell)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri} style={{ borderTop: `1px solid ${T.borderSoft}`, background: ri % 2 !== 0 ? T.surface : T.card }}>
                            {row.map((cell, ci) => (
                                <td key={ci} style={{ padding: '7px 12px', color: T.inkSoft, borderRight: ci < row.length - 1 ? `1px solid ${T.borderSoft}` : 'none' }}>
                                    {renderInline(cell)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ── 마크다운 렌더러 ──────────────────────────────────
const ReportRenderer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let pendingList: { line: string; idx: number }[] = [];

    const flushList = () => {
        if (!pendingList.length) return;
        elements.push(
            <ul key={`ul-${pendingList[0].idx}`} style={{ margin: '6px 0', paddingLeft: 0, listStyle: 'none' }}>
                {pendingList.map(({ line, idx }) => (
                    <li key={idx} style={{ display: 'flex', gap: 8, fontSize: 12, color: T.inkSoft, lineHeight: 1.65, marginBottom: 2 }}>
                        <span style={{ color: T.accent, flexShrink: 0, marginTop: 2 }}>▸</span>
                        <span>{renderInline(line.slice(2))}</span>
                    </li>
                ))}
            </ul>
        );
        pendingList = [];
    };

    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith('|')) {
            flushList();
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i++]); }
            elements.push(<TableBlock key={`tbl-${i}`} lines={tableLines} />);
            continue;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
            pendingList.push({ line, idx: i++ });
            continue;
        }
        flushList();
        if (line.startsWith('# ')) {
            elements.push(<h1 key={i} style={{ fontSize: 15, fontWeight: 800, color: T.ink, margin: '18px 0 8px', paddingBottom: 6, borderBottom: `1px solid ${T.border}` }}>{renderInline(line.slice(2))}</h1>);
        } else if (line.startsWith('## ')) {
            elements.push(
                <div key={i} style={{ margin: '16px 0 8px', background: T.accentSoft, padding: '7px 12px', borderRadius: 8, borderLeft: `4px solid ${T.accent}` }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: T.accent, margin: 0 }}>{renderInline(line.slice(3))}</h2>
                </div>
            );
        } else if (line.startsWith('### ')) {
            elements.push(<h3 key={i} style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, margin: '12px 0 4px', paddingLeft: 8, borderLeft: `2px solid ${T.border}` }}>{renderInline(line.slice(4))}</h3>);
        } else if (line.startsWith('> ')) {
            elements.push(
                <blockquote key={i} style={{ borderLeft: `3px solid ${T.gold}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4, margin: '8px 0', background: `${T.gold}12`, borderRadius: '0 6px 6px 0', fontSize: 11.5, color: T.inkSoft, lineHeight: 1.6 }}>
                    {renderInline(line.slice(2))}
                </blockquote>
            );
        } else if (line.startsWith('---')) {
            elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${T.border}`, margin: '14px 0' }} />);
        } else if (line.trim() === '') {
            elements.push(<div key={i} style={{ height: 4 }} />);
        } else {
            elements.push(<p key={i} style={{ fontSize: 12, color: T.inkSoft, lineHeight: 1.7, margin: '2px 0' }}>{renderInline(line)}</p>);
        }
        i++;
    }
    flushList();
    return <div style={{ paddingBottom: 24 }}>{elements}</div>;
};

interface Suggestion { corpName: string; stockCode: string | null; }

export const StockAnalysisBoard: React.FC<Props> = ({ onClose, onConsult }) => {
    const { tasks, setTasks, loading, loadTasks } = useTaskList<StockTask>(API(''));
    const [stockName, setStockName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<StockDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [consulting, setConsulting] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapRef = useRef<HTMLDivElement>(null);
    const reportPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => { return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); }; }, []);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (inputWrapRef.current && !inputWrapRef.current.contains(e.target as Node))
                setShowSuggestions(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleInputChange = (value: string) => {
        setStockName(value);
        if (suggestTimer.current) clearTimeout(suggestTimer.current);
        if (value.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
        suggestTimer.current = setTimeout(async () => {
            try {
                const data = await apiFetch<Suggestion[]>(`/api/stock-analysis/suggest?q=${encodeURIComponent(value.trim())}`);
                setSuggestions(data); setShowSuggestions(data.length > 0);
            } catch { setSuggestions([]); }
        }, 300);
    };

    const handleSuggestionSelect = (name: string) => {
        setStockName(name); setSuggestions([]); setShowSuggestions(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockName.trim()) return;
        setShowSuggestions(false); setSubmitting(true);
        try {
            await apiFetch(API(''), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stockName: stockName.trim() }) });
            setStockName(''); setSuggestions([]); await loadTasks();
        } catch (e: any) { alert(e.message); }
        finally { setSubmitting(false); }
    };

    const handleSelect = async (task: StockTask) => {
        if (task.status !== 'completed') return;
        setDetailLoading(true);
        reportPanelRef.current?.scrollTo({ top: 0 });
        try { const detail = await apiFetch<StockDetail>(API(`/${task.id}`)); setSelected(detail); setLastUpdated(new Date()); }
        finally { setDetailLoading(false); }
    };

    const handleDelete = async (id: number) => {
        await apiFetch(API(`/${id}`), { method: 'DELETE' });
        if (selected?.id === id) setSelected(null);
        setTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleDownload = (task: StockTask | StockDetail) => {
        const detail = selected?.id === task.id ? selected : null;
        if (!detail?.analysisReport) return;
        const blob = new Blob([detail.analysisReport], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${task.stockName}_분석보고서.md`; a.click();
        URL.revokeObjectURL(url);
    };

    const handleRetry = async (id: number) => {
        await apiFetch(API(`/${id}/retry`), { method: 'POST' });
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    };

    const krxSymbol = selected?.yahooSymbol ? `KRX:${selected.yahooSymbol.replace(/\.(KS|KQ)$/i, '')}` : null;
    const naverCode = krxSymbol ? krxSymbol.replace('KRX:', '') : null;
    const naverUrl = naverCode ? `https://finance.naver.com/item/main.naver?code=${naverCode}` : null;
    const naverChartImg = selected?.chartImageUrl ?? null;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,37,32,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif" }}>
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 20, width: '100%', maxWidth: 960, height: '100%', maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(45,37,32,0.2)', overflow: 'hidden' }}>

                {/* 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <TrendingUp size={16} style={{ color: T.gold }} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontFamily: '"Nanum Myeongjo", serif', letterSpacing: '0.02em' }}>
                            주식 정밀분석 <span style={{ fontSize: 10, letterSpacing: '0.2em', color: T.gold }}>INVEST VERIFY</span>
                        </span>
                        <span style={{ fontSize: 10, color: T.gold, background: 'rgba(142,111,183,0.1)', border: `1px solid ${T.gold}55`, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>DART + AI</span>
                    </div>
                    <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: T.inkMute, cursor: 'pointer' }}>
                        <X size={17} />
                    </button>
                </div>

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* 좌측 사이드바 */}
                    <div style={{ display: selected ? 'none' : 'flex', width: 220, flexShrink: 0, borderRight: `1px solid ${T.border}`, flexDirection: 'column', background: T.bg }}
                        className="md:flex">
                        <style>{`.stock-sidebar { display: flex !important; } @media (min-width: 768px) { .stock-sidebar-hide { display: none !important; } }`}</style>

                        {/* 검색 폼 */}
                        <form onSubmit={handleSubmit} style={{ padding: 10, borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ position: 'relative' }} ref={inputWrapRef}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        value={stockName}
                                        onChange={e => handleInputChange(e.target.value)}
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                        placeholder="종목명 (예: 삼성전자)"
                                        style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '7px 10px', fontSize: 11, color: T.ink, outline: 'none' }}
                                        autoComplete="off"
                                    />
                                    <button type="submit" disabled={submitting || !stockName.trim()}
                                        style={{ padding: '7px 10px', borderRadius: 10, background: T.accent, border: 'none', cursor: submitting || !stockName.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !stockName.trim() ? 0.4 : 1, flexShrink: 0 }}>
                                        {submitting ? <Loader size={12} style={{ color: '#fff', animation: 'spin 1s linear infinite' }} /> : <Plus size={12} style={{ color: '#fff' }} />}
                                    </button>
                                </div>
                                {showSuggestions && (
                                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 32, marginTop: 4, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(45,37,32,0.15)', zIndex: 10, overflow: 'hidden' }}>
                                        {suggestions.map((s, i) => (
                                            <button key={i} type="button" onMouseDown={() => handleSuggestionSelect(s.corpName)}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', fontSize: 11, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: T.ink }}
                                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.surface}
                                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                            >
                                                <span>{s.corpName}</span>
                                                {s.stockCode && <span style={{ color: T.inkMute, fontSize: 10, fontFamily: 'monospace' }}>{s.stockCode}</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>

                        {/* 상태 범례 */}
                        <div style={{ padding: '6px 12px', borderBottom: `1px solid ${T.borderSoft}`, display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
                            {[['#d97706','대기중'],['#2563eb','분석중'],['#16a34a','분석완료'],['#dc2626','실패']].map(([color, label]) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10, color: T.inkMute }}>{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* 목록 */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                            {loading && <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 11, color: T.inkMute }}>불러오는 중...</div>}
                            {!loading && tasks.length === 0 && (
                                <div style={{ padding: '18px 10px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 700, marginBottom: 6 }}>📊 주식 분석</div>
                                    <p style={{ fontSize: 10.5, color: T.inkMute, lineHeight: 1.6, marginBottom: 12 }}>DART 공시 + AI가 분석해<br/>투자 보고서를 생성합니다.</p>
                                    {/* 진행 흐름 안내 */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
                                        {[['대기중','#d97706'],['분석중','#2563eb'],['완료','#16a34a']].map(([lbl,c], i) => (
                                            <React.Fragment key={lbl}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: c as string }}>
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: c as string }} />{lbl}
                                                </span>
                                                {i < 2 && <span style={{ color: T.inkMute, fontSize: 10 }}>→</span>}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <div style={{ background: T.surface, borderRadius: 8, padding: '9px 10px', fontSize: 10.5, color: T.inkSoft, lineHeight: 1.7 }}>
                                        ① 종목명 입력 후 <span style={{ color: T.accent, fontWeight: 700 }}>+</span> 클릭<br />
                                        ② 분석은 <b>1~2분</b> 걸려요 (자동 갱신)<br />
                                        ③ <b style={{ color: '#16a34a' }}>완료</b> 시 클릭하면 보고서 확인<br />
                                        <span style={{ color: T.inkMute }}>예) 삼성전자 · 카카오 · 현대차</span>
                                    </div>
                                </div>
                            )}
                            {tasks.map(task => {
                                const cfg = STATUS_CONFIG[task.status];
                                const Icon = cfg.icon;
                                const isSelected = selected?.id === task.id;
                                const isDone = task.status === 'completed';
                                const isFail = task.status === 'failed';
                                // 진행 단계 인덱스: 대기중(0) → 분석중(1) → 완료(2). 실패는 스텝퍼 대신 실패 배지.
                                const stepIdx = task.status === 'pending' ? 0 : task.status === 'processing' ? 1 : 2;
                                return (
                                    <div key={task.id}
                                        onClick={() => handleSelect(task)}
                                        style={{
                                            padding: '9px 10px',
                                            borderRadius: 10, marginBottom: 3,
                                            cursor: isDone ? 'pointer' : 'default',
                                            background: isSelected ? T.accentSoft : 'transparent',
                                            border: isSelected ? `1px solid ${T.accent}40` : `1px solid ${T.borderSoft}`,
                                            transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = T.surface; }}
                                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        {/* 상단: 종목명 + 상태 배지 + 액션 */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.stockName}</div>
                                                <div style={{ fontSize: 9.5, color: T.inkMute }}>{new Date(task.createdAt).toLocaleDateString('ko-KR')}</div>
                                            </div>
                                            {/* 상태 배지 */}
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                                                padding: '2px 8px', borderRadius: 999,
                                                fontSize: 10, fontWeight: 700,
                                                color: cfg.cls, background: `${cfg.cls}18`, border: `1px solid ${cfg.cls}40`,
                                            }}>
                                                <Icon size={10} style={task.status === 'processing' ? { animation: 'spin 1s linear infinite' } : undefined} />
                                                {cfg.label}
                                            </span>
                                            <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                                                {isDone && (
                                                    <button onClick={e => { e.stopPropagation(); handleDownload(task); }} style={{ padding: 3, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: T.inkMute }}>
                                                        <Download size={11} />
                                                    </button>
                                                )}
                                                {(isFail || isDone) && (
                                                    <button onClick={e => { e.stopPropagation(); handleRetry(task.id); }} style={{ padding: 3, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: T.inkMute }}>
                                                        <RotateCcw size={11} />
                                                    </button>
                                                )}
                                                <button onClick={e => { e.stopPropagation(); handleDelete(task.id); }} style={{ padding: 3, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: T.inkMute }}>
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 진행 단계 스텝퍼 (실패가 아닐 때) */}
                                        {!isFail ? (
                                            <div style={{ display: 'flex', alignItems: 'center', marginTop: 7 }}>
                                                {['대기중', '분석중', '완료'].map((stepLabel, i) => {
                                                    const reached = i <= stepIdx;
                                                    const active = i === stepIdx && !isDone;
                                                    const stepColor = i === 2 ? '#16a34a' : i === 1 ? '#2563eb' : '#d97706';
                                                    return (
                                                        <React.Fragment key={stepLabel}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                <span style={{
                                                                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                                                                    background: reached ? stepColor : T.borderSoft,
                                                                    boxShadow: active ? `0 0 0 3px ${stepColor}33` : 'none',
                                                                    transition: 'all 0.2s',
                                                                }} />
                                                                <span style={{ fontSize: 8.5, fontWeight: reached ? 700 : 500, color: reached ? stepColor : T.inkMute, whiteSpace: 'nowrap' }}>{stepLabel}</span>
                                                            </div>
                                                            {i < 2 && (
                                                                <span style={{ flex: 1, height: 2, margin: '0 3px', marginBottom: 11, borderRadius: 2, background: i < stepIdx ? stepColor : T.borderSoft, transition: 'all 0.2s' }} />
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            task.errorMessage && <div style={{ fontSize: 10, color: '#dc2626', marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⚠ {task.errorMessage}</div>
                                        )}

                                        {/* 분석중 자동 갱신 안내 */}
                                        {task.status === 'processing' && (
                                            <div style={{ fontSize: 9, color: T.inkMute, marginTop: 5, textAlign: 'center' }}>⏳ 분석 중이에요 · 자동으로 갱신됩니다 (1~2분 소요)</div>
                                        )}
                                        {task.status === 'pending' && (
                                            <div style={{ fontSize: 9, color: T.inkMute, marginTop: 5, textAlign: 'center' }}>순서를 기다리는 중이에요 · 자동 시작됩니다</div>
                                        )}
                                        {isDone && (
                                            <div style={{ fontSize: 9, color: '#16a34a', marginTop: 5, textAlign: 'center' }}>✓ 클릭하면 보고서를 볼 수 있어요</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ padding: 8, borderTop: `1px solid ${T.border}` }}>
                            <button onClick={loadTasks} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', fontSize: 11, color: T.inkSoft, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: 'pointer' }}>
                                <RefreshCw size={10} /> 새로고침
                            </button>
                        </div>
                    </div>

                    {/* 우측 보고서 패널 */}
                    <div ref={reportPanelRef} style={{ flex: 1, minWidth: 0, display: selected ? 'flex' : 'none', flexDirection: 'column', overflowY: 'auto', background: T.bg }}
                        className="md:flex">

                        {/* 모바일 뒤로가기 */}
                        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }} className="md:hidden">
                            <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.inkSoft, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <ChevronLeft size={13} /> 목록으로
                            </button>
                        </div>

                        {detailLoading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.inkMute, gap: 8, fontSize: 13 }}>
                                <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> 불러오는 중...
                            </div>
                        )}

                        {!detailLoading && !selected && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: T.inkMute, gap: 10 }}>
                                <TrendingUp size={36} style={{ color: T.borderSoft }} />
                                <p style={{ fontSize: 12 }}>완료된 분석을 클릭하면 보고서가 표시됩니다</p>
                            </div>
                        )}

                        {!detailLoading && selected && (
                            <div>
                                {/* 학습하기 안내 */}
                                <div style={{ margin: '14px 20px 0', display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(142,111,183,0.08)', border: `1px solid ${T.gold}45`, borderRadius: 12, padding: '10px 14px' }}>
                                    <MessageCircle size={13} style={{ color: T.gold, flexShrink: 0, marginTop: 1 }} />
                                    <p style={{ fontSize: 11, color: T.inkSoft, lineHeight: 1.6, margin: 0 }}>
                                        <span style={{ fontWeight: 700, color: T.gold }}>학습하기</span> — 본 보고서를 전담 AI 애널리스트 윤채원에게 학습시켜, 심층 질의응답과 인사이트 토론을 활성화할 수 있습니다.
                                    </p>
                                </div>

                                {/* 보고서 헤더 — 종목명 + 차트 썸네일 나란히 */}
                                <div style={{ margin: '14px 20px 0', background: 'linear-gradient(135deg, #ffffff 0%, #f7f3fb 100%)', border: `1px solid ${T.gold}55`, borderRadius: 14, padding: '16px', boxShadow: '0 4px 16px -8px rgba(142,111,183,0.4)' }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                                        {/* 종목 정보 */}
                                        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                                            <h3 style={{ fontSize: 22, fontWeight: 800, color: T.ink, margin: '0 0 4px', lineHeight: 1.2, fontFamily: '"Nanum Myeongjo", serif' }}>{selected.stockName}</h3>
                                            <p style={{ fontSize: 11, color: T.inkMute, margin: 0 }}>
                                                정밀 투자 분석 보고서 &nbsp;·&nbsp; {new Date(selected.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        </div>

                                        {/* 차트 썸네일 — 작은 다크 카드 */}
                                        {naverUrl && naverChartImg && (
                                            <a href={naverUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ flexShrink: 0, display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid #1e3a5f', background: '#0d1628', width: 160, textDecoration: 'none', boxShadow: '0 4px 16px rgba(13,22,40,0.35)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(13,22,40,0.5)'; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(13,22,40,0.35)'; }}
                                            >
                                                <img src={naverChartImg} alt={`${selected.stockName} 주가 차트`}
                                                    style={{ width: '100%', display: 'block' }}
                                                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                                                />
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '4px 0', background: '#0a1628' }}>
                                                    <TrendingUp size={9} style={{ color: '#60a5fa' }} />
                                                    <span style={{ fontSize: 9, color: '#60a5fa' }}>네이버 금융 ↗</span>
                                                </div>
                                            </a>
                                        )}

                                        {/* 버튼 그룹 */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                                            <button
                                                onClick={async () => {
                                                    if (consulting || selected.status !== 'completed') return;
                                                    setConsulting(true);
                                                    try { await stockReportApi.consult(selected.id); onClose(); onConsult?.(YUNCHAEWON_PERSONA_ID, selected.stockName); }
                                                    catch (e: any) { alert(e.message || '학습 저장 실패'); setConsulting(false); }
                                                }}
                                                disabled={consulting || selected.status !== 'completed'}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: 'rgba(142,111,183,0.1)', border: `1.5px solid ${T.gold}`, color: T.gold, fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: consulting || selected.status !== 'completed' ? 0.5 : 1 }}
                                            >
                                                {consulting ? <><Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> 학습 중...</> : <><MessageCircle size={11} /> 학습하기</>}
                                            </button>
                                            <button onClick={() => handleDownload(selected)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, background: T.surface, border: `1px solid ${T.border}`, color: T.inkSoft, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                                <Download size={11} /> .md 다운로드
                                            </button>
                                        </div>
                                    </div>

                                    {/* 데이터 소스 */}
                                    <div style={{ background: T.surface, borderRadius: 8, padding: '8px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                                        <BarChart2 size={11} style={{ color: T.inkMute }} />
                                        <span style={{ fontSize: 10, fontWeight: 700, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em' }}>데이터 소스</span>
                                        <span style={{ fontSize: 10, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>DART 공시</span>
                                        <span style={{ fontSize: 10, color: T.inkMute }}>금융감독원 전자공시</span>
                                        <span style={{ color: T.border }}>·</span>
                                        <span style={{ fontSize: 10, color: T.accent, background: T.accentSoft, border: `1px solid ${T.accent}40`, padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>AI 분석</span>
                                        <span style={{ fontSize: 10, color: T.inkMute }}>Gemini + Google Search</span>
                                        {krxSymbol && <span style={{ fontSize: 10, color: T.inkMute, fontFamily: 'monospace' }}>{krxSymbol}</span>}
                                    </div>
                                </div>

                                {/* AI 투자의견 */}
                                <AiOpinionCard geminiReport={selected.analysisReport} claudeReport={selected.claudeReport} gptReport={selected.gptReport} />

                                {/* 보고서 본문 */}
                                <div style={{ padding: '16px 20px', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                                    {selected.analysisReport
                                        ? <ReportRenderer content={selected.analysisReport} />
                                        : <p style={{ fontSize: 12, color: T.inkMute, padding: '16px 0' }}>보고서 내용이 없습니다.</p>
                                    }
                                </div>

                                {/* Last updated */}
                                {lastUpdated && (
                                    <div style={{ padding: '0 20px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                                            <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#16a34a', opacity: 0.75, animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
                                            <span style={{ position: 'relative', borderRadius: '50%', width: 8, height: 8, background: '#16a34a' }} />
                                        </span>
                                        <span style={{ fontSize: 10, color: T.inkMute }}>last updated {fmtTime(lastUpdated)}</span>
                                    </div>
                                )}

                                <SourceLinks raw={selected.sourceLinks} />
                            </div>
                        )}
                    </div>

                    {/* 우측 빈 상태 (선택 없을 때 md 이상) */}
                    {!selected && (
                        <div style={{ flex: 1, display: 'none', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: T.inkMute }} className="md:flex">
                            <TrendingUp size={40} style={{ color: T.borderSoft }} />
                            <p style={{ fontSize: 12 }}>완료된 분석을 클릭하면 보고서가 표시됩니다</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
                @media (min-width: 768px) {
                    .stock-left { display: flex !important; }
                    .stock-right { display: flex !important; }
                }
            `}</style>
        </div>
    );
};

const SourceLinks: React.FC<{ raw: string | null }> = ({ raw }) => {
    if (!raw) return null;
    let links: string[];
    try { links = JSON.parse(raw); } catch { return null; }
    if (!links.length) return null;
    return (
        <div style={{ padding: '12px 20px 24px', borderTop: `1px solid ${T.borderSoft}`, marginTop: 4 }}>
            <div style={{ fontSize: 10, color: T.inkMute, marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>참고 출처 ({links.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                {links.slice(0, 10).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', maxWidth: '100%', fontSize: 10, color: '#2563eb', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.7 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '0.7'}
                    >{url}</a>
                ))}
            </div>
        </div>
    );
};
