import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../services/apiService';
import { buildInviteLink, buildInviteMessage, InviteTarget } from '../services/referral';
import { FEATURES_GRID } from './MainPageNew';
import { Icon } from './Icons';

interface InviteFriendModalProps {
    onClose: () => void;
    /** 초대 모달을 연 시점에 보고 있던 페르소나 — 목적지 기본값으로 쓴다(대부분 그냥 복사만 하면 됨). */
    currentPersonaName?: string;
}

// 전용 '친구 초대' 화면(모달). 내 추천링크 + 복사/공유 + 현황(초대 인원·적립 pt).
// 보상 정책: 친구가 가입 후 기능을 1회 사용하면 양쪽 각 1000pt.
export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({ onClose, currentPersonaName }) => {
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

    // 고를 수 있는 목적지 목록. 기능이 곧 페르소나인 경우가 많아(13명 중 9명이 기능 1개)
    // 페르소나/기능을 2단계로 나누지 않고 한 목록에서 고르게 한다 — 대신 기능은 담당
    // 페르소나명을 함께 보여줘 누구에게 가는지 알 수 있게 한다.
    // 지금 보고 있던 페르소나의 기능을 맨 위로 올린다 — 스크롤 없이 바로 보이게(선택 확인 가능).
    const targets = useMemo<InviteTarget[]>(() => {
        const feats = FEATURES_GRID.map(f => ({
            kind: 'feature' as const, key: f.key, label: f.name, personaName: f.personaName,
        }));
        const mine = currentPersonaName ? feats.filter(f => f.personaName === currentPersonaName) : [];
        const rest = feats.filter(f => !mine.includes(f));
        return [...mine, { kind: 'home' as const }, ...rest];
    }, [currentPersonaName]);

    // 기본값: 지금 보고 있던 페르소나의 기능(있으면). 은비 채팅에서 열면 '명품 감정'이 미리 선택된다.
    const [selected, setSelected] = useState<InviteTarget>(() => {
        if (currentPersonaName) {
            const f = FEATURES_GRID.find(x => x.personaName === currentPersonaName);
            if (f) return { kind: 'feature', key: f.key, label: f.name, personaName: f.personaName };
        }
        return { kind: 'home' };
    });

    const link = stats ? buildInviteLink(stats.code, selected) : '';

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

    const handleShare = async () => {
        if (!link) return;
        // 문구도 목적지에 맞춰 바뀐다 — 링크만 바뀌고 문구가 고정이면 클릭 동기가 안 생긴다.
        const { title, text } = buildInviteMessage(selected);
        try {
            if (navigator.share) { await navigator.share({ title, text, url: link }); return; }
        } catch { return; }
        try { await navigator.clipboard.writeText(`${text}\n${link}`); showToast('초대 링크가 복사되었습니다'); }
        catch { showToast(link); }
    };

    // 링크만 복사(입력칸 옆 '복사'). 문구까지 함께 보내는 건 아래 '공유하기'가 담당.
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
                            {/* 목적지 선택 — 링크가 어디로 도착할지 정한다 */}
                            <label className="text-[11px] font-semibold text-[#8A7E96]">무엇을 소개할까요?</label>
                            <div className="mt-1.5 mb-4 max-h-[168px] overflow-y-auto rounded-xl border" style={{ borderColor: '#E2D5EC', background: '#FDFBFE' }}>
                                {targets.map(t => {
                                    const key = t.kind === 'feature' ? `f:${t.key}` : t.kind;
                                    const isSel = t.kind === 'feature'
                                        ? selected.kind === 'feature' && selected.key === t.key
                                        : selected.kind === t.kind;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setSelected(t)}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors"
                                            style={{ background: isSel ? '#F0E7F8' : 'transparent' }}
                                        >
                                            <span className="shrink-0 w-4 h-4 rounded-full border flex items-center justify-center"
                                                  style={{ borderColor: isSel ? '#8E6FB7' : '#C9BCD6', background: isSel ? '#8E6FB7' : '#fff' }}>
                                                {isSel && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[13px] font-semibold truncate" style={{ color: isSel ? '#5B3F82' : '#3E3548' }}>
                                                    {t.kind === 'home' ? 'AI 놀이터 전체' : t.label}
                                                </span>
                                                {t.kind === 'feature' && t.personaName && (
                                                    <span className="block text-[11px] text-[#9A8FA6] truncate">{t.personaName}</span>
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* 내 추천 링크 — 어디로 도착하는 링크인지 함께 보여준다 */}
                            <label className="text-[11px] font-semibold text-[#8A7E96]">
                                내 초대 링크
                                <span className="ml-1 font-normal text-[#A99BB5]">
                                    · {selected.kind === 'home' ? '메인 화면으로 도착' : `${selected.kind === 'feature' ? selected.label : selected.name} 화면으로 바로 도착`}
                                </span>
                            </label>
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
