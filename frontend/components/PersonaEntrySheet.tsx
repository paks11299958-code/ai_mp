import React from 'react';
import { MpnFeatureIcon } from './MainPageNew';
import { SajuEntry } from './persona/SajuEntry';
import { SeoaNewsDeskEntry } from './persona/SeoaNewsDeskEntry';

// 페르소나 진입 시트 — 메인/채팅 어느 화면에서든 **화면 전환 없이** 덮어 띄운다.
//
// 왜 App.tsx에서 분리했나(2026-07-30 사장 지시 "채팅 페이지로 전환되는 게 불만"):
//   기존엔 이 JSX가 chat 화면 return 안에만 있어서, 소개를 띄우려면 goTo('chat')으로
//   화면을 통째로 갈아치우는 게 **선행돼야 했다**. 그래서 생긴 증상이 세 가지였다.
//     ① 모달 뒤에 채팅이 이미 렌더돼 배경을 누르면 "닫기"가 아니라 채팅 진입처럼 보임
//        → 07-30에 배경 클릭을 막는 땜질을 했다.
//     ② ✕가 goTo('main')으로 메인을 다시 그려 보던 스크롤·탭이 날아감.
//     ③ 카드가 320px이라 모바일에서 배경이 탭 면적 대부분 → 오터치.
//   컴포넌트로 빼서 main·chat 양쪽 return이 같은 걸 렌더하면 전환 자체가 필요 없어진다.
//   ①②는 원인이 사라지므로 땜질도 함께 걷어낸다.
//
// 레이아웃(C안): 모바일=전체 시트, 데스크톱=넉넉한 중앙 카드.
//   데스크톱까지 전체화면으로 덮으면 과하다 — 화면이 넓어 카드로도 충분히 집중된다.
//   근거: 모바일에 데스크톱식 중앙 박스를 쓰지 말 것(LogRocket), 독립된 과업은
//   전체화면(Medium). "이 사람과 대화를 시작할지"는 곁들임이 아니라 그 자체가 목적이다.

/** 한글 받침에 따라 '과'/'와' — "도결 선생과 대화하기" / "유나와 대화하기". */
export const josaGwaWa = (word: string): string => {
    const ch = word?.trim().slice(-1) ?? '';
    if (ch < '가' || ch > '힣') return '와';
    return (ch.charCodeAt(0) - 0xAC00) % 28 !== 0 ? '과' : '와';
};

/** 은/는 조사. 받침이면 '은'(아린은), 아니면 '는'(유나는).
 *  ★하드코딩 금지: 이름을 어드민이 자유 입력하므로 "유나은"처럼 어색해진다. */
export const josaEunNeun = (word: string): string => {
    const ch = word?.trim().slice(-1) ?? '';
    if (ch < '가' || ch > '힣') return '는';
    return (ch.charCodeAt(0) - 0xAC00) % 28 !== 0 ? '은' : '는';
};

export interface PersonaEntryGuide {
    title: string;
    desc: string;
    features?: { key: string; name: string; icon: string; accent: string; bg: string }[];
    usesBirthInfo?: boolean;
    imageUrl?: string;
    personaName?: string;
    /** 기능 링크(?f=)로 왔을 때만 채워진다 — CTA가 채팅이 아니라 그 기능을 연다. */
    autoRunFeatureKey?: string;
}

interface Props {
    guide: PersonaEntryGuide;
    /** ✕ / 배경 클릭 — 레이어만 닫는다(화면 전환 없음). */
    onClose: () => void;
    /** CTA. featureKey가 있으면 그 기능을, 없으면 채팅으로. 화면 전환은 여기서 한 번만. */
    onStart: (featureKey?: string) => void;
    /** 기능칩 클릭 — 그 기능을 실행한다. */
    onFeature: (featureKey: string) => void;
}

export const PersonaEntrySheet: React.FC<Props> = ({ guide, onClose, onStart, onFeature }) => {
    // ★도결(道潔) 선생만 사주 랜딩으로 갈아 끼운다(2026-08-26 사장 지시).
    //   사주는 분위기 자체가 상품인데 채팅창이 먼저 보여 일반 챗봇과 구분이 안 됐다.
    //   분기를 **여기서** 하는 이유: App.tsx를 고치면 전 화면 백지 사고가 재발한다
    //   (2026-07-29 useCallback 의존성 TDZ — tsc·안전검사 둘 다 통과하고 실렌더에서만 터졌다).
    //   ★도결이 아니면 아래 기존 JSX가 **한 줄도 바뀌지 않은 채** 그대로 나간다.
    //   이 컴포넌트에는 훅이 없으므로 이 조기 return이 훅 순서를 깨지 않는다.
    if (guide.title?.startsWith('도결')) {
        return <SajuEntry guide={guide} onClose={onClose} onStart={onStart} onFeature={onFeature} />;
    }
    // ★서아도 같은 규약으로 뉴스데스크 랜딩으로 갈아 끼운다(2026-08-27 사장 지시).
    //   판별 키는 도결과 **똑같이** guide.title 접두사다 — 페르소나 카드로 들어오면
    //   title이 persona.name('서아')이다(App.tsx showPersonaGuide).
    //   ★임의 문자열 매칭이 아니라 위 도결 분기와 같은 규약을 그대로 쓴다.
    if (guide.title?.startsWith('서아')) {
        return <SeoaNewsDeskEntry guide={guide} onClose={onClose} onStart={onStart} onFeature={onFeature} />;
    }

    const who = guide.personaName || guide.title;
    // 문구는 실제 동작과 일치시킨다(2026-07-30): 기능 링크면 보드를 여니 "시작하기",
    // 페르소나 링크·메인 카드면 채팅으로 가니 "대화하기"로 목적을 명시한다.
    const verb = guide.autoRunFeatureKey ? '시작하기' : '대화하기';

    return (
        // ★배경 클릭으로 닫는다 — 이제 안전하다. 뒤에 채팅이 떠 있지 않고 원래 보던
        //   화면이 그대로 있으므로, 배경 클릭은 "채팅 진입"이 아니라 진짜 "닫기"다.
        //   (07-30에 막았던 건 뒤 채팅이 드러나는 문제였고, 그 원인이 사라졌다.)
        <div
            className="fixed inset-0 z-[85] flex sm:items-center sm:justify-center sm:p-4"
            style={{ background: 'rgba(20,12,30,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${guide.title} 소개`}
                className="relative w-full flex flex-col overflow-hidden
                           rounded-none sm:rounded-[28px] sm:max-w-[400px] sm:max-h-[calc(100dvh-32px)]"
                style={{
                    background: '#FCFAFF',
                    boxShadow: '0 30px 70px -20px rgba(80,50,110,0.45)',
                }}
            >
                {/* 상단 광원 */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute"
                    style={{
                        top: -80, left: '50%', transform: 'translateX(-50%)',
                        width: 300, height: 300, borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.32) 0%, rgba(236,72,153,0.16) 55%, transparent 72%)',
                        filter: 'blur(30px)',
                    }}
                />

                {/* 닫기 — 전체화면일수록 출구가 또렷해야 한다(독립 화면처럼 보이므로). */}
                <button
                    onClick={onClose}
                    aria-label="닫기"
                    className="absolute z-10 flex items-center justify-center rounded-full transition-all active:scale-90"
                    style={{
                        top: 'max(14px, env(safe-area-inset-top))', right: 14,
                        width: 36, height: 36,
                        background: 'rgba(255,255,255,0.82)',
                        border: '1px solid rgba(139,92,246,0.18)',
                        boxShadow: '0 4px 12px -4px rgba(80,50,110,0.3)',
                        backdropFilter: 'blur(8px)',
                        color: '#8B7C99', fontSize: 18, lineHeight: 1,
                    }}
                >
                    ✕
                </button>

                {/* 본문 — 넓어진 만큼 요소를 늘리지 않고 여백으로 쓴다(C안 원칙). */}
                <div className="relative flex-1 min-h-0 overflow-y-auto">
                    <div className="flex flex-col items-center text-center px-7 pb-7"
                         style={{ paddingTop: 'max(44px, calc(env(safe-area-inset-top) + 30px))' }}>

                        {/* ① 얼굴 — 크게. 감정 연결이 목적인 서비스다(2026-07-28 사장 지시). */}
                        {guide.imageUrl && (
                            <div className="rounded-full overflow-hidden shrink-0"
                                 style={{
                                     width: 128, height: 128,
                                     border: '3px solid rgba(255,255,255,0.9)',
                                     boxShadow: '0 14px 32px -8px rgba(139,92,246,0.45)',
                                 }}>
                                <img src={guide.imageUrl} alt={guide.title}
                                     className="w-full h-full object-cover" />
                            </div>
                        )}

                        <h3 className="mt-4 text-[22px] font-extrabold tracking-tight" style={{ color: '#2D2017' }}>
                            {guide.title}
                        </h3>

                        {/* ② 소개 — 읽기 좋은 폭으로 묶는다(넓은 화면에서 한 줄이 길어지면 안 읽힌다). */}
                        <p className="mt-3 text-[13.5px] leading-[1.7] max-w-[34ch]"
                           style={{ color: '#6B5F78', whiteSpace: 'pre-line' }}>
                            {guide.desc}
                        </p>

                        {/* ③ 대화 안내 — 이 서비스의 본질(2026-07-30).
                            ★기능 링크(?f=)에선 숨긴다: 그 경로의 CTA는 채팅이 아니라 기능 보드를
                              열므로, 대화를 권하면 문구와 동작이 어긋난다. */}
                        {!guide.autoRunFeatureKey && (
                            <div className="mt-5 w-full max-w-[340px] px-4 py-3.5 rounded-2xl text-left"
                                 style={{
                                     background: 'linear-gradient(135deg, rgba(139,92,246,0.09) 0%, rgba(236,72,153,0.07) 100%)',
                                     border: '1px solid rgba(139,92,246,0.16)',
                                 }}>
                                <p className="text-[12.5px] font-bold leading-snug" style={{ color: '#6D4AA8' }}>
                                    💬 무슨 얘기든 괜찮아요
                                </p>
                                <p className="mt-1.5 text-[11.5px] leading-[1.6]" style={{ color: '#8B7C99' }}>
                                    {guide.title}{josaEunNeun(guide.title)} 그냥 들어주는 것부터 시작해요.
                                    고민도, 오늘 하루 이야기도 편하게 꺼내보세요.
                                </p>
                            </div>
                        )}

                        {/* ④ 기능 — 곁가지로 낮춘다(2026-07-30). 기능칩이 메뉴판처럼 보이면
                            정작 핵심인 자유 대화가 "기능을 안 고르면 가는 곳"으로 읽힌다. */}
                        {guide.features && guide.features.length > 0 && (
                            <div className="mt-5 w-full max-w-[340px]">
                                <p className="text-[10.5px] font-bold tracking-wide mb-2.5 text-left"
                                   style={{ color: '#A99BB5' }}>
                                    이런 것도 해드려요
                                </p>
                                <div className="grid gap-2"
                                     style={{ gridTemplateColumns: `repeat(${Math.min(guide.features.length, 3)}, minmax(0, 1fr))` }}>
                                    {guide.features.map(f => (
                                        <button
                                            key={f.key}
                                            onClick={() => onFeature(f.key)}
                                            className="flex flex-col items-center gap-1.5 px-1.5 py-3 rounded-2xl transition-all active:scale-95"
                                            style={{
                                                background: 'rgba(255,255,255,0.72)',
                                                border: '1px solid rgba(255,255,255,0.9)',
                                                boxShadow: '0 6px 18px -8px rgba(80,50,110,0.28)',
                                                backdropFilter: 'blur(8px)',
                                            }}
                                        >
                                            <MpnFeatureIcon kind={f.icon} size={26} color={f.accent} bg={f.bg} />
                                            <span className="text-[11px] font-semibold leading-tight text-center"
                                                  style={{ color: '#5B3F82' }}>
                                                {f.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {guide.usesBirthInfo && (
                            <p className="mt-3.5 w-full max-w-[340px] text-[11.5px] leading-relaxed text-left"
                               style={{ color: '#A99BB5' }}>
                                🏮 <b style={{ color: '#8E6FB7' }}>명부</b>(이름·생년월일)를 적어두시면 더 정확하게 풀어드려요.
                            </p>
                        )}
                    </div>
                </div>

                {/* ⑤ CTA — 하단 고정. 전체화면에선 스크롤 끝까지 내려야 버튼이 나오면 안 된다.
                    화면 전환은 **여기서 딱 한 번** 일어난다(사용자가 의도한 순간이라 납득된다). */}
                <div className="relative shrink-0 px-7 pt-3"
                     style={{
                         paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
                         background: 'linear-gradient(to top, #FCFAFF 72%, rgba(252,250,255,0))',
                     }}>
                    <button
                        onClick={() => onStart(guide.autoRunFeatureKey)}
                        className="w-full py-3.5 rounded-full text-[15px] font-bold text-white transition-transform active:scale-[0.98] sm:max-w-[340px] sm:mx-auto sm:block"
                        style={{
                            background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                            border: 'none',
                            boxShadow: '0 10px 24px -10px rgba(139,92,246,0.75)',
                        }}
                    >
                        {`${who}${josaGwaWa(who)} ${verb}`}
                    </button>
                </div>
            </div>
        </div>
    );
};
