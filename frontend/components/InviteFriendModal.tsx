import React, { useState, useEffect, useMemo } from 'react';
import { authApi } from '../services/apiService';
import { buildInviteLink, buildInviteMessage, InviteTarget } from '../services/referral';
import { FEATURES_GRID } from './MainPageNew';
import { Icon } from './Icons';

/** 선택 표시용 라디오 점. small=기능 줄(들여쓰기된 하위 항목). */
const Radio: React.FC<{ on: boolean; small?: boolean }> = ({ on, small }) => (
    <span
        className={`shrink-0 rounded-full border flex items-center justify-center ${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
        style={{ borderColor: on ? '#8E6FB7' : '#C9BCD6', background: on ? '#8E6FB7' : '#fff' }}
    >
        {on && <span className={`rounded-full bg-white ${small ? 'w-1 h-1' : 'w-1.5 h-1.5'}`} />}
    </span>
);

interface InviteFriendModalProps {
    onClose: () => void;
    /** 초대 모달을 연 시점에 보고 있던 페르소나 — 목적지 기본값으로 쓴다(대부분 그냥 복사만 하면 됨). */
    currentPersonaName?: string;
    /** 공유 가능한 페르소나(숨김 제외). 페르소나 자체를 소개하는 링크(?p=)를 만들 때 쓴다. */
    personas?: { id: string; name: string }[];
}

// 전용 '친구 초대' 화면(모달). 내 추천링크 + 복사/공유 + 현황(초대 인원·적립 pt).
// 보상 정책: 친구가 가입 후 기능을 1회 사용하면 양쪽 각 1000pt.
export const InviteFriendModal: React.FC<InviteFriendModalProps> = ({ onClose, currentPersonaName, personas = [] }) => {
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

    // 페르소나 목록 + 각자의 기능(2026-07-28 사장 지시).
    // 페르소나를 고르면 그 아래 기능이 펼쳐지고, 기능은 **골라도 되고 안 골라도 된다**:
    //   · 안 고름 → ?p=페르소나ID  (그 페르소나 채팅으로 도착)
    //   · 고름   → ?f=기능키       (그 기능 화면으로 바로 도착)
    // 처음엔 "기능 1개인 페르소나는 둘이 같은 결과"라 보고 페르소나 선택을 뺐는데 틀렸다 —
    // 도착지가 다르고(채팅 vs 기능 화면), 도결 선생(기능 8개)은 전체를 소개할 방법이 없어졌다.
    const personaList = useMemo(() => {
        const rows = personas.map(p => ({
            id: p.id,
            name: p.name,
            features: FEATURES_GRID.filter(f => f.personaName === p.name)
                .map(f => ({ key: f.key, label: f.name })),
        }));
        // 지금 보고 있던 페르소나를 맨 위로(대부분 그냥 복사만 하면 되게)
        if (!currentPersonaName) return rows;
        return [...rows.filter(r => r.name === currentPersonaName), ...rows.filter(r => r.name !== currentPersonaName)];
    }, [personas, currentPersonaName]);

    // 기본값: 지금 보고 있던 페르소나(은비 채팅에서 열면 '신은비'). 그 화면에서 초대를 누른 건
    // "이 페르소나를 소개하려는" 의도에 가깝고, 기능만 콕 집으려면 펼쳐서 고르면 된다.
    const [selected, setSelected] = useState<InviteTarget>(() => {
        if (currentPersonaName) {
            const p = personas.find(x => x.name === currentPersonaName);
            if (p) return { kind: 'persona', id: p.id, name: p.name };
        }
        return { kind: 'home' };
    });

    // 위 리스트박스에서 고른 페르소나 id. 아래 기능 리스트박스가 이 값에 따라 채워진다.
    // ★기본값 = 지금 보고 있던 페르소나 → 열자마자 그 페르소나의 기능이 바로 보인다
    //   (2026-07-28 사장 지적: 14명 전체를 훑고 고르게 하면 불편하다).
    const [pickedPersonaId, setPickedPersonaId] = useState<string | null>(
        () => (selected.kind === 'persona' ? selected.id : null),
    );
    const pickedPersona = personaList.find(p => p.id === pickedPersonaId) ?? null;
    // 페르소나 목록은 평소 접어둔다(이미 선택돼 열리므로) — '바꾸기'를 눌렀을 때만 펼침.
    // 반면 **기능 목록은 항상 펼쳐둔다**: 접어두면 "선택 안 함(대화로 시작)"이라는 선택지가
    // 있다는 것 자체를 모르고, 만들어진 링크가 페르소나용인지 기능용인지 헷갈린다(사장 지적).
    const [showPersonaPicker, setShowPersonaPicker] = useState(false);

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
                            {/* ── 목적지 선택 ─────────────────────────────────────────
                                 모달을 연 페르소나가 **이미 선택된 상태**로 열리므로(대부분 그대로 씀)
                                 페르소나 목록은 접어둔다 — 바꿀 때만 펼친다(사장 지적: 기본이 이미
                                 선택돼 있는데 목록을 또 보여주면 불필요한 선택을 강요하게 된다).
                                 주가 되는 건 아래 "어떤 기능" 리스트박스. */}
                            <label className="text-[11px] font-semibold text-[#8A7E96]">누구를 소개할까요?</label>
                            <button
                                onClick={() => setShowPersonaPicker(v => !v)}
                                className="mt-1.5 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left"
                                style={{ background: '#F7F2FA', borderColor: '#E2D5EC' }}
                            >
                                <span className="flex-1 min-w-0 text-[13px] font-bold truncate" style={{ color: '#5B3F82' }}>
                                    {pickedPersona ? pickedPersona.name : 'AI 놀이터 전체'}
                                </span>
                                <span className="shrink-0 text-[11px] text-[#8E6FB7] font-semibold">
                                    {showPersonaPicker ? '닫기 ▲' : '바꾸기 ▼'}
                                </span>
                            </button>

                            {showPersonaPicker && (
                                <div className="mt-1.5 h-[132px] overflow-y-auto rounded-xl border" style={{ borderColor: '#E2D5EC', background: '#FDFBFE' }}>
                                    <button
                                        onClick={() => { setSelected({ kind: 'home' }); setPickedPersonaId(null); setShowPersonaPicker(false); }}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b"
                                        style={{ background: selected.kind === 'home' ? '#F0E7F8' : 'transparent', borderColor: '#EEE6F4' }}
                                    >
                                        <Radio on={selected.kind === 'home'} />
                                        <span className="text-[13px] font-semibold" style={{ color: selected.kind === 'home' ? '#5B3F82' : '#3E3548' }}>
                                            AI 놀이터 전체
                                        </span>
                                    </button>
                                    {personaList.map(row => {
                                        const on = pickedPersonaId === row.id;
                                        return (
                                            <button
                                                key={row.id}
                                                onClick={() => {
                                                    setPickedPersonaId(row.id);
                                                    setSelected({ kind: 'persona', id: row.id, name: row.name });
                                                    setShowPersonaPicker(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b last:border-b-0"
                                                style={{ background: on ? '#F0E7F8' : 'transparent', borderColor: '#EEE6F4' }}
                                            >
                                                <Radio on={on} />
                                                <span className="flex-1 min-w-0 text-[13px] font-semibold truncate"
                                                      style={{ color: on ? '#5B3F82' : '#3E3548' }}>
                                                    {row.name}
                                                </span>
                                                {row.features.length > 0 && (
                                                    <span className="shrink-0 text-[11px] text-[#A99BB5]">기능 {row.features.length}</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* 기능 목록은 **항상 펼쳐둔다** — 접으면 "선택 안 함(대화로 시작)"이라는
                                선택지가 있다는 걸 모르고, 만들어진 링크가 어느 쪽인지 헷갈린다. */}
                            {pickedPersona && (
                                <>
                                    <label className="mt-3 block text-[11px] font-semibold text-[#8A7E96]">
                                        어떤 기능을 소개할까요?
                                    </label>
                                    <div className="mt-1.5 max-h-[132px] overflow-y-auto rounded-xl border" style={{ borderColor: '#E2D5EC', background: '#FDFBFE' }}>
                                        <button
                                            onClick={() => setSelected({ kind: 'persona', id: pickedPersona.id, name: pickedPersona.name })}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b"
                                            style={{ background: selected.kind === 'persona' ? '#F0E7F8' : 'transparent', borderColor: '#EEE6F4' }}
                                        >
                                            <Radio on={selected.kind === 'persona'} />
                                            <span className="text-[12.5px]" style={{ color: selected.kind === 'persona' ? '#5B3F82' : '#6B5F78' }}>
                                                선택 안 함 — {pickedPersona.name}와 대화
                                            </span>
                                        </button>
                                        {pickedPersona.features.length === 0 ? (
                                            <div className="px-3 py-2.5 text-[12px] text-[#A99BB5]">이 페르소나는 전용 기능이 없어요.</div>
                                        ) : pickedPersona.features.map(f => {
                                            const on = selected.kind === 'feature' && selected.key === f.key;
                                            return (
                                                <button
                                                    key={f.key}
                                                    onClick={() => setSelected({ kind: 'feature', key: f.key, label: f.label, personaName: pickedPersona.name })}
                                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left border-b last:border-b-0"
                                                    style={{ background: on ? '#F0E7F8' : 'transparent', borderColor: '#EEE6F4' }}
                                                >
                                                    <Radio on={on} />
                                                    <span className="text-[12.5px] truncate" style={{ color: on ? '#5B3F82' : '#6B5F78', fontWeight: on ? 700 : 400 }}>
                                                        {f.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            <div className="mb-4" />

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
