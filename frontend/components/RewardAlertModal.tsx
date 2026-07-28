import React from 'react';
import { Sparkles, Users, Gift } from 'lucide-react';

interface RewardAlertModalProps {
    kind: 'welcome' | 'mission' | 'guestWelcome';
    amount: number;
    onClose: () => void;
    username?: string;  // welcome일 때 "OO님, 가입을 축하합니다!"로 인사
}

/**
 * 온보딩 보상 알럿(공용)
 * - welcome: 가입 환영 + 가입 보너스 + 남은 미션 안내
 * - mission: 미션 달성 축하 + 적립 포인트
 * - guestWelcome: 레퍼럴 링크로 온 방문자 임시계정 자동생성 + 체험 포인트 안내
 * 글래스/크림·퍼플 톤, 모바일 우선.
 */
export const RewardAlertModal: React.FC<RewardAlertModalProps> = ({ kind, amount, onClose, username }) => {
    const isMission = kind === 'mission';
    const isGuestWelcome = kind === 'guestWelcome';
    const isWelcome = !isMission; // welcome/guestWelcome 공용 레이아웃(미션 안내 블록만 welcome 전용으로 아래서 추가 분기)
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
                    {isGuestWelcome
                        ? '체험 회원으로 시작해요! 🎉'
                        : isWelcome
                        ? `${username ? `${username}님, ` : ''}가입을 축하합니다! 🎉`
                        : '미션 완료! 🎉'}
                </h2>
                <p style={{ fontSize: 13, color: '#7A6A86', margin: '0 0 16px', lineHeight: 1.6 }}>
                    {isGuestWelcome
                        // ★자기 상태를 반드시 알려준다(2026-07-28 사장 지적) — 기존 문구는 "체험용
                        // 포인트를 드렸어요"뿐이라, 가입 없이 체험 계정으로 로그인됐다는 사실을
                        // 사용자가 알 수 없었다. 나중에 포인트 소진 시 뜨는 정식전환 모달도 뜬금없어진다.
                        ? '가입 없이 바로 쓰는 체험 계정으로 로그인했어요.\n이 포인트로 기능을 자유롭게 써보세요!'
                            .split('\n').map((t, i) => <span key={i}>{t}<br /></span>)
                        : isWelcome
                        ? '가입해 주셔서 감사합니다.\n환영 보너스를 드렸어요.'.split('\n').map((t, i) => <span key={i}>{t}<br /></span>)
                        : '포인트가 적립되었어요.'}
                </p>

                {/* 적립 포인트 강조 */}
                <div style={{
                    background: 'rgba(142,111,183,0.08)', border: '1px solid rgba(142,111,183,0.2)',
                    borderRadius: 14, padding: '14px 12px', marginBottom: isWelcome ? 14 : 18,
                }}>
                    <p style={{ fontSize: 12, color: '#8E6FB7', fontWeight: 600, margin: '0 0 2px' }}>
                        {isGuestWelcome ? '체험 포인트' : isWelcome ? '가입 축하금' : '미션 보상'}
                    </p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#8E6FB7', margin: 0 }}>
                        +{amount.toLocaleString()}P
                    </p>
                </div>

                {/* ★"포인트를 다 쓰면 가입" 안내는 뺐다(2026-07-28 사장 지적): 지금 막 들어온
                    사람에게 전환 조건을 먼저 알려주면 "나중에 떨어지면 그때 하지"가 되어 오히려
                    미루게 만든다. 체험 계정이라는 사실은 제목·본문에서 이미 전달되고, 정식 전환
                    안내는 실제로 포인트가 부족해진 시점의 GuestUpgradeModal이 담당한다. */}

                {/* 정식 가입일 때만 남은 미션 안내(체험 계정은 아직 미션 대상 아님) */}
                {isWelcome && !isGuestWelcome && (
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
