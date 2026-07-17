import React, { useEffect, useState } from 'react';
import { authApi } from '../../services/apiService';
import { captureRefFromUrl } from '../../services/referral';
import {
    CopyBlock, Step, Tip, Success, Mobile, Caution, Shot, FaqItem,
    useGlossaryTip, GlossaryTip, useScrollSpy, useLearnAuth, goLoginTo,
    type CourseStep,
} from './LearnKit';

// 📚 학습자료 2편 (/learn/homepage/2) — "내 홈페이지를 인터넷에 올리기"(GitHub → Vercel).
// 1편(로컬호스트까지)의 결과물 index.html이 있다는 전제에서 시작한다.
// 🔒 1편 학습평가 합격자만 입장(서버 기록 기준). 미합격/미수강은 LockGate 안내.
// 정본 메모리=[[project_learn_course]].

const COURSE_STEPS: CourseStep[] = [
    { id: 'step1', no: 1, emoji: '🐙', title: '깃허브 가입하기' },
    { id: 'step2', no: 2, emoji: '📦', title: '저장소(레포지토리) 만들기' },
    { id: 'step3', no: 3, emoji: '⬆️', title: 'index.html 올리기' },
    { id: 'step4', no: 4, emoji: '▲', title: '버셀 가입하기' },
    { id: 'step5', no: 5, emoji: '🚀', title: '배포해서 진짜 주소 받기' },
    { id: 'step6', no: 6, emoji: '🔄', title: '고치면 자동으로 바뀌게' },
];

// 📖 용어 사전 — 2편 전용(드래그하면 뜻 말풍선). 1편 용어와 겹치는 것은 다시 넣지 않음.
const GLOSSARY: Record<string, string> = {
    '깃허브': "내가 만든 파일을 인터넷에 보관하는 창고예요. 전 세계 개발자들이 코드를 두는 곳이고, 무료입니다. 여기에 올려두면 버셀이 가져다 홈페이지로 띄워줘요.",
    'github': "내가 만든 파일을 인터넷에 보관하는 창고예요. 전 세계 개발자들이 코드를 두는 곳이고, 무료입니다. 여기에 올려두면 버셀이 가져다 홈페이지로 띄워줘요.",
    '저장소': "깃허브 안에 만드는 '폴더 하나'예요. 홈페이지 하나당 저장소 하나라고 생각하시면 됩니다. 영어로 레포지토리(repository)라고 해요.",
    '레포지토리': "깃허브 안에 만드는 '폴더 하나'예요. 홈페이지 하나당 저장소 하나라고 생각하시면 됩니다. 줄여서 '레포'라고도 불러요.",
    'repository': "깃허브 안에 만드는 '폴더 하나'예요. 홈페이지 하나당 저장소 하나라고 생각하시면 됩니다. 줄여서 '레포'라고도 불러요.",
    '레포': "레포지토리(저장소)의 줄임말이에요. 깃허브 안의 폴더 하나 = 홈페이지 하나.",
    '커밋': "'이렇게 바꿨어요'라고 도장을 찍어 저장하는 일이에요. 파일을 올리거나 고칠 때마다 짧은 메모(커밋 메시지)를 남깁니다.",
    'commit': "'이렇게 바꿨어요'라고 도장을 찍어 저장하는 일이에요. 파일을 올리거나 고칠 때마다 짧은 메모(커밋 메시지)를 남깁니다.",
    '버셀': "깃허브에 있는 내 파일을 진짜 인터넷 주소로 만들어주는 서비스예요. 무료이고, 파일을 고치면 알아서 다시 띄워줍니다.",
    'vercel': "깃허브에 있는 내 파일을 진짜 인터넷 주소로 만들어주는 서비스예요. 무료이고, 파일을 고치면 알아서 다시 띄워줍니다.",
    '배포': "내 컴퓨터에만 있던 홈페이지를 인터넷에 올려서 누구나 볼 수 있게 만드는 일이에요. 영어로 deploy(디플로이)라고 합니다.",
    'deploy': "내 컴퓨터에만 있던 홈페이지를 인터넷에 올려서 누구나 볼 수 있게 만드는 일이에요. 우리말로 '배포'입니다.",
    '도메인': "홈페이지 주소예요(예: naver.com). 버셀이 무료 주소를 하나 주고, 원하면 직접 산 주소를 붙일 수도 있어요.",
    'public': "'공개'라는 뜻이에요. 저장소를 Public으로 만들면 누구나 파일을 볼 수 있습니다. 홈페이지는 어차피 공개할 거라 Public이 맞아요.",
    'private': "'비공개'라는 뜻이에요. 나만 볼 수 있는 저장소입니다. 이번 수업에서는 Public으로 만들어요.",
    'main': "저장소의 기본 가지(브랜치) 이름이에요. 특별한 이유가 없으면 여기에 올리면 됩니다.",
    '브랜치': "작업을 여러 갈래로 나눌 때 쓰는 '가지'예요. 우리는 기본 가지(main) 하나만 씁니다.",
    'branch': "작업을 여러 갈래로 나눌 때 쓰는 '가지'예요. 우리는 기본 가지(main) 하나만 씁니다.",
    '드래그앤드롭': "파일을 마우스로 집어서 원하는 곳에 끌어다 놓는 동작이에요. 깃허브 업로드 화면에 파일을 그대로 끌어다 놓으면 됩니다.",
    'https': "안전하게 암호화된 인터넷 주소예요. 버셀이 주는 주소는 자동으로 https라서 자물쇠 표시가 붙습니다.",
    '2단계 인증': "비밀번호 말고 폰으로 한 번 더 확인하는 보안 장치예요. 깃허브는 이걸 켜라고 권합니다(나중에 켜도 됩니다).",
};

// 📝 학습평가 — 사장 OK 후 제작 예정(1편과 같은 10문제×10점·오답 재출제 방식).
// 지금은 자리만 만들어 두고 '준비 중'으로 표시한다.
const QUIZ_READY = false;

// ─────────────────────────────────────────────────────
// 🔒 잠금 안내 — 1편 미수강/미합격자가 2편에 들어왔을 때.
// 모달이 아니라 화면으로 띄운다(닫으면 끝나는 게 아니라 1편으로 가도록).
// ─────────────────────────────────────────────────────
const LockGate: React.FC<{ reason: 'nopass' | 'guest' }> = ({ reason }) => (
    <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
            <div className="text-5xl mb-4">🔒</div>
            <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                무료 학습 코스 · 2호
            </span>
            <h1 className="text-2xl font-extrabold text-[#2D2438] leading-snug">
                🌍 내 홈페이지를<br />인터넷에 올리기
            </h1>

            {reason === 'guest' ? (
                <>
                    <p className="mt-3 text-sm text-[#6E6480] leading-relaxed">
                        회원 전용 강의예요. <b>무료 회원가입</b> 후,<br />
                        1편을 먼저 수강하시면 열립니다.
                    </p>
                    <button onClick={() => goLoginTo('/learn/homepage/2')}
                            className="mt-6 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold py-3.5 rounded-xl">
                        무료 회원가입하고 시작하기 →
                    </button>
                    <button onClick={() => goLoginTo('/learn/homepage/2')}
                            className="mt-2.5 w-full text-sm font-semibold text-[#6E5DA3] py-2">
                        이미 회원이에요 · 로그인
                    </button>
                </>
            ) : (
                <>
                    <p className="mt-3 text-sm text-[#6E6480] leading-relaxed">
                        이 강의는 <b>1편을 마친 분</b>께 열려요.<br />
                        1편에서 만든 <b>index.html</b>이 있어야 따라올 수 있거든요.
                    </p>
                    <div className="mt-5 bg-white border border-[#8E6FB7]/15 rounded-2xl p-5 text-left">
                        <div className="text-sm font-extrabold text-[#2D2438] mb-2.5">🔑 이렇게 하면 열려요</div>
                        <div className="space-y-2 text-sm text-[#4A4058]">
                            {[
                                <>1편 <b>「AI로 홈페이지 만들어 내 컴퓨터에서 띄워보기」</b>를 따라 해보세요.</>,
                                <>맨 아래 <b>📝 학습평가</b>를 끝까지 푸세요. 틀려도 괜찮아요 — 해설을 보고 다시 풀면 되고, <b>끝까지 풀면 누구나 통과</b>합니다.</>,
                                <>통과하면 이 2편이 <b>바로 열립니다.</b></>,
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <p className="flex-1 leading-relaxed">{t}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => { window.location.href = '/learn/homepage#quiz'; }}
                            className="mt-6 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white font-extrabold py-3.5 rounded-xl">
                        1편 학습평가 풀러 가기 →
                    </button>
                    <button onClick={() => { window.location.href = '/learn/homepage'; }}
                            className="mt-2.5 w-full text-sm font-semibold text-[#6E5DA3] py-2">
                        1편 처음부터 보기
                    </button>
                </>
            )}
            <button onClick={() => { window.location.href = '/learn'; }}
                    className="mt-1 w-full text-xs text-[#9A8FB0] py-2">
                ← 강의 목록으로
            </button>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────
export const LearnPage2: React.FC = () => {
    useEffect(() => { captureRefFromUrl(); }, []);

    const auth = useLearnAuth();

    // 🔒 1편 합격 여부 — 2편 입장 조건. 서버 기록이 정본(프론트 잠금은 안내용, 영상은 서버가 재검증).
    const [pass1, setPass1] = useState<'checking' | 'yes' | 'no'>('checking');
    useEffect(() => {
        if (auth !== 'ok') return;
        fetch('/api/learn/quiz-record?course=homepage', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(d => setPass1(d.passed ? 'yes' : 'no'))
            .catch(() => {
                // 서버 순단 시 1편 정책(열어줌)을 따르되, 로컬 합격 기록이 있으면 그것도 인정
                setPass1(localStorage.getItem('learnQuizPass.homepage') ? 'yes' : 'no');
            });
    }, [auth]);

    // 📝 2편 학습평가 기록 — 문제 제작 후 연결(지금은 배지 표시만)
    const [record, setRecord] = useState<{ passed: boolean; passedAt: string | null } | null>(null);
    useEffect(() => {
        if (auth !== 'ok' || !QUIZ_READY) return;
        fetch('/api/learn/quiz-record?course=homepage2', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
            .then(d => setRecord({ passed: !!d.passed, passedAt: d.passedAt ?? null }))
            .catch(() => setRecord(null));
    }, [auth]);

    const [refCode, setRefCode] = useState('');
    useEffect(() => {
        if (auth !== 'ok') return;
        authApi.referral().then(d => setRefCode(d.code || '')).catch(() => {});
    }, [auth]);

    // 📸 스크린샷 — 사장이 어드민에서 올린 실제 화면. 없는 자리는 안내 박스로 남는다.
    const [shots, setShots] = useState<Record<string, string>>({});
    useEffect(() => {
        if (auth !== 'ok') return;
        fetch('/api/learn/shots?course=homepage2')
            .then(r => (r.ok ? r.json() : {}))
            .then(d => setShots(d || {}))
            .catch(() => {});
    }, [auth]);

    const open = auth === 'ok' && pass1 === 'yes';
    const activeStep = useScrollSpy(open);
    const tip = useGlossaryTip(GLOSSARY, open);

    if (auth === 'guest') return <LockGate reason="guest" />;
    if (auth === 'checking' || pass1 === 'checking') {
        return (
            <div className="min-h-screen bg-[#FAF8FC] flex items-center justify-center">
                <p className="text-sm text-[#9A8FB0]">확인 중...</p>
            </div>
        );
    }
    if (pass1 === 'no') return <LockGate reason="nopass" />;

    return (
        <div className="min-h-screen bg-[#FAF8FC] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#8E6FB7]/15">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/learn'; }} className="flex items-center gap-1.5 text-sm text-[#6E5DA3] font-semibold">
                        ← 강의 목록
                    </button>
                    <span className="text-sm font-extrabold text-[#2D2438]">📚 박하진의 학습자료</span>
                    <span className="w-16" />
                </div>
            </header>

            <GlossaryTip tip={tip} />

            {/* 모바일 전용 — 얇은 단계 칩 바 */}
            <nav className="lg:hidden sticky top-14 z-10 bg-[#FAF8FC]/95 backdrop-blur border-b border-[#8E6FB7]/10">
                <div className="flex gap-2 overflow-x-auto px-4 py-2.5" style={{ scrollbarWidth: 'none' }}>
                    {COURSE_STEPS.map(s => {
                        const on = activeStep === s.id;
                        return (
                            <a key={s.id} href={`#${s.id}`} data-chip={s.id}
                               className={`flex-shrink-0 flex items-center gap-1.5 border rounded-full pl-1.5 pr-3 py-1 transition-colors ${on ? 'bg-[#8E6FB7] border-[#8E6FB7]' : 'bg-white border-[#8E6FB7]/20'}`}>
                                <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center ${on ? 'bg-white text-[#6E5DA3]' : 'bg-[#8E6FB7] text-white'}`}>{s.no}</span>
                                <span className={`text-xs font-semibold whitespace-nowrap ${on ? 'text-white' : ''}`}>{s.title}</span>
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
                                    <span className={`text-[13px] font-semibold leading-tight ${on ? 'text-white' : ''}`}>{s.title}</span>
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
                        <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">무료 학습 코스 · 2호</span>
                        <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">
                            🌍 내 홈페이지를<br className="lg:hidden" /> 인터넷에 올리기
                            {record && (
                                <span className={`align-middle inline-block ml-2 text-xs font-extrabold px-2.5 py-1 rounded-full ${record.passed ? 'bg-green-100 text-green-700' : 'bg-[#F0E8F8] text-[#6E5DA3]'}`}>
                                    {record.passed ? '✅ 완료' : '📖 학습'}
                                </span>
                            )}
                        </h1>
                        <p className="mt-3 text-sm sm:text-base text-[#6E6480] leading-relaxed">
                            1편에서 만든 홈페이지는 <b>내 컴퓨터에서만</b> 보였죠.<br className="hidden sm:block" />
                            이번엔 그 파일을 인터넷에 올려서, <b>친구에게 주소를 보낼 수 있게</b> 만들어요.
                        </p>
                        <p className="mt-2 text-xs text-[#9A8FB0]">준비물: 1편에서 만든 index.html 파일 하나 · 이메일 주소</p>

                        <div className="mt-4 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900 leading-relaxed text-left">
                            📱 <b>이번 편은 폰으로도 거의 다 돼요!</b> 1편과 달리 프로그램을 설치하지 않고,
                            웹사이트 두 곳(깃허브·버셀)에 가입해서 클릭만 하면 됩니다.
                            다만 <b>index.html 파일이 폰에 있어야</b> 올릴 수 있어요 — PC에 있다면 PC로 하시는 게 편합니다.
                        </div>
                        <div className="mt-2.5 bg-[#F5EFFA] border border-[#8E6FB7]/25 rounded-xl px-4 py-3 text-sm text-[#5A4A6E] leading-relaxed text-left">
                            📖 <b>모르는 단어가 나오면 드래그해 보세요.</b> 깃허브, 레포지토리, 배포 같은 단어를
                            손가락이나 마우스로 선택하면 뜻이 말풍선으로 나타나요.
                        </div>
                    </section>

                    {/* 이번 편에서 하는 일 — 전체 그림 */}
                    <section className="bg-white border border-[#8E6FB7]/15 rounded-2xl p-5">
                        <div className="text-sm font-extrabold mb-3">🗺️ 이번 편에서 하는 일 (전체 그림)</div>
                        <div className="space-y-2.5 text-sm text-[#4A4058] leading-relaxed">
                            <div className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 text-lg">💻</span>
                                <div><b>내 컴퓨터의 index.html</b><br /><span className="text-xs text-[#9A8FB0]">지금은 나만 볼 수 있어요</span></div>
                            </div>
                            <div className="pl-2 text-[#C4A9E0]">↓ 깃허브에 올리면</div>
                            <div className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 text-lg">🐙</span>
                                <div><b>깃허브 = 인터넷 창고</b><br /><span className="text-xs text-[#9A8FB0]">파일이 안전하게 보관돼요. 아직 홈페이지는 아니에요</span></div>
                            </div>
                            <div className="pl-2 text-[#C4A9E0]">↓ 버셀이 가져가면</div>
                            <div className="flex items-start gap-2.5">
                                <span className="flex-shrink-0 text-lg">🌍</span>
                                <div><b>진짜 홈페이지 주소</b><br /><span className="text-xs text-[#9A8FB0]">누구나 볼 수 있어요. 폰으로도, 친구도!</span></div>
                            </div>
                        </div>
                        <Tip>
                            <b>왜 두 군데나 가입하나요?</b> 깃허브는 <b>파일을 보관</b>하고, 버셀은 그 파일을 <b>홈페이지로 띄워줍니다.</b>
                            창고와 가게라고 생각하시면 돼요. 둘 다 무료이고, 한 번 연결해두면 그다음부터는 파일만 고치면 자동입니다.
                        </Tip>
                    </section>

                    {/* 1단계 — 깃허브 가입 */}
                    <Step step={COURSE_STEPS[0]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            깃허브(GitHub)는 파일을 보관하는 인터넷 창고예요. 무료이고, 이메일만 있으면 가입됩니다.
                        </p>
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>브라우저에서 <b>github.com</b> 으로 갑니다.</>],
                                [<>오른쪽 위 <b>Sign up</b>(가입) 버튼을 누릅니다.</>],
                                [<>이메일 주소를 넣고 <b>Continue</b>를 누릅니다.</>],
                                [<>비밀번호를 만듭니다. <b>영문·숫자 섞어 15자 이상</b>이면 통과돼요.</>],
                                [<>사용할 이름(<b>Username</b>)을 정합니다. ← 아래 주의사항 꼭 보세요</>],
                                [<>이메일로 온 <b>숫자 8자리</b>를 입력하면 가입 끝!</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Shot src={shots['step1-signup']} alt="깃허브 가입 화면 (github.com → Sign up)" />

                        <Caution>
                            <b>Username(사용자 이름)은 신중하게!</b> 이건 나중에 <b>홈페이지 주소에 그대로 들어갑니다.</b><br />
                            예를 들어 <code className="bg-white px-1 rounded text-xs">ochang-ai</code>로 정하면 주소가
                            <code className="bg-white px-1 rounded text-xs">ochang-ai.github.io</code> 같은 식으로 남아요.<br />
                            <b>영문 소문자·숫자·하이픈(-)</b>만 쓸 수 있고, 한글은 안 됩니다.
                            나중에 바꿀 수는 있지만 번거로우니 처음에 마음에 드는 걸로 정하세요.
                        </Caution>

                        <Tip>
                            가입 중에 <b>"로봇이 아닙니다"</b> 확인(퍼즐 맞추기 같은 것)이 나올 수 있어요. 정상이니 차분히 하시면 됩니다.
                            또 <b>2단계 인증</b>을 켜라고 권하는데, 지금은 <b>나중에(Skip)</b> 하셔도 되고 켜셔도 됩니다.
                        </Tip>

                        <Success>
                            로그인한 상태에서 오른쪽 위에 <b>내 프로필 동그라미</b>가 보이면 가입 완료예요.
                        </Success>

                        <Mobile>
                            <b>폰으로 가능합니다.</b> 크롬·사파리에서 github.com에 접속해 그대로 가입하시면 돼요.
                            이메일 인증 숫자를 받아야 하니, 폰에서 메일도 볼 수 있으면 더 편합니다.
                        </Mobile>
                    </Step>

                    {/* 2단계 — 저장소 만들기 */}
                    <Step step={COURSE_STEPS[1]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            이제 창고 안에 <b>내 홈페이지를 담을 칸</b>을 하나 만듭니다. 이 칸을 <b>저장소(레포지토리)</b>라고 불러요.
                            홈페이지 하나에 저장소 하나입니다.
                        </p>
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>오른쪽 위 <b>＋</b> 버튼을 누르고 <b>New repository</b>(새 저장소)를 선택합니다.</>],
                                [<><b>Repository name</b> 칸에 이름을 넣습니다 — 예: <code className="bg-[#F5EFFA] px-1 rounded text-xs">ochang-ai</code></>],
                                [<><b>Description</b>(설명)은 비워두셔도 됩니다. 넣으면 나중에 알아보기 좋아요.</>],
                                [<><b>Public</b>(공개)을 선택합니다. ← 아래 설명 참고</>],
                                [<><b>Add a README file</b> 체크박스를 <b>켭니다.</b> ← 중요! 아래 설명 참고</>],
                                [<>맨 아래 초록색 <b>Create repository</b> 버튼을 누릅니다.</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Shot src={shots['step2-newrepo']} alt="새 저장소 만들기 화면 (＋ → New repository → 이름·Public·README 체크)" />

                        <Tip>
                            <b>Public(공개)이 맞나요?</b> 네, 맞습니다. 홈페이지는 어차피 누구나 보라고 만드는 거잖아요.
                            Private(비공개)로 하면 <b>버셀 무료 요금제에서 배포가 안 될 수 있습니다.</b> Public으로 하세요.<br />
                            <span className="text-xs">※ 다만 저장소에 올린 <b>모든 파일이 공개</b>되니, 비밀번호나 개인정보가 든 파일은 올리지 마세요.</span>
                        </Tip>

                        <Tip>
                            <b>왜 README를 켜나요?</b> 저장소가 <b>완전히 비어 있으면</b> 다음 단계의 업로드 화면이 조금 다르게 나와요.
                            README 파일을 하나 넣어두면 저장소가 "시작된" 상태가 돼서, 우리가 배울 <b>Add file → Upload files</b> 흐름이
                            깔끔하게 나타납니다. README는 홈페이지에 영향을 주지 않으니 안심하세요.
                        </Tip>

                        <Success>
                            <code className="bg-[#F5EFFA] px-1 rounded text-xs">github.com/내이름/ochang-ai</code> 주소가 열리고,
                            가운데에 <b>README.md</b> 파일 하나가 보이면 성공이에요.
                        </Success>

                        <Mobile>
                            <b>폰으로 가능합니다.</b> 화면이 좁아서 <b>＋</b> 버튼이 안 보이면, 왼쪽 위 <b>☰</b>(줄 세 개)를 눌러보세요.
                            거기에 <b>New repository</b>가 있습니다.
                        </Mobile>
                    </Step>

                    {/* 3단계 — index.html 올리기 */}
                    <Step step={COURSE_STEPS[2]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            드디어 <b>1편에서 만든 index.html</b>을 올립니다. 명령어 같은 건 안 쓰고,
                            <b>파일을 마우스로 끌어다 놓기만</b> 하면 돼요.
                        </p>

                        <Caution>
                            <b>먼저 확인!</b> 올릴 파일 이름이 정확히 <code className="bg-white px-1 rounded text-xs">index.html</code>이어야 합니다.<br />
                            <code className="bg-white px-1 rounded text-xs">index.html.txt</code>나 <code className="bg-white px-1 rounded text-xs">index (1).html</code>처럼
                            돼 있으면 홈페이지가 안 열려요. 1편에서 배운 <b>확장자 보이게 하기</b>로 확인해보세요.
                        </Caution>

                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>방금 만든 저장소 화면에서, 파일 목록 <b>위쪽</b>의 <b>Add file</b> 버튼을 누릅니다.</>],
                                [<>펼쳐진 메뉴에서 <b>Upload files</b>(파일 올리기)를 선택합니다.</>],
                                [<><b>index.html 파일을 마우스로 끌어다</b> 화면 가운데에 놓습니다.<br />
                                    <span className="text-xs text-[#9A8FB0]">끌어다 놓기가 어려우면 <b>choose your files</b> 글씨를 눌러 파일을 골라도 됩니다.</span></>],
                                [<>아래쪽 <b>Commit changes</b> 영역에 메모를 적습니다 — 예: <code className="bg-[#F5EFFA] px-1 rounded text-xs">홈페이지 첫 업로드</code><br />
                                    <span className="text-xs text-[#9A8FB0]">비워두면 자동으로 채워지니 그냥 두셔도 됩니다.</span></>],
                                [<><b>Commit directly to the main branch</b>가 선택돼 있는지 확인합니다(보통 기본 선택).</>],
                                [<>초록색 <b>Commit changes</b> 버튼을 누릅니다.</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Shot src={shots['step3-upload']} alt="파일 업로드 화면 (Add file → Upload files → 드래그앤드롭 → Commit changes)" />

                        <Tip>
                            <b>커밋(Commit)이 뭔가요?</b> "이렇게 바꿨어요"라고 <b>도장을 찍어 저장</b>하는 일이에요.
                            깃허브는 파일을 그냥 덮어쓰지 않고, <b>언제 누가 뭘 바꿨는지</b> 전부 기록해둡니다.
                            그래서 나중에 <b>되돌리기</b>도 돼요. 메모(커밋 메시지)는 그 기록에 남는 한 줄입니다.
                        </Tip>

                        <Success>
                            저장소 파일 목록에 <b>index.html</b>이 <b>README.md</b>와 나란히 보이면 성공이에요!<br />
                            <span className="text-xs">※ index.html을 눌러보면 코드 내용이 보입니다. 아직 홈페이지처럼 보이진 않아요 — 그건 다음 단계에서 합니다.</span>
                        </Success>

                        <Mobile>
                            <b>폰에서도 됩니다.</b> 다만 끌어다 놓기 대신 <b>choose your files</b>를 눌러
                            폰의 <b>파일</b> 앱이나 <b>다운로드</b> 폴더에서 index.html을 고르세요.
                            파일이 PC에만 있다면 이 단계는 PC에서 하시는 게 훨씬 편합니다.
                        </Mobile>
                    </Step>

                    {/* 4단계 — 버셀 가입 */}
                    <Step step={COURSE_STEPS[3]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            파일은 창고에 넣었어요. 이제 그걸 <b>진짜 홈페이지로 띄워줄</b> 버셀(Vercel)에 가입합니다.
                        </p>

                        <Tip>
                            <b>버셀은 따로 가입 안 해도 됩니다!</b> <b>깃허브 계정으로 로그인</b>하면 끝이에요.
                            새 아이디·비밀번호를 만들 필요가 없습니다. 이게 오히려 편하고, 두 서비스가 자동으로 연결됩니다.
                        </Tip>

                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>브라우저에서 <b>vercel.com</b> 으로 갑니다.</>],
                                [<>오른쪽 위 <b>Sign Up</b>(가입)을 누릅니다.</>],
                                [<>용도를 묻는 화면이 나오면 <b>Hobby</b>(취미·개인용)를 선택합니다. ← <b>무료</b>예요</>],
                                [<>이름을 물으면 아무거나 넣고 <b>Continue</b>.</>],
                                [<><b>Continue with GitHub</b> 버튼을 누릅니다. ← 이게 핵심!</>],
                                [<>깃허브가 <b>"버셀이 접근해도 될까요?"</b>라고 물으면 <b>Authorize Vercel</b>(허용)을 누릅니다.</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Shot src={shots['step4-vercel-signup']} alt="버셀 가입 화면 (vercel.com → Sign Up → Hobby → Continue with GitHub)" />

                        <Caution>
                            <b>Hobby(무료)를 꼭 고르세요.</b> Pro는 유료(월 20달러)입니다.
                            우리가 만드는 홈페이지 정도는 <b>무료로 충분</b>하고, 카드 등록도 필요 없어요.
                        </Caution>

                        <Tip>
                            <b>"Authorize"가 무섭게 느껴지나요?</b> 이건 <b>"버셀아, 내 깃허브 창고에서 파일 좀 가져가도 돼"</b>라고
                            허락하는 겁니다. 이 허락이 있어야 버셀이 내 index.html을 읽어서 홈페이지로 띄울 수 있어요.
                            나중에 언제든 깃허브 설정에서 취소할 수 있습니다.
                        </Tip>

                        <Success>
                            버셀 <b>대시보드</b>(내 프로젝트 목록) 화면이 나오면 가입 완료예요. 아직 비어 있는 게 정상입니다.
                        </Success>

                        <Mobile>
                            <b>폰으로 가능합니다.</b> 화면이 좁아 버튼이 작게 보일 수 있지만 전부 동작해요.
                        </Mobile>
                    </Step>

                    {/* 5단계 — 배포 */}
                    <Step step={COURSE_STEPS[4]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            이제 <b>진짜 마지막</b>입니다. 버셀에게 "저 창고에 있는 파일로 홈페이지 만들어줘"라고 시킬 거예요.
                            이걸 <b>배포(Deploy)</b>라고 합니다.
                        </p>
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>버셀 대시보드에서 <b>Add New...</b> 버튼을 누르고 <b>Project</b>를 선택합니다.</>],
                                [<><b>Import Git Repository</b> 목록에서 아까 만든 <b>ochang-ai</b>를 찾습니다.</>],
                                [<>그 옆의 <b>Import</b> 버튼을 누릅니다.</>],
                                [<>설정 화면이 나옵니다. <b>아무것도 건드리지 말고</b> 그냥 두세요. ← 아래 설명</>],
                                [<>파란색 <b>Deploy</b> 버튼을 누릅니다.</>],
                                [<><b>10~30초쯤 기다립니다.</b> 화면에 폭죽이 터지면 성공! 🎉</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Shot src={shots['step5-deploy']} alt="배포 화면 (Add New → Project → Import → Deploy → 축하 폭죽)" />

                        <Tip>
                            <b>설정 화면이 복잡해 보여도 괜찮아요.</b> Framework Preset, Build Command, Output Directory…
                            어려운 말이 많이 보이죠? <b>전부 그냥 두시면 됩니다.</b>
                            우리 홈페이지는 index.html 하나짜리라, 버셀이 알아서 알아봅니다.
                            (Framework Preset이 <b>Other</b>로 돼 있으면 정상이에요.)
                        </Tip>

                        <Tip>
                            <b>레포지토리가 목록에 안 보이나요?</b> <b>Adjust GitHub App Permissions</b> 같은 링크를 눌러
                            저장소 접근을 허용해주세요. 가입할 때 <b>All repositories</b>(모든 저장소)를 고르지 않았으면 이럴 수 있어요.
                        </Tip>

                        <Success>
                            폭죽과 함께 <b>홈페이지 미리보기 화면</b>이 뜨고, 그 위에 <b>주소</b>가 보입니다 —
                            <code className="bg-[#F5EFFA] px-1 rounded text-xs">ochang-ai.vercel.app</code> 같은 모양이에요.<br />
                            <b>그 주소를 눌러보세요. 내 홈페이지가 진짜 인터넷에 떴습니다!</b> 🎉
                        </Success>

                        <div className="bg-gradient-to-r from-[#FF6B9D]/10 to-[#8E6FB7]/10 border border-[#FF6B9D]/30 rounded-2xl p-4">
                            <div className="font-extrabold text-sm">🎉 축하합니다! 이제 이렇게 해보세요</div>
                            <div className="mt-2 space-y-1.5 text-sm text-[#4A4058]">
                                <div>📱 <b>폰으로 그 주소를 열어보세요.</b> 내 홈페이지가 폰에서도 보입니다.</div>
                                <div>💌 <b>가족·친구에게 주소를 보내보세요.</b> 누구나 볼 수 있어요.</div>
                                <div>🔒 <b>주소 앞의 자물쇠를 보세요.</b> 버셀이 보안(https)까지 무료로 해줬어요.</div>
                            </div>
                        </div>

                        <Mobile>
                            <b>폰으로 가능합니다.</b> 다만 설정 화면의 글씨가 작으니, 확대해서 <b>Deploy</b> 버튼을 정확히 누르세요.
                        </Mobile>
                    </Step>

                    {/* 6단계 — 수정 후 자동 재배포 */}
                    <Step step={COURSE_STEPS[5]}>
                        <p className="text-sm leading-relaxed text-[#4A4058]">
                            여기가 <b>진짜 마법</b>입니다. 이제부터는 <b>깃허브의 파일만 고치면</b>,
                            버셀이 알아서 홈페이지를 다시 만들어줘요. 배포를 다시 할 필요가 없습니다.
                        </p>
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-xl divide-y divide-[#8E6FB7]/10">
                            {[
                                [<>깃허브 저장소에서 <b>index.html</b>을 클릭합니다.</>],
                                [<>오른쪽 위 <b>연필 모양(✏️)</b> 아이콘을 누릅니다. ← 편집 모드</>],
                                [<>글씨를 아무거나 조금 고쳐보세요 — 예: 제목을 <b>"오창AI 연구회에 오신 걸 환영합니다"</b>로</>],
                                [<>오른쪽 위 <b>Commit changes...</b> 버튼을 누릅니다.</>],
                                [<>메모를 적고 초록색 <b>Commit changes</b>를 누릅니다.</>],
                                [<><b>30초쯤 기다렸다가</b> 내 홈페이지 주소를 새로고침(F5) 해보세요.</>],
                            ].map((t, i) => (
                                <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#F0E8F8] text-[#6E5DA3] text-[10px] font-extrabold flex items-center justify-center mt-0.5">{i + 1}</span>
                                    <span className="flex-1 text-[#4A4058] leading-relaxed">{t}</span>
                                </div>
                            ))}
                        </div>

                        <Success>
                            <b>고친 내용이 인터넷 홈페이지에 그대로 반영돼 있으면 성공!</b><br />
                            버셀이 깃허브를 계속 지켜보고 있다가, 파일이 바뀌면 <b>자동으로 다시 배포</b>한 거예요.
                        </Success>

                        <Tip>
                            <b>이제 이런 흐름이 완성됐어요:</b><br />
                            내 컴퓨터에서 고치기 → 깃허브에 올리기 → <b>(자동)</b> 홈페이지 바뀜<br />
                            <span className="text-xs">앞으로 홈페이지를 크게 고칠 땐, 1편에서 배운 대로 <b>내 컴퓨터에서 Claude Code로 고쳐서 localhost로 확인</b>하고,
                            마음에 들면 <b>3단계 방법으로 깃허브에 다시 올리면</b> 됩니다. 같은 이름(index.html)으로 올리면 덮어써져요.</span>
                        </Tip>

                        <Mobile>
                            <b>폰으로 가능합니다.</b> 깃허브 웹에서 연필 아이콘으로 바로 고칠 수 있어요.
                            간단한 글자 수정 정도는 폰으로도 충분합니다.
                        </Mobile>
                    </Step>

                    {/* 🆘 FAQ */}
                    <section id="faq" className="scroll-mt-20">
                        <h2 className="text-lg sm:text-xl font-extrabold mb-4">🆘 막혔을 때</h2>
                        <div className="space-y-2">
                            {FAQS.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}
                        </div>
                    </section>

                    {/* 📝 학습평가 — 문제 제작 후 연결 */}
                    <section id="quiz" className="scroll-mt-20">
                        <h2 className="text-lg sm:text-xl font-extrabold mb-4">📝 학습평가</h2>
                        <div className="bg-white border border-[#8E6FB7]/15 rounded-2xl p-6 text-center">
                            <div className="text-3xl mb-2">🛠️</div>
                            <p className="text-sm text-[#6E6480] leading-relaxed">
                                2편 학습평가는 <b>준비 중</b>이에요.<br />조금만 기다려 주세요!
                            </p>
                        </div>
                    </section>

                    {refCode && (
                        <section>
                            <div className="bg-gradient-to-r from-[#FF6B9D]/10 to-[#8E6FB7]/10 border border-[#FF6B9D]/30 rounded-2xl p-4">
                                <div className="font-extrabold text-sm">📣 이 강의를 친구에게 선물하세요</div>
                                <p className="text-xs text-[#6E6480] mt-1 leading-relaxed">
                                    친구가 내 링크로 가입하면 <b>친구도 나도 +1,000P</b>!
                                </p>
                                <div className="mt-2.5 bg-white border border-[#8E6FB7]/20 rounded-lg px-3 py-2">
                                    <code className="text-[11px] text-[#6E5DA3] break-all">
                                        {`${window.location.origin}/learn/homepage?ref=${encodeURIComponent(refCode)}`}
                                    </code>
                                </div>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
};

// 🆘 2편 FAQ — 깃허브·버셀에서 왕초보가 실제로 막히는 지점
const FAQS: Array<[string, string]> = [
    ['깃허브 가입할 때 Username을 뭘로 해야 할지 모르겠어요', '영문 소문자와 숫자, 하이픈(-)만 쓸 수 있어요. 이름·모임 이름을 영어로 쓰거나(ochang-ai), 평소 쓰는 아이디를 쓰셔도 됩니다. 이미 누가 쓰고 있으면 빨간 글씨로 알려주니 다른 걸 넣으면 돼요. 나중에 바꿀 수 있지만 주소가 바뀌니 처음에 정하는 게 좋아요.'],
    ['Public으로 하면 내 코드를 아무나 볼 수 있는 거 아닌가요?', '맞아요, 볼 수 있습니다. 그런데 홈페이지 HTML은 어차피 누구나 볼 수 있는 거예요(브라우저에서 "소스 보기"만 해도 나옵니다). 문제가 되는 건 비밀번호나 개인정보가 든 파일인데, 우리 index.html에는 그런 게 없으니 안심하세요. 반대로 Private으로 하면 버셀 무료 요금제에서 배포가 안 될 수 있습니다.'],
    ['버셀에서 내 저장소가 목록에 안 보여요', '"Adjust GitHub App Permissions" 또는 "Configure GitHub App" 링크를 눌러서 저장소 접근을 허용해주세요. 가입할 때 "Only select repositories"(선택한 저장소만)를 고르셨으면, 거기에 우리 저장소를 추가해야 보입니다. "All repositories"(모두)를 고르면 앞으로도 편해요.'],
    ['배포는 성공했다는데 홈페이지가 하얗게 나와요', '파일 이름이 index.html이 맞는지 깃허브에서 확인하세요. index.html.txt처럼 뒤에 뭐가 붙어 있거나, Index.html처럼 대문자로 시작하면 안 열립니다. 깃허브 저장소에서 파일 이름을 직접 눈으로 확인해보세요.'],
    ['파일을 고쳤는데 홈페이지가 안 바뀌어요', '① 30초쯤 기다렸다가 새로고침(F5)해보세요 — 배포에 시간이 좀 걸립니다. ② 그래도 안 되면 Ctrl+Shift+R(맥은 Cmd+Shift+R)로 강력 새로고침 해보세요 — 브라우저가 옛날 화면을 기억하고 있을 수 있어요. ③ 버셀 대시보드의 Deployments 탭에서 최근 배포가 "Ready"인지 확인하세요.'],
    ['커밋(Commit)이라는 말이 계속 나오는데 뭔가요?', '"이렇게 바꿨어요"라고 도장 찍어 저장하는 일이에요. 깃허브는 파일을 그냥 덮어쓰지 않고 변경 기록을 전부 남겨서, 나중에 되돌릴 수 있게 해줍니다. 파일을 올리거나 고칠 때마다 짧은 메모를 남기는 게 커밋이에요. 메모는 나중에 "그때 뭘 바꿨더라?" 할 때 도움이 됩니다.'],
    ['index.html 말고 사진도 같이 올리고 싶어요', '같은 방법으로 올리면 돼요. Add file → Upload files에서 사진 파일들을 함께 끌어다 놓으세요. 다만 HTML 안에서 사진을 부를 때 파일 이름이 정확히 맞아야 합니다(대소문자까지!). 사진이 안 보이면 이름을 다시 확인해보세요.'],
    ['주소를 내 마음대로 바꾸고 싶어요 (ochang-ai.vercel.app이 마음에 안 들어요)', '버셀 프로젝트 → Settings → Domains에서 앞부분을 바꿀 수 있어요(다른 사람이 안 쓰는 이름이면). 아예 ochang-ai.com 같은 진짜 주소를 쓰고 싶으면 도메인을 사서(연 1~2만원 정도) 연결하면 됩니다. 무료 주소로도 충분히 잘 돌아가니 급하지 않아요.'],
    ['실수로 잘못 올렸어요. 지울 수 있나요?', '네. 깃허브에서 파일을 클릭 → 오른쪽 위 휴지통 아이콘 → Commit changes로 지울 수 있어요. 저장소 자체를 지우려면 Settings 맨 아래 "Danger Zone"에서 Delete this repository를 누르면 됩니다(저장소 이름을 다시 입력해야 해요). 버셀 프로젝트도 Settings 맨 아래에서 지울 수 있습니다.'],
    ['1편에서 만든 index.html을 어디에 뒀는지 못 찾겠어요', '보통 다운로드 폴더나, 1편에서 만든 my-homepage 폴더 안에 있어요. 파일 탐색기(⊞윈도우 키+E)를 열고 오른쪽 위 검색창에 index.html을 넣어보세요. 정 못 찾으면 1편 2단계로 돌아가 AI에게 다시 만들어달라고 하셔도 됩니다 — 몇 분이면 돼요.'],
];
