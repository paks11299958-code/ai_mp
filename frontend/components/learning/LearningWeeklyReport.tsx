import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 📈 주간 리포트 (/learning/report/:weekId) — S9 (app/learning/PRD.md 5장, 6.5, 4.3).
// 진도·정답률·취약 태그·조정 제안을 보여주고, 수락/거절을 선택할 수 있다.

type Metrics = {
    completedCount: number;
    totalCount: number;
    correctRate: number;
    tagStats: { tag: string; correct: number; total: number }[];
};
type Suggestion = { weakTags: string[]; suggestion: string };
type Report = {
    id: string;
    weekStart: string;
    metrics: Metrics;
    summaryMd: string;
    suggestion: Suggestion;
    accepted: boolean;
};

function getWeekIdFromPath(): string {
    const m = window.location.pathname.match(/^\/learning\/report\/([^/]+)/);
    return m ? m[1] : '';
}

export const LearningWeeklyReport: React.FC = () => {
    const auth = useLearnAuth();
    const weekId = getWeekIdFromPath();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [accepting, setAccepting] = useState(false);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo(window.location.pathname); return; }
        if (!weekId) { setError('리포트를 찾을 수 없습니다.'); setLoading(false); return; }

        fetch(`/api/aimp/learning/reports/${weekId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '리포트를 불러오지 못했습니다.');
                return r.json();
            })
            .then((d: Report) => setReport(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth, weekId]);

    const accept = () => {
        if (!report) return;
        setAccepting(true);
        setError(null);
        fetch(`/api/aimp/learning/reports/${weekId}/accept`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '수락 처리에 실패했습니다.');
                setReport(prev => prev ? { ...prev, accepted: true } : prev);
            })
            .catch(e => setError(e.message))
            .finally(() => setAccepting(false));
    };

    if (auth === 'checking' || loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-sm text-gray-400">불러오는 중…</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learning/dashboard'; }} className="flex items-center gap-1.5 text-sm text-indigo-300 font-semibold">
                        ← 대시보드
                    </button>
                    <span className="text-sm font-extrabold">📈 주간 리포트</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                {report && (
                    <>
                        <p className="text-xs text-gray-500 mb-4">
                            {new Date(report.weekStart).toLocaleDateString('ko-KR')} 주간
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                                <div className="text-xl font-extrabold text-indigo-300">
                                    {report.metrics.completedCount}/{report.metrics.totalCount}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">완료 모듈</div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                                <div className="text-xl font-extrabold text-emerald-300">
                                    {Math.round(report.metrics.correctRate * 100)}%
                                </div>
                                <div className="text-xs text-gray-400 mt-1">정답률</div>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-4 mb-4">
                            <h2 className="text-sm font-extrabold mb-2">요약</h2>
                            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report.summaryMd}</p>
                        </div>

                        {report.suggestion.weakTags.length > 0 && (
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 mb-4">
                                <h2 className="text-sm font-extrabold mb-2 text-amber-300">취약 영역</h2>
                                <div className="flex flex-wrap gap-2">
                                    {report.suggestion.weakTags.map(tag => (
                                        <span key={tag} className="text-xs bg-amber-500/20 text-amber-200 px-2.5 py-1 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {report.suggestion.suggestion && (
                            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-4 mb-8">
                                <h2 className="text-sm font-extrabold mb-2">다음 주 조정 제안</h2>
                                <p className="text-sm text-gray-300 leading-relaxed">{report.suggestion.suggestion}</p>
                            </div>
                        )}

                        {report.accepted ? (
                            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-center text-sm font-bold text-emerald-300">
                                ✅ 조정안을 수락했습니다
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { window.location.href = '/learning/dashboard'; }}
                                    className="flex-1 bg-white/10 hover:bg-white/15 text-white text-sm font-bold py-3 rounded-xl transition-colors"
                                >
                                    거절
                                </button>
                                <button
                                    onClick={accept}
                                    disabled={accepting}
                                    className="flex-1 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-extrabold py-3 rounded-xl transition-colors"
                                >
                                    {accepting ? '처리 중…' : '조정안 수락'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};
