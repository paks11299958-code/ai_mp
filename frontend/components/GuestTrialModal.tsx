import React, { useState } from 'react';
import { authApi } from '../services/apiService';
import { User } from '../types';
import { Icon } from './Icons';
import { josaEunNeun, josaGwaWa } from './PersonaEntrySheet';
import type { GuestNotice } from '../lib/guestFeatureGate';

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
    /** 서버가 이미 사용한 체험으로 판단했거나 이 브라우저에 체험 이력이 있을 때. */
    expired?: boolean;
    onExpired: () => void;
    onRegister: () => void;
    /** 체험 대신 정식 로그인/가입을 원할 때. */
    onLogin: () => void;
    onClose: () => void;
    /** 진입화면(z-85) 위에서 띄울 때의 안내 종류(2026-09-28 사장 지시 "유료 메뉴 클릭하면 유료
     *  서비스 안내 문구 보여주고 회원가입 메뉴 나오게").
     *  ★없으면 **종전과 완전히 같게** 렌더한다(기존 호출부 회귀 0) — 아래 분기는 전부 notice 가 있을 때만.
     *  있으면: 안내 배너 + 회원가입 버튼 상시 노출 + 진입화면보다 위(z-95). 가격 숫자는 넣지 않는다
     *  (비로그인은 menu-prices 가 401 이라 알 수 없다). */
    notice?: GuestNotice;
    /** notice='chat' 문구에 넣을 페르소나 이름("은비와의 대화는 무료예요"). */
    personaName?: string;
}

export const GuestTrialModal: React.FC<GuestTrialModalProps> = ({ feature, onSuccess, expired = false, onExpired, onRegister, onLogin, onClose, notice, personaName }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [trialExpired, setTrialExpired] = useState(expired);

    const start = async () => {
        if (loading) return;          // 연타로 계정이 여러 개 만들어지지 않게
        setLoading(true);
        setError('');
        try {
            const { user, token } = await authApi.guestRegister();
            onSuccess(user, token);
        } catch (e: any) {
            if (e?.body?.code === 'GUEST_TRIAL_USED') {
                setTrialExpired(true);
                onExpired();
                setLoading(false);
                return;
            }
            setError(e?.message || '체험 시작에 실패했어요. 잠시 후 다시 시도해 주세요.');
            setLoading(false);
        }
    };

    const accent = feature?.accent || '#6D5BD0';

    // 안내 배너 문구 — notice 가 있을 때만 쓴다.
    const who = personaName?.trim() || '';
    const noticeBox = notice ? (() => {
        if (notice === 'paid') {
            const subj = feature?.name ? `${feature.name}${josaEunNeun(feature.name)} ` : '';
            return { tone: 'paid', head: '💎 유료 서비스예요',
                     body: `${subj}포인트로 이용하는 기능이에요. 회원가입하고 이용해 보세요.` };
        }
        if (notice === 'free') {
            return { tone: 'free', head: '✨ 무료로 이용할 수 있어요',
                     body: '회원가입하면 바로 시작할 수 있어요.' };
        }
        if (notice === 'chat') {
            return { tone: 'free', head: who ? `💬 ${who}${josaGwaWa(who)}의 대화는 무료예요` : '💬 대화는 무료예요',
                     body: '가입하면 바로 대화를 시작할 수 있어요.' };
        }
        return { tone: 'free', head: '🎁 친구 초대는 회원 기능이에요',
                 body: '회원가입하면 초대 링크를 받아 포인트를 모을 수 있어요.' };
    })() : null;
    // 대화 안내는 기능 설명이 없으므로 제목을 "OO와 대화하기"로 바꾼다(일반 문구 "AI 놀이터 체험하기" 대신).
    const chatTitle = notice === 'chat' && !feature && who ? `${who}${josaGwaWa(who)} 대화하기` : null;

    return (
        // ★notice 가 있으면 진입화면(z-85) 위로 올린다. 없으면 종전 z-60 그대로.
        <div className={`fixed inset-0 ${notice ? 'z-[95]' : 'z-[60]'} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}
             onClick={onClose}>
            <div className={`w-full max-w-sm rounded-3xl bg-white shadow-2xl ${notice ? 'max-h-[calc(100dvh-32px)] overflow-y-auto' : 'overflow-hidden'}`}
                 onClick={e => e.stopPropagation()}
                 {...(notice ? { role: 'dialog', 'aria-modal': true, 'aria-label': noticeBox?.head } : {})}>
                <div className="px-6 pt-7 pb-6 text-center">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center"
                         style={{ background: `${accent}1A`, color: accent }}>
                        <Icon name="Sparkles" className="w-7 h-7" />
                    </div>

                    {trialExpired ? (
                        <>
                            <h2 className="text-lg font-bold text-gray-900">체험이 만료되었습니다</h2>
                            <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
                                무료 체험은 한 번만 제공됩니다. 회원가입하면 AI 기능과 대화를 계속 이용할 수 있어요.
                            </p>
                        </>
                    ) : feature ? (
                        <>
                            <h2 className="text-lg font-bold text-gray-900">{feature.name}</h2>
                            {feature.catch && (
                                <p className="mt-1 text-sm font-medium" style={{ color: accent }}>{feature.catch}</p>
                            )}
                            {feature.desc && (
                                <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{feature.desc}</p>
                            )}
                        </>
                    ) : chatTitle ? (
                        <h2 className="text-lg font-bold text-gray-900">{chatTitle}</h2>
                    ) : (
                        <>
                            <h2 className="text-lg font-bold text-gray-900">AI 놀이터 체험하기</h2>
                            <p className="mt-3 text-[13px] leading-relaxed text-gray-600">
                                헤어스타일·관상·꿈해몽까지, AI로 할 수 있는 걸 직접 해보세요.
                            </p>
                        </>
                    )}

                    {noticeBox && (
                        <div className={`mt-4 rounded-2xl px-4 py-3 border ${noticeBox.tone === 'paid' ? 'bg-violet-50 border-violet-200' : 'bg-emerald-50 border-emerald-200'}`}
                             data-testid="guest-notice">
                            <p className={`text-sm font-bold ${noticeBox.tone === 'paid' ? 'text-violet-900' : 'text-emerald-900'}`}>{noticeBox.head}</p>
                            <p className={`mt-1 text-[12px] leading-relaxed ${noticeBox.tone === 'paid' ? 'text-violet-800' : 'text-emerald-800'}`}>{noticeBox.body}</p>
                        </div>
                    )}

                    {!trialExpired && (
                        <div className="mt-5 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
                            <p className="text-sm font-bold text-amber-900">🎁 체험 포인트 1,000P 무료 지급</p>
                            <p className="mt-1 text-[12px] text-amber-800">
                                가입 없이 바로 시작 · 주요 기능 2~3회 체험할 수 있어요
                            </p>
                        </div>
                    )}

                    {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
                </div>

                <div className="px-6 pb-6 space-y-2">
                    <button
                        onClick={trialExpired ? onRegister : start}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] transition active:scale-[0.98] disabled:opacity-60"
                        style={{ background: accent }}
                    >
                        {trialExpired ? '무료 회원가입' : loading ? '체험 준비 중…' : '1,000P 받고 바로 체험하기'}
                    </button>
                    {/* ★notice 가 있으면 회원가입을 **항상** 보인다(만료면 위 주 버튼이 이미 가입이라 생략). */}
                    {notice && !trialExpired && (
                        <button
                            onClick={onRegister}
                            className="w-full py-3 rounded-2xl font-bold text-[14px] border transition active:scale-[0.98]"
                            style={{ color: accent, borderColor: accent, background: '#fff' }}
                        >
                            무료 회원가입
                        </button>
                    )}
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
