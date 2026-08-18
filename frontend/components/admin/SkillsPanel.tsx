import React, { useState, useRef, useEffect } from 'react';
import { adminApi } from '../../services/apiService';
import { Icon } from '../Icons';

// 스킬 카탈로그(Claude Code 스킬/MCP/플러그인 탐색기) 관리 — 동기화 버튼으로 최신 목록 반영.
// 실제 동기화는 서버2 워커(dev_request_worker.py → skill_ops.sync_catalog)가 큐를 폴링해 처리
// (2분 주기 크론) → build_catalog.py 재실행 → sites/skills/index.html 갱신 → git push → Vercel 재배포.
const CATALOG_URL = 'https://aichat.dbzone.kr/sites/skills/';

// 워커 크론이 2분 주기라 그보다 넉넉히 기다린다(적재 직후 눌린 경우 최대 2분 대기 + 처리 시간).
const POLL_MS = 5000;
const POLL_MAX = 42; // 5초 × 42 ≈ 3.5분

type Phase = 'idle' | 'waiting' | 'done' | 'failed';

export const SkillsPanel: React.FC = () => {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [phase, setPhase] = useState<Phase>('idle');
    const [elapsed, setElapsed] = useState(0);
    // ★재진입 방지: 이전 폴링이 살아 있는 채로 버튼을 다시 누르면 타이머가 겹쳐
    //   같은 요청을 중복 조회한다(전자책 표지 중복생성과 같은 종류의 사고).
    const timerRef = useRef<number | null>(null);

    const stopPoll = () => {
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // 언마운트 시 타이머 정리(탭 이동 후에도 도는 것 방지)
    useEffect(() => stopPoll, []);

    const poll = (id: number) => {
        stopPoll();
        let n = 0;
        setElapsed(0);
        timerRef.current = window.setInterval(async () => {
            n += 1;
            setElapsed(n * (POLL_MS / 1000));
            try {
                const r = await adminApi.getSkillSyncStatus(id);
                if (r.status === 'done') {
                    stopPoll(); setPhase('done'); setBusy(false);
                    setMsg(r.result || '✅ 동기화 완료');
                    return;
                }
                if (r.status === 'failed') {
                    stopPoll(); setPhase('failed'); setBusy(false);
                    setMsg(`❌ 동기화 실패 — ${r.result || '사유 미상'}`);
                    return;
                }
            } catch {
                // 일시적 조회 실패는 무시하고 다음 주기에 재시도(네트워크 순간 끊김 등)
            }
            if (n >= POLL_MAX) {
                stopPoll(); setPhase('failed'); setBusy(false);
                setMsg('⌛ 확인 시간이 초과됐어요. 워커가 지연 중일 수 있으니 잠시 후 다시 확인해 주세요.');
            }
        }, POLL_MS);
    };

    const sync = async () => {
        if (busy) return; // 중복 클릭 차단
        setBusy(true); setMsg(''); setPhase('waiting'); setElapsed(0);
        try {
            const r = await adminApi.syncSkills();
            if (!r?.id) throw new Error('id 없음');
            setMsg('🔄 동기화를 요청했어요. 처리될 때까지 기다리는 중…');
            poll(r.id);
        } catch {
            setPhase('failed'); setBusy(false);
            setMsg('❌ 동기화 요청 실패. 다시 시도해 주세요.');
        }
    };

    const msgColor = phase === 'done' ? 'text-emerald-300'
        : phase === 'failed' ? 'text-rose-300'
            : 'text-amber-300';

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Icon name="Zap" size={18} className="text-yellow-400" />
                        <h3 className="text-base font-bold text-white">스킬 카탈로그</h3>
                    </div>
                    <button onClick={sync} disabled={busy}
                        className="text-xs text-gray-300 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40">
                        <Icon name="RefreshCw" size={13} className={busy ? 'animate-spin' : ''} />
                        {busy ? `동기화 중… ${elapsed}초` : '동기화'}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                    Claude Code 스킬·MCP·플러그인 목록을 탭·카테고리로 정리한 탐색기입니다.
                    스킬을 추가/삭제한 뒤 동기화 버튼을 누르면 최신 목록이 반영됩니다.
                </p>

                {msg && (
                    <div className={`text-xs ${msgColor} mb-3 leading-relaxed break-words`}>
                        {msg}
                        {phase === 'waiting' && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                                워커가 2분 주기로 처리합니다. 이 창을 열어두면 결과가 자동으로 표시됩니다.
                            </div>
                        )}
                        {phase === 'done' && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                                Vercel 재배포까지 1분쯤 더 걸릴 수 있어요.
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <a href={CATALOG_URL} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-bold text-sky-300 hover:underline inline-flex items-center gap-1">
                        skills <Icon name="ExternalLink" size={12} />
                    </a>
                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono">{CATALOG_URL}</div>
                    <div className="text-xs text-gray-300 mt-1.5 leading-relaxed">
                        원본: ~/.claude/skills/_catalog/build_catalog.py 생성물
                    </div>
                </div>
            </div>
        </div>
    );
};
