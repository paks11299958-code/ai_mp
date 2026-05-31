import { useState, useEffect, useCallback } from 'react';
import { boardFetch } from '../lib/boardFetch';

/** 작업 목록 board의 공통 status (pending/processing이면 진행 중으로 보고 폴링) */
export interface TaskLike {
    id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * 작업 목록 board(주식분석/중고판매 등)의 공통 패턴을 담은 훅.
 * - 마운트 시 목록 1회 로드 (실패는 조용히 무시, loading만 해제)
 * - pending/processing 작업이 있으면 10초마다 자동 폴링
 *
 * board별 고유 로직(상세 선택, 업로드, 추천 등)은 호출부에 그대로 둠.
 * (StockAnalysisBoard / UsedItemBoard에 중복되던 tasks/loading/loadTasks/폴링 단일화)
 *
 * @param listUrl 목록 조회 URL (예: `/api/stock-analysis`)
 */
export function useTaskList<T extends TaskLike>(listUrl: string) {
    const [tasks, setTasks] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTasks = useCallback(async () => {
        try {
            const data = await boardFetch<T[]>(listUrl);
            setTasks(data);
        } catch {
            // 목록 로드 실패는 조용히 무시 (기존 동작 보존)
        } finally {
            setLoading(false);
        }
    }, [listUrl]);

    useEffect(() => { loadTasks(); }, [loadTasks]);

    // pending/processing 작업이 있으면 10초마다 폴링
    useEffect(() => {
        const hasActive = tasks.some(t => t.status === 'pending' || t.status === 'processing');
        if (!hasActive) return;
        const t = setTimeout(loadTasks, 10000);
        return () => clearTimeout(t);
    }, [tasks, loadTasks]);

    return { tasks, setTasks, loading, loadTasks };
}
