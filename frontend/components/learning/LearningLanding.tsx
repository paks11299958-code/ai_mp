import React from 'react';

// 📚 AI 학습코칭 서비스 소개 랜딩 (/learning) — S1 (app/learning/PRD.md 5장).
// ★기존 '학습자료'(/learn, LearnIndex.tsx)와 이름은 비슷하지만 다른 기능이다.
// 이쪽은 사용자가 스스로 학습 목표를 입력해 커리큘럼을 받는 AI 학습코칭.
// 다크 톤(gray-950 기반)은 기존 사이트 기본 팔레트를 따름 — LearnIndex(밝은 톤)와는 별개 계열.

export const LearningLanding: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-950 text-white">
            <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-white/10">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="flex items-center gap-1.5 text-sm text-indigo-300 font-semibold"
                    >
                        ← AI 스퀘어
                    </button>
                    <span className="text-sm font-extrabold">📚 AI 학습코칭</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-10 pb-24">
                <section className="text-center mb-10">
                    <span className="inline-block bg-indigo-500/15 text-indigo-300 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                        지속형 학습 코치
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                        목표를 말씀하시면<br />커리큘럼으로 쪼개드려요
                    </h1>
                    <p className="mt-3 text-sm text-gray-400 leading-relaxed">
                        매일 조금씩 배우고, 틀린 문제는 다시 물어봐 드려요.<br className="hidden sm:block" />
                        범용 챗봇과 다르게 오늘 무엇을 할지 스스로 정해줍니다.
                    </p>
                </section>

                <div className="space-y-4 mb-10">
                    <FeatureRow emoji="🎯" title="목표를 커리큘럼으로" desc="기간·주당 일수·수준에 맞춰 AI가 주차별 학습 계획을 짜드려요." />
                    <FeatureRow emoji="📖" title="매일 조금씩" desc="하루 학습 본문과 퀴즈 3~5문항, 3~10분이면 충분해요." />
                    <FeatureRow emoji="🔁" title="틀린 건 다시" desc="오답은 간격을 두고 다시 물어봐 확실히 기억하게 도와드려요." />
                    <FeatureRow emoji="📊" title="주간 리포트" desc="일주일마다 진도와 취약한 부분을 요약해 알려드려요." />
                </div>

                <button
                    onClick={() => { window.location.href = '/learning/onboarding'; }}
                    className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                >
                    학습 서비스 신청 →
                </button>
                <p className="mt-3 text-center text-xs text-gray-500">
                    로그인 없이 목표부터 입력해볼 수 있어요.
                </p>
            </main>
        </div>
    );
};

const FeatureRow: React.FC<{ emoji: string; title: string; desc: string }> = ({ emoji, title, desc }) => (
    <div className="flex items-start gap-3 bg-gray-950 border border-white/10 rounded-2xl p-4">
        <span className="flex-shrink-0 text-2xl">{emoji}</span>
        <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold">{title}</h2>
            <p className="mt-1 text-xs text-gray-400 leading-relaxed">{desc}</p>
        </div>
    </div>
);
