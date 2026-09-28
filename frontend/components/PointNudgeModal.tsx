import React from 'react';
import { Coins, Sparkles } from 'lucide-react';
import { nudgeCopy } from '../lib/pointNudges';
import type { ActiveNudge } from '../hooks/usePointNudges';

interface PointNudgeModalProps {
    nudge: ActiveNudge;
    /** '충전하기'/'회원가입하기' — 기존 충전 경로(setShowPointModal)로 연결. 체험계정은 거기서 가입 모달로 갈린다. */
    onPrimary: () => void;
    onClose: () => void;
}

/**
 * 포인트 넛지(소진 임박 / 대화 횟수 도달) 팝업.
 * RewardAlertModal 과 같은 크림·퍼플 카드 톤을 그대로 따른다(온보딩 알럿과 한 가족으로 보이게).
 * 모바일 우선: 버튼 두 개를 카드 하단에 세로로 둬 엄지 한 번에 닫을 수 있게 한다.
 */
export const PointNudgeModal: React.FC<PointNudgeModalProps> = ({ nudge, onPrimary, onClose }) => {
    const copy = nudgeCopy(nudge.kind, nudge.audience, { balance: nudge.balance, count: nudge.count });
    const isLow = nudge.kind === 'low';
    return (
        <div
            data-testid={`point-nudge-${nudge.kind}`}
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(20,12,30,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                style={{
                    width: '100%', maxWidth: 340, borderRadius: 22,
                    background: 'linear-gradient(160deg, #ffffff, #faf7ff)',
                    border: '1px solid rgba(142,111,183,0.25)',
                    boxShadow: '0 20px 50px -12px rgba(142,111,183,0.5)',
                    padding: '28px 22px 22px', textAlign: 'center',
                }}
            >
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', margin: '0 auto 14px',
                    background: isLow ? 'linear-gradient(135deg, #E0A340, #E48BB0)' : 'linear-gradient(135deg, #8E6FB7, #E48BB0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 20px -6px rgba(142,111,183,0.55)',
                }}>
                    {isLow ? <Coins size={30} color="#fff" strokeWidth={2.2} />
                           : <Sparkles size={30} color="#fff" strokeWidth={2.2} />}
                </div>

                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#2D2017', margin: '0 0 8px' }}>{copy.title}</h2>
                <p style={{ fontSize: 13, color: '#7A6A86', margin: '0 0 20px', lineHeight: 1.6 }}>
                    {copy.body.split('\n').map((t, i) => <span key={i}>{t}<br /></span>)}
                </p>

                <button
                    onClick={onPrimary}
                    style={{
                        width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)', color: '#fff',
                        fontSize: 15, fontWeight: 700, marginBottom: 8,
                    }}
                >
                    {copy.primary}
                </button>
                <button
                    onClick={onClose}
                    style={{
                        width: '100%', padding: '11px 0', borderRadius: 14, cursor: 'pointer',
                        background: 'transparent', border: '1px solid rgba(142,111,183,0.25)',
                        color: '#7A6A86', fontSize: 14, fontWeight: 600,
                    }}
                >
                    {copy.secondary}
                </button>
            </div>
        </div>
    );
};
