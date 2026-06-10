import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

interface QuickMenuResultCardProps {
    title: string;
    result: string;
    personaName: string;
    bgUrl?: string;
    onClose: () => void;
}

const TITLE_META: Record<string, { hanja: string; subtitle: string; icon: string }> = {
    '📅 시운의 흐름': { hanja: '時運流勢', subtitle: '운의 흐름과 때의 기운', icon: '🌊' },
    '💰 성취와 재물': { hanja: '成就財物', subtitle: '성취운 · 재물운 · 사업운', icon: '💎' },
    '❤️ 인연의 결': { hanja: '因緣之結', subtitle: '인연 · 관계 · 연분', icon: '🪢' },
    '🪷 나의 전생': { hanja: '前生宿命', subtitle: '전생 · 인연 · 타고난 업', icon: '🪷' },
    '🌙 꿈해몽': { hanja: '夢中解夢', subtitle: '꿈에 깃든 조짐', icon: '🌙' },
    '🔮 관상학': { hanja: '觀相之鑑', subtitle: '얼굴에 깃든 운', icon: '🔮' },
};

export const QuickMenuResultCard: React.FC<QuickMenuResultCardProps> = ({ title, result, personaName, bgUrl, onClose }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [saving, setSaving] = useState(false);
    const [opened, setOpened] = useState(false); // 봉인 뒷면 → 클릭 시 펼침(플립)
    const hasBg = !!bgUrl;

    const meta = TITLE_META[title] ?? { hanja: '', subtitle: '', icon: '✨' };

    const handleSave = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        try {
            const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `${title}_${new Date().toLocaleDateString('ko-KR').replace(/[\s.]/g, '')}.png`;
            link.href = dataUrl;
            link.click();
        } catch (e) {
            console.error('[QuickMenuResultCard save]', e);
            alert('이미지 저장에 실패했습니다.');
        } finally {
            setSaving(false);
        }
    };

    const withBg = {
        cardBg: 'transparent',
        overlay: 'rgba(252,245,220,0.15)',
        headerTitle: '#2c0f00',
        headerSub: '#6b3a1f',
        divider: '#8b5e3c',
        sectionBg: 'rgba(255,250,235,0.82)',
        sectionBorder: 'rgba(139,94,60,0.8)',
        sectionTitle: '#2c0f00',
        sectionSubtitle: '#4a2010',
        sectionText: '#2c1500',
        adviceAccent: '#8b5e3c',
        signText: '#8b5e3c',
    };

    const noBg = {
        cardBg: 'rgba(18,10,3,0.97)',
        overlay: 'transparent',
        headerTitle: '#fde68a',
        headerSub: '#b89060',
        divider: '#7a5530',
        sectionBg: 'rgba(40,22,8,0.9)',
        sectionBorder: 'rgba(180,120,60,0.85)',
        sectionTitle: '#fde68a',
        sectionSubtitle: '#d4a86a',
        sectionText: '#e8d5b0',
        adviceAccent: '#c8943c',
        signText: '#b89060',
    };

    const c = hasBg ? withBg : noBg;

    // 봉인된 뒷면(표지) — 클릭하면 카드가 뒤집히며 감정 내용(앞면)이 드러난다.
    // 변경(2026-06-10): [이전] 카드 뒷면 전체가 onClick → 어디를 눌러도 플립
    //                  [현재] 상단 헤더 영역(아이콘+제목+한자+'눌러서 펼치기' 버튼)만 클릭 가능
    //                         하단 서명 영역은 e.stopPropagation()으로 플립 차단
    //                         상단 클릭 영역은 minHeight 44px 보장(모바일 접근성)
    const handleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpened(true);
    };
    const sealBack = (
        <div
            style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderRadius: '10px',
                border: '1px solid rgba(139,94,60,0.5)',
                background: 'radial-gradient(circle at 50% 38%, rgba(60,36,14,0.98), rgba(14,8,3,0.99))',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '40px 28px', cursor: 'default',
                fontFamily: '"Nanum Myeongjo", serif',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
        >
            {/* 상단 클릭 가능 영역(헤더): 여기만 누르면 플립이 발생한다. */}
            <div
                role="button"
                tabIndex={0}
                aria-label="감정 결과 펼치기"
                onClick={handleOpen}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(e as any); }}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    width: '100%', minHeight: 44, cursor: 'pointer',
                    padding: '4px 0',
                    borderRadius: 8,
                    transition: 'background 0.2s',
                }}
            >
                <p style={{ fontSize: 12, color: '#b89060', letterSpacing: '0.3em', marginBottom: 18 }}>四柱命理 鑑定書</p>
                <div style={{
                    width: 92, height: 92, borderRadius: '50%',
                    border: '1.5px solid rgba(200,148,60,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 20, boxShadow: 'inset 0 0 24px rgba(200,148,60,0.18)',
                }}>
                    <span style={{ fontSize: 40 }}>{meta.icon}</span>
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fde68a', letterSpacing: '0.12em', marginBottom: 6 }}>
                    {title}
                </h2>
                {meta.hanja && (
                    <p style={{ fontSize: 13, color: '#c8943c', letterSpacing: '0.3em', marginBottom: 18 }}>{meta.hanja}</p>
                )}
                {/* 시각적 힌트(눌러서 펼치기 버튼) — 손가락 이모지로 탭 가능 영역임을 명시 */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 22px', borderRadius: 999,
                    border: '1px solid rgba(200,148,60,0.5)',
                    background: 'rgba(200,148,60,0.08)',
                    color: '#fde68a', fontSize: 13, letterSpacing: '0.06em',
                    minHeight: 44, lineHeight: 1,
                    animation: 'qmSealPulse 2s ease-in-out infinite',
                }}>
                    <span aria-hidden="true">👆</span>
                    <span>탭하여 펼치기</span>
                </div>
            </div>

            {/* 하단 서명 영역 — 클릭해도 플립되지 않도록 버블링 차단 */}
            <p
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 11, color: '#8a6a3c', marginTop: 14, cursor: 'default' }}
            >
                {personaName}이(가) 봉(封)함
            </p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[75] flex items-start justify-center p-3 pt-8 sm:pt-12 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <style>{`
                @keyframes qmSealPulse { 0%,100% { opacity:.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.04); } }
            `}</style>
            <div className="w-full max-w-lg">

              {/* 플립 무대(원근감) */}
              <div style={{ perspective: '1600px' }}>
                <div style={{
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    WebkitTransformStyle: 'preserve-3d',
                    transition: 'transform 0.85s cubic-bezier(0.4,0.15,0.2,1)',
                    transform: opened ? 'rotateY(0deg)' : 'rotateY(180deg)',
                }}>
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
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                    }}
                >
                    {hasBg && (
                        <div style={{
                            position: 'absolute', inset: 0, borderRadius: '10px',
                            background: 'rgba(252,245,220,0.15)',
                            pointerEvents: 'none',
                        }} />
                    )}

                    {/* 헤더 */}
                    <div style={{ position: 'relative', textAlign: 'center', marginBottom: '24px' }}>
                        <p style={{ fontSize: '11px', color: c.headerSub, letterSpacing: '0.25em', marginBottom: '6px', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                            {meta.hanja || '四柱命理 鑑定書'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>{meta.icon}</span>
                            <h2 style={{ fontSize: '24px', fontWeight: '800', color: c.headerTitle, letterSpacing: '0.1em', fontFamily: '"Nanum Myeongjo", serif' }}>
                                {title}
                            </h2>
                        </div>
                        {meta.subtitle && (
                            <p style={{ fontSize: '11px', color: c.sectionSubtitle, marginTop: '4px', letterSpacing: '0.05em' }}>
                                {meta.subtitle}
                            </p>
                        )}
                        <div style={{ width: '56px', height: '1.5px', background: c.divider, margin: '10px auto 0' }} />
                        <p style={{ fontSize: '11px', color: c.headerSub, marginTop: '8px' }}>
                            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>

                    {/* 본문 */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            background: c.sectionBg,
                            border: `1.5px solid ${c.sectionBorder}`,
                            borderLeft: `3px solid ${c.adviceAccent}`,
                            borderRadius: '7px',
                            padding: '18px 20px',
                        }}>
                            <p style={{
                                fontSize: '14px',
                                lineHeight: '2.0',
                                color: c.sectionText,
                                whiteSpace: 'pre-wrap',
                                fontWeight: 400,
                            }}>
                                {result}
                            </p>
                        </div>
                    </div>

                    {/* 서명 */}
                    <div style={{ position: 'relative', textAlign: 'center', marginTop: '20px' }}>
                        <p style={{ fontSize: '13px', color: c.signText, letterSpacing: '0.18em', fontWeight: 700, fontFamily: '"Nanum Myeongjo", serif' }}>
                            {personaName} 識
                        </p>
                    </div>
                </div>
                {/* 봉인 뒷면 (플립 전 표지) */}
                {sealBack}
                </div>{/* /flip card */}
              </div>{/* /perspective */}

                {/* 펼친 후에만 액션 버튼 노출 */}
                <div
                    className="flex gap-3 mt-4 px-1"
                    style={{
                        opacity: opened ? 1 : 0,
                        pointerEvents: opened ? 'auto' : 'none',
                        transition: 'opacity 0.4s ease 0.5s',
                    }}
                >
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
