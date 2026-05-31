/**
 * Board 컴포넌트 공통 fetch 헬퍼.
 * credentials 포함, 실패 시 서버 error 메시지로 throw.
 * (StockAnalysisBoard / UsedItemBoard 등에 중복 정의되던 apiFetch 단일화)
 */
export async function boardFetch<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: 'include', ...options });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '오류' }));
        throw new Error(err.error || '요청 실패');
    }
    return res.json();
}
