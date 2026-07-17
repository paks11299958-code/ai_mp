import React, { useEffect, useState } from 'react';
import { useLearnAuth, goLoginTo } from './LearnKit';

// 📚 학습자료 시리즈 목록 (/learn) — 편(1편·2편)을 골라 들어가는 첫 화면.
// 세로 카드 + 연결선 = "순서가 있다"를 설명 없이 보여주는 배치(사장 확정).
// 잠긴 편은 회색조 + 자물쇠, 클릭하면 모달이 아니라 카드 자리에서 안내가 펼쳐진다
// (모달은 닫으면 끝 → 카드에 붙어 있어야 '1편 하러 가기'로 행동이 이어짐).
// 정본 메모리=[[project_learn_course]].

type Course = {
    key: string;            // 서버 COURSE_KEYS와 동일
    href: string;
    no: string;
    emoji: string;
    title: string;
    desc: string;
    meta: string;
    requires?: string;      // 이 코스를 들으려면 먼저 합격해야 하는 코스 key
};

const COURSES: Course[] = [
    {
        key: 'homepage',
        href: '/learn/homepage',
        no: '1편',
        emoji: '🏠',
        title: 'AI로 홈페이지 만들어 내 컴퓨터에서 띄워보기',
        desc: 'AI에게 부탁해 디자인을 만들고, 내 컴퓨터(로컬호스트)에서 직접 띄워봐요.',
        meta: '5단계 · 영상 4:48',
    },
    {
        key: 'homepage2',
        href: '/learn/homepage/2',
        no: '2편',
        emoji: '🌍',
        title: '내 홈페이지를 인터넷에 올리기',
        desc: '깃허브에 파일을 올리고 버셀로 배포해서, 친구에게 보낼 수 있는 진짜 주소를 만들어요.',
        meta: '6단계 · 깃허브 + 버셀',
        requires: 'homepage',
    },
];

export const LearnIndex: React.FC = () => {
    const auth = useLearnAuth();

    // 각 코스의 합격 기록 — 배지("완료")와 잠금 해제의 근거. 서버 기록이 정본.
    const [records, setRecords] = useState<Record<string, boolean>>({});
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (auth !== 'ok') { if (auth === 'guest') setLoaded(true); return; }
        Promise.all(COURSES.map(c =>
            fetch(`/api/learn/quiz-record?course=${c.key}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            })
                .then(r => (r.ok ? r.json() : null))
                .then(d => [c.key, !!d?.passed] as const)
                .catch(() => [c.key, !!localStorage.getItem(`learnQuizPass.${c.key}`)] as const)
        )).then(pairs => {
            setRecords(Object.fromEntries(pairs));
            setLoaded(true);
        });
    }, [auth]);

    // 잠긴 카드를 눌렀을 때 펼쳐지는 안내(카드 자리에서)
    const [openHint, setOpenHint] = useState<string | null>(null);

    const isLocked = (c: Course) => !!c.requires && !records[c.requires];

    return (
        <div className="min-h-screen bg-[#FAF8FC] text-[#2D2438]">
            <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-[#8E6FB7]/15">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <button onClick={() => { window.location.href = '/'; }} className="flex items-center gap-1.5 text-sm text-[#6E5DA3] font-semibold">
                        ← AI 스퀘어
                    </button>
                    <span className="text-sm font-extrabold">📚 박하진의 학습자료</span>
                    <span className="w-16" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
                <section className="text-center mb-8">
                    <span className="inline-block bg-[#FF6B9D]/10 text-[#D85C95] text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                        무료 · 회원 전용
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold leading-snug">🏠 홈페이지 만들기</h1>
                    <p className="mt-3 text-sm text-[#6E6480] leading-relaxed">
                        코딩을 몰라도 괜찮아요. AI와 함께 홈페이지를 만들고,<br className="hidden sm:block" />
                        인터넷에 올려서 친구에게 주소를 보내는 것까지 배웁니다.
                    </p>
                    <p className="mt-2 text-xs text-[#9A8FB0]">순서대로 들으세요 — 앞 편을 마쳐야 다음 편이 열려요.</p>
                </section>

                <div className="space-y-0">
                    {COURSES.map((c, i) => {
                        const locked = loaded && isLocked(c);
                        const done = !!records[c.key];
                        const hinted = openHint === c.key;

                        return (
                            <React.Fragment key={c.key}>
                                <div
                                    onClick={() => {
                                        if (auth === 'guest') { goLoginTo(c.href); return; }
                                        if (locked) { setOpenHint(hinted ? null : c.key); return; }
                                        window.location.href = c.href;
                                    }}
                                    className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                                        locked
                                            ? 'bg-[#F4F2F7] border-[#8E6FB7]/10 hover:border-[#8E6FB7]/25'
                                            : 'bg-white border-[#8E6FB7]/15 hover:border-[#8E6FB7]/40 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className={`flex-shrink-0 text-2xl ${locked ? 'grayscale opacity-40' : ''}`}>{c.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-extrabold px-2 py-0.5 rounded-md ${locked ? 'bg-[#E8E5EC] text-[#9A8FB0]' : 'bg-[#F0E8F8] text-[#6E5DA3]'}`}>
                                                    {c.no}
                                                </span>
                                                {loaded && (
                                                    locked ? (
                                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#E8E5EC] text-[#9A8FB0]">🔒 잠김</span>
                                                    ) : done ? (
                                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ 완료</span>
                                                    ) : (
                                                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#F0E8F8] text-[#6E5DA3]">📖 학습하기</span>
                                                    )
                                                )}
                                            </div>
                                            <h2 className={`mt-1.5 text-base font-extrabold leading-snug ${locked ? 'text-[#9A8FB0]' : ''}`}>
                                                {c.title}
                                            </h2>
                                            <p className={`mt-1 text-sm leading-relaxed ${locked ? 'text-[#B0A8BE]' : 'text-[#6E6480]'}`}>
                                                {c.desc}
                                            </p>
                                            <p className={`mt-2 text-xs ${locked ? 'text-[#B0A8BE]' : 'text-[#9A8FB0]'}`}>{c.meta}</p>
                                        </div>
                                        <span className={`flex-shrink-0 text-lg ${locked ? 'text-[#C4BED0]' : 'text-[#C4A9E0]'}`}>
                                            {locked ? '🔒' : '→'}
                                        </span>
                                    </div>

                                    {/* 🔒 잠김 안내 — 카드 자리에서 펼쳐진다(모달 아님) */}
                                    {hinted && locked && (
                                        <div className="mt-4 pt-4 border-t border-[#8E6FB7]/15" onClick={e => e.stopPropagation()}>
                                            <div className="text-sm font-extrabold text-[#2D2438] mb-1.5">
                                                🔒 1편을 마치면 열려요
                                            </div>
                                            <p className="text-xs text-[#6E6480] leading-relaxed">
                                                이 편은 <b>1편에서 만든 index.html</b>이 있어야 따라올 수 있어요.
                                                1편을 보시고 맨 아래 <b>📝 학습평가</b>를 끝까지 푸시면 바로 열립니다.
                                                <b> 틀려도 괜찮아요</b> — 해설을 보고 다시 풀면 되고, 끝까지 풀면 누구나 통과합니다.
                                            </p>
                                            <button
                                                onClick={() => { window.location.href = '/learn/homepage'; }}
                                                className="mt-3 w-full bg-[#8E6FB7] hover:bg-[#7A5FA0] text-white text-sm font-extrabold py-2.5 rounded-xl"
                                            >
                                                1편 학습하러 가기 →
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 카드 사이 연결선 — "순서가 있다"를 보여준다 */}
                                {i < COURSES.length - 1 && (
                                    <div className="flex justify-center py-1.5">
                                        <div className="w-0.5 h-5 rounded bg-[#8E6FB7]/20" />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                <p className="mt-8 text-center text-xs text-[#9A8FB0] leading-relaxed">
                    강의는 계속 추가됩니다. 궁금한 점은 <b>박하진</b>에게 물어보세요!
                </p>
            </main>
        </div>
    );
};
