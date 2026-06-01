import { useState, useEffect, useRef } from 'react';
import { pointApi } from '../services/pointService';
import { User } from '../types';

/**
 * 토스 결제 리다이렉트 처리 훅 (App.tsx #1 분해 — T1).
 *
 * - mount 시 URL 쿼리(paymentKey/orderId/amount)에서 결제 정보를 1회 추출하고
 *   히스토리에서 쿼리를 즉시 제거(replaceState)한다 — 기존 App.tsx의 lazy init 동작 그대로.
 * - user 로그인 후 confirmPayment를 1회만 실행(paymentProcessedRef로 중복 방지).
 * - 포인트 잔액 setter는 PointsContext에서 이미 구독 중인 것을 주입받아 단일 소스 유지.
 *
 * @returns paymentSuccess - 충전 완료 토스트 표시용(4초 후 자동 해제)
 */
export function usePayment(
    user: User | null,
    setPaidPoints: (n: number) => void,
    setBonusPoints: (n: number) => void,
) {
    const [pendingPayment] = useState<{ paymentKey: string; orderId: string; amount: number } | null>(() => {
        const params = new URLSearchParams(window.location.search);
        const paymentKey = params.get('paymentKey');
        const orderId = params.get('orderId');
        const amount = params.get('amount');
        if (paymentKey && orderId && amount) {
            window.history.replaceState({}, '', window.location.pathname);
            return { paymentKey, orderId, amount: Number(amount) };
        }
        return null;
    });
    const [paymentSuccess, setPaymentSuccess] = useState<{ points: number } | null>(null);
    const paymentProcessedRef = useRef(false);

    useEffect(() => {
        if (!user || !pendingPayment || paymentProcessedRef.current) return;
        paymentProcessedRef.current = true;
        pointApi.confirmPayment(pendingPayment.paymentKey, pendingPayment.orderId, pendingPayment.amount)
            .then(result => {
                setPaidPoints(result.newPaidBalance);
                setBonusPoints(result.newBonusBalance);
                setPaymentSuccess({ points: result.points });
                setTimeout(() => setPaymentSuccess(null), 4000);
            })
            .catch(e => console.error('[payment confirm]', e));
    }, [user?.id]); // eslint-disable-line

    return { paymentSuccess };
}
