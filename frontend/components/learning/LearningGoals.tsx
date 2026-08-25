import React, { useEffect, useState } from 'react';
import { LearningTabs } from './LearningTabs';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 🎒 내 커리큘럼 목록 (/learning/goals) — 2026-08-25 신설.
// ★배경: 조회가 '가장 최근 active 1개'만 보던 탓에 새 커리큘럼을 만들면
//   이전 것이 화면에서 사라지고 되돌아갈 방법이 없었다(500P 들인 게 묻힘).
//   여기서 전환·중단(보관)·삭제를 한다.

type Goal = {
    id: string; title: string; status: 'active' | 'archived';
    durationWeeks: number; createdAt: string;
    moduleCount: number; doneCount: number; progressPercent: number;
    isCurrent: boolean;
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export const LearningGoals: React.FC = () => {
    const auth = useLearnAuth();
    const [goals, setGoals] = useState<Goal[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<string | null>(null);

    const load = () => {
        fetch('/api/aimp/learning/goals', { headers: authHeaders() })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('목록을 불러오지 못했습니다.'))))
            .then(d => setGoals(d.goals ?? []))
            .catch(e => setError(e.message));
    };

    useEffect(() => {
        // ★useLearnAuth 는 'checking' | 'ok' | 'guest' 를 준다('user' 가 아니다 —
        //   2026-08-25 여기서 'user' 를 기다려 목록이 영영 "불러오는 중…"에 멈췄다).
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo('/learning/goals'); return; }
        load();
    }, [auth]);

    // 전환·보관·재개·삭제 공통 호출. 성공하면 목록을 다시 읽는다.
    const act = async (id: string, path: string, method: 'POST' | 'DELETE' = 'POST') => {
        setBusy(id); setError('');
        try {
            const r = await fetch(`/api/aimp/learning/goals/${id}${path}`, { method, headers: authHeaders() });
            if (!r.ok) {
                const d = await r.json().catch(() => ({}));
                throw new Error(d.error || '처리하지 못했습니다.');
            }
            load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setBusy(null);
        }
    };

    const onArchive = (g: Goal) => {
        if (!confirm(`"${g.title}" 학습을 중단할까요?\n\n보관함으로 옮겨지며, 진도는 그대로 남습니다.\n언제든 다시 시작할 수 있어요.`)) return;
        act(g.id, '/archive');
    };

    // ★삭제는 되돌릴 수 없다 — 제목을 다시 보여주고 한 번 더 확인받는다.
    const onDelete = (g: Goal) => {
        if (!confirm(`"${g.title}"을(를) 완전히 삭제할까요?\n\n학습 기록·퀴즈·오답노트가 모두 사라지며 되돌릴 수 없습니다.\n다시 만들려면 포인트가 새로 듭니다.`)) return;
        if (!confirm('정말 삭제하시겠어요? 이 작업은 취소할 수 없습니다.')) return;
        act(g.id, '', 'DELETE');
    };

    const active = (goals ?? []).filter(g => g.status === 'active');
    const archived = (goals ?? []).filter(g => g.status === 'archived');

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-[#F5EFE6]/90 backdrop-blur">
                <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-700 font-semibold">
                        ← 메인
                    </button>
                    <span className="text-sm font-extrabold">🎓 AI 학습코칭</span>
                    <span className="w-16" />
                </div>
                <LearningTabs active="goals" />
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                        {error}
                    </div>
                )}

                {auth === 'checking' || goals === null ? (
                    <p className="text-center text-sm text-[#9089A1] py-10">불러오는 중…</p>
                ) : goals.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-sm text-[#5C5468] mb-4">아직 만든 커리큘럼이 없어요.</p>
                        <button
                            onClick={() => { window.location.href = '/learning/onboarding'; }}
                            className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-extrabold px-5 py-3 rounded-xl transition-colors"
                        >
                            ➕ 학습 신청하기
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-3">
                            <h1 className="text-base font-extrabold">진행 중 ({active.length})</h1>
                            <button
                                onClick={() => { window.location.href = '/learning/onboarding'; }}
                                className="text-sm text-indigo-700 font-bold"
                            >
                                ➕ 새 학습
                            </button>
                        </div>

                        <div className="space-y-3">
                            {active.map(g => (
                                <GoalCard
                                    key={g.id} goal={g} busy={busy === g.id}
                                    onOpen={() => { window.location.href = '/learning/dashboard'; }}
                                    onSelect={() => act(g.id, '/select')}
                                    onArchive={() => onArchive(g)}
                                    onDelete={() => onDelete(g)}
                                />
                            ))}
                            {active.length === 0 && (
                                <p className="text-sm text-[#9089A1] py-4">진행 중인 학습이 없어요. 보관함에서 다시 시작할 수 있어요.</p>
                            )}
                        </div>

                        {archived.length > 0 && (
                            <>
                                <h2 className="text-base font-extrabold mt-8 mb-3">📦 보관함 ({archived.length})</h2>
                                <div className="space-y-3">
                                    {archived.map(g => (
                                        <GoalCard
                                            key={g.id} goal={g} busy={busy === g.id}
                                            onResume={() => act(g.id, '/resume')}
                                            onDelete={() => onDelete(g)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

const GoalCard: React.FC<{
    goal: Goal; busy: boolean;
    onOpen?: () => void; onSelect?: () => void;
    onArchive?: () => void; onResume?: () => void; onDelete: () => void;
}> = ({ goal: g, busy, onOpen, onSelect, onArchive, onResume, onDelete }) => (
    <div className={
        'bg-white border rounded-2xl p-4 transition-colors ' +
        (g.isCurrent ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-[#E4DCF0]')
    }>
        <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
                {g.isCurrent && (
                    <span className="inline-block bg-indigo-500/15 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full mb-1.5">
                        지금 학습 중
                    </span>
                )}
                <p className="text-base font-extrabold leading-snug break-words">{g.title}</p>
                <p className="mt-1 text-xs text-[#9089A1]">
                    {g.durationWeeks}주 · 전체 {g.moduleCount}개 · {g.doneCount}개 완료
                </p>
            </div>
        </div>

        <div className="mt-3 h-2 bg-[#EFE9F5] rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${g.progressPercent}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-[#5C5468]">{g.progressPercent}% 완료</p>

        <div className="mt-3 flex flex-wrap gap-2">
            {g.status === 'active' && (g.isCurrent ? (
                <button onClick={onOpen} disabled={busy}
                    className="flex-1 min-w-[120px] bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                    📖 이어서 학습
                </button>
            ) : (
                <button onClick={onSelect} disabled={busy}
                    className="flex-1 min-w-[120px] bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                    {busy ? '전환 중…' : '이 커리큘럼으로 전환'}
                </button>
            ))}
            {g.status === 'archived' && (
                <button onClick={onResume} disabled={busy}
                    className="flex-1 min-w-[120px] bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors">
                    {busy ? '처리 중…' : '↩ 다시 시작'}
                </button>
            )}
            {g.status === 'active' && (
                <button onClick={onArchive} disabled={busy}
                    className="px-3 bg-white border border-[#E4DCF0] hover:bg-[#FBF8F3] disabled:opacity-50 text-[#5C5468] text-sm font-bold py-2.5 rounded-xl transition-colors">
                    중단
                </button>
            )}
            <button onClick={onDelete} disabled={busy}
                className="px-3 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 text-red-600 text-sm font-bold py-2.5 rounded-xl transition-colors">
                삭제
            </button>
        </div>
    </div>
);
