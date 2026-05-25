import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Newspaper, Volume2, VolumeX, Loader, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    onClose: () => void;
}

interface NewsResult {
    report: string;
    sourcesCount: number;
    generatedAt: string;
}

function useTTS() {
    const [speaking, setSpeaking] = useState(false);
    const [ttsLoading, setTtsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
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
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
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

const PROGRESS_MESSAGES = [
    '🔍 오늘의 주요 뉴스를 탐색하고 있습니다...',
    '📡 최신 뉴스 소스를 수집하고 있습니다...',
    '✍️ 뉴스를 요약하고 정리하고 있습니다...',
    '🗞️ 중요도 순으로 배열하고 있습니다...',
    '⏳ 거의 다 됐어요! 잠시만 기다려 주세요...',
];

export const TodayNewsBoard: React.FC<Props> = ({ onClose }) => {
    const [news, setNews] = useState<NewsResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progressIdx, setProgressIdx] = useState(0);
    const { speaking, ttsLoading, speak, stop } = useTTS();

    const fetchNews = useCallback(async () => {
        setLoading(true);
        setError(null);
        setNews(null);
        setProgressIdx(0);
        try {
            const res = await fetch('/api/news/today', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ category: '오늘 주요 뉴스 종합' }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `서버 오류 (${res.status})`);
            }
            const data: NewsResult = await res.json();
            setNews(data);
        } catch (e: any) {
            setError(e.message || '뉴스를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
    }, [fetchNews]);

    useEffect(() => {
        if (!loading) return;
        const timer = setInterval(() => {
            setProgressIdx(prev => Math.min(prev + 1, PROGRESS_MESSAGES.length - 1));
        }, 18000);
        return () => clearInterval(timer);
    }, [loading]);

    const ttsText = news ? news.report.replace(/#{1,6}\s/g, '').replace(/\*\*/g, '').replace(/- /g, '') : '';

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return ''; }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-sky-700/40 bg-[#0d1117] shadow-2xl overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-sky-700/30 bg-sky-900/10">
                    <div className="flex items-center gap-2">
                        <Newspaper size={18} className="text-sky-400" />
                        <span className="text-base font-semibold text-sky-200">오늘의 뉴스</span>
                        {news && (
                            <span className="text-[11px] text-sky-500 ml-1">
                                출처 {news.sourcesCount}개 · {formatTime(news.generatedAt)}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {news && (
                            <>
                                <button
                                    onClick={() => speaking ? stop() : speak(ttsText)}
                                    disabled={ttsLoading}
                                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-sky-600/50 bg-sky-900/20 text-sky-300 hover:bg-sky-800/40 transition-colors disabled:opacity-50"
                                    title={speaking ? '음성 중지' : '음성으로 듣기'}
                                >
                                    {ttsLoading ? (
                                        <Loader size={12} className="animate-spin" />
                                    ) : speaking ? (
                                        <VolumeX size={12} />
                                    ) : (
                                        <Volume2 size={12} />
                                    )}
                                    {ttsLoading ? '준비중...' : speaking ? '중지' : '음성'}
                                </button>
                                <button
                                    onClick={fetchNews}
                                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border border-gray-600/50 bg-gray-800/20 text-gray-400 hover:bg-gray-700/40 transition-colors"
                                    title="새로고침"
                                >
                                    <RefreshCw size={11} />
                                </button>
                            </>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 컨텐츠 */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-5 py-16">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
                                <Newspaper size={22} className="absolute inset-0 m-auto text-sky-400 animate-pulse" />
                            </div>
                            <div className="text-center space-y-1">
                                <p className="text-sm text-sky-300 font-medium">{PROGRESS_MESSAGES[progressIdx]}</p>
                                <p className="text-[11px] text-gray-500">서치 에이전트가 뉴스를 탐색하여 취합하고 있습니다</p>
                            </div>
                            <div className="flex gap-1.5">
                                {PROGRESS_MESSAGES.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-1 rounded-full transition-all duration-500 ${i <= progressIdx ? 'w-6 bg-sky-400' : 'w-2 bg-gray-700'}`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center gap-4 py-12 text-center">
                            <div className="text-4xl">⚠️</div>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button
                                onClick={fetchNews}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-900/30 border border-sky-700/40 text-sky-300 hover:bg-sky-800/40 transition-colors text-sm"
                            >
                                <RefreshCw size={14} />
                                다시 시도
                            </button>
                        </div>
                    )}

                    {news && (
                        <div className="prose prose-invert prose-sm max-w-none
                            prose-headings:text-sky-200 prose-headings:font-semibold
                            prose-h2:text-base prose-h2:border-b prose-h2:border-sky-700/30 prose-h2:pb-2 prose-h2:mb-3
                            prose-h3:text-sm prose-h3:text-sky-300
                            prose-p:text-gray-300 prose-p:leading-relaxed
                            prose-li:text-gray-300 prose-li:marker:text-sky-500
                            prose-strong:text-sky-200
                            prose-hr:border-gray-700">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {news.report}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
