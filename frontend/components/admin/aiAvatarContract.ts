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
 * Claude 구현용 예정 API 계약. 현재 UI 뼈대에서는 호출하지 않는다.
 * 서버 구현 후 apiService에 같은 경로를 추가하고 타입을 재사용한다.
 */
export const AI_AVATAR_API = Object.freeze({
    projects: '/api/admin/ai-avatar/projects',
    jobs: '/api/admin/ai-avatar/jobs',
    serverStatus: '/api/admin/ai-avatar/server-status',
});
