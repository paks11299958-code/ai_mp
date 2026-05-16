import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { FaceReadingResult } from '../services/apiService';

interface FaceReadingResultCardProps {
    result: FaceReadingResult;
    personaName: string;
    bgUrl?: string;
    onClose: () => void;
}

const SECTIONS = [
    { key: 'forehead'  as const, title: '이마',    subtitle: '초년운 · 지혜 · 리더십', icon: '☀️' },
    { key: 'eyes'      as const, title: '눈',      subtitle: '내면 · 감수성 · 정신력',  icon: '👁️' },
    { key: 'nose'      as const, title: '코',      subtitle: '중년운 · 재물운 · 의지',  icon: '🌿' },
    { key: 'mouthChin' as const, title: '입 · 턱', subtitle: '말복 · 가족운 · 말년운', icon: '🌙' },
    { key: 'overall'   as const, title: '전체 인상', subtitle: '기운 · 대인관계 · 운기', icon: '✨' },
];

export const FaceReadingResultCard: React.FC<FaceReadingResultCardProps> = ({ result, personaName, bgUrl, onClose }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);

    const hasBg = !!bgUrl;

    const handleSave = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        try {
            const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `관상분석_${new Date().toLocaleDateString('ko-KR').replace(/[\s.]/g, '')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('[FaceReadingResultCard save]', e);
            alert('이미지 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    /* ── 배경 있을 때: 한지 느낌 (어두운 텍스트) ── */
    const withBg = {
        cardBg: 'transparent',
        overlay: 'rgba(252,245,220,0.15)',
        headerTitle: '#2c0f00',
        headerSub: '#6b3a1f',
        divider: '#8b5e3c',
        sectionBg: 'rgba(255,250,235,0.82)',
        sectionBorder: 'rgba(139,94,60,0.35)',
        sectionTitle: '#2c0f00',
        sectionSubtitle: '#4a2010',
        sectionText: '#2c1500',
        adviceBg: 'rgba(139,94,60,0.12)',
        adviceBorder: 'rgba(139,94,60,0.8)',
        adviceAccent: '#8b5e3c',
        adviceTitle: '#6b3a1f',
        adviceText: '#2c1500',
        signText: '#8b5e3c',
    };

    /* ── 배경 없을 때: 다크 모드 (밝은 텍스트) ── */
    const noBg = {
        cardBg: 'rgba(18,10,3,0.97)',
        overlay: 'transparent',
        headerTitle: '#fde68a',
        headerSub: '#b89060',
        divider: '#7a5530',
        sectionBg: 'rgba(40,22,8,0.9)',
        sectionBorder: 'rgba(139,94,60,0.4)',
        sectionTitle: '#fde68a',
        sectionSubtitle: '#d4a86a',
        sectionText: '#e8d5b0',
        adviceBg: 'rgba(139,94,60,0.15)',
        adviceBorder: 'rgba(180,120,60,0.85)',
        adviceAccent: '#c8943c',
        adviceTitle: '#fbbf24',
        adviceText: '#e8d5b0',
        signText: '#b89060',
    };

    const c = hasBg ? withBg : noBg;

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-lg my-auto">

                {/* ── 저장 대상 카드 ── */}
                <div
                    ref={cardRef}
                    style={{
                        ...(hasBg ? {
                            backgroundImage: `url(${bgUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                        } : {
                            background: c.cardBg,
                        }),
                        borderRadius: '10px',
                        border: hasBg ? 'none' : '1px solid rgba(139,94,60,0.4)',
                        position: 'relative',
                        padding: '36px 32px 32px',
                        fontFamily: '"Noto Serif KR", Georgia, serif',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                    }}
                >
                    {/* 반투명 오버레이 — 배경 있을 때만 */}
                    {hasBg && (
                        <div style={{
                            position: 'absolute', inset: 0, borderRadius: '10px',
                            background: c.overlay,
                            pointerEvents: 'none',
                        }} />
                    )}

                    {/* 헤더 */}
                    <div style={{ position: 'relative', textAlign: 'center', marginBottom: '24px' }}>
                        <p style={{ fontSize: '11px', color: c.headerSub, letterSpacing: '0.25em', marginBottom: '6px', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                            觀相學 鑑定書
                        </p>
                        <h2 style={{ fontSize: '24px', fontWeight: '800', color: c.headerTitle, letterSpacing: '0.1em', fontFamily: '"Nanum Myeongjo", serif' }}>
                            관상 분석 결과
                        </h2>
                        <div style={{ width: '56px', height: '1.5px', background: c.divider, margin: '10px auto 0' }} />
                        <p style={{ fontSize: '11px', color: c.headerSub, marginTop: '8px' }}>
                            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* 섹션들 */}
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {SECTIONS.map(sec => (
                            <div key={sec.key} style={{
                                background: c.sectionBg,
                                border: `1px solid ${c.sectionBorder}`,
                                borderRadius: '7px',
                                padding: '13px 15px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                                    <span style={{ fontSize: '14px' }}>{sec.icon}</span>
                                    <span style={{ fontSize: '15px', fontWeight: '700', color: c.sectionTitle, fontFamily: '"Nanum Myeongjo", serif' }}>{sec.title}</span>
                                    <span style={{ fontSize: '10px', color: c.sectionSubtitle, letterSpacing: '0.03em' }}>{sec.subtitle}</span>
                                </div>
                                <p style={{
                                    fontSize: '13px',
                                    lineHeight: '1.9',
                                    color: c.sectionText,
                                    whiteSpace: 'pre-wrap',
                                    fontWeight: 400,
                                }}>
                                    {result[sec.key]}
                                </p>
                            </div>
                        ))}

                        {/* 조언 */}
                        {result.advice && (
                            <div style={{
                                background: c.adviceBg,
                                border: `1.5px solid ${c.adviceBorder}`,
                                borderLeft: `3px solid ${c.adviceAccent}`,
                                borderRadius: '7px',
                                padding: '14px 15px',
                                marginTop: '2px',
                            }}>
                                <p style={{ fontSize: '15px', color: c.adviceTitle, fontWeight: '700', marginBottom: '7px', letterSpacing: '0.06em', fontFamily: '"Nanum Myeongjo", serif' }}>
                                    📜 선생의 말씀
                                </p>
                                <p style={{ fontSize: '13px', lineHeight: '1.9', color: c.adviceText, fontStyle: 'italic' }}>
                                    {result.advice}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 서명 */}
                    <div style={{ position: 'relative', textAlign: 'center', marginTop: '20px' }}>
                        <p style={{ fontSize: '13px', color: c.signText, letterSpacing: '0.18em', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                            {personaName} 識
                        </p>
                    </div>
                </div>

                {/* ── 버튼 (카드 밖 — 저장 이미지에 포함 안 됨) ── */}
                <div className="flex gap-3 mt-4 px-1">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                        style={{
                            background: 'linear-gradient(135deg, rgba(139,94,60,0.9), rgba(101,67,33,0.9))',
                            color: '#fde8c0',
                            border: '1px solid rgba(139,94,60,0.5)',
                        }}
                    >
                        {saving ? '저장 중...' : '🖼️ 이미지로 저장'}
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                        style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: '#d1d5db',
                            border: '1px solid rgba(255,255,255,0.12)',
                        }}
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};
