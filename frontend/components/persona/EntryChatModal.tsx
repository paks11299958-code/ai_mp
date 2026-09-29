import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../../types';
import type { Emotion } from '../../lib/personaEmotion';
import type { EntryChatTheme } from '../../lib/entryChatThemes';
import { CHAT_MESSAGE_COST } from '../../lib/chatCost';

export type EntryChatSendResult = 'sent' | 'insufficient' | 'blocked';

interface Props {
    theme: EntryChatTheme;
    messages: Message[];
    isTyping: boolean;
    emotion?: Emotion;
    emotionImageUrl?: string;
    /** 감정이 새로 정해질 때마다 바뀌는 순번(usePersonaEmotion.emotionSeq) — 연출 재생 key. */
    emotionSeq?: number;
    relationshipStage?: string;
    balance: number;
    hideCost?: boolean;
    onSend: (text: string) => Promise<EntryChatSendResult>;
    onClose: () => void;
    onNeedCharge: () => void;
    onOpenFullChat: () => void;
    opener?: HTMLElement | null;
}

const DIRECTIONS = /(\([^()]+\))/g;
export function renderVisualNovelText(text: string) {
    return text.split(DIRECTIONS).filter(Boolean).map((part, i) =>
        /^\([^()]+\)$/.test(part)
            ? <em className="ec-direction" key={`${i}-${part}`}>{part}</em>
            : <React.Fragment key={`${i}-${part}`}>{part}</React.Fragment>,
    );
}

const EmotionFx = ({ emotion }: { emotion: Emotion }) => {
    if (emotion === 'pout') return <svg className="ec-pout" viewBox="0 0 80 60" aria-hidden="true"><path d="M8 35 27 30 22 10 40 24 55 7 53 29 73 32 56 43 61 57 40 48 25 58 26 43Z" /></svg>;
    if (emotion === 'thinking') return <span className="ec-thought" aria-hidden="true"><i>·</i><i>·</i><i>·</i></span>;
    const glyph = emotion === 'sleepy' ? 'Z' : emotion === 'surprised' ? '!' : emotion === 'sad' ? '●' : emotion === 'love' ? '♥' : emotion === 'cheer' ? '★' : '✦';
    return <div className="ec-particles" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i}>{glyph}</i>)}</div>;
};

export const EntryChatModal: React.FC<Props> = ({ theme, messages, isTyping, emotion = 'greeting', emotionImageUrl, emotionSeq = 0,
    relationshipStage, balance, hideCost, onSend, onClose, onNeedCharge, onOpenFullChat, opener }) => {
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [burst, setBurst] = useState(0);
    const [closing, setClosing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const previousPortrait = useRef(emotionImageUrl || theme.fallbackPortrait);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const requestCloseRef = useRef<() => void>(() => {});
    const portrait = emotionImageUrl || theme.fallbackPortrait;
    const [oldPortrait, setOldPortrait] = useState<string | null>(null);
    const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
    const lastCompleted = [...messages].reverse().find(m => m.role !== 'user' && !m.isStreaming);
    const lastCompletedReply = lastCompleted?.role === 'model' ? lastCompleted.text : '';
    // ★연출은 감정이 새로 정해질 때마다 **다시 재생**돼야 한다 — key 가 같으면 같은 DOM 이 재사용돼 애니메이션이 첫 1회만 돈다(09-29 검수).
    //   답장 id 로 키를 잡으면 답장 완료 순간 **이전 감정** 연출이 한 번 더 돌아서 순번(emotionSeq)을 쓴다.
    const fxKey = `${emotion}-${emotionSeq}`;
    // 처음 열 때만 말풍선을 순서대로(스태거) — 이후 새 메시지는 지연 없이 바로.
    const initialCount = useRef(messages.length);

    useEffect(() => {
        const oldOverflow = document.body.style.overflow;
        const entry = document.querySelector('.eb-root') as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        entry?.setAttribute('inert', '');
        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') requestCloseRef.current();
            if (e.key !== 'Tab' || !dialogRef.current) return;
            const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, textarea, a[href], [tabindex]:not([tabindex="-1"])'));
            if (!nodes.length) return;
            const first = nodes[0], last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        window.addEventListener('keydown', onKey);
        const updateVv = () => document.documentElement.style.setProperty('--ec-vvh', `${window.visualViewport?.height ?? window.innerHeight}px`);
        updateVv(); window.visualViewport?.addEventListener('resize', updateVv);
        return () => {
            clearTimeout(focusTimer); window.removeEventListener('keydown', onKey);
            window.visualViewport?.removeEventListener('resize', updateVv);
            document.documentElement.style.removeProperty('--ec-vvh'); document.body.style.overflow = oldOverflow;
            entry?.removeAttribute('inert'); opener?.focus();
        };
    }, [opener]);

    useEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    }, [messages, isTyping, reduced]);

    useEffect(() => {
        if (previousPortrait.current === portrait) return;
        setOldPortrait(previousPortrait.current); previousPortrait.current = portrait;
        const timer = window.setTimeout(() => setOldPortrait(null), reduced ? 100 : 480);
        return () => clearTimeout(timer);
    }, [portrait, reduced]);

    const submit = async () => {
        const text = draft.trim();
        if (!text || sending || isTyping) return;
        setDraft(''); setSending(true); setBurst(v => v + 1);
        const result = await onSend(text);
        setSending(false);
        if (result === 'insufficient') { setDraft(text); onNeedCharge(); }
        else if (result === 'blocked') setDraft(text);
    };

    const requestClose = () => {
        if (closing) return;
        if (reduced) { onCloseRef.current(); return; }
        setClosing(true);
        window.setTimeout(() => onCloseRef.current(), 220);
    };
    requestCloseRef.current = requestClose;

    return <div className={`ec-overlay ec-fx-${emotion} ${reduced ? 'ec-reduced' : ''} ${closing ? 'ec-closing' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget && matchMedia('(min-width:768px)').matches) requestClose(); }}>
        <style>{CSS}</style>
        <div className="ec-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ec-title">
            <section className="ec-stage">
                <div className="ec-bokeh" aria-hidden="true">{[0,1,2,3,4].map(i => <i key={i} />)}</div>
                {oldPortrait && <img className="ec-portrait ec-old" src={oldPortrait} alt="" />}
                <img className="ec-portrait ec-new" key={portrait} src={portrait} alt={`${theme.displayName}의 현재 표정`} />
                {!reduced && <EmotionFx key={fxKey} emotion={emotion} />}
                <div className="ec-stage-fade" />
                <div className="ec-name"><strong id="ec-title">{theme.displayName}</strong>{relationshipStage && <span>{relationshipStage}</span>}</div>
                <button className="ec-close" type="button" onClick={requestClose} aria-label="채팅 모달 닫기">×</button>
            </section>
            <div className="ec-messages" ref={listRef}>
                {messages.map((m, index) => <div className={`ec-row ${m.role === 'user' ? 'ec-user' : 'ec-eunbi'}`} key={m.id} style={{ '--ec-delay': index < initialCount.current ? `${Math.min(index, 6) * 70}ms` : '0ms' } as React.CSSProperties}>
                    {m.role !== 'user' && <img className="ec-avatar" src={portrait} alt="" />}
                    <div className="ec-bubble">{renderVisualNovelText(m.text)}{m.isStreaming && <span className="ec-cursor" aria-hidden="true">▍</span>}</div>
                </div>)}
                {isTyping && <div className="ec-row ec-eunbi ec-typing"><img className="ec-avatar" src={portrait} alt="" /><div className="ec-bubble"><span className="ec-typing-hearts"><i>♥</i><i>♥</i><i>♥</i></span> 은비가 입력 중…</div></div>}
            </div>
            <div className="ec-live" aria-live="polite">{!isTyping ? lastCompletedReply : ''}</div>
            <footer className="ec-compose">
                <div className="ec-cost">{!hideCost && <>메시지당 {CHAT_MESSAGE_COST}P · </>}잔액 {balance.toLocaleString()}P</div>
                <div className="ec-inputrow">
                    <textarea ref={inputRef} value={draft} rows={1} aria-label={`${theme.displayName}에게 메시지 보내기`} placeholder={`${theme.displayName.slice(-2)}에게 말 걸기…`}
                        onChange={e => { setDraft(e.target.value); e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 96)}px`; }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
                    <button type="button" className="ec-send" onClick={() => void submit()} disabled={!draft.trim() || sending || isTyping} aria-label="메시지 보내기">♥<span>➤</span>
                        {burst > 0 && !reduced && <span className="ec-sendburst" key={burst}>{[0,1,2,3].map(i => <i key={i}>♥</i>)}</span>}
                    </button>
                </div>
                <button className="ec-full" type="button" onClick={onOpenFullChat}>전체 채팅 화면으로 →</button>
            </footer>
        </div>
    </div>;
};

// ★폭(2026-09-29 사장 폰 실측 — 오른쪽 잘림): 격자 열을 minmax(0,1fr)로, 입력창은 min-width:0.
//   textarea 는 기본 20자 폭(글자 크기 비례)을 가져 **글자 크기를 키운 폰**·360px 폭에서 모달을 화면 밖으로 밀었다.
const CSS = `
.ec-overlay{--ec-rose:#E8467F;--ec-milk:#FFF3F7;--ec-lilac:#B89CFF;position:fixed;inset:0;z-index:90;display:flex;align-items:flex-end;justify-content:center;background:rgba(60,20,42,.38);backdrop-filter:blur(8px);animation:ec-dim .2s ease both;font-family:"Gowun Dodum",system-ui,sans-serif;color:#4A2338;overflow:hidden}
.ec-dialog{width:100%;height:calc(var(--ec-vvh,100dvh) - 12px);max-height:calc(var(--ec-vvh,100dvh) - 12px);display:grid;grid-template-rows:minmax(200px,34%) minmax(0,1fr) auto;grid-template-columns:minmax(0,1fr);max-width:100vw;overflow:hidden;background:linear-gradient(#fff,var(--ec-milk));border-radius:26px 26px 0 0;box-shadow:0 -18px 60px rgba(74,35,56,.28);animation:ec-sheet .42s cubic-bezier(.2,1.18,.38,1) both}
.ec-dialog>*{min-width:0}
.ec-closing{animation:ec-undim .22s ease both}.ec-closing .ec-dialog{animation:ec-unsheet .22s ease-in both}
.ec-stage{position:relative;min-height:200px;overflow:hidden;background:linear-gradient(145deg,#ffdce9,#ffe7d7 52%,#dfd2ff)}
.ec-portrait{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 20%;animation:ec-portrait .45s ease both,ec-breathe 5.6s ease-in-out .45s infinite alternate}
.ec-old{z-index:1;animation:ec-out .45s ease both}.ec-new{z-index:2}.ec-stage-fade{position:absolute;z-index:5;inset:auto 0 0;height:35%;background:linear-gradient(transparent,var(--ec-milk))}
.ec-name{position:absolute;z-index:8;top:calc(14px + env(safe-area-inset-top,0px));left:16px;right:66px;display:flex;flex-wrap:wrap;gap:7px;align-items:center;min-width:0}.ec-name strong{font:400 22px "Jua",system-ui;background:rgba(255,255,255,.86);padding:5px 12px 3px;border-radius:999px;color:var(--ec-rose)}.ec-name span{font-size:11px;background:#fff;padding:4px 8px;border-radius:999px;color:#8A5A71}
.ec-close{position:absolute;z-index:9;top:calc(14px + env(safe-area-inset-top,0px));right:16px;width:40px;height:40px;border:1px solid rgba(232,70,127,.2);border-radius:50%;background:rgba(255,255,255,.88);font-size:25px;line-height:1;color:#8A5A71;cursor:pointer}
.ec-bokeh i{position:absolute;z-index:3;width:70px;height:70px;border-radius:50%;background:rgba(255,255,255,.22);filter:blur(2px);animation:ec-float 22s ease-in-out infinite alternate}.ec-bokeh i:nth-child(2){left:65%;top:12%;width:100px;animation-duration:27s}.ec-bokeh i:nth-child(3){left:15%;top:55%;width:48px}.ec-bokeh i:nth-child(4){left:78%;top:65%;width:56px;animation-duration:25s}.ec-bokeh i:nth-child(5){left:40%;top:30%;width:36px}
.ec-particles{position:absolute;z-index:7;inset:0;pointer-events:none}.ec-particles i{position:absolute;left:var(--x,20%);bottom:10%;font-style:normal;color:#ff8eb4;font-size:24px;animation:ec-particle 2.4s ease-out both}.ec-particles i:nth-child(2){left:35%;animation-delay:.15s;color:#ffd45c}.ec-particles i:nth-child(3){left:54%;animation-delay:.3s}.ec-particles i:nth-child(4){left:70%;animation-delay:.1s}.ec-particles i:nth-child(5){left:84%;animation-delay:.38s;color:#ffd45c}.ec-fx-sad .ec-portrait{filter:saturate(.72)}.ec-fx-sad .ec-particles i{color:#82baff}.ec-fx-sleepy .ec-stage::after{content:"";position:absolute;z-index:4;inset:0;background:rgba(52,39,73,.15)}.ec-fx-surprised .ec-new{animation:ec-shake .4s ease,ec-portrait .45s ease}.ec-fx-shy .ec-stage::before{content:"";position:absolute;z-index:6;left:50%;top:50%;width:70%;height:35%;transform:translate(-50%,-10%);background:radial-gradient(circle at 20% 50%,rgba(255,105,150,.35),transparent 25%),radial-gradient(circle at 80% 50%,rgba(255,105,150,.35),transparent 25%);animation:ec-blush 2.2s ease both}.ec-pout{position:absolute;z-index:7;right:12%;top:24%;width:60px;fill:#E8467F;animation:ec-pop 2s ease both}.ec-thought{position:absolute;z-index:7;right:12%;top:20%;background:#fff;border-radius:99px;padding:5px 13px;font-size:28px;letter-spacing:4px;animation:ec-pop 2.2s ease both}.ec-thought i{font-style:normal}
.ec-messages{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:14px 13px 8px;scrollbar-width:thin}.ec-row{display:flex;align-items:flex-end;gap:7px;margin:8px 0;animation:ec-bubble .32s cubic-bezier(.2,1.25,.4,1) var(--ec-delay,0ms) both}.ec-user{justify-content:flex-end;animation-name:ec-userbubble}.ec-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none;border:2px solid #fff;box-shadow:0 2px 8px rgba(74,35,56,.15)}.ec-bubble{max-width:78%;padding:10px 13px;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:18px 18px 18px 5px;background:rgba(255,255,255,.88);border:1px solid rgba(232,70,127,.35);box-shadow:0 5px 14px rgba(74,35,56,.07)}.ec-user .ec-bubble{color:#fff;border:0;border-radius:18px 18px 5px 18px;background:linear-gradient(135deg,var(--ec-rose),var(--ec-lilac))}.ec-direction{display:inline;color:#b57a96;font-style:italic}.ec-user .ec-direction{color:#ffe1ec}.ec-cursor{color:var(--ec-rose);animation:ec-blink .8s steps(1) infinite}.ec-typing{font-size:13px;color:#8A5A71}.ec-typing-hearts i{font-style:normal;color:var(--ec-rose);display:inline-block;animation:ec-hop 1.2s ease-in-out infinite}.ec-typing-hearts i:nth-child(2){animation-delay:.15s}.ec-typing-hearts i:nth-child(3){animation-delay:.3s}
.ec-compose{padding:6px 12px calc(9px + env(safe-area-inset-bottom,0px));background:rgba(255,243,247,.95);border-top:1px solid rgba(232,70,127,.12)}.ec-cost{text-align:right;font-size:11px;color:#8A5A71;margin:0 4px 5px;overflow-wrap:anywhere}.ec-inputrow{display:flex;gap:8px;align-items:flex-end;min-width:0}.ec-inputrow textarea{flex:1 1 0;min-width:0;width:100%;resize:none;max-height:96px;min-height:44px;border:1px solid rgba(232,70,127,.25);border-radius:20px;padding:11px 14px;background:#fff;color:#4A2338;font:15px "Gowun Dodum",system-ui;outline:none}.ec-inputrow textarea:focus{border-color:var(--ec-rose);box-shadow:0 0 0 3px rgba(232,70,127,.12)}.ec-send{position:relative;flex:none;width:46px;height:46px;border:0;border-radius:50%;background:linear-gradient(135deg,var(--ec-rose),var(--ec-lilac));color:#fff;font-size:18px;cursor:pointer;transition:transform .12s}.ec-send span:not(.ec-sendburst){font-size:12px;margin-left:-3px}.ec-send:active{transform:scale(.92)}.ec-send:disabled{opacity:.4}.ec-sendburst{position:absolute;inset:0;pointer-events:none}.ec-sendburst i{position:absolute;left:15px;top:8px;font-style:normal;animation:ec-sendheart .7s ease-out both}.ec-sendburst i:nth-child(2){--dx:24px;--dy:-22px}.ec-sendburst i:nth-child(3){--dx:-20px;--dy:-28px}.ec-sendburst i:nth-child(4){--dx:8px;--dy:-38px}.ec-full{display:block;margin:5px auto 0;border:0;background:none;color:var(--ec-rose);font:12px "Gowun Dodum",system-ui;cursor:pointer}.ec-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media(min-width:768px){.ec-overlay{align-items:center}.ec-dialog{width:480px;height:min(760px,88dvh,var(--ec-vvh,88dvh));max-height:min(760px,88dvh,var(--ec-vvh,88dvh));border-radius:28px}.ec-stage{min-height:210px}}
@keyframes ec-dim{from{opacity:0}}@keyframes ec-undim{to{opacity:0}}@keyframes ec-sheet{from{transform:translateY(105%)}70%{transform:translateY(-1.5%)}to{transform:none}}@keyframes ec-unsheet{to{transform:translateY(105%)}}@keyframes ec-portrait{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:scale(1)}}@keyframes ec-out{to{opacity:0;transform:scale(.98)}}@keyframes ec-breathe{to{transform:scale(1.012)}}@keyframes ec-float{to{transform:translate(30px,-24px)}}@keyframes ec-particle{to{transform:translateY(-160px) rotate(35deg);opacity:0}}@keyframes ec-pop{0%{opacity:0;transform:scale(.5)}20%{opacity:1;transform:scale(1.12)}100%{opacity:0;transform:scale(1)}}@keyframes ec-blush{0%,100%{opacity:0}30%,70%{opacity:1}}@keyframes ec-shake{25%{transform:translateX(-5px)}50%{transform:translateX(5px)}}@keyframes ec-bubble{from{opacity:0;transform:translateY(8px)}}@keyframes ec-userbubble{from{opacity:0;transform:translate(20px,8px)}}@keyframes ec-blink{50%{opacity:0}}@keyframes ec-hop{50%{transform:translateY(-4px) scale(1.12)}}@keyframes ec-sendheart{to{transform:translate(var(--dx,-14px),var(--dy,-25px)) scale(.6);opacity:0}}
.ec-reduced *{scroll-behavior:auto!important}.ec-reduced .ec-dialog,.ec-reduced .ec-overlay,.ec-reduced .ec-row{animation:none!important}.ec-reduced .ec-portrait{animation:ec-portrait .1s ease both!important}.ec-reduced .ec-bokeh,.ec-reduced .ec-particles,.ec-reduced .ec-pout,.ec-reduced .ec-thought{display:none!important}
@media(prefers-reduced-motion:reduce){.ec-dialog,.ec-overlay,.ec-row{animation:none}.ec-portrait{animation:ec-portrait .1s ease both}.ec-bokeh,.ec-particles,.ec-pout,.ec-thought{display:none}}
`;
