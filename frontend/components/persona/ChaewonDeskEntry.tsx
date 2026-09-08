import React, { useEffect, useMemo, useState } from 'react';
import type { PersonaEntryGuide } from '../PersonaEntrySheet';

// 윤채원(수석 애널리스트) 전용 진입 화면 — "트레이딩 데스크".
//
// 왜 별도 화면인가(2026-09-07 사장 지시): 윤채원은 주식 전문가인데 페르소나에 들어가면
// 채팅창이 먼저 떠서 **무엇을 볼 수 있는지 안 보였다**. 사장 요청은 "주식 전광판에
// 빨간 화살표가 올라가는 효과".
//
// ★도결·서아·윤채린·이아린에 이은 **다섯 번째** 랜딩. 계약은 똑같다 —
//   onStart()=채팅, onFeature(key)=그 기능, onClose()=닫기, onInvite()=초대.
//   ★★App.tsx 를 건드리면 전 화면 백지 사고가 재발한다(2026-07-29 useCallback TDZ).
//
// ★★표현 규칙(절대 완화 금지 — 투자자문 소지):
//   · "추천/매수"가 아니라 **"관심 종목"**. 점수는 관심 높음/관심/참고로만.
//   · 면책을 화면에 **항상** 노출한다.
//   · 🔴자동매매 봇의 **실계좌** 정보는 표시하지 않는다(서버도 안 내려준다).
//   · 지수에는 '원'을 붙이지 않는다 — `valueKind==='etf'` 일 때만 원 + 대용 ETF 병기.
//     (목표주가·현재주가 같은 **금액**에는 원을 붙인다 — 지수가 아니다.)
//   ★API 요약 원문에 "투자의견 | **매수 (78점)**" 이 들어 있다 — 그 행은 **걸러낸다**.
//
// ★쓰는 API 는 전부 기존 것이다(새로 만들지 않았다):
//   /api/desk/summary(지수·환율, 서아가 쓰던 것) · /api/stock-picks(관심 종목)
//   /api/stock-picks/paper(가상매매) · /api/news/status(무료 뉴스 제목)
// ★이미지 0 · 외부 CDN 0 — 그래프·애니메이션은 전부 인라인 SVG/CSS.

interface Market {
    key?: string; label: string; valueKind?: string | null;
    price: number | null; prevClose?: number | null; changePct: number | null;
    proxy?: { name?: string } | null;
}
interface Pick { market: string; name: string; score: number | null; summary: string }
interface Paper {
    available: boolean; seed?: number; pnl?: number; returnPct?: number | null;
    holdingCount?: number; holdings?: string[]; strategy?: string | null;
}
type Cues = Record<string, { title: string }[]>;

/** 주식과 직결된 것만(사장 확정). 스포츠·날씨까지 넣으면 이 화면의 정체성이 흐려진다. */
const NEWS_TABS = [
    { key: '경제증시', label: '경제·증시' },
    { key: '해외뉴스', label: '해외' },
    { key: 'AI기술',   label: 'AI·기술' },
];

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const fmt = (v: number | null, d = 0) => (v === null ? '—' : v.toLocaleString('ko-KR', { maximumFractionDigits: d }));
/** ★한국 증시 관례 — 상승=빨강, 하락=파랑. */
const cls = (p: number | null) => (p === null || p === 0 ? 'flat' : p > 0 ? 'up' : 'down');
const mark = (p: number | null) => (p === null || p === 0 ? '·' : p > 0 ? '▲' : '▼');
const grade = (s: number | null) => (s === null ? '참고' : s >= 80 ? '관심 높음' : s >= 60 ? '관심' : '참고');

/** ★지수에 '원'을 붙이지 않는다. ETF 로 대체된 칸만 원 + 대용 이름을 병기한다. */
const indexValue = (m: Market) => {
    const v = num(m.price);
    if (m.valueKind === 'etf') {
        return { text: v === null ? '—' : `${fmt(v)}원`, cap: m.proxy?.name ? `대용: ${m.proxy.name}` : '대용 ETF(확인 필요)' };
    }
    return { text: fmt(v, 2), cap: '' };
};

/** summary(마크다운 표)에서 참고 행만 뽑는다.
 *  ★★'투자의견'·'봇 추세' 행은 "매수 (78점)" 같은 권유 표현이라 **제외**한다. */
const DROP = /투자의견|봇 추세|매수|매도|추천/;
const pickRows = (summary: string): [string, string][] => {
    const out: [string, string][] = [];
    (summary || '').split('\n').forEach(line => {
        const m = line.match(/^\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/);
        if (!m) return;
        const k = m[1].trim(), v = m[2].trim();
        if (!k || /^-+$/.test(k) || k === '구분' || DROP.test(k) || DROP.test(v)) return;
        out.push([k, v.replace(/\*\*/g, '')]);
    });
    return out.slice(0, 4);
};

/** 코스피 **일봉 캔들** — 네이버 일봉(시·고·저·종)을 그대로 그린다.
 *
 *  ★★2026-09-08 이전엔 종가·전일종가 두 점 사이를 `Math.sin` 으로 흔든 **가짜 개형**이었다.
 *    사인파는 시장이 아니다 — 애널리스트 화면에 지어낸 그래프를 띄우고 있었던 셈이다.
 *    이제 `/api/desk/candles` 의 실제 OHLC 만 그린다. **데이터가 없으면 아무것도 그리지 않는다**(폴백 금지).
 *
 *  ★가장자리를 비워 둔다(PAD). 0~160 끝까지 그리면 **선 굵기와 꼬리 끝이 viewBox 밖으로
 *    잘린다** — 하필 오른쪽 끝이 "오늘" 이라 제일 중요한 데가 잘려 나갔다(2026-09-07 실측). */
/** ── 차트 좌표계 ──────────────────────────────────────────────
 *  HTS(키움·영웅문) 차트를 기준으로 잡았다(2026-09-08 사장 레퍼런스).
 *  가격축은 **오른쪽**, 날짜축은 **아래**, 거래량은 **아래 별도 패널** — 증권 차트의 관례다.
 *
 *  ★가로는 실제 렌더 폭에 맞춘다. viewBox 비율이 칸 비율과 어긋나면 남는 축으로 맞춰지며
 *    **마지막 봉(=오늘)이 잘린다** — 2026-09-07·09-08 두 번 같은 자리에서 겪었다. */
const VB_W = 300;                    // 전체 폭
const AX_W = 42;                     // 오른쪽 가격축 폭
const L_PAD = 6;                     // 왼쪽 여백
const TOP = 14;                      // 위 여백 — 최고 표식이 들어갈 자리
const PRICE_H = 132;                 // 가격(캔들) 패널 높이
const GAP = 26;                      // 패널 사이 — 날짜축 + 거래량 제목이 각자 줄을 갖는다
const VOL_H = 34;                    // 거래량 패널 높이
const VB_H = TOP + PRICE_H + GAP + VOL_H + 4;
/** ★마지막 봉이 가격축·현재가 라벨에 닿지 않도록 오른쪽을 비운다.
 *  09-07·09-08 에 이어 미리보기에서도 마지막 봉이 라벨에 가렸다 — 같은 자리에서 세 번째다. */
const R_GAP = 10;
/** 캔들이 그려지는 가로 구간(가격축과 오른쪽 숨통을 뺀 부분). */
const PLOT_W = VB_W - AX_W - L_PAD - R_GAP;
/** 옛 이름 — 여백 규칙이 살아 있는지 보는 회귀 테스트가 참조한다. */
const PAD = 6;

export interface CandleBar {
    x: number;                       // 몸통 중심 x
    w: number;                       // 몸통 너비
    bodyY: number; bodyH: number;    // 몸통(시가~종가)
    highY: number; lowY: number;     // 꼬리(고가~저가)
    up: boolean;                     // 양봉(종가>=시가) — 한국 관례상 빨강
    date: string;
    close: number;
    volY: number; volH: number;      // 거래량 막대(아래 패널)
}

export interface OHLC { date: string; open: number; high: number; low: number; close: number; volume?: number; }

export interface ChartTick { y: number; label: string; }

export interface ChartModel {
    bars: CandleBar[];
    /** 오른쪽 가격 눈금(위→아래) */
    ticks: ChartTick[];
    /** 하단 날짜 라벨 — 다 넣으면 겹치므로 solid 하게 3개만 고른다 */
    dateLabels: { x: number; label: string }[];
    /** 5일 이동평균선 path(봉이 5개 미만이면 빈 문자열) */
    ma5: string;
    /** 최고·최저 표식 */
    peak: { x: number; y: number; label: string } | null;
    trough: { x: number; y: number; label: string } | null;
    /** 마지막 종가 — 오른쪽에 강조 라벨로 띄운다 */
    last: { y: number; label: string; up: boolean } | null;
}

/** 최고·최저 라벨의 가로 위치를 패널 안으로 물린다(라벨 폭 약 56 의 절반 + 여유). */
export const clampX = (x: number) => Math.max(L_PAD + 30, Math.min(x, VB_W - AX_W - 32));

/** 지수는 소수 둘째 자리까지. ★'원'을 붙이지 않는다. */
const tickLabel = (v: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 'YYYY-MM-DD' → 'MM/DD' (HTS 관례) */
const shortDate = (d: string) => (d.length >= 10 ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : d);

/**
 * 캔들 배치를 계산한다.
 * ★스케일은 **고가·저가 전 범위**로 잡는다. 종가만으로 잡으면 꼬리가 칸 밖으로 삐져나간다.
 * ★위아래로 5% 씩 숨통을 준다 — 최고·최저 봉이 패널 모서리에 딱 붙으면 잘린 것처럼 보인다.
 * ★몸통 높이는 최소 1 을 준다 — 시가==종가(도지)면 높이 0 이라 아예 안 보인다.
 */
export const buildCandles = (rows: OHLC[]): CandleBar[] => buildChart(rows).bars;

export const buildChart = (rows: OHLC[]): ChartModel => {
    const empty: ChartModel = { bars: [], ticks: [], dateLabels: [], ma5: '', peak: null, trough: null, last: null };
    const ok = rows.filter(r => [r.open, r.high, r.low, r.close].every(n => typeof n === 'number' && isFinite(n) && n > 0));
    if (ok.length === 0) return empty;

    const rawLo = Math.min(...ok.map(r => r.low));
    const rawHi = Math.max(...ok.map(r => r.high));
    const pad = (rawHi - rawLo) * 0.05 || Math.max(rawHi * 0.002, 0.5);
    const lo = rawLo - pad, hi = rawHi + pad;
    const span = (hi - lo) || 1;                       // 전 구간 보합이어도 0 으로 나누지 않는다
    const y = (v: number) => TOP + (1 - (v - lo) / span) * PRICE_H;

    const slot = PLOT_W / ok.length;
    // ★몸통 굵기. slot 의 절반 정도라야 캔들 사이 간격이 살아난다(렌더 실측).
    const w = Math.max(2.5, Math.min(11, slot * 0.55));

    // 거래량 — 최대치를 패널 높이에 맞춘다. 값이 없으면 막대는 높이 0 이 된다.
    const volMax = Math.max(...ok.map(r => r.volume || 0), 1);
    const volTop = TOP + PRICE_H + GAP;

    const bars: CandleBar[] = ok.map((r, i) => {
        const yo = y(r.open), yc = y(r.close);
        const vh = ((r.volume || 0) / volMax) * VOL_H;
        return {
            x: L_PAD + slot * (i + 0.5),
            w,
            bodyY: Math.min(yo, yc),
            bodyH: Math.max(1, Math.abs(yc - yo)),
            highY: y(r.high),
            lowY: y(r.low),
            up: r.close >= r.open,
            date: r.date,
            close: r.close,
            volY: volTop + (VOL_H - vh),
            volH: vh,
        };
    });

    // 가격 눈금 5줄(위→아래). 실제 값을 찍어야 '차트'로 읽힌다.
    const ticks: ChartTick[] = [0, 1, 2, 3, 4].map(i => {
        const v = hi - (span / 4) * i;
        return { y: TOP + (PRICE_H / 4) * i, label: tickLabel(v) };
    });

    // 날짜는 처음·가운데·끝 3개만 — 10개를 다 쓰면 좁은 폭에서 겹쳐 뭉갠다.
    const idxs = ok.length <= 3 ? ok.map((_, i) => i) : [0, Math.floor((ok.length - 1) / 2), ok.length - 1];
    const dateLabels = [...new Set(idxs)].map(i => ({ x: bars[i].x, label: shortDate(ok[i].date) }));

    // 5일 이동평균 — HTS 의 그 선이다. 봉이 5개 미만이면 그리지 않는다.
    let ma5 = '';
    if (ok.length >= 5) {
        const pts: string[] = [];
        for (let i = 4; i < ok.length; i++) {
            const avg = ok.slice(i - 4, i + 1).reduce((s, r) => s + r.close, 0) / 5;
            pts.push(`${pts.length ? 'L' : 'M'}${bars[i].x.toFixed(1)} ${y(avg).toFixed(1)}`);
        }
        ma5 = pts.join(' ');
    }

    const hiIdx = ok.reduce((b, r, i) => (r.high > ok[b].high ? i : b), 0);
    const loIdx = ok.reduce((b, r, i) => (r.low < ok[b].low ? i : b), 0);
    const lastRow = ok[ok.length - 1];

    return {
        bars, ticks, dateLabels, ma5,
        peak:   { x: bars[hiIdx].x, y: y(ok[hiIdx].high), label: tickLabel(ok[hiIdx].high) },
        trough: { x: bars[loIdx].x, y: y(ok[loIdx].low),  label: tickLabel(ok[loIdx].low) },
        last:   { y: y(lastRow.close), label: tickLabel(lastRow.close), up: lastRow.close >= lastRow.open },
    };
};

const CSS = `
.cd-root{position:fixed;inset:0;z-index:85;overflow-y:auto;overflow-x:hidden;
  background:#16202e;color:#eef2f8;
  font-family:'Pretendard',system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.cd-wrap{max-width:520px;margin:0 auto;min-height:100%;
  background:linear-gradient(180deg,#16202e,#1b2738);padding-bottom:28px}
.cd-mono{font-variant-numeric:tabular-nums;font-family:'SFMono-Regular',Menlo,Consolas,monospace}
.cd-up{color:#ff6b74}.cd-down{color:#6aa9ff}.cd-flat{color:#9fb0c6}

.cd-hd{display:flex;align-items:center;gap:10px;padding:16px 18px 12px}
.cd-logo{width:34px;height:34px;border-radius:9px;background:#2b3d54;
  display:flex;align-items:center;justify-content:center;font-size:16px}
.cd-t{font-size:15px;font-weight:800;letter-spacing:-.01em}
.cd-r{font-size:10.5px;font-weight:600;color:#9fb0c6;margin-left:5px}
.cd-s{font-size:11px;color:#9fb0c6}
.cd-x{margin-left:auto;width:32px;height:32px;border-radius:50%;cursor:pointer;
  border:1px solid #33475f;background:transparent;color:#9fb0c6;font-size:14px}

.cd-board{margin:0 14px;border:1px solid #33475f;border-radius:14px;overflow:hidden;
  background:linear-gradient(180deg,#1d2a3b,#182433)}
.cd-bin{display:grid;grid-template-columns:1fr 1fr}
@media (max-width:359px){.cd-bin{grid-template-columns:1fr}}
.cd-bl{padding:12px 12px 10px;border-right:1px solid #33475f}
@media (max-width:359px){.cd-bl{border-right:0;border-bottom:1px solid #33475f}}
.cd-br{padding:12px 10px 8px;position:relative;min-height:132px}
.cd-row{display:flex;align-items:baseline;gap:6px;padding:5px 0}
.cd-row+.cd-row{border-top:1px dashed #2c3f57}
.cd-rn{font-size:11px;color:#9fb0c6;min-width:44px}
.cd-rv{font-size:17px;font-weight:800;letter-spacing:-.02em}
.cd-rv.cd-up{text-shadow:0 0 14px rgba(255,107,116,.45)}
.cd-rc{font-size:11px;font-weight:700;margin-left:auto}
.cd-cap{font-size:9.5px;color:#9fb0c6;margin-top:1px}
.cd-gt{font-size:10px;color:#9fb0c6;letter-spacing:.08em;margin-bottom:4px}
.cd-gw{position:absolute;inset:26px 8px 8px}
.cd-gw svg{width:100%;height:100%}
.cd-gerr{display:flex;align-items:center;justify-content:center;height:96px;
  font-size:11px;color:#9fb0c6;text-align:center}

/* 일봉 차트 — 전광판 아래 전체 폭. HTS 차트를 기준으로 잡았다. */
.cd-chart{border-top:1px solid #33475f;padding:10px 10px 8px;background:#18232f}
.cd-ch{display:flex;align-items:baseline;gap:7px;margin:0 4px 6px}
.cd-cht{font-size:12px;font-weight:800;letter-spacing:-.01em}
.cd-chs{font-size:10px;color:#9fb0c6}
.cd-chl{margin-left:auto;font-size:9.5px;color:#9fb0c6;display:flex;align-items:center;gap:4px}
.cd-ma5{width:11px;height:2px;background:#f0b23c;border-radius:1px;display:inline-block}
.cd-svg{width:100%;height:auto;display:block}
.cd-axt{fill:#8fa2ba;font-size:7px;font-family:'SFMono-Regular',Menlo,Consolas,monospace}
.cd-now{fill:#fff;font-size:7px;font-weight:700;font-family:'SFMono-Regular',Menlo,Consolas,monospace}
.cd-pk{font-size:6.6px;font-weight:700;font-family:'SFMono-Regular',Menlo,Consolas,monospace}
.cd-pkup{fill:#ff8a91}.cd-pkdn{fill:#8ec0ff}
.cd-note{font-size:10px;color:#9fb0c6;line-height:1.5;margin-top:2px}
/* 캔들 하나가 '띡' 하고 찍히는 순간 — 짧게 튀어나온다. transform-box 가 없으면
   SVG 안에서 transform-origin 이 뷰박스 원점 기준이라 엉뚱한 데서 커진다. */
.cd-cd{transform-box:fill-box;transform-origin:center}
@media (prefers-reduced-motion:no-preference){
  .cd-cd{animation:cd-pop .26s ease-out backwards}
  .cd-tape-in{animation:cd-slide 22s linear infinite}
  .cd-live i{animation:cd-blink 1.6s ease-in-out infinite}
}
@keyframes cd-pop{from{opacity:0;transform:scaleY(.35)}to{opacity:1;transform:scaleY(1)}}
/* 캔들이 다 찍힌 뒤 이평선·현재가가 얹힌다 — 순서가 있어야 '그려지는' 느낌이 산다. */
@media (prefers-reduced-motion:no-preference){
  .cd-ma{animation:cd-draw 1s ease-out forwards;stroke-dasharray:300;stroke-dashoffset:300}
  .cd-nowg,.cd-pk{animation:cd-fadein .5s ease-out .35s backwards}
}
@keyframes cd-draw{to{stroke-dashoffset:0}}
@keyframes cd-fadein{from{opacity:0}to{opacity:1}}
@keyframes cd-slide{to{transform:translateX(-50%)}}
@keyframes cd-blink{0%,100%{opacity:1}50%{opacity:.25}}

.cd-tape{margin:10px 14px 0;border:1px solid #33475f;border-radius:10px;
  background:#1a2634;overflow:hidden;padding:7px 0}
.cd-tape-in{display:flex;gap:26px;width:max-content;padding-left:14px}
.cd-ti{font-size:11px;white-space:nowrap}
.cd-stamp{padding:8px 18px 0;font-size:10.5px;color:#9fb0c6}

.cd-sec{padding:22px 18px 0}
.cd-sh{display:flex;align-items:baseline;gap:8px;margin-bottom:10px}
.cd-st{font-size:15px;font-weight:800}
.cd-sm{font-size:10px;letter-spacing:.12em;color:#e2c79f;margin-left:auto}
.cd-live{display:inline-flex;align-items:center;gap:5px;font-size:10px;color:#ff6b74;font-weight:700}
.cd-live i{width:6px;height:6px;border-radius:50%;background:#ff6b74}
.cd-tabs{display:flex;gap:6px;margin-bottom:10px}
.cd-tab{font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:999px;cursor:pointer;
  border:1px solid #33475f;background:transparent;color:#9fb0c6;font-family:inherit}
.cd-tab.on{background:#eef2f8;color:#16202e;border-color:#eef2f8}
.cd-nw{display:flex;gap:10px;padding:11px 0;border-top:1px solid #33475f}
.cd-nw:first-of-type{border-top:0}
.cd-nn{flex:0 0 20px;font-size:12px;font-weight:800;color:#e2c79f}
.cd-nt{font-size:13px;line-height:1.5}

.cd-pp{border:1px solid #33475f;border-radius:12px;background:#223043;padding:14px}
.cd-ptop{display:flex;align-items:flex-end;gap:10px}
.cd-pl{font-size:11px;color:#9fb0c6}
.cd-pv{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.cd-pr{font-size:12px;font-weight:700;margin-left:auto;text-align:right}
.cd-psub{margin-top:9px;padding-top:9px;border-top:1px solid #33475f;
  font-size:11.5px;color:#9fb0c6;line-height:1.6}
.cd-psub b{color:#eef2f8}
.cd-pnote{margin-top:7px;font-size:10.5px;color:#9fb0c6}

.cd-menu{padding:16px 14px 0;display:flex;flex-direction:column;gap:8px}
.cd-mi{display:flex;align-items:center;gap:11px;width:100%;text-align:left;cursor:pointer;
  padding:13px 14px;border-radius:12px;border:1px solid #33475f;background:#223043;
  color:inherit;font:inherit;transition:border-color .15s ease,transform .12s ease}
.cd-mi:hover{border-color:#4a6a8c;transform:translateY(-1px)}
.cd-mi:active{transform:scale(.99)}
.cd-mic{flex:0 0 34px;height:34px;border-radius:9px;background:#2b3d54;
  display:flex;align-items:center;justify-content:center;font-size:15px}
.cd-mt{font-size:14px;font-weight:700}
.cd-md{font-size:11.5px;color:#9fb0c6;margin-top:2px}
.cd-mg{margin-left:auto;color:#9fb0c6;font-size:13px}

.cd-pk{border:1px solid #33475f;border-radius:12px;background:#223043;padding:13px 14px;margin-top:9px}
.cd-ph{display:flex;align-items:center;gap:8px}
.cd-pm{font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:#2b3d54;color:#9fb0c6}
.cd-pn{font-size:15px;font-weight:800}
.cd-pb{margin-left:auto;text-align:right}
.cd-pg{font-size:9.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:#1f4a3c;color:#4fd1a5}
.cd-ps{font-size:12px;font-weight:800;margin-top:3px}
.cd-tb{width:100%;border-collapse:collapse;margin-top:10px;font-size:11.5px}
.cd-tb th,.cd-tb td{border:1px solid #33475f;padding:6px 8px;text-align:left;vertical-align:top}
.cd-tb th{background:#26364a;color:#9fb0c6;font-weight:700;width:76px}

.cd-dis{margin:20px 14px 0;padding:12px 14px;border-radius:12px;background:#1a2634;border:1px solid #33475f}
.cd-dt{font-size:10px;letter-spacing:.1em;color:#e2c79f;font-weight:800;margin-bottom:5px}
.cd-db{font-size:11.5px;line-height:1.6;color:#9fb0c6}
.cd-db b{color:#eef2f8}
.cd-cta{margin:16px 14px 0;padding:15px;border-radius:12px;border:0;cursor:pointer;width:calc(100% - 28px);
  font:inherit;font-size:14.5px;font-weight:700;color:#16202e;
  background:linear-gradient(135deg,#e2c79f,#c9a678)}
.cd-err{margin:10px 14px 0;font-size:11px;color:#9fb0c6}
`;

interface Props {
    guide: PersonaEntryGuide;
    onClose: () => void;
    onStart: (featureKey?: string) => void;
    onFeature: (featureKey: string) => void;
    onInvite: () => void;
}

export const ChaewonDeskEntry: React.FC<Props> = ({ guide, onClose, onStart, onFeature, onInvite }) => {
    const [markets, setMarkets] = useState<Market[] | null>(null);
    const [fx, setFx] = useState<any>(null);
    const [dateLabel, setDateLabel] = useState('');
    const [picks, setPicks] = useState<Pick[] | null>(null);
    const [paper, setPaper] = useState<Paper | null>(null);
    const [cues, setCues] = useState<Cues | null>(null);
    const [tab, setTab] = useState(NEWS_TABS[0].key);
    const [failed, setFailed] = useState<string[]>([]);
    const [candles, setCandles] = useState<OHLC[] | null>(null);
    /** 지금까지 찍힌 캔들 수. 1초에 두 개(500ms 간격)씩 늘어나다 전부 찍히면 멈춘다. */
    const [shown, setShown] = useState(0);

    const fail = (what: string) => setFailed(f => (f.includes(what) ? f : [...f, what]));

    // ★네 API 모두 기존 것이다(무료·읽기 전용). 하나가 실패해도 나머지는 그린다.
    useEffect(() => {
        let alive = true;
        const get = (u: string) => fetch(u).then(r => r.json());
        get('/api/desk/summary').then(d => {
            if (!alive) return;
            setMarkets(d.markets || []); setFx(d.fx || null);
            setDateLabel(d.date?.label || '');
        }).catch(() => alive && fail('시세'));
        get('/api/stock-picks').then(d => alive && setPicks(d.picks || [])).catch(() => alive && fail('관심 종목'));
        get('/api/stock-picks/paper').then(d => alive && setPaper(d)).catch(() => alive && fail('가상매매'));
        get('/api/news/status').then(d => alive && setCues(d.headline_cues || {})).catch(() => alive && fail('뉴스'));
        // 일봉 — 실패해도 그래프 칸만 비운다(지어낸 값으로 채우지 않는다).
        get('/api/desk/candles').then(d => alive && setCandles(d.candles || []))
            .catch(() => { if (alive) { setCandles([]); fail('일봉'); } });
        return () => { alive = false; };
    }, []);

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // 그래프 — 일봉 캔들. 왼쪽(과거)부터 1초에 두 개씩 '띡띡띡' 찍히고, 다 찍히면 멈춘다.
    const kospi = markets?.find(m => m.key === 'kospi' || m.label === '코스피');
    const chart = useMemo(() => buildChart(candles || []), [candles]);
    const bars = chart.bars;

    useEffect(() => {
        if (bars.length === 0) return;
        // 모션을 줄이도록 설정한 사용자에겐 애니메이션 없이 즉시 전부 보여 준다.
        const reduce = typeof window !== 'undefined' && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { setShown(bars.length); return; }

        setShown(0);
        // 500ms 간격 = 1초에 두 개. 다 찍히면 인터벌을 걷어낸다(반복하지 않는다).
        const id = setInterval(() => {
            setShown(n => {
                if (n >= bars.length) { clearInterval(id); return n; }
                return n + 1;
            });
        }, 500);
        return () => clearInterval(id);
    }, [bars]);

    // 색은 '오늘 등락'이 아니라 **마지막 봉 자체**를 따른다(캔들마다 개별 색이 있으므로
    // 여기서는 면·끝점 강조용으로만 쓴다).
    const gUp = (num(kospi?.changePct ?? null) ?? 0) >= 0;
    const gColor = gUp ? '#ff6b74' : '#6aa9ff';
    const UP = '#ff6b74', DOWN = '#6aa9ff';

    const rows: { name: string; text: string; pct: number | null; cap: string }[] = [];
    (markets || []).forEach(m => {
        const v = indexValue(m);
        rows.push({ name: m.label, text: v.text, pct: num(m.changePct), cap: v.cap });
    });
    if (fx?.hasRate) rows.push({ name: '원/달러', text: fmt(num(fx.rate), 1), pct: num(fx.changePct), cap: '' });
    else if (fx) rows.push({ name: '원/달러', text: '—', pct: null, cap: '환율 미제공' });

    const tapeItems = rows.map(r => `${r.name} ${mark(r.pct)} ${r.text}${r.pct === null ? '' : ` ${r.pct > 0 ? '+' : ''}${r.pct.toFixed(2)}%`}`);
    const news = (cues?.[tab] || []).slice(0, 3);

    return (
        // 배경 클릭 = 닫기. 시트가 폭을 채우므로 넓은 화면의 양옆이 배경이 된다.
        <div className="cd-root" onClick={onClose}>
            <style>{CSS}</style>
            <div className="cd-wrap" onClick={e => e.stopPropagation()}
                 role="dialog" aria-modal="true" aria-label={`${guide.title} 트레이딩 데스크`}>

                <div className="cd-hd">
                    <div className="cd-logo">📊</div>
                    <div>
                        <div className="cd-t">윤채원<span className="cd-r">수석 애널리스트</span></div>
                        <div className="cd-s">데이터로 읽는 시장 · 자신보다 데이터를 믿어라</div>
                    </div>
                    <button className="cd-x" onClick={onClose} aria-label="닫기">✕</button>
                </div>

                {/* 전광판 — 좌: 지수·환율 / 우: 코스피 추세 그래프 */}
                <div className="cd-board">
                    <div className="cd-bin">
                        <div className="cd-bl">
                            {rows.length === 0
                                ? <div className="cd-cap">{failed.includes('시세') ? '시세를 불러오지 못했습니다' : '불러오는 중…'}</div>
                                : rows.map(r => (
                                    <React.Fragment key={r.name}>
                                        <div className="cd-row">
                                            <span className="cd-rn">{r.name}</span>
                                            <span className={`cd-rv cd-mono cd-${cls(r.pct)}`}>{r.text}</span>
                                            <span className={`cd-rc cd-mono cd-${cls(r.pct)}`}>
                                                {mark(r.pct)}{r.pct === null ? '' : ` ${Math.abs(r.pct).toFixed(2)}%`}
                                            </span>
                                        </div>
                                        {r.cap && <div className="cd-cap">{r.cap}</div>}
                                    </React.Fragment>
                                ))}
                        </div>
                    </div>

                    {/* 코스피 일봉 차트 — 전체 폭. 반쪽 칸(150px)에는 가격축·날짜축·거래량이 들어가지 않는다. */}
                    <div className="cd-chart">
                        <div className="cd-ch">
                            <span className="cd-cht">코스피 일봉</span>
                            <span className="cd-chs">최근 {bars.length || 10}거래일 · 종가 기준</span>
                            <span className="cd-chl"><i className="cd-ma5" />5일선</span>
                        </div>
                        {candles && bars.length === 0 ? (
                            <div className="cd-gerr">일봉을 불러오지 못했습니다</div>
                        ) : (
                            <svg className="cd-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet"
                                 role="img" aria-label={bars.length
                                     ? `코스피 최근 ${bars.length}거래일 일봉 차트. 마지막 종가 ${chart.last?.label}`
                                     : '코스피 일봉 차트'}>
                                {/* 가로 격자 + 오른쪽 가격 눈금 — 값이 있어야 '차트'로 읽힌다. */}
                                {chart.ticks.map((t, i) => (
                                    <g key={i}>
                                        <line x1={L_PAD} y1={t.y} x2={VB_W - AX_W} y2={t.y}
                                              stroke="#2c3f57" strokeWidth=".5" strokeDasharray={i === 0 || i === 4 ? '' : '2 2'} />
                                        <text x={VB_W - AX_W + 4} y={t.y + 2.6} className="cd-axt">{t.label}</text>
                                    </g>
                                ))}
                                {/* 가격축 경계선 */}
                                <line x1={VB_W - AX_W} y1={TOP} x2={VB_W - AX_W} y2={TOP + PRICE_H}
                                      stroke="#33475f" strokeWidth=".6" />

                                {/* 날짜축 — 가격 패널 바로 아래 한 줄. */}
                                {chart.dateLabels.map((d, i) => (
                                    <text key={i} x={d.x} y={TOP + PRICE_H + 10} className="cd-axt" textAnchor="middle">{d.label}</text>
                                ))}

                                {/* 거래량 패널 — ★제목은 날짜축과 다른 줄에 둔다(미리보기에서 08/26 과 겹쳐 뭉갰다). */}
                                <text x={L_PAD} y={TOP + PRICE_H + GAP - 4} className="cd-axt">거래량</text>
                                <line x1={L_PAD} y1={TOP + PRICE_H + GAP + VOL_H} x2={VB_W - AX_W}
                                      y2={TOP + PRICE_H + GAP + VOL_H} stroke="#2c3f57" strokeWidth=".5" />

                                {/* 캔들 + 거래량 — 왼쪽(과거)부터 순차로 찍힌다. */}
                                {chart.bars.slice(0, shown).map(b => {
                                    const c = b.up ? UP : DOWN;
                                    return (
                                        <g key={b.date} className="cd-cd">
                                            {/* 꼬리 먼저 — 몸통이 위에 덮여야 깔끔하다. */}
                                            <line x1={b.x} y1={b.highY} x2={b.x} y2={b.lowY} stroke={c} strokeWidth="1" />
                                            <rect x={b.x - b.w / 2} y={b.bodyY} width={b.w} height={b.bodyH} fill={c} rx=".5" />
                                            {b.volH > 0 && (
                                                <rect x={b.x - b.w / 2} y={b.volY} width={b.w} height={b.volH}
                                                      fill={c} opacity=".8" rx=".4" />
                                            )}
                                        </g>
                                    );
                                })}

                                {/* 5일 이동평균선 — 캔들이 다 찍힌 뒤에 얹는다(HTS 의 그 선). */}
                                {chart.ma5 && shown >= bars.length && (
                                    <path className="cd-ma" d={chart.ma5} fill="none" stroke="#f0b23c" strokeWidth="1.1"
                                          strokeLinecap="round" strokeLinejoin="round" />
                                )}

                                {/* 최고·최저 — HTS 처럼 값을 적어 준다.
                                    ★라벨이 패널 밖이나 가격축으로 넘어가지 않게 양끝을 물린다. */}
                                {shown >= bars.length && chart.peak && (
                                    // ★위로 올릴 자리가 없으면 봉 아래로 내린다 — 위쪽 눈금을 가리면 축을 못 읽는다.
                                    <text x={clampX(chart.peak.x)}
                                          y={chart.peak.y - 5 < TOP + 2 ? chart.peak.y + 9 : chart.peak.y - 5}
                                          className="cd-pk cd-pkup" textAnchor="middle">최고 {chart.peak.label}</text>
                                )}
                                {shown >= bars.length && chart.trough && (
                                    <text x={clampX(chart.trough.x)} y={Math.min(chart.trough.y + 9, TOP + PRICE_H - 2)}
                                          className="cd-pk cd-pkdn" textAnchor="middle">최저 {chart.trough.label}</text>
                                )}

                                {/* 현재가 — 오른쪽 축에 붙는 강조 라벨(HTS 의 파란/빨간 말풍선). */}
                                {shown >= bars.length && chart.last && (
                                    <g className="cd-nowg">
                                        <line x1={L_PAD} y1={chart.last.y} x2={VB_W - AX_W} y2={chart.last.y}
                                              stroke={chart.last.up ? UP : DOWN} strokeWidth=".6" strokeDasharray="3 2" opacity=".75" />
                                        <rect x={VB_W - AX_W + 1} y={chart.last.y - 5.5} width={AX_W - 2} height={11}
                                              fill={chart.last.up ? UP : DOWN} rx="1.5" />
                                        <text x={VB_W - AX_W / 2} y={chart.last.y + 2.8} className="cd-now" textAnchor="middle">
                                            {chart.last.label}
                                        </text>
                                    </g>
                                )}
                            </svg>
                        )}
                    </div>
                </div>

                {/* 티커 — ★두 벌을 이어 붙여야 흐를 때 왼쪽이 잘리지 않는다. */}
                {tapeItems.length > 0 && (
                    <div className="cd-tape"><div className="cd-tape-in">
                        {[...tapeItems, ...tapeItems].map((t, i) => (
                            <span key={i} className={`cd-ti cd-mono cd-${cls(rows[i % rows.length].pct)}`}>{t}</span>
                        ))}
                    </div></div>
                )}
                <div className="cd-stamp">{dateLabel ? `실시간 시세 · ${dateLabel} 기준` : '시장 데이터를 불러오는 중입니다'}</div>

                {/* 증권 탑뉴스 — 무료 제목만(본문은 유료 50P). 탭 전환에 추가 호출이 없다. */}
                <div className="cd-sec">
                    <div className="cd-sh">
                        <div className="cd-st">증권 탑뉴스</div>
                        <span className="cd-live"><i />LIVE</span>
                        <div className="cd-sm">MARKET NEWS</div>
                    </div>
                    <div className="cd-tabs" role="tablist">
                        {NEWS_TABS.map(t => (
                            <button key={t.key} role="tab" aria-selected={tab === t.key}
                                    className={`cd-tab${tab === t.key ? ' on' : ''}`}
                                    onClick={() => setTab(t.key)}>{t.label}</button>
                        ))}
                    </div>
                    {news.length > 0
                        ? news.map((c, i) => (
                            <div className="cd-nw" key={i}>
                                <div className="cd-nn cd-mono">{i + 1}</div>
                                <div className="cd-nt">{c.title}</div>
                            </div>))
                        : <div className="cd-db">{cues ? '이 분야는 오늘 준비된 소식이 없습니다.' : '불러오는 중…'}</div>}
                </div>

                {/* 가상매매 — ★페이퍼(가상) 계좌다. 손실이어도 그대로 낸다(숨기면 더 위험).
                  *
                  * ★자리(2026-09-07 사장 지시 "위치도 중요한 거 같은데"): 이 화면은
                  *   회원의 질문에 **순서대로** 답한다 —
                  *     ①여기 살아있나(전광판·뉴스) → ②믿을 만한가(**가상매매**)
                  *     → ③뭘 보고 있나(관심 종목) → ④내 것도 봐주나(메뉴).
                  *   ★한 번 관심 종목 **뒤**로 보냈다가 되돌렸다. "예측 다음에 결과"라는
                  *     서사는 그럴듯했지만, 관심 종목 카드가 표까지 달려 길어서 그 아래는
                  *     스크롤 끝이었다 — **안 보이는 자리에 둔 신뢰의 근거는 없는 것과 같다.**
                  *
                  * 🔴★★**보유 종목명은 내지 않는다**(사장 지시). 수익률·손익은 지나간
                  *   성과지만 보유 종목은 **지금의 포지션**이라, 페이퍼 계좌라도 회원에겐
                  *   매수 신호로 읽힌다 — 실계좌를 가리는 이유와 똑같다. 개수까지만 낸다. */}
                <div className="cd-sec">
                    <div className="cd-sh">
                        <div className="cd-st">가상매매 성적</div>
                        <div className="cd-sm">PAPER TRADING</div>
                    </div>
                    {!paper ? <div className="cd-db">불러오는 중…</div>
                        : !paper.available ? <div className="cd-db">가상매매 기록이 아직 없습니다.</div>
                        : (() => {
                            const pct = num(paper.returnPct ?? null), pnl = num(paper.pnl ?? null);
                            return (
                                <div className="cd-pp">
                                    <div className="cd-ptop">
                                        <div>
                                            <div className="cd-pl">누적 수익률</div>
                                            <div className={`cd-pv cd-mono cd-${cls(pct)}`}>
                                                {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`}
                                            </div>
                                        </div>
                                        <div className={`cd-pr cd-mono cd-${cls(pct)}`}>
                                            {mark(pct)} {pnl === null ? '—' : `${fmt(pnl)}원`}
                                        </div>
                                    </div>
                                    <div className="cd-psub">
                                        가상 자본 <b>{fmt(num(paper.seed ?? null))}원</b>
                                        {paper.strategy && <> · 전략 <b>{paper.strategy}</b></>}
                                        {!!paper.holdingCount && <> · 보유 <b>{paper.holdingCount}종목</b></>}
                                    </div>
                                    <div className="cd-pnote">실제 주문이 아닌 <b>모의 거래</b> 기록입니다. 과거 성과가 미래를 보장하지 않습니다.</div>
                                </div>
                            );
                        })()}
                </div>

                {/* 관심 종목 */}
                <div className="cd-sec">
                    <div className="cd-sh">
                        <div className="cd-st">오늘의 AI 관심 종목</div>
                        <div className="cd-sm">WATCHLIST</div>
                    </div>
                    {!picks ? <div className="cd-db">불러오는 중…</div>
                        : picks.length === 0 ? <div className="cd-db">오늘의 기록이 아직 없습니다.</div>
                        : picks.map(p => {
                            const rs = pickRows(p.summary), s = num(p.score);
                            return (
                                <div className="cd-pk" key={p.market + p.name}>
                                    <div className="cd-ph">
                                        <span className="cd-pm">{p.market}</span>
                                        <span className="cd-pn">{p.name}</span>
                                        <span className="cd-pb">
                                            <span className="cd-pg">{grade(s)}</span>
                                            <div className="cd-ps cd-mono">{s === null ? '—' : `${s}점`}</div>
                                        </span>
                                    </div>
                                    {rs.length > 0
                                        ? <table className="cd-tb"><tbody>
                                            {rs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}
                                          </tbody></table>
                                        : <div className="cd-db" style={{ marginTop: 8 }}>요약이 아직 준비되지 않았습니다.</div>}
                                </div>
                            );
                        })}
                </div>

                {/* 메뉴 — ★featureKey 는 App.tsx FEATURE_ACTIONS 와 같아야 한다.
                  *   ★자리: **설득 다음**이다. 위쪽(뉴스 바로 뒤)에 뒀더니 회원이 스크롤을
                  *   시작하자마자 300pt 결제를 만났다 — 윤채원이 뭘 하는 사람인지 보기도
                  *   전에 권하는 순서였다. */}
                <div className="cd-menu">
                    <button className="cd-mi" onClick={() => onFeature('stock')}>
                        <div className="cd-mic">🔬</div>
                        <div>
                            <div className="cd-mt">내 종목 분석</div>
                            <div className="cd-md">종목을 직접 넣어 3중 AI 정밀분석 · 내 보고서 보관함</div>
                        </div>
                        <span className="cd-mg">→</span>
                    </button>
                    <button className="cd-mi" onClick={() => onStart()}>
                        <div className="cd-mic">💬</div>
                        <div>
                            <div className="cd-mt">윤채원과 대화하기</div>
                            <div className="cd-md">보고서를 놓고 궁금한 점을 물어보세요</div>
                        </div>
                        <span className="cd-mg">→</span>
                    </button>
                </div>

                <button className="cd-cta" onClick={onInvite}>🎁 친구 초대하고 1,000P 받기</button>

                {/* ★★면책 — 이 화면의 법적 경계다. 문구를 약하게 바꾸지 말 것. */}
                <div className="cd-dis">
                    <div className="cd-dt">PLEASE READ · 투자 유의사항</div>
                    <div className="cd-db">
                        본 화면은 <b>투자 권유가 아닙니다.</b> 관심 종목은 AI가 공개 지표로 산출한 참고 정보이며,
                        최종 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
                    </div>
                </div>
                {failed.length > 0 && (
                    <div className="cd-err">일부 데이터를 불러오지 못했습니다: {failed.join(', ')}</div>
                )}
            </div>
        </div>
    );
};
