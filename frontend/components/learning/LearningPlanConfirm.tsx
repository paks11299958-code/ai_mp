import React, { useEffect, useState } from 'react';
import { useLearnAuth } from '../learn/LearnKit';
import { loadLearningOnboardingDraft, LEARNING_ONBOARDING_STORAGE_KEY } from './LearningOnboarding';
import { LearningGenerationProgress } from './LearningGenerationProgress';

// 🗂 커리큘럼 확인 (/learning/onboarding/plan) — S3 (app/learning/PRD.md 5장).
// ★2단계 분할(2026-08-11 사용자 확정) — 84모듈 일괄 생성(63초)이 온보딩 이탈을 유발하던
// 문제를 해소하기 위해, 이 화면은 이제 "주차 개요"만 보여준다(모듈 상세 아님). 사용자가
// 판단하는 단위(이 흐름이 내 목표에 맞나)와 화면 정보량이 일치하도록 함.
// 로그인 복귀 지점. 로그인 상태가 되면 sessionStorage draft를 읽어 자동으로 POST /goals를 호출한다.

type WeekOutline = { id: string; weekNo: number; title: string; theme: string };
type Goal = { id: string; title: string; status: string; weekOutlines: WeekOutline[] };

export const LearningPlanConfirm: React.FC = () => {
    const auth = useLearnAuth();
    const [goal, setGoal] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revising, setRevising] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

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
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '커리큘럼 개요 생성에 실패했습니다.');
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
                // 202 = 확정 성공, 모듈 상세는 백그라운드 생성 시작됨
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '확정에 실패했습니다.');
                setConfirmed(true);
            })
            .catch(e => setError(e.message))
            .finally(() => setConfirming(false));
    };

    if (loading || auth === 'checking') {
        return (
            <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438] flex items-center justify-center">
                <p className="text-sm text-[#5C5468]">커리큘럼 개요를 만들고 있어요… (약 10초)</p>
            </div>
        );
    }

    // 확정 완료 — 이제부터는 모듈 상세 백그라운드 생성 진행 상황을 보여준다.
    if (confirmed && goal) {
        return <LearningGenerationProgress goalId={goal.id} />;
    }

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-[#F5EFE6]/90 backdrop-blur border-b border-[#F0E9DE]">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learning'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-700 font-semibold">
                        ← 학습코칭
                    </button>
                    <span className="text-sm font-extrabold">🗂 커리큘럼 확인</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {goal && (
                    <>
                        <h1 className="text-xl font-extrabold mb-6">{goal.title}</h1>
                        <div className="space-y-3 mb-8">
                            {goal.weekOutlines.map(w => (
                                <div key={w.id} className="bg-white border border-[#F0E9DE] rounded-xl px-4 py-3">
                                    <span className="text-xs font-bold text-indigo-700">{w.weekNo}주차</span>
                                    <h3 className="text-sm font-extrabold mt-1">{w.title}</h3>
                                    <p className="text-xs text-[#5C5468] mt-1">{w.theme}</p>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="수정하고 싶은 점이 있다면 알려주세요 (1회만 가능)"
                                rows={2}
                                className="w-full bg-white border border-[#F0E9DE] rounded-xl px-4 py-3 text-sm text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:border-indigo-400 resize-none"
                            />
                            <button
                                onClick={submitRevision}
                                disabled={revising || !feedback.trim()}
                                className="w-full bg-[#F0E9DE] hover:bg-[#EFE6D9] disabled:opacity-40 text-[#2D2438] text-sm font-bold py-2.5 rounded-xl transition-colors"
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
