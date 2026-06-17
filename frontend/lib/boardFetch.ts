/**
 * Board 컴포넌트 공통 fetch 헬퍼.
 * credentials 포함, 실패 시 서버 error 메시지로 throw.
 * (StockAnalysisBoard / UsedItemBoard 등에 중복 정의되던 apiFetch 단일화)
 */
export async function boardFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    // 포인트 부족(402): 전역 충전 모달을 띄운다(apiService.request와 동일 처리).
    if (res.status === 402) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('insufficient-points'));
        const e: any = new Error('INSUFFICIENT_POINTS');
        e.code = 'INSUFFICIENT_POINTS';
        throw e;
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}
