import { useEffect, useState } from 'react';

/** Existing read-only learning endpoints. Unmount/auth changes cancel stale results. */
export function useLearningRead<T>(url: string, enabled: boolean) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(enabled);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!enabled) { setData(null); setLoading(false); return; }
        const controller = new AbortController();
        setLoading(true); setError('');
        fetch(url, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal,
        }).then(async response => {
            if (!response.ok) throw new Error('학습 현황을 불러오지 못했어요.');
            return response.json();
        }).then(value => { if (!controller.signal.aborted) setData(value); })
            .catch(() => { if (!controller.signal.aborted) setError('학습 현황을 불러오지 못했어요.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [url, enabled, attempt]);
    return { data, loading, error, retry: () => setAttempt(value => value + 1) };
}
