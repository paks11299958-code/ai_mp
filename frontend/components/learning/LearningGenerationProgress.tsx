import React, { useEffect, useRef, useState } from 'react';

// ⏳ 3단계(모듈 상세) 백그라운드 생성 진행 상태 화면.
// ★사용자 확정 지시(2026-08-11) — "확정 직후 빈 화면을 보면 안 된다. 진행률 표시 +
// '준비 중' 안내가 필요하고, 생성 실패 시 재시도 경로도 함께 설계하라."
// GET /goals/:id/generation-status 를 폴링해 진행률을 보여주고, 전체 완료(status=active)되면
// 자동으로 대시보드로 이동한다. 실패(status=confirmed_generation_failed)면 재시도 버튼을 보여준다.

type GenStatus = {
    status: string;
    totalWeeks: number;
    generatedWeeks: number;
    progressPercent: number;
    hasFailure: boolean;
    failedWeeks: number[];
};

const POLL_INTERVAL_MS = 4000;

export const LearningGenerationProgress: React.FC<{ goalId: string }> = ({ goalId }) => {
    const [status, setStatus] = useState<GenStatus | null>(null);
    const [retrying, setRetrying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const poll = () => {
        fetch(`/api/aimp/learning/goals/${goalId}/generation-status`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '상태 조회에 실패했습니다.');
                return r.json();
            })
            .then((s: GenStatus) => {
                setStatus(s);
                if (s.status === 'active') {
                    window.location.href = '/learning/dashboard';
                    return;
                }
                // confirmed_generation_failed면 재시도 버튼을 보여주고 폴링을 멈춘다.
                if (s.status === 'confirmed_generating') {
                    timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
                }
            })
            .catch(e => setError(e.message));
    };

    useEffect(() => {
        poll();
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goalId]);

    const retry = () => {
        setRetrying(true);
        setError(null);
        fetch(`/api/aimp/learning/goals/${goalId}/retry-generation`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        })
            .then(async r => {
                if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || '재시도 요청에 실패했습니다.');
                poll();
            })
            .catch(e => setError(e.message))
            .finally(() => setRetrying(false));
    };

    const failed = status?.status === 'confirmed_generation_failed';
    const percent = status?.progressPercent ?? 0;

    return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
            <div className="max-w-sm w-full text-center">
                {!failed ? (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                        <h1 className="text-lg font-extrabold mb-2">커리큘럼을 준비하고 있어요</h1>
                        <p className="text-sm text-gray-400 mb-6">
                            {status ? `${status.generatedWeeks} / ${status.totalWeeks}주차 완료` : '잠시만 기다려 주세요…'}
                        </p>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500">{percent}%</p>
                        <p className="text-xs text-gray-500 mt-6">
                            완료되면 자동으로 대시보드로 이동합니다. 이 화면을 벗어나도 생성은 계속됩니다.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl">
                            ⚠️
                        </div>
                        <h1 className="text-lg font-extrabold mb-2">일부 생성에 실패했어요</h1>
                        <p className="text-sm text-gray-400 mb-6">
                            {status && status.failedWeeks.length > 0
                                ? `${status.failedWeeks.join(', ')}주차 생성이 반복 실패했습니다.`
                                : '커리큘럼 생성 중 문제가 발생했습니다.'}
                        </p>
                        <button
                            onClick={retry}
                            disabled={retrying}
                            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-extrabold py-3 rounded-xl transition-colors"
                        >
                            {retrying ? '재시도 요청 중…' : '다시 시도'}
                        </button>
                    </>
                )}

                {error && (
                    <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
