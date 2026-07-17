import React, { useEffect, useState } from 'react';

// 📚 학습자료 공용 부품 (2026-07-17) — 1편(LearnPage)·2편(LearnPage2)이 함께 쓰는 UI 조각.
// 2편을 만들며 1편에서 그대로 뽑아낸 것들(동작·클래스 무변경). 새 편이 생기면 여기서 가져다 쓴다.
// 정본 메모리=[[project_learn_course]].

// ─────────────────────────────────────────────────────
// 📋 프롬프트/명령어 복사 블록 — 복사 버튼 + 2초 "복사됨" 피드백
// ─────────────────────────────────────────────────────
export const CopyBlock: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // http/구형 브라우저 폴백
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="relative bg-[#1E1B2E] rounded-xl border border-[#8E6FB7]/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#8E6FB7]/20">
                <span className="text-xs font-semibold text-[#C4A9E0]">{label ?? '프롬프트'}</span>
                <button
                    onClick={copy}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${copied ? 'bg-green-500/20 text-green-300' : 'bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]'}`}
                >
                    {copied ? '✓ 복사됨!' : '📋 복사'}
                </button>
            </div>
            <pre className="px-4 py-3 text-[13px] leading-relaxed text-gray-200 whitespace-pre-wrap break-words font-sans">{text}</pre>
        </div>
    );
};

// ─────────────────────────────────────────────────────
// 단계 섹션 래퍼 / 팁 / 성공기준 / 모바일 안내 — 1편과 동일한 톤
// ─────────────────────────────────────────────────────
export type CourseStep = { id: string; no: number; emoji: string; title: string };

export const Step: React.FC<{ step: CourseStep; children: React.ReactNode }> = ({ step, children }) => (
    <section id={step.id} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#8E6FB7] text-white font-extrabold flex items-center justify-center text-sm">{step.no}</span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">{step.emoji} {step.title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
    </section>
);

export const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl px-4 py-3 text-sm text-[#5A4A6E] leading-relaxed">
        💡 {children}
    </div>
);

// "이게 보이면 성공" — 초보자가 자기 진행이 맞는지 확인하는 기준점
export const Success: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 leading-relaxed">
        ✅ <b>이게 보이면 성공:</b> {children}
    </div>
);

// "모바일에서는" — 폰으로 따라오는 수강생용 단계별 안내(가능/대안/PC 필요 명시)
export const Mobile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed">
        📱 <b>모바일에서는:</b> {children}
    </div>
);

// ⚠️ 주의 — 되돌리기 어렵거나 자주 실수하는 지점(2편 신설: 유저명·Public 선택 등)
export const Caution: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 leading-relaxed">
        ⚠️ {children}
    </div>
);

// 📸 스크린샷 자리 — 실제 화면 캡처를 넣기 전 임시 표시(사장 캡처 협업 대기).
// src가 채워지면 이미지로 바뀐다. 비어 있으면 회색 안내 박스.
export const Shot: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => (
    src
        ? <img src={src} alt={alt} className="w-full rounded-xl border border-[#8E6FB7]/20 shadow-sm" loading="lazy" />
        : (
            <div className="border-2 border-dashed border-[#8E6FB7]/25 rounded-xl px-4 py-6 text-center bg-white/60">
                <div className="text-2xl mb-1">📸</div>
                <div className="text-xs font-semibold text-[#9A8FB0] leading-relaxed">{alt}</div>
            </div>
        )
);

// 🆘 FAQ 아이템 (접이식)
export const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => (
    <details className="bg-white border border-[#8E6FB7]/15 rounded-xl px-4 py-3 group">
        <summary className="text-sm font-bold cursor-pointer list-none flex gap-2">
            <span className="text-[#D85C95] flex-shrink-0">Q.</span>{q}
        </summary>
        <p className="text-sm text-[#4A4058] mt-2 pl-6 leading-relaxed">{a}</p>
    </details>
);

// ─────────────────────────────────────────────────────
// 📖 용어 드래그 툴팁 — 단어를 셀렉트하면 뜻 말풍선.
// selectionchange는 드래그 중 연발되므로 250ms 디바운스.
// 1편/2편이 각자의 GLOSSARY를 넘겨 쓴다.
// ─────────────────────────────────────────────────────
export const useGlossaryTip = (glossary: Record<string, string>, enabled: boolean) => {
    const [tip, setTip] = useState<{ term: string; desc: string; x: number; y: number } | null>(null);
    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setTimeout>;
        const onSel = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const sel = window.getSelection();
                const raw = sel?.toString().trim() ?? '';
                const key = raw.toLowerCase().replace(/[.,!?'"()“”]/g, '').trim();
                const desc = glossary[key];
                if (!raw || raw.length > 24 || !desc || !sel || sel.rangeCount === 0) { setTip(null); return; }
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                setTip({
                    term: raw,
                    desc,
                    x: Math.min(Math.max(rect.left + rect.width / 2, 150), window.innerWidth - 150),
                    y: Math.min(rect.bottom + 10, window.innerHeight - 40),
                });
            }, 250);
        };
        document.addEventListener('selectionchange', onSel);
        return () => { clearTimeout(timer); document.removeEventListener('selectionchange', onSel); };
    }, [glossary, enabled]);
    return tip;
};

export const GlossaryTip: React.FC<{ tip: { term: string; desc: string; x: number; y: number } | null }> = ({ tip }) => (
    tip ? (
        <div className="fixed z-50 -translate-x-1/2 max-w-[280px] bg-[#2D2438] text-white rounded-xl px-4 py-3 shadow-2xl pointer-events-none"
             style={{ left: tip.x, top: tip.y }}>
            <div className="text-xs font-extrabold text-[#C4A9E0] mb-1">📖 {tip.term}</div>
            <div className="text-[13px] leading-relaxed">{tip.desc}</div>
        </div>
    ) : null
);

// ─────────────────────────────────────────────────────
// 🔀 스크롤 스파이 — 지금 보는 단계를 목차에 활성 표시
// ─────────────────────────────────────────────────────
export const useScrollSpy = (enabled: boolean) => {
    const [activeStep, setActiveStep] = useState('');
    useEffect(() => {
        if (!enabled) return;
        const obs = new IntersectionObserver(entries => {
            const vis = entries.filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActiveStep(vis[0].target.id);
        }, { rootMargin: '-15% 0px -60% 0px' });
        document.querySelectorAll('section[id^="step"], section#faq, section#quiz').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [enabled]);

    // 활성 칩이 모바일 칩 바 밖에 있으면 보이게 따라 스크롤(세로 점프 방지 block:nearest)
    useEffect(() => {
        if (!activeStep) return;
        document.querySelector(`a[data-chip="${activeStep}"]`)
            ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, [activeStep]);

    return activeStep;
};

// ─────────────────────────────────────────────────────
// 🔐 회원 전용 게이트 훅 — 토큰 없으면 즉시 guest, 있으면 /auth/me 확인.
// 네트워크 오류(서버 순단)는 열어줌: 강의 중 일시 장애로 수강생 전원이 막히는 것 방지(1편 정책 승계).
// ─────────────────────────────────────────────────────
export const useLearnAuth = () => {
    const [auth, setAuth] = useState<'checking' | 'ok' | 'guest'>(() => localStorage.getItem('token') ? 'checking' : 'guest');
    useEffect(() => {
        if (auth !== 'checking') return;
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => setAuth(r.ok ? 'ok' : 'guest'))
            .catch(() => setAuth('ok'));
    }, [auth]);
    return auth;
};

// 로그인 페이지로 보내며 복귀 지점을 기억시킨다(?login=1 = useAuth가 authPage 직행).
export const goLoginTo = (redirect: string) => {
    sessionStorage.setItem('afterAuthRedirect', redirect);
    window.location.href = '/?login=1';
};
