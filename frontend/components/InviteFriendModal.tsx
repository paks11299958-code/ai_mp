import React, { useState, useEffect } from 'react';
import { authApi } from '../services/apiService';
import { buildReferralLink } from '../services/referral';
import { Icon } from './Icons';

interface InviteFriendModalProps {
    onClose: () => void;
}

// 전용 '친구 초대' 화면(모달). 내 추천링크 + 복사/공유 + 현황(초대 인원·적립 pt).
// 보상 정책: 친구가 가입 후 기능을 1회 사용하면 양쪽 각 1000pt.
export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({ onClose }) => {
    const [stats, setStats] = useState<{ code: string; invitedCount: number; rewardedCount: number; earnedPoints: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');

    useEffect(() => {
        authApi.referral()
            .then(setStats)
            .catch(() => setError('추천 현황을 불러오지 못했습니다.'))
            .finally(() => setLoading(false));
    }, []);

    const link = stats ? buildReferralLink(stats.code) : '';

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

    const handleShare = async () => {
        if (!link) return;
        const text = '나랑 같이 AI로 미래 얼굴·헤어·관상 해보자! 가입하고 둘 다 1000P 받기 🎁';
        try {
            if (navigator.share) { await navigator.share({ title: 'AI 페르소나 채팅 초대', text, url: link }); return; }
        } catch { return; }
        try { await navigator.clipboard.writeText(link); showToast('초대 링크가 복사되었습니다'); }
        catch { showToast(link); }
    };

    const handleCopy = async () => {
        if (!link) return;
        try { await navigator.clipboard.writeText(link); showToast('링크가 복사되었습니다'); }
        catch { showToast(link); }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(20,12,30,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FFFCF8', boxShadow: '0 24px 64px -12px rgba(80,50,110,0.4)' }}>
                {/* 헤더 */}
                <div className="px-6 pt-7 pb-6 text-center relative" style={{ background: 'linear-gradient(160deg, #8E6FB7 0%, #6B4F92 100%)' }}>
                    <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors">
                        <Icon name="X" size={18} />
                    </button>
                    <div className="text-4xl mb-2">🎁</div>
                    <h2 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>친구 초대하고 1000P 받기</h2>
                    <p className="mt-1.5 text-[13px] text-white/85 leading-snug">
                        친구가 가입 후 기능을 한 번 써보면<br/>나도, 친구도 각각 <b className="text-white">1000P</b> 적립!
                    </p>
                </div>

                <div className="px-6 py-5">
                    {loading && <div className="text-center text-sm text-[#8A7E96] py-6">불러오는 중…</div>}
                    {error && <div className="text-center text-sm text-[#C0505A] py-6">{error}</div>}
                    {stats && (
                        <>
                            {/* 내 추천 링크 */}
                            <label className="text-[11px] font-semibold text-[#8A7E96]">내 초대 링크</label>
                            <div className="mt-1.5 flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ background: '#F7F2FA', borderColor: '#E2D5EC' }}>
                                <span className="flex-1 text-[12px] text-[#5C5468] truncate">{link}</span>
                                <button onClick={handleCopy} className="shrink-0 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white" style={{ background: '#8E6FB7' }}>복사</button>
                            </div>

                            {/* 공유 버튼 */}
                            <button onClick={handleShare} className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: 'linear-gradient(135deg, #8E6FB7 0%, #6B4F92 100%)' }}>
                                <Icon name="Share2" size={17} />
                                친구에게 공유하기
                            </button>

                            {/* 현황 */}
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                <div className="text-center py-3 rounded-xl" style={{ background: '#F7F2FA' }}>
                                    <div className="text-[11px] text-[#8A7E96]">초대한 친구</div>
                                    <div className="mt-0.5 text-xl font-bold text-[#5B3F82]">{stats.invitedCount}<span className="text-xs font-medium text-[#8A7E96]">명</span></div>
                                </div>
                                <div className="text-center py-3 rounded-xl" style={{ background: '#F7F2FA' }}>
                                    <div className="text-[11px] text-[#8A7E96]">적립 포인트</div>
                                    <div className="mt-0.5 text-xl font-bold text-[#5B3F82]">{stats.earnedPoints.toLocaleString()}<span className="text-xs font-medium text-[#8A7E96]">P</span></div>
                                </div>
                            </div>
                            {stats.invitedCount > stats.rewardedCount && (
                                <p className="mt-3 text-[11px] text-center text-[#A0948A] leading-snug">
                                    {stats.invitedCount - stats.rewardedCount}명은 아직 기능을 사용하지 않아 보상 대기 중이에요.
                                </p>
                            )}
                        </>
                    )}
                </div>

                {toast && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-[13px] text-white" style={{ background: '#2D2438' }}>{toast}</div>
                )}
            </div>
        </div>
    );
};
