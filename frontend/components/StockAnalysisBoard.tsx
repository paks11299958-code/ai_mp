import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, TrendingUp, Clock, CheckCircle, XCircle, Loader, Download, Trash2, RefreshCw, RotateCcw, ChevronLeft, BarChart2 } from 'lucide-react';

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
    sourceLinks: string | null;
    yahooSymbol?: string | null;
    chartImageUrl?: string | null;
}

interface Props {
    onClose: () => void;
}

const API = (path: string) => `/api/stock-analysis${path}`;

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}

const STATUS_CONFIG = {
    pending:    { label: '대기중',   icon: Clock,        cls: 'text-yellow-400' },
    processing: { label: '분석중',   icon: Loader,       cls: 'text-blue-400' },
    completed:  { label: '완료',     icon: CheckCircle,  cls: 'text-green-400' },
    failed:     { label: '실패',     icon: XCircle,      cls: 'text-red-400' },
};


const fmtTime = (d: Date) => d.toTimeString().slice(0, 5);

// Inline formatter: **bold**, *italic*, `code`
function renderInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        const token = m[0];
        if (token.startsWith('**'))
            parts.push(<strong key={m.index} className="text-white font-semibold">{token.slice(2, -2)}</strong>);
        else if (token.startsWith('*'))
            parts.push(<em key={m.index} className="italic text-slate-200">{token.slice(1, -1)}</em>);
        else
            parts.push(<code key={m.index} className="bg-slate-700 text-green-300 px-1 py-0.5 rounded text-xs font-mono">{token.slice(1, -1)}</code>);
        last = m.index + token.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
}

// Markdown table block
const TableBlock: React.FC<{ lines: string[] }> = ({ lines }) => {
    const dataRows = lines.filter(l => !/^\|[\s\-:|]+\|$/.test(l.trim()));
    const rows = dataRows.map(l => l.split('|').slice(1, -1).map(c => c.trim()));
    if (rows.length === 0) return null;
    const [header, ...body] = rows;
    return (
        <div className="my-3 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr className="bg-slate-700/80">
                        {header.map((cell, i) => (
                            <th key={i} className="px-3 py-2 text-left text-slate-200 font-semibold border-r border-slate-600 last:border-r-0 whitespace-nowrap">
                                {renderInline(cell)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {body.map((row, ri) => (
                        <tr key={ri} className={`border-t border-slate-700/50 ${ri % 2 !== 0 ? 'bg-slate-800/30' : ''}`}>
                            {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-slate-300 border-r border-slate-700/40 last:border-r-0">
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

// Full markdown-to-JSX renderer
const ReportRenderer: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let pendingList: { line: string; idx: number }[] = [];

    const flushList = () => {
        if (!pendingList.length) return;
        elements.push(
            <ul key={`ul-${pendingList[0].idx}`} className="my-2 space-y-0.5">
                {pendingList.map(({ line, idx }) => (
                    <li key={idx} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                        <span className="text-blue-400 shrink-0 mt-0.5">▸</span>
                        <span>{renderInline(line.slice(2))}</span>
                    </li>
                ))}
            </ul>
        );
        pendingList = [];
    };

    while (i < lines.length) {
        const line = lines[i];

        // Table: collect consecutive | lines
        if (line.startsWith('|')) {
            flushList();
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('|')) { tableLines.push(lines[i++]); }
            elements.push(<TableBlock key={`tbl-${i}`} lines={tableLines} />);
            continue;
        }

        // List item accumulation
        if (line.startsWith('- ') || line.startsWith('* ')) {
            pendingList.push({ line, idx: i++ });
            continue;
        }

        flushList();

        if (line.startsWith('# ')) {
            elements.push(
                <h1 key={i} className="text-base font-bold text-white mt-5 mb-2 pb-2 border-b border-slate-700">
                    {renderInline(line.slice(2))}
                </h1>
            );
        } else if (line.startsWith('## ')) {
            elements.push(
                <div key={i} className="flex items-center gap-0 mt-5 mb-2 bg-blue-950/40 px-3 py-2 rounded-lg border-l-4 border-blue-500">
                    <h2 className="text-sm font-bold text-blue-200">{renderInline(line.slice(3))}</h2>
                </div>
            );
        } else if (line.startsWith('### ')) {
            elements.push(
                <h3 key={i} className="text-xs font-semibold text-slate-300 mt-3 mb-1 pl-2 border-l-2 border-slate-500">
                    {renderInline(line.slice(4))}
                </h3>
            );
        } else if (line.startsWith('> ')) {
            elements.push(
                <blockquote key={i} className="border-l-2 border-amber-400 pl-3 py-1.5 my-2 bg-amber-400/10 rounded-r text-amber-200/80 text-xs leading-relaxed">
                    {renderInline(line.slice(2))}
                </blockquote>
            );
        } else if (line.startsWith('---')) {
            elements.push(<hr key={i} className="border-slate-700 my-4" />);
        } else if (line.trim() === '') {
            elements.push(<div key={i} className="h-1" />);
        } else {
            elements.push(
                <p key={i} className="text-xs text-slate-300 leading-relaxed">
                    {renderInline(line)}
                </p>
            );
        }
        i++;
    }

    flushList();
    return <div className="space-y-0.5 pb-6">{elements}</div>;
};

interface Suggestion { corpName: string; stockCode: string | null; }

export const StockAnalysisBoard: React.FC<Props> = ({ onClose }) => {
    const [tasks, setTasks] = useState<StockTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [stockName, setStockName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selected, setSelected] = useState<StockDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputWrapRef = useRef<HTMLDivElement>(null);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<StockTask[]>(API(''));
            setTasks(data);
        } catch { }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, 10000);
        return () => clearTimeout(t);
    }, [tasks, loadTasks]);

    // 외부 클릭 시 드롭다운 닫기
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
                setSuggestions(data);
                setShowSuggestions(data.length > 0);
            } catch { setSuggestions([]); }
        }, 300);
    };

    const handleSuggestionSelect = (name: string) => {
        setStockName(name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockName.trim()) return;
        setShowSuggestions(false);
        setSubmitting(true);
        try {
            await apiFetch(API(''), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stockName: stockName.trim() }),
            });
            setStockName('');
            setSuggestions([]);
            await loadTasks();
        } catch (e: any) { alert(e.message); }
        finally { setSubmitting(false); }
    };

    const handleSelect = async (task: StockTask) => {
        if (task.status !== 'completed') return;
        setDetailLoading(true);
        try {
            const detail = await apiFetch<StockDetail>(API(`/${task.id}`));
            setSelected(detail);
            setLastUpdated(new Date());
        } finally { setDetailLoading(false); }
    };

    const handleDownload = (task: StockTask) => window.open(API(`/${task.id}/download`), '_blank');

    const handleDelete = async (id: number) => {
        if (!confirm('삭제하시겠습니까?')) return;
        await apiFetch(API(`/${id}`), { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== id));
        if (selected?.id === id) setSelected(null);
    };

    const handleRetry = async (id: number) => {
        await apiFetch(API(`/${id}/retry`), { method: 'POST' });
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' } : t));
    };

    const krxSymbol = selected?.yahooSymbol
        ? `KRX:${selected.yahooSymbol.replace(/\.(KS|KQ)$/i, '')}`
        : null;
    const naverCode = krxSymbol ? krxSymbol.replace('KRX:', '') : null;
    const naverUrl = naverCode ? `https://finance.naver.com/item/main.naver?code=${naverCode}` : null;
    const naverChartImg = selected?.chartImageUrl ?? null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center md:p-4">
            <div className="bg-slate-900 md:border border-slate-700 md:rounded-2xl w-full md:max-w-5xl h-full md:h-auto md:max-h-[95vh] flex flex-col shadow-2xl">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 shrink-0 bg-gradient-to-r from-slate-900 to-blue-950/40 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={17} className="text-blue-400" />
                        <h2 className="text-sm font-bold text-white">주식 분석</h2>
                        <span className="text-[10px] text-blue-300/70 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">DART + AI</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
                        <X size={17} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* 좌측: 종목 목록 — 모바일: 상세 없을 때만 표시 */}
                    <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-60 shrink-0 border-r border-slate-800 flex-col`}>
                        <form onSubmit={handleSubmit} className="p-3 border-b border-slate-800">
                            <div className="relative" ref={inputWrapRef}>
                                <div className="flex gap-2">
                                    <input
                                        value={stockName}
                                        onChange={e => handleInputChange(e.target.value)}
                                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                        placeholder="종목명 (예: 삼성전자)"
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="submit"
                                        disabled={submitting || !stockName.trim()}
                                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 transition-colors shrink-0"
                                    >
                                        {submitting
                                            ? <Loader size={13} className="animate-spin text-white" />
                                            : <Plus size={13} className="text-white" />}
                                    </button>
                                </div>
                                {showSuggestions && (
                                    <div className="absolute top-full left-0 right-8 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 overflow-hidden">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onMouseDown={() => handleSuggestionSelect(s.corpName)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-700 transition-colors text-left"
                                            >
                                                <span className="text-white">{s.corpName}</span>
                                                {s.stockCode && (
                                                    <span className="text-slate-500 font-mono text-[10px]">{s.stockCode}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </form>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {loading && <div className="text-center py-8 text-slate-500 text-xs">불러오는 중...</div>}
                            {!loading && tasks.length === 0 && (
                                <div className="px-3 py-6 space-y-4">
                                    {/* 설명 */}
                                    <div className="text-center space-y-1.5">
                                        <div className="text-slate-300 text-xs font-semibold">📊 주식 분석</div>
                                        <p className="text-slate-500 text-[11px] leading-relaxed">
                                            DART 공시 + Yahoo Finance 데이터를<br />AI가 분석해 투자 보고서를 생성합니다.
                                        </p>
                                    </div>
                                    {/* 사용법 */}
                                    <div className="bg-slate-800/50 rounded-xl px-3 py-2.5 space-y-1">
                                        <p className="text-slate-400 text-[11px]">종목명 입력 후 <span className="text-blue-400 font-medium">+</span> 버튼 클릭</p>
                                        <p className="text-slate-600 text-[10px]">예) 삼성전자 · 카카오 · 현대차</p>
                                        <p className="text-slate-600 text-[10px] mt-1">⏱ 분석은 최대 1분 소요됩니다</p>
                                    </div>
                                    {/* 아이콘 범례 */}
                                    <div className="border-t border-slate-800 pt-3 grid grid-cols-2 gap-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <Clock size={11} className="text-yellow-400 shrink-0" />
                                            <span className="text-[10px] text-slate-500">대기중</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Loader size={11} className="text-blue-400 shrink-0" />
                                            <span className="text-[10px] text-slate-500">분석중</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle size={11} className="text-green-400 shrink-0" />
                                            <span className="text-[10px] text-slate-500">완료</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <XCircle size={11} className="text-red-400 shrink-0" />
                                            <span className="text-[10px] text-slate-500">실패 / 재시도</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {tasks.map(task => {
                                const cfg = STATUS_CONFIG[task.status];
                                const Icon = cfg.icon;
                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => handleSelect(task)}
                                        className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                                            task.status === 'completed' ? 'cursor-pointer hover:bg-slate-800' : 'cursor-default'
                                        } ${selected?.id === task.id ? 'bg-slate-800 ring-1 ring-blue-500/40' : ''}`}
                                    >
                                        <Icon size={13} className={`${cfg.cls} shrink-0 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white truncate">{task.stockName}</div>
                                            <div className="text-[10px] text-slate-500">{new Date(task.createdAt).toLocaleDateString('ko-KR')}</div>
                                            {task.status === 'failed' && task.errorMessage && (
                                                <div className="text-[10px] text-red-400 truncate mt-0.5">{task.errorMessage}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {task.status === 'completed' && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDownload(task); }}
                                                    className="p-1 rounded text-slate-500 hover:text-blue-400 transition-colors"
                                                    title=".md 다운로드"
                                                >
                                                    <Download size={11} />
                                                </button>
                                            )}
                                            {(task.status === 'failed' || task.status === 'completed') && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleRetry(task.id); }}
                                                    className="p-1 rounded text-slate-500 hover:text-yellow-400 transition-colors"
                                                    title="재분석"
                                                >
                                                    <RotateCcw size={11} />
                                                </button>
                                            )}
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                                                className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-2 border-t border-slate-800">
                            <button onClick={loadTasks} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
                                <RefreshCw size={11} /> 새로고침
                            </button>
                        </div>
                    </div>

                    {/* 우측: 보고서 패널 — 모바일: 상세 있을 때만 표시 */}
                    <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto`}>
                        {/* 모바일 뒤로가기 */}
                        <div className="md:hidden flex items-center px-4 py-2 border-b border-slate-800 shrink-0">
                            <button
                                onClick={() => setSelected(null)}
                                className="flex items-center gap-1 text-slate-400 hover:text-white text-xs transition-colors"
                            >
                                <ChevronLeft size={14} /> 목록으로
                            </button>
                        </div>
                        {detailLoading && (
                            <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                                <Loader size={16} className="animate-spin mr-2" /> 불러오는 중...
                            </div>
                        )}
                        {!detailLoading && !selected && (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                                <TrendingUp size={40} className="text-slate-700" />
                                <p className="text-xs">완료된 분석을 클릭하면 보고서가 표시됩니다</p>
                            </div>
                        )}
                        {!detailLoading && selected && (
                            <div>
                                {/* 보고서 헤더 */}
                                <div style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #0a1628 100%)', borderBottom: '1px solid rgba(30,58,138,0.3)' }} className="px-5 py-4">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white tracking-tight">{selected.stockName}</h3>
                                            <p className="text-xs text-slate-400 mt-1">
                                                주식 분석 보고서 &nbsp;·&nbsp; {new Date(selected.updatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleDownload(selected)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs transition-colors shrink-0 mt-1 font-medium"
                                        >
                                            <Download size={12} /> .md 다운로드
                                        </button>
                                    </div>
                                    {/* 데이터 소스 카드 */}
                                    <div style={{ background: '#0d1628', border: '1px solid #1a2942' }} className="rounded-xl p-3.5">
                                        <div className="flex items-center gap-1.5 mb-2">
                                            <BarChart2 size={12} className="text-blue-400" />
                                            <span className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">데이터 소스</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded font-medium">DART 공시</span>
                                            <span className="text-[10px] text-slate-500">금융감독원 전자공시</span>
                                            <span className="text-slate-700">·</span>
                                            <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-medium">AI 분석</span>
                                            <span className="text-[10px] text-slate-500">Gemini + Google Search</span>
                                            {krxSymbol && <span className="text-[10px] text-slate-500 font-mono">{krxSymbol}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* 주가 차트 — 네이버 금융 이미지 */}
                                {naverUrl && naverChartImg && (
                                    <div className="px-5 pt-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1 h-4 bg-blue-500 rounded-full shrink-0" />
                                            <span className="text-xs font-semibold text-blue-200">주가 차트</span>
                                            <span className="text-[10px] text-slate-500">by 네이버 금융</span>
                                        </div>
                                        <a href={naverUrl} target="_blank" rel="noopener noreferrer"
                                            className="block rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500/40 transition-colors group">
                                            <img
                                                src={naverChartImg}
                                                alt={`${selected.stockName} 주가 차트`}
                                                className="w-full block"
                                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                            <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-800/60 group-hover:bg-slate-700/60 transition-colors">
                                                <TrendingUp size={11} className="text-blue-400" />
                                                <span className="text-[11px] text-slate-400 group-hover:text-white transition-colors">네이버 금융에서 자세히 보기 ↗</span>
                                            </div>
                                        </a>
                                    </div>
                                )}

                                {/* 보고서 본문 */}
                                <div className="px-5 pt-4">
                                    {selected.analysisReport
                                        ? <ReportRenderer content={selected.analysisReport} />
                                        : <p className="text-slate-500 text-sm py-4">보고서 내용이 없습니다.</p>
                                    }
                                </div>

                                {/* Last updated */}
                                {lastUpdated && (
                                    <div className="px-5 pt-2 pb-1 flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                        </span>
                                        <span className="text-[10px] text-slate-500">last updated {fmtTime(lastUpdated)}</span>
                                    </div>
                                )}

                                {/* 참고 출처 */}
                                <SourceLinks raw={selected.sourceLinks} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SourceLinks: React.FC<{ raw: string | null }> = ({ raw }) => {
    if (!raw) return null;
    let links: string[];
    try { links = JSON.parse(raw); } catch { return null; }
    if (!links.length) return null;
    return (
        <div className="px-5 pb-6 pt-3 mt-2 border-t border-slate-800">
            <div className="text-[10px] text-slate-500 mb-2 font-semibold uppercase tracking-wider">참고 출처 ({links.length})</div>
            <div className="space-y-1">
                {links.slice(0, 10).map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="block text-[10px] text-blue-400/60 hover:text-blue-400 truncate transition-colors">
                        {url}
                    </a>
                ))}
            </div>
        </div>
    );
};
