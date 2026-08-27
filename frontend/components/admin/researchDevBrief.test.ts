import { describe, expect, it } from 'vitest';
import {
    EMPTY_RESEARCH_DEV_BRIEF,
    buildResearchDevHandoff,
    getResearchDevPolicy,
    isResearchDevBriefReady,
    type ResearchDevBrief,
} from './researchDevBrief';

const complete = (overrides: Partial<ResearchDevBrief> = {}): ResearchDevBrief => ({
    ...EMPTY_RESEARCH_DEV_BRIEF,
    title: '회원 알림 기능',
    target: 'ai_mp 관리자 화면',
    featurePurpose: '관리자가 실패 알림을 확인한다',
    userFlow: '목록에서 실패 건을 열어 원인을 본다',
    inputsOutputs: '작업 ID 입력, 실패 원인 출력',
    completionCriteria: '테스트와 타입 검사 통과',
    ...overrides,
});

describe('리서치 개발 작업 유형 명세', () => {
    it('선택한 유형의 필수 입력만 검사한다', () => {
        expect(isResearchDevBriefReady(EMPTY_RESEARCH_DEV_BRIEF)).toBe(false);
        expect(isResearchDevBriefReady(complete())).toBe(true);
        expect(isResearchDevBriefReady(complete({ workType: 'risk', riskAreas: '' }))).toBe(false);
    });

    it('위험 기능은 Claude diff 검토를 자동으로 켠다', () => {
        const policy = getResearchDevPolicy('risk');
        expect(policy.useClaudeSpec).toBe(true);
        expect(policy.useClaudeReview).toBe(true);
        expect(policy.reviewEvidence).toContain('git diff');
    });

    it('홈페이지는 세 화면 캡처와 사장 승인을 완료 조건에 넣는다', () => {
        const text = buildResearchDevHandoff(complete({
            workType: 'homepage',
            title: 'AINARA 랜딩',
            sitePurpose: '서비스 소개와 상담 전환',
            audience: '중소기업 대표',
            desiredMood: '고급스럽고 미래적',
            avoidMood: '흔한 SaaS 템플릿',
            keyMessage: 'AI 도입을 한 번에',
            visualSystem: '짙은 남색, 넓은 여백, 굵은 제목',
            sections: '히어로, 서비스, 사례, 상담 CTA',
            mobileDirection: '핵심 모션만 유지',
            completionCriteria: '가로 스크롤과 콘솔 오류 없음',
        }));
        expect(text).toContain('390px·820px·1440px');
        expect(text).toContain('Claude 시각 검토');
        expect(text).toContain('사장 승인 전에는 배포하지 않는다');
    });

    it('단순 작업은 Claude 명세와 사후 검토를 끈다', () => {
        const policy = getResearchDevPolicy('simple');
        expect(policy.useClaudeSpec).toBe(false);
        expect(policy.useClaudeReview).toBe(false);
    });
});
