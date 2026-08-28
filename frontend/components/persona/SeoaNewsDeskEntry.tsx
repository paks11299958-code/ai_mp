import React, { useEffect, useRef, useState } from 'react';
import { MpnFeatureIcon } from '../MainPageNew';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';
// 뉴스 본문은 **기존 보드를 그대로** 재사용한다(새로 만들지 않는다).
// ★유료(50P) 호출은 저 컴포넌트가 마운트된 뒤에만 일어난다 — 여기서는 렌더 자체를
//   사용자의 카테고리 클릭에 묶어 둔다.
import { TodayNewsBoard } from '../TodayNewsBoard';

// 서아 전용 진입 화면 — "뉴스데스크 랜딩".
//
// 왜 별도 화면인가(2026-08-27 사장 지시): 서아를 누르면 채팅창이 먼저 떠서
// **오늘 뭘 알 수 있는지**가 안 보였다. 환율·시세·날짜·절기·뉴스를 한 화면에
// 펼쳐 "서아가 데스크에 앉아 다 처리해 주는" 느낌을 만든다.
// 근거 문서: doc/features/persona_entry_seoa.md
//
// ★계약은 기존 시트와 똑같다 — onInvite()=친구초대, onFeature(key)=그 기능, onClose()=닫기.
//   App.tsx는 이 컴포넌트의 존재를 모른다(분기는 PersonaEntrySheet 안에서 한다).
//   ★★App.tsx를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ 실사고).
//
// ★★과금 경계(사양서 §3) — 이 화면이 지키는 단 하나의 절대 규칙:
//   **진입만으로는 절대 포인트가 차감되지 않는다.**
//   - 마운트 시 호출: `/api/desk/summary`(무료) · `/api/news/categories`(무료)
//     · `/api/points/menu-prices`(무료, 로그인 시에만 — 버튼에 찍을 단가를 받는다)
//   - `/api/news/today`(유료 50P)는 **이 파일 어디에서도 부르지 않는다.**
//     사용자가 카테고리를 눌러 TodayNewsBoard가 마운트될 때 그쪽이 부른다.
//   ★단가는 사장 관리 항목이라 숫자를 박지 않는다 — 서버가 안 주면 배지를 생략한다.

/** 밝은 푸른빛 뉴스데스크 톤. 도결의 먹빛·금박과 **섞이면 안 된다**. */
const T = {
    ink: '#1B2735',
    inkSub: '#51637B',
    inkMute: '#93A2B6',
    line: 'rgba(92,123,168,0.18)',
    lineSoft: 'rgba(92,123,168,0.12)',
    accent: '#3D74B8',
    accentDeep: '#2A5794',
    accentSoft: '#E8EEF7',
    /** 한국 증시 관례: 상승=빨강 ▲ / 하락=파랑 ▼ / 보합=회색 (TossTraderPanel과 동일) */
    up: '#D6413B',
    down: '#2C6FD1',
    flat: '#8A97A8',
} as const;

/**
 * 히어로 소재 — `public/seoa/` 에 실제로 존재하는 2장. 896×1195(세로 3:4).
 * ★새로 만들지 말 것. 두 장은 같은 카메라·같은 방·같은 얼굴이라 랜덤 교체해도
 *   위화감이 없다(gemini-3.1-flash-image 로 원본 프레임을 첨부해 얻은 결과).
 */
const SEOA_HERO_IMAGES = [
    '/seoa/seoa_stand_check_20260827.png',
    '/seoa/seoa_sit_check_20260827.png',
] as const;

/**
 * 뉴스 재생 중에 띄우는 뉴스룸 소재 2장(2026-08-27 신설).
 * 위 히어로 2장을 각각 원본으로 넣어 **배경만** 스튜디오로 바꾼 것이라 얼굴이 같다.
 * ★재생을 누를 때마다 랜덤이다. 히어로와 짝을 맞추지 않는다 — 사장 지시.
 */
const SEOA_NEWSROOM_IMAGES = [
    '/seoa/seoa_newsroom_stand_20260827.png',
    '/seoa/seoa_newsroom_sit_v2_20260827.png',
] as const;

const pickOne = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** 히어로 원본 비율. 이대로 잡아야 잘림이 없다(2026-08-26 모바일 잘림 사고). */
const SEOA_HERO_ASPECT = '896 / 1195';

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

/** 인사말 3단(사양서 5-1). ★분기는 **서버 KST**(date.timeOfDay)로만 한다.
    조명(필터·색막)은 2026-08-27 제거 — 인사말 문구만 시간대를 탄다. */
const GREETING: Record<TimeOfDay, { text: string; emoji: string }> = {
    morning:   { text: '좋은 아침이에요', emoji: '☀️' },
    afternoon: { text: '안녕하세요',      emoji: '👋' },
    evening:   { text: '좋은 저녁이에요', emoji: '🌆' },
};

// ── 부록 A 응답 계약 (shared-api routes/aimp/desk.ts 와 1:1) ──────────────────
// ★실패한 칸은 price/change 가 **null 이지 0이 아니다**. `?? 0` 폴백을 넣지 말 것.
type CellStatus = 'ok' | 'unavailable';
type Direction = 'up' | 'down' | 'flat' | null;

interface DeskDate {
    date: string;
    label: string;
    weekday: string;
    hour: number;
    timeOfDay: TimeOfDay;
    kst: string;
}

interface DeskSolarTerm {
    status: CellStatus;
    name?: string;
    hanja?: string;
    date?: string;
    daysSince?: number;
    label?: string;
    next?: { name: string; date: string; daysUntil: number };
}

interface DeskMarket {
    key: string;
    label: string;
    status: CellStatus;
    /**
     * 값의 성격(2026-08-27). ★표기를 이 값으로 가른다.
     *   'index' — 진짜 종합주가지수(6,912.37). **'원'을 붙이지 않는다.**
     *   'etf'   — 지수를 못 받아 대용 ETF 주가로 채운 것(109,135원). 지수가 아니다.
     */
    valueKind: 'index' | 'etf' | null;
    /** ETF 폴백일 때만 온다 — 화면이 이 이름을 숨기면 "코스피 109,135"로 오해한다. */
    proxy?: { symbol: string; name: string };
    price: number | null;
    prevClose: number | null;
    change: number | null;
    changePct: number | null;
    direction: Direction;
    asOf: string | null;
    reason?: string;
}

interface DeskFx {
    status: CellStatus;
    pair: string;
    rateSource: 'naver' | 'toss-etf-direction-only' | null;
    /** ★false 면 rate 가 null 이다. proxy.price(16,160원대)는 ETF 값이지 환율이 아니다. */
    hasRate: boolean;
    rate: number | null;
    change: number | null;
    changePct: number | null;
    direction: Direction;
    directionText: string | null;
    source: string | null;
    proxy?: { symbol: string; name: string; price: number; note: string };
    reason?: string;
}

interface DeskSummary {
    ok: boolean;
    free: boolean;
    degraded: boolean;
    date: DeskDate;
    solarTerm: DeskSolarTerm;
    markets: DeskMarket[];
    fx: DeskFx;
    fetchedAt: string;
    cacheTtlSeconds: number;
}

interface NewsCategory { key: string; label: string }
type NewsSlot = 'am' | 'pm';

/** agent-api의 TTS 파일은 오전/오후 슬롯별로 저장되므로 슬롯을 반드시 전달한다. */
export const buildNewsTtsUrl = (category: string, slot: NewsSlot): string =>
    `/api/news/tts?category=${encodeURIComponent(category)}&slot=${slot}`;

/** 실제 서버 계약: 본문(`/today`)만 차감하고 캐시된 TTS(`/tts`) 재생은 무료다. */
export const buildNewsCostNotice = (cost: number | null): string =>
    cost === null
        ? '글로 볼 때만 포인트가 차감되고, ▶ 듣기는 무료예요.'
        : `글로 볼 때만 ${cost}P가 차감되고, ▶ 듣기는 무료예요.`;

export const formatAudioTime = (seconds: number): string => {
    const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

/** 요약이 통째로 실패해도 **칸을 비우지 않는다**(사양서 §7). 라벨만 있는 자리표. */
const MARKET_PLACEHOLDERS: { key: string; label: string }[] = [
    { key: 'kospi', label: '코스피' },
    { key: 'kosdaq', label: '코스닥' },
];

const won = (n: number): string => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
const signed = (n: number): string => (n > 0 ? '+' : '') + won(n);
const signedPct = (n: number): string => (n > 0 ? '+' : '') + n.toFixed(2) + '%';
const arrowOf = (d: Direction): string => (d === 'up' ? '▲' : d === 'down' ? '▼' : '·');
const colorOf = (d: Direction): string => (d === 'up' ? T.up : d === 'down' ? T.down : T.flat);

// 스타일은 Tailwind가 아니라 이 컴포넌트 전용 CSS로 둔다(도결 랜딩과 같은 방식).
// 톤이 밖으로 새지 않도록 전부 `sn-` 접두사를 붙인다.
// ★외부 CDN 금지 — 폰트는 앱이 이미 쓰는 시스템 스택만 쓴다.
const SEOA_CSS = `
.sn-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:radial-gradient(120% 82% at 50% -14%, #FFFFFF 0%, #F0F6FD 44%, #E1EBF7 100%);
  color:${T.ink};-webkit-font-smoothing:antialiased;
  font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;}
.sn-sheet{position:relative;box-sizing:border-box;width:100%;max-width:1180px;margin:0 auto;
  min-height:100%;padding:max(26px,env(safe-area-inset-top)) 20px max(36px,env(safe-area-inset-bottom));}
/* ★2026-08-26 모바일 잘림 사고 재발 방지 — 이 화면의 모든 이미지에 건다. */
.sn-root img{max-width:100%;height:auto;}

.sn-close{position:absolute;top:max(14px,env(safe-area-inset-top));right:16px;z-index:4;
  width:40px;height:40px;display:flex;align-items:center;justify-content:center;
  border-radius:50%;border:1px solid ${T.line};background:rgba(255,255,255,0.88);
  color:${T.inkSub};font-size:17px;line-height:1;cursor:pointer;
  box-shadow:0 6px 16px -8px rgba(30,60,110,.45);
  transition:transform .15s ease,background .15s ease;}
.sn-close:hover{background:#fff;color:${T.accentDeep};}
.sn-close:active{transform:scale(.9);}

.sn-top{display:grid;grid-template-columns:minmax(0,0.84fr) minmax(0,1.16fr);
  gap:34px;align-items:start;padding-top:30px;}

/* ── 히어로 ────────────────────────────────────────────────────────────────
   재생 중에는 같은 자리에 뉴스룸 이미지가 들어간다(src 만 바뀐다). */
.sn-hero{position:relative;width:100%;max-width:430px;margin:0 auto;border-radius:22px;overflow:hidden;
  border:1px solid ${T.line};background:${T.accentSoft};
  box-shadow:0 34px 60px -34px rgba(24,50,92,.55);}
.sn-herofig{position:relative;margin:0;display:block;width:100%;aspect-ratio:${SEOA_HERO_ASPECT};
  overflow:hidden;background:${T.accentSoft};}
.sn-heroimg{display:block;width:100%;height:auto;}
/* ★시간대 조명(필터·색막)은 2026-08-27 사장 지시로 제거했다.
   저녁 앰버막(.46)이 특히 세서 인물 톤을 덮었다 — 원본 사진을 그대로 보여준다.
   시간대 감각은 인사말 문구(GREETING)가 대신한다. 되살리지 말 것. */

.sn-greet{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:38px 20px 18px;
  background:linear-gradient(to top,rgba(12,26,44,.80) 30%,rgba(12,26,44,.34) 68%,rgba(12,26,44,0) 100%);
  color:#fff;}
.sn-greettext{margin:0;font-size:clamp(19px,2.6vw,25px);font-weight:800;letter-spacing:-.02em;
  line-height:1.3;text-shadow:0 2px 10px rgba(0,0,0,.45);overflow-wrap:anywhere;}
.sn-greetsub{margin:6px 0 0;font-size:12.5px;font-weight:600;line-height:1.6;
  color:rgba(255,255,255,.88);text-shadow:0 1px 6px rgba(0,0,0,.5);}

/* ── 오른쪽 — 티커·시세·뉴스 ──────────────────────────────────────────────── */
.sn-badge{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;
  border:1px solid ${T.line};background:#fff;color:${T.accentDeep};
  font-size:12px;font-weight:700;letter-spacing:.02em;}
.sn-badge i{width:5px;height:5px;border-radius:50%;background:${T.accent};display:block;}

.sn-title{margin:14px 0 0;font-size:clamp(26px,3.6vw,38px);font-weight:800;line-height:1.24;
  letter-spacing:-.025em;color:${T.ink};}
.sn-desc{margin:12px 0 0;max-width:44ch;font-size:14px;line-height:1.8;color:${T.inkSub};
  white-space:pre-line;overflow-wrap:anywhere;}

.sn-ticker{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px;margin-top:20px;
  padding:11px 15px;border-radius:14px;background:#fff;border:1px solid ${T.lineSoft};
  box-shadow:0 10px 24px -20px rgba(24,50,92,.6);}
.sn-tickeritem{font-size:13px;font-weight:700;color:${T.inkSub};overflow-wrap:anywhere;}
.sn-tickeritem b{color:${T.ink};font-weight:800;}

.sn-secthead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:26px;}
.sn-secttitle{margin:0;font-size:15.5px;font-weight:800;color:${T.ink};}
.sn-sectsub{margin:0;font-size:11.5px;font-weight:600;color:${T.inkMute};}

.sn-mkts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;}
.sn-mkt{box-sizing:border-box;min-width:0;padding:14px;border-radius:16px;background:#fff;
  border:1px solid ${T.lineSoft};box-shadow:0 12px 26px -22px rgba(24,50,92,.7);}
.sn-mkthead{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;min-width:0;}
.sn-mktname{font-size:12.5px;font-weight:800;color:${T.inkSub};}
/* ★대용 ETF 이름 — 숨기면 "코스피 108,680"으로 오해한다(사양서 부록 A-3). */
.sn-mktproxy{font-size:10.5px;font-weight:600;color:${T.inkMute};overflow-wrap:anywhere;}
.sn-mktbody{min-width:0;}
.sn-mktprice{margin-top:8px;font-size:20px;font-weight:800;letter-spacing:-.03em;color:${T.ink};
  font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.sn-mktprice small{margin-left:2px;font-size:11.5px;font-weight:700;color:${T.inkMute};}
.sn-mktdelta{margin-top:3px;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;
  overflow-wrap:anywhere;}
.sn-mktna{margin-top:8px;font-size:13.5px;font-weight:800;color:${T.inkMute};}
.sn-mktsub{margin-top:5px;font-size:10.5px;font-weight:600;line-height:1.5;color:${T.inkMute};
  overflow-wrap:anywhere;}

.sn-newsnote{margin:10px 0 0;font-size:11.5px;line-height:1.65;color:${T.inkMute};}
.sn-newsnote b{color:${T.accentDeep};font-weight:800;}
.sn-cats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px;}
/* ★카드는 이제 div 다 — 안에 '글로 보기'와 '▶ 듣기' 두 버튼이 들어간다(2026-08-27).
   버튼 안에 버튼을 넣을 수 없어 껍데기를 div 로 바꿨다. */
.sn-cat{display:flex;align-items:stretch;gap:0;box-sizing:border-box;
  width:100%;min-width:0;border-radius:14px;overflow:hidden;
  border:1px solid ${T.line};background:#fff;color:${T.ink};
  box-shadow:0 10px 22px -20px rgba(24,50,92,.7);
  transition:border-color .15s ease,background .15s ease,transform .15s ease;}
.sn-cat:hover{border-color:rgba(61,116,184,.55);}
.sn-cat.is-playing{border-color:${T.accentDeep};background:${T.accentSoft};}
.sn-catmain{flex:1 1 auto;min-width:0;display:flex;align-items:center;
  padding:12px 10px 12px 12px;border:0;background:transparent;color:inherit;
  cursor:pointer;text-align:left;font:inherit;}
.sn-catmain:hover{background:${T.accentSoft};}
.sn-catmain:active{transform:scale(.98);}
.sn-catlabel{min-width:0;font-size:12.5px;font-weight:700;line-height:1.35;overflow-wrap:anywhere;}
/* ▶ — 최소 40px 폭. 모바일에서 손가락으로 눌리는 크기를 지킨다. */
.sn-catplay{flex:0 0 auto;width:40px;display:flex;align-items:center;justify-content:center;
  border:0;border-left:1px solid ${T.line};background:transparent;cursor:pointer;
  font-size:12px;line-height:1;color:${T.accentDeep};transition:background .15s ease;}
.sn-catplay:hover:not(:disabled){background:${T.accentSoft};}
.sn-catplay:disabled{opacity:.5;cursor:default;}
.sn-cat.is-playing .sn-catplay{background:${T.accentDeep};color:#fff;border-left-color:${T.accentDeep};}
.sn-playerr{margin:9px 0 0;padding:9px 12px;border-radius:11px;font-size:11.5px;line-height:1.6;
  color:#8A4B12;background:#FDF1E3;border:1px solid #F0D6B8;}

/* ON AIR — 재생 중 히어로 위에 뜬다. */
.sn-onair{display:inline-block;margin-right:9px;padding:3px 8px;border-radius:5px;
  font-size:10.5px;font-weight:900;letter-spacing:.1em;vertical-align:middle;
  color:#fff;background:#D8443C;}
.sn-stop{margin-left:10px;padding:3px 9px;border-radius:8px;font-size:11px;font-weight:800;
  cursor:pointer;color:#fff;background:rgba(255,255,255,.18);
  border:1px solid rgba(255,255,255,.45);}
.sn-stop:hover{background:rgba(255,255,255,.3);}
.sn-player{margin-top:10px;padding:9px 10px;border-radius:10px;background:rgba(5,17,31,.46);
  border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(4px);}
.sn-playmeta{display:flex;align-items:center;justify-content:space-between;gap:10px;
  font-size:10.5px;font-weight:700;color:rgba(255,255,255,.9);}
.sn-playtrack{height:4px;margin-top:7px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.24);}
.sn-playfill{display:block;height:100%;border-radius:inherit;background:#fff;transition:width .2s linear;}
.sn-playcontrols{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;}
.sn-playcontrol{padding:4px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.28);
  background:rgba(255,255,255,.12);color:#fff;font-size:10.5px;font-weight:800;cursor:pointer;}
.sn-playcontrol:hover{background:rgba(255,255,255,.22);}

.sn-hint{margin:12px 0 0;padding:11px 14px;border-radius:13px;font-size:12px;line-height:1.65;
  color:${T.accentDeep};background:${T.accentSoft};border:1px solid ${T.line};}

.sn-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;}
.sn-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 13px 7px 9px;border-radius:999px;
  border:1px solid ${T.line};background:#fff;color:${T.ink};
  font-size:12.5px;font-weight:700;cursor:pointer;transition:border-color .15s ease,background .15s ease;}
.sn-chip:hover{background:${T.accentSoft};border-color:rgba(61,116,184,.5);}
.sn-chip:active{transform:scale(.97);}

.sn-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px;}
.sn-cta{padding:13px 28px;border-radius:999px;border:none;cursor:pointer;
  font-size:15px;font-weight:800;color:#fff;
  background:linear-gradient(135deg,#5C93DC 0%,${T.accentDeep} 100%);
  box-shadow:0 14px 28px -14px rgba(42,87,148,.9);transition:transform .15s ease;}
.sn-cta:active{transform:scale(.98);}
.sn-cta2{padding:13px 22px;border-radius:999px;cursor:pointer;font-size:13.5px;font-weight:700;
  color:${T.inkSub};border:1px solid ${T.line};background:#fff;
  transition:color .15s ease,border-color .15s ease;}
.sn-cta2:hover{color:${T.accentDeep};border-color:rgba(61,116,184,.5);}

.sn-fade{animation:snFade .26s ease;}
@keyframes snFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  .sn-fade{animation:none;}
  .sn-cat,.sn-chip,.sn-cta,.sn-cta2,.sn-close{transition:none;}
  .sn-cat:active,.sn-chip:active,.sn-cta:active,.sn-close:active{transform:none;}
}

/* 모바일 분기 820px — 620px는 780px 실기기에서 좁았다(사양서 §7). */
@media (max-width:820px){
  .sn-sheet{padding-left:16px;padding-right:16px;}
  .sn-top{grid-template-columns:minmax(0,1fr);gap:22px;padding-top:46px;}
  /* ★max-width(430px)는 그대로 둔다. 820px에서 히어로를 전폭으로 늘리면 세로 3:4를
     가로로 벌리느라 방 절반만 남고 얼굴이 구석으로 밀린다(실측). 폭이 좁을 때만
     화면을 꽉 채우고, 태블릿에서는 카드로 남는다. */
  .sn-hero{order:-1;border-radius:18px;}
  /* 세로 3:4 원본을 그대로 두면 390px에서 히어로만 520px — 티커도 시세도 첫 화면에서
     안 보인다. 여기서만 위쪽(얼굴)을 기준으로 잘라 담고, **가로는 절대 넘치지 않는다**. */
  .sn-herofig{max-height:min(46vh,420px);}
  .sn-heroimg{height:100%;object-fit:cover;object-position:50% 16%;}
  .sn-desc{max-width:none;}
  /* 좁은 폭에서 3칸을 유지하면 "KODEX 코스닥150"이 줄바꿈되며 카드가 들쭉날쭉해진다.
     한 줄에 하나씩, 값은 오른쪽으로 붙여 읽기 흐름을 지킨다. */
  .sn-mkts{grid-template-columns:minmax(0,1fr);gap:8px;}
  .sn-mkt{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;}
  .sn-mkthead{flex:1 1 auto;flex-direction:column;align-items:flex-start;gap:2px;}
  .sn-mktbody{flex:0 0 auto;text-align:right;}
  .sn-mktprice{margin-top:0;font-size:18px;}
  .sn-mktna{margin-top:0;font-size:12.5px;}
  .sn-mktsub{margin-top:2px;}
  .sn-cats{grid-template-columns:repeat(2,minmax(0,1fr));}
  .sn-cta,.sn-cta2{flex:1 1 100%;text-align:center;}
}
@media (max-width:360px){
  .sn-cats{grid-template-columns:minmax(0,1fr);}
}
`;

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onInvite: () => void;
    onFeature: (featureKey: string) => void;
}

export const SeoaNewsDeskEntry: React.FC<Props> = ({ guide, onClose, onInvite, onFeature }) => {
    // 히어로는 **마운트 시 한 번** 뽑는다. 렌더마다 뽑으면 상태가 바뀔 때마다
    // 서 있다 앉았다 하며 화면이 튄다.
    const [heroSrc] = useState(() => pickOne(SEOA_HERO_IMAGES));

    /** 재생 중인 카테고리(=뉴스룸으로 바뀐 상태). null 이면 평소 히어로. */
    const [playing, setPlaying] = useState<string | null>(null);
    /** 이번 재생에 쓸 뉴스룸 이미지 — ★재생을 누를 때마다 새로 뽑는다. */
    const [newsroomSrc, setNewsroomSrc] = useState<string>(SEOA_NEWSROOM_IMAGES[0]);
    const [playLoading, setPlayLoading] = useState<string | null>(null);
    const [playError, setPlayError] = useState('');
    const [playCurrent, setPlayCurrent] = useState(0);
    const [playDuration, setPlayDuration] = useState(0);
    const [playPaused, setPlayPaused] = useState(false);
    const [playRate, setPlayRate] = useState<0.8 | 1 | 1.2>(1);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const heroRef = useRef<HTMLDivElement | null>(null);
    const playOriginScrollRef = useRef<number | null>(null);
    const playOriginFocusRef = useRef<HTMLElement | null>(null);

    const [summary, setSummary] = useState<DeskSummary | null>(null);
    /** 요약이 죽어도 화면(히어로·인사말·뉴스)은 살아 있어야 한다 — 시세 칸만 대체 문구. */
    const [summaryFailed, setSummaryFailed] = useState(false);
    const [categories, setCategories] = useState<NewsCategory[]>([]);
    const [catsFailed, setCatsFailed] = useState(false);
    /** 오늘 생성된 최신 뉴스 슬롯. 슬롯 없는 TTS 요청은 agent-api에서 404가 난다. */
    const [newsSlot, setNewsSlot] = useState<NewsSlot | null>(null);
    /** 뉴스 1건 단가. ★서버가 안 주면 null 로 두고 배지를 **생략**한다(50을 박지 않는다). */
    const [newsCost, setNewsCost] = useState<number | null>(null);
    /** 사용자가 고른 카테고리. null 이면 유료 보드가 **마운트되지 않는다**(= 차감 없음). */
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [needLogin, setNeedLogin] = useState(false);

    // ★마운트 시 1회. 여기서 부르는 세 곳은 전부 무료다.
    //   `/api/news/today`(유료 50P)는 이 파일 어디에서도 부르지 않는다.
    useEffect(() => {
        let alive = true;

        // ① 데스크 요약 — 무료·로그인 불필요라 인증 헤더를 붙이지 않는다.
        fetch('/api/desk/summary')
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`desk ${r.status}`))))
            .then((d: DeskSummary) => { if (alive) setSummary(d); })
            .catch(() => { if (alive) setSummaryFailed(true); });

        // ② 뉴스 카테고리 목록 — 무료. 본문이 아니라 '무엇이 있는지'만 받는다.
        fetch('/api/news/categories')
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`categories ${r.status}`))))
            .then((d: { categories?: NewsCategory[] }) => {
                if (!alive) return;
                const list = Array.isArray(d?.categories) ? d.categories : [];
                if (list.length) setCategories(list);
                else setCatsFailed(true);
            })
            .catch(() => { if (alive) setCatsFailed(true); });

        // ③ 오늘 생성된 최신 슬롯 — TTS 파일 경로 선택에 필요하며 무료다.
        fetch('/api/news/status')
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
            .then((d: { slot?: string; slots?: string[] }) => {
                if (!alive) return;
                const latest = d?.slot ?? d?.slots?.[d.slots.length - 1];
                if (latest === 'am' || latest === 'pm') setNewsSlot(latest);
            })
            .catch(() => { /* 재생 시 한 번 더 조회한다 */ });

        // ④ 단가 — 로그인 상태에서만 받을 수 있다(무료 조회). 못 받으면 배지를 생략한다.
        const token = localStorage.getItem('token');
        if (token) {
            fetch('/api/points/menu-prices', { headers: { Authorization: `Bearer ${token}` } })
                .then(r => (r.ok ? r.json() : Promise.reject(new Error(`prices ${r.status}`))))
                .then((d: { prices?: Record<string, number> }) => {
                    if (!alive) return;
                    const cost = d?.prices?.news;
                    if (typeof cost === 'number' && Number.isFinite(cost)) setNewsCost(cost);
                })
                .catch(() => { /* 배지만 생략된다 — 화면은 그대로 뜬다 */ });
        }

        return () => { alive = false; };
    }, []);

    // Esc — 뉴스 보드가 열려 있으면 그것부터 닫는다(한 번에 랜딩까지 날아가면 당황스럽다).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (openCategory) setOpenCategory(null);
            else onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, openCategory]);

    // ★인사말은 **서버 KST**(date.timeOfDay)로만 정한다. 브라우저 시계는 쓰지 않는다.
    //   요약이 아직/영영 없으면 필터 없는 낮 톤으로 둔다(멋대로 아침/저녁을 지어내지 않는다).
    const timeOfDay: TimeOfDay = summary?.date?.timeOfDay ?? 'afternoon';
    const greeting = GREETING[timeOfDay] ?? GREETING.afternoon;

    const solarTerm = summary?.solarTerm;
    const showSolarTerm = solarTerm?.status === 'ok' && !!solarTerm.label;

    const who = guide.personaName || guide.title;
    // 서아의 기능은 'news' 하나다(personaFeatures.ts). 뉴스 칸이 이미 그 자리를 대신하므로
    // 칩으로 또 보여주지 않는다 — 나중에 기능이 늘면 그때만 칩이 나온다.
    const extraFeatures = (guide.features ?? []).filter(f => f.key !== 'news');

    /** 뉴스룸으로 시선을 옮기되 사용자의 모션 감소 설정을 따른다. */
    const focusNewsroom = () => {
        const root = rootRef.current;
        const hero = heroRef.current;
        if (!root || !hero) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        const top = root.scrollTop + hero.getBoundingClientRect().top - root.getBoundingClientRect().top - 12;
        root.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
        hero.focus({ preventScroll: true });
    };

    /** 재생 전 위치와 ▶ 버튼으로 돌아간다. */
    const restorePlaybackView = () => {
        const root = rootRef.current;
        const top = playOriginScrollRef.current;
        const target = playOriginFocusRef.current;
        playOriginScrollRef.current = null;
        playOriginFocusRef.current = null;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        if (root && top !== null) root.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
        if (target?.isConnected) target.focus({ preventScroll: true });
    };

    /** 재생 정지 — 뉴스룸에서 평소 히어로와 재생 전 위치로 돌아온다. */
    const stopPlay = () => {
        const a = audioRef.current;
        if (a) {
            a.pause();
            a.onended = null; a.onerror = null; a.onloadedmetadata = null; a.ontimeupdate = null;
            if (a.dataset?.objUrl) { URL.revokeObjectURL(a.dataset.objUrl); delete a.dataset.objUrl; }
        }
        setPlaying(null);
        setPlayLoading(null);
        setPlayCurrent(0);
        setPlayDuration(0);
        setPlayPaused(false);
        restorePlaybackView();
    };

    const togglePlayback = async () => {
        const audio = audioRef.current;
        if (!audio || !playing) return;
        if (playPaused) {
            try { await audio.play(); setPlayPaused(false); }
            catch { setPlayError('음성을 계속 재생하지 못했어요.'); }
        } else {
            audio.pause();
            setPlayPaused(true);
        }
    };

    const replayFromStart = async () => {
        const audio = audioRef.current;
        if (!audio || !playing) return;
        audio.currentTime = 0;
        setPlayCurrent(0);
        try { await audio.play(); setPlayPaused(false); }
        catch { setPlayError('음성을 다시 재생하지 못했어요.'); }
    };

    const cyclePlaybackRate = () => {
        const next = playRate === 0.8 ? 1 : playRate === 1 ? 1.2 : 0.8;
        setPlayRate(next);
        if (audioRef.current) audioRef.current.playbackRate = next;
    };

    /**
     * ▶ 재생 — 로그인은 필요하지만 캐시된 TTS를 받으므로 포인트는 차감되지 않는다.
     * ★모바일 대응: 사용자 제스처(클릭) 시점에 audio 엘리먼트를 만들어 둬야
     *   fetch 뒤의 play() 가 차단되지 않는다(TodayNewsBoard 에서 검증된 패턴).
     */
    const playNews = async (key: string, trigger?: HTMLElement) => {
        if (!localStorage.getItem('token')) { setNeedLogin(true); return; }
        setNeedLogin(false);
        setPlayError('');

        // 재생이 끝나면 사용자가 ▶를 눌렀던 자리와 버튼으로 정확히 돌아간다.
        playOriginScrollRef.current = rootRef.current?.scrollTop ?? null;
        playOriginFocusRef.current = trigger ?? (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);

        // ★제스처 컨텍스트 유지 — await 이전에 엘리먼트를 확보한다.
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.pause();

        // ★재생을 누를 때마다 뉴스룸 이미지를 새로 뽑는다(사장 지시).
        setNewsroomSrc(pickOne(SEOA_NEWSROOM_IMAGES));
        setPlayLoading(key);

        try {
            // 마운트 직후 바로 누른 경우에도 슬롯을 확보한다.
            let slot = newsSlot;
            if (!slot) {
                const statusRes = await fetch('/api/news/status');
                if (!statusRes.ok) throw new Error('nofile');
                const status = await statusRes.json() as { slot?: string; slots?: string[] };
                const latest = status?.slot ?? status?.slots?.[status.slots.length - 1];
                if (latest !== 'am' && latest !== 'pm') throw new Error('nofile');
                slot = latest;
                setNewsSlot(latest);
            }

            const res = await fetch(buildNewsTtsUrl(key, slot), {
                credentials: 'include',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            });
            if (!res.ok) throw new Error(res.status === 401 ? 'login' : 'nofile');

            const url = URL.createObjectURL(await res.blob());
            if (audio.dataset?.objUrl) URL.revokeObjectURL(audio.dataset.objUrl);
            audio.dataset.objUrl = url;
            audio.onended = () => stopPlay();
            audio.onerror = () => { setPlayError('음성을 재생하지 못했어요.'); stopPlay(); };
            audio.onloadedmetadata = () => {
                setPlayDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
                setPlayCurrent(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
            };
            audio.ontimeupdate = () => setPlayCurrent(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
            audio.playbackRate = playRate;
            audio.src = url;

            setPlayLoading(null);
            setPlaying(key);          // ← 여기서 화면이 뉴스룸으로 바뀐다
            await audio.play();
            requestAnimationFrame(focusNewsroom);
        } catch (e: any) {
            setPlayLoading(null);
            setPlaying(null);
            restorePlaybackView();
            if (e?.message === 'login') setNeedLogin(true);
            else setPlayError('아직 오늘 음성이 준비되지 않았어요. 글로 보실 수 있어요.');
        }
    };

    // 화면을 벗어나면 재생을 멈춘다(소리만 남는 것을 막는다).
    useEffect(() => () => {
        const a = audioRef.current;
        if (a) { a.pause(); if (a.dataset?.objUrl) URL.revokeObjectURL(a.dataset.objUrl); }
    }, []);

    /** 카테고리 클릭 — **여기서부터가 유료 구간**이다. */
    const openNews = (key: string) => {
        // 유료 조회는 로그인 필수(news.ts:72). 모달을 띄워 401을 보여주기보다 먼저 알린다.
        if (!localStorage.getItem('token')) { setNeedLogin(true); return; }
        setNeedLogin(false);
        setOpenCategory(key);
    };

    /** 시세 카드 한 장. ★status/price/change 가 null 인 경우를 절대 0으로 메우지 않는다. */
    const renderMarket = (m: DeskMarket) => {
        const hasPrice = m.status === 'ok' && typeof m.price === 'number';
        const hasDelta = hasPrice && typeof m.change === 'number' && typeof m.changePct === 'number';
        // ★지수는 '원'이 아니다(6,912.37 포인트). ETF 폴백일 때만 '원'을 붙인다.
        const isIndex = m.valueKind === 'index';
        return (
            <div className="sn-mkt" key={m.key}>
                <div className="sn-mkthead">
                    <span className="sn-mktname">{m.label}</span>
                    {/* ETF 로 떨어졌을 때만 대용 이름을 드러낸다 — 숨기면 지수로 오해된다. */}
                    <span className="sn-mktproxy">{isIndex ? '종합주가지수' : m.proxy?.name}</span>
                </div>
                <div className="sn-mktbody">
                    {hasPrice ? (
                        <>
                            <div className="sn-mktprice">
                                {isIndex
                                    ? (m.price as number).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    : <>{won(m.price as number)}<small>원</small></>}
                            </div>
                            {hasDelta ? (
                                <div className="sn-mktdelta" style={{ color: colorOf(m.direction) }}>
                                    {arrowOf(m.direction)} {signed(m.change as number)} ({signedPct(m.changePct as number)})
                                </div>
                            ) : (
                                <div className="sn-mktsub">등락은 잠시 후 다시</div>
                            )}
                        </>
                    ) : (
                        <div className="sn-mktna">잠시 후 다시</div>
                    )}
                </div>
            </div>
        );
    };

    /** 자리표 카드 — 요약 자체가 실패했을 때. **칸을 비우지 않는다**(사양서 §7). */
    const renderPlaceholder = (p: { key: string; label: string }) => (
        <div className="sn-mkt" key={p.key}>
            <div className="sn-mkthead"><span className="sn-mktname">{p.label}</span></div>
            <div className="sn-mktbody"><div className="sn-mktna">잠시 후 다시</div></div>
        </div>
    );

    /** 환율 카드. ★hasRate 가 false 면 숫자를 **절대** 찍지 않고 방향만 말한다. */
    const renderFx = () => {
        const fx = summary?.fx;
        if (!fx || fx.status !== 'ok') {
            return (
                <div className="sn-mkt">
                    <div className="sn-mkthead"><span className="sn-mktname">원/달러</span></div>
                    <div className="sn-mktbody"><div className="sn-mktna">잠시 후 다시</div></div>
                </div>
            );
        }
        const dirWord = fx.direction === 'up' ? '↑' : fx.direction === 'down' ? '↓' : '·';
        return (
            <div className="sn-mkt">
                <div className="sn-mkthead">
                    <span className="sn-mktname">원/달러</span>
                    <span className="sn-mktproxy">{fx.rateSource === 'naver' ? '네이버 금융' : '방향만'}</span>
                </div>
                <div className="sn-mktbody">
                    {fx.hasRate && typeof fx.rate === 'number' ? (
                        <>
                            <div className="sn-mktprice">{won(fx.rate)}<small>원</small></div>
                            {typeof fx.changePct === 'number' ? (
                                <div className="sn-mktdelta" style={{ color: colorOf(fx.direction) }}>
                                    {arrowOf(fx.direction)}
                                    {typeof fx.change === 'number' ? ` ${signed(fx.change)}` : ''}
                                    {` (${signedPct(fx.changePct)})`}
                                </div>
                            ) : (
                                <div className="sn-mktsub">등락은 잠시 후 다시</div>
                            )}
                        </>
                    ) : (
                        // ★폴백(KODEX 미국달러선물) — ETF 가격 16,160원대는 환율이 아니다.
                        //   방향(changePct)만 유효하므로 "달러 ↓ 0.34%" 로만 쓴다.
                        <>
                            <div className="sn-mktprice" style={{ color: colorOf(fx.direction), fontSize: 17 }}>
                                달러 {dirWord}
                                {typeof fx.changePct === 'number' ? ` ${Math.abs(fx.changePct).toFixed(2)}%` : ''}
                            </div>
                            <div className="sn-mktsub">환율 숫자는 잠시 후 다시 · 지금은 방향만 확인돼요</div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const markets = summary?.markets ?? [];
    const playProgress = playDuration > 0 ? Math.min(100, Math.max(0, (playCurrent / playDuration) * 100)) : 0;
    const playRemaining = Math.max(0, playDuration - playCurrent);

    return (
        // 배경 클릭 = 닫기. 내용은 max-width로 묶여 있어 넓은 화면의 양옆이 배경이 된다.
        <div ref={rootRef} className="sn-root" onClick={onClose}>
            <style>{SEOA_CSS}</style>
            <div
                className="sn-sheet"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={`${guide.title} 뉴스데스크`}
            >
                <button className="sn-close" onClick={onClose} aria-label="닫기">✕</button>

                <div className="sn-top">
                    {/* ① 히어로 — 선 모습/앉은 모습 랜덤.
                        ★재생 중에는 뉴스룸으로 바뀐다(playing !== null). 끝나면 스스로 돌아온다. */}
                    <div
                        ref={heroRef}
                        className="sn-hero"
                        tabIndex={-1}
                        aria-label={playing ? `${who} 뉴스룸 재생 중` : `${who} 뉴스데스크`}
                    >
                        <figure className="sn-herofig">
                            <img
                                className="sn-heroimg"
                                src={playing ? newsroomSrc : heroSrc}
                                alt={playing ? `${who} 뉴스룸` : `${who} 뉴스데스크`}
                                width={896}
                                height={1195}
                            />
                        </figure>
                        {/* ★인사말은 figure 밖이다 — 글자가 이미지 처리에 닿지 않는다. */}
                        <div className="sn-greet">
                            {playing ? (
                                <>
                                    <p className="sn-greettext">
                                        <span className="sn-onair">ON AIR</span>
                                        {categories.find(c => c.key === playing)?.label ?? '뉴스'}
                                    </p>
                                    <p className="sn-greetsub">
                                        읽어 드리고 있어요.
                                        <button type="button" className="sn-stop" onClick={stopPlay}>■ 멈추기</button>
                                    </p>
                                    <div className="sn-player">
                                        <div className="sn-playmeta">
                                            <span>{newsSlot === 'pm' ? '오후' : '오전'} 브리핑</span>
                                            <span>{formatAudioTime(playCurrent)} · 남은 {formatAudioTime(playRemaining)}</span>
                                        </div>
                                        <div
                                            className="sn-playtrack"
                                            role="progressbar"
                                            aria-label="뉴스 음성 재생 진행률"
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={Math.round(playProgress)}
                                        >
                                            <span className="sn-playfill" style={{ width: `${playProgress}%` }} />
                                        </div>
                                        <div className="sn-playcontrols" aria-label="뉴스 음성 재생 제어">
                                            <button type="button" className="sn-playcontrol" onClick={togglePlayback}>
                                                {playPaused ? '▶ 계속 듣기' : 'Ⅱ 일시정지'}
                                            </button>
                                            <button type="button" className="sn-playcontrol" onClick={replayFromStart}>
                                                ↺ 처음부터
                                            </button>
                                            <button type="button" className="sn-playcontrol" onClick={cyclePlaybackRate}>
                                                {playRate.toFixed(1)}× 속도
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="sn-greettext">{greeting.text} {greeting.emoji}</p>
                                    <p className="sn-greetsub">오늘의 시세·날씨 같은 소식, 제가 정리해 뒀어요.</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ② 데스크 — 티커 · 시세 · 뉴스 */}
                    <div>
                        <span className="sn-badge"><i />오늘의 브리핑</span>
                        <h2 className="sn-title">{guide.title}</h2>
                        {/* 소개문은 DB introText 그대로. 문구 창작 금지. */}
                        <p className="sn-desc">{guide.desc}</p>

                        {/* 티커 — 날짜 + 절기. 절기가 'ok'가 아니면 조용히 생략한다. */}
                        {summary?.date && (
                            <div className="sn-ticker sn-fade">
                                <span className="sn-tickeritem">📅 <b>{summary.date.label}</b></span>
                                {showSolarTerm && <span className="sn-tickeritem">🌿 <b>{solarTerm?.label}</b></span>}
                            </div>
                        )}

                        {/* 시세 3종 — 실패해도 칸을 비우지 않는다 */}
                        <div className="sn-secthead">
                            <h3 className="sn-secttitle">📈 오늘 시세</h3>
                            {/* ★ETF 폴백이 하나라도 있을 때만 안내한다. 지수가 정상이면 틀린 설명이다. */}
                            {(summary?.markets ?? []).some(m => m.valueKind === 'etf') && (
                                <p className="sn-sectsub">일부는 지수 대신 대표 ETF 가격이에요</p>
                            )}
                        </div>
                        <div className="sn-mkts" aria-live="polite">
                            {markets.length > 0
                                ? markets.map(renderMarket)
                                : MARKET_PLACEHOLDERS.map(renderPlaceholder)}
                            {renderFx()}
                        </div>
                        {summaryFailed && (
                            <p className="sn-newsnote">시세를 불러오지 못했어요. 잠시 후 다시 열어보시면 나옵니다.</p>
                        )}

                        {/* 뉴스 — ★여기까지가 무료다. 본문은 카테고리를 누를 때만 조회한다. */}
                        <div className="sn-secthead">
                            <h3 className="sn-secttitle">📰 오늘 뉴스</h3>
                            <p className="sn-sectsub">분야를 누르면 글로, ▶를 누르면 제가 읽어 드려요</p>
                        </div>
                        <p className="sn-newsnote">
                            이 화면을 보는 것만으로는 <b>포인트가 들지 않아요</b>.
                            {' '}{buildNewsCostNotice(newsCost)}
                        </p>
                        {playError && <p className="sn-playerr">{playError}</p>}

                        {categories.length > 0 ? (
                            <div className="sn-cats sn-fade">
                                {/* ★카드 본체=글로 읽기(유료), ▶=캐시된 음성 듣기(무료).
                                    버튼 안에 버튼을 넣을 수 없어 div 로 감싸고 각각을 button 으로 둔다. */}
                                {categories.map(c => {
                                    const isPlaying = playing === c.key;
                                    const isLoading = playLoading === c.key;
                                    return (
                                        <div key={c.key} className={`sn-cat${isPlaying ? ' is-playing' : ''}`}>
                                            <button type="button" className="sn-catmain" onClick={() => openNews(c.key)}>
                                                <span className="sn-catlabel">{c.label}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="sn-catplay"
                                                onClick={e => (isPlaying ? stopPlay() : playNews(c.key, e.currentTarget))}
                                                disabled={isLoading}
                                                aria-label={`${c.label} ${isPlaying ? '멈추기' : '들려주기'}`}
                                                title={isPlaying ? '멈추기' : '서아가 읽어드려요'}
                                            >
                                                {isLoading ? '…' : isPlaying ? '■' : '▶'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : catsFailed ? (
                            <div className="sn-hint">
                                분야 목록을 잠시 불러오지 못했어요.
                                <button className="sn-cta2" style={{ marginLeft: 10, padding: '7px 14px', fontSize: 12 }}
                                        onClick={() => onFeature('news')}>
                                    오늘 뉴스 열기
                                </button>
                            </div>
                        ) : (
                            <div className="sn-hint">분야를 불러오는 중이에요…</div>
                        )}

                        {needLogin && (
                            <div className="sn-hint" role="status">
                                오늘 뉴스 본문은 로그인 후에 보실 수 있어요.
                            </div>
                        )}

                        {extraFeatures.length > 0 && (
                            <div className="sn-chips">
                                {extraFeatures.map(f => (
                                    <button key={f.key} className="sn-chip" onClick={() => onFeature(f.key)}>
                                        <MpnFeatureIcon kind={f.icon} size={18} color={f.accent} bg={f.bg} />
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="sn-ctas">
                            <button className="sn-cta" onClick={onInvite}>
                                🎁 친구 초대 +1000P
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ★유료 구간 — 사용자가 카테고리를 누른 뒤에만 마운트된다.
                `/api/news/today` 호출과 50P 차감은 **전부 이 보드 안에서** 일어난다. */}
            {openCategory && (
                <TodayNewsBoard initialCategory={openCategory} onClose={() => setOpenCategory(null)} />
            )}
        </div>
    );
};
