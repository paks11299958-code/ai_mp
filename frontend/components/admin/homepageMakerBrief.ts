export interface HomepageMakerBrief {
    projectName: string;
    brandMood: string;
    heroSummary: string;
    heroObject: string;
    motionStory: string;
    contentSource: string;
    mustKeep: string;
    desiredDomain: string;
}

export const EMPTY_HOMEPAGE_MAKER_BRIEF: HomepageMakerBrief = {
    projectName: '',
    brandMood: '',
    heroSummary: '',
    heroObject: '',
    motionStory: '',
    contentSource: '',
    mustKeep: '',
    desiredDomain: '',
};

export const REQUIRED_HOMEPAGE_MAKER_FIELDS: (keyof HomepageMakerBrief)[] = [
    'projectName', 'brandMood', 'heroSummary', 'heroObject', 'motionStory',
];

export function isHomepageMakerBriefReady(brief: HomepageMakerBrief): boolean {
    return REQUIRED_HOMEPAGE_MAKER_FIELDS.every(key => brief[key].trim().length > 0);
}

function valueOrFallback(value: string, fallback: string): string {
    return value.trim() || fallback;
}

export function buildHomepageMakerHandoff(brief: HomepageMakerBrief): string {
    return `# 홈페이지 생성 요청 — ${valueOrFallback(brief.projectName, '이름 미정')}

## 핵심 콘셉트
- 원하는 느낌: ${valueOrFallback(brief.brandMood, '입력 필요')}
- 히어로 한 줄: ${valueOrFallback(brief.heroSummary, '입력 필요')}
- 핵심 오브젝트: ${valueOrFallback(brief.heroObject, '입력 필요')}
- 움직임과 콘텐츠 연결: ${valueOrFallback(brief.motionStory, '입력 필요')}

## 콘텐츠
- 기존 내용 출처: ${valueOrFallback(brief.contentSource, '없음 — 사실 정보는 사용자 확인 전 지어내지 말 것')}
- 반드시 유지할 내용: ${valueOrFallback(brief.mustKeep, '별도 지정 없음')}
- 희망 도메인: ${valueOrFallback(brief.desiredDomain, '배포 전 확인')}

## 제작 방식
1. 강한 시각 콘셉트 하나를 히어로의 중심으로 삼는다.
2. 오브젝트의 움직임이 다음 콘텐츠 또는 메뉴로 자연스럽게 이어지게 한다.
3. 메이커가 제작하고 체커가 데스크톱·모바일·reduced-motion·접근성·콘솔 오류를 검토한다.
4. 체커 지적을 반영한 뒤 미리보기를 사용자에게 제시하고, 승인 전에는 운영 도메인에 배포하지 않는다.

## 안전 경계
- 연락처·주소·가격·실적 등 사실 정보는 제공되지 않았다면 만들지 않는다.
- 기존 사이트·DNS 레코드를 수정하거나 삭제하지 않는다.
- 새 독립 도메인은 승인 후 신규 레코드 추가 방식으로만 연결한다.
`;
}
