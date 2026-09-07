import React, { useEffect, useRef, useState } from 'react';
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

/** 코스피 추세 스케치 — 종가·전일종가로 만든 **개형**이다(분봉이 아니다).
 *
 *  ★가장자리를 비워 둔다(PAD). 선을 0~160 끝까지 그리면 **선 굵기(2.2)와 끝점
 *    동그라미(r 최대 5)의 바깥쪽 절반이 viewBox 밖으로 잘린다** — 하필 오른쪽 끝이
 *    "오늘 오른 지점"이라 제일 중요한 데가 잘려 나갔다(2026-09-07 실측). */
const PAD = 6;
const buildPath = (close: number, prev: number | null, pct: number | null) => {
    const start = prev ?? close / (1 + (pct ?? 0) / 100);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 22; i++) {
        const t = i / 22;
        const base = start + (close - start) * (t * t * (3 - 2 * t));
        const wave = Math.sin(t * 7.5) * ((Math.abs(close - start) || close * 0.004) * 0.22);
        pts.push([PAD + t * (160 - PAD * 2), base + wave]);
    }
    const ys = pts.map(p => p[1]);
    const lo = Math.min(...ys), span = (Math.max(...ys) - lo) || 1;
    const xy = pts.map(([x, y]) => [x, 90 - PAD - ((y - lo) / span) * (90 - PAD * 2)] as [number, number]);
    return { d: xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' '), last: xy[xy.length - 1] };
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
.cd-line{fill:none;stroke-width:2.2;stroke-linecap:round}
.cd-dot{opacity:0}
@media (prefers-reduced-motion:no-preference){
  .cd-line{animation:cd-draw 2.6s ease-out forwards}
  .cd-area{animation:cd-fade .8s ease-out 1.6s forwards}
  .cd-dot{animation:cd-fade .5s ease-out 2.3s forwards,cd-pulse 1.8s ease-in-out 2.8s infinite}
  .cd-tape-in{animation:cd-slide 22s linear infinite}
  .cd-live i{animation:cd-blink 1.6s ease-in-out infinite}
}
@media (prefers-reduced-motion:reduce){
  .cd-line{stroke-dashoffset:0!important}.cd-area{opacity:.5}.cd-dot{opacity:1}
}
@keyframes cd-draw{to{stroke-dashoffset:0}}
@keyframes cd-fade{to{opacity:1}}
@keyframes cd-pulse{0%,100%{r:3.4}50%{r:5}}
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
    const lineRef = useRef<SVGPathElement>(null);

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
        return () => { alive = false; };
    }, []);

    // Esc로 닫기 — 전체를 덮는 화면이라 출구가 하나뿐이면 갇힌 느낌이 든다.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // 그래프 — 길이를 재서 dash 로 '그려지게' 한다(경로가 정해진 뒤에만 가능).
    const kospi = markets?.find(m => m.key === 'kospi' || m.label === '코스피');
    const graph = kospi && num(kospi.price) !== null
        ? buildPath(num(kospi.price)!, num(kospi.prevClose ?? null), num(kospi.changePct)) : null;
    useEffect(() => {
        const el = lineRef.current;
        if (!el || !graph) return;
        const len = Math.ceil(el.getTotalLength());
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
    }, [graph?.d]);

    const gUp = (num(kospi?.changePct ?? null) ?? 0) >= 0;
    const gColor = gUp ? '#ff6b74' : '#6aa9ff';

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
                        <div className="cd-br">
                            <div className="cd-gt">KOSPI TREND</div>
                            <div className="cd-gw">
                                <svg viewBox="0 0 160 96" preserveAspectRatio="none" role="img" aria-label="코스피 추세">
                                    <defs>
                                        <linearGradient id="cdFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={gColor} stopOpacity=".38" />
                                            <stop offset="100%" stopColor={gColor} stopOpacity="0" />
                                        </linearGradient>
                                    </defs>
                                    <g stroke="#2c3f57" strokeWidth=".6">
                                        <line x1="0" y1="24" x2="160" y2="24" /><line x1="0" y1="48" x2="160" y2="48" />
                                        <line x1="0" y1="72" x2="160" y2="72" />
                                    </g>
                                    {graph && <>
                                        {/* 면은 선 끝에서 바닥으로 내려 닫는다 — PAD 만큼 안쪽이라 선과 어긋나지 않는다. */}
                                        <path className="cd-area" d={`${graph.d} L${160 - PAD} 96 L${PAD} 96 Z`}
                                              fill="url(#cdFill)" opacity={0} />
                                        <path ref={lineRef} className="cd-line" d={graph.d} stroke={gColor} />
                                        <circle className="cd-dot" cx={graph.last[0]} cy={graph.last[1]} r={3.4} fill={gColor} />
                                    </>}
                                </svg>
                            </div>
                        </div>
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
