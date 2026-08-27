export type ResearchWorkType = 'simple' | 'feature' | 'risk' | 'homepage';

export interface ResearchDevBrief {
    workType: ResearchWorkType;
    title: string;
    target: string;
    forbiddenFiles: string;
    constraints: string;
    changeTarget: string;
    desiredResult: string;
    featurePurpose: string;
    userFlow: string;
    inputsOutputs: string;
    riskAreas: string;
    dataImpact: string;
    recoveryPlan: string;
    securityRules: string;
    testEnvironment: string;
    productionChange: string;
    sitePurpose: string;
    audience: string;
    desiredMood: string;
    avoidMood: string;
    keyMessage: string;
    visualSystem: string;
    sections: string;
    references: string;
    mediaDirection: string;
    mobileDirection: string;
    contentSource: string;
    desiredDomain: string;
    completionCriteria: string;
}

export const EMPTY_RESEARCH_DEV_BRIEF: ResearchDevBrief = {
    workType: 'feature', title: '', target: '', forbiddenFiles: '', constraints: '',
    changeTarget: '', desiredResult: '', featurePurpose: '', userFlow: '', inputsOutputs: '',
    riskAreas: '', dataImpact: '', recoveryPlan: '', securityRules: '', testEnvironment: '서버2',
    productionChange: '사장 승인 전 운영 반영 금지', sitePurpose: '', audience: '', desiredMood: '',
    avoidMood: '', keyMessage: '', visualSystem: '', sections: '', references: '', mediaDirection: '',
    mobileDirection: '', contentSource: '', desiredDomain: '', completionCriteria: '',
};

export const RESEARCH_WORK_TYPES: Array<{ key: ResearchWorkType; label: string; summary: string }> = [
    { key: 'simple', label: '1. 단순 문구·관리 화면', summary: 'Codex 단독 · Claude 검토 OFF' },
    { key: 'feature', label: '2. 일반 기능', summary: 'Claude 명세 · Codex 구현 · 자동 테스트' },
    { key: 'risk', label: '3. 위험 기능', summary: 'Claude 명세 · Codex 구현 · Claude diff 검토' },
    { key: 'homepage', label: '4. 홈페이지·랜딩', summary: '화면 캡처 · Claude 시각 검토 · 사장 승인' },
];

export const TYPE_FIELDS: Record<ResearchWorkType, Array<keyof ResearchDevBrief>> = {
    simple: ['changeTarget', 'desiredResult'],
    feature: ['featurePurpose', 'userFlow', 'inputsOutputs', 'completionCriteria'],
    risk: ['featurePurpose', 'userFlow', 'riskAreas', 'dataImpact', 'recoveryPlan', 'securityRules', 'testEnvironment', 'productionChange', 'completionCriteria'],
    homepage: ['sitePurpose', 'audience', 'desiredMood', 'avoidMood', 'keyMessage', 'visualSystem', 'sections', 'references', 'mediaDirection', 'mobileDirection', 'contentSource', 'desiredDomain', 'completionCriteria'],
};

const REQUIRED: Record<ResearchWorkType, Array<keyof ResearchDevBrief>> = {
    simple: ['title', 'target', 'changeTarget', 'desiredResult'],
    feature: ['title', 'target', 'featurePurpose', 'userFlow', 'inputsOutputs', 'completionCriteria'],
    risk: ['title', 'target', 'featurePurpose', 'userFlow', 'riskAreas', 'dataImpact', 'recoveryPlan', 'securityRules', 'testEnvironment', 'productionChange', 'completionCriteria'],
    homepage: ['title', 'target', 'sitePurpose', 'audience', 'desiredMood', 'avoidMood', 'keyMessage', 'visualSystem', 'sections', 'mobileDirection', 'completionCriteria'],
};

const FIELD_LABELS: Partial<Record<keyof ResearchDevBrief, string>> = {
    changeTarget: '변경할 문구·관리 화면', desiredResult: '원하는 결과', featurePurpose: '기능 목적',
    userFlow: '사용자 동작', inputsOutputs: '입력과 출력', riskAreas: '위험 영역',
    dataImpact: '기존 데이터 영향', recoveryPlan: '실패 시 복구 방법', securityRules: '보안·권한 조건',
    testEnvironment: '테스트 환경', productionChange: '운영 반영 여부', sitePurpose: '사이트 목적',
    audience: '대상 고객', desiredMood: '원하는 분위기', avoidMood: '피해야 할 분위기',
    keyMessage: '핵심 메시지', visualSystem: '색상·폰트·여백', sections: '섹션과 순서',
    references: '참고 사이트', mediaDirection: '이미지·영상·애니메이션', mobileDirection: '모바일 연출 기준',
    contentSource: '기존 콘텐츠 출처', desiredDomain: '희망 도메인', completionCriteria: '완료 조건',
};

export function getResearchDevPolicy(workType: ResearchWorkType) {
    if (workType === 'simple') return { useClaudeSpec: false, useClaudeReview: false, reviewEvidence: '자동 테스트 결과' };
    if (workType === 'feature') return { useClaudeSpec: true, useClaudeReview: false, reviewEvidence: '자동 테스트 결과' };
    if (workType === 'risk') return { useClaudeSpec: true, useClaudeReview: true, reviewEvidence: '최종 명세 + git diff + 완료 조건' };
    return { useClaudeSpec: true, useClaudeReview: true, reviewEvidence: '최종 명세 + git diff + 390px·820px·1440px 실제 화면 캡처' };
}

export function isResearchDevBriefReady(brief: ResearchDevBrief): boolean {
    return REQUIRED[brief.workType].every(key => String(brief[key]).trim().length > 0);
}

const line = (label: string, value: string, fallback = '별도 지정 없음') => `- ${label}: ${value.trim() || fallback}`;

export function buildResearchDevHandoff(brief: ResearchDevBrief): string {
    const type = RESEARCH_WORK_TYPES.find(item => item.key === brief.workType)!;
    const policy = getResearchDevPolicy(brief.workType);
    const details = TYPE_FIELDS[brief.workType].map(key => line(FIELD_LABELS[key] || String(key), String(brief[key]))).join('\n');
    const homepageRules = brief.workType === 'homepage' ? `
## 홈페이지 전용 검수
- 실제 렌더링을 390px·820px·1440px에서 캡처한다.
- Claude는 최종 명세, git diff, 세 화면 캡처로 시각 검토한다.
- Claude 통과 뒤에도 사장 승인 전에는 배포하지 않는다.` : '';

    return `# 리서치 개발 요청 — ${brief.title.trim() || '제목 입력 필요'}

## 작업 유형과 실행 정책
- 유형: ${type.label}
- 실행: ${type.summary}
- Claude 최종 명세: ${policy.useClaudeSpec ? '사용' : '생략'}
- Claude 사후 검토: ${policy.useClaudeReview ? '사용' : '생략'}
- 검토 근거: ${policy.reviewEvidence}

## 공통 요구사항
${line('대상 저장소·화면', brief.target, '입력 필요')}
${line('수정 금지 파일·경로', brief.forbiddenFiles)}
${line('추가 제약조건', brief.constraints)}

## 유형별 요구사항
${details}
${homepageRules}

## 실행 경계
- 허드는 항상 사용하며 작업 유형에 따라 Claude 검토만 자동 결정한다.
- 개발 시작 전 최종 명세를 사장이 확인한다.
- 승인 전에는 운영 배포, DNS 변경, 외부 발행을 하지 않는다.
- Claude 체커는 저장소 전체를 재조사하지 않고 최종 명세, git diff, 완료 조건만 검토한다.
`;
}
