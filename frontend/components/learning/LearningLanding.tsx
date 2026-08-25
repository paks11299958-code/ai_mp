import React from 'react';

// 📚 AI 학습코칭 서비스 소개 랜딩 (/learning) — S1 (app/learning/PRD.md 5장).
// ★기존 '학습자료'(/learn, LearnIndex.tsx)와 이름은 비슷하지만 다른 기능이다.
// 이쪽은 사용자가 스스로 학습 목표를 입력해 커리큘럼을 받는 AI 학습코칭.
// 다크 톤(gray-950 기반)은 기존 사이트 기본 팔레트를 따름 — LearnIndex(밝은 톤)와는 별개 계열.

export const LearningLanding: React.FC = () => {
    // 진행 중인 학습이 있으면 '신청' 대신 '이어서 학습하기'를 먼저 보여준다(2026-08-25).
    // ★그전까지 /learning 은 무조건 소개 화면이라, 이미 커리큘럼이 있는 사람도
    //   대시보드로 가는 길이 없어 "내 학습 목록을 어디서 보냐"가 됐다.
    const [goal, setGoal] = React.useState<{ title: string; progressPercent: number } | null>(null);
    const [checked, setChecked] = React.useState(false);

    React.useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setChecked(true); return; }   // 비로그인은 조회 자체를 건너뛴다
        fetch('/api/aimp/learning/today', { headers: { Authorization: `Bearer ${token}` } })
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (d?.goal) setGoal(d.goal); })
            .catch(() => { /* 소개 화면은 그대로 보여준다 — 조회 실패가 진입을 막으면 안 된다 */ })
            .finally(() => setChecked(true));
    }, []);

    return (
        <div className="min-h-screen bg-[#F5EFE6] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-[#F5EFE6]/90 backdrop-blur border-b border-[#F0E9DE]">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => { window.location.href = '/'; }}
                        className="flex items-center gap-1.5 h-full text-sm text-indigo-700 font-semibold"
                    >
                        ← AI 스퀘어
                    </button>
                    <span className="text-sm font-extrabold">📚 AI 학습코칭</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-10 pb-24">
                <section className="text-center mb-10">
                    <span className="inline-block bg-indigo-500/15 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                        지속형 학습 코치
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                        목표를 말씀하시면<br />커리큘럼으로 쪼개드려요
                    </h1>
                    <p className="mt-3 text-sm text-[#5C5468] leading-relaxed">
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

                {checked && goal ? (
                    <>
                        <div className="bg-white border border-[#E4DCF0] rounded-2xl p-4 mb-3">
                            <p className="text-xs text-[#9089A1] font-semibold mb-1">진행 중인 학습</p>
                            <p className="text-base font-extrabold leading-snug">{goal.title}</p>
                            <div className="mt-3 h-2 bg-[#EFE9F5] rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all"
                                    style={{ width: `${goal.progressPercent}%` }}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-[#5C5468]">{goal.progressPercent}% 완료</p>
                        </div>
                        <button
                            onClick={() => { window.location.href = '/learning/dashboard'; }}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                        >
                            📖 이어서 학습하기 →
                        </button>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                                onClick={() => { window.location.href = '/learning/curriculum'; }}
                                className="bg-white border border-[#E4DCF0] text-[#2D2438] text-sm font-bold py-3 rounded-xl hover:bg-[#FBF8F3] transition-colors"
                            >
                                🗂 전체 커리큘럼
                            </button>
                            <button
                                onClick={() => { window.location.href = '/learning/onboarding'; }}
                                className="bg-white border border-[#E4DCF0] text-[#2D2438] text-sm font-bold py-3 rounded-xl hover:bg-[#FBF8F3] transition-colors"
                            >
                                ➕ 새 학습 신청
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => { window.location.href = '/learning/onboarding'; }}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 text-white text-base font-extrabold py-3.5 rounded-xl transition-colors"
                        >
                            학습 서비스 신청 →
                        </button>
                        <p className="mt-3 text-center text-xs text-[#9089A1]">
                            로그인 없이 목표부터 입력해볼 수 있어요.
                        </p>
                    </>
                )}
            </main>
        </div>
    );
};

const FeatureRow: React.FC<{ emoji: string; title: string; desc: string }> = ({ emoji, title, desc }) => (
    <div className="flex items-start gap-3 bg-[#F5EFE6] border border-[#F0E9DE] rounded-2xl p-4">
        <span className="flex-shrink-0 text-2xl">{emoji}</span>
        <div className="flex-1 min-w-0">
            <h2 className="text-sm font-extrabold">{title}</h2>
            <p className="mt-1 text-xs text-[#5C5468] leading-relaxed">{desc}</p>
        </div>
    </div>
);
