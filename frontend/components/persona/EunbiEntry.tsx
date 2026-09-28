import React, { useEffect, useRef, useState } from 'react';
import type { EntryGiftContext, GuestGate, PersonaEntryGuide } from '../PersonaEntrySheet';
import { pointApi } from '../../services/pointService';
import { getStage, STAGES } from '../../utils/level';

// 신은비 전용 진입화면 — 승인된 웹툰 은비 시안(eunbi-entry.html)을 제품 계약에 맞춰 옮긴다.
// onStart()=기존 채팅, onFeature('hair'|'outfit')=기존 보드,
// onClose()=원래 화면으로 복귀. 준비 중 기능과 웹툰은 콜백 없이 화면 안 토스트만 띄운다.
//   ★웹툰을 onFeature('webtoon')로 보내지 않는 이유: 앱은 activePersona(=은비)의 웹툰을 여는데
//     은비 웹툰은 0편이라 빈 화면이 된다.
// ★스크롤 연동은 window가 아니라 루트(.eb-root) 스크롤 컨테이너 기준이다 —
//   루트가 position:fixed + overflow-y:auto 이므로 window.scrollY는 항상 0이다.
//
// 선물하기(2026-09-28, 승인 시안 eunbi-entry/gift/draft/eunbi-gift.html):
//   결제·호감도는 **기존 스타 선물 그대로**(pointApi.sendStar → POST /api/star, 서버 수정 없음).
//   서버 규칙: amount × 10P 차감, 호감도 amount × 2, 단계 상승 시 레벨업 보너스. 부족하면 402.
//   ★gift 가 없으면(비로그인) 선물 섹션·게이지·보상 없이, 선물 버튼이 게스트 게이트('paid','gift')를 부른다.

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
    /** 로그인 회원만. 없으면 선물 기능을 숨기고 게스트 게이트로 안내한다. */
    gift?: EntryGiftContext;
    /** 비로그인 시트에서만 온다(PersonaEntrySheet 의 guestGate 규약). */
    onGuestGate?: GuestGate;
}

const FONT_LINK_ID = 'eb-fonts';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap';
const BUBBLE_LINES = ['안녕~ 난 은비야!', '오늘 하루 어땠어?', '같이 웹툰 볼래?', '나랑 얘기하자 ♥', '기다리고 있었어!'];
/** 호감도 Lv.4(베프) 보상 — 말풍선 순환에 더해지는 비밀 대사. */
const SECRET_LINES = [
    '사실… 너 올 때마다 몰래 웃고 있었어 ☺',
    '비밀인데, 너랑 얘기하는 시간이 제일 좋아',
    '힘든 날엔 나한테 먼저 말해 줘. 약속!',
    '너한테만 말하는 건데, 내 꿈은 웹툰 작가야 ✏️',
    '우리 오래오래 친구 하자 ♥',
];
const SOON_MSG = '곧 만나요! 준비 중이에요';
const WEBTOON_MSG = '은비 웹툰 곧 연재! 조금만 기다려 주세요';
const GIFT_FAIL_MSG = '선물을 보내지 못했어요. 잠시 후 다시 시도해 주세요.';
const GUEST_GIFT_MSG = '로그인하면 은비에게 선물할 수 있어요';
const AFTER_GIFT_LINE = '또 놀러 와 줘 ♥';
/** 선물 성공 뒤 최소 잠금(ms) — 반응 영상이 즉시 실패해도 연타 이중 결제를 막는다. */
const MIN_LOCK_MS = 1500;

// 스타 1개의 값 — shared-api routes/aimp/star.ts(pointsSpent = amount*10, xpGain = amount*2)와 같다.
const STAR_POINTS = 10;
const STAR_XP = 2;
// 레벨업 보너스(표시용) — shared-api lib/points.ts LEVELUP_BONUS 와 같게 둔다(인덱스 = 단계-1).
const LEVELUP_BONUS = [0, 200, 500, 1000, 2000, 5000];

const CLIP = {
    nod: '/eunbi/eunbi_gift_nod.mp4',
    cheek: '/eunbi/eunbi_gift_cheek.mp4',
    heart: '/eunbi/eunbi_gift_heart.mp4',
    dance: '/eunbi/eunbi_gift_dance.mp4',
} as const;

interface Gift { key: string; icon: string; name: string; amount: number; clip: string; motion: string; line: string; hearts: number }
// ★가격·호감도는 amount 에서 계산한다(상수 두 벌 금지).
const GIFTS: Gift[] = [
    { key: 'coffee',  icon: '☕', name: '커피',        amount: 1,   clip: CLIP.nod,   motion: '윙크',       line: '와, 커피! 덕분에 오늘 하루 힘난다 ☕', hearts: 6 },
    { key: 'cake',    icon: '🍰', name: '조각 케이크', amount: 5,   clip: CLIP.cheek, motion: '볼 감싸기',  line: '헉 케이크…? 나 너무 감동이야 🥹', hearts: 12 },
    { key: 'flower',  icon: '💐', name: '꽃다발',      amount: 10,  clip: CLIP.heart, motion: '손하트',     line: '꽃다발이라니! 내 마음도 받아줘 ♥', hearts: 20 },
    { key: 'bear',    icon: '🎀', name: '곰인형',      amount: 30,  clip: CLIP.heart, motion: '손하트',     line: '곰인형 꼭 안고 잘게… 고마워 ♥', hearts: 28 },
    { key: 'special', icon: '💝', name: '특별한 선물', amount: 100, clip: CLIP.dance, motion: '빙그르르 춤', line: '이건 반칙이야…! 좋아서 빙그르르 💃', hearts: 44 },
];
const giftPrice = (g: Gift) => g.amount * STAR_POINTS;
const giftXp = (g: Gift) => g.amount * STAR_XP;

/** Lv.5 보상 — 반응 영상 4종 다시 보기(포인트 차감 없음). */
const REPLAYS = [
    { label: '윙크', clip: CLIP.nod, line: GIFTS[0].line },
    { label: '볼 감싸기', clip: CLIP.cheek, line: GIFTS[1].line },
    { label: '손하트', clip: CLIP.heart, line: GIFTS[2].line },
    { label: '빙그르르 춤', clip: CLIP.dance, line: GIFTS[4].line },
];

// 은비식 단계 이름·보상 — 최소 호감도는 utils/level STAGES(minXp 0·30·150·500·1200·2500)를 그대로 쓴다.
const EB_LEVELS = [
    { name: '처음 만난 사이', reward: '선물 반응 영상',     desc: '선물하면 은비가 영상으로 반응해요' },
    { name: '말 편한 친구',   reward: '은비 특별 인사',     desc: '들어올 때마다 은비가 이름을 불러 줘요' },
    { name: '단짝',           reward: '손하트 배경화면',    desc: '폰 배경화면용 은비 손하트 일러스트' },
    { name: '베프',           reward: '은비 비밀 이야기',   desc: '친한 친구에게만 하는 이야기 + 볼하트 배경화면' },
    { name: '소울메이트',     reward: '반응 영상 다시 보기', desc: '은비 반응 영상 4종을 무료로 다시 보기' },
    { name: '은비의 최애',    reward: '웹툰 비밀 에피소드', desc: '은비 웹툰 연재가 시작되면 먼저 열려요' },
];
/** 0부터 시작하는 단계 인덱스(STAGES 기준). */
const levelIndex = (xp: number) => Math.max(0, STAGES.findIndex(s => s.stage === getStage(xp).stage));
const fmt = (n: number) => n.toLocaleString('ko-KR');

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
/* 선물하기 버튼으로 스크롤해 오면 고정 머리(은비♥·✕, 약 64px) 밑에 멈추게 — 없으면 제목·내 포인트가 가린다(09-28 운영 실측) */
.eb-giftsec{scroll-margin-top:calc(76px + env(safe-area-inset-top,0px))}
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

/* 선물하기 — 반응 영상은 히어로와 같은 타원 마스크(.eb-girlmask) 안에 겹친다 */
.eb-girlmask{position:relative}
.eb-girlmask video.eb-react{position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity .25s}
.eb-girlmask video.eb-react.on{opacity:1}
.eb-bubble.pop{animation:eb-pop .45s ease-out}
@keyframes eb-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
.eb-hearts{position:absolute;inset:0;z-index:7;pointer-events:none;overflow:hidden}
.eb-hearts i{position:absolute;bottom:-30px;font-style:normal;color:var(--eb-rose);animation:eb-rise 2.4s ease-out forwards}
@keyframes eb-rise{to{transform:translateY(-110svh) rotate(var(--r,0deg));opacity:0}}
.eb-has-gauge .eb-copy{bottom:calc(16svh + 64px)}
.eb-has-gauge .eb-scrollhint{display:none}
.eb-gauge{position:absolute;z-index:8;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom,0px));max-width:440px;
  background:rgba(255,255,255,.82);backdrop-filter:blur(6px);border:1.5px solid var(--eb-line);border-radius:18px;padding:10px 14px;
  display:grid;gap:6px}
.eb-gauge-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0}
.eb-gauge-top b{font-family:var(--eb-display);font-weight:400;font-size:17px;color:var(--eb-rose-deep);min-width:0}
.eb-gauge-top span{flex:none;font-size:12.5px;color:var(--eb-ink-soft);font-variant-numeric:tabular-nums}
.eb-bar{height:10px;border-radius:99px;background:var(--eb-blush);overflow:hidden}
.eb-bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--eb-peach),var(--eb-rose));
  transition:width .9s cubic-bezier(.2,.8,.2,1)}
.eb-xpfloat{position:absolute;z-index:9;right:24px;bottom:calc(84px + env(safe-area-inset-bottom,0px));font-family:var(--eb-display);font-size:20px;
  color:var(--eb-rose);opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s;pointer-events:none}
.eb-xpfloat.show{opacity:1;transform:none}

.eb-sechead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.eb-sechead .eb-h2{margin:0}
.eb-wallet{font-size:13px;color:var(--eb-ink-soft);font-variant-numeric:tabular-nums}
.eb-wallet b{color:var(--eb-ink)}
.eb-gifts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.eb-gift{appearance:none;border:2px solid var(--eb-line);background:#fff;border-radius:20px;padding:14px 12px 12px;min-width:0;
  display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;cursor:pointer;color:var(--eb-ink);
  transition:border-color .15s,transform .15s}
.eb-gift:hover{transform:translateY(-2px)}
.eb-gift[aria-pressed="true"]{border-color:var(--eb-rose);box-shadow:0 0 0 3px rgba(232,70,127,.15)}
.eb-gift .ic{font-size:30px;line-height:1}
.eb-gift b{font-family:var(--eb-display);font-weight:400;font-size:18px;margin-top:4px}
.eb-gift .price{font-size:14px;color:var(--eb-rose-deep);font-variant-numeric:tabular-nums}
.eb-gift .meta{font-size:12px;color:var(--eb-ink-soft)}
.eb-gift.special{grid-column:span 2;flex-direction:row;align-items:center;gap:12px;background:linear-gradient(120deg,#fff,#FFE6F0 60%,#F1E9FF)}
.eb-gift.special .txt{display:flex;flex-direction:column;gap:2px}
.eb-send{appearance:none;width:100%;margin-top:14px;border:0;border-radius:99px;background:var(--eb-rose);color:#fff;
  font-family:var(--eb-display);font-size:19px;padding:15px 18px;cursor:pointer;box-shadow:0 6px 0 var(--eb-rose-deep)}
.eb-send:active{transform:translateY(4px);box-shadow:0 2px 0 var(--eb-rose-deep)}
.eb-send:disabled{background:#D9B7C5;box-shadow:0 6px 0 #BF97A8;cursor:default}
.eb-fine{margin:10px 0 0;font-size:12px;color:var(--eb-ink-soft);text-align:center}

.eb-rewards{display:flex;flex-direction:column;border:1.5px solid var(--eb-line);border-radius:20px;background:#fff;overflow:hidden}
.eb-rw{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px 14px;border-top:1px solid var(--eb-line)}
.eb-rw:first-child{border-top:0}
.eb-rw .lv{font-family:var(--eb-display);font-size:15px;color:var(--eb-rose-deep)}
.eb-rw .lv small{display:block;font-family:var(--eb-body);font-size:11px;color:var(--eb-ink-soft);font-variant-numeric:tabular-nums}
.eb-rw .what b{font-weight:700;font-size:14px}
.eb-rw .what p{margin:0;font-size:12.5px;color:var(--eb-ink-soft);line-height:1.45}
.eb-rw .tools{grid-column:2/-1;display:flex;flex-wrap:wrap;gap:6px}
.eb-chip{font-size:11.5px;border-radius:99px;padding:4px 9px;white-space:nowrap}
.eb-chip.on{background:var(--eb-rose);color:#fff}
.eb-chip.off{background:var(--eb-blush);color:var(--eb-ink-soft)}
.eb-mini{appearance:none;display:inline-flex;align-items:center;gap:4px;font-size:12.5px;border-radius:99px;padding:6px 11px;cursor:pointer;
  border:1.5px solid var(--eb-rose);background:#fff;color:var(--eb-rose-deep);text-decoration:none}
.eb-mini:disabled{opacity:.5;cursor:default}

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
  /* 모바일은 하단 고정 CTA(.eb-dock)가 있으므로 게이지·호감도 숫자·토스트를 그 위로 올린다 */
  .eb-has-gauge .eb-copy{bottom:calc(168px + env(safe-area-inset-bottom,0px))}
  .eb-gauge{bottom:calc(86px + env(safe-area-inset-bottom,0px))}
  .eb-xpfloat{bottom:calc(158px + env(safe-area-inset-bottom,0px))}
  .eb-root.eb-gift-on .eb-toast{bottom:calc(196px + env(safe-area-inset-bottom,0px))}
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

export const EunbiEntry: React.FC<Props> = ({ onClose, onStart, onFeature, gift, onGuestGate }) => {
    const [reduce] = useState(prefersReducedMotion);
    const [fx] = useState(makeFx);
    const [line, setLine] = useState(0);
    const [bubbleOut, setBubbleOut] = useState(false);
    const [toast, setToast] = useState('');
    const [toastOn, setToastOn] = useState(false);

    // ── 선물하기 상태. xp·points 는 **응답값 기준**으로 즉시 갱신하고, prop 이 바뀌면 따라간다.
    const [xp, setXp] = useState(gift?.xp ?? 0);
    const [points, setPoints] = useState(gift?.points ?? 0);
    const [selKey, setSelKey] = useState(GIFTS[0].key);
    const [busy, setBusy] = useState(false);
    const [reaction, setReaction] = useState<{ src: string; n: number } | null>(null);
    const [playing, setPlaying] = useState(false);
    const [override, setOverride] = useState<string | null>(null);
    const [popKey, setPopKey] = useState(0);
    const [hearts, setHearts] = useState<{ id: number; left: number; size: number; delay: number; r: number; mark: string }[]>([]);
    const [xpFloat, setXpFloat] = useState<number | null>(null);

    const rootRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const girlRef = useRef<HTMLDivElement>(null);
    const fxRef = useRef<HTMLDivElement>(null);
    const copyRef = useRef<HTMLDivElement>(null);
    const bubbleWrapRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const reactRef = useRef<HTMLVideoElement>(null);
    const giftSecRef = useRef<HTMLElement>(null);
    const toastTimer = useRef<ReturnType<typeof setTimeout>>();
    // ★돈이 나가는 버튼 — state 는 다음 렌더에야 반영되므로 연타는 ref 로 동기 차단한다.
    const busyRef = useRef(false);
    const holdRef = useRef(false);
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    const releaseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const heartSeq = useRef(0);
    const lockUntil = useRef(0);

    const later = (fn: () => void, ms: number) => {
        const id = setTimeout(() => { timers.current.delete(id); fn(); }, ms);
        timers.current.add(id);
        return id;
    };
    const cancel = (id?: ReturnType<typeof setTimeout>) => {
        if (!id) return;
        clearTimeout(id);
        timers.current.delete(id);
    };

    useEffect(() => { if (gift) setXp(gift.xp); }, [gift?.xp]);
    useEffect(() => { if (gift) setPoints(gift.points); }, [gift?.points]);
    useEffect(() => { holdRef.current = override !== null; }, [override]);

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
            if (holdRef.current) return;   // 선물 반응 대사가 떠 있는 동안 순환 일시정지
            setBubbleOut(true);
            swap = setTimeout(() => { setLine(n => n + 1); setBubbleOut(false); }, 260);
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

    useEffect(() => () => {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        timers.current.forEach(clearTimeout);
        timers.current.clear();
    }, []);

    // 반응 영상 — src 는 재생할 때만 붙인다(preload=none). 같은 영상 연속 재생은 n 으로 구분.
    useEffect(() => {
        const v = reactRef.current;
        if (!v || !reaction) return;
        v.muted = true; v.defaultMuted = true;
        try { v.currentTime = 0; } catch { /* 로드 전이면 무시 */ }
        try {
            const p = v.play();
            if (p && typeof p.catch === 'function') p.catch(() => finishReaction());
        } catch { finishReaction(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reaction]);

    const say = (msg: string, ms = 2600) => {
        setToast(msg);
        setToastOn(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastOn(false), ms);
    };
    const start = () => onStart();
    const soon = () => say(SOON_MSG);
    const webtoon = () => say(WEBTOON_MSG);

    const lv = levelIndex(xp);
    const lines = [
        ...(gift && lv >= 1 ? [gift.nickname ? `${gift.nickname}! 또 와 줬네 ♥` : '또 와 줬네! 반가워 ♥'] : []),
        ...BUBBLE_LINES,
        ...(gift && lv >= 3 ? SECRET_LINES : []),
    ];
    const bubbleText = override ?? lines[line % lines.length];
    const sel = GIFTS.find(g => g.key === selKey) ?? GIFTS[0];
    const short = points < giftPrice(sel);

    const burst = (n: number) => {
        if (reduce) return;
        const marks = ['♥', '💗', '💖', '✨'];
        const batch = Array.from({ length: n }, (_, i) => ({
            id: ++heartSeq.current, left: 6 + Math.random() * 88, size: 16 + Math.random() * 18,
            delay: Math.random() * .9, r: Math.random() * 80 - 40, mark: marks[i % marks.length],
        }));
        const ids = new Set(batch.map(h => h.id));
        setHearts(prev => [...prev, ...batch]);
        later(() => setHearts(prev => prev.filter(h => !ids.has(h.id))), 3600);
    };

    const showLine = (text: string | null) => { setOverride(text); setPopKey(k => k + 1); };

    const finishReaction = () => {
        if (!busyRef.current) return;
        // 영상이 곧바로 실패해도(코덱·네트워크) 성공 직후의 두 번째 탭이 또 결제되지 않게 최소 잠금을 둔다.
        const wait = lockUntil.current - Date.now();
        if (wait > 0) { cancel(safetyTimer.current); safetyTimer.current = later(finishReaction, wait); return; }
        cancel(safetyTimer.current);
        setPlaying(false);
        setReaction(null);
        const loop = videoRef.current;
        if (loop && !reduce) {
            try { loop.currentTime = 0; const p = loop.play(); if (p && typeof p.catch === 'function') p.catch(() => {}); } catch { /* 무시 */ }
        }
        busyRef.current = false;
        setBusy(false);
        showLine(AFTER_GIFT_LINE);
        cancel(releaseTimer.current);
        releaseTimer.current = later(() => setOverride(null), 2600);   // 대사 순환 재개
    };

    /** 반응(대사·하트·영상). 호출 전에 busyRef 를 잡아 둔다. */
    const playReaction = (clip: string, text: string, heartCount: number) => {
        rootRef.current?.scrollTo?.({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        lockUntil.current = Date.now() + MIN_LOCK_MS;
        cancel(releaseTimer.current);
        showLine(text);
        burst(heartCount);
        if (reduce) { later(finishReaction, MIN_LOCK_MS); return; }
        setReaction(prev => ({ src: clip, n: (prev?.n ?? 0) + 1 }));
        cancel(safetyTimer.current);
        safetyTimer.current = later(finishReaction, 15000);   // 로드가 멈춰도 버튼이 영영 잠기지 않게
    };

    const openGift = () => {
        if (!gift) {
            if (onGuestGate) onGuestGate('paid', 'gift');
            else say(GUEST_GIFT_MSG);
            return;
        }
        giftSecRef.current?.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };

    const sendGift = async () => {
        if (!gift || busyRef.current) return;
        const g = sel;
        if (points < giftPrice(g)) { gift.onNeedCharge(); return; }
        busyRef.current = true;
        setBusy(true);
        let r: Awaited<ReturnType<typeof pointApi.sendStar>>;
        try {
            r = await pointApi.sendStar(gift.personaId, g.amount);
        } catch (e) {
            busyRef.current = false;
            setBusy(false);
            // 실패하면 포인트 표시·게이지는 그대로 둔다.
            if (e instanceof Error && e.message === 'INSUFFICIENT_POINTS') gift.onNeedCharge();
            else say(GIFT_FAIL_MSG);
            return;
        }
        if (typeof r.newBalance === 'number') setPoints(r.newBalance);
        if (typeof r.xp === 'number') setXp(r.xp);
        setXpFloat(giftXp(g));
        later(() => setXpFloat(null), 2200);
        if (r.leveledUp) {
            const li = levelIndex(r.xp);
            const L = EB_LEVELS[li];
            const opened = li >= EB_LEVELS.length - 1 ? '웹툰 비밀 에피소드는 연재 후 열려요' : `${L.reward} 열림`;
            later(() => say(`Lv.${li + 1} ${L.name}! 보너스 +${fmt(r.levelupBonus ?? 0)}P · ${opened}`, 4200), 1200);
        }
        gift.onGifted({ xp: r.xp, personaId: gift.personaId, leveledUp: !!r.leveledUp, newStage: r.newStage, levelupBonus: r.levelupBonus ?? 0 });
        playReaction(g.clip, g.line, g.hearts);
    };

    /** Lv.5 보상 — 포인트 차감 없이 반응 영상 다시 보기. */
    const replay = (clip: string, text: string) => {
        if (busyRef.current) return;
        busyRef.current = true;
        setBusy(true);
        playReaction(clip, text, 10);
    };

    const nextMin = STAGES[lv + 1]?.minXp;
    const curMin = STAGES[lv]?.minXp ?? 0;
    const barPct = nextMin === undefined ? 100 : Math.min(100, Math.max(0, (xp - curMin) / (nextMin - curMin) * 100));

    return (
        <div className={`eb-root${gift ? ' eb-gift-on' : ''}`} ref={rootRef} role="dialog" aria-modal="true" aria-label="웹툰 은비 진입화면">
            <style>{CSS}</style>
            <header className="eb-top">
                <span className="eb-mark">은비<small aria-hidden="true">♥</small></span>
                <button className="eb-close" type="button" aria-label="닫기" onClick={onClose}>✕</button>
            </header>

            <section className="eb-hero" ref={heroRef} aria-label="은비 소개">
                <div className={`eb-stage${gift ? ' eb-has-gauge' : ''}`}>
                    <div className="eb-layer eb-l-bg" ref={bgRef} />
                    <div className="eb-layer eb-l-glow" ref={glowRef}><i /></div>
                    <div className="eb-layer eb-l-girl" ref={girlRef}>
                        <div className="eb-girlwrap">
                            <div className="eb-bubblewrap" ref={bubbleWrapRef}>
                                <div key={popKey} className={`eb-bubble${bubbleOut && override === null ? ' out' : ''}${popKey && !reduce ? ' pop' : ''}`}
                                     aria-hidden="true">{bubbleText}</div>
                            </div>
                            <div className="eb-girlmask">
                                <video ref={videoRef} src="/eunbi/hero_eunbi_loop_v2.mp4" poster="/eunbi/hero_eunbi_916.jpg"
                                       muted loop playsInline autoPlay={!reduce} preload={reduce ? 'none' : 'auto'} width={720} height={1280}
                                       aria-label="손을 흔들며 인사하는 웹툰 그림체의 은비" />
                                {gift && (
                                    <video ref={reactRef} className={`eb-react${playing ? ' on' : ''}`} data-testid="eb-react"
                                           src={reaction?.src} muted playsInline preload="none" width={720} height={1280} aria-hidden="true"
                                           onPlaying={() => setPlaying(true)} onEnded={finishReaction} onError={finishReaction} />
                                )}
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
                    {hearts.length > 0 && (
                        <div className="eb-hearts" aria-hidden="true">
                            {hearts.map(h => (
                                <i key={h.id} style={{ left: `${h.left}%`, fontSize: `${h.size}px`, animationDelay: `${h.delay}s`,
                                                      ['--r' as string]: `${h.r}deg` } as React.CSSProperties}>{h.mark}</i>
                            ))}
                        </div>
                    )}
                    {gift && (
                        <>
                            <div className={`eb-xpfloat${xpFloat !== null ? ' show' : ''}`} aria-hidden="true">호감도 +{xpFloat ?? 0}</div>
                            <div className="eb-gauge" role="group" aria-label="은비 호감도">
                                <div className="eb-gauge-top">
                                    <b>호감도 Lv.{lv + 1} · {EB_LEVELS[lv].name}</b>
                                    <span data-testid="eb-xp">{nextMin === undefined ? `${fmt(xp)} · 최고 레벨` : `${fmt(xp)} / ${fmt(nextMin)}`}</span>
                                </div>
                                <div className="eb-bar"><i style={{ width: `${barPct}%` }} /></div>
                            </div>
                        </>
                    )}
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
                            <button className="eb-act" type="button" aria-label="선물하기" onClick={openGift}>
                                <span className="ic" aria-hidden="true">🎁</span><b>선물하기</b><span className="d">마음을 전하고 호감도를 올려요</span>
                            </button>
                            <button className="eb-act is-soon" type="button" aria-label="웹툰 보기 · 은비 웹툰 곧 연재" onClick={webtoon}>
                                <em className="eb-soon">곧 연재</em><span className="ic" aria-hidden="true">🖼️</span><b>웹툰 보기</b><span className="d">은비 웹툰 · 곧 연재</span>
                            </button>
                        </div>
                    </section>

                    {gift && (
                        <section className="eb-panel eb-reveal eb-giftsec" ref={giftSecRef} aria-labelledby="eb-h-gift">
                            <div className="eb-sechead">
                                <h2 className="eb-h2" id="eb-h-gift">은비에게 선물하기</h2>
                                <span className="eb-wallet">내 포인트 <b data-testid="eb-wallet">{fmt(points)}P</b></span>
                            </div>
                            <div className="eb-gifts">
                                {GIFTS.map(g => {
                                    const special = g.key === 'special';
                                    const body = <><b>{g.name}</b><span className="price">{fmt(giftPrice(g))}P</span>
                                        <span className="meta">호감도 +{giftXp(g)} · {g.motion}</span></>;
                                    return (
                                        <button key={g.key} type="button" className={`eb-gift${special ? ' special' : ''}`}
                                                aria-pressed={selKey === g.key} aria-label={`${g.name} ${fmt(giftPrice(g))}P`}
                                                onClick={() => setSelKey(g.key)}>
                                            <span className="ic" aria-hidden="true">{g.icon}</span>
                                            {special ? <span className="txt">{body}</span> : body}
                                        </button>
                                    );
                                })}
                            </div>
                            <button className="eb-send" type="button" disabled={busy} onClick={sendGift}>
                                {busy ? '은비가 선물을 받는 중…' : short ? '포인트가 부족해요 · 충전하기' : `${fmt(giftPrice(sel))}P로 ${sel.name} 선물하기`}
                            </button>
                            <p className="eb-fine">선물은 은비 호감도에 쌓여요. 레벨이 오르면 보너스 포인트와 은비 선물이 열려요.</p>
                        </section>
                    )}

                    {gift && (
                        <section className="eb-panel eb-reveal" aria-labelledby="eb-h-rw">
                            <div className="eb-sechead">
                                <h2 className="eb-h2" id="eb-h-rw">호감도 보상</h2>
                                <span className="eb-wallet">대화해도 호감도가 올라요</span>
                            </div>
                            <div className="eb-rewards">
                                {EB_LEVELS.map((L, i) => {
                                    const min = STAGES[i].minXp;
                                    const last = i === EB_LEVELS.length - 1;
                                    const on = xp >= min && !last;
                                    return (
                                        <div className="eb-rw" key={L.name} data-testid={`eb-rw-${i + 1}`}>
                                            <div className="lv">Lv.{i + 1}<small>{fmt(min)}</small></div>
                                            <div className="what">
                                                <b>{L.reward}{LEVELUP_BONUS[i] ? ` · +${fmt(LEVELUP_BONUS[i])}P` : ''}</b>
                                                <p>{L.name} · {L.desc}</p>
                                            </div>
                                            <span className={`eb-chip ${on ? 'on' : 'off'}`}>
                                                {last ? '연재 후 열려요' : on ? '열림' : `잠김 · 호감도 ${fmt(min)}`}
                                            </span>
                                            {on && i === 2 && (
                                                <div className="tools">
                                                    <a className="eb-mini" href="/eunbi/eunbi_wallpaper_heart.jpg" download="eunbi_wallpaper_heart.jpg"
                                                       target="_blank" rel="noopener">손하트 배경화면 저장</a>
                                                </div>
                                            )}
                                            {on && i === 3 && (
                                                <div className="tools">
                                                    <a className="eb-mini" href="/eunbi/eunbi_wallpaper_cheek.jpg" download="eunbi_wallpaper_cheek.jpg"
                                                       target="_blank" rel="noopener">볼하트 배경화면 저장</a>
                                                </div>
                                            )}
                                            {on && i === 4 && (
                                                <div className="tools">
                                                    {REPLAYS.map(rp => (
                                                        <button key={rp.label} type="button" className="eb-mini" disabled={busy}
                                                                aria-label={`${rp.label} 영상 다시 보기`} onClick={() => replay(rp.clip, rp.line)}>
                                                            ▶ {rp.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

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
