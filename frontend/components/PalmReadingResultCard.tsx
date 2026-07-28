import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { PalmReadingResult } from '../services/apiService';

interface PalmReadingResultCardProps {
    result: PalmReadingResult;
    imageUrl: string | null;     // 사용자가 올린 손금 사진(dataURL, 메모리만 — 닫으면 사라짐)
    hand: 'left' | 'right';
    personaName: string;
    onClose: () => void;
}

// 번호 매겨 설명(맨 위 사진 + 번호 범례와 연결)
const SECTIONS = [
    { key: 'lifeLine'      as const, no: 1, title: '생명선',   subtitle: '건강 · 생명력 · 체력' },
    { key: 'headLine'      as const, no: 2, title: '두뇌선',   subtitle: '지능 · 사고 · 재능' },
    { key: 'heartLine'     as const, no: 3, title: '감정선',   subtitle: '애정 · 대인관계 · 감수성' },
    { key: 'fateLine'      as const, no: 4, title: '운명선',   subtitle: '직업운 · 인생 방향' },
    { key: 'moneyMarriage' as const, no: 5, title: '재물 · 인연', subtitle: '재물운 · 결혼 · 인연' },
    { key: 'overall'       as const, no: 6, title: '전체 총평', subtitle: '기운 · 전반적 운기' },
];

export const PalmReadingResultCard: React.FC<PalmReadingResultCardProps> = ({ result, imageUrl, hand, personaName, onClose }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [opened, setOpened] = useState(false); // 봉인 뒷면 → 클릭 시 플립

    const handSel = hand === 'left' ? '왼손' : '오른손';

    const handleSave = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        try {
            const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `손금분석_${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }).replace(/[\s.]/g, '')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('[PalmReadingResultCard save]', e);
            alert('이미지 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    // 다크 톤(관상 카드와 동일 팔레트)
    const c = {
        cardBg: 'rgba(18,10,3,0.97)', headerTitle: '#fde68a', headerSub: '#b89060', divider: '#7a5530',
        sectionBg: 'rgba(40,22,8,0.9)', sectionBorder: 'rgba(139,94,60,0.4)', sectionTitle: '#fde68a',
        sectionSubtitle: '#d4a86a', sectionText: '#e8d5b0', adviceBg: 'rgba(139,94,60,0.15)',
        adviceBorder: 'rgba(180,120,60,0.85)', adviceAccent: '#c8943c', adviceTitle: '#fbbf24',
        adviceText: '#e8d5b0', signText: '#b89060',
    };

    // 봉인 뒷면 — 클릭하면 뒤집히며 결과 공개(전생 패턴)
    const sealBack = (
        <div
            onClick={() => setOpened(true)}
            style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)', borderRadius: '10px',
                border: '1px solid rgba(139,94,60,0.5)',
                background: 'radial-gradient(circle at 50% 38%, rgba(60,36,14,0.98), rgba(14,8,3,0.99))',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 28px', cursor: 'pointer',
                fontFamily: '"Nanum Myeongjo", serif', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
        >
            <p style={{ fontSize: 12, color: '#b89060', letterSpacing: '0.3em', marginBottom: 18 }}>手相學 鑑定書</p>
            <div style={{
                width: 92, height: 92, borderRadius: '50%', border: '1.5px solid rgba(200,148,60,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
                boxShadow: 'inset 0 0 24px rgba(200,148,60,0.18)',
            }}>
                <span style={{ fontSize: 40 }}>🖐</span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fde68a', letterSpacing: '0.12em', marginBottom: 6 }}>
                손금 분석
            </h2>
            <p style={{ fontSize: 13, color: '#c8943c', letterSpacing: '0.3em', marginBottom: 26 }}>{handSel}</p>
            <div style={{
                padding: '9px 22px', borderRadius: 999, border: '1px solid rgba(200,148,60,0.5)',
                background: 'rgba(200,148,60,0.08)', color: '#fde68a', fontSize: 13, letterSpacing: '0.06em',
                animation: 'palmSealPulse 2s ease-in-out infinite',
            }}>
                ✦ 눌러서 펼치기 ✦
            </div>
            <p style={{ fontSize: 11, color: '#8a6a3c', marginTop: 14 }}>{personaName}이(가) 봉(封)함</p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[75] flex items-start justify-center p-3 pt-8 sm:pt-12 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <style>{`
                @keyframes palmSealPulse { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.04); } }
            `}</style>
            <div className="w-full max-w-lg">
              <div style={{ perspective: '1600px' }}>
                <div style={{
                    position: 'relative', transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d',
                    transition: 'transform 0.85s cubic-bezier(0.4,0.15,0.2,1)',
                    transform: opened ? 'rotateY(0deg)' : 'rotateY(180deg)',
                }}>
                    {/* 앞면(결과) */}
                    <div
                        ref={cardRef}
                        style={{
                            background: c.cardBg, borderRadius: '10px', border: '1px solid rgba(139,94,60,0.4)',
                            position: 'relative', padding: '32px 28px 28px',
                            fontFamily: '"Noto Serif KR", Georgia, serif', boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                        }}
                    >
                        {/* 헤더 */}
                        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                            <p style={{ fontSize: '11px', color: c.headerSub, letterSpacing: '0.25em', marginBottom: '6px', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                                手相學 鑑定書
                            </p>
                            <h2 style={{ fontSize: '23px', fontWeight: '800', color: c.headerTitle, letterSpacing: '0.1em', fontFamily: '"Nanum Myeongjo", serif' }}>
                                손금 분석 결과
                            </h2>
                            <p style={{ fontSize: '12px', color: c.adviceAccent, marginTop: '4px', letterSpacing: '0.08em' }}>{handSel}</p>
                            <div style={{ width: '56px', height: '1.5px', background: c.divider, margin: '10px auto 0' }} />
                            <p style={{ fontSize: '11px', color: c.headerSub, marginTop: '8px' }}>
                                {new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',  year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>

                        {/* 맨 위 — 올린 손금 사진 + 번호 범례 */}
                        {imageUrl && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(139,94,60,0.5)' }}>
                                    <img src={imageUrl} alt="내 손금" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', background: '#000', display: 'block' }} />
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', justifyContent: 'center' }}>
                                    {SECTIONS.filter(s => s.key !== 'overall').map(s => (
                                        <span key={s.key} style={{ fontSize: '10.5px', color: c.sectionSubtitle, background: 'rgba(139,94,60,0.18)', borderRadius: '999px', padding: '2px 8px' }}>
                                            <b style={{ color: c.adviceTitle }}>{s.no}</b> {s.title}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 섹션들 — 번호 매김 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {SECTIONS.map(sec => (
                                <div key={sec.key} style={{ background: c.sectionBg, border: `1px solid ${c.sectionBorder}`, borderRadius: '7px', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
                                        <span style={{
                                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                            background: 'rgba(200,148,60,0.18)', border: '1px solid rgba(200,148,60,0.5)',
                                            color: c.adviceTitle, fontSize: '11px', fontWeight: 800,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>{sec.no}</span>
                                        <span style={{ fontSize: '15px', fontWeight: '700', color: c.sectionTitle, fontFamily: '"Nanum Myeongjo", serif' }}>{sec.title}</span>
                                        <span style={{ fontSize: '10px', color: c.sectionSubtitle, letterSpacing: '0.03em' }}>{sec.subtitle}</span>
                                    </div>
                                    <p style={{ fontSize: '13px', lineHeight: '1.9', color: c.sectionText, whiteSpace: 'pre-wrap', fontWeight: 400 }}>
                                        {result[sec.key]}
                                    </p>
                                </div>
                            ))}

                            {result.advice && (
                                <div style={{ background: c.adviceBg, border: `1.5px solid ${c.adviceBorder}`, borderLeft: `3px solid ${c.adviceAccent}`, borderRadius: '7px', padding: '14px 15px', marginTop: '2px' }}>
                                    <p style={{ fontSize: '15px', color: c.adviceTitle, fontWeight: '700', marginBottom: '7px', letterSpacing: '0.06em', fontFamily: '"Nanum Myeongjo", serif' }}>
                                        📜 선생의 말씀
                                    </p>
                                    <p style={{ fontSize: '13px', lineHeight: '1.9', color: c.adviceText, fontStyle: 'italic' }}>
                                        {result.advice}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <p style={{ fontSize: '13px', color: c.signText, letterSpacing: '0.18em', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                                {personaName} 識
                            </p>
                        </div>
                    </div>

                    {/* 봉인 뒷면 */}
                    {sealBack}
                </div>
              </div>

                {/* 펼친 후에만 액션 버튼 */}
                {opened && (
                    <div className="flex gap-3 mt-4 px-1">
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, rgba(139,94,60,0.9), rgba(101,67,33,0.9))', color: '#fde8c0', border: '1px solid rgba(139,94,60,0.5)' }}>
                            {saving ? '저장 중...' : '🖼️ 이미지로 저장'}
                        </button>
                        <button onClick={onClose}
                            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.12)' }}>
                            닫기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
