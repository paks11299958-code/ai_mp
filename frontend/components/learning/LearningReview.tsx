import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 📌 오답 노트 (/learning/review) — S8 (app/learning/PRD.md 5장, 7장 간격 반복).
// GET /api/aimp/learning/review 로 오늘 복습해야 할 문항(최대 5개)을 받아 그 자리에서 재응시한다.
// 채점은 POST /review/:reviewItemId/submit 전용 엔드포인트 — 서버가 간격 반복 공식(SM-2 단순화)을
// 적용해 다음 복습일을 갱신한다.

type ReviewItem = {
    reviewItemId: string;
    questionId: string;
    stem: string;
    choices: string[];
    moduleTitle: string;
    intervalDays: number;
    dueDate: string;
};

export const LearningReview: React.FC = () => {
    const auth = useLearnAuth();
    const [items, setItems] = useState<ReviewItem[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revealed, setRevealed] = useState<Record<string, string>>({});

    useEffect(() => {
        if (auth === 'checking') return;
        if (auth === 'guest') { goLoginTo('/learning/review'); return; }

        fetch('/api/aimp/learning/review', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '오답 노트를 불러오지 못했습니다.');
                return r.json();
            })
            .then((d: { items: ReviewItem[] }) => setItems(d.items))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [auth]);

    const selectChoice = (item: ReviewItem, choice: string) => {
        if (revealed[item.questionId]) return;
        setRevealed(prev => ({ ...prev, [item.questionId]: choice }));
        fetch(`/api/aimp/learning/review/${item.reviewItemId}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: JSON.stringify({ selected: choice }),
        }).catch(() => {}); // 복습 채점 실패는 화면 흐름을 막지 않는다(재열람 시 다시 due로 남을 뿐).
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
                    <button onClick={() => { window.location.href = '/learning/dashboard'; }} className="flex items-center gap-1.5 h-full text-sm text-indigo-300 font-semibold">
                        ← 대시보드
                    </button>
                    <span className="text-sm font-extrabold">📌 오답 노트</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
                {error && (
                    <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>
                )}

                {items && items.length === 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-8 text-center">
                        <p className="text-sm text-gray-400">오늘 복습할 문항이 없습니다.</p>
                    </div>
                )}

                {items && items.length > 0 && (
                    <div className="space-y-6">
                        {items.map(item => (
                            <div key={item.reviewItemId} className="bg-white/5 border border-white/10 rounded-xl px-4 py-4">
                                <span className="text-xs text-gray-500">{item.moduleTitle}</span>
                                <h3 className="text-sm font-bold mt-1 mb-3">{item.stem}</h3>
                                <div className="space-y-2">
                                    {item.choices.map(choice => (
                                        <button
                                            key={choice}
                                            onClick={() => selectChoice(item, choice)}
                                            disabled={Boolean(revealed[item.questionId])}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                                                revealed[item.questionId] === choice
                                                    ? 'bg-indigo-500/20 border-indigo-400 text-white'
                                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 disabled:opacity-50'
                                            }`}
                                        >
                                            {choice}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
