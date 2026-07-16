import React from 'react';
import { Sparkles, Users, Gift } from 'lucide-react';

interface RewardAlertModalProps {
    kind: 'welcome' | 'mission';
    amount: number;
    onClose: () => void;
}

/**
 * 온보딩 보상 알럿(공용)
 * - welcome: 가입 환영 + 가입 보너스 + 남은 미션 안내
 * - mission: 미션 달성 축하 + 적립 포인트
 * 글래스/크림·퍼플 톤, 모바일 우선.
 */
export const RewardAlertModal: React.FC<RewardAlertModalProps> = ({ kind, amount, onClose }) => {
    const isWelcome = kind === 'welcome';
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(20,12,30,0.55)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
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
                    background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 20px -6px rgba(142,111,183,0.55)',
                }}>
                    {isWelcome ? <Gift size={30} color="#fff" strokeWidth={2.2} />
                              : <Sparkles size={30} color="#fff" strokeWidth={2.2} />}
                </div>

                <h2 style={{ fontSize: 19, fontWeight: 800, color: '#2D2017', margin: '0 0 6px' }}>
                    {isWelcome ? '가입을 축하합니다! 🎉' : '미션 완료! 🎉'}
                </h2>
                <p style={{ fontSize: 13, color: '#7A6A86', margin: '0 0 16px', lineHeight: 1.6 }}>
                    {isWelcome
                        ? '가입해 주셔서 감사합니다.\n환영 보너스를 드렸어요.'.split('\n').map((t, i) => <span key={i}>{t}<br /></span>)
                        : '포인트가 적립되었어요.'}
                </p>

                {/* 적립 포인트 강조 */}
                <div style={{
                    background: 'rgba(142,111,183,0.08)', border: '1px solid rgba(142,111,183,0.2)',
                    borderRadius: 14, padding: '14px 12px', marginBottom: isWelcome ? 14 : 18,
                }}>
                    <p style={{ fontSize: 12, color: '#8E6FB7', fontWeight: 600, margin: '0 0 2px' }}>
                        {isWelcome ? '가입 축하금' : '미션 보상'}
                    </p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#8E6FB7', margin: 0 }}>
                        +{amount.toLocaleString()}P
                    </p>
                </div>

                {/* 환영일 때만 남은 미션 안내 */}
                {isWelcome && (
                    <div style={{ textAlign: 'left', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ fontSize: 12.5, color: '#2D2017', fontWeight: 700, margin: 0 }}>
                            ✨ 미션을 완료하면 더 받을 수 있어요!
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#7A6A86' }}>
                            <Users size={15} style={{ color: '#8E6FB7', flexShrink: 0 }} />
                            <span>나의 AI 페르소나 등록 <b style={{ color: '#8E6FB7' }}>+1,000P</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#7A6A86' }}>
                            <Sparkles size={15} style={{ color: '#8E6FB7', flexShrink: 0 }} />
                            <span>나의 AI 기능 등록 <b style={{ color: '#8E6FB7' }}>+1,000P</b></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#7A6A86' }}>
                            <Gift size={15} style={{ color: '#8E6FB7', flexShrink: 0 }} />
                            <span>친구 초대 (초대마다 두 분 다) <b style={{ color: '#8E6FB7' }}>+1,000P</b></span>
                        </div>
                    </div>
                )}

                <button
                    onClick={onClose}
                    style={{
                        width: '100%', padding: '12px', borderRadius: 999, cursor: 'pointer',
                        background: 'linear-gradient(135deg, #8E6FB7, #E48BB0)', color: '#fff',
                        border: 'none', fontSize: 14, fontWeight: 700,
                    }}
                >
                    {isWelcome ? '시작하기' : '확인'}
                </button>
            </div>
        </div>
    );
};
