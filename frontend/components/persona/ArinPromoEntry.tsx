import React, { useEffect, useRef, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 이아린 전용 진입 화면 — "우리 동네 가게 홍보".
//
// 왜 별도 화면인가(2026-09-07 사장 지시): 아린은 담당 기능이 5개인데 전부 기능 카드로
// 흩어져 있어 "가게 홍보를 맡아주는 곳"이라는 정체가 드러나지 않았다.
//
// ★정체성(사장 확정): **내 가게 홍보해주는 곳**. 처음엔 인플루언서 인물 컨셉이었으나
//   "컨셉을 인플루언서로 안 봐도 됨. 여러 업종 가게를 움직이게 하는 페이퍼 영상"으로 바뀌었고,
//   이어서 "아린이가 하나씩 불러오는 느낌, 소환하는 느낌"으로 확정됐다.
//
// ★업계 조사로 설계했다(추측 아님):
//   · **얼굴 없는 릴스가 이미 하나의 장르** — 손과 결과물만 밝게 찍는다.
//   · 구성은 **7~12초 4단**: 결과물 → 손동작 하나 → 결과 재노출 → 지역명+예약/문의.
//     이 공식을 화면 하단 진행 칩으로 그대로 노출한다.
//   · **업종별로 찍는 소품이 정해져 있다** — 미용=가위, 학원=교재·칠판, 카페=크림 붓기 …
//   · 🔴**의료광고는 사전심의 대상**이다. 병원 카드에 "· 심의 확인"을 남겨 알린다
//     (빼서 모르게 두는 것보다 알려주는 쪽이 실무에 낫다 — 사장 확정).
//
// ★계약은 도결·서아·윤채린과 **똑같다** — onStart()=채팅, onFeature(key)=그 기능,
//   onClose()=닫기, onInvite()=초대. App.tsx는 이 컴포넌트의 존재를 모른다.
//   ★★App.tsx를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ).
//
// ★소품 그림은 전부 **인라인 SVG**다(외부 파일 0KB). 인물만 이미지 1장(59KB).

/** 아린 종이 컷아웃 — 배경을 실제로 지운 누끼.
 *  ★CSS 마스크로 사진 가장자리를 흐리는 방식은 **실패했다**(배경이 꽉 찬 사진이라
 *    아무리 흐려도 사각 티가 남는다). 배경을 지우는 것이 근본 해결이었다. */
const ARIN_IMG = '/arin/arin-palm.webp';

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 업종 카드 — 조사한 "업종별 소품 표"를 그대로 옮겼다. */
interface Trade {
    key: string;
    cap: string;      // 영문 뱃지
    shop: string;
    tone: string;     // 종이 색
    chipColor: string;
    first: string;    // 0-3초
    second: string;   // 3-8초
    warn?: string;    // 실무 주의(의료광고 심의 등)
}

const TRADES: Trade[] = [
    { key: 'cafe',   cap: 'CAFE',   shop: '동네 카페',   tone: '#F6E8DA', chipColor: '#8B5E2B', first: '완성된 라떼 한 컷', second: '크림을 붓는 손' },
    { key: 'hair',   cap: 'HAIR',   shop: '동네 미용실', tone: '#E9E3F5', chipColor: '#6B4FA0', first: '완성된 스타일',     second: '가위와 드라이 손동작' },
    { key: 'study',  cap: 'STUDY',  shop: '동네 학원',   tone: '#DCEBE4', chipColor: '#2E7D5B', first: '오늘 배울 것 한 줄', second: '교재와 칠판 클로즈업' },
    { key: 'food',   cap: 'FOOD',   shop: '동네 음식점', tone: '#FBE3E3', chipColor: '#C0392B', first: '김 나는 대표 메뉴', second: '국물 붓고 고명 올리기' },
    { key: 'clinic', cap: 'CLINIC', shop: '동네 병원',   tone: '#DCEAF2', chipColor: '#2A6E8F', first: '진료 안내 한 화면', second: '예약 시간 고르기', warn: '심의 확인' },
];

/** 릴스 4단 공식(조사 결과) — 카드가 도는 동안 순서대로 켜진다. */
const STEPS = ['결과물', '손동작', '다시 보기', '예약·문의'];

/** 맡길 수 있는 일 — featureKey 는 App.tsx FEATURE_ACTIONS 와 같아야 한다(실측 확인).
 *  ★단가는 사장 관리 항목이라 숫자를 박지 않는다(MenuLimit 정본). */
const MENU: { key: string; icon: string; name: string; desc: string; free?: boolean }[] = [
    { key: 'marketing',     icon: '✍️', name: 'AI 마케팅 글쓰기', desc: '글·해시태그·측정안까지 한 번에', free: true },
    { key: 'shorts-maker',  icon: '🎬', name: '쇼츠 만들기',      desc: '사진 1장 → 시나리오 5개 → 영상' },
    { key: 'hotkeyword',    icon: '🔥', name: '핫 키워드',        desc: '지금 뭐가 잘 팔리는지 먼저 확인' },
    { key: 'used',          icon: '🛍️', name: '중고 판매글',      desc: '사진 한 장이면 팔리는 판매글 완성' },
];

const CSS = `
.ap-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:linear-gradient(180deg,#F6EFF2 0%,#EDE7EA 100%);
  font-family:'Pretendard',system-ui,-apple-system,sans-serif;color:#2A2028;
  -webkit-font-smoothing:antialiased}
.ap-root img{max-width:100%;height:auto;display:block}
.ap-sheet{position:relative;max-width:520px;margin:0 auto;min-height:100%;
  background:#FDF8F5;box-shadow:0 0 60px rgba(60,40,55,.14)}
.ap-close{position:absolute;top:14px;right:14px;z-index:9;width:38px;height:38px;
  border-radius:50%;border:1px solid rgba(142,111,183,.16);background:rgba(255,255,255,.92);
  color:#6B5F68;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}

/* 종이 질감 — SVG 필터라 파일 0KB. ★pointer-events:none 없으면 이 층이 클릭을 다 먹는다. */
.ap-sheet::before{content:'';position:absolute;inset:0;z-index:1;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23p)' opacity='.42'/%3E%3C/svg%3E");
  mix-blend-mode:multiply;opacity:.085}
@media (prefers-reduced-motion:no-preference){.ap-sheet::before{animation:ap-grain 12s steps(6) infinite}}
@keyframes ap-grain{0%,100%{transform:translate(0,0)}16%{transform:translate(-2%,1%)}
  33%{transform:translate(1%,-2%)}50%{transform:translate(-1%,-1%)}
  66%{transform:translate(2%,1%)}83%{transform:translate(1%,2%)}}
.ap-sheet>*{position:relative;z-index:2}

.ap-stage{position:relative;padding:52px 20px 26px;overflow:hidden;
  background:linear-gradient(165deg,#FFF6F9 0%,#F4EEF8 55%,#EFE9F3 100%)}
.ap-confetti{position:absolute;inset:0;pointer-events:none;opacity:.5}
.ap-confetti span{position:absolute;width:10px;height:13px;border-radius:2px;opacity:.55}
.ap-confetti span:nth-child(1){left:8%;top:14%;background:#F6E8DA;transform:rotate(-18deg)}
.ap-confetti span:nth-child(2){right:11%;top:9%;background:#E9E3F5;transform:rotate(24deg)}
.ap-confetti span:nth-child(3){left:14%;bottom:18%;background:#DCEBE4;transform:rotate(12deg)}
.ap-confetti span:nth-child(4){right:9%;bottom:22%;background:#FBE3E3;transform:rotate(-30deg)}
@media (prefers-reduced-motion:no-preference){
  .ap-confetti span{animation:ap-float 7s ease-in-out infinite}
  .ap-confetti span:nth-child(2){animation-delay:-1.8s}
  .ap-confetti span:nth-child(3){animation-delay:-3.4s}
  .ap-confetti span:nth-child(4){animation-delay:-5.1s}}
@keyframes ap-float{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-11px) rotate(9deg)}}

.ap-kicker{position:relative;text-align:center;font-size:12px;font-weight:700;color:#8E6FB7;
  letter-spacing:.1em;margin-bottom:9px}
.ap-headline{position:relative;text-align:center;font-size:25px;font-weight:800;
  line-height:1.36;letter-spacing:-.025em;margin:0 0 6px}
.ap-sub{position:relative;text-align:center;font-size:13.5px;line-height:1.65;color:#6B5F68;margin:0 0 20px}

/* 소환 무대 — 아린이 손으로 받치고, 그 위에 업종 카드가 얹힌다. */
.ap-summon{position:relative;height:352px;margin:2px auto 0;max-width:360px}
/* ★아린 z-index 는 카드(5)보다 **위**여야 한다 — 아래면 손이 카드에 가려
   '받쳐 든' 게 아니라 그냥 옆에 선 사람으로 보인다(렌더로 확인). */
.ap-arin{position:absolute;right:-46px;bottom:0;width:206px;z-index:6;transform:rotate(1.5deg);
  filter:drop-shadow(0 10px 14px rgba(60,40,55,.26)) drop-shadow(0 2px 0 rgba(255,255,255,.85))}
/* 발이 화면 밖으로 잘리던 문제 — 아래를 페이드해 '종이가 배경에 스미게' 한다. */
.ap-arin img{width:100%;
  -webkit-mask-image:linear-gradient(180deg,#000 78%,rgba(0,0,0,.6) 92%,transparent 100%);
          mask-image:linear-gradient(180deg,#000 78%,rgba(0,0,0,.6) 92%,transparent 100%)}
@media (prefers-reduced-motion:no-preference){.ap-arin{animation:ap-bob 6s ease-in-out infinite}}
@keyframes ap-bob{0%,100%{transform:rotate(1.5deg) translateY(0)}50%{transform:rotate(.2deg) translateY(-5px)}}
.ap-beam{position:absolute;right:112px;bottom:120px;width:190px;height:160px;z-index:3;pointer-events:none;
  background:radial-gradient(closest-side at 78% 78%,rgba(216,92,149,.46),rgba(216,92,149,0) 72%);filter:blur(4px)}
@media (prefers-reduced-motion:no-preference){.ap-beam{animation:ap-beam 4.6s ease-in-out infinite}}
@keyframes ap-beam{0%,72%{opacity:.35}8%{opacity:.95}24%{opacity:.5}}

.ap-deck{position:absolute;left:14px;top:34px;width:206px;height:278px;z-index:5}
.ap-paper{position:absolute;inset:0;border-radius:16px;background:#fff;
  border:1px solid rgba(60,40,55,.10);padding:14px 14px 12px;display:flex;flex-direction:column;
  box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 18px 32px -20px rgba(60,40,55,.55);
  opacity:0;transform-origin:70% 100%;
  transform:translate(26px,58px) rotate(-8deg) scale(.34);
  transition:opacity .42s ease,transform .62s cubic-bezier(.16,.84,.3,1.05)}
.ap-paper.is-on{opacity:1;transform:translate(0,0) rotate(-1.5deg) scale(1);z-index:3}
.ap-paper.is-prev{opacity:.38;transform:translate(7px,-12px) rotate(3.5deg) scale(.95);z-index:2}
.ap-ptop{display:flex;align-items:center;gap:7px;margin-bottom:9px}
.ap-pchip{font-size:9.5px;font-weight:800;padding:4px 9px;border-radius:999px;letter-spacing:.02em}
.ap-pshop{font-size:11.5px;font-weight:700}
.ap-art{flex:1;border-radius:11px;display:flex;align-items:center;justify-content:center;
  margin-bottom:9px;overflow:hidden}
.ap-art svg{width:100%;height:100%}
.ap-pcap{font-size:11px;line-height:1.5;color:#6B5F68;margin:0}
.ap-pcap b{color:#2A2028;font-weight:700}
.ap-warn{color:#C0392B;font-style:normal}

.ap-steps{position:relative;display:flex;justify-content:center;gap:5px;margin-top:15px}
.ap-step{font-size:10.5px;color:#9A8D96;padding:4px 9px;border-radius:999px;
  background:rgba(255,255,255,.72);border:1px solid rgba(142,111,183,.10);transition:all .3s ease}
.ap-step.is-on{background:#2A2028;color:#fff;border-color:#2A2028}
.ap-dots{position:relative;display:flex;justify-content:center;gap:6px;margin-top:13px}
.ap-dot{width:7px;height:7px;border-radius:50%;background:rgba(60,40,55,.18);
  border:0;padding:0;cursor:pointer;transition:all .3s ease}
.ap-dot.is-on{background:#D85C95;width:20px;border-radius:999px}

.ap-sec{padding:26px 20px 0}
.ap-sectitle{font-size:16px;font-weight:800;letter-spacing:-.01em;margin:0 0 4px}
.ap-menu{display:flex;flex-direction:column;gap:9px;margin-top:14px}
.ap-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;
  padding:13px 14px;border-radius:14px;border:1px solid rgba(142,111,183,.16);background:#fff;
  cursor:pointer;font:inherit;color:inherit;transition:transform .12s ease,border-color .12s ease}
.ap-row:hover{border-color:rgba(216,92,149,.45);transform:translateY(-1px)}
.ap-row:active{transform:scale(.99)}
.ap-ico{flex:0 0 38px;height:38px;border-radius:11px;display:flex;align-items:center;
  justify-content:center;font-size:17px;background:#FDE6F0}
.ap-rowmain{flex:1;min-width:0}
.ap-rowname{font-size:14px;font-weight:700;line-height:1.35}
.ap-rowdesc{font-size:11.5px;color:#6B5F68;line-height:1.45;margin-top:2px}
.ap-cost{flex:0 0 auto;white-space:nowrap;font-size:11px;font-weight:700;color:#8E6FB7;
  background:#F3E9F4;padding:4px 9px;border-radius:999px}
.ap-cost.is-free{color:#2E7D5B;background:#E4F4EC}
.ap-aside{margin:24px 20px 0;padding:15px 16px;border-radius:14px;
  background:#F4F0F7;border:1px dashed rgba(142,111,183,.32)}
.ap-asidetop{font-size:11.5px;font-weight:700;color:#8E6FB7;letter-spacing:.04em;margin-bottom:8px}
.ap-ctas{padding:24px 20px 8px;display:flex;flex-direction:column;gap:9px}
.ap-cta{padding:15px;border-radius:14px;border:0;cursor:pointer;font:inherit;
  font-size:14.5px;font-weight:700;color:#fff;
  background:linear-gradient(135deg,#D85C95,#8E6FB7);box-shadow:0 10px 22px -12px rgba(216,92,149,.7)}
.ap-cta:active{transform:translateY(1px)}
.ap-cta2{padding:13px;border-radius:14px;background:#fff;border:1px solid rgba(142,111,183,.16);
  cursor:pointer;font:inherit;font-size:13.5px;font-weight:600;color:#6B5F68}
.ap-foot{padding:14px 20px 34px;font-size:11.5px;color:#9A8D96;line-height:1.65;text-align:center}

/* 소품 모션 — ★보이는 카드에서만 돈다(안 보이는 카드까지 돌면 배터리를 먹는다). */
@media (prefers-reduced-motion:no-preference){
  .ap-paper.is-on .pour{animation:ap-pour 3.4s ease-in infinite}
  .ap-paper.is-on .jug{transform-origin:104px 22px;animation:ap-jug 3.4s ease-in-out infinite}
  .ap-paper.is-on .foam{animation:ap-foam 3.4s ease-out infinite}
  .ap-paper.is-on .steam path{animation:ap-steam 2.6s ease-in-out infinite}
  .ap-paper.is-on .steam path:nth-child(2){animation-delay:.5s}
  .ap-paper.is-on .steam path:nth-child(3){animation-delay:1s}
  @keyframes ap-pour{0%{transform:translateY(-16px);opacity:0}18%{opacity:1}55%{transform:translateY(20px);opacity:1}70%,100%{transform:translateY(24px);opacity:0}}
  @keyframes ap-jug{0%,8%{transform:rotate(0)}22%,58%{transform:rotate(-13deg)}75%,100%{transform:rotate(0)}}
  @keyframes ap-foam{0%,50%{rx:14;opacity:.55}72%{rx:24;opacity:1}100%{rx:24;opacity:1}}
  @keyframes ap-steam{0%{opacity:0;transform:translateY(4px)}45%{opacity:.6}100%{opacity:0;transform:translateY(-9px)}}

  .ap-paper.is-on .blade-a{transform-origin:0 0;animation:ap-bladeA 1.5s ease-in-out infinite}
  .ap-paper.is-on .blade-b{transform-origin:0 0;animation:ap-bladeB 1.5s ease-in-out infinite}
  .ap-paper.is-on .snip path{animation:ap-snip 1.5s ease-in infinite}
  .ap-paper.is-on .snip path:nth-child(2){animation-delay:.75s}
  @keyframes ap-bladeA{0%,100%{transform:rotate(-11deg)}50%{transform:rotate(1deg)}}
  @keyframes ap-bladeB{0%,100%{transform:rotate(11deg)}50%{transform:rotate(-1deg)}}
  @keyframes ap-snip{0%,55%{opacity:0;transform:translateY(0)}65%{opacity:.6}100%{opacity:0;transform:translateY(22px)}}

  .ap-paper.is-on .w1{animation:ap-write 3.6s ease-out infinite}
  .ap-paper.is-on .w2{animation:ap-write 3.6s ease-out .5s infinite}
  .ap-paper.is-on .w3{animation:ap-write 3.6s ease-out 1s infinite}
  .ap-paper.is-on .chalk{animation:ap-chalk 3.6s ease-out infinite}
  .ap-paper.is-on .page{transform-origin:0 50%;animation:ap-pageflip 3.6s ease-in-out infinite}
  @keyframes ap-write{0%{stroke-dashoffset:60}30%,88%{stroke-dashoffset:0}100%{stroke-dashoffset:60}}
  @keyframes ap-chalk{0%{transform:translate(-30px,0)}30%{transform:translate(0,0)}55%{transform:translate(-30px,14px)}80%{transform:translate(10px,28px)}100%{transform:translate(-30px,0)}}
  @keyframes ap-pageflip{0%,55%{transform:rotateY(0);opacity:1}80%{transform:rotateY(-155deg);opacity:.25}100%{transform:rotateY(0);opacity:1}}

  .ap-paper.is-on .pour2{animation:ap-pour 3.2s ease-in infinite}
  .ap-paper.is-on .soup{animation:ap-soup 3.2s ease-out infinite}
  .ap-paper.is-on .garnish circle{animation:ap-drop 3.2s ease-in infinite}
  .ap-paper.is-on .garnish circle:nth-child(2){animation-delay:.35s}
  .ap-paper.is-on .steam2 path{animation:ap-steam 2.6s ease-in-out infinite}
  .ap-paper.is-on .steam2 path:nth-child(2){animation-delay:.7s}
  @keyframes ap-soup{0%,45%{rx:30;opacity:.7}70%{rx:42;opacity:.9}100%{rx:42;opacity:.9}}
  @keyframes ap-drop{0%,58%{opacity:0;transform:translateY(-26px)}70%{opacity:1}100%{opacity:1;transform:translateY(0)}}

  .ap-paper.is-on .cross{transform-origin:73px 35px;animation:ap-pulse 2.4s ease-in-out infinite}
  .ap-paper.is-on .slots rect:nth-child(2){animation:ap-slot 3.4s ease-in-out infinite}
  .ap-paper.is-on .check{animation:ap-draw 3.4s ease-out infinite}
  @keyframes ap-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.8}}
  @keyframes ap-slot{0%,40%{fill:#fff}55%,88%{fill:#DFF3E9}100%{fill:#fff}}
  @keyframes ap-draw{0%,45%{stroke-dashoffset:30}62%,88%{stroke-dashoffset:0}100%{stroke-dashoffset:30}}
}

@media (min-width:520px){
  .ap-stage{padding:44px 24px 24px}
  .ap-summon{height:376px;max-width:392px}
  .ap-arin{width:224px;right:-40px}
  .ap-deck{width:232px;height:314px}
  .ap-headline{font-size:27px}
}
@media (prefers-reduced-motion:reduce){
  .ap-root *{animation:none!important;transition:none!important}
}
`;

/** 업종별 소품 그림. ★조사한 "업종별 촬영 요소" 표를 그림으로 옮긴 것이다. */
const Art: React.FC<{ kind: string }> = ({ kind }) => {
    if (kind === 'cafe') return (
        <svg viewBox="0 0 200 130" role="img" aria-label="커피잔에 크림이 부어지는 장면">
            <path d="M62 52 h58 v34 a29 29 0 0 1-58 0z" fill="#fff" stroke="#C9A57E" strokeWidth="2.5" />
            <path d="M120 58 a15 15 0 1 1 0 22" fill="none" stroke="#C9A57E" strokeWidth="2.5" />
            <path d="M66 60 h50 v25 a25 25 0 0 1-50 0z" fill="#8B5E2B" opacity=".85" />
            {/* 크림 피처와 손 — 캡션이 "크림을 붓는 손"이므로 손이 있어야 글과 그림이 맞는다 */}
            <g className="jug">
                <path d="M120 6 h30 a4 4 0 0 1 4 4 v16 a4 4 0 0 1-4 4 h-30 l-16-8 z" fill="#fff" stroke="#C9A57E" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="M154 12 a9 9 0 0 1 0 14" fill="none" stroke="#C9A57E" strokeWidth="2.2" />
                <path d="M150 16 h13 a5 5 0 0 1 0 10 h-13z" fill="#F0CBA8" stroke="#D9A97F" strokeWidth="1.8" />
            </g>
            <g className="pour"><rect x="96" y="18" width="5" height="26" rx="2.5" fill="#FFF6E8" /></g>
            <ellipse className="foam" cx="91" cy="61" rx="24" ry="6" fill="#FFF6E8" />
            <g className="steam" stroke="#C9A57E" strokeWidth="2" fill="none" opacity=".55" strokeLinecap="round">
                <path d="M80 40 q5-8 0-15" /><path d="M92 38 q5-9 0-17" /><path d="M104 40 q5-8 0-15" />
            </g>
            <ellipse cx="42" cy="100" rx="9" ry="6" fill="#6F4520" transform="rotate(-25 42 100)" />
            <ellipse cx="156" cy="98" rx="9" ry="6" fill="#6F4520" transform="rotate(18 156 98)" />
        </svg>
    );
    if (kind === 'hair') return (
        <svg viewBox="0 0 200 130" role="img" aria-label="가위가 움직이며 머리를 다듬는 장면">
            {/* 얼굴은 그리지 않는다 — "얼굴 없는 릴스" 원칙 */}
            <ellipse cx="139" cy="62" rx="34" ry="42" fill="#fff" stroke="#B49AC9" strokeWidth="2.5" />
            <path d="M139 28 c-19 0-27 14-27 30 0 14 4 24 7 30 h40 c3-6 7-16 7-30 0-16-8-30-27-30z" fill="#6B4FA0" opacity=".22" />
            <g className="hair" stroke="#6B4FA0" strokeWidth="2.6" strokeLinecap="round" opacity=".8" fill="none">
                <path d="M124 40 q-4 24 1 42" /><path d="M133 36 q-3 26 1 46" />
                <path d="M145 36 q3 26-1 46" /><path d="M154 40 q4 24-1 42" />
            </g>
            {/* 두 날이 리벳(0,0)을 축으로 X 로 교차한다 */}
            <g transform="translate(54 58)">
                <g className="blade-a">
                    <path d="M0 0 L-13 -36" stroke="#9B8BC0" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="9" cy="20" r="8.5" fill="none" stroke="#9B8BC0" strokeWidth="3.6" />
                    <path d="M0 0 L7 12" stroke="#9B8BC0" strokeWidth="3.6" strokeLinecap="round" />
                </g>
                <g className="blade-b">
                    <path d="M0 0 L13 -36" stroke="#6B4FA0" strokeWidth="5" strokeLinecap="round" />
                    <circle cx="-9" cy="20" r="8.5" fill="none" stroke="#6B4FA0" strokeWidth="3.6" />
                    <path d="M0 0 L-7 12" stroke="#6B4FA0" strokeWidth="3.6" strokeLinecap="round" />
                </g>
                <circle cx="0" cy="0" r="3.6" fill="#4A3670" />
            </g>
            <g className="snip" stroke="#6B4FA0" strokeWidth="2.2" strokeLinecap="round" opacity=".6" fill="none">
                <path d="M40 30 q5-8 11-4" /><path d="M63 24 q6-7 12-2" />
            </g>
        </svg>
    );
    if (kind === 'study') return (
        <svg viewBox="0 0 200 130" role="img" aria-label="칠판에 글씨가 써지고 교재가 넘어가는 장면">
            <rect x="26" y="16" width="118" height="72" rx="6" fill="#2F4F42" />
            <rect x="26" y="16" width="118" height="72" rx="6" fill="none" stroke="#1F3A30" strokeWidth="3" />
            <g stroke="#EAF6EF" strokeWidth="3" fill="none" strokeLinecap="round">
                <path className="w1" d="M42 44 h30" strokeDasharray="30" strokeDashoffset="30" />
                <path className="w2" d="M42 58 h52" strokeDasharray="52" strokeDashoffset="52" />
                <path className="w3" d="M42 72 h38" strokeDasharray="38" strokeDashoffset="38" />
            </g>
            <rect className="chalk" x="72" y="40" width="12" height="5" rx="2.5" fill="#FFF" />
            <g transform="translate(150 62)">
                <rect x="0" y="0" width="34" height="44" rx="3" fill="#fff" stroke="#8FBBA6" strokeWidth="2" />
                <rect className="page" x="0" y="0" width="34" height="44" rx="3" fill="#F2FAF6" stroke="#8FBBA6" strokeWidth="2" />
                <g stroke="#8FBBA6" strokeWidth="2" strokeLinecap="round">
                    <path d="M7 12 h20" /><path d="M7 20 h20" /><path d="M7 28 h13" />
                </g>
            </g>
        </svg>
    );
    if (kind === 'food') return (
        <svg viewBox="0 0 200 130" role="img" aria-label="국물을 붓고 고명을 올리는 장면">
            <path d="M52 56 h96 a48 48 0 0 1-96 0z" fill="#fff" stroke="#D98880" strokeWidth="2.5" />
            <ellipse cx="100" cy="56" rx="48" ry="10" fill="#fff" stroke="#D98880" strokeWidth="2.5" />
            <ellipse className="soup" cx="100" cy="57" rx="42" ry="8" fill="#E8743B" opacity=".85" />
            <g className="pour2"><rect x="97" y="14" width="6" height="30" rx="3" fill="#E8743B" opacity=".9" /></g>
            <g className="garnish">
                <circle cx="84" cy="52" r="4" fill="#5CA75C" />
                <circle cx="112" cy="50" r="3.5" fill="#5CA75C" />
            </g>
            <g className="steam2" stroke="#D98880" strokeWidth="2" fill="none" opacity=".5" strokeLinecap="round">
                <path d="M84 40 q5-8 0-15" /><path d="M116 40 q5-8 0-15" />
            </g>
            <g stroke="#B9836F" strokeWidth="3" strokeLinecap="round">
                <path d="M156 96 l18-40" /><path d="M164 98 l18-40" />
            </g>
        </svg>
    );
    return (
        <svg viewBox="0 0 200 130" role="img" aria-label="진료 안내와 예약을 보여주는 장면">
            <rect x="30" y="20" width="86" height="76" rx="8" fill="#fff" stroke="#8FB8CC" strokeWidth="2.5" />
            <g className="cross">
                <rect x="63" y="32" width="20" height="7" rx="3.5" fill="#3D93B8" />
                <rect x="69.5" y="25.5" width="7" height="20" rx="3.5" fill="#3D93B8" />
            </g>
            <g stroke="#A9CADA" strokeWidth="3" strokeLinecap="round">
                <path d="M44 58 h58" /><path d="M44 70 h44" /><path d="M44 82 h52" />
            </g>
            <g className="slots">
                <rect x="128" y="34" width="44" height="16" rx="8" fill="#fff" stroke="#8FB8CC" strokeWidth="2" />
                <rect x="128" y="56" width="44" height="16" rx="8" fill="#fff" stroke="#8FB8CC" strokeWidth="2" />
                <rect x="128" y="78" width="44" height="16" rx="8" fill="#fff" stroke="#8FB8CC" strokeWidth="2" />
            </g>
            <path className="check" d="M137 64 l6 6 12-13" fill="none" stroke="#2E9E6B"
                strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="30" strokeDashoffset="30" />
        </svg>
    );
};

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

export const ArinPromoEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, onInvite }) => {
    const [reduce] = useState(prefersReducedMotion);
    const [idx, setIdx] = useState(0);
    const [prev, setPrev] = useState(-1);
    const [step, setStep] = useState(0);
    /** 사람이 점을 누르면 그때부터 자동 순환 타이머를 다시 센다. */
    const [manualAt, setManualAt] = useState(0);

    // 업종 카드 순환. ★탭이 백그라운드면 멈춘다 — 안 보이는 화면을 돌릴 이유가 없다.
    useEffect(() => {
        if (reduce) return;
        let alive = true;
        const t = setInterval(() => {
            if (!alive || document.hidden) return;
            setIdx(i => { setPrev(i); return (i + 1) % TRADES.length; });
        }, 4600);
        return () => { alive = false; clearInterval(t); };
    }, [reduce, manualAt]);

    // 4단 공식 칩 — 카드 한 장이 도는 동안 순서대로 켜진다.
    useEffect(() => {
        if (reduce) return;
        setStep(0);
        const t = setInterval(() => {
            if (document.hidden) return;
            setStep(s => (s + 1) % STEPS.length);
        }, 1150);
        return () => clearInterval(t);
    }, [idx, reduce]);

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const pick = (n: number) => { setPrev(idx); setIdx(n); setManualAt(Date.now()); };

    return (
        // 배경 클릭 = 닫기. 내용은 max-width로 묶여 있어 넓은 화면의 양옆이 배경이 된다.
        // ★이 화면은 시트 밖에 모달을 렌더하지 않는다(도결·서아에서 났던 버블링 사고 없음).
        <div className="ap-root" onClick={onClose}>
            <style>{CSS}</style>
            <div className="ap-sheet" onClick={e => e.stopPropagation()}
                 role="dialog" aria-modal="true" aria-label={`${guide.title} 소개`}>
                <button className="ap-close" onClick={onClose} aria-label="닫기">✕</button>

                <div className="ap-stage">
                    <div className="ap-confetti" aria-hidden="true"><span /><span /><span /><span /></div>

                    <div className="ap-kicker">우리 동네 가게 홍보</div>
                    <h2 className="ap-headline">업종만 말하세요<br />아린이가 꺼내 드릴게요</h2>
                    <p className="ap-sub">카페·미용실·학원·음식점·병원까지,<br />그 업종에 맞는 장면과 문구가 바로 나와요.</p>

                    {/* 소환 무대 — 아린이 손으로 받치고 그 위에 업종 카드가 얹힌다 */}
                    <div className="ap-summon">
                        <div className="ap-arin" aria-hidden="true"><img src={ARIN_IMG} alt="" /></div>
                        <div className="ap-beam" aria-hidden="true" />

                        <div className="ap-deck" role="region" aria-live="polite"
                             aria-label="업종별 홍보 영상 예시">
                            {TRADES.map((t, i) => (
                                <div key={t.key}
                                     className={`ap-paper${i === idx ? ' is-on' : ''}${i === prev && i !== idx ? ' is-prev' : ''}`}>
                                    <div className="ap-ptop">
                                        <span className="ap-pchip" style={{ background: t.tone, color: t.chipColor }}>{t.cap}</span>
                                        <span className="ap-pshop">{t.shop}</span>
                                    </div>
                                    <div className="ap-art" style={{ background: t.tone }}><Art kind={t.key} /></div>
                                    <p className="ap-pcap">
                                        <b>0-3초</b> {t.first}<br />
                                        <b>3-8초</b> {t.second}
                                        {t.warn && <em className="ap-warn"> · {t.warn}</em>}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 조사한 릴스 4단 공식 그대로 */}
                    <div className="ap-steps" aria-hidden="true">
                        {STEPS.map((s, i) => (
                            <span key={s} className={`ap-step${i === step ? ' is-on' : ''}`}>{s}</span>
                        ))}
                    </div>

                    <div className="ap-dots">
                        {TRADES.map((t, i) => (
                            <button key={t.key} className={`ap-dot${i === idx ? ' is-on' : ''}`}
                                    onClick={() => pick(i)} aria-label={`${t.shop} 예시`} />
                        ))}
                    </div>
                </div>

                <div className="ap-sec">
                    <h3 className="ap-sectitle">무엇을 맡기시겠어요?</h3>
                    <div className="ap-menu">
                        {MENU.map(m => (
                            <button key={m.key} className="ap-row" onClick={() => onFeature(m.key)}>
                                <div className="ap-ico">{m.icon}</div>
                                <div className="ap-rowmain">
                                    <div className="ap-rowname">{m.name}</div>
                                    <div className="ap-rowdesc">{m.desc}</div>
                                </div>
                                {m.free && <span className="ap-cost is-free">첫 회 무료</span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ★결이 다른 기능은 따로 묶는다(사장 확정).
                    reverse-prompt 는 보드가 아니라 **페이지 이동**이라 랜딩을 떠난다. */}
                <div className="ap-aside">
                    <div className="ap-asidetop">🎨 이건 좀 다른 재주예요</div>
                    <button className="ap-row" onClick={() => onFeature('reverse-prompt')}>
                        <div className="ap-ico" style={{ background: '#FEF6E8' }}>🖼️</div>
                        <div className="ap-rowmain">
                            <div className="ap-rowname">이미지 → 프롬프트</div>
                            <div className="ap-rowdesc">마음에 든 그림, 만드는 법을 뽑아드려요</div>
                        </div>
                    </button>
                </div>

                <div className="ap-ctas">
                    <button className="ap-cta" onClick={onInvite}>🎁 친구 초대하고 1,000P 받기</button>
                    <button className="ap-cta2" onClick={() => onStart()}>아린이와 그냥 대화하기</button>
                </div>

                <p className="ap-foot">업종별 예시는 실제 촬영 구성을 따른 것이에요.<br />발행 전에는 사장님이 한 번 확인해 주세요.</p>
            </div>
        </div>
    );
};
