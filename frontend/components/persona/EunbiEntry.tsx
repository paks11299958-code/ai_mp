import React, { useEffect, useRef, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 신은비 전용 진입화면 — 승인된 웹툰 은비 시안(eunbi-entry.html)을 제품 계약에 맞춰 옮긴다.
// App.tsx는 건드리지 않는다. onStart()=기존 채팅, onFeature('hair'|'outfit')=기존 보드,
// onClose()=원래 화면으로 복귀. 준비 중 기능과 웹툰은 콜백 없이 화면 안 토스트만 띄운다.
//   ★웹툰을 onFeature('webtoon')로 보내지 않는 이유: 앱은 activePersona(=은비)의 웹툰을 여는데
//     은비 웹툰은 0편이라 빈 화면이 된다.
// ★스크롤 연동은 window가 아니라 루트(.eb-root) 스크롤 컨테이너 기준이다 —
//   루트가 position:fixed + overflow-y:auto 이므로 window.scrollY는 항상 0이다.

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

const FONT_LINK_ID = 'eb-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap';
const BUBBLE_LINES = ['안녕~ 난 은비야!', '오늘 하루 어땠어?', '같이 웹툰 볼래?', '나랑 얘기하자 ♥', '기다리고 있었어!'];
const SOON_MSG = '곧 만나요! 준비 중이에요';
const WEBTOON_MSG = '은비 웹툰 곧 연재! 조금만 기다려 주세요';

const prefersReducedMotion = () => {
    try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
};

const CSS = `
.eb-root{--eb-milk:#FFF3F7;--eb-blush:#FFE1EC;--eb-rose:#E8467F;--eb-rose-deep:#B92A5F;--eb-peach:#FFC7B2;--eb-lilac:#B89CFF;
  --eb-ink:#4A2338;--eb-ink-soft:#8A5A71;--eb-line:rgba(232,70,127,.18);--eb-card:rgba(255,255,255,.72);
  --eb-display:"Jua","Gowun Dodum",system-ui,sans-serif;
  --eb-body:"Gowun Dodum","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  --eb-hand:"Nanum Pen Script","Gowun Dodum",cursive;
  position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  background:var(--eb-milk);color:var(--eb-ink);font-family:var(--eb-body);color-scheme:light;text-align:left;line-height:1.5}
.eb-root button{font:inherit}
.eb-root :focus-visible{outline:3px solid var(--eb-lilac);outline-offset:3px}

.eb-top{position:fixed;inset:0 0 auto 0;z-index:30;display:flex;align-items:center;justify-content:space-between;
  padding:calc(12px + env(safe-area-inset-top,0px)) 16px 12px;pointer-events:none}
.eb-mark{pointer-events:auto;font-family:var(--eb-display);font-size:22px;color:var(--eb-rose);letter-spacing:-.01em;
  background:rgba(255,255,255,.7);padding:4px 12px 2px;border-radius:999px;backdrop-filter:blur(8px)}
.eb-mark small{font-size:13px;color:var(--eb-ink-soft);margin-left:2px}
.eb-close{pointer-events:auto;width:38px;height:38px;border-radius:50%;border:1px solid var(--eb-line);
  background:rgba(255,255,255,.82);color:var(--eb-ink-soft);font-size:18px;cursor:pointer;backdrop-filter:blur(8px)}

.eb-hero{position:relative;height:150svh}
.eb-stage{position:sticky;top:0;height:100svh;min-height:560px;overflow:hidden}
.eb-layer{position:absolute;inset:0;will-change:transform,opacity}
.eb-l-bg{background:url(/eunbi/hero_bg.jpg) center/cover no-repeat;transform-origin:50% 40%}
.eb-l-bg::after{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 90% at 70% 30%,rgba(255,243,247,0) 30%,rgba(255,243,247,.55) 70%,var(--eb-milk) 100%)}
.eb-l-glow{display:grid;place-items:center;pointer-events:none}
.eb-l-glow i{width:min(90vw,620px);aspect-ratio:1;border-radius:50%;margin:0 0 12vh 18vw;
  background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(255,199,178,.55) 35%,rgba(232,70,127,0) 70%);
  filter:blur(8px);animation:eb-breathe 5s ease-in-out infinite}
@keyframes eb-breathe{50%{transform:scale(1.08);opacity:.85}}
.eb-l-girl{display:flex;align-items:flex-end;justify-content:flex-end;pointer-events:none}
.eb-girlwrap{position:relative;margin-right:clamp(0px,6vw,120px)}
/* 타원 마스크는 영상을 감싼 요소에 건다(영상 요소에 직접 걸면 가장자리 선이 보였다) */
.eb-girlmask{-webkit-mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 64%,transparent 100%);
  mask-image:radial-gradient(ellipse 50% 50% at 50% 50%,#000 64%,transparent 100%)}
.eb-girlmask video{display:block;height:min(100svh,1100px);aspect-ratio:9/16;width:auto;max-width:none;object-fit:cover;background:transparent}
.eb-l-fx{pointer-events:none}
.eb-l-veil{pointer-events:none;background:linear-gradient(to top,var(--eb-milk) 0%,rgba(255,243,247,.92) 26%,rgba(255,243,247,0) 55%);opacity:0}
.eb-fx{position:absolute;left:0;top:0;font-size:18px;color:var(--eb-rose);opacity:.85;animation:eb-floaty var(--d,6s) ease-in-out infinite}
.eb-fx.s{color:#fff;text-shadow:0 0 10px rgba(255,255,255,.9);animation-name:eb-twinkle}
@keyframes eb-floaty{50%{transform:translateY(-14px) rotate(8deg)}}
@keyframes eb-twinkle{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}

.eb-bubblewrap{position:absolute;z-index:5;left:-6%;top:13%;max-width:190px}
.eb-bubble{position:relative;padding:12px 16px 10px;background:#fff;border:2px solid var(--eb-ink);border-radius:22px;
  font-family:var(--eb-hand);font-size:24px;line-height:1.1;color:var(--eb-ink);box-shadow:4px 5px 0 var(--eb-peach);
  transform-origin:90% 100%;transition:transform .35s cubic-bezier(.3,1.6,.5,1),opacity .25s}
.eb-bubble::after{content:"";position:absolute;right:18px;bottom:-13px;width:18px;height:18px;background:#fff;
  border-right:2px solid var(--eb-ink);border-bottom:2px solid var(--eb-ink);transform:rotate(45deg)}
.eb-bubble.out{transform:scale(.6);opacity:0}

.eb-copy{position:absolute;z-index:6;left:max(16px,5vw);bottom:16svh;max-width:min(520px,90vw)}
.eb-eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:14px;color:var(--eb-rose-deep);
  background:rgba(255,255,255,.75);padding:6px 12px;border-radius:999px}
.eb-title{margin:10px 0 0;font-family:var(--eb-display);font-weight:400;font-size:clamp(64px,13vw,132px);line-height:.95;
  color:var(--eb-rose);letter-spacing:-.02em;text-shadow:0 3px 0 #fff,0 6px 0 rgba(232,70,127,.18)}
.eb-title .ai{font-size:.5em;vertical-align:.55em;margin-right:.08em;color:var(--eb-rose-deep)}
.eb-title .heart{display:inline-block;font-size:.55em;vertical-align:.35em;animation:eb-beat 1.6s ease-in-out infinite}
@keyframes eb-beat{0%,100%{transform:scale(1)}15%{transform:scale(1.18)}30%{transform:scale(1)}45%{transform:scale(1.1)}}
.eb-sub{margin:10px 0 0;font-size:17px;color:var(--eb-ink)}
.eb-quote{margin:6px 0 0;font-family:var(--eb-hand);font-size:30px;color:var(--eb-rose-deep)}
.eb-scrollhint{position:absolute;z-index:6;left:50%;bottom:3svh;transform:translateX(-50%);font-size:12px;color:var(--eb-ink-soft);
  display:flex;flex-direction:column;align-items:center;gap:4px}
.eb-scrollhint i{width:2px;height:22px;background:linear-gradient(var(--eb-rose),transparent);animation:eb-drop 1.6s ease-in-out infinite}
@keyframes eb-drop{0%{transform:scaleY(0);transform-origin:top}60%{transform:scaleY(1);transform-origin:top}100%{opacity:0}}

.eb-main{position:relative;z-index:10;margin-top:-40svh;padding:0 16px calc(110px + env(safe-area-inset-bottom,0px))}
.eb-wrap{max-width:1080px;margin:0 auto;display:grid;gap:22px}
.eb-panel{background:var(--eb-card);border:1px solid rgba(255,255,255,.95);border-radius:26px;padding:18px;
  box-shadow:0 18px 40px -22px rgba(185,42,95,.45);backdrop-filter:blur(12px)}
.eb-reveal{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.2,1)}
.eb-reveal.in{opacity:1;transform:none}
.eb-h2{margin:0 0 12px;font-family:var(--eb-display);font-weight:400;font-size:22px;color:var(--eb-ink);display:flex;align-items:center;gap:8px}
.eb-h2 .pill{font-family:var(--eb-body);font-size:11px;color:#fff;background:var(--eb-rose);padding:3px 8px;border-radius:999px}

.eb-actions{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.eb-act{position:relative;display:grid;justify-items:center;gap:6px;padding:16px 8px 14px;border-radius:20px;cursor:pointer;
  border:1px solid var(--eb-line);background:linear-gradient(180deg,#fff,var(--eb-blush));color:var(--eb-ink);text-align:center;
  transition:transform .2s,box-shadow .2s}
.eb-act:hover{transform:translateY(-3px);box-shadow:0 12px 22px -14px rgba(185,42,95,.6)}
.eb-act .ic{width:46px;height:46px;display:grid;place-items:center;border-radius:16px;background:var(--eb-rose);color:#fff;font-size:22px;
  box-shadow:inset 0 -3px 0 rgba(0,0,0,.12)}
.eb-act b{font-family:var(--eb-display);font-weight:400;font-size:17px}
.eb-act .d{font-size:12px;color:var(--eb-ink-soft);line-height:1.35}
.eb-soon{position:absolute;top:8px;right:8px;font-size:10px;font-style:normal;color:var(--eb-rose-deep);background:#fff;border:1px dashed var(--eb-rose);
  padding:1px 6px;border-radius:999px}
.eb-act.is-soon .ic{background:#F4B9CE}

.eb-ctas{display:flex;flex-wrap:wrap;gap:10px}
.eb-cta{flex:1 1 240px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:16px 20px;border-radius:999px;
  font-family:var(--eb-display);font-size:19px;cursor:pointer;border:0;color:#fff;
  background:linear-gradient(135deg,#F0628F,var(--eb-rose) 45%,var(--eb-rose-deep));box-shadow:0 12px 26px -12px rgba(185,42,95,.8)}
.eb-cta.ghost{background:#fff;color:var(--eb-rose-deep);border:2px solid var(--eb-rose);box-shadow:none}
.eb-cta:active{transform:scale(.98)}

.eb-twin{display:grid;grid-template-columns:1.35fr 1fr;gap:22px;align-items:start}
.eb-chibis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.eb-chibi{position:relative;display:grid;grid-template-columns:76px 1fr;align-items:center;gap:10px;padding:8px 10px 8px 8px;
  border-radius:20px;border:1px solid var(--eb-line);background:#fff;cursor:pointer;text-align:left;color:var(--eb-ink)}
.eb-chibi img{width:76px;height:76px;border-radius:16px;object-fit:cover;animation:eb-bob 3.2s ease-in-out infinite}
.eb-chibi:nth-child(2) img{animation-delay:-.8s}.eb-chibi:nth-child(3) img{animation-delay:-1.6s}.eb-chibi:nth-child(4) img{animation-delay:-2.4s}
@keyframes eb-bob{50%{transform:translateY(-4px)}}
.eb-chibi b{display:block;font-family:var(--eb-display);font-weight:400;font-size:17px;color:var(--eb-rose-deep)}
.eb-chibi .d{display:block;margin-top:2px;font-size:12px;color:var(--eb-ink-soft);line-height:1.35}
.eb-chibi .eb-soon{top:6px;right:6px}

.eb-webtoon{display:grid;gap:10px}
.eb-wt-card{position:relative;display:block;width:100%;padding:0;border:0;cursor:pointer;border-radius:20px;overflow:hidden;aspect-ratio:4/3;
  background:var(--eb-blush);text-align:left}
.eb-wt-card img{display:block;width:100%;height:100%;object-fit:cover;transition:transform 6s ease}
.eb-wt-card:hover img{transform:scale(1.06)}
.eb-wt-card .tag{position:absolute;left:12px;top:12px;font-family:var(--eb-display);font-size:14px;color:#fff;background:var(--eb-rose);
  padding:4px 10px 2px;border-radius:999px}
.eb-wt-card .cap{position:absolute;inset:auto 0 0 0;padding:30px 14px 12px;color:#fff;font-size:14px;
  background:linear-gradient(to top,rgba(74,35,56,.8),transparent)}
.eb-wt-card .cap b{display:block;font-family:var(--eb-display);font-weight:400;font-size:20px}
.eb-eps{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.eb-ep{border:1px dashed var(--eb-line);border-radius:12px;padding:8px 4px;text-align:center;font-size:11px;color:var(--eb-ink-soft);background:#fff}
.eb-ep b{display:block;font-family:var(--eb-display);font-weight:400;color:var(--eb-rose);font-size:14px}

.eb-dock{position:fixed;inset:auto 0 0 0;z-index:40;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));
  background:linear-gradient(to top,var(--eb-milk) 65%,rgba(255,243,247,0));display:none}
.eb-dock .eb-cta{width:100%}

.eb-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:60;transform:translate(-50%,20px);
  opacity:0;transition:.3s;background:var(--eb-ink);color:#fff;padding:10px 16px;border-radius:14px;font-size:13px;
  max-width:min(92vw,420px);text-align:center;pointer-events:none}
.eb-toast.show{opacity:1;transform:translate(-50%,0)}

@media (max-width:860px){
  .eb-twin{grid-template-columns:1fr}
  .eb-actions{grid-template-columns:repeat(2,minmax(0,1fr))}
  .eb-girlmask video{height:min(86svh,820px)}
  .eb-girlwrap{margin-right:-16vw}
  .eb-l-veil{opacity:1}
  .eb-copy .eb-sub{font-weight:700}
  .eb-l-glow i{margin:0 0 20svh 30vw}
  .eb-bubblewrap{left:4%;top:9%;max-width:160px}
  .eb-bubble{font-size:21px}
  .eb-copy{bottom:13svh}
  .eb-ctas.inline{display:none}
  .eb-dock{display:block}
}
@media (max-width:420px){
  .eb-chibis{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .eb-root *,.eb-root *::before,.eb-root *::after{animation:none!important;transition:none!important}
  .eb-reveal{opacity:1;transform:none}
}
`;

type FxDot = { star: boolean; left: number; top: number; size: number; dur: number; delay: number; opacity: number };

const makeFx = (): FxDot[] => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    return Array.from({ length: 22 }, (_, i) => {
        const star = i % 3 === 0;
        return { star, left: rnd(4, 96), top: rnd(6, 88), size: rnd(10, star ? 18 : 26), dur: rnd(4, 9), delay: -rnd(0, 8), opacity: rnd(.35, .9) };
    });
};

export const EunbiEntry: React.FC<Props> = ({ onClose, onStart, onFeature }) => {
    const [reduce] = useState(prefersReducedMotion);
    const [fx] = useState(makeFx);
    const [line, setLine] = useState(0);
    const [bubbleOut, setBubbleOut] = useState(false);
    const [toast, setToast] = useState('');
    const [toastOn, setToastOn] = useState(false);

    const rootRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const girlRef = useRef<HTMLDivElement>(null);
    const fxRef = useRef<HTMLDivElement>(null);
    const copyRef = useRef<HTMLDivElement>(null);
    const bubbleWrapRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout>>();

    // 폰트는 한 번만 삽입한다(열고 닫기를 반복해도 중복 없음). 실패해도 대체 글꼴로 동작.
    useEffect(() => {
        if (document.getElementById(FONT_LINK_ID)) return;
        const link = document.createElement('link');
        link.id = FONT_LINK_ID;
        link.rel = 'stylesheet';
        link.href = FONT_HREF;
        document.head.appendChild(link);
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    // React는 muted를 속성(attribute)으로 안 찍어서, 모바일 자동재생 조건을 확실히 맞춘다.
    useEffect(() => {
        const v = videoRef.current;
        if (v) { v.muted = true; v.defaultMuted = true; }
    }, []);

    // 말풍선 대사 순환
    useEffect(() => {
        if (reduce) return;
        let swap: ReturnType<typeof setTimeout> | undefined;
        const id = setInterval(() => {
            setBubbleOut(true);
            swap = setTimeout(() => { setLine(n => (n + 1) % BUBBLE_LINES.length); setBubbleOut(false); }, 260);
        }, 2800);
        return () => { clearInterval(id); if (swap) clearTimeout(swap); };
    }, [reduce]);

    // 스크롤 연동 패럴랙스 — 루트 스크롤 컨테이너의 scrollTop 기준
    useEffect(() => {
        const root = rootRef.current;
        if (reduce || !root) return;
        let mx = 0, my = 0, raf = 0;
        const render = () => {
            raf = 0;
            const hero = heroRef.current;
            if (!hero) return;
            const h = hero.offsetHeight - root.clientHeight;
            const p = Math.min(Math.max(root.scrollTop / Math.max(h, 1), 0), 1);
            const set = (el: HTMLElement | null, t: string) => { if (el) el.style.transform = t; };
            set(bgRef.current, `translate3d(${mx * -8}px, ${p * 60 + my * -6}px, 0) scale(${1.08 + p * .06})`);
            set(glowRef.current, `translate3d(${mx * 10}px, ${p * -40}px, 0) scale(${1 + p * .15})`);
            set(girlRef.current, `translate3d(${mx * 16}px, ${p * -70 + my * 6}px, 0) scale(${1 + p * .05})`);
            set(fxRef.current, `translate3d(${mx * 30}px, ${p * -220 + my * 14}px, 0)`);
            if (copyRef.current) {
                copyRef.current.style.transform = `translate3d(0, ${p * -60}px, 0)`;
                copyRef.current.style.opacity = String(1 - p * 1.3);
            }
            if (bubbleWrapRef.current) bubbleWrapRef.current.style.opacity = String(Math.max(0, 1 - p * 2));
        };
        const ask = () => { if (!raf) raf = requestAnimationFrame(render); };
        const onMove = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            mx = e.clientX / window.innerWidth - .5;
            my = e.clientY / window.innerHeight - .5;
            ask();
        };
        root.addEventListener('scroll', ask, { passive: true });
        window.addEventListener('resize', ask);
        window.addEventListener('pointermove', onMove);
        render();
        return () => {
            root.removeEventListener('scroll', ask);
            window.removeEventListener('resize', ask);
            window.removeEventListener('pointermove', onMove);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [reduce]);

    // 본문 카드가 스크롤로 떠오름. 관찰 실패·움직임 줄이기면 즉시 표시.
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const els = Array.from(root.querySelectorAll<HTMLElement>('.eb-reveal'));
        const showAll = () => els.forEach(el => el.classList.add('in'));
        if (reduce || typeof IntersectionObserver === 'undefined') { showAll(); return; }
        const io = new IntersectionObserver(entries => entries.forEach(e => {
            if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        }), { root, threshold: .15 });
        els.forEach(el => io.observe(el));
        const fallback = setTimeout(showAll, 2500);
        return () => { io.disconnect(); clearTimeout(fallback); };
    }, [reduce]);

    useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

    const say = (msg: string) => {
        setToast(msg);
        setToastOn(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastOn(false), 2600);
    };
    const start = () => onStart();
    const soon = () => say(SOON_MSG);
    const webtoon = () => say(WEBTOON_MSG);

    return (
        <div className="eb-root" ref={rootRef} role="dialog" aria-modal="true" aria-label="웹툰 은비 진입화면">
            <style>{CSS}</style>
            <header className="eb-top">
                <span className="eb-mark">은비<small aria-hidden="true">♥</small></span>
                <button className="eb-close" type="button" aria-label="닫기" onClick={onClose}>✕</button>
            </header>

            <section className="eb-hero" ref={heroRef} aria-label="은비 소개">
                <div className="eb-stage">
                    <div className="eb-layer eb-l-bg" ref={bgRef} />
                    <div className="eb-layer eb-l-glow" ref={glowRef}><i /></div>
                    <div className="eb-layer eb-l-girl" ref={girlRef}>
                        <div className="eb-girlwrap">
                            <div className="eb-bubblewrap" ref={bubbleWrapRef}>
                                <div className={`eb-bubble${bubbleOut ? ' out' : ''}`} aria-hidden="true">{BUBBLE_LINES[line]}</div>
                            </div>
                            <div className="eb-girlmask">
                                <video ref={videoRef} src="/eunbi/hero_eunbi_loop.mp4" poster="/eunbi/hero_eunbi_916.jpg"
                                       muted loop playsInline autoPlay={!reduce} preload={reduce ? 'none' : 'auto'} width={720} height={1280}
                                       aria-label="손을 흔들며 인사하는 웹툰 그림체의 은비" />
                            </div>
                        </div>
                    </div>
                    <div className="eb-layer eb-l-veil" aria-hidden="true" />
                    <div className="eb-layer eb-l-fx" ref={fxRef} aria-hidden="true">
                        {!reduce && fx.map((d, i) => (
                            <span key={i} className={`eb-fx${d.star ? ' s' : ''}`}
                                  style={{ left: `${d.left}%`, top: `${d.top}%`, fontSize: `${d.size}px`, opacity: d.opacity,
                                           animationDelay: `${d.delay}s`, ['--d' as string]: `${d.dur}s` } as React.CSSProperties}>
                                {d.star ? '✦' : '♥'}
                            </span>
                        ))}
                    </div>
                    <div className="eb-copy" ref={copyRef}>
                        <span className="eb-eyebrow">♥ 웹툰에서 걸어 나온 나만의 AI 친구</span>
                        <h1 className="eb-title"><span className="ai">AI</span>은비<span className="heart" aria-hidden="true">♥</span></h1>
                        <p className="eb-sub">설레는 은비와의 이야기, 지금부터 시작해요</p>
                        <p className="eb-quote">“오늘도, 내 이야기 들어줄 거지?”</p>
                    </div>
                    <div className="eb-scrollhint" aria-hidden="true">아래로 스크롤<i /></div>
                </div>
            </section>

            <main className="eb-main">
                <div className="eb-wrap">
                    <section className="eb-panel eb-reveal" aria-labelledby="eb-h-main">
                        <h2 className="eb-h2" id="eb-h-main">은비랑 뭐 할까?</h2>
                        <div className="eb-actions">
                            <button className="eb-act" type="button" aria-label="AI 채팅" onClick={start}>
                                <span className="ic" aria-hidden="true">💬</span><b>AI 채팅</b><span className="d">은비와 실시간으로 대화해요</span>
                            </button>
                            <button className="eb-act is-soon" type="button" aria-label="스토리 모드 · 곧 만나요" onClick={soon}>
                                <em className="eb-soon">곧 만나요</em><span className="ic" aria-hidden="true">📖</span><b>스토리 모드</b><span className="d">은비와 함께하는 특별한 이야기</span>
                            </button>
                            <button className="eb-act is-soon" type="button" aria-label="선물하기 · 곧 만나요" onClick={soon}>
                                <em className="eb-soon">곧 만나요</em><span className="ic" aria-hidden="true">🎁</span><b>선물하기</b><span className="d">마음을 전하고 호감도를 올려요</span>
                            </button>
                            <button className="eb-act is-soon" type="button" aria-label="웹툰 보기 · 은비 웹툰 곧 연재" onClick={webtoon}>
                                <em className="eb-soon">곧 연재</em><span className="ic" aria-hidden="true">🖼️</span><b>웹툰 보기</b><span className="d">은비 웹툰 · 곧 연재</span>
                            </button>
                        </div>
                    </section>

                    <div className="eb-ctas inline eb-reveal">
                        <button className="eb-cta" type="button" onClick={start}>은비와 이야기 시작하기 ♥</button>
                        <button className="eb-cta ghost" type="button" onClick={webtoon}>은비 웹툰 · 곧 연재 ✨</button>
                    </div>

                    <div className="eb-twin">
                        <section className="eb-panel eb-reveal" aria-labelledby="eb-h-play">
                            <h2 className="eb-h2" id="eb-h-play">은비랑 같이 해봐요</h2>
                            <div className="eb-chibis">
                                <button className="eb-chibi" type="button" aria-label="헤어 체인지" onClick={() => onFeature('hair')}>
                                    <img src="/eunbi/chibi_hair.jpg" alt="" width={76} height={76} />
                                    <div><b>헤어 체인지</b><span className="d">내 사진으로 새 헤어 미리보기</span></div>
                                </button>
                                <button className="eb-chibi" type="button" aria-label="프로필 화보" onClick={() => onFeature('outfit')}>
                                    <img src="/eunbi/chibi_outfit.jpg" alt="" width={76} height={76} />
                                    <div><b>프로필 화보</b><span className="d">내 얼굴로 실사·지브리 프사</span></div>
                                </button>
                                <button className="eb-chibi" type="button" aria-label="말투 변형 · 곧 만나요" onClick={soon}>
                                    <img src="/eunbi/chibi_tone.jpg" alt="" width={76} height={76} />
                                    <div><b>말투 변형</b><span className="d">은비 말투를 바꿔볼까?</span></div>
                                    <em className="eb-soon">곧 만나요</em>
                                </button>
                                <button className="eb-chibi" type="button" aria-label="이모티콘 · 곧 만나요" onClick={soon}>
                                    <img src="/eunbi/chibi_emoji.jpg" alt="" width={76} height={76} />
                                    <div><b>이모티콘</b><span className="d">은비 이모티콘으로 마음 전하기</span></div>
                                    <em className="eb-soon">곧 만나요</em>
                                </button>
                            </div>
                        </section>

                        <section className="eb-panel eb-reveal eb-webtoon" aria-labelledby="eb-h-wt">
                            <h2 className="eb-h2" id="eb-h-wt">웹툰 《은비》 <span className="pill">곧 연재</span></h2>
                            <button className="eb-wt-card" type="button" aria-label="웹툰 《은비》 티저 · 곧 연재" onClick={webtoon}>
                                <img src="/eunbi/webtoon_teaser.jpg" alt="" width={720} height={538} />
                                <span className="tag">티저</span>
                                <span className="cap"><b>벚꽃 카페에서 만난 날</b>은비의 하루가 웹툰으로 찾아와요</span>
                            </button>
                            <div className="eb-eps" role="list" aria-label="연재 예정 회차">
                                {[['1화', '처음 만난 날'], ['2화', '함께하는 일상'], ['3화', '비밀이 생겼어'], ['4화', '설레는 마음'], ['5화', '우리의 약속']].map(([n, t]) => (
                                    <div className="eb-ep" role="listitem" key={n}><b>{n}</b>{t}</div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </main>

            <div className="eb-dock">
                <button className="eb-cta" type="button" onClick={start}>은비와 이야기 시작하기 ♥</button>
            </div>
            <div className={`eb-toast${toastOn ? ' show' : ''}`} role="status">{toast}</div>
        </div>
    );
};
