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
            .catch(e => {
                // ★2026-07-10: 승인 실패가 console에만 남아 사용자는 '결제했는데 포인트가
                // 안 들어왔다'고 오인(라이브 첫 결제 402 사례). 반드시 화면으로 알린다.
                // 승인 실패 = 매입 안 됨 → 카드 가승인은 자동 취소(실제 청구 없음).
                console.error('[payment confirm]', e);
                alert(`결제 승인에 실패했어요. 카드에는 청구되지 않으니 안심하세요.\n사유: ${e?.message || '알 수 없는 오류'}\n잠시 후 다시 시도해 주세요.`);
            });
    }, [user?.id]); // eslint-disable-line

    return { paymentSuccess };
}
