import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { boardFetch } from '../lib/boardFetch';

// 🔎 AI 관심 종목 — 윤채원이 매일 아침 뽑는 발굴을 회원에게 보여준다 (2026-09-07 사장 지시)
//
// ★새로 계산하지 않는다. 크론(chaewon_stock_cron)이 이미 만든 StockDiscovery 를 읽기만 한다.
//   그래서 **무료·즉시**다(AI 호출 없음, 포인트 차감 없음).
//
// ★★표현 수위(사장 확정): "추천 종목"이 아니라 **"AI 관심 종목"**이다.
//   회원에게 종목을 보여주는 것은 투자자문 소지가 있어 **권유 표현을 쓰지 않고**
//   면책을 화면에 항상 띄운다. 문구를 바꿀 때 이 경계를 넘지 말 것.
//   ★서버도 같은 경계를 지킨다(routes/aimp/stock-picks.ts) — 보유 종목·종목코드는 안 내려온다.

interface Pick {
    market: string;
    name: string;
    score: number | null;
    summary: string;
}
interface Data {
    tradeDate: string | null;
    picks: Pick[];
    comment: string;
}

const T = {
    bg: '#FBF8F3', surface: '#FFFFFF', line: 'rgba(60,40,55,.10)',
    ink: '#2A2028', sub: '#6B5F68', mute: '#9A8D96',
    up: '#D6413B', accent: '#2E7D5B', accentSoft: '#E4F4EC',
};

/** 점수대별 표시 — ★"매수/추천"이 아니라 **관심도**로만 말한다. */
const tone = (score: number | null) => {
    if (score == null) return { label: '관찰', bg: '#EEE', fg: T.sub };
    if (score >= 80) return { label: '관심 높음', bg: T.accentSoft, fg: T.accent };
    if (score >= 60) return { label: '관심', bg: '#FFF4E0', fg: '#8B6020' };
    return { label: '참고', bg: '#F0F0F0', fg: T.sub };
};

export const StockPicksBoard: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [data, setData] = useState<Data | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [open, setOpen] = useState<string | null>(null);   // 펼친 종목명

    useEffect(() => {
        let alive = true;
        boardFetch<Data>('/api/stock-picks')
            .then(d => { if (alive) setData(d); })
            .catch(() => { if (alive) setErr('지금은 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); });
        return () => { alive = false; };
    }, []);

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center"
             style={{ background: 'rgba(20,12,30,.5)', backdropFilter: 'blur(4px)' }}
             onClick={onClose}>
            <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="AI 관심 종목"
                 className="relative w-full sm:max-w-[460px] sm:rounded-2xl rounded-t-2xl overflow-hidden flex flex-col"
                 style={{ background: T.bg, maxHeight: '92dvh' }}>

                <header className="flex items-center gap-2 px-5 py-4 shrink-0"
                        style={{ borderBottom: `1px solid ${T.line}`, background: T.surface }}>
                    <span className="text-lg">🔎</span>
                    <div className="min-w-0">
                        <div className="text-[15px] font-extrabold" style={{ color: T.ink }}>AI 관심 종목</div>
                        <div className="text-[11px]" style={{ color: T.mute }}>
                            {data?.tradeDate ? `${data.tradeDate} 기준 · 윤채원` : '윤채원이 매일 아침 살펴봐요'}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="닫기"
                            className="ml-auto w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                            style={{ border: `1px solid ${T.line}`, color: T.sub }}>✕</button>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                    {err && <p className="text-sm" style={{ color: T.sub }}>{err}</p>}

                    {!err && !data && (
                        <p className="text-sm" style={{ color: T.mute }}>불러오는 중이에요…</p>
                    )}

                    {data && data.picks.length === 0 && (
                        <p className="text-sm leading-relaxed" style={{ color: T.sub }}>
                            아직 오늘의 기록이 없어요.<br />
                            윤채원이 매일 아침 시장을 살펴본 뒤 여기에 남깁니다.
                        </p>
                    )}

                    {data?.picks.map(p => {
                        const t = tone(p.score);
                        const isOpen = open === p.name;
                        return (
                            <div key={p.market + p.name} className="rounded-xl overflow-hidden"
                                 style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                                <button className="w-full text-left px-4 py-3 flex items-center gap-2"
                                        onClick={() => setOpen(isOpen ? null : p.name)}>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                          style={{ background: '#F0EAF5', color: '#6B4FA0' }}>{p.market}</span>
                                    <span className="text-[15px] font-bold truncate" style={{ color: T.ink }}>{p.name}</span>
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                                          style={{ background: t.bg, color: t.fg }}>{t.label}</span>
                                    <span className="text-[11px] shrink-0" style={{ color: T.mute }}>{isOpen ? '▲' : '▼'}</span>
                                </button>
                                {isOpen && (
                                    <div className="px-4 pb-4 text-[13px] leading-relaxed"
                                         style={{ color: T.sub, borderTop: `1px solid ${T.line}` }}>
                                        {p.summary
                                            ? <div className="pt-3 sp-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{p.summary}</ReactMarkdown></div>
                                            : <p className="pt-3">이 종목의 상세 요약은 아직 준비 중이에요.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {data?.comment && (
                        <div className="rounded-xl px-4 py-3 text-[13px] leading-relaxed"
                             style={{ background: '#F4F0F7', color: T.sub }}>
                            <div className="text-[11px] font-bold mb-1.5" style={{ color: '#6B4FA0' }}>📋 오늘의 시황</div>
                            {data.comment.split('\n').filter(l => l.trim()).map((l, i) => <div key={i}>{l}</div>)}
                        </div>
                    )}
                </div>

                {/* ★★면책 — 항상 보인다(스크롤 밖). 이 화면의 법적 경계다. */}
                <footer className="shrink-0 px-5 py-3 text-[11px] leading-relaxed"
                        style={{ borderTop: `1px solid ${T.line}`, background: T.surface, color: T.mute }}>
                    AI가 공개된 지표를 바탕으로 골라본 <b style={{ color: T.sub }}>관심 종목</b>이에요.
                    <b style={{ color: T.sub }}> 투자 권유가 아니며</b>, 투자 판단과 그 결과에 대한 책임은 본인에게 있습니다.
                </footer>

                <style>{`
                .sp-md table{width:100%;border-collapse:collapse;font-size:12px;margin:6px 0}
                .sp-md th,.sp-md td{border:1px solid ${T.line};padding:5px 7px;text-align:left;vertical-align:top}
                .sp-md th{background:#F5F0E8;font-weight:700}
                .sp-md p{margin:4px 0}
                .sp-md strong{color:${T.ink}}
                `}</style>
            </div>
        </div>
    );
};
