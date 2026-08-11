import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 📊 대시보드 (/learning/dashboard) — S4 (app/learning/PRD.md 5장/4.2).
// 오늘의 학습, 연속일, 진도 바, 복습 배지를 보여준다. GET /api/aimp/learning/today 조회.

type TodayResponse = {
    streak: number;
    todayTask: {
        id: string;
        completedAt: string | null;
        score: number | null;
        module: { id: string; title: string; weekNo: number; orderNo: number; status: string };
    } | null;
    reviewDueCount: number;
    goal: { id: string; title: string; progressPercent: number } | null;
};

export const LearningDashboard: React.FC = () => {
    const auth = useLearnAuth();
    const [data, setData] = useState<TodayResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo('/learning/dashboard'); return; }

        fetch('/api/aimp/learning/today', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '대시보드 조회에 실패했습니다.');
                return r.json();
            })
            .then((d: TodayResponse) => setData(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth]);

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
                    <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-300 font-semibold">
                        ← 메인
                    </button>
                    <span className="text-sm font-extrabold">📊 학습 대시보드</span>
                    <button onClick={() => { window.location.href = '/learning/settings'; }} className="w-16 h-full text-right text-sm text-indigo-300 font-semibold">
                        ⚙️ 설정
                    </button>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {data && (
                    <>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                                <div className="text-2xl font-extrabold text-indigo-300">🔥 {data.streak}</div>
                                <div className="text-xs text-gray-400 mt-1">연속 학습일</div>
                            </div>
                            {data.goal && (
                                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                                    <div className="text-2xl font-extrabold text-emerald-300">{data.goal.progressPercent}%</div>
                                    <div className="text-xs text-gray-400 mt-1">전체 진도</div>
                                </div>
                            )}
                        </div>

                        {data.goal && (
                            <div className="mb-6">
                                <p className="text-sm font-bold text-gray-300 mb-1">{data.goal.title}</p>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${data.goal.progressPercent}%` }} />
                                </div>
                            </div>
                        )}

                        {data.reviewDueCount > 0 && (
                            <button
                                onClick={() => { window.location.href = '/learning/review'; }}
                                className="w-full mb-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between text-left hover:bg-amber-500/15 transition-colors"
                            >
                                <span className="text-sm font-bold text-amber-300">📌 오늘의 복습 {data.reviewDueCount}개</span>
                                <span className="text-xs text-amber-400">바로가기 →</span>
                            </button>
                        )}

                        {data.todayTask ? (
                            <button
                                onClick={() => { window.location.href = `/learning/task/${data.todayTask!.id}?m=${data.todayTask!.module.id}`; }}
                                className="w-full bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-5 py-5 text-left hover:bg-indigo-500/15 transition-colors"
                            >
                                <span className="text-xs font-bold text-indigo-300">
                                    {data.todayTask.completedAt ? '✅ 오늘 완료' : '오늘의 학습'}
                                </span>
                                <h2 className="text-lg font-extrabold mt-1">{data.todayTask.module.title}</h2>
                                <p className="text-xs text-gray-400 mt-1">
                                    {data.todayTask.module.weekNo}주차 {data.todayTask.module.orderNo}일차
                                    {data.todayTask.completedAt && data.todayTask.score !== null ? ` · 점수 ${data.todayTask.score}점` : ''}
                                </p>
                            </button>
                        ) : (
                            <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-8 text-center">
                                <p className="text-sm text-gray-400">오늘 배정된 학습이 없습니다.</p>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};
