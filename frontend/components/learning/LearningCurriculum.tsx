import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 🗂 전체 커리큘럼 (/learning/curriculum) — S10 (app/learning/PRD.md 5장).
// ★PRD 5장에 처음부터 명시된 화면이었으나 지금까지 구현되지 않았던 누락분(신규 기능
// 아님, 2026-08-12 마감 작업으로 반영). 주차별 모듈 목록 + 완료/미완료 + 전체 진행률.

type ModuleItem = { id: string; orderNo: number; title: string; completed: boolean };
type WeekGroup = { weekNo: number; modules: ModuleItem[] };
type CurriculumData = {
    goal: { id: string; title: string; progressPercent: number } | null;
    weeks: WeekGroup[];
};

export const LearningCurriculum: React.FC = () => {
    const auth = useLearnAuth();
    const [data, setData] = useState<CurriculumData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo('/learning/curriculum'); return; }

        fetch('/api/aimp/learning/curriculum', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '커리큘럼을 불러오지 못했습니다.');
                return r.json();
            })
            .then((d: CurriculumData) => setData(d))
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
                    <button onClick={() => { window.location.href = '/learning/dashboard'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-300 font-semibold">
                        ← 대시보드
                    </button>
                    <span className="text-sm font-extrabold">🗂 전체 커리큘럼</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                {data && !data.goal && (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-8 text-center">
                        <p className="text-sm text-gray-400">진행 중인 커리큘럼이 없습니다.</p>
                    </div>
                )}

                {data && data.goal && (
                    <>
                        <h1 className="text-lg font-extrabold mb-2">{data.goal.title}</h1>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${data.goal.progressPercent}%` }} />
                            </div>
                            <span className="text-sm font-bold text-emerald-300 shrink-0">{data.goal.progressPercent}%</span>
                        </div>

                        <div className="space-y-4">
                            {data.weeks.map(week => {
                                const doneInWeek = week.modules.filter(m => m.completed).length;
                                return (
                                    <section key={week.weekNo} className="bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h2 className="text-sm font-extrabold">{week.weekNo}주차</h2>
                                            <span className="text-xs text-gray-400">{doneInWeek}/{week.modules.length} 완료</span>
                                        </div>
                                        <ul className="space-y-1.5">
                                            {week.modules.map(m => (
                                                <li
                                                    key={m.id}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                                        m.completed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-gray-300'
                                                    }`}
                                                >
                                                    <span className="shrink-0">{m.completed ? '✅' : '⬜'}</span>
                                                    <span className="text-xs text-gray-500 shrink-0">{m.orderNo}일차</span>
                                                    <span className="truncate">{m.title}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                );
                            })}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
