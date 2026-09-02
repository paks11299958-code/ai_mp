export type AiAvatarStage = 'REFERENCE' | 'IDLE' | 'LIPSYNC' | 'REVIEW' | 'PUBLISHED';

export type AiAvatarJobStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'READY' | 'FAILED' | 'CANCELLED';

export interface AiAvatarProject {
    id: string;
    name: string;
    personaName: string;
    stage: AiAvatarStage;
    referenceImageUrl: string;
    idleVideoUrl?: string;
    speakingVideoUrl?: string;
    updatedAt: string;
}

export interface AiAvatarJob {
    id: string;
    projectId: string;
    kind: 'PREPARE_REFERENCE' | 'GENERATE_IDLE' | 'GENERATE_LIPSYNC' | 'BUILD_REVIEW';
    status: AiAvatarJobStatus;
    progress: number;
    error?: string;
    createdAt: string;
    completedAt?: string;
}

/**
 * 서버 원장(Phase 2)이 내려주는 행 모양. DB 컬럼과 1:1이다.
 * ★프론트 표시용 타입(AiAvatarProject)과 구분한다 — 서버는 자산 URL 대신 storageKey 를 준다.
 */
export interface AiAvatarProjectRow {
    id: string;
    name: string;
    personaName: string;
    stage: AiAvatarStage;
    createdBy: number | null;
    createdAt: string;
    updatedAt: string;
    /** 목록 조회에서만 함께 오는 최신 자산 키. */
    idleKey?: string | null;
    speakingKey?: string | null;
}

export interface AiAvatarAssetRow {
    id: string;
    projectId: string;
    kind: 'REFERENCE_IMAGE' | 'IDLE_VIDEO' | 'SPEAKING_VIDEO' | 'REVIEW_BOARD';
    storageKey: string;
    mime: string;
    bytes: number;
    sha256: string;
    createdAt: string;
}

export interface AiAvatarJobRow {
    id: string;
    projectId: string;
    kind: AiAvatarJob['kind'];
    status: AiAvatarJobStatus;
    progress: number;
    errorCode: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}

/**
 * 검수 점수표 한 건 (Phase 4).
 * ★행으로 쌓인다 — 덮어쓰지 않는다. "언제 누가 몇 점을 줘서 게시가 열렸는가"가 감사 대상이다.
 */
export interface AiAvatarReviewRow {
    id: string;
    projectId: string;
    /** 1~5. 아직 안 매긴 축은 null. */
    identity: number | null;
    temporal: number | null;
    lipsync: number | null;
    passed: boolean;
    note: string | null;
    reviewedBy: number | null;
    createdAt: string;
}

/** 검수 축과 합격선. 서버 `aiAvatarReview.ts` 와 같아야 한다. */
export const REVIEW_AXES = [
    { key: 'identity', label: '정체성', min: 4, hint: '얼굴이 그 사람으로 보이는가' },
    { key: 'temporal', label: '시간축', min: 3, hint: '움직임이 끊기거나 떨리지 않는가' },
    { key: 'lipsync', label: '립싱크', min: 3, hint: '입이 소리와 맞는가' },
] as const;

export type ReviewAxisKey = (typeof REVIEW_AXES)[number]['key'];

export interface AiAvatarPublicationRow {
    id: string;
    projectId: string;
    target: 'consult' | 'aiworld';
    assetId: string;
    previousAssetId: string | null;
    publishedBy: number | null;
    createdAt: string;
}

/**
 * Claude 구현용 예정 API 계약. 현재 UI 뼈대에서는 호출하지 않는다.
 * 서버 구현 후 apiService에 같은 경로를 추가하고 타입을 재사용한다.
 */
export const AI_AVATAR_API = Object.freeze({
    projects: '/api/admin/ai-avatar/projects',
    jobs: '/api/admin/ai-avatar/jobs',
    serverStatus: '/api/admin/ai-avatar/server-status',
});
