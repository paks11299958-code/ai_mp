import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntryGiftContext, GuestGate, PersonaEntryGuide } from '../PersonaEntrySheet';

// 윤채린 진입화면 v2 — "뷰티 클리닉 & 스튜디오"(2026-09-28, 승인 시안 chaerin-entry/draft/chaerin-clinic.html).
//
// 입구(채린 + 두 문) → 🏥 성형(견적·가격표·상담) / 📸 스튜디오(기존 4기능).
// ★계약은 다른 전용 랜딩과 같다 — onStart()=채팅, onFeature(key)=그 기능, onClose()=닫기.
//   App.tsx 는 이 컴포넌트를 모른다(분기는 PersonaEntrySheet). gift 는 로그인 회원 시트에만 온다.
//
// ★견적 가드레일(서버 shared-api routes/aimp/beauty-estimate.ts 가 정본):
//   - 가격은 전부 서버 응답 값만 쓴다(화면에 가격 상수 금지 — 서버 카탈로그가 정본).
//   - 사진은 분석 요청 본문으로만 보낸다. console·localStorage 에 남기지 않는다.
//   - 단가는 `/api/points/menu-prices` 의 `beauty-estimate`. 행이 없으면 "준비 중"(서버도 503).

const IMG = {
    hero: '/chaerin/clinic/hero_chaerin.jpg',
    clinic: '/chaerin/clinic/door_clinic.jpg',
    studio: '/chaerin/clinic/door_studio.jpg',
    sample: '/chaerin/clinic/sample_face.jpg',
    hair: '/chaerin/style-hair.jpg',
    outfit: '/chaerin/menu-outfit-v2.jpg',
    age: '/chaerin/menu-age.jpg',
    figure: '/chaerin/style-figure.jpg',
} as const;

export const ESTIMATE_FEATURE = 'beauty-estimate';
const API = '/api/beauty-estimate';
/** 스캔 연출 최소 시간 — 응답이 빨라도 "살펴보는" 시간을 보장한다(시안 4.8초 연출 기준). */
export const MIN_SCAN_MS = 4500;
const REQUEST_TIMEOUT_MS = 90_000;
const FAIL_MSG = '분석이 잠시 어려워요. 잠시 후 다시 시도해 주세요.';
const NOT_READY_MSG = '준비 중인 기능이에요. 조금만 기다려 주세요.';

type Part = 'eye' | 'nose' | 'contour' | 'lip' | 'skin';
/** 서버 part id 순서·이름(PART_NAMES)과 같다. 색은 화면 표시용. */
const PARTS: { id: Part; name: string; color: string; chip: string; at: [number, number] }[] = [
    { id: 'eye', name: '눈', color: '#E9C98E', chip: '눈 · 눈매 길이·꺼풀 측정', at: [8, 33] },
    { id: 'nose', name: '코', color: '#D9A48F', chip: '코 · 콧대 높이·코끝', at: [56, 44] },
    { id: 'contour', name: '윤곽', color: '#B98574', chip: '윤곽 · 턱선·광대 폭', at: [6, 56] },
    { id: 'lip', name: '입·입술', color: '#C9B4D8', chip: '입 · 입술 두께·입꼬리', at: [54, 55] },
    { id: 'skin', name: '피부·탄력', color: '#9FB7C7', chip: '피부 · 결·톤', at: [10, 22] },
];
const PART_BY_ID = new Map(PARTS.map(p => [p.id, p]));

/** 스튜디오 — featureKey 는 App.tsx FEATURE_ACTIONS 와 같은 키(기존 ChaerinStudioEntry 에서 실측). */
const STUDIO: { key: string; name: string; desc: string; cost: string; thumb: string }[] = [
    { key: 'hair', name: '헤어 체인지', desc: '내 얼굴에 어울리는 헤어 진단·합성', cost: '200P', thumb: IMG.hair },
    { key: 'outfit', name: '프로필 화보', desc: '실사·지브리풍 프로필 사진', cost: '200P', thumb: IMG.outfit },
    { key: 'agetransform', name: '시간여행', desc: '어린 나 · 나이 든 나 Before/After', cost: '100P', thumb: IMG.age },
    { key: 'lookalike', name: '닮은꼴 찾기', desc: '나랑 닮은 연예인은?', cost: '무료', thumb: IMG.figure },
];

// 스캔 연출 = 사진 위 가이드 타원·빛줄기 + **추상 얼굴 도식**(부위별로 불이 켜짐).
// ★사진 위에 점·윤곽선을 찍지 않는다 — AI 좌표(thinking 끈 flash)가 입·턱에서 10~20% 어긋나
//   선이 얼굴 밖으로 나갔다(09-28 가상 인물 실측). 틀린 위치보다 정직한 도식이 낫다. 서버도 좌표를 안 준다.
const ZONES: Record<Part, React.ReactNode> = {
    eye: <><ellipse cx="38" cy="50" rx="8" ry="3.6" /><ellipse cx="62" cy="50" rx="8" ry="3.6" /></>,
    nose: <path d="M50 52 L46 68 Q50 71 54 68 Z" />,
    lip: <ellipse cx="50" cy="80" rx="10" ry="3.8" />,
    contour: <path d="M22 60 Q24 88 50 102 Q76 88 78 60" fill="none" strokeWidth="3" />,
    skin: <><circle cx="31" cy="66" r="7" /><circle cx="69" cy="66" r="7" /></>,
};
const SCAN_MSGS = ['얼굴 윤곽을 찾고 있어요…', '이목구비 위치를 잡는 중…', '고른 부위를 살펴보는 중…', '공개 가격과 맞춰 보는 중…'];

// ── 서버 응답 형식 ──
interface EstimateItem { id: string; name: string; min: number; max: number; note?: string; suggested: boolean }
interface EstimatePart { part: Part; name: string; feature: string; items: EstimateItem[] }
export interface EstimateReport {
    asOf: string; charm: string;
    parts: EstimatePart[]; suggestedTotal: { min: number; max: number };
    pointsCharged: number; newBalance?: number;
}
interface CatalogResp {
    asOf: string;
    parts: { part: Part; name: string; items: { id: string; name: string; min: number; max: number; note?: string; singleSource?: boolean }[] }[];
    sources: string[];
}

type Screen = 'entry' | 'clinic' | 'table' | 'consent' | 'pick' | 'scan' | 'report' | 'studio';
/** 뒤로·Escape = 한 단계 위. 입구에서만 닫는다. 스캔 중엔 막는다(요청이 이미 나가 결과를 버리게 된다). */
const PARENT: Record<Screen, Screen | null> = {
    entry: null, clinic: 'entry', studio: 'entry', table: 'clinic', consent: 'clinic', pick: 'consent', scan: 'scan', report: 'clinic',
};

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const fmt = (n: number) => n.toLocaleString('ko-KR');
const authHeaders = (): Record<string, string> => {
    try {
        const t = localStorage.getItem('token');
        return t ? { Authorization: `Bearer ${t}` } : {};
    } catch { return {}; }
};

/**
 * 사진 → EXIF 회전 보정 + 긴 변 1280px JPEG(0.85). HairStyleBoard 의 처리(createImageBitmap from-image)와 같다.
 * createImageBitmap 이 없으면 <img> 디코드(브라우저가 EXIF 방향을 적용)로 대신한다.
 */
export async function prepPhoto(file: File): Promise<{ base64: string; width: number; height: number }> {
    let src: CanvasImageSource & { width: number; height: number };
    let release = () => {};
    if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any);
        src = bmp;
        release = () => bmp.close?.();
    } else {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
        try { await img.decode(); } finally { URL.revokeObjectURL(url); }
        src = img;
    }
    try {
        const w0 = (src as HTMLImageElement).naturalWidth || src.width;
        const h0 = (src as HTMLImageElement).naturalHeight || src.height;
        if (!w0 || !h0) throw new Error('empty image');
        const scale = Math.min(1, 1280 / Math.max(w0, h0));
        const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(src, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (!base64) throw new Error('encode failed');
        return { base64, width: w, height: h };
    } finally {
        release();
    }
}

const CSS = `
.cc-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;background:#FBF6F1;color:#4A342E;
  font-family:"Noto Sans KR","Pretendard","Apple SD Gothic Neo",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  --cc-sand:#F2E7DE;--cc-rose:#C98E7E;--cc-rose-deep:#9C5E50;--cc-cocoa:#4A342E;--cc-soft:#86695F;
  --cc-line:rgba(156,94,80,.18);--cc-card:#FFFDFB;--cc-night:#1E2A44;--cc-gold:#E9C98E}
.cc-root *{box-sizing:border-box}
.cc-wrap{max-width:440px;margin:0 auto;padding:14px 16px max(60px,env(safe-area-inset-bottom));min-height:100%;position:relative}
.cc-root h1,.cc-root h2,.cc-root h3,.cc-root h4{font-family:"Gowun Batang","Noto Serif KR","Nanum Myeongjo",serif;margin:0;text-wrap:balance}
.cc-root p{margin:0;line-height:1.6}
.cc-root button{font:inherit;color:inherit}
.cc-root button:focus-visible,.cc-root label:focus-within{outline:3px solid var(--cc-gold);outline-offset:2px}
.cc-close{position:fixed;top:max(12px,env(safe-area-inset-top));right:max(12px,calc(50% - 208px));z-index:20;width:38px;height:38px;border-radius:50%;
  border:1px solid var(--cc-line);background:rgba(255,253,251,.92);color:var(--cc-soft);font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.cc-screen{display:flex;flex-direction:column;gap:16px;animation:cc-fadeUp .45s ease both}
@keyframes cc-fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cc-back{align-self:flex-start;appearance:none;border:0;background:none;color:var(--cc-soft);font-size:14px;cursor:pointer;padding:4px 0}

.cc-hero{position:relative;border-radius:26px;overflow:hidden;aspect-ratio:3/3.4;background:var(--cc-sand)}
.cc-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%;animation:cc-breathe 9s ease-in-out infinite alternate}
@keyframes cc-breathe{to{transform:scale(1.05) translateY(-1%)}}
.cc-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 45%,rgba(74,52,46,.78))}
.cc-copy{position:absolute;left:18px;right:18px;bottom:18px;z-index:2;color:#fff;display:flex;flex-direction:column;gap:6px}
.cc-eyebrow{font-size:12px;letter-spacing:.12em;opacity:.85}
.cc-hero h1{font-size:30px;line-height:1.2}
.cc-hero h1 span{display:inline-block;opacity:0;transform:translateY(12px);animation:cc-word .7s cubic-bezier(.2,.8,.2,1) forwards}
@keyframes cc-word{to{opacity:1;transform:none}}
.cc-hero p{font-size:13.5px;opacity:.9}
.cc-badge{position:absolute;top:14px;left:14px;z-index:2;font-size:11px;background:rgba(255,255,255,.88);color:var(--cc-cocoa);border-radius:99px;padding:5px 10px}
.cc-sparkle{position:absolute;z-index:1;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 10px 3px rgba(255,236,210,.9);animation:cc-twinkle 3s ease-in-out infinite}
@keyframes cc-twinkle{0%,100%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1)}}

.cc-doors{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cc-door{position:relative;appearance:none;border:0;padding:0;border-radius:22px;overflow:hidden;aspect-ratio:4/5.6;cursor:pointer;background:#000;text-align:left;box-shadow:0 12px 30px rgba(74,52,46,.18)}
.cc-door img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .9s cubic-bezier(.6,0,.2,1),filter .6s}
.cc-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(20,14,12,.72))}
.cc-dlabel{position:absolute;left:12px;right:12px;bottom:12px;color:#fff;display:flex;flex-direction:column;gap:2px;z-index:3}
.cc-dlabel b{font-family:"Gowun Batang","Noto Serif KR",serif;font-size:22px}
.cc-dlabel span{font-size:12px;opacity:.88;line-height:1.4}
.cc-new{position:absolute;top:10px;right:10px;z-index:3;background:var(--cc-gold);color:var(--cc-cocoa);font-size:11px;font-weight:700;border-radius:99px;padding:3px 8px}
.cc-win{position:absolute;z-index:2;background:rgba(255,214,150,.55);mix-blend-mode:screen;border-radius:2px;opacity:0;animation:cc-lightOn 5s ease-in-out infinite}
@keyframes cc-lightOn{0%,12%{opacity:0}22%,80%{opacity:.9}100%{opacity:0}}
.cc-spill{position:absolute;z-index:2;left:43%;width:14%;top:67%;height:18%;background:radial-gradient(ellipse at 50% 100%,rgba(255,220,160,.95),rgba(255,220,160,0) 70%);filter:blur(2px);animation:cc-spill 2.6s ease-in-out infinite alternate}
@keyframes cc-spill{from{opacity:.45;transform:scaleY(.9)}to{opacity:1;transform:scaleY(1.15)}}
.cc-door.cc-enter img{transform:scale(3.2) translateY(9%);filter:brightness(1.6)}
.cc-whiteout{position:absolute;inset:0;z-index:4;background:#FFF6EA;opacity:0;pointer-events:none;transition:opacity .5s .45s}
.cc-door.cc-enter .cc-whiteout{opacity:1}
.cc-glow{position:absolute;z-index:2;width:34%;aspect-ratio:1;top:15%;border-radius:50%;background:radial-gradient(circle,rgba(255,248,235,.9),rgba(255,248,235,0) 65%);animation:cc-breatheGlow 3.4s ease-in-out infinite alternate}
@keyframes cc-breatheGlow{from{opacity:.35}to{opacity:.9}}
.cc-flash{position:absolute;inset:0;z-index:3;background:#fff;opacity:0;pointer-events:none;animation:cc-flash 4.2s linear infinite}
@keyframes cc-flash{0%,86%,100%{opacity:0}88%{opacity:.9}92%{opacity:0}}
.cc-door.cc-shoot .cc-flash{animation:cc-shoot .5s ease-out forwards}
@keyframes cc-shoot{0%{opacity:1}100%{opacity:0}}
.cc-note{font-size:12px;color:var(--cc-soft);line-height:1.55;background:var(--cc-sand);border-radius:14px;padding:10px 12px}

.cc-subhead{display:flex;align-items:center;gap:12px}
.cc-subhead img{width:64px;height:64px;border-radius:16px;object-fit:cover;flex:none}
.cc-subhead h2{font-size:23px}
.cc-subhead p{font-size:13px;color:var(--cc-soft)}
.cc-menu{display:flex;flex-direction:column;gap:10px}
.cc-item{appearance:none;border:1.5px solid var(--cc-line);background:var(--cc-card);border-radius:18px;padding:14px;display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:center;text-align:left;cursor:pointer;width:100%;
  opacity:0;transform:translateY(16px);animation:cc-fadeUp .5s cubic-bezier(.2,.8,.2,1) forwards}
.cc-item:hover{border-color:var(--cc-rose)}
.cc-ic{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:var(--cc-sand);overflow:hidden}
.cc-ic img{width:100%;height:100%;object-fit:cover}
.cc-item b{display:block;font-size:15.5px}
.cc-item small{display:block;font-size:12.5px;color:var(--cc-soft);margin-top:2px;line-height:1.4}
.cc-price{font-size:12.5px;color:var(--cc-rose-deep);white-space:nowrap;font-weight:700}
.cc-item.cc-hi{border-color:var(--cc-rose);background:linear-gradient(135deg,#FFFDFB,#F8EAE3)}
.cc-item.cc-hi .cc-price{background:var(--cc-gold);color:var(--cc-cocoa);border-radius:99px;padding:4px 9px}
.cc-item.cc-hi .cc-price.cc-wait{background:var(--cc-sand);color:var(--cc-soft)}

.cc-steps{display:flex;gap:6px;margin:12px 48px 0 0}
.cc-steps i{flex:1;height:4px;border-radius:99px;background:var(--cc-line)}
.cc-steps i.cc-on{background:var(--cc-rose)}
.cc-panel{background:var(--cc-card);border:1.5px solid var(--cc-line);border-radius:22px;padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.cc-panel h3{font-size:20px}
.cc-check{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.5;cursor:pointer}
.cc-check input{width:20px;height:20px;accent-color:var(--cc-rose-deep);flex:none;margin-top:1px}
.cc-btn{appearance:none;border:0;border-radius:99px;padding:15px 18px;font-size:16px;font-weight:700;cursor:pointer;background:var(--cc-cocoa);color:#fff!important;transition:opacity .2s;width:100%}
.cc-btn:disabled{opacity:.35;cursor:default}
.cc-btn.cc-ghost{background:transparent;color:var(--cc-cocoa)!important;border:1.5px solid var(--cc-line)}
.cc-upload{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center}
.cc-upload img{width:96px;aspect-ratio:3/4;object-fit:cover;border-radius:14px;background:var(--cc-sand)}
.cc-upload p{font-size:13px;color:var(--cc-soft)}
.cc-file{display:inline-flex;align-items:center;gap:6px;margin-top:8px;border:1.5px solid var(--cc-line);background:#fff;border-radius:99px;padding:8px 13px;font-size:13.5px;font-weight:700;color:var(--cc-cocoa);cursor:pointer}
.cc-file input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.cc-parts{display:flex;flex-wrap:wrap;gap:8px}
.cc-part{appearance:none;border:1.5px solid var(--cc-line);background:#fff;border-radius:99px;padding:9px 13px;font-size:14px;cursor:pointer}
.cc-part[aria-pressed="true"]{background:var(--cc-cocoa);color:#fff!important;border-color:var(--cc-cocoa)}
.cc-err{font-size:13px;color:#A3413A;background:#FDEDEA;border-radius:12px;padding:10px 12px;line-height:1.5}

.cc-scan{position:relative;border-radius:22px;overflow:hidden;aspect-ratio:3/4;background:#111}
.cc-scan img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.85)}
.cc-scan svg{position:absolute;inset:0;width:100%;height:100%}
.cc-beam{position:absolute;left:0;right:0;height:22%;top:-22%;background:linear-gradient(180deg,rgba(233,201,142,0),rgba(233,201,142,.55) 85%,rgba(255,240,210,.95));mix-blend-mode:screen;animation:cc-beam 2.2s cubic-bezier(.5,0,.5,1) infinite}
@keyframes cc-beam{to{top:100%}}
@keyframes cc-pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@keyframes cc-draw{to{stroke-dashoffset:0}}
.cc-guide{position:absolute;left:18%;right:18%;top:12%;bottom:22%;border:2px dashed rgba(255,231,184,.8);border-radius:50%;box-shadow:0 0 0 999px rgba(20,14,12,.28);animation:cc-guide 2.4s ease-in-out infinite alternate}
@keyframes cc-guide{from{border-color:rgba(255,231,184,.45)}to{border-color:rgba(255,231,184,.95)}}
.cc-diagram{display:grid;grid-template-columns:104px 1fr;gap:14px;align-items:center;background:var(--cc-card,#FFFDFB);border:1.5px solid rgba(156,94,80,.18);border-radius:18px;padding:12px 14px}
.cc-diagram svg{width:104px;height:auto;display:block}
.cc-faceline{fill:#F7EDE6;stroke:#C98E7E;stroke-width:1.2}
.cc-zone{fill:#E7D8CF;stroke:#E7D8CF;transition:fill .5s,stroke .5s,filter .5s}
.cc-zone.cc-off{opacity:.35}
.cc-zone.cc-lit{fill:var(--z);stroke:var(--z);filter:drop-shadow(0 0 3px var(--z));animation:cc-zonePulse 1.4s ease-in-out infinite alternate}
@keyframes cc-zonePulse{from{opacity:.75}to{opacity:1}}
.cc-chips{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#86695F}
.cc-chips li{display:flex;align-items:center;gap:7px;opacity:.45;transition:opacity .35s}
.cc-chips li.cc-done{opacity:1;color:#4A342E;font-weight:700}
.cc-chips li i{width:9px;height:9px;border-radius:3px;flex:none}
.cc-status{font-size:13.5px;color:var(--cc-soft);text-align:center;min-height:1.6em}

.cc-total{background:var(--cc-night);color:#fff;border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:10px;position:relative;overflow:hidden}
.cc-total::before{content:"";position:absolute;width:180px;height:180px;right:-60px;top:-70px;border-radius:50%;background:radial-gradient(circle,rgba(233,201,142,.45),transparent 70%)}
.cc-total small{font-size:12px;opacity:.75;letter-spacing:.06em}
.cc-sum{font-family:"Gowun Batang","Noto Serif KR",serif;font-size:32px;font-variant-numeric:tabular-nums}
.cc-sum em{font-style:normal;font-size:16px;opacity:.8}
.cc-stack{display:flex;height:12px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,.12)}
.cc-stack i{display:block;height:100%;width:0;transition:width 1s cubic-bezier(.2,.8,.2,1)}
.cc-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;opacity:.85}
.cc-legend span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:var(--c)}
.cc-charm{font-size:13.5px;background:#FFF6E6;border:1px solid #F2DDB3;border-radius:16px;padding:12px 14px;line-height:1.6}
.cc-cards{display:flex;flex-direction:column;gap:12px}
.cc-pcard{background:var(--cc-card);border:1.5px solid var(--cc-line);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px;opacity:0;transform:translateY(18px);transition:.55s cubic-bezier(.2,.8,.2,1)}
.cc-pcard.cc-show{opacity:1;transform:none}
.cc-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.cc-pcard h4{font-size:19px}
.cc-range{font-size:13px;color:var(--cc-rose-deep);font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.cc-feat{font-size:13.5px;color:var(--cc-soft)}
.cc-opt{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;font-size:13.5px;cursor:pointer}
.cc-opt input{width:18px;height:18px;accent-color:var(--cc-rose-deep);margin:0}
.cc-bar{grid-column:2/-1;height:6px;border-radius:99px;background:var(--cc-sand);position:relative;overflow:hidden}
.cc-bar i{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,var(--cc-gold),var(--cc-rose));border-radius:99px;transition:left .9s,width .9s}
.cc-won{font-variant-numeric:tabular-nums;color:var(--cc-soft);font-size:12.5px;white-space:nowrap}
.cc-trow{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;font-size:13.5px}
.cc-src{font-size:11px;color:var(--cc-soft);opacity:.8;line-height:1.5}
.cc-legal{font-size:12px;color:var(--cc-soft);line-height:1.6;border-top:1px solid var(--cc-line);padding-top:12px}
.cc-toast{position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--cc-cocoa);color:#fff;border-radius:99px;padding:10px 18px;font-size:14px;z-index:30;
  max-width:calc(100% - 32px);text-align:center;animation:cc-fadeUp .3s ease both}
.cc-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

@media (prefers-reduced-motion:reduce){
  .cc-root *,.cc-root *::before,.cc-root *::after{animation-duration:.001s!important;animation-iteration-count:1!important;animation-delay:0s!important;transition-duration:.001s!important}
  .cc-hero img,.cc-win,.cc-spill,.cc-glow,.cc-flash,.cc-sparkle,.cc-beam{animation:none!important}
}
`;

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    /** 로그인 회원 시트에만 온다 — 없으면 비로그인으로 본다. */
    gift?: EntryGiftContext;
    /** 비로그인 시트에서만 온다(PersonaEntrySheet 의 guestGate 규약). */
    onGuestGate?: GuestGate;
}

export const ChaerinClinicEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, gift, onGuestGate }) => {
    const [reduce] = useState(prefersReducedMotion);
    const [screen, setScreen] = useState<Screen>('entry');
    const [doorFx, setDoorFx] = useState<'' | 'clinic' | 'studio'>('');
    const [toast, setToast] = useState('');

    // 단가: undefined=모름(조회 전·실패), null=행 없음(준비 중), number=단가
    const [price, setPrice] = useState<number | null | undefined>(undefined);
    const [catalog, setCatalog] = useState<CatalogResp | null>(null);
    const [catalogErr, setCatalogErr] = useState(false);

    const [consent, setConsent] = useState([false, false, false]);
    const [preview, setPreview] = useState<string | null>(null);
    const [photoDims, setPhotoDims] = useState<{ w: number; h: number } | null>(null);
    const [prepping, setPrepping] = useState(false);
    const [parts, setParts] = useState<Part[]>([]);
    const [pickErr, setPickErr] = useState('');
    const [busy, setBusy] = useState(false);

    const [scanMsg, setScanMsg] = useState(SCAN_MSGS[0]);
    const [chipCount, setChipCount] = useState(0);

    const [report, setReport] = useState<EstimateReport | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [shownCards, setShownCards] = useState(0);
    const [shownSum, setShownSum] = useState<[number, number]>([0, 0]);

    const rootRef = useRef<HTMLDivElement>(null);
    const photoRef = useRef<string | null>(null);   // base64 — 상태·로그·저장소에 두지 않는다
    const previewRef = useRef<string | null>(null);
    const busyRef = useRef(false);
    const aliveRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);
    const timersRef = useRef<number[]>([]);
    const scanTimersRef = useRef<number[]>([]);
    const toastTimerRef = useRef<number | undefined>(undefined);
    const rafRef = useRef(0);
    const sumRef = useRef<[number, number]>([0, 0]);
    const fileSeqRef = useRef(0);

    const isGuest = !gift;
    const who = guide.personaName || guide.title || '윤채린';

    const later = useCallback((fn: () => void, ms: number, bucket: 'ui' | 'scan' = 'ui') => {
        const id = window.setTimeout(fn, ms);
        (bucket === 'scan' ? scanTimersRef : timersRef).current.push(id);
        return id;
    }, []);
    const clearScanTimers = () => { scanTimersRef.current.forEach(clearTimeout); scanTimersRef.current = []; };

    const say = useCallback((m: string) => {
        setToast(m);
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToast(''), 2600);
    }, []);

    // 언마운트 — 타이머·rAF·요청·objectURL·사진 전부 정리
    useEffect(() => {
        aliveRef.current = true;
        return () => {
            aliveRef.current = false;
            timersRef.current.forEach(clearTimeout);
            scanTimersRef.current.forEach(clearTimeout);
            clearTimeout(toastTimerRef.current);
            cancelAnimationFrame(rafRef.current);
            abortRef.current?.abort();
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
            previewRef.current = null;
            photoRef.current = null;
        };
    }, []);

    // 단가 — 로그인 회원만(비로그인은 401). 못 받으면 배지만 생략한다.
    useEffect(() => {
        if (!gift) return;
        let alive = true;
        fetch('/api/points/menu-prices', { headers: authHeaders() })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`prices ${r.status}`))))
            .then((d: { prices?: Record<string, number> }) => {
                if (!alive) return;
                const v = d?.prices?.[ESTIMATE_FEATURE];
                setPrice(typeof v === 'number' && Number.isFinite(v) ? v : null);
            })
            .catch(() => { /* 모름 — 서버가 최종 판정(503/402) */ });
        return () => { alive = false; };
        // gift 객체는 렌더마다 새로 올 수 있다 — 로그인 여부만 본다
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!gift]);

    const go = useCallback((s: Screen) => {
        setScreen(s);
        rootRef.current?.scrollTo?.({ top: 0 });
    }, []);

    // 가격표 — 처음 열 때 한 번(비로그인도 공개)
    const loadCatalog = useCallback(() => {
        setCatalogErr(false);
        fetch(`${API}/catalog`)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`))))
            .then((d: CatalogResp) => { if (aliveRef.current) setCatalog(d); })
            .catch(() => { if (aliveRef.current) setCatalogErr(true); });
    }, []);
    useEffect(() => {
        if (screen === 'table' && !catalog && !catalogErr) loadCatalog();
    }, [screen, catalog, catalogErr, loadCatalog]);

    // Escape — 한 단계 위(입구에서만 닫기)
    const back = useCallback(() => {
        if (doorFx) return;
        const up = PARENT[screen];
        if (up === null) onClose();
        else if (up !== screen) go(up);
    }, [screen, doorFx, go, onClose]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') back(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [back]);

    // ── 문 ──
    const openDoor = (which: 'clinic' | 'studio') => {
        if (doorFx) return;
        if (reduce) { go(which); return; }
        setDoorFx(which);
        later(() => { setDoorFx(''); go(which); }, which === 'clinic' ? 1150 : 520);
    };

    // ── 견적 진입 ──
    const openEstimate = () => {
        if (isGuest) {
            if (onGuestGate) onGuestGate('paid', ESTIMATE_FEATURE);
            else say('로그인 후 이용할 수 있어요');
            return;
        }
        if (price === null) { say(NOT_READY_MSG); return; }
        go('consent');
    };
    const allAgreed = consent.every(Boolean);

    // ── 사진 ──
    const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';   // 같은 사진을 다시 골라도 change 가 오게
        if (!file) return;
        if (!file.type.startsWith('image/')) { setPickErr('사진 파일만 올릴 수 있어요.'); return; }
        const seq = ++fileSeqRef.current;
        setPickErr('');
        setPrepping(true);
        try {
            const p = await prepPhoto(file);
            if (!aliveRef.current || seq !== fileSeqRef.current) return;
            photoRef.current = p.base64;
            if (previewRef.current) URL.revokeObjectURL(previewRef.current);
            const url = URL.createObjectURL(file);
            previewRef.current = url;
            setPreview(url);
            setPhotoDims({ w: p.width, h: p.height });
        } catch {
            if (aliveRef.current && seq === fileSeqRef.current) setPickErr('사진을 읽지 못했어요. 다른 사진으로 올려 주세요.');
        } finally {
            if (aliveRef.current && seq === fileSeqRef.current) setPrepping(false);
        }
    };
    const togglePart = (id: Part) => setParts(ps => (ps.includes(id) ? ps.filter(x => x !== id) : [...ps, id]));
    const canAnalyze = !!preview && parts.length > 0 && !busy && !prepping;

    // ── 분석 ──
    const startScanFx = (chosen: Part[]) => {
        clearScanTimers();
        setScanMsg(SCAN_MSGS[0]);
        setChipCount(0);
        if (reduce) { setChipCount(chosen.length); return; }
        SCAN_MSGS.forEach((m, i) => { if (i) later(() => setScanMsg(m), i * 1100, 'scan'); });
        chosen.forEach((_, i) => later(() => setChipCount(i + 1), 1600 + i * 450, 'scan'));
    };

    const failToPick = (msg: string) => {
        clearScanTimers();
        setPickErr(msg);
        go('pick');
    };

    const analyze = async () => {
        if (busyRef.current || !canAnalyze || !photoRef.current || !gift) return;
        busyRef.current = true;
        setBusy(true);
        setPickErr('');
        const chosen = PARTS.map(p => p.id).filter(id => parts.includes(id));
        const t0 = Date.now();
        go('scan');
        startScanFx(chosen);

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const timeout = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        try {
            let res: Response;
            try {
                res = await fetch(API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...authHeaders() },
                    body: JSON.stringify({ imageBase64: photoRef.current, mimeType: 'image/jpeg', parts: chosen, adultConfirmed: true }),
                    signal: ctrl.signal,
                });
            } catch {
                if (aliveRef.current) failToPick(FAIL_MSG);
                return;
            }
            const data = await res.json().catch(() => ({} as any));
            if (!aliveRef.current) return;

            if (!res.ok) {
                if (res.status === 402) {
                    clearScanTimers();
                    go('pick');
                    gift.onNeedCharge();
                } else if (res.status === 422 && (data?.error === 'UNCLEAR_IMAGE' || data?.error === 'MINOR_SUSPECTED')) {
                    failToPick(`${data.message || FAIL_MSG} (포인트는 차감되지 않았어요)`);
                } else if (res.status === 503 && data?.error === 'PRICE_NOT_SET') {
                    setPrice(null);
                    failToPick(NOT_READY_MSG);
                    say(NOT_READY_MSG);
                } else {
                    failToPick(FAIL_MSG);
                }
                return;
            }

            const r = data as EstimateReport;
            if (!Array.isArray(r?.parts)) { failToPick(FAIL_MSG); return; }
            if (r.pointsCharged > 0) gift.onPointsChanged?.();
            setChipCount(chosen.length);

            const wait = reduce ? 0 : Math.max(0, MIN_SCAN_MS - (Date.now() - t0));
            const show = () => {
                clearScanTimers();
                setReport(r);
                setChecked(new Set(r.parts.flatMap(p => p.items.filter(i => i.suggested).map(i => i.id))));
                sumRef.current = [0, 0];
                setShownSum([0, 0]);
                setShownCards(0);
                go('report');
            };
            if (wait) later(show, wait, 'scan'); else show();
        } finally {
            clearTimeout(timeout);
            if (abortRef.current === ctrl) abortRef.current = null;
            busyRef.current = false;
            if (aliveRef.current) setBusy(false);
        }
    };

    // ── 리포트 계산(체크된 항목의 min/max 합) ──
    const totals = useMemo(() => {
        const per: Record<string, [number, number, number]> = {};   // [min, max, 체크 수]
        let min = 0, max = 0;
        for (const p of report?.parts ?? []) {
            let a = 0, b = 0, n = 0;
            for (const it of p.items) if (checked.has(it.id)) { a += it.min; b += it.max; n++; }
            per[p.part] = [a, b, n];
            min += a; max += b;
        }
        const maxAll = Math.max(1, ...(report?.parts ?? []).flatMap(p => p.items.map(i => i.max)));
        return { per, min, max, maxAll };
    }, [report, checked]);

    // 카드 순차 등장
    useEffect(() => {
        if (screen !== 'report' || !report) return;
        if (reduce) { setShownCards(report.parts.length); return; }
        const ids = report.parts.map((_, i) => later(() => setShownCards(c => Math.max(c, i + 1)), 250 + i * 180));
        return () => ids.forEach(clearTimeout);
    }, [screen, report, reduce, later]);

    // 총액 카운트업
    useEffect(() => {
        if (screen !== 'report') return;
        const to: [number, number] = [totals.min, totals.max];
        cancelAnimationFrame(rafRef.current);
        if (reduce || typeof requestAnimationFrame !== 'function') { sumRef.current = to; setShownSum(to); return; }
        const from = sumRef.current;
        const ms = from[0] === 0 && from[1] === 0 ? 900 : 450;
        const t0 = performance.now();
        const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
            const cur: [number, number] = [Math.round(from[0] + (to[0] - from[0]) * e), Math.round(from[1] + (to[1] - from[1]) * e)];
            sumRef.current = cur;
            setShownSum(cur);
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [screen, totals.min, totals.max, reduce]);

    const toggleItem = (id: string) => setChecked(s => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id); else n.add(id);
        return n;
    });

    const steps = (on: number) => (
        <div className="cc-steps" aria-hidden="true">{[0, 1, 2, 3].map(i => <i key={i} className={i < on ? 'cc-on' : ''} />)}</div>
    );
    const priceLabel = isGuest ? '회원' : price === null ? '준비 중' : typeof price === 'number' ? (price > 0 ? `${fmt(price)}P` : '무료') : '';
    const chosenParts = PARTS.filter(p => parts.includes(p.id));

    return (
        <div className="cc-root" ref={rootRef} role="dialog" aria-modal="true" aria-label={`${who} 뷰티 클리닉 & 스튜디오`}>
            <style>{CSS}</style>
            <button type="button" className="cc-close" onClick={onClose} aria-label="닫기">✕</button>
            <div className="cc-wrap">

                {screen === 'entry' && (
                    <section className="cc-screen" key="entry" aria-label="채린 뷰티 클리닉 입구">
                        <div className="cc-hero">
                            <img src={IMG.hero} alt="아이보리 니트를 입고 노트를 든 윤채린" />
                            <span className="cc-badge">AI 뷰티 컨설턴트 · 의료인 아님</span>
                            {!reduce && <>
                                <i className="cc-sparkle" style={{ left: '18%', top: '22%', animationDelay: '.2s' }} />
                                <i className="cc-sparkle" style={{ left: '78%', top: '14%', animationDelay: '1.1s' }} />
                                <i className="cc-sparkle" style={{ left: '66%', top: '40%', animationDelay: '2s' }} />
                            </>}
                            <div className="cc-copy">
                                <span className="cc-eyebrow">CHAERIN BEAUTY CLINIC &amp; STUDIO</span>
                                <h1><span style={{ animationDelay: '.1s' }}>어디부터</span> <span style={{ animationDelay: '.3s' }}>둘러볼까요?</span></h1>
                                <p>궁금했던 성형 견적도, 사진 한 장의 변신도 채린이 옆에서 같이 볼게요.</p>
                            </div>
                        </div>
                        <div className="cc-doors">
                            <button type="button" className={`cc-door${doorFx === 'clinic' ? ' cc-enter' : ''}`} onClick={() => openDoor('clinic')} aria-label="성형 — 병원으로 들어가기">
                                <img src={IMG.clinic} alt="" />
                                {[[21, 15, 15, 10, 0], [44, 15, 13, 10, .4], [64, 15, 11, 10, .8], [21, 32, 15, 12, 1.2], [44, 32, 13, 12, 1.6], [64, 32, 11, 12, 2]].map(([l, t, w, h, d]) => (
                                    <i key={`${l}-${t}`} className="cc-win" style={{ left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, animationDelay: `${d}s` }} />
                                ))}
                                <i className="cc-spill" />
                                <span className="cc-shade" />
                                <span className="cc-new">NEW 견적</span>
                                <span className="cc-dlabel"><b>성형</b><span>병원 문을 열면<br />부위별 견적이 나와요</span></span>
                                <span className="cc-whiteout" />
                            </button>
                            <button type="button" className={`cc-door${doorFx === 'studio' ? ' cc-shoot' : ''}`} onClick={() => openDoor('studio')} aria-label="스튜디오 — 사진 변신 기능 보기">
                                <img src={IMG.studio} alt="" />
                                <i className="cc-glow" style={{ left: '4%' }} /><i className="cc-glow" style={{ right: '4%' }} />
                                <span className="cc-flash" />
                                <span className="cc-shade" />
                                <span className="cc-dlabel"><b>스튜디오</b><span>헤어·프로필 화보<br />시간여행·닮은꼴</span></span>
                            </button>
                        </div>
                        <p className="cc-note">채린은 AI 캐릭터예요. 견적은 공개된 병원 가격을 모은 <b>참고 범위</b>이고, 진단이 아니에요.</p>
                    </section>
                )}

                {screen === 'clinic' && (
                    <section className="cc-screen" key="clinic" aria-label="성형 메뉴">
                        <button type="button" className="cc-back" onClick={() => go('entry')}>← 입구로</button>
                        <div className="cc-subhead"><img src={IMG.clinic} alt="" /><div><h2>성형 클리닉</h2><p>궁금한 건 먼저 알아보고, 결정은 의사와 상담해요.</p></div></div>
                        <div className="cc-menu">
                            <button type="button" className="cc-item cc-hi" onClick={openEstimate} style={{ animationDelay: '.05s' }}>
                                <span className="cc-ic" aria-hidden="true">🪞</span>
                                <span><b>내 성형 견적 뽑아보기</b><small>사진 한 장 → 관심 부위별 견적 → 전체 리포트</small></span>
                                {priceLabel ? <span className={`cc-price${price === null || isGuest ? ' cc-wait' : ''}`}>{priceLabel}</span> : <span />}
                            </button>
                            <button type="button" className="cc-item" onClick={() => go('table')} style={{ animationDelay: '.15s' }}>
                                <span className="cc-ic" aria-hidden="true">📋</span>
                                <span><b>부위별 평균 가격표</b><small>눈·코·윤곽·입술·피부 2026 공개 가격</small></span>
                                <span className="cc-price">무료</span>
                            </button>
                            <button type="button" className="cc-item" onClick={() => onStart()} style={{ animationDelay: '.25s' }}>
                                <span className="cc-ic" aria-hidden="true">💬</span>
                                <span><b>채린에게 물어보기</b><small>회복 기간·주의사항·상담 때 물어볼 것</small></span>
                                <span className="cc-price">무료</span>
                            </button>
                        </div>
                    </section>
                )}

                {screen === 'table' && (
                    <section className="cc-screen" key="table" aria-label="부위별 평균 가격표">
                        <button type="button" className="cc-back" onClick={() => go('clinic')}>← 성형 메뉴로</button>
                        <h2>부위별 평균 가격표</h2>
                        <p className="cc-src">{catalog?.asOf ? `${catalog.asOf.replace('-', '.')} 기준 · ` : ''}병원 공개 수가표·가격 비교 서비스 모음 · 만원 · 병원·지역·방법에 따라 달라요</p>
                        {!catalog && !catalogErr && <p className="cc-status" role="status">가격표를 불러오는 중…</p>}
                        {catalogErr && (
                            <div className="cc-panel">
                                <p className="cc-err" role="alert">가격표를 불러오지 못했어요.</p>
                                <button type="button" className="cc-btn cc-ghost" onClick={loadCatalog}>다시 불러오기</button>
                            </div>
                        )}
                        {catalog && (
                            <div className="cc-menu">
                                {catalog.parts.map(p => (
                                    <div className="cc-pcard cc-show" key={p.part}>
                                        <div className="cc-top"><h4>{p.name}</h4></div>
                                        {p.items.map(it => (
                                            <div className="cc-trow" key={it.id}>
                                                <span>{it.name}{it.note ? ` (${it.note})` : ''}{it.singleSource ? ' *' : ''}</span>
                                                <span className="cc-won">{fmt(it.min)}~{fmt(it.max)}만</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <p className="cc-src">
                                    출처: {catalog.sources.join(', ')}.
                                    {catalog.parts.some(p => p.items.some(i => i.singleSource)) ? ' * 표시는 단일 출처 항목이에요.' : ''}
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {screen === 'consent' && (
                    <section className="cc-screen" key="consent" aria-label="시작 전 확인">
                        <button type="button" className="cc-back" onClick={() => go('clinic')}>← 성형 메뉴로</button>
                        {steps(1)}
                        <div className="cc-panel">
                            <h3>시작 전에 확인해 주세요</h3>
                            {[
                                <>만 19세 이상이에요.</>,
                                <>결과는 공개 가격을 모은 <b>참고 범위</b>이고, 진단·처방이 아니라는 걸 알아요. 실제 수술 여부와 비용은 의사 상담으로 정해요.</>,
                                <>사진은 분석에만 쓰고 <b>저장하지 않아요</b>.</>,
                            ].map((txt, i) => (
                                <label className="cc-check" key={i}>
                                    <input type="checkbox" checked={consent[i]} onChange={e => { const v = e.target.checked; setConsent(c => c.map((x, j) => (j === i ? v : x))); }} />
                                    <span>{txt}</span>
                                </label>
                            ))}
                            <button type="button" className="cc-btn" disabled={!allAgreed} onClick={() => go('pick')}>동의하고 시작하기</button>
                        </div>
                    </section>
                )}

                {screen === 'pick' && (
                    <section className="cc-screen" key="pick" aria-label="사진과 관심 부위">
                        <button type="button" className="cc-back" onClick={() => go('consent')}>← 이전</button>
                        {steps(2)}
                        <div className="cc-panel">
                            <h3>정면 사진과 관심 부위</h3>
                            <div className="cc-upload">
                                <img src={preview ?? IMG.sample} alt={preview ? '올린 사진 미리보기' : '예시 정면 사진(가상 인물)'} />
                                <div>
                                    <p>이마·턱선·귀가 보이는 <b>정면 사진</b>이 가장 정확해요. 안경·필터는 빼 주세요.</p>
                                    <label className="cc-file">
                                        <input type="file" accept="image/*" onChange={onFile} aria-label="정면 사진 고르기" />
                                        📷 {prepping ? '사진 준비 중…' : preview ? '사진 바꾸기' : '사진 고르기'}
                                    </label>
                                </div>
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 700 }}>어디가 궁금하세요? (여러 개 가능)</p>
                            <div className="cc-parts">
                                {PARTS.map(p => (
                                    <button type="button" key={p.id} className="cc-part" aria-pressed={parts.includes(p.id)} onClick={() => togglePart(p.id)}>{p.name}</button>
                                ))}
                            </div>
                            {pickErr && <p className="cc-err" role="alert">{pickErr}</p>}
                            <button type="button" className="cc-btn" disabled={!canAnalyze} onClick={analyze}>
                                {busy ? '분석 중…' : `분석 시작${typeof price === 'number' && price > 0 ? ` · ${fmt(price)}P` : ''}`}
                            </button>
                            <p className="cc-src" style={{ textAlign: 'center' }}>얼굴이 또렷하지 않거나 분석이 안 되면 포인트는 차감되지 않아요.</p>
                        </div>
                    </section>
                )}

                {screen === 'scan' && (
                    <section className="cc-screen" key="scan" aria-label="얼굴 분석 중">
                        {steps(3)}
                        <div className="cc-scan">
                            {preview && <img src={preview} alt="" />}
                            <div className="cc-guide" aria-hidden="true" />
                            {!reduce && <div className="cc-beam" />}
                        </div>
                        <div className="cc-diagram">
                            <svg viewBox="0 0 100 110" aria-hidden="true">
                                <path className="cc-faceline" d="M50 8 C74 8 82 30 80 58 C78 86 64 102 50 104 C36 102 22 86 20 58 C18 30 26 8 50 8 Z" />
                                {PARTS.map(p => {
                                    const i = chosenParts.findIndex(c => c.id === p.id);
                                    const lit = i >= 0 && i < chipCount;
                                    return <g key={p.id} className={`cc-zone${lit ? ' cc-lit' : ''}${i < 0 ? ' cc-off' : ''}`} style={{ ['--z' as string]: p.color } as React.CSSProperties}>{ZONES[p.id]}</g>;
                                })}
                            </svg>
                            <ul className="cc-chips">
                                {chosenParts.map((p, i) => (
                                    <li key={p.id} className={i < chipCount ? 'cc-done' : ''}><i style={{ background: p.color }} />{p.chip}</li>
                                ))}
                            </ul>
                        </div>
                        <p className="cc-status" aria-live="polite">{scanMsg}</p>
                    </section>
                )}

                {screen === 'report' && report && (
                    <section className="cc-screen" key="report" aria-label="견적 리포트">
                        {steps(4)}
                        <div className="cc-total">
                            <small>선택한 시술 기준 예상 총액 · 참고 범위</small>
                            <div className="cc-sum" aria-hidden="true">{fmt(shownSum[0])} ~ {fmt(shownSum[1])}<em> 만원</em></div>
                            <span className="cc-sr" data-testid="cc-total" role="status">예상 총액 {fmt(totals.min)}만 ~ {fmt(totals.max)}만 원</span>
                            <div className="cc-stack" aria-hidden="true">
                                {report.parts.map(p => (
                                    <i key={p.part} style={{ background: PART_BY_ID.get(p.part)?.color, width: `${totals.max ? ((totals.per[p.part]?.[1] ?? 0) / totals.max) * 100 : 0}%` }} />
                                ))}
                            </div>
                            <div className="cc-legend">
                                {report.parts.map(p => <span key={p.part} style={{ ['--c' as string]: PART_BY_ID.get(p.part)?.color }}>{p.name}</span>)}
                            </div>
                        </div>
                        <p className="cc-charm">✨ <b>채린이 먼저 본 매력</b> — {report.charm}</p>
                        <div className="cc-cards">
                            {report.parts.map((p, pi) => {
                                const [a, b, n] = totals.per[p.part] ?? [0, 0, 0];
                                const shown = pi < shownCards;
                                return (
                                    <article key={p.part} className={`cc-pcard${shown ? ' cc-show' : ''}`}>
                                        <div className="cc-top"><h4>{p.name}</h4><span className="cc-range">{n ? `${fmt(a)}~${fmt(b)}만` : '선택 없음'}</span></div>
                                        <p className="cc-feat">{p.feature}</p>
                                        {p.items.map(it => (
                                            <label className="cc-opt" key={it.id}>
                                                <input type="checkbox" checked={checked.has(it.id)} onChange={() => toggleItem(it.id)} />
                                                <span>{it.name}{it.note ? ` (${it.note})` : ''}</span>
                                                <span className="cc-won">{fmt(it.min)}~{fmt(it.max)}만</span>
                                                <span className="cc-bar" aria-hidden="true">
                                                    <i style={shown
                                                        ? { left: `${(it.min / totals.maxAll) * 100}%`, width: `${Math.max(2, ((it.max - it.min) / totals.maxAll) * 100)}%` }
                                                        : { left: 0, width: 0 }} />
                                                </span>
                                            </label>
                                        ))}
                                        <p className="cc-src">공개 가격 범위{report.asOf ? `(${report.asOf.replace('-', '.')} 기준)` : ''} · 병원·방법에 따라 달라요</p>
                                    </article>
                                );
                            })}
                        </div>
                        <p className="cc-legal">이 리포트는 사진에서 보이는 특징과 <b>공개된 평균 가격</b>으로 만든 참고 자료예요. 진단이 아니며 특정 병원·시술을 권하지 않아요. 마취·검사·재수술·부가세는 별도일 수 있고, 실제 수술 여부와 비용은 반드시 전문의 상담으로 정하세요.</p>
                        <button type="button" className="cc-btn" onClick={() => { setPickErr(''); go('pick'); }}>다시 해보기</button>
                        <button type="button" className="cc-btn cc-ghost" onClick={() => onStart()}>채린에게 물어보기</button>
                        <button type="button" className="cc-btn cc-ghost" onClick={() => go('clinic')}>성형 메뉴로</button>
                    </section>
                )}

                {screen === 'studio' && (
                    <section className="cc-screen" key="studio" aria-label="스튜디오 메뉴">
                        <button type="button" className="cc-back" onClick={() => go('entry')}>← 입구로</button>
                        <div className="cc-subhead"><img src={IMG.studio} alt="" /><div><h2>스튜디오</h2><p>사진 한 장으로 다른 모습이 돼 봐요.</p></div></div>
                        <div className="cc-menu">
                            {STUDIO.map((m, i) => (
                                <button type="button" key={m.key} className="cc-item" onClick={() => onFeature(m.key)} style={{ animationDelay: `${.05 + i * .07}s` }}>
                                    <span className="cc-ic"><img src={m.thumb} alt="" loading="lazy" /></span>
                                    <span><b>{m.name}</b><small>{m.desc}</small></span>
                                    <span className="cc-price">{m.cost}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>
            {toast && <div className="cc-toast" role="status" aria-live="polite">{toast}</div>}
        </div>
    );
};
