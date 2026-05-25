import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Newspaper, Volume2, VolumeX, Loader, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    onClose: () => void;
}

interface CategoryItem {
    key: string;
    label: string;
}

interface NewsData {
    date: string;
    category: string;
    label: string;
    report: string;
    sources_count: number;
    collected_at: string;
}

const CATEGORIES: CategoryItem[] = [
    { key: '국내뉴스', label: '🇰🇷 국내' },
    { key: '해외뉴스', label: '🌍 해외' },
    { key: '경제증시', label: '📈 경제' },
    { key: 'AI기술',   label: '🤖 AI/기술' },
    { key: '부동산',   label: '🏢 부동산' },
    { key: '스포츠',   label: '⚽ 스포츠' },
];

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

export const TodayNewsBoard: React.FC<Props> = ({ onClose }) => {
    const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);
    const [newsMap, setNewsMap] = useState<Record<string, NewsData | null>>({});
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [collectedAt, setCollectedAt] = useState<string | null>(null);
    const { speaking, ttsLoading, speak, stop } = useTTS();

    const fetchCategory = useCallback(async (key: string) => {
        if (newsMap[key] !== undefined) return; // 이미 로드됨
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

    useEffect(() => {
        fetchCategory(activeKey);
    }, [activeKey]);

    const handleTab = (key: string) => {
        if (key !== activeKey) stop();
        setActiveKey(key);
        fetchCategory(key);
    };

    const current = newsMap[activeKey];
    const isLoading = loadingKey === activeKey;
    const ttsText = current ? current.report.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/- /g, '') : '';

    const formatTime = (iso: string) => {
        try { return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
        catch { return ''; }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-sky-700/40 bg-[#0d1117] shadow-2xl overflow-hidden">

                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-sky-700/30 bg-sky-900/10 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Newspaper size={18} className="text-sky-400" />
                        <span className="text-base font-semibold text-sky-200">오늘의 뉴스</span>
                        {collectedAt && (
                            <span className="text-[11px] text-sky-600 ml-1">수집 {formatTime(collectedAt)}</span>
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
                <div className="flex gap-1 px-4 py-2.5 border-b border-sky-700/20 bg-black/20 overflow-x-auto flex-shrink-0">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => handleTab(cat.key)}
                            className={`text-[11px] font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-all flex-shrink-0
                                ${activeKey === cat.key
                                    ? 'bg-sky-600 text-white border border-sky-500'
                                    : 'bg-transparent text-sky-400 border border-sky-700/40 hover:bg-sky-900/30'
                                }`}
                        >
                            {cat.label}
                            {newsMap[cat.key] !== undefined && newsMap[cat.key] !== null && activeKey !== cat.key && (
                                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-sky-400 inline-block align-middle" />
                            )}
                        </button>
                    ))}
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-5">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center gap-4 py-16">
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
                                <Newspaper size={18} className="absolute inset-0 m-auto text-sky-400" />
                            </div>
                            <p className="text-sm text-sky-300">뉴스를 불러오는 중...</p>
                        </div>
                    )}

                    {!isLoading && error && newsMap[activeKey] === null && (
                        <div className="flex flex-col items-center gap-4 py-12 text-center">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button
                                onClick={() => { setNewsMap(prev => { const n = {...prev}; delete n[activeKey]; return n; }); fetchCategory(activeKey); }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-900/30 border border-sky-700/40 text-sky-300 hover:bg-sky-800/40 transition-colors text-sm"
                            >
                                <RefreshCw size={14} /> 다시 시도
                            </button>
                        </div>
                    )}

                    {!isLoading && current && (
                        <div className="prose prose-invert prose-sm max-w-none
                            prose-headings:text-sky-200 prose-headings:font-semibold
                            prose-h2:text-base prose-h2:border-b prose-h2:border-sky-700/30 prose-h2:pb-2 prose-h2:mb-3
                            prose-h3:text-sm prose-h3:text-sky-300
                            prose-p:text-gray-300 prose-p:leading-relaxed
                            prose-li:text-gray-300 prose-li:marker:text-sky-500
                            prose-strong:text-sky-200">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {current.report}
                            </ReactMarkdown>
                            <p className="text-[11px] text-gray-600 mt-4 text-right">출처 {current.sources_count}개</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
