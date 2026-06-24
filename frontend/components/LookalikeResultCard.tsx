import React, { useState } from 'react';
import { LookalikeResult } from '../services/apiService';
import { buildFeatureShareLink } from '../services/referral';

interface LookalikeResultCardProps {
    result: LookalikeResult;
    personaName: string;
    onClose: () => void;
}

// 닮은 연예인 결과 카드(윤채린 톤). 텍스트 분석 + 자랑하기 공유.
export const LookalikeResultCard: React.FC<LookalikeResultCardProps> = ({ result, personaName, onClose }) => {
    const [toast, setToast] = useState<string | null>(null);
    const top = result.matches?.[0];

    const handleShare = async () => {
        const names = (result.matches ?? []).slice(0, 2).map(m => `${m.name}(${m.percent}%)`).join(', ');
        const caption = top
            ? `내 닮은꼴은 ${names}! ✨ AI가 분석해줬어요. 당신은 누구 닮았을까요?`
            : 'AI가 닮은 연예인을 찾아줘요! ✨';
        const link = buildFeatureShareLink('lookalike');
        try {
            if (navigator.share) { await navigator.share({ title: 'AI 닮은꼴 찾기', text: caption, url: link }); return; }
            await navigator.clipboard.writeText(`${caption}\n${link}`);
            setToast('공유 링크가 복사되었어요!');
            setTimeout(() => setToast(null), 2000);
        } catch { /* 사용자가 시트 닫음 */ }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-sm rounded-2xl overflow-hidden my-auto" style={{
                background: 'linear-gradient(160deg, #FBF8F3 0%, #F3E9F4 100%)',
                border: '1px solid rgba(196,169,224,0.4)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                fontFamily: "'Nanum Myeongjo', 'Noto Serif KR', serif",
            }}>
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(196,169,224,0.25)' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">✨</span>
                        <h2 className="font-bold text-base" style={{ color: '#7A5FA0' }}>닮은 연예인 분석</h2>
                    </div>
                    <button onClick={onClose} className="text-lg leading-none" style={{ color: '#B09BC8' }}>×</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 첫인상 */}
                    {result.impression && (
                        <p className="text-sm leading-relaxed text-center" style={{ color: '#6B5580' }}>{result.impression}</p>
                    )}

                    {/* 닮은 연예인 목록 */}
                    <div className="space-y-3">
                        {(result.matches ?? []).map((m, i) => (
                            <div key={i} className="rounded-xl p-3.5" style={{
                                background: i === 0 ? 'rgba(168,134,210,0.14)' : 'rgba(168,134,210,0.06)',
                                border: `1px solid rgba(196,169,224,${i === 0 ? 0.4 : 0.2})`,
                            }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold" style={{ fontSize: i === 0 ? 17 : 15, color: '#5A4080' }}>
                                        {i === 0 && '🏆 '}{m.name}
                                    </span>
                                    <span className="font-bold text-sm" style={{ color: '#8E6FB7' }}>{m.percent}%</span>
                                </div>
                                {/* 닮음 바 */}
                                <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'rgba(142,111,183,0.15)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${m.percent}%`, background: 'linear-gradient(90deg, #A886D2, #8E6FB7)' }} />
                                </div>
                                <p className="text-xs leading-relaxed mb-2" style={{ color: '#6B5580' }}>{m.reason}</p>
                                {/* 사진 보기 — 네이버 이미지 검색(검색엔진이 표시 → 초상권 안전, URL 환각 없음).
                                    "아이유(가수)" 같은 분야 표기는 괄호 앞 이름만으로 검색. */}
                                <button
                                    onClick={() => window.open(`https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(m.name.replace(/\s*[\(（].*$/, '').trim() || m.name)}`, '_blank', 'noopener')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                                    style={{ background: 'rgba(142,111,183,0.1)', color: '#7A5FA0', border: '1px solid rgba(196,169,224,0.3)' }}
                                >
                                    🔍 사진 보기
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* 윤채린 코멘트 */}
                    {result.comment && (
                        <div className="rounded-xl px-3.5 py-3" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(196,169,224,0.25)' }}>
                            <p className="text-xs leading-relaxed" style={{ color: '#7A5FA0' }}>
                                <span className="font-bold">{personaName || '윤채린'}</span> · {result.comment}
                            </p>
                        </div>
                    )}

                    {toast && <p className="text-xs text-center" style={{ color: '#8E6FB7' }}>{toast}</p>}

                    {/* 자랑하기 + 닫기 */}
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleShare}
                            className="flex-1 py-3 rounded-xl font-bold text-sm text-white"
                            style={{ background: 'linear-gradient(135deg, #A886D2, #8E6FB7)' }}
                        >
                            📲 친구에게 자랑하기
                        </button>
                        <button
                            onClick={onClose}
                            className="px-5 py-3 rounded-xl font-medium text-sm"
                            style={{ background: 'rgba(142,111,183,0.1)', color: '#7A5FA0', border: '1px solid rgba(196,169,224,0.3)' }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
