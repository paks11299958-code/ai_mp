import React, { useEffect, useState } from 'react';

// 📚 학습자료 페이지 (/learn/homepage) — 지우의 "AI로 홈페이지 만들기" 단계별 강의 자료.
// 강의장에서 주소/QR로 직접 접속하는 용도라 EmbedChat·ConsultPage처럼 AppContent
// 진입 전 얼리리턴으로 렌더된다(비회원 접근 가능, 앱 훅·컨텍스트 비의존).
// 시안 파일은 public/learn/designs/*.html 정적 서빙(다운로드 시 index.html로 저장).

const COURSE_STEPS = [
    { id: 'step1', no: 1, emoji: '📝', title: '기획 — 어떤 홈페이지를 만들까?' },
    { id: 'step2', no: 2, emoji: '🎨', title: 'AI로 디자인 시안 만들기' },
    { id: 'step3', no: 3, emoji: '💾', title: '시안 다운로드 & VS Code 준비' },
    { id: 'step4', no: 4, emoji: '🚀', title: '로컬호스트로 띄우기' },
    { id: 'step5', no: 5, emoji: '✨', title: 'Claude Code로 내 마음대로 고치기' },
];

// 시안 갤러리 — public/learn/designs/ 정적 파일과 1:1
const DESIGNS = [
    { file: '/learn/designs/ochang-a.html', name: '시안 A — 모던 클린', desc: '깔끔한 화이트+인디고. 신뢰감 있는 공식 홈페이지 느낌' },
    { file: '/learn/designs/ochang-b.html', name: '시안 B — 따뜻한 커뮤니티', desc: '크림+오렌지. 동네 모임의 정겨운 분위기' },
    { file: '/learn/designs/ochang-c.html', name: '시안 C — 다크 테크', desc: '다크+네온. AI 연구회다운 실험실 무드' },
];

// 2단계 — AI에 붙여넣는 디자인 생성 프롬프트 (제미나이·챗GPT·클로드 공용)
const DESIGN_PROMPT = `오창AI 연구회 커뮤니티 홈페이지를 만들어줘.

- 목적: AI를 함께 배우고 만들어가는 지역 모임(오창AI 연구회) 소개
- 메뉴: 소개 / 활동소식 / 스터디자료 / 가입안내
- 분위기: 따뜻하고 신뢰감 있게, 모바일에서도 예쁘게
- 조건: HTML 파일 하나(index.html)로 완성하고, CSS는 파일 안에 포함해줘.
  이미지 없이 이모지와 색만으로 꾸며줘.`;

const CLAUDE_CODE_PROMPTS = [
    { label: '로컬 서버 띄우기', text: '이 폴더의 index.html을 로컬 서버로 띄워줘. 브라우저에서 볼 수 있는 주소를 알려줘.' },
    { label: '색 바꾸기', text: '헤더와 버튼 색을 파란색 계열로 바꿔줘.' },
    { label: '섹션 추가', text: '모임 사진을 넣을 갤러리 섹션을 활동소식 아래에 추가해줘. 사진은 일단 회색 박스로 자리만 잡아줘.' },
    { label: '모바일 최적화', text: '휴대폰에서 봤을 때 글자가 잘리거나 메뉴가 넘치지 않게 고쳐줘.' },
];

// 프롬프트 복사 블록 — 복사 버튼 + 2초 "복사됨" 피드백
const CopyBlock: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
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

// 단계 섹션 래퍼 — 번호 뱃지 + 제목 + 내용
const Step: React.FC<{ step: typeof COURSE_STEPS[number]; children: React.ReactNode }> = ({ step, children }) => (
    <section id={step.id} className="scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#8E6FB7] text-white font-extrabold flex items-center justify-center text-sm">{step.no}</span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">{step.emoji} {step.title}</h2>
        </div>
        <div className="space-y-4">{children}</div>
    </section>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl px-4 py-3 text-sm text-[#5A4A6E] leading-relaxed">
        💡 {children}
    </div>
);

// "이게 보이면 성공" — 초보자가 자기 진행이 맞는지 확인하는 기준점
const Success: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 leading-relaxed">
        ✅ <b>이게 보이면 성공:</b> {children}
    </div>
);

// "모바일에서는" — 폰으로 따라오는 수강생용 단계별 안내(가능/대안/PC 필요 명시)
const Mobile: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed">
        📱 <b>모바일에서는:</b> {children}
    </div>
);

// 🆘 막혔을 때 — 강의장에서 실제로 나오는 질문 모음 (접이식)
const FAQS: Array<[string, string]> = [
    ['다운로드한 파일을 더블클릭하면 브라우저로 열려요. 잘못된 건가요?', '아니에요, 정상이에요! 더블클릭으로 열리는 건 "파일로 열기"이고, 우리가 배우는 건 "서버로 열기(localhost)"예요. 4단계의 Live Server나 Claude Code를 쓰면 주소창에 localhost가 뜹니다.'],
    ['AI가 준 코드가 너무 길어서 어디까지 복사해야 할지 모르겠어요', '코드 블록 오른쪽 위의 "복사" 버튼을 누르면 전체가 복사돼요. 메모장이 아니라 VS Code에 붙여넣고 index.html로 저장하세요.'],
    ['Live Server를 설치했는데 우클릭 메뉴에 안 보여요', 'VS Code를 완전히 껐다 켜 보세요. 그래도 안 되면 "폴더"를 연 게 아니라 "파일"만 연 경우예요. 파일 > 폴더 열기로 my-homepage 폴더를 다시 여세요.'],
    ['localhost 화면이 하얗게만 나와요', '파일 이름이 index.html이 맞는지 확인하세요(index.html.txt처럼 뒤에 .txt가 붙는 경우가 많아요). 그리고 파일이 폴더 안에 있는지도요.'],
    ['수정했는데 브라우저에 반영이 안 돼요', '저장(Ctrl+S)을 먼저! 그다음 브라우저 새로고침(F5)이에요. Live Server는 저장하면 자동 새로고침됩니다.'],
    ['꼭 VS Code를 써야 하나요? 다른 건 안 되나요?', '아니요, 필수는 아니에요. 코드 수정은 메모장으로도 되고, 열어보는 건 더블클릭으로도 됩니다. 다만 VS Code는 무료인 데다 편집기+로컬서버(Live Server)+Claude Code 터미널을 한 화면에서 해결해줘서 수업 기준으로 삼았어요. Cursor 같은 다른 편집기를 이미 쓰신다면 그대로 쓰셔도 됩니다.'],
    ['폰에 있는 클로드(Claude) 앱으로는 안 되나요?', '절반 이상 됩니다! 클로드 앱에 2단계 프롬프트를 넣으면 결과가 "미리보기(아티팩트)" 화면으로 바로 떠서, 폰에서도 완성된 홈페이지 모습을 즉시 보고 "파란색으로 바꿔줘" 같은 수정 요청까지 할 수 있어요. 챗GPT·제미나이 앱도 비슷한 미리보기(캔버스)를 지원합니다. 다만 폰의 클로드 앱은 PC 터미널 도구인 Claude Code와는 달라서, 파일로 저장해 로컬호스트로 띄우는 3~4단계는 PC가 필요해요.'],
];

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => (
    <details className="bg-white border border-[#8E6FB7]/15 rounded-xl px-4 py-3 group">
        <summary className="text-sm font-bold cursor-pointer list-none flex gap-2">
            <span className="text-[#D85C95] flex-shrink-0">Q.</span>{q}
        </summary>
        <p className="text-sm text-[#4A4058] mt-2 pl-6 leading-relaxed">{a}</p>
    </details>
);

// 로그인으로 보내기 — 복귀 경로를 심고 메인의 로그인 화면(?login=1)으로
const goLogin = () => {
    sessionStorage.setItem('afterAuthRedirect', '/learn/homepage');
    window.location.href = '/?login=1';
};

// 비가입자 게이트 — 코스 소개 + 얻는 것 목록으로 가입 유도(사장 결정: 회원 전용)
const GuestGate: React.FC = () => (
    <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
            <div className="text-5xl mb-4">🔒</div>
            <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">무료 학습 코스 · 회원 전용</span>
            <h1 className="text-2xl font-extrabold text-[#2D2438] leading-snug">🏠 AI로 홈페이지 만들어<br />내 컴퓨터에서 띄워보기</h1>
            <p className="mt-3 text-sm text-[#6E6480] leading-relaxed">
                코딩을 몰라도 따라 할 수 있는 5단계 강의예요.<br /><b>무료 회원가입</b>만 하면 전부 열립니다.
            </p>
            <div className="mt-5 bg-white border border-[#8E6FB7]/15 rounded-2xl p-5 text-left space-y-2.5">
                {[
                    '📚 5단계 따라하기 강의 (기획 → 완성)',
                    '🎨 홈페이지 디자인 시안 3종 다운로드',
                    '📋 AI에게 그대로 붙여넣는 프롬프트 모음',
                    '🆘 막혔을 때 보는 FAQ',
                    '🎁 지금 가입하면 보너스 500P',
                ].map(t => (
                    <div key={t} className="flex items-start gap-2 text-sm text-[#4A4058]"><span className="text-green-500 font-bold">✓</span>{t}</div>
                ))}
            </div>
            <button onClick={goLogin} className="mt-6 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold py-3.5 rounded-xl">
                무료 회원가입하고 시작하기 →
            </button>
            <button onClick={goLogin} className="mt-2.5 w-full text-sm font-semibold text-[#6E5DA3] py-2">
                이미 회원이에요 · 로그인
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="mt-1 w-full text-xs text-[#9A8FB0] py-2">
                ← AI 스퀘어 둘러보기
            </button>
        </div>
    </div>
);

export const LearnPage: React.FC = () => {
    // 회원 전용 게이트 — 토큰 없으면 즉시 게이트, 있으면 /auth/me로 유효성 확인.
    // 네트워크 오류(서버 순단)는 열어줌: 강의 중 일시 장애로 수강생 전원이 막히는 것 방지.
    const [auth, setAuth] = useState<'checking' | 'ok' | 'guest'>(() => localStorage.getItem('token') ? 'checking' : 'guest');
    useEffect(() => {
        if (auth !== 'checking') return;
        fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            .then(r => setAuth(r.ok ? 'ok' : 'guest'))
            .catch(() => setAuth('ok'));
    }, [auth]);

    // 스크롤 스파이 — 지금 보고 있는 단계를 목차(칩/사이드바)에 선택 표시.
    // 화면 상단 20%~40% 밴드에 걸린 섹션을 활성으로 판단(제목이 그 근처에 올 때 자연 전환).
    const [activeStep, setActiveStep] = useState('');
    useEffect(() => {
        if (auth !== 'ok') return;
        const obs = new IntersectionObserver(entries => {
            const vis = entries.filter(e => e.isIntersecting)
                .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
            if (vis[0]) setActiveStep(vis[0].target.id);
        }, { rootMargin: '-15% 0px -60% 0px' });
        document.querySelectorAll('section[id^="step"], section#faq').forEach(el => obs.observe(el));
        return () => obs.disconnect();
    }, [auth]);

    // 활성 칩이 모바일 칩 바 밖에 있으면 보이게 따라 스크롤(세로 점프 방지 block:nearest)
    useEffect(() => {
        if (!activeStep) return;
        document.querySelector(`a[data-chip="${activeStep}"]`)
            ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, [activeStep]);

    if (auth === 'guest') return <GuestGate />;
    if (auth === 'checking') {
        return (
            <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
                <p className="text-sm text-[#9A8FB0]">확인 중...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF8FC] text-[#2D2438]">
            {/* 헤더 */}
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#8E6FB7]/15">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-1.5 text-sm text-[#6E5DA3] font-semibold">
                        ← AI 스퀘어
                    </button>
                    <span className="text-sm font-extrabold text-[#2D2438]">📚 지우의 학습자료</span>
                    <span className="w-16" />
                </div>
            </header>

            {/* 모바일 전용 — 얇은 단계 칩 바(가로 스크롤). 큰 목차 카드 대신 어지러움 최소화 */}
            <nav className="lg:hidden sticky top-14 z-10 bg-[#FAF8FC]/95 backdrop-blur border-b border-[#8E6FB7]/10">
                <div className="flex gap-2 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
                    {COURSE_STEPS.map(s => {
                        const on = activeStep === s.id;
                        return (
                            <a key={s.id} href={`#${s.id}`} data-chip={s.id}
                               className={`flex-shrink-0 flex items-center gap-1.5 border rounded-full pl-1.5 pr-3 py-1 transition-colors ${on ? 'bg-[#8E6FB7] border-[#8E6FB7]' : 'bg-white border-[#8E6FB7]/20'}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${on ? 'bg-white text-[#6E5DA3]' : 'bg-[#8E6FB7] text-white'}`}>{s.no}</span>
                                <span className={`text-xs font-semibold whitespace-nowrap ${on ? 'text-white' : ''}`}>{s.title.split(' — ')[0]}</span>
                            </a>
                        );
                    })}
                    <a href="#faq" data-chip="faq"
                       className={`flex-shrink-0 flex items-center border rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${activeStep === 'faq' ? 'bg-[#D85C95] border-[#D85C95] text-white' : 'bg-white border-[#D85C95]/25 text-[#D85C95]'}`}>🆘 막혔을 때</a>
                </div>
            </nav>

            <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:px-6">
            {/* 데스크톱 전용 — 왼쪽 고정 목차 */}
            <aside className="hidden lg:block">
                <nav className="sticky top-20 py-8 space-y-1.5">
                    <div className="text-xs font-extrabold text-[#9A8FB0] tracking-wider mb-3 px-3">목차</div>
                    {COURSE_STEPS.map(s => {
                        const on = activeStep === s.id;
                        return (
                            <a key={s.id} href={`#${s.id}`}
                               className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border transition-colors ${on ? 'bg-[#8E6FB7] border-[#8E6FB7]' : 'border-transparent hover:bg-white hover:border-[#8E6FB7]/20'}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 ${on ? 'bg-white text-[#6E5DA3]' : 'bg-[#F0E8F8] text-[#6E5DA3]'}`}>{s.no}</span>
                                <span className={`text-[13px] font-semibold leading-tight ${on ? 'text-white' : ''}`}>{s.title.split(' — ')[0]}</span>
                            </a>
                        );
                    })}
                    <a href="#faq"
                       className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border text-[13px] font-semibold transition-colors ${activeStep === 'faq' ? 'bg-[#D85C95] border-[#D85C95] text-white' : 'border-transparent text-[#D85C95] hover:bg-white hover:border-[#D85C95]/25'}`}>🆘 막혔을 때</a>
                </nav>
            </aside>

            <main className="max-w-2xl mx-auto lg:mx-0 lg:max-w-none px-4 lg:px-0 py-8 space-y-12 pb-24">
                {/* 코스 소개 */}
                <section className="text-center lg:text-left">
                    <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">무료 학습 코스 · 1호</span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">🏠 AI로 홈페이지 만들어<br className="lg:hidden" /> 내 컴퓨터에서 띄워보기</h1>
                    <p className="mt-3 text-sm sm:text-base text-[#6E6480] leading-relaxed">
                        코딩을 몰라도 괜찮아요. AI에게 부탁해서 홈페이지 디자인을 만들고,<br className="hidden sm:block" />
                        내 컴퓨터(로컬호스트)에서 직접 띄워보는 것까지 5단계로 함께해요.
                    </p>
                    <p className="mt-2 text-xs text-[#9A8FB0]">실습 예제: 오창AI 연구회 — 배우고 만들어가는 커뮤니티 홈페이지</p>
                    <div className="mt-4 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed text-left">
                        📱 <b>폰으로 보고 계신가요?</b> 1~2단계(기획·AI로 시안 만들기)는 폰으로도 충분히 실습할 수 있어요.
                        3단계부터(내 컴퓨터에서 띄우기)는 PC/노트북이 필요합니다 — 각 단계의 <b>"모바일에서는"</b> 파란 박스를 참고하세요.
                    </div>
                </section>

                {/* 1단계 — 기획 */}
                <Step step={COURSE_STEPS[0]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        홈페이지를 만들기 전에 딱 4가지만 정하면 됩니다. 종이에 적어보세요.
                    </p>
                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                        {[
                            ['① 이름', '홈페이지(모임)의 이름 — 예: 오창AI 연구회'],
                            ['② 목적', '무엇을 알리고 싶은가 — 예: AI를 함께 배우는 모임 소개와 회원 모집'],
                            ['③ 메뉴', '어떤 내용을 담을까 — 예: 소개 / 활동소식 / 스터디자료 / 가입안내'],
                            ['④ 분위기', '어떤 느낌이면 좋을까 — 예: 따뜻하고 신뢰감 있게'],
                        ].map(([k, v]) => (
                            <div key={k} className="px-4 py-3 flex gap-3 text-sm">
                                <span className="font-bold text-[#6E5DA3] flex-shrink-0 w-16">{k}</span>
                                <span className="text-[#4A4058]">{v}</span>
                            </div>
                        ))}
                    </div>
                    <Tip>이 4가지가 곧 다음 단계에서 AI에게 부탁하는 말(프롬프트)의 재료가 됩니다.</Tip>
                    <Mobile>폰 메모앱에 적으면 됩니다. 이 단계는 폰으로 100% 가능해요.</Mobile>
                    <Success>4칸이 다 채워진 메모가 손에 있다.</Success>
                </Step>

                {/* 2단계 — AI 디자인 */}
                <Step step={COURSE_STEPS[1]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        아래 프롬프트를 <b>복사</b>해서 제미나이(gemini.google.com), 챗GPT(chatgpt.com), 클로드(claude.ai) 중
                        아무 곳에나 붙여넣어 보세요. 1단계에서 정한 내용으로 이름·메뉴·분위기만 바꾸면 내 모임 홈페이지가 됩니다.
                    </p>
                    <CopyBlock text={DESIGN_PROMPT} label="디자인 생성 프롬프트 (제미나이·챗GPT·클로드 공용)" />
                    <Tip>
                        핵심은 마지막 조건이에요 — <b>"HTML 파일 하나로, CSS 포함"</b>. 파일이 하나여야
                        초보자도 저장·실행이 쉽습니다. AI가 코드를 주면 <b>index.html</b> 이름으로 저장하세요.
                    </Tip>

                    <p className="text-sm leading-relaxed text-[#4A4058] pt-2">
                        지우가 위 프롬프트로 미리 만들어 둔 시안 3종이에요. 마음에 드는 것을 골라 <b>미리보기</b>로 확인하고
                        <b> 다운로드</b>하면 바로 3단계로 넘어갈 수 있어요. (다운로드하면 index.html 파일로 저장됩니다)
                    </p>
                    <div className="grid gap-5">
                        {DESIGNS.map(d => (
                            <div key={d.file} className="bg-white border border-[#8E6FB7]/15 rounded-2xl overflow-hidden">
                                {/* 축소 미리보기 — 데스크톱 폭(1280)을 1/4로 스케일 */}
                                <div className="relative w-full overflow-hidden bg-gray-100" style={{ aspectRatio: '16/10' }}>
                                    <iframe
                                        src={d.file}
                                        title={d.name}
                                        tabIndex={-1}
                                        loading="lazy"
                                        className="absolute top-0 left-0 border-0 pointer-events-none"
                                        style={{ width: '400%', height: '400%', transform: 'scale(0.25)', transformOrigin: 'top left' }}
                                    />
                                </div>
                                <div className="px-4 py-3.5">
                                    <div className="font-extrabold text-sm">{d.name}</div>
                                    <div className="text-xs text-[#9A8FB0] mt-0.5">{d.desc}</div>
                                    <div className="flex gap-2 mt-3">
                                        <a href={d.file} target="_blank" rel="noopener noreferrer"
                                           className="flex-1 text-center text-xs font-bold py-2.5 rounded-lg border border-[#8E6FB7]/40 text-[#6E5DA3] hover:bg-[#F5EFFA]">
                                            🔍 미리보기
                                        </a>
                                        <a href={d.file} download="index.html"
                                           className="flex-1 text-center text-xs font-bold py-2.5 rounded-lg bg-[#8E6FB7] text-white hover:bg-[#7A5FA0]">
                                            ⬇ 다운로드 (index.html)
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Mobile>
                        이 단계도 폰으로 가능해요! 특히 <b>클로드 앱</b>은 위 프롬프트를 넣으면 결과가
                        <b> 미리보기(아티팩트)</b>로 바로 떠서, 폰 화면에서 완성된 홈페이지를 즉시 볼 수 있어요.
                        (챗GPT·제미나이 앱도 비슷한 미리보기 지원) 시안 <b>[미리보기]</b> 버튼도 폰에서 바로 열립니다.
                    </Mobile>
                    <Success>index.html 파일이 내 컴퓨터의 다운로드 폴더에 저장되어 있다. (AI로 직접 만들었다면 코드를 index.html로 저장했다)</Success>
                </Step>

                {/* 3단계 — VS Code */}
                <Step step={COURSE_STEPS[2]}>
                    <ol className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10 text-sm">
                        {[
                            ['VS Code 설치', 'code.visualstudio.com 에서 다운로드 → 설치. 전부 "다음"만 눌러도 됩니다.'],
                            ['폴더 만들기', '바탕화면에 새 폴더를 만드세요. 이름은 영어로: my-homepage'],
                            ['파일 넣기', '2단계에서 다운로드한 index.html 파일을 my-homepage 폴더에 넣습니다.'],
                            ['VS Code로 열기', 'VS Code 실행 → 파일 > 폴더 열기 → my-homepage 폴더 선택.'],
                        ].map(([t, d], i) => (
                            <li key={t} className="px-4 py-3 flex gap-3">
                                <span className="font-extrabold text-[#6E5DA3] flex-shrink-0">{i + 1}.</span>
                                <span><b>{t}</b> — <span className="text-[#4A4058]">{d}</span></span>
                            </li>
                        ))}
                    </ol>
                    <Tip>폴더 이름을 영어로 하는 이유: 일부 개발 도구가 한글 경로에서 오작동할 수 있어서예요. 습관을 들이면 좋아요.</Tip>
                    <Mobile>
                        여기부터는 <b>PC/노트북이 필요해요</b>. 폰에서 만든 코드는 카카오톡 '나에게 보내기'나
                        이메일로 PC에 옮기면 이어서 할 수 있습니다. 지금 폰뿐이라면 이 단계부터는 눈으로 읽어두고, 집에서 노트북으로 해보세요.
                    </Mobile>
                    <Success>VS Code 왼쪽 파일 목록에 my-homepage 폴더와 그 안의 index.html이 보인다.</Success>
                </Step>

                {/* 4단계 — 로컬호스트 */}
                <Step step={COURSE_STEPS[3]}>
                    <div className="bg-white border-2 border-dashed border-[#D85C95]/40 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-1.5">🍭 준비운동 — 일단 더블클릭!</div>
                        <p className="text-sm text-[#4A4058] leading-relaxed">
                            다운로드한 index.html을 <b>더블클릭</b>해 보세요. 브라우저에 내 홈페이지가 바로 뜹니다.
                            축하해요, 벌써 절반은 성공! 다만 주소창을 보면 <b>file://</b> 로 시작하죠 —
                            이건 "파일 구경하기"예요. 이제 진짜 웹사이트처럼 <b>주소(localhost)로 여는 법</b>을 배워볼 차례입니다.
                        </p>
                    </div>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        <b>로컬호스트(localhost)</b>란 "내 컴퓨터 안에서만 열리는 웹서버"예요.
                        인터넷에 올리기 전에 내 눈으로 먼저 확인하는 무대입니다. 방법은 두 가지 — 쉬운 길과 멋진 길.
                    </p>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">🅰 쉬운 길 — Live Server 확장</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside">
                            <li>VS Code 왼쪽의 블록 모양 아이콘(확장) 클릭</li>
                            <li>"Live Server" 검색 → 설치(Install)</li>
                            <li>index.html 파일을 우클릭 → <b>"Open with Live Server"</b></li>
                            <li>브라우저에 <b>localhost:5500</b> 주소로 내 홈페이지가 뜨면 성공! 🎉</li>
                        </ol>
                    </div>

                    <div className="bg-white border border-[#8E6FB7]/15 rounded-xl p-4">
                        <div className="font-extrabold text-sm mb-2">🅱 멋진 길 — Claude Code에게 부탁하기</div>
                        <ol className="text-sm text-[#4A4058] space-y-1.5 list-decimal list-inside mb-3">
                            <li>claude.com/claude-code 안내에 따라 Claude Code 설치 → 로그인</li>
                            <li>VS Code에서 터미널 열기(Ctrl+`) → <b>claude</b> 입력해 실행</li>
                            <li>아래 프롬프트를 붙여넣으면 알아서 서버를 띄워줍니다</li>
                        </ol>
                        <CopyBlock text={CLAUDE_CODE_PROMPTS[0].text} label="Claude Code 프롬프트" />
                    </div>
                    <Tip>주소창의 localhost는 내 컴퓨터에서만 보여요. 다른 사람에게 보여주려면 인터넷에 올려야 하는데, 그건 다음 코스에서 배워요.</Tip>
                    <Mobile>
                        localhost 실습은 PC 전용이지만, <b>비슷한 체험</b>은 폰으로도 돼요 — 안드로이드는 '파일' 앱에서
                        다운로드한 index.html을 눌러 <b>Chrome으로 열기</b>를 하면 내 폰 화면에 내 홈페이지가 뜹니다.
                        (아이폰은 파일 앱에서 미리보기로 확인) "내 기기에서 내 홈페이지를 열었다"는 경험은 동일해요.
                    </Mobile>
                    <Success>브라우저 주소창에 localhost로 시작하는 주소가 있고, 내 홈페이지가 화면에 떠 있다. 🎉</Success>
                </Step>

                {/* 5단계 — Claude Code 수정 */}
                <Step step={COURSE_STEPS[4]}>
                    <p className="text-sm leading-relaxed text-[#4A4058]">
                        여기가 제일 재밌는 부분! Claude Code에게 말로 부탁하고 → 브라우저 새로고침 → 바로 바뀐 모습 확인.
                        아래 프롬프트로 하나씩 실습해 보세요.
                    </p>
                    {CLAUDE_CODE_PROMPTS.slice(1).map(p => (
                        <CopyBlock key={p.label} text={p.text} label={`실습 — ${p.label}`} />
                    ))}
                    <Tip>정해진 문장은 없어요. "더 고급스럽게", "글씨 크게" 처럼 <b>친구에게 말하듯</b> 부탁하는 게 요령입니다.</Tip>
                    <Mobile>
                        Claude Code는 PC 전용이지만, 폰에서는 <b>클로드 앱</b>이 그 역할을 대신해요 —
                        기존 코드를 붙여넣고 "헤더를 파란색으로 바꿔줘"라고 하면 <b>미리보기(아티팩트)</b>가
                        바로 바뀐 모습으로 갱신됩니다. 보면서 고치는 경험은 폰에서도 똑같아요.
                    </Mobile>
                    <Success>부탁 → 저장 → 새로고침 사이클로 홈페이지가 내 말대로 바뀐다. 이제 여러분은 개발자예요!</Success>
                </Step>

                {/* 🆘 막혔을 때 — 강의장 단골 질문 */}
                <section id="faq" className="scroll-mt-20">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#D85C95] text-white font-extrabold flex items-center justify-center text-sm">🆘</span>
                        <h2 className="text-lg sm:text-xl font-extrabold text-[#2D2438]">막혔을 때 — 자주 나오는 질문</h2>
                    </div>
                    <div className="space-y-2.5">
                        {FAQS.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
                    </div>
                </section>

                {/* 마무리 CTA */}
                <section className="text-center bg-gradient-to-br from-[#8E6FB7] to-[#6E5DA3] rounded-2xl px-6 py-10 text-white">
                    <div className="text-3xl mb-2">🎓</div>
                    <h2 className="text-xl font-extrabold">수고하셨어요!</h2>
                    <p className="text-sm opacity-90 mt-2 leading-relaxed">
                        나만의 홈페이지가 내 컴퓨터에서 돌아가고 있나요?<br />
                        막히는 부분은 AI 스퀘어의 지우에게 물어보세요.
                    </p>
                    <button onClick={() => { window.location.href = '/'; }}
                            className="mt-5 bg-white text-[#6E5DA3] font-extrabold text-sm px-6 py-3 rounded-xl">
                        지우에게 물어보러 가기 →
                    </button>
                </section>
            </main>
            </div>
        </div>
    );
};
