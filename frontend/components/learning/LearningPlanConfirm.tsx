import React, { useEffect, useState } from 'react';
import { useLearnAuth } from '../learn/LearnKit';
import { loadLearningOnboardingDraft, LEARNING_ONBOARDING_STORAGE_KEY } from './LearningOnboarding';

// 🗂 커리큘럼 확인 (/learning/onboarding/plan) — S3 (app/learning/PRD.md 5장, 5단계).
// 로그인 복귀 지점. 로그인 상태가 되면 sessionStorage draft를 읽어 자동으로 POST /goals를 호출한다.
// 이미 goal이 생성된 뒤 재진입(새로고침 등)이면 draft 대신 fetch로 받은 goal을 그대로 보여준다.

type Module = { id: string; weekNo: number; orderNo: number; title: string; objective: string };
type Goal = { id: string; title: string; status: string; modules: Module[] };

export const LearningPlanConfirm: React.FC = () => {
    const auth = useLearnAuth();
    const [goal, setGoal] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revising, setRevising] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState<{ taskCount: number } | null>(null);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { setLoading(false); return; } // useLearnAuth가 필요 시 /?login=1로 안내
        const draft = loadLearningOnboardingDraft();
        if (!draft.rawInput.trim()) { setError('입력한 목표를 찾을 수 없습니다. 처음부터 다시 시도해 주세요.'); setLoading(false); return; }

        fetch('/api/aimp/learning/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({
                rawInput: draft.rawInput,
                durationWeeks: draft.durationWeeks,
                daysPerWeek: draft.daysPerWeek,
                minutesPerSession: draft.minutesPerSession,
                level: draft.level,
            }),
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '커리큘럼 생성에 실패했습니다.');
                return r.json();
            })
            .then((g: Goal) => {
                setGoal(g);
                sessionStorage.removeItem(LEARNING_ONBOARDING_STORAGE_KEY);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth]);

    const submitRevision = () => {
        if (!goal || !feedback.trim()) return;
        setRevising(true);
        setError(null);
        fetch(`/api/aimp/learning/goals/${goal.id}/plan`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ feedback: feedback.trim() }),
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '수정 요청에 실패했습니다.');
                return r.json();
            })
            .then((g: Goal) => { setGoal(g); setFeedback(''); })
            .catch(e => setError(e.message))
            .finally(() => setRevising(false));
    };

    const confirmGoal = () => {
        if (!goal) return;
        setConfirming(true);
        setError(null);
        fetch(`/api/aimp/learning/goals/${goal.id}/confirm`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '확정에 실패했습니다.');
                return r.json();
            })
            .then(d => setConfirmed(d))
            .catch(e => setError(e.message))
            .finally(() => setConfirming(false));
    };

    if (loading || auth === 'checking') {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-sm text-gray-400">커리큘럼을 만들고 있어요… (최대 30초)</p>
            </div>
        );
    }

    if (confirmed) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
                <p className="text-lg font-extrabold mb-2">✅ 커리큘럼이 확정됐어요</p>
                <p className="text-sm text-gray-400 mb-6">총 {confirmed.taskCount}일의 학습이 배정됐습니다.</p>
                <button
                    onClick={() => { window.location.href = '/learning/dashboard'; }}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-extrabold px-6 py-3 rounded-xl"
                >
                    대시보드로 이동 →
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learning'; }} className="flex items-center gap-1.5 text-sm text-indigo-300 font-semibold">
                        ← 학습코칭
                    </button>
                    <span className="text-sm font-extrabold">🗂 커리큘럼 확인</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}

                {goal && (
                    <>
                        <h1 className="text-xl font-extrabold mb-6">{goal.title}</h1>
                        <div className="space-y-3 mb-8">
                            {goal.modules.map(m => (
                                <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                                    <span className="text-xs font-bold text-indigo-300">
                                        {m.weekNo}주차 {m.orderNo}일차
                                    </span>
                                    <h3 className="text-sm font-extrabold mt-1">{m.title}</h3>
                                    <p className="text-xs text-gray-400 mt-1">{m.objective}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="수정하고 싶은 점이 있다면 알려주세요 (1회만 가능)"
                                rows={2}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 resize-none"
                            />
                            <button
                                onClick={submitRevision}
                                disabled={revising || !feedback.trim()}
                                className="w-full bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
                            >
                                {revising ? '수정 중…' : '수정 요청'}
                            </button>
                            <button
                                onClick={confirmGoal}
                                disabled={confirming}
                                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                            >
                                {confirming ? '확정 중…' : '이 커리큘럼으로 확정 →'}
                            </button>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
