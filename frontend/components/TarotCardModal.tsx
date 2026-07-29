import React, { useMemo, useState } from 'react';
import { playSound, isSoundMuted, setSoundMuted } from '../utils/sound';

// 🔮 타로 카드 뽑기 모달 (유나 전용 퀵메뉴, 2026-07-06)
// 흐름: 질문 떠올리기 → 셔플 애니메이션 → 부채꼴에서 3장(과거/현재/미래) 연속 선택(대기 없음)
// → 3장 공개 후 "종합 리딩 듣기"로 한 번만 채팅 전송 → 유나가 지식창고 기반으로 종합 해석(채팅 스트림).
// 해석을 읽는 동안 모달은 플로팅 칩으로 최소화(상태 유지 = 컴포넌트 언마운트 금지).
// (2026-07-21: 카드별 개별 해석 요청을 없애 AI 호출 4회→1회로 단순화 — 사장 지시)

interface TarotCardModalProps {
    onSend: (message: string) => void;   // 채팅 자동 전송 (App이 스트림 경로로 처리)
    onClose: () => void;
    isTyping: boolean;                    // 유나 응답 중엔 다음 뽑기 잠금
    onMakeReport?: (drawn: DrawnCard[]) => void;  // 종합까지 끝난 뒤 감정서 생성(App이 해석 수집·저장)
    mode?: 'full' | 'daily';              // daily=오늘의 카드 1장(같은 셔플·플립 의식, 보고서 없음)
}

// 메이저 아르카나 22장 (이름·로마숫자·상징)
const MAJOR_ARCANA: { no: string; kr: string; en: string; sym: string }[] = [
    { no: '0', kr: '바보', en: 'The Fool', sym: '🃏' },
    { no: 'I', kr: '마법사', en: 'The Magician', sym: '🪄' },
    { no: 'II', kr: '여사제', en: 'The High Priestess', sym: '🌙' },
    { no: 'III', kr: '여황제', en: 'The Empress', sym: '🌾' },
    { no: 'IV', kr: '황제', en: 'The Emperor', sym: '🏛️' },
    { no: 'V', kr: '교황', en: 'The Hierophant', sym: '🗝️' },
    { no: 'VI', kr: '연인', en: 'The Lovers', sym: '💞' },
    { no: 'VII', kr: '전차', en: 'The Chariot', sym: '🏇' },
    { no: 'VIII', kr: '힘', en: 'Strength', sym: '🦁' },
    { no: 'IX', kr: '은둔자', en: 'The Hermit', sym: '🏮' },
    { no: 'X', kr: '운명의 수레바퀴', en: 'Wheel of Fortune', sym: '🎡' },
    { no: 'XI', kr: '정의', en: 'Justice', sym: '⚖️' },
    { no: 'XII', kr: '매달린 사람', en: 'The Hanged Man', sym: '🙃' },
    { no: 'XIII', kr: '죽음', en: 'Death', sym: '🦋' },
    { no: 'XIV', kr: '절제', en: 'Temperance', sym: '🏺' },
    { no: 'XV', kr: '악마', en: 'The Devil', sym: '⛓️' },
    { no: 'XVI', kr: '탑', en: 'The Tower', sym: '🌩️' },
    { no: 'XVII', kr: '별', en: 'The Star', sym: '⭐' },
    { no: 'XVIII', kr: '달', en: 'The Moon', sym: '🌕' },
    { no: 'XIX', kr: '태양', en: 'The Sun', sym: '☀️' },
    { no: 'XX', kr: '심판', en: 'Judgement', sym: '🎺' },
    { no: 'XXI', kr: '세계', en: 'The World', sym: '🌍' },
];

const POSITIONS = ['과거', '현재', '미래'] as const;

interface DrawnCard { card: typeof MAJOR_ARCANA[number]; reversed: boolean; position: string }

function shuffled<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

type Stage = 'intro' | 'shuffling' | 'spread' | 'finished' | 'report';

export const TarotCardModal: React.FC<TarotCardModalProps> = ({ onSend, onClose, isTyping, onMakeReport, mode = 'full' }) => {
    // 뽑을 자리: 풀 리딩=과거/현재/미래 3장, 오늘의 카드=오늘 1장
    const positions: readonly string[] = mode === 'daily' ? ['오늘'] : POSITIONS;
    const [stage, setStage] = useState<Stage>('intro');
    const [minimized, setMinimized] = useState(false);
    // 덱은 셔플 시점에 확정(뽑는 위치 = 그 카드). 역방향은 카드별 30%.
    const [deck, setDeck] = useState<{ card: typeof MAJOR_ARCANA[number]; reversed: boolean }[]>([]);
    const [drawn, setDrawn] = useState<DrawnCard[]>([]);
    const [usedIdx, setUsedIdx] = useState<Set<number>>(new Set());
    // 효과음 음소거(2026-07-29 신설) — 기본 켬, 끄면 기기에 기억(utils/sound.ts).
    const [muted, setMuted] = useState<boolean>(() => isSoundMuted());

    const doShuffle = () => {
        // ★소리는 여기서 시작한다 — "카드 섞기" 클릭이 이 모달의 첫 사용자 조작이라
        //   모바일 자동재생 차단(사용자 제스처 전 재생 금지)에 걸리지 않는다.
        playSound('tarotShuffle');
        setStage('shuffling');
        setDeck(shuffled(MAJOR_ARCANA).map(card => ({ card, reversed: Math.random() < 0.3 })));
        setTimeout(() => setStage('spread'), 1600);
    };

    // 카드 선택: 뽑을 때마다 바로 drawn에 추가하고 대기 없이 계속 뽑게 한다(대기는 3장을
    // 다 뽑은 뒤 종합 해석 1회에만 발생 — 개별 카드 해석 요청은 없앰).
    const pick = (idx: number) => {
        if (usedIdx.has(idx) || drawn.length >= positions.length) return;
        const d = deck[idx];
        const dc: DrawnCard = { card: d.card, reversed: d.reversed, position: positions[drawn.length] };
        setUsedIdx(prev => new Set(prev).add(idx));
        const next = [...drawn, dc];
        setDrawn(next);
        playSound('tarotFlip');
        // 마지막 한 장이 공개되는 순간에만 차임 — 뽑기 소리와 겹치지 않게 살짝 늦춘다
        // (동시에 울리면 둘 다 뭉개져 들린다).
        if (next.length >= positions.length) {
            setTimeout(() => playSound('tarotReveal', 0.25), 320);
        }
        if (mode === 'daily') {
            // 오늘의 카드는 원래도 1장+즉시 해석 요청 구조 — 그대로 유지.
            const dir = dc.reversed ? '역방향' : '정방향';
            onSend(`🌙 [오늘의 카드] '${dc.card.kr}(${dc.card.en})' ${dir}을 뽑았어. 오늘 하루의 흐름과 조언으로 해석해줘.`);
            onClose();
            return;
        }
        if (next.length >= positions.length) setStage('finished');
    };

    const askSummary = () => {
        const parts = drawn.map(d => `${d.position}: ${d.card.kr}(${d.card.en}) ${d.reversed ? '역방향' : '정방향'}`).join(', ');
        onSend(`🔮 [타로 리딩 종합] 과거·현재·미래 세 장을 뽑았어 — ${parts}. 각 카드가 그 자리에서 무엇을 의미하는지와, 세 카드의 흐름을 연결한 종합 리딩·실행 조언을 들려줘.`);
        // 종합 응답까지 받으면 감정서(보고서)를 만들 수 있게 칩으로 대기
        setStage('report');
        setMinimized(true);
    };

    // ── 최소화 칩 (종합 해석 읽는 동안만 등장 — 카드 뽑기 단계는 대기 없이 진행) ──
    if (minimized) {
        const label = stage === 'report' ? '📜 리딩 보고서 만들기' : '🔮 종합 리딩 듣기';
        return (
            <button
                onClick={() => {
                    if (isTyping) return;
                    if (stage === 'report') { onMakeReport?.(drawn); onClose(); return; }
                    setMinimized(false);
                }}
                className="fixed bottom-24 right-4 z-40 px-4 py-2.5 rounded-full shadow-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 border border-purple-300/40 animate-pulse"
                style={{ opacity: isTyping ? 0.6 : 1 }}
            >
                {isTyping ? '✨ 유나가 해석 중…' : label}
            </button>
        );
    }

    const cardBack = (tilt: number) => (
        <div
            className="w-full h-full rounded-lg border border-amber-300/50 flex items-center justify-center select-none"
            style={{
                background: 'linear-gradient(145deg, #3b2a5e 0%, #241640 55%, #4a2f77 100%)',
                boxShadow: '0 4px 14px rgba(30,10,60,.55), inset 0 0 18px rgba(255,215,130,.12)',
                transform: `rotate(${tilt}deg)`,
            }}
        >
            <span className="text-amber-300/80 text-xl" style={{ textShadow: '0 0 8px rgba(255,215,130,.7)' }}>✦</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(12,6,28,.82)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-md rounded-3xl border border-purple-300/25 overflow-hidden"
                 style={{ background: 'radial-gradient(120% 100% at 50% 0%, #2c1b52 0%, #170d33 60%, #0d0722 100%)' }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 pt-4">
                    <div className="text-amber-200/90 text-sm font-semibold tracking-widest" style={{ fontFamily: 'serif' }}>
                        ✦ YUNA TAROT ✦
                    </div>
                    <div className="flex items-center gap-1">
                        {/* 효과음 토글 — 지하철·사무실에서 열었을 때 바로 끌 수 있어야 한다 */}
                        <button
                            onClick={() => { const n = !muted; setMuted(n); setSoundMuted(n); if (!n) playSound('tarotFlip'); }}
                            aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
                            title={muted ? '효과음 켜기' : '효과음 끄기'}
                            className="text-purple-200/70 hover:text-white text-sm leading-none px-1"
                        >{muted ? '🔇' : '🔊'}</button>
                        <button
                            onClick={() => { if (drawn.length === 0 || confirm('리딩을 중단할까요?')) onClose(); }}
                            className="text-purple-200/70 hover:text-white text-lg leading-none px-1"
                        >✕</button>
                    </div>
                </div>

                {/* 진행 슬롯: 과거/현재/미래 */}
                <div className="flex justify-center gap-3 mt-3">
                    {positions.map((pos, i) => {
                        const d = drawn[i];
                        return (
                            <div key={pos} className="flex flex-col items-center gap-1">
                                <div className={`w-10 h-14 rounded-md border flex items-center justify-center text-lg
                                    ${d ? 'border-amber-300/70 bg-purple-900/60' : 'border-purple-400/30 bg-white/5'}`}>
                                    {d ? <span style={{ transform: d.reversed ? 'rotate(180deg)' : 'none' }}>{d.card.sym}</span> : <span className="text-purple-300/30 text-xs">?</span>}
                                </div>
                                <span className="text-[10px] text-purple-200/70">{pos}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="px-5 pb-6 pt-4 min-h-[300px] flex flex-col items-center justify-center">
                    {stage === 'intro' && (
                        <div className="text-center space-y-5">
                            <div className="text-5xl">🔮</div>
                            <p className="text-purple-100/90 text-sm leading-relaxed">
                                {mode === 'daily' ? (
                                    <>오늘 하루를 마음에 떠올려 봐.<br />
                                    카드를 섞고 <b className="text-amber-200">단 한 장</b> — 그 카드가 <b className="text-amber-200">오늘의 조언</b>을 들려줄 거야.</>
                                ) : (
                                    <>마음속으로 <b className="text-amber-200">궁금한 것 하나</b>를 떠올려 봐.<br />
                                    준비되면 카드를 섞을게. 세 장이 <b className="text-amber-200">과거 · 현재 · 미래</b>를 보여줄 거야.</>
                                )}
                            </p>
                            <button onClick={doShuffle}
                                className="px-6 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 shadow-lg hover:opacity-90">
                                ✨ 카드 섞기
                            </button>
                        </div>
                    )}

                    {stage === 'shuffling' && (
                        <div className="relative w-24 h-36">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="absolute inset-0 tarot-shuffle" style={{ animationDelay: `${i * 0.12}s` }}>
                                    {cardBack(0)}
                                </div>
                            ))}
                            <style>{`
                                @keyframes tarotShuffle {
                                    0% { transform: translate(0,0) rotate(0deg); }
                                    25% { transform: translate(-46px,-10px) rotate(-14deg); }
                                    50% { transform: translate(0,0) rotate(0deg); }
                                    75% { transform: translate(46px,-10px) rotate(14deg); }
                                    100% { transform: translate(0,0) rotate(0deg); }
                                }
                                .tarot-shuffle { animation: tarotShuffle .8s ease-in-out 2; }
                            `}</style>
                        </div>
                    )}

                    {stage === 'spread' && (
                        <div className="w-full">
                            <p className="text-center text-purple-100/85 text-sm mb-3">
                                <b className="text-amber-200">{positions[drawn.length]}</b>의 카드를 골라 봐{positions.length > 1 ? ` (${drawn.length + 1}/${positions.length})` : ''}
                            </p>
                            <div className="flex overflow-x-auto pb-3 px-2" style={{ scrollbarWidth: 'thin' }}>
                                {deck.map((_, i) => (
                                    <button key={i} onClick={() => pick(i)} disabled={usedIdx.has(i)}
                                        className="shrink-0 transition-transform hover:-translate-y-2 focus:-translate-y-2"
                                        style={{ width: 46, height: 74, marginLeft: i === 0 ? 0 : -18,
                                                 opacity: usedIdx.has(i) ? 0.15 : 1, zIndex: i }}>
                                        {cardBack(i % 2 === 0 ? -3 : 3)}
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-[11px] text-purple-300/50 mt-1">← 옆으로 넘기며 끌리는 카드를 골라 →</p>
                        </div>
                    )}

                    {stage === 'finished' && (
                        <div className="text-center space-y-5 w-full">
                            <p className="text-purple-100/90 text-sm">✨ 세 장을 모두 뽑았어!</p>
                            <div className="flex justify-center gap-3">
                                {drawn.map((d, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2">
                                        <div className="w-20 h-32 rounded-lg border-2 border-amber-300/70 flex flex-col items-center justify-between py-2 tarot-flip"
                                             style={{ background: 'linear-gradient(160deg,#f7edd8 0%,#efe0c3 100%)',
                                                      boxShadow: '0 6px 22px rgba(255,200,90,.2)', animationDelay: `${i * 0.12}s` }}>
                                            <span className="text-purple-900 text-[9px] font-bold tracking-widest" style={{ fontFamily: 'serif' }}>{d.card.no}</span>
                                            <span className="text-4xl" style={{ transform: d.reversed ? 'rotate(180deg)' : 'none' }}>{d.card.sym}</span>
                                            <div className="text-center leading-tight">
                                                <div className="text-purple-900 font-bold text-[11px]">{d.card.kr}</div>
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                                            ${d.reversed ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/25 text-emerald-200'}`}>
                                            {d.position}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <style>{`
                                @keyframes tarotFlip { 0% { transform: rotateY(90deg); opacity:.3 } 100% { transform: rotateY(0deg); opacity:1 } }
                                .tarot-flip { animation: tarotFlip .5s ease-out backwards; }
                            `}</style>
                            <p className="text-purple-100/90 text-sm">이제 흐름을 연결해 종합 리딩을 들려줄게.</p>
                            <button onClick={askSummary} disabled={isTyping}
                                className="px-6 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg hover:opacity-90 disabled:opacity-50">
                                🌟 종합 리딩 듣기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
