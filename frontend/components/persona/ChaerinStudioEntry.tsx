import React, { useEffect, useRef, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 윤채린 전용 진입 화면 — "AI 스튜디오".
//
// 왜 별도 화면인가(2026-09-06 사장 지시): 페르소나에 들어가면 채팅창이 먼저 보여
// **무엇을 할 수 있는지 안 보인다**. 윤채린은 얼굴을 바꿔주는 기능이 넷인데
// 전부 기능 카드로 흩어져 있어 "AI 스튜디오"라는 정체가 드러나지 않았다.
//
// ★계약은 도결(SajuEntry)·서아(SeoaNewsDeskEntry)와 **똑같다** —
//   onStart()=채팅, onFeature(key)=그 기능, onClose()=닫기, onInvite()=초대.
//   App.tsx는 이 컴포넌트의 존재를 모른다(분기는 PersonaEntrySheet 안에서 한다).
//   ★★App.tsx를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ).
//
// ★시안에서 배운 것(사장 지적 3회): "AI 스튜디오"인데 평범한 사진만 있으면 그냥
//   사진관이다. **AI가 만든 티가 나는 결과물**(지브리·피규어·웹툰)이 화면에 있어야
//   이 페르소나가 무엇인지 증명된다. 자세한 경위는 메모리 feedback_design_identity_first.
//
// ★사진을 한 번만 받아 여러 기능에 재사용하는 것은 **일부러 넣지 않았다**(사장 확정).
//   기능마다 activate 를 흉내내면 이중과금이 난다(도결에서 실제로 터진 사고).
//   지금은 기존대로 각 기능 보드가 자기 사진을 받는다.

const IMG = {
    age4:  '/chaerin/age-4.jpg',
    age25: '/chaerin/age-25.jpg',
    ghibli:  '/chaerin/style-ghibli.jpg',
    figure:  '/chaerin/style-figure.jpg',
    webtoon: '/chaerin/style-webtoon.jpg',
    hair:    '/chaerin/style-hair.jpg',
    menuAge:    '/chaerin/menu-age.jpg',
    menuOutfit: '/chaerin/menu-outfit.jpg',
} as const;

/** 모션 감소 설정 — 어지럼증 접근성. 켜져 있으면 움직임을 전부 끈다. */
const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** AI 변신 레일 — 같은 사람을 스타일만 바꾼 결과물. 이게 "AI 스튜디오"의 증거다. */
const STYLES: { img: string; label: string; cap: string; feature?: string }[] = [
    { img: IMG.ghibli,  label: '지브리풍', cap: 'ANIME' },
    { img: IMG.figure,  label: '피규어',   cap: '3D TOY' },
    { img: IMG.webtoon, label: '웹툰',     cap: 'ILLUST' },
    { img: IMG.hair,    label: '헤어 체인지', cap: 'STYLE', feature: 'hair' },
];

/** 촬영 메뉴 — featureKey 는 App.tsx 의 FEATURE_ACTIONS 와 같은 키여야 한다(실측 확인). */
const MENU: { key: string; name: string; desc: string; cost: string; thumb?: string }[] = [
    { key: 'agetransform', name: '시간여행',   desc: '열 살부터 여든까지, 그때의 나', cost: '100P', thumb: IMG.menuAge },
    { key: 'hair',         name: '헤어스타일', desc: '48종 중에서 오늘의 머리',       cost: '200P', thumb: IMG.hair },
    { key: 'outfit',       name: '전통의상',   desc: '나라별 전통의상 전신 화보',     cost: '200P', thumb: IMG.menuOutfit },
    { key: 'lookalike',    name: '닮은꼴',     desc: '당신과 닮은 얼굴 찾기',         cost: '무료' },
];

// 스타일은 이 컴포넌트 전용 CSS로 닫아둔다 — 기존 사이트는 밝은 톤이라
// Tailwind 유틸리티를 쓰면 암실 톤이 섞인다. 밖으로 새지 않게 `cs-` 접두사.
const CSS = `
.cs-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:#141013;color:#F3EDEF;-webkit-font-smoothing:antialiased;
  font-family:'Pretendard',system-ui,-apple-system,sans-serif}
.cs-sheet{position:relative;width:100%;max-width:430px;margin:0 auto;min-height:100%;
  padding-bottom:max(40px,env(safe-area-inset-bottom))}
/* 필름 그레인 — 암실 톤. 이미지 파일 없이 SVG 노이즈로 만든다(로딩 0). */
.cs-grain{position:fixed;inset:0;max-width:430px;margin:0 auto;pointer-events:none;z-index:50;
  opacity:.045;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")}
.cs-serif{font-family:'Noto Serif KR','Nanum Myeongjo',serif}

.cs-close{position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;z-index:60;
  width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.10);
  background:rgba(0,0,0,.5);color:#A2949B;font-size:16px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center}

.cs-top{padding:34px 22px 4px;text-align:center}
.cs-sign{font-size:10.5px;letter-spacing:.4em;color:#E8B4B8;opacity:.9;margin-bottom:11px}
.cs-top h1{margin:0 0 8px;font-size:25px;line-height:1.36;font-weight:300}
.cs-top h1 b{font-weight:700;color:#E8B4B8}
.cs-top p{margin:0;font-size:12.5px;color:#A2949B;line-height:1.7}
.cs-rise{opacity:0;transform:translateY(12px);animation:cs-rise .7s cubic-bezier(.22,.8,.3,1) forwards}
.cs-d1{animation-delay:.05s} .cs-d2{animation-delay:.15s} .cs-d3{animation-delay:.25s}
@keyframes cs-rise{to{opacity:1;transform:none}}

/* 히어로 — 네 살 ↔ 스물다섯. 두 장은 눈높이를 맞춰 만들었다(정렬이 어긋나면 얼굴이 튄다). */
.cs-ba{margin:20px auto 0;width:252px;aspect-ratio:3/4;position:relative;cursor:ew-resize;
  border-radius:3px;overflow:hidden;background:#241C21;touch-action:pan-y;
  box-shadow:0 18px 40px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.06);
  opacity:0;animation:cs-rise .8s cubic-bezier(.22,.8,.3,1) .3s forwards}
.cs-side{position:absolute;inset:0;background-size:cover;background-position:center top}
.cs-lamp{position:absolute;inset:-40%;z-index:2;pointer-events:none;
  background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.22) 50%,transparent 60%);
  animation:cs-lamp 4.6s ease-in-out infinite}
@keyframes cs-lamp{0%,100%{transform:translateX(-46%)}50%{transform:translateX(46%)}}
.cs-handle{position:absolute;top:0;bottom:0;width:2px;background:#fff;z-index:3;
  box-shadow:0 0 12px rgba(0,0,0,.45)}
.cs-handle::after{content:'⇄';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:32px;height:32px;border-radius:50%;background:#fff;color:#141013;
  display:flex;align-items:center;justify-content:center;font-size:13px;
  box-shadow:0 3px 10px rgba(0,0,0,.4)}
.cs-tag{position:absolute;bottom:11px;z-index:3;font-size:10px;letter-spacing:.12em;
  padding:4px 10px;border-radius:2px;background:rgba(0,0,0,.5);color:#fff;font-weight:600}
.cs-tag-l{left:11px} .cs-tag-r{right:11px}
.cs-cap{text-align:center;font-size:10.5px;color:#A2949B;opacity:.7;margin-top:9px}

.cs-hd{display:flex;align-items:baseline;justify-content:space-between;padding:0 22px;margin:26px 0 12px}
.cs-hd b{font-size:12.5px;letter-spacing:.16em;color:#E8B4B8;font-weight:700}
.cs-hd span{font-size:10px;color:#A2949B;letter-spacing:.08em}

.cs-rail{display:flex;gap:11px;padding:0 22px 12px;overflow-x:auto;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
  scrollbar-width:none}
.cs-rail::-webkit-scrollbar{display:none}
.cs-shot{flex:0 0 auto;scroll-snap-align:center;width:128px;background:#0A0709;
  padding:8px 7px;border-radius:3px;position:relative;cursor:pointer;border:0;
  box-shadow:0 12px 28px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.05);
  transform:rotate(var(--rot,0deg));transition:transform .22s}
.cs-shot:hover{transform:rotate(0deg) translateY(-5px)}
.cs-pic{position:relative;aspect-ratio:3/4;overflow:hidden;background:#241C21;border-radius:1px}
.cs-pic img{width:100%;height:100%;object-fit:cover;display:block}
.cs-lb{position:absolute;left:0;right:0;bottom:0;padding:14px 7px 5px;
  font-size:9.5px;letter-spacing:.06em;color:#fff;font-weight:600;text-align:left;
  background:linear-gradient(transparent,rgba(0,0,0,.62));text-shadow:0 1px 3px rgba(0,0,0,.9)}
.cs-shotcap{margin-top:7px;text-align:center;font-size:8.5px;letter-spacing:.16em;
  color:#C48B92;opacity:.85}
/* 현상되듯 등장 */
.cs-dev img{animation:cs-develop 2.2s ease-out backwards}
@keyframes cs-develop{
  0%{opacity:0;filter:saturate(0) contrast(.6) brightness(.45)}
  100%{opacity:1;filter:none}}

.cs-menu{padding:22px 22px 0}
.cs-row{display:flex;align-items:center;gap:13px;padding:14px 2px;width:100%;
  border:0;border-bottom:1px solid rgba(255,255,255,.055);cursor:pointer;
  background:transparent;color:inherit;text-align:left;font:inherit;
  transition:padding-left .18s,background .18s}
.cs-row:hover{padding-left:7px;background:rgba(232,180,184,.045)}
.cs-th{width:44px;height:56px;flex:0 0 44px;border-radius:2px;overflow:hidden;background:#241C21;
  display:flex;align-items:center;justify-content:center;font-size:18px}
.cs-th img{width:100%;height:100%;object-fit:cover;display:block}
.cs-bd{flex:1;min-width:0}
.cs-row b{display:block;font-size:14px;font-weight:500;margin-bottom:3px}
.cs-row small{display:block;font-size:11px;color:#A2949B;line-height:1.5}
.cs-pt{font-size:10.5px;color:#E8B4B8;white-space:nowrap}

.cs-talk{margin:24px 20px 0;padding:16px 17px;border-radius:15px;cursor:pointer;width:calc(100% - 40px);
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.10);color:inherit;
  display:flex;align-items:center;gap:13px;text-align:left;font:inherit}
.cs-av{width:42px;height:42px;border-radius:50%;flex:0 0 42px;
  background:linear-gradient(140deg,#E8B4B8,#C48B92);
  display:flex;align-items:center;justify-content:center;font-size:19px}
.cs-talk b{display:block;font-size:13.5px;margin-bottom:3px;font-weight:500}
.cs-talk small{font-size:11px;color:#A2949B}
.cs-go{margin-left:auto;color:#A2949B;animation:cs-nudge 1.9s ease-in-out infinite}
@keyframes cs-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}

.cs-invite{display:block;margin:12px 20px 0;padding:12px;border-radius:13px;width:calc(100% - 40px);
  background:transparent;border:1px dashed rgba(232,180,184,.3);color:#C48B92;
  font-size:11.5px;cursor:pointer;font:inherit;text-align:center}

.cs-foot{padding:22px 22px 0;text-align:center;font-size:10px;color:#6A5F65;line-height:1.7}

@media (prefers-reduced-motion:reduce){
  .cs-rise,.cs-ba{opacity:1!important;transform:none!important;animation:none!important}
  .cs-lamp,.cs-go,.cs-dev img{animation:none!important}
}
`;

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

export const ChaerinStudioEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, onInvite }) => {
    const baRef = useRef<HTMLDivElement>(null);
    const afterRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<HTMLDivElement>(null);
    /** 사람이 손대면 자동 재생을 '양보'한다 — 만지는 중에 기계가 끼어들면 조작감이 망가진다. */
    const manualRef = useRef(false);
    const [reduce] = useState(prefersReducedMotion);

    /** 슬라이더 위치 적용. 3~97% 로 묶어 라벨이 잘리거나 한쪽이 사라지지 않게 한다. */
    const setSplit = (pct: number) => {
        const p = Math.max(3, Math.min(97, pct));
        if (afterRef.current) afterRef.current.style.clipPath = `inset(0 0 0 ${p}%)`;
        if (handleRef.current) handleRef.current.style.left = `${p}%`;
    };

    // 자동 재생 — 4.4초 주기로 좌우를 오간다.
    // ★cleanup 에서 반드시 취소한다. 안 하면 화면을 닫아도 rAF 가 계속 돌아 메모리가 샌다.
    useEffect(() => {
        if (reduce) { setSplit(50); return; }
        let raf = 0;
        const t0 = performance.now();
        const tick = (now: number) => {
            if (manualRef.current) return;          // 사람이 잡았으면 멈춘다(다시 시작하지 않는다)
            const t = (now - t0) / 1000;
            const w = (Math.sin(t * 2 * Math.PI / 4.4) + 1) / 2;         // 0..1
            const e = w < .5 ? 2 * w * w : 1 - Math.pow(-2 * w + 2, 2) / 2; // easeInOutQuad
            setSplit(18 + e * 64);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [reduce]);

    /** 포인터로 직접 조작. pointer 이벤트 하나로 마우스·터치를 함께 받는다. */
    const takeOver = (clientX: number) => {
        manualRef.current = true;
        const el = baRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setSplit(((clientX - r.left) / r.width) * 100);
    };
    const onPointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        takeOver(e.clientX);
    };
    const onPointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 0 && e.pointerType === 'mouse') return;
        if (manualRef.current) takeOver(e.clientX);
    };

    const who = guide.personaName || guide.title || '윤채린';

    return (
        <div className="cs-root" role="dialog" aria-modal="true" aria-label={`${who} AI 스튜디오`}>
            <style>{CSS}</style>
            <div className="cs-grain" aria-hidden="true" />
            <div className="cs-sheet">
                <button className="cs-close" onClick={onClose} aria-label="닫기">✕</button>

                <div className="cs-top">
                    <div className="cs-sign cs-rise cs-d1">CHAERIN AI STUDIO</div>
                    <h1 className="cs-serif cs-rise cs-d2">오늘은 어떤 나로<br /><b>바꿔드릴까요?</b></h1>
                    <p className="cs-rise cs-d3">사진 한 장이면<br />다른 세계의 내가 됩니다</p>
                </div>

                {/* 히어로 — 시간여행을 말이 아니라 눈으로 보여준다 */}
                <div
                    className="cs-ba"
                    ref={baRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    role="img"
                    aria-label="네 살과 스물다섯을 비교하는 시간여행 예시 이미지"
                >
                    <div className="cs-side" style={{ backgroundImage: `url(${IMG.age4})` }} />
                    <div className="cs-side" ref={afterRef}
                         style={{ backgroundImage: `url(${IMG.age25})`, clipPath: 'inset(0 0 0 50%)' }} />
                    {!reduce && <div className="cs-lamp" aria-hidden="true" />}
                    <div className="cs-handle" ref={handleRef} style={{ left: '50%' }} aria-hidden="true" />
                    <span className="cs-tag cs-tag-l">네 살</span>
                    <span className="cs-tag cs-tag-r">스물다섯</span>
                </div>
                <div className="cs-cap">시간여행 — 손으로 밀어보세요</div>

                {/* AI 변신 — "AI가 만든 티"가 나는 결과물. 이게 이 화면의 정체다. */}
                <div className="cs-hd"><b>AI 변신</b><span>옆으로 넘기기 →</span></div>
                <div className="cs-rail">
                    {STYLES.map((s, i) => (
                        <button
                            key={s.label}
                            type="button"
                            className={`cs-shot${reduce ? '' : ' cs-dev'}`}
                            style={{ ['--rot' as string]: `${[-1.4, 1, -.7, 1.2][i] ?? 0}deg` }}
                            onClick={() => onFeature(s.feature ?? 'agetransform')}
                        >
                            <div className="cs-pic">
                                <img src={s.img} alt={s.label} loading="lazy"
                                     style={{ animationDelay: `${.55 + i * .2}s` }} />
                                <span className="cs-lb">{s.label}</span>
                            </div>
                            <div className="cs-shotcap">{s.cap}</div>
                        </button>
                    ))}
                </div>

                {/* 촬영 메뉴 — 사진관 가격표 */}
                <div className="cs-menu">
                    {MENU.map(m => (
                        <button key={m.key} type="button" className="cs-row" onClick={() => onFeature(m.key)}>
                            <span className="cs-th">
                                {m.thumb ? <img src={m.thumb} alt="" loading="lazy" /> : '✨'}
                            </span>
                            <span className="cs-bd">
                                <b>{m.name}</b>
                                <small>{m.desc}</small>
                            </span>
                            <span className="cs-pt">{m.cost}</span>
                        </button>
                    ))}
                </div>

                <button type="button" className="cs-talk" onClick={() => onStart()}>
                    <span className="cs-av">💄</span>
                    <span>
                        <b>{who}에게 물어보기</b>
                        <small>피부·화장·스타일 상담</small>
                    </span>
                    <span className="cs-go">›</span>
                </button>

                <button type="button" className="cs-invite" onClick={onInvite}>
                    친구 초대하고 포인트 받기
                </button>

                <div className="cs-foot">
                    예시 인물은 AI로 만든 가상 이미지입니다
                </div>
            </div>
        </div>
    );
};
