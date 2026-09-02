import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icons';
import type { AiAvatarJob, AiAvatarStage } from './aiAvatarContract';
import {
    PUBLISH_TARGETS,
    SEOA_REFERENCE_URL,
    type AiAvatarJobKind,
    type AiAvatarPublishTarget,
    type AiAvatarRepoState,
    cancelJob,
    createProject,
    enqueueJob,
    estimateJob,
    hasActiveJobs,
    jobsForProject,
    latestPublication,
    publishProject,
    rollbackPublication,
    seedState,
    tick,
} from './aiAvatarMockRepo';

/**
 * Phase 1 — Mock repository와 UI 상태 연결.
 * 서버 API·DB·서버3 GPU는 아직 붙지 않았고, 이 화면은 네트워크를 호출하지 않는다.
 * 게시 버튼은 mock 원장만 바꾸며 실제 사이트 배포와 무관하다.
 */

const STAGE_LABEL: Record<AiAvatarStage, string> = {
    REFERENCE: '기준 이미지',
    IDLE: '대기 동작',
    LIPSYNC: '말하기',
    REVIEW: '검수',
    PUBLISHED: '게시됨',
};

const JOB_LABEL: Record<AiAvatarJobKind, string> = {
    PREPARE_REFERENCE: '기준 이미지 정리',
    GENERATE_IDLE: '대기 동작 생성',
    GENERATE_LIPSYNC: '말하기 립싱크',
    BUILD_REVIEW: '검수 보드 생성',
};

const TARGET_LABEL: Record<AiAvatarPublishTarget, string> = {
    consult: '공용 상담 (/consult)',
    aiworld: 'AI월드 사업 상담',
};

const JOB_ORDER: AiAvatarJobKind[] = ['PREPARE_REFERENCE', 'GENERATE_IDLE', 'GENERATE_LIPSYNC', 'BUILD_REVIEW'];

const POLL_MS = 500;

const stageOverview = [
    { key: 'REFERENCE', label: '1. 기준 이미지', desc: '정면 원본을 얼굴 정본으로 사용하고 좌우 측면은 검수에만 사용' },
    { key: 'IDLE', label: '2. 대기 동작', desc: 'LivePortrait pose-only · motion multiplier 0.25' },
    { key: 'LIPSYNC', label: '3. 말하기', desc: 'MuseTalk v1.5 · 한국어 4.9초 검수 완료' },
    { key: 'REVIEW', label: '4. 검수·배포', desc: '정체성·시간축·립싱크 점수와 승인 이력 필요' },
] as const;

export const AiAvatarPanel: React.FC = () => {
    const [state, setState] = useState<AiAvatarRepoState>(() => seedState(Date.now()));
    const [selectedId, setSelectedId] = useState('seoa');
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftPersona, setDraftPersona] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const active = hasActiveJobs(state);

    // 진행 중 작업이 있을 때만 타이머 하나를 돌리고, 끝나면 즉시 정리한다(중복 타이머 금지).
    useEffect(() => {
        if (!active) return undefined;
        timerRef.current = setInterval(() => setState((prev) => tick(prev, Date.now())), POLL_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [active]);

    const selected = useMemo(
        () => state.projects.find((project) => project.id === selectedId) ?? state.projects[0],
        [state.projects, selectedId],
    );
    const selectedJobs = useMemo(
        () => (selected ? jobsForProject(state, selected.id) : []),
        [state, selected],
    );

    const guard = useCallback((run: () => AiAvatarRepoState, success?: string) => {
        try {
            setState(run());
            setError(null);
            setNotice(success ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.');
            setNotice(null);
        }
    }, []);

    const submitProject = (event: React.FormEvent) => {
        event.preventDefault();
        guard(() => {
            const next = createProject(
                state,
                { name: draftName, personaName: draftPersona, referenceImageUrl: SEOA_REFERENCE_URL },
                Date.now(),
            );
            setSelectedId(next.projects[0].id);
            setDraftName('');
            setDraftPersona('');
            setCreating(false);
            return next;
        }, '프로젝트를 만들었습니다. (mock)');
    };

    const runJob = (kind: AiAvatarJobKind) => {
        if (!selected) return;
        const estimate = estimateJob(kind);
        if (estimate.gpuSeconds > 0) {
            const ok = window.confirm(
                `${estimate.label}을(를) 실행합니다.\n예상 GPU 시간 약 ${estimate.gpuSeconds}초, 예상 비용 약 ${estimate.estimatedCostKrw}원.\n\n※ Phase 1 mock이라 실제 서버3 GPU는 기동하지 않습니다.`,
            );
            if (!ok) return;
        }
        guard(() => enqueueJob(state, selected.id, kind, Date.now()), `${estimate.label} 작업을 큐에 넣었습니다.`);
    };

    const publish = (target: AiAvatarPublishTarget) => {
        if (!selected) return;
        guard(() => publishProject(state, selected.id, target, Date.now()), `${TARGET_LABEL[target]}에 게시했습니다. (mock)`);
    };

    const rollback = (target: AiAvatarPublishTarget) => {
        if (!selected) return;
        guard(() => rollbackPublication(state, selected.id, target, Date.now()), `${TARGET_LABEL[target]} 게시를 되돌렸습니다. (mock)`);
    };

    return (
        <section className="flex-1 overflow-y-auto bg-gray-950 p-4 sm:p-6" aria-labelledby="ai-avatar-title">
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 to-cyan-950/40 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Phase 1 · Mock</p>
                            <h3 id="ai-avatar-title" className="text-2xl font-black text-white">AI 아바타</h3>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                                사진 기반 2.5D 아바타의 기준 이미지 → 대기 동작 → 립싱크 → 검수·게시를 한곳에서 관리합니다.
                                지금은 전체 흐름을 검증하는 mock 단계라 서버3 GPU와 실제 사이트 배포는 일어나지 않습니다.
                            </p>
                        </div>
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                            Mock 원장 · 백엔드 미연결
                        </span>
                    </div>
                </header>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="아바타 제작 단계">
                    {stageOverview.map((stage) => {
                        const reached = selected ? stageReached(selected.stage, stage.key) : false;
                        return (
                            <article key={stage.key} className={`rounded-xl border p-4 ${reached ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800 bg-slate-900'}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="font-bold text-white">{stage.label}</h4>
                                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${reached ? 'bg-cyan-500/20 text-cyan-200' : 'bg-slate-800 text-slate-400'}`}>
                                        {reached ? '완료' : '대기'}
                                    </span>
                                </div>
                                <p className="mt-3 text-xs leading-5 text-slate-400">{stage.desc}</p>
                            </article>
                        );
                    })}
                </div>

                {error && (
                    <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm font-semibold text-rose-200">{error}</p>
                )}
                {notice && !error && (
                    <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm font-semibold text-emerald-200">{notice}</p>
                )}

                <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5" aria-labelledby="avatar-projects-title">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <h4 id="avatar-projects-title" className="font-bold text-white">프로젝트</h4>
                            <button type="button" onClick={() => { setCreating((v) => !v); setError(null); }}
                                className="min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-sm font-bold text-cyan-200">
                                {creating ? '취소' : '새 프로젝트'}
                            </button>
                        </div>

                        {creating && (
                            <form onSubmit={submitProject} className="mb-4 space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
                                <label className="block text-xs font-semibold text-slate-300">
                                    프로젝트 이름
                                    <input value={draftName} onChange={(e) => setDraftName(e.target.value)}
                                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white" />
                                </label>
                                <label className="block text-xs font-semibold text-slate-300">
                                    페르소나 이름
                                    <input value={draftPersona} onChange={(e) => setDraftPersona(e.target.value)}
                                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white" />
                                </label>
                                <button type="submit" className="min-h-11 w-full rounded-lg bg-cyan-500 px-3 text-sm font-black text-slate-950">만들기</button>
                            </form>
                        )}

                        <ul className="space-y-2">
                            {state.projects.map((project) => (
                                <li key={project.id}>
                                    <button type="button" onClick={() => setSelectedId(project.id)}
                                        aria-current={selected?.id === project.id}
                                        aria-label={`프로젝트 선택 ${project.name}`}
                                        className={`min-h-11 w-full rounded-xl border p-3 text-left ${selected?.id === project.id ? 'border-cyan-500/50 bg-cyan-950/30' : 'border-slate-700 bg-slate-950'}`}>
                                        <span className="block text-sm font-bold text-white">{project.name}</span>
                                        <span className="mt-1 block text-xs text-slate-400">
                                            {project.personaName} · {STAGE_LABEL[project.stage]}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5" aria-labelledby="avatar-detail-title">
                        {selected ? (
                            <>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 id="avatar-detail-title" className="font-bold text-white">{selected.name}</h4>
                                        <p className="mt-1 text-xs text-slate-400">현재 단계 · {STAGE_LABEL[selected.stage]}</p>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <figure className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                                        {selected.idleVideoUrl ? (
                                            <video src={selected.idleVideoUrl} muted loop autoPlay playsInline
                                                className="aspect-square w-full bg-slate-950 object-contain" aria-label="서아 대기 동작 미리보기" />
                                        ) : (
                                            <div className="grid aspect-square w-full place-items-center text-xs text-slate-500">대기 동작 없음</div>
                                        )}
                                        <figcaption className="px-3 py-2 text-xs text-slate-300">IDLE · LivePortrait m0.25</figcaption>
                                    </figure>
                                    <figure className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                                        {selected.speakingVideoUrl ? (
                                            <video src={selected.speakingVideoUrl} muted loop autoPlay playsInline
                                                className="aspect-square w-full bg-slate-950 object-contain" aria-label="서아 말하기 동작 미리보기" />
                                        ) : (
                                            <div className="grid aspect-square w-full place-items-center text-xs text-slate-500">말하기 없음</div>
                                        )}
                                        <figcaption className="px-3 py-2 text-xs text-slate-300">SPEAKING · MuseTalk v1.5</figcaption>
                                    </figure>
                                </div>

                                <h5 className="mt-5 flex items-center gap-2 text-sm font-bold text-white">
                                    <Icon name="Cpu" size={16} className="text-cyan-300" /> 작업 실행
                                </h5>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {JOB_ORDER.map((kind) => {
                                        const estimate = estimateJob(kind);
                                        return (
                                            <button key={kind} type="button" onClick={() => runJob(kind)}
                                                className="min-h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm font-bold text-slate-100">
                                                {JOB_LABEL[kind]}
                                                {estimate.gpuSeconds > 0 && (
                                                    <span className="ml-2 text-[11px] font-semibold text-amber-300">약 {estimate.gpuSeconds}초</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <h5 className="mt-5 text-sm font-bold text-white">작업 이력</h5>
                                {selectedJobs.length === 0 ? (
                                    <p className="mt-2 text-xs text-slate-500">아직 실행한 작업이 없습니다.</p>
                                ) : (
                                    <ul className="mt-3 space-y-2" aria-label="작업 이력">
                                        {selectedJobs.map((job) => (
                                            <li key={job.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-white">{JOB_LABEL[job.kind]}</span>
                                                    <span className="text-xs font-bold text-cyan-300">{jobStatusLabel(job)}</span>
                                                </div>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                                    <div className="h-full bg-cyan-400" style={{ width: `${job.progress}%` }} />
                                                </div>
                                                {(job.status === 'QUEUED' || job.status === 'RUNNING') && (
                                                    <button type="button" onClick={() => guard(() => cancelJob(state, job.id, Date.now()), '작업을 취소했습니다.')}
                                                        className="mt-2 min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300">
                                                        취소
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <h5 className="mt-5 text-sm font-bold text-white">게시 (mock)</h5>
                                <div className="mt-3 space-y-2">
                                    {PUBLISH_TARGETS.map((target) => {
                                        const pub = latestPublication(state, selected.id, target);
                                        return (
                                            <div key={target} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <p className="text-sm font-semibold text-white">{TARGET_LABEL[target]}</p>
                                                <p className="mt-1 break-all text-xs text-slate-400">
                                                    {pub ? `현재 ${pub.assetUrl}` : '게시 이력 없음'}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => publish(target)}
                                                        aria-label={`${TARGET_LABEL[target]} 게시`}
                                                        className="min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-200">
                                                        게시
                                                    </button>
                                                    <button type="button" onClick={() => rollback(target)}
                                                        aria-label={`${TARGET_LABEL[target]} 되돌리기`}
                                                        className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300">
                                                        되돌리기
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-400">프로젝트를 먼저 만드세요.</p>
                        )}
                    </section>
                </div>

                <p className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-5 text-rose-200">
                    Phase 1 mock입니다. 서버3 GPU 실행, 운영 DB 기록, 실제 사이트 게시는 승인·권한·롤백 가드가
                    구현된 Phase 2 이후에 연결합니다. 여기서 누른 게시는 화면 안 원장만 바꿉니다.
                </p>
            </div>
        </section>
    );
};

const STAGE_SEQUENCE: AiAvatarStage[] = ['REFERENCE', 'IDLE', 'LIPSYNC', 'REVIEW', 'PUBLISHED'];

const stageReached = (current: AiAvatarStage, target: AiAvatarStage) =>
    STAGE_SEQUENCE.indexOf(current) >= STAGE_SEQUENCE.indexOf(target);

const jobStatusLabel = (job: AiAvatarJob) => {
    if (job.status === 'READY') return '완료';
    if (job.status === 'FAILED') return '실패';
    if (job.status === 'CANCELLED') return '취소됨';
    if (job.status === 'QUEUED') return '대기 중';
    return `진행 ${job.progress}%`;
};
