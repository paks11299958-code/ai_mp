import { useEffect, useRef } from 'react';
import { shortsMakerApi, UserShortsRow } from '../services/apiService';

export type ShortsMakerStep =
    | 'form' | 'waiting' | 'scenarios' | 'plan' | 'previewing' | 'preview' | 'producing' | 'result' | 'list';

interface Options {
    step: ShortsMakerStep;
    reqId: number | null;
    setRow: (row: UserShortsRow) => void;
    setStep: (step: ShortsMakerStep) => void;
    intervalMs?: number;
}

// 쇼츠 만들기 진행 상태 폴링 — pending→scenarios_ready, previewing→preview_ready,
// producing→done/failed 3단계를 5초 간격으로 확인해 row를 갱신하고 step을 전이시킨다.
// ShortsMakerBoard.tsx의 원래 useEffect(폴링)를 그대로 옮긴 것 — 동작은 동일하다.
export function useShortsMakerPolling({ step, reqId, setRow, setStep, intervalMs = 5000 }: Options): void {
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if ((step !== 'waiting' && step !== 'previewing' && step !== 'producing') || !reqId) return;
        const tick = async () => {
            try {
                const r = await shortsMakerApi.get(reqId);
                setRow(r);
                if (r.status === 'scenarios_ready') { if (pollRef.current) clearInterval(pollRef.current); setStep('scenarios'); }
                else if (r.status === 'preview_ready') { if (pollRef.current) clearInterval(pollRef.current); setStep('preview'); }
                else if (r.status === 'done' || r.status === 'failed') { if (pollRef.current) clearInterval(pollRef.current); setStep('result'); }
            } catch { /* 일시 오류는 다음 폴링에서 재시도 */ }
        };
        tick();
        pollRef.current = setInterval(tick, intervalMs);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, [step, reqId]);
}
