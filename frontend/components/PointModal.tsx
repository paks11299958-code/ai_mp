import React, { useState } from 'react';
import { Coins, X, Loader2 } from 'lucide-react';

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
}

export const PointModal: React.FC<PointModalProps> = ({ currentPoints, userId, onClose }) => {
    const [loading, setLoading] = useState(false);

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
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Coins size={20} className="text-yellow-400" />포인트 충전
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={20} /></button>
                </div>
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

                <p className="text-xs text-gray-600 text-center">레벨이 높을수록 메시지당 포인트 소모가 줄어듭니다</p>
            </div>
        </div>
    );
};
