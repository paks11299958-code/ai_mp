import React from 'react';

// 🎓 AI 학습코칭 상단 탭 (2026-08-25 신설, 사장 제안).
// ★상시 오가는 4개 화면만 묶는다 — 대시보드/전체 커리큘럼/복습/설정.
//   오늘 과제·퀴즈·신청 온보딩은 '몰입'이 필요해 일부러 뺐다.
//   탭에 넣으면 문제 푸는 중에 다른 탭을 눌러 진행이 끊긴다.
// ★주소는 그대로 유지한다(각 화면이 독립 라우트). 탭은 이동 수단일 뿐,
//   SPA 상태 전환이 아니라 location.href 이동이다 — 기존 라우팅을 건드리지 않는다.

export const LEARNING_TABS = [
    { key: 'dashboard',  label: '오늘',     emoji: '📖', href: '/learning/dashboard' },
    { key: 'curriculum', label: '커리큘럼', emoji: '🗂', href: '/learning/curriculum' },
    { key: 'review',     label: '복습',     emoji: '🔁', href: '/learning/review' },
    { key: 'settings',   label: '설정',     emoji: '⚙️', href: '/learning/settings' },
] as const;

export type LearningTabKey = typeof LEARNING_TABS[number]['key'];

export const LearningTabs: React.FC<{ active: LearningTabKey }> = ({ active }) => (
    <nav className="border-b border-[#F0E9DE] bg-[#F5EFE6]">
        {/* PC에서 넓게(4xl), 모바일은 그대로 — 헤더/본문과 같은 폭 규칙을 쓴다 */}
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
            {LEARNING_TABS.map(t => {
                const on = t.key === active;
                return (
                    <button
                        key={t.key}
                        onClick={() => { if (!on) window.location.href = t.href; }}
                        aria-current={on ? 'page' : undefined}
                        className={
                            'shrink-0 px-3 sm:px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ' +
                            (on
                                ? 'border-indigo-500 text-indigo-700'
                                : 'border-transparent text-[#9089A1] hover:text-[#5C5468]')
                        }
                    >
                        <span className="mr-1">{t.emoji}</span>{t.label}
                    </button>
                );
            })}
        </div>
    </nav>
);
