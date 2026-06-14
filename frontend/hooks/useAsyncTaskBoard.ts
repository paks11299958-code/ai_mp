import { useState, useEffect, useCallback } from 'react';

// 비동기 분석 보드(보험·명품·주식·스윙) 공용 생명주기 훅.
// 각 보드가 복제하던 목록 로드 + 10초 폴링 + 선택/상세 + 재시도 + 삭제를 한 곳에 모은다.
// 도메인별로 다른 부분(업로드 폼, 결과 카드 렌더)은 보드에 남긴다.

type Status = 'pending' | 'processing' | 'completed' | 'failed';
interface TaskLike { id: number; status: Status }

interface ApiFetch {
    <T>(url: string, options?: RequestInit): Promise<T>;
}

interface Options<TTask extends TaskLike, TDetail extends TaskLike> {
    api: (path: string) => string;       // 예: p => `/api/insurance-analysis${p}`
    apiFetch: ApiFetch;                  // 보드가 쓰는 fetch 헬퍼 주입
    pollMs?: number;                     // 진행중 폴링 주기(기본 10초)
    selectableOnly?: Status;             // 이 상태일 때만 상세 열기(기본 'completed')
}

export function useAsyncTaskBoard<TTask extends TaskLike, TDetail extends TaskLike>(
    { api, apiFetch, pollMs = 10000, selectableOnly = 'completed' }: Options<TTask, TDetail>,
) {
    const [tasks, setTasks] = useState<TTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<TDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const loadTasks = useCallback(async () => {
        try {
            const data = await apiFetch<TTask[]>(api(''));
            setTasks(data);
        } catch { /* 무시 */ }
        finally { setLoading(false); }
    }, [api, apiFetch]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // 진행 중(pending/processing) 작업이 있으면 주기적으로 갱신
    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, pollMs);
        return () => clearTimeout(t);
    }, [tasks, loadTasks, pollMs]);

    const selectTask = useCallback(async (task: TTask) => {
        if (task.status !== selectableOnly) return;
        setDetailLoading(true);
        try {
            const detail = await apiFetch<TDetail>(api(`/${task.id}`));
            setSelected(detail);
        } finally {
            setDetailLoading(false);
        }
    }, [api, apiFetch, selectableOnly]);

    const retryTask = useCallback(async (id: number) => {
        await apiFetch(api(`/${id}/retry`), { method: 'POST' });
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'pending' as Status, errorMessage: null } as TTask : t));
    }, [api, apiFetch]);

    const deleteTask = useCallback(async (id: number, confirmMsg?: string) => {
        if (confirmMsg && !confirm(confirmMsg)) return;
        await apiFetch(api(`/${id}`), { method: 'DELETE' });
        setTasks(prev => prev.filter(t => t.id !== id));
        setSelected(prev => (prev && prev.id === id ? null : prev));
    }, [api, apiFetch]);

    return {
        tasks, loading, selected, detailLoading,
        setSelected, loadTasks, selectTask, retryTask, deleteTask,
    };
}
