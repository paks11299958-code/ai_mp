import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icons';
import { adminApi } from '../../services/apiService';
import type {
    AiAvatarAssetRow,
    AiAvatarJobRow,
    AiAvatarProjectRow,
    AiAvatarPublicationRow,
    AiAvatarReviewRow,
    AiAvatarStage,
    ReviewAxisKey,
} from './aiAvatarContract';
import { REVIEW_AXES } from './aiAvatarContract';
import {
    PUBLISH_TARGETS,
    type AiAvatarJobKind,
    type AiAvatarPublishTarget,
    estimateJob,
} from './aiAvatarPlan';

/**
 * Phase 2 — 서버 원장(shared-api)에 연결된 AI 아바타 어드민.
 *
 * ★서버가 정본이다. 화면에서 낙관적으로 상태를 바꾸지 않고, 매 동작 뒤 서버를 다시 읽는다.
 * ★작업은 큐에 쌓이기만 한다. 서버3 GPU 실행과 실제 사이트 반영은 Phase 3 이후다.
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
    const [projects, setProjects] = useState<AiAvatarProjectRow[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [assets, setAssets] = useState<AiAvatarAssetRow[]>([]);
    const [jobs, setJobs] = useState<AiAvatarJobRow[]>([]);
    const [publications, setPublications] = useState<AiAvatarPublicationRow[]>([]);
    const [reviews, setReviews] = useState<AiAvatarReviewRow[]>([]);
    // 화면에서 매기는 중인 점수(저장 전). 서버 판정은 저장 시점에만 한다.
    const [scores, setScores] = useState<Partial<Record<ReviewAxisKey, number>>>({});
    // 게시 후 "사이트에 실제로 넣는 방법" 안내(자동 반영을 하지 않기 때문에 필요하다).
    const [deployHint, setDeployHint] = useState<
        { target: string; destPath: string | null; sha256: string; note: string } | null>(null);
    const [loading, setLoading] = useState(true);
    // 상세(자산·작업·게시)를 읽는 중에는 실행 버튼을 잠근다.
    // ★자산이 아직 안 온 상태로 게시를 누르면 '자산 없음'이라는 잘못된 안내가 뜬다(실측).
    const [detailLoading, setDetailLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [draftName, setDraftName] = useState('');
    const [draftPersona, setDraftPersona] = useState('');
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // 언마운트 뒤 도착한 응답으로 setState 하지 않도록 표시해 둔다.
    const aliveRef = useRef(true);
    useEffect(() => () => { aliveRef.current = false; }, []);

    const message = (e: unknown) =>
        (e instanceof Error && e.message) ? e.message : '요청을 처리하지 못했습니다.';

    const loadProjects = useCallback(async () => {
        try {
            const res = await adminApi.listAiAvatarProjects();
            if (!aliveRef.current) return;
            setProjects(res.projects ?? []);
            setError(null);
            setSelectedId(prev => prev ?? res.projects?.[0]?.id ?? null);
        } catch (e) {
            if (aliveRef.current) setError(message(e));
        } finally {
            if (aliveRef.current) setLoading(false);
        }
    }, []);

    const loadDetail = useCallback(async (id: string, silent = false) => {
        if (!silent) setDetailLoading(true);
        try {
            const res = await adminApi.getAiAvatarProject(id);
            if (!aliveRef.current) return;
            setAssets(res.assets ?? []);
            setJobs(res.jobs ?? []);
            setPublications(res.publications ?? []);
            setReviews(res.reviews ?? []);
            setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...res.project } : p)));
        } catch (e) {
            if (aliveRef.current) setError(message(e));
        } finally {
            if (aliveRef.current && !silent) setDetailLoading(false);
        }
    }, []);

    useEffect(() => { void loadProjects(); }, [loadProjects]);
    useEffect(() => { if (selectedId) void loadDetail(selectedId); }, [selectedId, loadDetail]);

    const selected = useMemo(
        () => projects.find(p => p.id === selectedId) ?? null,
        [projects, selectedId],
    );
    const hasActive = jobs.some(j => j.status === 'QUEUED' || j.status === 'RUNNING');

    // 진행 중 작업이 있을 때만 타이머 하나를 돌리고, 끝나면 즉시 정리한다(중복 타이머 금지).
    useEffect(() => {
        if (!hasActive || !selectedId) return undefined;
        timerRef.current = setInterval(() => { void loadDetail(selectedId, true); }, POLL_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
        };
    }, [hasActive, selectedId, loadDetail]);

    /** 서버 호출 공통 처리. 성공하면 서버를 다시 읽어 화면을 맞춘다. */
    const run = useCallback(async (action: () => Promise<string | null>) => {
        setBusy(true);
        try {
            const ok = await action();
            if (!aliveRef.current) return;
            setError(null);
            setNotice(ok);
        } catch (e) {
            if (aliveRef.current) { setError(message(e)); setNotice(null); }
        } finally {
            if (aliveRef.current) setBusy(false);
        }
    }, []);

    const submitProject = (event: React.FormEvent) => {
        event.preventDefault();
        void run(async () => {
            const res = await adminApi.createAiAvatarProject(draftName.trim(), draftPersona.trim());
            setDraftName('');
            setDraftPersona('');
            setCreating(false);
            await loadProjects();
            setSelectedId(res.project.id);
            return '프로젝트를 만들었습니다.';
        });
    };

    const runJob = (kind: AiAvatarJobKind) => {
        if (!selected) return;
        const estimate = estimateJob(kind);
        if (estimate.gpuSeconds > 0) {
            const ok = window.confirm(
                `${estimate.label}을(를) 실행합니다.\n예상 GPU 시간 약 ${estimate.gpuSeconds}초, 예상 비용 약 ${estimate.estimatedCostKrw}원.\n\n※ 지금은 작업을 큐에 넣기만 합니다. 서버3 GPU는 아직 기동하지 않습니다.`,
            );
            if (!ok) return;
        }
        void run(async () => {
            const res = await adminApi.enqueueAiAvatarJob(selected.id, kind);
            await loadDetail(selected.id);
            return res.deduplicated
                ? '이미 같은 작업이 진행 중입니다.'
                : `${estimate.label} 작업을 큐에 넣었습니다.`;
        });
    };

    const cancel = (jobId: string) => {
        if (!selected) return;
        void run(async () => {
            await adminApi.cancelAiAvatarJob(jobId);
            await loadDetail(selected.id);
            return '작업을 취소했습니다.';
        });
    };

    /** 게시는 해당 종류의 최신 자산을 쓴다. 자산이 없으면 서버가 400으로 막는다. */
    const publish = (target: AiAvatarPublishTarget) => {
        if (!selected) return;
        const asset = assets.find(a => a.kind === 'IDLE_VIDEO') ?? assets[0];
        if (!asset) { setError('게시할 자산이 없습니다. 먼저 자산을 등록하세요.'); return; }
        void run(async () => {
            const res = await adminApi.publishAiAvatar(selected.id, target, asset.id);
            await loadDetail(selected.id);
            await loadProjects();
            // ★"게시했습니다"로 끝내면 사이트가 바뀐 줄 안다. 실제로는 원장 기록까지이므로
            //   무엇을 어디에 넣어야 하는지 함께 알린다(자동 반영은 하지 않기로 했다).
            setDeployHint(res.deploy?.applied === false ? { target, ...res.deploy } : null);
            return res.deploy?.applied === false
                ? `${TARGET_LABEL[target]} 게시를 기록했습니다. 사이트 반영은 아래 안내를 따르세요.`
                : `${TARGET_LABEL[target]}에 게시했습니다.`;
        });
    };

    const rollback = (target: AiAvatarPublishTarget) => {
        if (!selected) return;
        void run(async () => {
            await adminApi.rollbackAiAvatar(selected.id, target);
            await loadDetail(selected.id);
            return `${TARGET_LABEL[target]} 게시를 되돌렸습니다.`;
        });
    };

    /**
     * 검수 점수 저장. 통과 여부와 사유는 **서버 판정을 그대로 보여준다**.
     * ★화면에서 미리 통과/불통과를 계산해 버튼을 잠그지 않는다 — 합격선이 두 곳에 생기면
     *   서버만 고쳤을 때 화면이 옛 기준으로 거짓말을 한다.
     */
    const submitReview = () => {
        if (!selected) return;
        void run(async () => {
            const res = await adminApi.reviewAiAvatar(selected.id, scores as Record<string, number>);
            await loadDetail(selected.id);
            await loadProjects();
            return res.passed
                ? '검수 통과 — 게시할 수 있습니다.'
                : `검수 미통과: ${res.reason}`;
        });
    };

    const latestReview = reviews[0] ?? null;

    const latestPublicationFor = (target: AiAvatarPublishTarget) =>
        publications.find(p => p.target === target) ?? null;
    const assetById = (id: string | null) => (id ? assets.find(a => a.id === id) ?? null : null);
    const assetOfKind = (kind: AiAvatarAssetRow['kind']) => assets.find(a => a.kind === kind) ?? null;

    return (
        <section className="flex-1 overflow-y-auto bg-gray-950 p-4 sm:p-6" aria-labelledby="ai-avatar-title">
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 to-cyan-950/40 p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Phase 4 · 검수·게시</p>
                            <h3 id="ai-avatar-title" className="text-2xl font-black text-white">AI 아바타</h3>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                                사진 기반 2.5D 아바타의 기준 이미지 → 대기 동작 → 립싱크 → 검수·게시를 한곳에서 관리합니다.
                                검수 점수가 합격선을 넘어야 게시가 열립니다. 작업은 큐에 쌓이며,
                                서버3 GPU 자동 기동은 현재 꺼져 있습니다(운영자가 직접 켤 때만 실행).
                            </p>
                        </div>
                        {/* ★과금 상태는 화면에 항상 보이게 둔다. 자동 기동 스위치
                            (서버2 AVATAR_DISPATCH_ENABLED)가 꺼져 있어 큐가 쌓여도 GPU 는 안 켜진다. */}
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                            GPU 자동기동 OFF · 큐 적재만
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

                        {/* ★프로젝트가 쌓이면 목록만으로 페이지가 한없이 길어진다(실측 25,000px).
                            목록 자체를 스크롤 영역으로 가둬 화면 높이를 일정하게 유지한다. */}
                        <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                            {projects.map((project) => (
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
                                        {assetOfKind('IDLE_VIDEO') ? (
                                            <div className="grid aspect-square w-full place-items-center px-3 text-center text-[11px] leading-4 text-slate-300">
                                                <span aria-label="대기 동작 자산">
                                                    등록됨<br />
                                                    <span className="break-all text-slate-500">{assetOfKind('IDLE_VIDEO')!.storageKey}</span>
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="grid aspect-square w-full place-items-center text-xs text-slate-500">대기 동작 없음</div>
                                        )}
                                        <figcaption className="px-3 py-2 text-xs text-slate-300">IDLE · LivePortrait m0.25</figcaption>
                                    </figure>
                                    <figure className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                                        {assetOfKind('SPEAKING_VIDEO') ? (
                                            <div className="grid aspect-square w-full place-items-center px-3 text-center text-[11px] leading-4 text-slate-300">
                                                <span aria-label="말하기 자산">
                                                    등록됨<br />
                                                    <span className="break-all text-slate-500">{assetOfKind('SPEAKING_VIDEO')!.storageKey}</span>
                                                </span>
                                            </div>
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
                                                disabled={busy || detailLoading}
                                                className="min-h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm font-bold text-slate-100 disabled:opacity-50">
                                                {JOB_LABEL[kind]}
                                                {estimate.gpuSeconds > 0 && (
                                                    <span className="ml-2 text-[11px] font-semibold text-amber-300">약 {estimate.gpuSeconds}초</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <h5 className="mt-5 text-sm font-bold text-white">작업 이력</h5>
                                {jobs.length === 0 ? (
                                    <p className="mt-2 text-xs text-slate-500">아직 실행한 작업이 없습니다.</p>
                                ) : (
                                    <ul className="mt-3 space-y-2" aria-label="작업 이력">
                                        {jobs.map((job) => (
                                            <li key={job.id} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-white">{JOB_LABEL[job.kind]}</span>
                                                    <span className="text-xs font-bold text-cyan-300">{jobStatusLabel(job)}</span>
                                                </div>
                                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                                    <div className="h-full bg-cyan-400" style={{ width: `${job.progress}%` }} />
                                                </div>
                                                {(job.status === 'QUEUED' || job.status === 'RUNNING') && (
                                                    <button type="button" onClick={() => cancel(job.id)} disabled={busy}
                                                        className="mt-2 min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300">
                                                        취소
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                <h5 className="mt-5 text-sm font-bold text-white">검수 점수표</h5>
                                <p className="mt-1 text-xs text-slate-400">
                                    영상을 직접 보고 매깁니다. 세 축이 모두 합격선을 넘어야 게시가 열립니다.
                                </p>
                                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
                                    {REVIEW_AXES.map(axis => (
                                        <div key={axis.key} className="mb-3 last:mb-0">
                                            <div className="flex flex-wrap items-baseline gap-x-2">
                                                <span className="text-sm font-semibold text-white">{axis.label}</span>
                                                <span className="text-xs text-slate-500">{axis.hint} · {axis.min}점 이상</span>
                                            </div>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <button key={n} type="button"
                                                        onClick={() => setScores(s => ({ ...s, [axis.key]: n }))}
                                                        aria-label={`${axis.label} ${n}점`}
                                                        aria-pressed={scores[axis.key] === n}
                                                        disabled={busy}
                                                        className={`min-h-11 min-w-11 rounded-lg border text-xs font-bold disabled:opacity-50 ${
                                                            scores[axis.key] === n
                                                                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                                                                : 'border-slate-700 text-slate-400'}`}>
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={submitReview}
                                        aria-label="검수 점수 저장" disabled={busy || detailLoading}
                                        className="mt-1 min-h-11 w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-200 disabled:opacity-50">
                                        검수 점수 저장
                                    </button>
                                    {latestReview && (
                                        <p className={`mt-2 text-xs ${latestReview.passed ? 'text-emerald-300' : 'text-amber-300'}`}>
                                            최근 검수: {latestReview.passed ? '통과 — 게시 가능' : '미통과 — 게시 잠김'}
                                            {' · '}
                                            {REVIEW_AXES.map(a => `${a.label} ${latestReview[a.key] ?? '-'}`).join(' / ')}
                                        </p>
                                    )}
                                </div>

                                <h5 className="mt-5 text-sm font-bold text-white">게시</h5>
                                {deployHint && (
                                    <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
                                        <p className="text-xs font-bold text-amber-200">
                                            원장에만 기록됨 — 사이트는 아직 그대로입니다
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-amber-100/80">{deployHint.note}</p>
                                        {deployHint.destPath && (
                                            <p className="mt-1 break-all font-mono text-[11px] text-amber-100/70">
                                                → {deployHint.destPath}
                                                <br />sha256 {deployHint.sha256.slice(0, 16)}…
                                            </p>
                                        )}
                                    </div>
                                )}
                                <div className="mt-3 space-y-2">
                                    {PUBLISH_TARGETS.map((target) => {
                                        const pub = latestPublicationFor(target);
                                        return (
                                            <div key={target} className="rounded-lg border border-slate-700 bg-slate-950 p-3">
                                                <p className="text-sm font-semibold text-white">{TARGET_LABEL[target]}</p>
                                                <p className="mt-1 break-all text-xs text-slate-400">
                                                    {pub ? `현재 ${assetById(pub.assetId)?.storageKey ?? pub.assetId}` : '게시 이력 없음'}
                                                </p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <button type="button" onClick={() => publish(target)}
                                                        aria-label={`${TARGET_LABEL[target]} 게시`} disabled={busy || detailLoading}
                                                        className="min-h-11 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-200 disabled:opacity-50">
                                                        게시
                                                    </button>
                                                    <button type="button" onClick={() => rollback(target)}
                                                        aria-label={`${TARGET_LABEL[target]} 되돌리기`} disabled={busy || detailLoading}
                                                        className="min-h-11 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-300 disabled:opacity-50">
                                                        되돌리기
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-400">{loading ? '불러오는 중…' : '프로젝트를 먼저 만드세요.'}</p>
                        )}
                    </section>
                </div>

                <p className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-3 text-xs leading-5 text-rose-200">
                    작업은 큐에 적재되며, 서버3 GPU 자동 기동은 꺼져 있습니다(시간당 약 1,260원이라
                    운영자가 켤 때만 실행). 게시는 원장에 기록되며, 운영 사이트의 실제 자산 교체는
                    아직 이 화면과 연결돼 있지 않습니다.
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
