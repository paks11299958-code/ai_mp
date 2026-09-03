import React, { useState } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';
import { Icon } from './Icons';

// 비회원이 기능/페르소나를 클릭했을 때 뜨는 '체험 시작' 안내 모달 (2026-08-07).
//
// ★왜 만들었나 — 이 모달이 없던 시절의 실측:
//   비회원이 기능을 누르면 곧바로 가입 창(setShowAuthModal)이 떴다. 무엇을 하는 곳인지,
//   무엇을 주는지 한 줄도 없이 "가입하세요"만 요구한 셈이다.
//   게스트 계정 자동 생성은 ?ref= 링크로 들어온 사람에게만 걸려 있어서, 그냥 방문한
//   사람은 체험 포인트가 있다는 사실조차 모른 채 가입 창만 보고 나갔다.
//   실제로 8월 정회원 가입은 0명이었다.
//
// 이 모달이 채우는 것은 '단계적 가입 유도'의 빠진 첫 단계다:
//   비회원 → [체험회원 + 1,000P] → 몇 회 사용 → 잔액 소진 → 정회원
//             ↑ 여기가 통째로 비어 있었다
//
// ★금액 표기는 서버 GUEST_SIGNUP_BONUS(=SIGNUP_BONUS, 1000)와 짝이다(2026-09-03 사장 지시로
//   500 → 1000 통일). 한쪽만 고치면 "500P 받고 체험하기"를 눌렀는데 1000P가 들어오는
//   불일치가 생긴다 — 실제로 안내 문구는 1,000P인데 지급은 500P였던 기간이 있었다.
//
// ★게스트 계정은 '체험 시작' 버튼을 눌렀을 때만 만든다(모달 표시만으로 만들지 않는다).
//   렌더/표시 시점에 만들면 같은 사람이 여러 계정을 받는다 — 초대 링크를 3번 열었더니
//   user id가 230→231→232로 매번 새로 생긴 전례가 있다(App.tsx guestRegister 주석).

interface GuestTrialModalProps {
    /** 클릭한 기능의 표시 정보. 없으면(페르소나 클릭 등) 일반 문구로 폴백. */
    feature?: { name: string; catch?: string; desc?: string; accent?: string };
    /** 체험 계정 발급 성공 — 호출부에서 로그인 처리 + 원래 목적지로 보낸다. */
    onSuccess: (user: User, token: string) => void;
    /** 체험 대신 정식 로그인/가입을 원할 때. */
    onLogin: () => void;
    onClose: () => void;
}

export const GuestTrialModal: React.FC<GuestTrialModalProps> = ({ feature, onSuccess, onLogin, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const start = async () => {
        if (loading) return;          // 연타로 계정이 여러 개 만들어지지 않게
        setLoading(true);
        setError('');
        try {
            const { user, token } = await authApi.guestRegister();
            onSuccess(user, token);
        } catch (e: any) {
            setError(e?.message || '체험 시작에 실패했어요. 잠시 후 다시 시도해 주세요.');
            setLoading(false);
        }
    };

    const accent = feature?.accent || '#6D5BD0';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
             onClick={onClose}>
            <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden"
                 onClick={e => e.stopPropagation()}>
                <div className="px-6 pt-7 pb-6 text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
                         style={{ background: `${accent}1A`, color: accent }}>
                        <Icon name="Sparkles" className="w-7 h-7" />
                    </div>

                    {feature ? (
                        <>
                            <h2 className="text-lg font-bold text-gray-900">{feature.name}</h2>
                            {feature.catch && (
                                <p className="mt-1 text-sm font-medium" style={{ color: accent }}>{feature.catch}</p>
                            )}
                            {feature.desc && (
                                <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{feature.desc}</p>
                            )}
                        </>
                    ) : (
                        <>
                            <h2 className="text-lg font-bold text-gray-900">AI 놀이터 체험하기</h2>
                            <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
                                헤어스타일·관상·꿈해몽까지, AI로 할 수 있는 걸 직접 해보세요.
                            </p>
                        </>
                    )}

                    <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                        <p className="text-sm font-bold text-amber-900">🎁 체험 포인트 1,000P 무료 지급</p>
                        <p className="mt-1 text-[12px] text-amber-800">
                            가입 없이 바로 시작 · 주요 기능 2~3회 체험할 수 있어요
                        </p>
                    </div>

                    {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
                </div>

                <div className="px-6 pb-6 space-y-2">
                    <button
                        onClick={start}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] transition active:scale-[0.98] disabled:opacity-60"
                        style={{ background: accent }}
                    >
                        {loading ? '체험 준비 중…' : '1,000P 받고 바로 체험하기'}
                    </button>
                    <button
                        onClick={onLogin}
                        className="w-full py-2.5 text-[13px] text-gray-500 hover:text-gray-700 transition"
                    >
                        이미 회원이신가요? 로그인
                    </button>
                </div>
            </div>
        </div>
    );
};
