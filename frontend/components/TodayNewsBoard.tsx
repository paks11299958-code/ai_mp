import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Newspaper, Volume2, VolumeX, Loader, RefreshCw } from 'lucide-react';

interface Props {
    onClose: () => void;
}

interface CategoryItem {
    key: string;
    label: string;
    emoji: string;
}

interface NewsData {
    date: string;
    category: string;
    label: string;
    report: string;
    sources_count: number;
    collected_at: string;
}

interface NewsItem {
    title: string;
    content: string;
    sources: string[];
}

const CATEGORIES: CategoryItem[] = [
    { key: '국내뉴스', label: '국내', emoji: '🇰🇷' },
    { key: '해외뉴스', label: '해외', emoji: '🌍' },
    { key: '경제증시', label: '경제', emoji: '📈' },
    { key: 'AI기술',   label: 'AI/기술', emoji: '🤖' },
    { key: '부동산',   label: '부동산', emoji: '🏢' },
    { key: '스포츠',   label: '스포츠', emoji: '⚽' },
];

// "### 제목\n- **핵심 내용**: ...\n- **출처**: ..." 패턴 파싱
function parseNewsItems(report: string): { intro: string; items: NewsItem[] } {
    const lines = report.split('\n');
    let intro = '';
    const items: NewsItem[] = [];
    let current: NewsItem | null = null;
    let foundFirstH3 = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('### ')) {
            foundFirstH3 = true;
            if (current) items.push(current);
            current = { title: trimmed.replace(/^###\s*/, ''), content: '', sources: [] };
        } else if (!foundFirstH3) {
            if (trimmed) intro += (intro ? ' ' : '') + trimmed;
        } else if (current) {
            const srcMatch = trimmed.match(/^-\s*\*\*출처\*\*[:\s]*(.+)$/);
            const contentMatch = trimmed.match(/^-\s*\*\*핵심\s*내용\*\*[:\s]*(.+)$/);
            if (srcMatch) {
                current.sources = srcMatch[1].split(/,\s*/).map(s => s.trim()).filter(Boolean);
            } else if (contentMatch) {
                current.content = contentMatch[1].trim();
            } else if (trimmed.startsWith('- ')) {
                const plain = trimmed.replace(/^-\s*/, '').replace(/\*\*/g, '');
                if (!current.content) current.content = plain;
            }
        }
    }
    if (current) items.push(current);
    return { intro, items };
}

function useTTS() {
    const [speaking, setSpeaking] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        audioRef.current?.pause();
        setSpeaking(false);
        setTtsLoading(false);
    }, []);

    const speak = useCallback(async (text: string) => {
        stop();
        setTtsLoading(true);
        try {
            const res = await fetch('/api/math-tutor-tts', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ text: text.slice(0, 2000) }),
            });
            if (!res.ok) throw new Error('TTS 실패');
            const url = URL.createObjectURL(await res.blob());
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
            audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
            setTtsLoading(false);
            setSpeaking(true);
            await audio.play();
        } catch {
            setTtsLoading(false);
            setSpeaking(false);
        }
    }, [stop]);

    useEffect(() => () => { audioRef.current?.pause(); }, []);
    return { speaking, ttsLoading, speak, stop };
}

function formatTime(iso: string) {
    try {
        return new Date(iso).toLocaleString('ko-KR', {
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch { return ''; }
}

function formatDate(dateStr: string) {
    try {
        const d = new Date(dateStr);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    } catch { return dateStr; }
}

export const TodayNewsBoard: React.FC<Props> = ({ onClose }) => {
    const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
    const [newsMap, setNewsMap] = useState<Record<string, NewsData | null>>({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [collectedAt, setCollectedAt] = useState<string | null>(null);
    const { speaking, ttsLoading, speak, stop } = useTTS();

    const fetchCategory = useCallback(async (key: string) => {
        if (newsMap[key] !== undefined) return;
        setLoadingKey(key);
        setError(null);
        try {
            const res = await fetch(`/api/news/today?category=${encodeURIComponent(key)}`, {
                credentials: 'include',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({})) as any;
                throw new Error(d.error || `오류 ${res.status}`);
            }
            const data: NewsData = await res.json();
            setNewsMap(prev => ({ ...prev, [key]: data }));
            if (!collectedAt) setCollectedAt(data.collected_at);
        } catch (e: any) {
            setNewsMap(prev => ({ ...prev, [key]: null }));
            setError(e.message);
        } finally {
            setLoadingKey(null);
        }
    }, [newsMap, collectedAt]);

    useEffect(() => { fetchCategory(activeKey); }, [activeKey]);

    const handleTab = (key: string) => {
        if (key !== activeKey) stop();
        setActiveKey(key);
        fetchCategory(key);
    };

    const current = newsMap[activeKey];
    const isLoading = loadingKey === activeKey;
    const activeCat = CATEGORIES.find(c => c.key === activeKey)!;

    const ttsText = current
        ? current.report.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/- /g, '')
        : '';

    const parsed = current ? parseNewsItems(current.report) : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-sky-700/40 bg-[#0d1117] shadow-2xl overflow-hidden">

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-sky-700/30 bg-sky-900/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Newspaper size={17} className="text-sky-400" />
                        <span className="text-sm font-semibold text-sky-200">오늘의 뉴스</span>
                        {collectedAt && (
                            <span className="text-[11px] text-sky-600 ml-1">
                                수집 {formatTime(collectedAt)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {current && (
                            <button
                                onClick={() => speaking ? stop() : speak(ttsText)}
                                disabled={ttsLoading}
                                className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-sky-600/50 bg-sky-900/20 text-sky-300 hover:bg-sky-800/40 transition-colors disabled:opacity-50"
                            >
                                {ttsLoading ? <Loader size={12} className="animate-spin" /> : speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                                {ttsLoading ? '준비중' : speaking ? '중지' : '음성'}
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 카테고리 탭 */}
                <div className="flex gap-1 px-4 py-2.5 border-b border-sky-700/20 bg-black/20 overflow-x-auto flex-shrink-0 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => handleTab(cat.key)}
                            className={`flex items-center gap-1 text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0
                                ${activeKey === cat.key
                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/50'
                                    : 'bg-white/5 text-sky-400 border border-sky-700/30 hover:bg-sky-900/30'
                                }`}
                        >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                            {newsMap[cat.key] !== undefined && newsMap[cat.key] !== null && activeKey !== cat.key && (
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                            )}
                        </button>
                    ))}
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto">

                    {/* 로딩 */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
                                <Newspaper size={18} className="absolute inset-0 m-auto text-sky-400" />
                            </div>
                            <p className="text-sm text-sky-300">뉴스를 불러오는 중...</p>
                        </div>
                    )}

                    {/* 에러 */}
                    {!isLoading && error && newsMap[activeKey] === null && (
                        <div className="flex flex-col items-center gap-4 py-16 text-center">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button
                                onClick={() => {
                                    setNewsMap(prev => { const n = { ...prev }; delete n[activeKey]; return n; });
                                    fetchCategory(activeKey);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-900/30 border border-sky-700/40 text-sky-300 hover:bg-sky-800/40 transition-colors text-sm"
                            >
                                <RefreshCw size={14} /> 다시 시도
                            </button>
                        </div>
                    )}

                    {/* 뉴스 카드 목록 */}
                    {!isLoading && parsed && (
                        <div className="p-4 space-y-0">

                            {/* 날짜 + 카테고리 배지 */}
                            <div className="flex items-center gap-2 mb-4">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-900/30 border border-sky-700/30">
                                    <span className="text-base">{activeCat.emoji}</span>
                                    <span className="text-xs font-semibold text-sky-300">{activeCat.label}</span>
                                </div>
                                {current && (
                                    <span className="text-[11px] text-gray-500">{formatDate(current.date)} 뉴스</span>
                                )}
                                {current && (
                                    <span className="ml-auto text-[11px] text-gray-600">출처 {current.sources_count}개</span>
                                )}
                            </div>

                            {/* 인트로 문장 */}
                            {parsed.intro && (
                                <div className="mb-4 px-3 py-2.5 rounded-lg bg-sky-950/40 border-l-2 border-sky-500/50">
                                    <p className="text-xs text-sky-300/80 leading-relaxed">{parsed.intro}</p>
                                </div>
                            )}

                            {/* 뉴스 아이템 카드들 */}
                            <div className="space-y-2.5">
                                {parsed.items.map((item, idx) => (
                                    <NewsCard key={idx} item={item} index={idx} />
                                ))}
                            </div>

                            {parsed.items.length === 0 && (
                                <div className="text-center py-10 text-gray-500 text-sm">뉴스 항목을 불러올 수 없습니다.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const NewsCard: React.FC<{ item: NewsItem; index: number }> = ({ item, index }) => {
    return (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-sky-700/30 transition-all overflow-hidden">
            {/* 제목 행 */}
            <div className="flex items-start gap-3 px-4 py-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-800/60 text-sky-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                </span>
                <p className="flex-1 text-sm font-semibold text-gray-100 leading-snug">
                    {item.title}
                </p>
            </div>

            {/* 상세 내용 — 항상 표시 */}
            <div className="px-4 pb-3.5 space-y-2.5 border-t border-white/5">
                {item.content && (
                    <div className="pt-3">
                        <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 text-[10px] font-semibold text-sky-400 bg-sky-900/40 px-1.5 py-0.5 rounded mt-0.5">
                                핵심
                            </span>
                            <p className="text-xs text-gray-300 leading-relaxed">{item.content}</p>
                        </div>
                    </div>
                )}

                {item.sources.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-[10px] text-gray-600">출처</span>
                        {item.sources.map((src, i) => (
                            <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800/80 text-gray-400 border border-gray-700/50 font-mono"
                            >
                                {src}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
