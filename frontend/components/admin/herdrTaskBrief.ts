export type ShortsHerdrBrief = {
    projectName: string;
    topic: string;
    scriptMode: 'ai' | 'direct';
    script: string;
    sceneCount: string;
    narrator: string;
    imageGenerator: 'z-image' | 'gemini';
    forbiddenFiles: string;
};

export type VideoHerdrBrief = {
    projectName: string;
    sourceImage: string;
    motion: string;
    duration: string;
    purpose: string;
    forbiddenFiles: string;
};

export const EMPTY_SHORTS_HERDR_BRIEF: ShortsHerdrBrief = {
    projectName: '', topic: '', scriptMode: 'ai', script: '', sceneCount: '7',
    narrator: '', imageGenerator: 'z-image', forbiddenFiles: 'frontend/App.tsx',
};

export const EMPTY_VIDEO_HERDR_BRIEF: VideoHerdrBrief = {
    projectName: '', sourceImage: '', motion: 'slow_push_in', duration: '3.375',
    purpose: '', forbiddenFiles: 'frontend/App.tsx',
};

export function isShortsHerdrBriefReady(b: ShortsHerdrBrief): boolean {
    return Boolean(b.projectName.trim() && b.topic.trim() && b.narrator.trim()
        && Number(b.sceneCount) >= 1 && (b.scriptMode === 'ai' || b.script.trim()));
}

export function isVideoHerdrBriefReady(b: VideoHerdrBrief): boolean {
    return Boolean(b.projectName.trim() && b.sourceImage.trim() && b.purpose.trim()
        && Number(b.duration) > 0);
}

export function buildShortsHerdrHandoff(b: ShortsHerdrBrief): string {
    return `# 쇼츠 제작 요청 — ${b.projectName.trim() || '이름 미정'}

## 제작 입력
- 소재: ${b.topic.trim() || '입력 필요'}
- 대본 방식: ${b.scriptMode === 'ai' ? 'AI 초안 작성' : '직접 입력 대본 사용'}
- 대본: ${b.scriptMode === 'ai' ? '(소재에 근거해 작성)' : (b.script.trim() || '입력 필요')}
- 장면 수: ${b.sceneCount}
- 화자: ${b.narrator.trim() || '입력 필요'}
- 이미지 생성기: ${b.imageGenerator === 'z-image' ? 'Z-Image' : 'Gemini'}

## 완료 조건
- 기존 쇼츠 제작 파이프라인을 재사용하고 새 파이프라인을 만들지 않는다.
- 세로 화면, 자막 안전영역, 음성·장면 싱크를 실제 결과물로 검증한다.
- 자동 업로드·외부 발행은 하지 않고 관리자 승인 가능한 결과까지만 만든다.

## 작업 경계
- 수정 금지 파일·경로: ${b.forbiddenFiles.trim() || '별도 지정 없음'}
`;
}

export function buildVideoHerdrHandoff(b: VideoHerdrBrief): string {
    return `# i2v 영상 제작 요청 — ${b.projectName.trim() || '이름 미정'}

## 제작 입력
- 원본 이미지 경로: ${b.sourceImage.trim() || '입력 필요'}
- 사용 목적: ${b.purpose.trim() || '입력 필요'}
- 움직임: ${b.motion}
- 길이: ${b.duration}초
- 모델: Wan 2.2 TI2V-5B

## 완료 조건
- 원본의 얼굴·표정·헤어·의상을 보존하고 카메라 중심의 절제된 움직임만 사용한다.
- 생성 전 예상 비용을 다시 알리고, 자동 배포·외부 발행은 하지 않는다.
- MP4 결과의 길이·해상도·재생 가능 여부를 검증한다.

## 작업 경계
- 수정 금지 파일·경로: ${b.forbiddenFiles.trim() || '별도 지정 없음'}
`;
}
