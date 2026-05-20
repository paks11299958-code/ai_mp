import React, { useState, useEffect } from 'react';
import { X, Heart, Instagram, Loader, CheckCircle, AlertCircle, Hash } from 'lucide-react';

interface Props {
    onClose: () => void;
}

interface Status {
    date: string;
    used: number;
    max: number;
    remaining: number;
}

export const InstagramLikerDialog: React.FC<Props> = ({ onClose }) => {
    const [keyword,  setKeyword]  = useState('');
    const [loading,  setLoading]  = useState(false);
    const [status,   setStatus]   = useState<Status | null>(null);
    const [result,   setResult]   = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

    useEffect(() => {
        fetch('/api/instagram/status', { credentials: 'include' })
            .then(r => r.json()).then(d => setStatus(d)).catch(() => {});
    }, []);

    const handleRun = async () => {
        if (!keyword.trim()) return;
        setLoading(true); setResult(null);
        try {
            const res = await fetch('/api/instagram/like', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: keyword.replace(/^#/, ''),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '실행 실패');
            setResult({ ok: true, message: data.message });
            // 상태 갱신
            setTimeout(() => {
                fetch('/api/instagram/status', { credentials: 'include' })
                    .then(r => r.json()).then(d => setStatus(d)).catch(() => {});
            }, 2000);
        } catch (e: any) {
            setResult({ ok: false, error: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                            <Heart size={14} className="text-white" />
                        </div>
                        <span className="text-white font-semibold text-sm">인스타 자동 좋아요</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 오늘 현황 */}
                    {status && (
                        <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-gray-400 text-xs">오늘 좋아요 현황</p>
                                <p className="text-white text-sm font-semibold mt-0.5">
                                    {status.used} / {status.max}회 사용
                                </p>
                            </div>
                            <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                status.remaining > 0
                                    ? 'bg-green-900/60 text-green-400'
                                    : 'bg-red-900/60 text-red-400'
                            }`}>
                                {status.remaining > 0 ? `${status.remaining}회 남음` : '한도 초과'}
                            </div>
                        </div>
                    )}

                    {/* 키워드 */}
                    <div>
                        <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                            <Hash size={11} /> 해시태그 키워드
                        </label>
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            placeholder="예: 골프 (# 없이 입력)"
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-pink-500"
                        />
                    </div>

                    {/* 안내 */}
                    <div className="bg-yellow-950/40 border border-yellow-800/40 rounded-xl px-3 py-2.5">
                        <p className="text-yellow-400 text-[11px] leading-relaxed">
                            ⚠ 일일 최대 10회 제한 적용 · 랜덤 딜레이로 탐지 최소화<br/>
                            탐지 시 계정 일시정지 가능성 있음
                        </p>
                    </div>

                    {/* 결과 */}
                    {result && (
                        <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${
                            result.ok
                                ? 'bg-green-950/40 border border-green-800/40'
                                : 'bg-red-950/40 border border-red-800/40'
                        }`}>
                            {result.ok
                                ? <CheckCircle size={15} className="text-green-400 shrink-0 mt-0.5" />
                                : <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                            }
                            <p className={`text-xs leading-relaxed ${result.ok ? 'text-green-300' : 'text-red-300'}`}>
                                {result.ok ? result.message : result.error}
                            </p>
                        </div>
                    )}

                    {/* 실행 버튼 */}
                    <button
                        onClick={handleRun}
                        disabled={loading || !keyword.trim() || status?.remaining === 0}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-90 disabled:opacity-40 text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <><Loader size={14} className="animate-spin" /> 실행 중... (1~3분)</>
                            : <><Heart size={14} /> 좋아요 실행</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};
