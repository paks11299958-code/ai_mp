import React, { useState } from 'react';

// 📜 타로 리딩 보고서 (감정서 스타일 — 명조+퍼플+골드, 2026-07-06)
// 용도 2가지: ①리딩 직후/보고서함(로그인, 공유·인쇄 버튼) ②공개 공유 링크(?tr=, 비로그인 CTA)
// 인쇄: @media print로 보고서 영역만 출력. 공유: 옵트인(버튼 시 shareId 발급 → 링크 복사).

export interface TarotReportCard { position: string; kr: string; en: string; no: string; sym: string; reversed: boolean }
export interface TarotReportData {
    question?: string | null;
    cards: TarotReportCard[];
    interpretations: { position: string; text: string }[];
    createdAt: string;
}

interface Props {
    data: TarotReportData;
    mode: 'owner' | 'public';
    onShare?: () => Promise<string>;   // owner: shareId 발급 → 공유 URL 반환
    onClose?: () => void;
    onCta?: () => void;                // public: "나도 타로 보러 가기"
}

const SERIF = "'Nanum Myeongjo', 'Noto Serif KR', serif";
const GOLD = '#B8934A';
const PURPLE = '#6E4A9E';

export const TarotReportView: React.FC<Props> = ({ data, mode, onShare, onClose, onCta }) => {
    const [shareMsg, setShareMsg] = useState('');
    const dateStr = new Date(data.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

    const doShare = async () => {
        if (!onShare) return;
        try {
            const url = await onShare();
            try {
                if (navigator.share) { await navigator.share({ title: '🔮 나의 타로 리딩 — 유나', url }); return; }
            } catch { return; }
            await navigator.clipboard.writeText(url);
            setShareMsg('공유 링크가 복사되었습니다 ✨');
            setTimeout(() => setShareMsg(''), 2500);
        } catch {
            setShareMsg('공유 링크 발급에 실패했어요');
            setTimeout(() => setShareMsg(''), 2500);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto tarot-report-overlay" style={{ background: 'rgba(20,12,40,.88)' }}>
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .tarot-report-sheet, .tarot-report-sheet * { visibility: visible !important; }
                    .tarot-report-sheet { position: absolute !important; left: 0; top: 0; width: 100%; box-shadow: none !important; margin: 0 !important; }
                    .tarot-report-actions { display: none !important; }
                }
            `}</style>
            <div className="min-h-full flex flex-col items-center py-6 px-3">
                {/* 액션 바 */}
                <div className="tarot-report-actions w-full max-w-lg flex items-center justify-between mb-3">
                    <div className="flex gap-2">
                        {mode === 'owner' && (
                            <>
                                <button onClick={() => window.print()}
                                    className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 text-white border border-white/25 hover:bg-white/20">🖨 인쇄</button>
                                <button onClick={doShare}
                                    className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:opacity-90">🔗 링크 공유</button>
                            </>
                        )}
                        {mode === 'public' && (
                            <button onClick={onCta}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90">✨ 나도 타로 보러 가기</button>
                        )}
                    </div>
                    {onClose && <button onClick={onClose} className="px-3 py-2 text-white/80 hover:text-white text-lg leading-none">✕</button>}
                </div>
                {shareMsg && <div className="tarot-report-actions mb-3 text-xs text-amber-200">{shareMsg}</div>}

                {/* 보고서 본문 (감정서) */}
                <div className="tarot-report-sheet w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
                     style={{ background: 'linear-gradient(175deg, #FBF7EF 0%, #F6EFE2 100%)', border: `1px solid ${GOLD}55` }}>
                    {/* 헤더 */}
                    <div className="text-center pt-8 pb-5 px-6" style={{ borderBottom: `2px solid ${GOLD}66` }}>
                        <div className="text-[11px] tracking-[0.35em] mb-2" style={{ color: GOLD, fontFamily: SERIF }}>✦ YUNA TAROT READING ✦</div>
                        <h1 className="text-2xl font-bold" style={{ color: '#2D2438', fontFamily: SERIF }}>타로 리딩 보고서</h1>
                        <div className="text-[11px] mt-2" style={{ color: '#8A7F96' }}>{dateStr} · 타로술사 유나</div>
                        {data.question && (
                            <div className="mt-3 text-sm italic" style={{ color: PURPLE, fontFamily: SERIF }}>“{data.question}”</div>
                        )}
                    </div>

                    {/* 카드 3장 */}
                    <div className="flex justify-center gap-4 py-6 px-4" style={{ background: 'radial-gradient(80% 100% at 50% 0%, #F1E7F8 0%, transparent 70%)' }}>
                        {data.cards.map((c, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5">
                                <div className="w-20 h-32 rounded-lg border-2 flex flex-col items-center justify-between py-2"
                                     style={{ borderColor: GOLD, background: 'linear-gradient(160deg,#FFFDF7,#F3EAD6)', boxShadow: '0 4px 14px rgba(110,74,158,.18)' }}>
                                    <span className="text-[9px] font-bold" style={{ color: PURPLE, fontFamily: SERIF }}>{c.no}</span>
                                    <span className="text-3xl" style={{ transform: c.reversed ? 'rotate(180deg)' : 'none' }}>{c.sym}</span>
                                    <div className="text-center leading-tight">
                                        <div className="text-[10px] font-bold" style={{ color: '#2D2438' }}>{c.kr}</div>
                                        <div className="text-[8px]" style={{ color: '#8A7F96', fontFamily: SERIF }}>{c.en}</div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                      style={{ background: c.reversed ? '#FBE6EA' : '#E8F3EA', color: c.reversed ? '#B84D66' : '#3E7A4C' }}>
                                    {c.position} · {c.reversed ? '역방향' : '정방향'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* 해석 */}
                    <div className="px-7 pb-4 space-y-5">
                        {data.interpretations.map((it, i) => {
                            const isSummary = it.position.includes('종합');
                            return (
                                <section key={i} className={isSummary ? 'rounded-xl p-4' : ''}
                                         style={isSummary ? { background: '#F1E9F8', border: `1px solid ${PURPLE}33` } : {}}>
                                    <h2 className="text-sm font-bold mb-1.5 flex items-center gap-1.5"
                                        style={{ color: PURPLE, fontFamily: SERIF }}>
                                        {isSummary ? '🌟 종합 리딩' : `${['Ⅰ','Ⅱ','Ⅲ'][i] ?? '✦'}. ${it.position}의 카드`}
                                    </h2>
                                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: '#3A3244' }}>{it.text}</p>
                                </section>
                            );
                        })}
                    </div>

                    {/* 푸터 */}
                    <div className="text-center py-5 px-6" style={{ borderTop: `2px solid ${GOLD}66` }}>
                        <div className="text-[11px]" style={{ color: '#8A7F96', fontFamily: SERIF }}>
                            카드는 방향을 비출 뿐, 선택은 언제나 당신의 몫이에요 🌙
                        </div>
                        <div className="text-[10px] mt-1.5 tracking-widest" style={{ color: GOLD, fontFamily: SERIF }}>
                            aichat.dbzone.kr · AI PERSONAS
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
