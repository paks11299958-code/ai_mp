import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 📖 오늘의 학습 (/learning/task/:id) — S5(본문)+S6(퀴즈)+S7(결과) 통합 (app/learning/PRD.md 5장).
// 세 화면을 별도 라우트로 나누는 대신, 하나의 학습 세션 안에서 단계(phase)로 전환한다 —
// URL이 바뀌면 새로고침 시 퀴즈 진행 상태가 sessionStorage 없이는 유지되지 않으므로,
// 이 흐름 전체를 한 컴포넌트 상태로 관리하는 편이 더 단순하고 안전하다.

type Question = { id: string; stem: string; choices: string[]; difficulty: number; tag: string };
type ModuleData = { id: string; title: string; objective: string; contentMd: string; questions: Question[] };
type SubmitResult = { score: number; correctCount: number; totalCount: number; results: { questionId: string; isCorrect: boolean; answer: string; explanation: string }[] };

type Phase = 'reading' | 'quiz' | 'result';

function getTaskIdFromPath(): string {
    const m = window.location.pathname.match(/^\/learning\/task\/([^/]+)/);
    return m ? m[1] : '';
}

export const LearningTask: React.FC = () => {
    const auth = useLearnAuth();
    const taskId = getTaskIdFromPath();
    // 대시보드가 ?m=<LcModule.id> 로 모듈 ID를 함께 넘긴다 — GET /modules/:id 는 모듈 단위 조회이고
    // taskId(LcDailyTask.id)와는 별개 식별자라, 퀴즈 제출(taskId 기준)과 본문 조회(moduleId 기준)에
    // 각각 맞는 ID를 써야 한다.
    const moduleId = new URLSearchParams(window.location.search).get('m') || '';
    const [moduleData, setModuleData] = useState<ModuleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [phase, setPhase] = useState<Phase>('reading');
    const [quizIndex, setQuizIndex] = useState(0);
    const [selections, setSelections] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo(window.location.pathname); return; }
        if (!taskId || !moduleId) { setError('학습 항목을 찾을 수 없습니다.'); setLoading(false); return; }

        fetch(`/api/aimp/learning/modules/${moduleId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '학습 내용을 불러오지 못했습니다.');
                return r.json();
            })
            .then((d: ModuleData) => setModuleData(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth, taskId, moduleId]);

    const selectChoice = (questionId: string, choice: string) => {
        setSelections(prev => ({ ...prev, [questionId]: choice }));
    };

    const submitQuiz = () => {
        if (!moduleData) return;
        setSubmitting(true);
        setError(null);
        const answers = moduleData.questions.map(q => ({ questionId: q.id, selected: selections[q.id] ?? '', isReview: false }));

        fetch(`/api/aimp/learning/quiz/${taskId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ answers }),
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '채점에 실패했습니다.');
                return r.json();
            })
            .then((res: SubmitResult) => { setResult(res); setPhase('result'); })
            .catch(e => setError(e.message))
            .finally(() => setSubmitting(false));
    };

    if (auth === 'checking' || loading) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <p className="text-sm text-gray-400">불러오는 중…</p>
            </div>
        );
    }

    if (error && !moduleData) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
            </div>
        );
    }
    if (!moduleData) return null;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learning/dashboard'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-300 font-semibold">
                        ← 대시보드
                    </button>
                    <span className="text-sm font-extrabold">
                        {phase === 'reading' ? '📖 학습' : phase === 'quiz' ? `🧩 퀴즈 ${quizIndex + 1}/${moduleData.questions.length}` : '✅ 결과'}
                    </span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                {phase === 'reading' && (
                    <>
                        <h1 className="text-xl font-extrabold mb-1">{moduleData.title}</h1>
                        <p className="text-xs text-gray-400 mb-6">{moduleData.objective}</p>
                        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-gray-200 leading-relaxed mb-8">
                            {moduleData.contentMd}
                        </div>
                        <button
                            onClick={() => setPhase('quiz')}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                        >
                            퀴즈 시작 →
                        </button>
                    </>
                )}

                {phase === 'quiz' && (() => {
                    const q = moduleData.questions[quizIndex];
                    const isLast = quizIndex === moduleData.questions.length - 1;
                    return (
                        <>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-6">
                                <div
                                    className="h-full bg-indigo-500 transition-all"
                                    style={{ width: `${((quizIndex + 1) / moduleData.questions.length) * 100}%` }}
                                />
                            </div>
                            <h2 className="text-base font-bold mb-5">{q.stem}</h2>
                            <div className="space-y-2 mb-8">
                                {q.choices.map(choice => (
                                    <button
                                        key={choice}
                                        onClick={() => selectChoice(q.id, choice)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                                            selections[q.id] === choice
                                                ? 'bg-indigo-500/20 border-indigo-400 text-white'
                                                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                        }`}
                                    >
                                        {choice}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => {
                                    if (isLast) submitQuiz();
                                    else setQuizIndex(i => i + 1);
                                }}
                                disabled={!selections[q.id] || submitting}
                                className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                            >
                                {submitting ? '채점 중…' : isLast ? '제출하기' : '다음 문항 →'}
                            </button>
                        </>
                    );
                })()}

                {phase === 'result' && result && (
                    <>
                        <div className="text-center mb-8">
                            <div className="text-4xl font-extrabold text-indigo-300 mb-1">{result.score}점</div>
                            <p className="text-sm text-gray-400">{result.correctCount} / {result.totalCount} 정답</p>
                        </div>
                        <div className="space-y-3 mb-8">
                            {result.results.map((r, i) => (
                                <div key={r.questionId} className={`rounded-xl border px-4 py-3 ${r.isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                    <p className="text-xs font-bold mb-1">{r.isCorrect ? '✅ 정답' : '❌ 오답'} · {moduleData.questions[i]?.stem}</p>
                                    <p className="text-xs text-gray-400">정답: {r.answer}</p>
                                    <p className="text-xs text-gray-500 mt-1">{r.explanation}</p>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { window.location.href = '/learning/dashboard'; }}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                        >
                            대시보드로 →
                        </button>
                    </>
                )}
            </main>
        </div>
    );
};
