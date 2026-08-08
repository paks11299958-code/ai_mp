import React, { useState } from 'react';
import { Coins, X, Loader2 } from 'lucide-react';
import { shortFeatureLabel } from '../lib/featureLabels';

// 1pt=1원(2026-06-17). 기본 1:1, 큰 패키지는 보너스 %.
const PACKAGES = [
    { id: 'basic',   name: '기본',       points: 5000,  price: 5000,  bonus: null },
    { id: 'popular', name: '인기',        points: 11000, price: 10000, bonus: '10% 보너스' },
    { id: 'premium', name: '프리미엄',    points: 60000, price: 50000, bonus: '20% 보너스' },
];

interface PointModalProps {
    currentPoints: number;
    userId: number;
    onClose: () => void;
    /** '친구 초대하고 +1000P' CTA 클릭 시(충전모달 닫고 초대모달 열기). 미전달 시 CTA 숨김. */
    onInviteClick?: () => void;
    /**
     * 포인트가 모자라서 자동으로 뜬 경우의 사유(2026-08-08 사장 지시).
     * 전달되면 상단에 "왜 떴는지"를 먼저 알려준다 — 없으면(직접 '충전하기'를 누른 경우)
     * 기존처럼 평범한 충전 화면으로 뜬다.
     * ★서버가 값을 일부만 줄 수도 있어 전 필드가 optional이다. 있는 것만 문장에 넣는다.
     */
    insufficient?: { required?: number; balance?: number; shortfall?: number; feature?: string } | null;
}

export const PointModal: React.FC<PointModalProps> = ({ currentPoints, userId, onClose, onInviteClick, insufficient }) => {
    const [loading, setLoading] = useState(false);
    // 기능 키 → 회원용 짧은 이름. 모르는 키면 undefined라 문구를 통째로 생략한다
    // (원문 키 'quick-menu'가 그대로 노출되는 게 최악이다).
    const featureName = shortFeatureLabel(insufficient?.feature);

    const handlePurchase = async (pkg: typeof PACKAGES[0]) => {
        if (loading) return;
        const clientKey = (import.meta as any).env?.VITE_TOSS_CLIENT_KEY;
        if (!clientKey) { alert('결제 설정이 준비되지 않았습니다.'); return; }
        const toss = (window as any).TossPayments;
        if (!toss) { alert('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }

        setLoading(true);
        try {
            const orderId = `${userId}_${pkg.id}_${Date.now()}`;
            const tp = toss(clientKey);
            await tp.requestPayment('카드', {
                amount: pkg.price,
                orderId,
                orderName: `포인트 ${pkg.points.toLocaleString()}pt 충전`,
                customerName: `user_${userId}`,
                successUrl: window.location.origin + '/',
                failUrl: window.location.origin + '/',
            });
        } catch (e: any) {
            if (e?.code !== 'USER_CANCEL' && e?.code !== 'PAY_PROCESS_CANCELED') {
                alert('결제 중 오류가 발생했습니다.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Coins size={20} className="text-yellow-400" />
                        {insufficient ? '포인트가 부족해요' : '포인트 충전'}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>

                {/* 부족해서 자동으로 뜬 경우의 사유 안내(2026-08-08 사장 지시).
                    그 전에는 기능을 눌렀는데 아무 설명 없이 결제창처럼 떠서, 회원 입장에선
                    "내가 충전을 눌렀나?" 싶고 **막힌 이유를 알 수 없었다**.
                    ★서버가 필요액을 안 실어줄 수도 있으므로(구버전 경로 등) 있는 값만 문장에
                      넣는다 — 값이 없다고 안내가 사라지거나 'undefined P'가 뜨면 안 된다. */}
                {insufficient && (
                    <div className="rounded-xl px-4 py-3 mb-4"
                         style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.35)' }}>
                        <p className="text-sm font-semibold text-red-300 mb-0.5">
                            {featureName ? `${featureName}을(를) 시작하지 못했어요` : '기능을 시작하지 못했어요'}
                        </p>
                        <p className="text-xs text-red-200/90 leading-relaxed">
                            {typeof insufficient.required === 'number' ? (
                                <>
                                    {insufficient.required.toLocaleString()}P가 필요한데{' '}
                                    {(insufficient.balance ?? currentPoints).toLocaleString()}P가 남아 있어요
                                    {typeof insufficient.shortfall === 'number' && insufficient.shortfall > 0 && (
                                        <> · <b className="text-red-200">{insufficient.shortfall.toLocaleString()}P 부족</b></>
                                    )}
                                </>
                            ) : (
                                <>충전하시면 바로 이어서 사용할 수 있어요</>
                            )}
                        </p>
                    </div>
                )}

                <p className="text-sm text-gray-400 mb-5">
                    잔여 포인트: <span className="text-yellow-400 font-bold">{currentPoints.toLocaleString()}pt</span>
                </p>

                <div className="flex flex-col gap-3 mb-5">
                    {PACKAGES.map(pkg => (
                        <button
                            key={pkg.id}
                            disabled={loading}
                            className="relative border border-gray-700 hover:border-yellow-500/70 rounded-xl p-4 text-left transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handlePurchase(pkg)}
                        >
                            {pkg.bonus && (
                                <span className="absolute top-3 right-3 text-[10px] font-bold text-yellow-400 bg-yellow-400/10 border border-yellow-500/30 rounded-full px-2 py-0.5">
                                    {pkg.bonus}
                                </span>
                            )}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-semibold text-gray-300 group-hover:text-white mb-0.5">{pkg.name}</div>
                                    <div className="text-yellow-400 font-bold text-xl">{pkg.points.toLocaleString()}<span className="text-sm font-normal ml-0.5">pt</span></div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-bold text-base">{pkg.price.toLocaleString()}<span className="text-xs text-gray-400 ml-0.5">원</span></div>
                                    <div className="text-xs text-gray-500">{(pkg.price / pkg.points).toFixed(1)}원/pt</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {loading && (
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-4">
                        <Loader2 size={14} className="animate-spin" />결제창으로 이동 중...
                    </div>
                )}

                {/* 무료 대안: 친구 초대 (2026-07-07 바이럴 P2 — 돈 내기 싫은 순간이 초대 동기 최대) */}
                {onInviteClick && (
                    <button
                        onClick={onInviteClick}
                        className="w-full mb-4 py-3 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 transition-colors text-sm font-semibold text-purple-300"
                    >
                        🎁 충전 대신 친구 초대하고 <span className="text-purple-200 font-bold">+1,000P</span> 받기
                    </button>
                )}

                <p className="text-xs text-gray-600 text-center">대화는 무료! 포인트는 관상·타로·이미지 같은 스페셜 기능에 사용돼요</p>
            </div>
        </div>
    );
};
