import type { AiAvatarJob } from './aiAvatarContract';

/**
 * AI 아바타 어드민의 화면측 상수와 비용 추정.
 *
 * ★원장(프로젝트·작업·게시)의 정본은 서버다. 여기에는 서버가 모르는,
 *   "실행 전에 사용자에게 얼마나 걸리고 얼마 드는지 보여주기 위한" 값만 둔다.
 * ★Phase 1 의 mock repository 는 서버 API 로 대체돼 삭제했다(2026-09-02).
 */

export type AiAvatarJobKind = AiAvatarJob['kind'];

/** 게시 대상 allowlist. 서버 쪽 PUBLISH_TARGETS 와 반드시 같아야 한다. */
export const PUBLISH_TARGETS = ['consult', 'aiworld'] as const;
export type AiAvatarPublishTarget = (typeof PUBLISH_TARGETS)[number];

/**
 * 작업별 예상 GPU 시간. LivePortrait idle 1회 실측 약 22초를 기준으로 잡았다
 * (2026-09-02 서버3 PoC). 실제 소요는 Phase 3 에서 실행 기록이 쌓이면 교정한다.
 */
const JOB_PLAN: Record<AiAvatarJobKind, { label: string; gpuSeconds: number }> = {
    PREPARE_REFERENCE: { label: '기준 이미지 정리', gpuSeconds: 0 },
    GENERATE_IDLE: { label: '대기 동작 생성', gpuSeconds: 22 },
    GENERATE_LIPSYNC: { label: '말하기 립싱크', gpuSeconds: 35 },
    BUILD_REVIEW: { label: '검수 보드 생성', gpuSeconds: 0 },
};

/** 서버3 온디맨드 GPU VM 시간당 개략 단가(원). 실제 청구는 GCP 비용 기록이 정본이다. */
const GPU_KRW_PER_HOUR = 1_100;

export interface JobEstimate {
    label: string;
    gpuSeconds: number;
    estimatedCostKrw: number;
}

/** 실행 전 확인 문구에 쓸 예상치. GPU 를 쓰지 않는 작업은 0 이라 확인을 건너뛴다. */
export const estimateJob = (kind: AiAvatarJobKind): JobEstimate => {
    const plan = JOB_PLAN[kind];
    return {
        label: plan.label,
        gpuSeconds: plan.gpuSeconds,
        estimatedCostKrw: Math.round((plan.gpuSeconds / 3600) * GPU_KRW_PER_HOUR),
    };
};
