import type { AiAvatarJob, AiAvatarJobStatus, AiAvatarProject, AiAvatarStage } from './aiAvatarContract';

/**
 * Phase 1 Mock repository.
 *
 * 서버 API·DB·서버3 GPU가 붙기 전에 어드민 UI 전체 흐름(프로젝트 생성 → 작업 진행 →
 * 검수 → 게시)을 검증하기 위한 순수 in-memory 구현이다.
 * ★네트워크·타이머·난수·Date.now를 이 파일 안에서 호출하지 않는다.
 *   진행 시간은 호출자가 `tick(nowMs)`로 주입한다(테스트 결정성).
 */

export type AiAvatarJobKind = AiAvatarJob['kind'];

/** 게시 대상은 허용 목록 enum으로만 제한한다(문서 §6). */
export const PUBLISH_TARGETS = ['consult', 'aiworld'] as const;
export type AiAvatarPublishTarget = (typeof PUBLISH_TARGETS)[number];

/** 작업 종류 → 완료 시 프로젝트가 도달하는 단계. */
const STAGE_AFTER: Record<AiAvatarJobKind, AiAvatarStage> = {
    PREPARE_REFERENCE: 'REFERENCE',
    GENERATE_IDLE: 'IDLE',
    GENERATE_LIPSYNC: 'LIPSYNC',
    BUILD_REVIEW: 'REVIEW',
};

/** 작업 종류별 mock 소요 시간(ms)과 예상 비용. 실제 GPU 실측 대신 UI 검증용 상수다. */
const JOB_PLAN: Record<AiAvatarJobKind, { label: string; durationMs: number; gpuSeconds: number }> = {
    PREPARE_REFERENCE: { label: '기준 이미지 정리', durationMs: 3_000, gpuSeconds: 0 },
    GENERATE_IDLE: { label: '대기 동작 생성', durationMs: 24_000, gpuSeconds: 22 },
    GENERATE_LIPSYNC: { label: '말하기 립싱크', durationMs: 40_000, gpuSeconds: 35 },
    BUILD_REVIEW: { label: '검수 보드 생성', durationMs: 6_000, gpuSeconds: 0 },
};

/**
 * 실제로 저장소에 존재하는 자산만 쓴다(`public/seoa/avatar/`).
 * ★없는 경로를 mock에 박으면 화면에서 빈 영상으로만 보여 발견이 늦는다.
 */
export const SEOA_IDLE_URL = '/seoa/avatar/idle.mp4';
export const SEOA_SPEAKING_URL = '/seoa/avatar/speaking-poc.mp4';
/** 기준 이미지 전용 자산은 아직 없다. idle 첫 프레임을 썸네일로 대신 쓴다. */
export const SEOA_REFERENCE_URL = SEOA_IDLE_URL;

export interface AiAvatarPublication {
    id: string;
    projectId: string;
    target: AiAvatarPublishTarget;
    assetUrl: string;
    previousAssetUrl?: string;
    publishedAt: string;
}

export interface AiAvatarRepoState {
    projects: AiAvatarProject[];
    jobs: AiAvatarJob[];
    publications: AiAvatarPublication[];
    /** 자동 증가 id. mock에서만 쓰는 결정적 시퀀스. */
    seq: number;
}

export interface JobEstimate {
    label: string;
    gpuSeconds: number;
    /** 서버3 L4 기준 대략 시간당 단가를 UI 확인 문구에 쓰기 위한 값(원). */
    estimatedCostKrw: number;
}

/** L4 GPU VM 1시간 개략 단가(원). 실제 청구는 서버3 비용 기록이 정본이다. */
const GPU_KRW_PER_HOUR = 1_100;

export const estimateJob = (kind: AiAvatarJobKind): JobEstimate => {
    const plan = JOB_PLAN[kind];
    return {
        label: plan.label,
        gpuSeconds: plan.gpuSeconds,
        estimatedCostKrw: Math.round((plan.gpuSeconds / 3600) * GPU_KRW_PER_HOUR),
    };
};

const iso = (nowMs: number) => new Date(nowMs).toISOString();

export const emptyState = (): AiAvatarRepoState => ({ projects: [], jobs: [], publications: [], seq: 0 });

/** 문서 §3의 검증 자산으로 만든 서아 기준 프로젝트. Phase 1 초기 화면용. */
export const seedState = (nowMs: number): AiAvatarRepoState => ({
    projects: [{
        id: 'seoa',
        name: '서아 상담 아바타',
        personaName: '서아',
        stage: 'PUBLISHED',
        referenceImageUrl: SEOA_REFERENCE_URL,
        idleVideoUrl: SEOA_IDLE_URL,
        speakingVideoUrl: SEOA_SPEAKING_URL,
        updatedAt: iso(nowMs),
    }],
    jobs: [],
    publications: [
        { id: 'pub-seed-1', projectId: 'seoa', target: 'consult', assetUrl: SEOA_IDLE_URL, publishedAt: iso(nowMs) },
        { id: 'pub-seed-2', projectId: 'seoa', target: 'aiworld', assetUrl: SEOA_IDLE_URL, publishedAt: iso(nowMs) },
    ],
    seq: 2,
});

export const createProject = (
    state: AiAvatarRepoState,
    input: { name: string; personaName: string; referenceImageUrl: string },
    nowMs: number,
): AiAvatarRepoState => {
    const name = input.name.trim();
    const personaName = input.personaName.trim();
    if (!name) throw new Error('프로젝트 이름을 입력하세요.');
    if (!personaName) throw new Error('페르소나 이름을 입력하세요.');

    const seq = state.seq + 1;
    const project: AiAvatarProject = {
        id: `proj-${seq}`,
        name,
        personaName,
        stage: 'REFERENCE',
        referenceImageUrl: input.referenceImageUrl,
        updatedAt: iso(nowMs),
    };
    return { ...state, seq, projects: [project, ...state.projects] };
};

const isActive = (status: AiAvatarJobStatus) => status === 'QUEUED' || status === 'RUNNING';

/** 같은 프로젝트·kind에 진행 중 작업이 있으면 중복 생성하지 않는다(문서 §6 멱등키). */
export const findActiveJob = (state: AiAvatarRepoState, projectId: string, kind: AiAvatarJobKind) =>
    state.jobs.find((job) => job.projectId === projectId && job.kind === kind && isActive(job.status));

export const enqueueJob = (
    state: AiAvatarRepoState,
    projectId: string,
    kind: AiAvatarJobKind,
    nowMs: number,
): AiAvatarRepoState => {
    if (!state.projects.some((p) => p.id === projectId)) throw new Error('프로젝트를 찾을 수 없습니다.');
    if (findActiveJob(state, projectId, kind)) return state;

    const seq = state.seq + 1;
    const job: AiAvatarJob = {
        id: `job-${seq}`,
        projectId,
        kind,
        status: 'QUEUED',
        progress: 0,
        createdAt: iso(nowMs),
    };
    return { ...state, seq, jobs: [job, ...state.jobs] };
};

export const cancelJob = (state: AiAvatarRepoState, jobId: string, nowMs: number): AiAvatarRepoState => ({
    ...state,
    jobs: state.jobs.map((job) => (job.id === jobId && isActive(job.status)
        ? { ...job, status: 'CANCELLED' as const, completedAt: iso(nowMs) }
        : job)),
});

const startedAtMs = (job: AiAvatarJob) => Date.parse(job.createdAt);

/**
 * 주입된 시각까지 진행 중 작업을 전진시킨다. 완료된 작업은 프로젝트 단계와 산출물 URL을 갱신한다.
 * 호출자는 setInterval 하나만 두고 이 함수를 부른다(중복 타이머 금지, 문서 §5).
 */
export const tick = (state: AiAvatarRepoState, nowMs: number): AiAvatarRepoState => {
    let projects = state.projects;
    let changed = false;

    const jobs = state.jobs.map((job) => {
        if (!isActive(job.status)) return job;

        const plan = JOB_PLAN[job.kind];
        const elapsed = nowMs - startedAtMs(job);
        const ratio = plan.durationMs > 0 ? elapsed / plan.durationMs : 1;
        const progress = Math.max(0, Math.min(100, Math.floor(ratio * 100)));

        if (progress >= 100) {
            changed = true;
            projects = projects.map((project) => (project.id === job.projectId
                ? applyJobOutput(project, job.kind, nowMs)
                : project));
            return { ...job, status: 'READY' as const, progress: 100, completedAt: iso(nowMs) };
        }

        const status: AiAvatarJobStatus = progress > 0 ? 'RUNNING' : 'QUEUED';
        if (progress === job.progress && status === job.status) return job;
        changed = true;
        return { ...job, status, progress };
    });

    return changed ? { ...state, jobs, projects } : state;
};

const applyJobOutput = (project: AiAvatarProject, kind: AiAvatarJobKind, nowMs: number): AiAvatarProject => {
    const base = { ...project, stage: STAGE_AFTER[kind], updatedAt: iso(nowMs) };
    if (kind === 'GENERATE_IDLE') return { ...base, idleVideoUrl: SEOA_IDLE_URL };
    if (kind === 'GENERATE_LIPSYNC') return { ...base, speakingVideoUrl: SEOA_SPEAKING_URL };
    return base;
};

/** 게시는 검수(REVIEW) 이상 단계 + idle 산출물이 있어야 한다. 이전 버전을 남겨 롤백 가능하게 한다. */
export const publishProject = (
    state: AiAvatarRepoState,
    projectId: string,
    target: AiAvatarPublishTarget,
    nowMs: number,
): AiAvatarRepoState => {
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.');
    if (project.stage !== 'REVIEW' && project.stage !== 'PUBLISHED') throw new Error('검수 단계를 통과한 프로젝트만 게시할 수 있습니다.');
    if (!project.idleVideoUrl) throw new Error('대기 동작 결과가 없습니다.');

    const previous = latestPublication(state, projectId, target);
    const seq = state.seq + 1;
    const publication: AiAvatarPublication = {
        id: `pub-${seq}`,
        projectId,
        target,
        assetUrl: project.idleVideoUrl,
        previousAssetUrl: previous?.assetUrl,
        publishedAt: iso(nowMs),
    };
    return {
        ...state,
        seq,
        publications: [publication, ...state.publications],
        projects: state.projects.map((p) => (p.id === projectId ? { ...p, stage: 'PUBLISHED' as const, updatedAt: iso(nowMs) } : p)),
    };
};

export const latestPublication = (state: AiAvatarRepoState, projectId: string, target: AiAvatarPublishTarget) =>
    state.publications.find((pub) => pub.projectId === projectId && pub.target === target);

/** 직전 게시본으로 되돌린다. 되돌릴 이전 버전이 없으면 거부한다. */
export const rollbackPublication = (
    state: AiAvatarRepoState,
    projectId: string,
    target: AiAvatarPublishTarget,
    nowMs: number,
): AiAvatarRepoState => {
    const current = latestPublication(state, projectId, target);
    if (!current) throw new Error('게시 이력이 없습니다.');
    if (!current.previousAssetUrl) throw new Error('되돌릴 이전 버전이 없습니다.');

    const seq = state.seq + 1;
    const restored: AiAvatarPublication = {
        id: `pub-${seq}`,
        projectId,
        target,
        assetUrl: current.previousAssetUrl,
        previousAssetUrl: current.assetUrl,
        publishedAt: iso(nowMs),
    };
    return { ...state, seq, publications: [restored, ...state.publications] };
};

export const jobsForProject = (state: AiAvatarRepoState, projectId: string) =>
    state.jobs.filter((job) => job.projectId === projectId);

export const hasActiveJobs = (state: AiAvatarRepoState) => state.jobs.some((job) => isActive(job.status));
