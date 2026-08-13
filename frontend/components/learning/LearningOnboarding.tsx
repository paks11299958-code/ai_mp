import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from '../learn/LearnKit';

// 🎯 AI 학습코칭 온보딩 (/learning/onboarding) — S2 (app/learning/PRD.md 4.1, 2.2).
// ★로그인은 이 화면에서 요구하지 않는다. 목표+질문 4개를 비로그인으로 끝까지 입력할 수 있어야 하고,
// 로그인 이탈 후 재진입해도 값이 남아 있어야 한다 — 그래서 sessionStorage에 매 입력마다 즉시 저장한다.
// 로그인 복귀는 App.tsx의 afterAuthRedirect(범용 메커니즘, /learn 전용 아님)를 그대로 재사용한다.

const STORAGE_KEY = 'learningOnboardingDraft';

type Draft = {
    rawInput: string;
    durationWeeks: number | null;
    daysPerWeek: number | null;
    minutesPerSession: number | null;
    level: string | null;
};

const EMPTY_DRAFT: Draft = { rawInput: '', durationWeeks: null, daysPerWeek: null, minutesPerSession: null, level: null };

function loadDraft(): Draft {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_DRAFT;
        return { ...EMPTY_DRAFT, ...JSON.parse(raw) };
    } catch {
        return EMPTY_DRAFT;
    }
}

function saveDraft(d: Draft) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

const DURATION_OPTIONS = [4, 8, 12];
const DAYS_OPTIONS = [3, 5, 7];
const MINUTES_OPTIONS = [15, 30, 60];
const LEVEL_OPTIONS: { value: string; label: string }[] = [
    { value: 'beginner', label: '입문' },
    { value: 'basic', label: '기초 있음' },
    { value: 'intermediate', label: '중급' },
];

export const LearningOnboarding: React.FC = () => {
    const auth = useLearnAuth();
    const [draft, setDraft] = useState<Draft>(loadDraft);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 매 변경마다 즉시 저장 — 로그인으로 튕겨나가는 순간에도 값을 잃지 않게.
    useEffect(() => { saveDraft(draft); }, [draft]);

    const isComplete =
        draft.rawInput.trim().length > 0 &&
        draft.durationWeeks !== null &&
        draft.daysPerWeek !== null &&
        draft.minutesPerSession !== null &&
        draft.level !== null;

    const handleSubmit = () => {
        if (!isComplete) { setError('모든 항목을 입력해 주세요.'); return; }
        setError(null);
        if (auth !== 'ok') {
            // 로그인 후 이 화면(온보딩)이 아니라 커리큘럼 확인 화면으로 바로 이어지도록
            // /learning/onboarding/plan으로 복귀시킨다. draft는 이미 sessionStorage에 있으므로
            // 5단계(커리큘럼 생성)에서 그대로 읽어 API 호출한다.
            goLoginTo('/learning/onboarding/plan');
            return;
        }
        setSubmitting(true);
        window.location.href = '/learning/onboarding/plan';
    };

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-[#F5EFE6]/90 backdrop-blur border-b border-[#F0E9DE]">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => { window.location.href = '/learning'; }}
                        className="flex items-center gap-1.5 h-full text-sm text-indigo-700 font-semibold"
                    >
                        ← 학습코칭
                    </button>
                    <span className="text-sm font-extrabold">🎯 목표 입력</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
                <section>
                    <label className="block text-sm font-bold mb-2">어떤 목표를 이루고 싶으신가요?</label>
                    <textarea
                        value={draft.rawInput}
                        onChange={e => setDraft(d => ({ ...d, rawInput: e.target.value }))}
                        placeholder="예: 3개월 안에 정보처리기사 필기 합격"
                        rows={3}
                        className="w-full bg-white border border-[#F0E9DE] rounded-xl px-4 py-3 text-sm text-[#2D2438] placeholder-[#9089A1] focus:outline-none focus:border-indigo-400 resize-none"
                    />
                </section>

                <QuestionGroup label="목표 기간">
                    {DURATION_OPTIONS.map(w => (
                        <OptionChip key={w} active={draft.durationWeeks === w} onClick={() => setDraft(d => ({ ...d, durationWeeks: w }))}>
                            {w}주
                        </OptionChip>
                    ))}
                </QuestionGroup>

                <QuestionGroup label="주당 학습 일수">
                    {DAYS_OPTIONS.map(n => (
                        <OptionChip key={n} active={draft.daysPerWeek === n} onClick={() => setDraft(d => ({ ...d, daysPerWeek: n }))}>
                            주 {n}일
                        </OptionChip>
                    ))}
                </QuestionGroup>

                <QuestionGroup label="1회 학습 시간">
                    {MINUTES_OPTIONS.map(m => (
                        <OptionChip key={m} active={draft.minutesPerSession === m} onClick={() => setDraft(d => ({ ...d, minutesPerSession: m }))}>
                            {m}분
                        </OptionChip>
                    ))}
                </QuestionGroup>

                <QuestionGroup label="현재 수준">
                    {LEVEL_OPTIONS.map(o => (
                        <OptionChip key={o.value} active={draft.level === o.value} onClick={() => setDraft(d => ({ ...d, level: o.value }))}>
                            {o.label}
                        </OptionChip>
                    ))}
                </QuestionGroup>

                {error && <p className="text-sm text-red-700">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                >
                    {auth === 'ok' ? '커리큘럼 만들기 →' : '로그인하고 커리큘럼 받기 →'}
                </button>
            </main>
        </div>
    );
};

const QuestionGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <section>
        <label className="block text-sm font-bold mb-2">{label}</label>
        <div className="flex flex-wrap gap-2">{children}</div>
    </section>
);

const OptionChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
            active
                ? 'bg-indigo-500 border-indigo-500 text-white'
                : 'bg-white border-[#F0E9DE] text-[#5C5468] hover:border-[#D9CFC0]'
        }`}
    >
        {children}
    </button>
);

export { STORAGE_KEY as LEARNING_ONBOARDING_STORAGE_KEY, loadDraft as loadLearningOnboardingDraft };
export type { Draft as LearningOnboardingDraft };
