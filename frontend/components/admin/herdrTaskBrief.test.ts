import { describe, expect, it } from 'vitest';
import { EMPTY_SHORTS_HERDR_BRIEF, EMPTY_VIDEO_HERDR_BRIEF, buildShortsHerdrHandoff, buildVideoHerdrHandoff, isShortsHerdrBriefReady, isVideoHerdrBriefReady } from './herdrTaskBrief';

describe('허드 미디어 명세', () => {
    it('쇼츠 필수값과 직접 입력 대본을 검증한다', () => {
        expect(isShortsHerdrBriefReady(EMPTY_SHORTS_HERDR_BRIEF)).toBe(false);
        const base={...EMPTY_SHORTS_HERDR_BRIEF,projectName:'뉴스',topic:'AI 뉴스',narrator:'Leda'};
        expect(isShortsHerdrBriefReady(base)).toBe(true);
        expect(isShortsHerdrBriefReady({...base,scriptMode:'direct',script:''})).toBe(false);
        expect(buildShortsHerdrHandoff(base)).toContain('자동 업로드·외부 발행은 하지 않고');
    });

    it('영상은 원본·목적·길이가 필요하고 비용 재확인을 명시한다', () => {
        const ready={...EMPTY_VIDEO_HERDR_BRIEF,projectName:'오프닝',sourceImage:'/tmp/source.png',purpose:'쇼츠 도입'};
        expect(isVideoHerdrBriefReady(EMPTY_VIDEO_HERDR_BRIEF)).toBe(false);
        expect(isVideoHerdrBriefReady(ready)).toBe(true);
        expect(buildVideoHerdrHandoff(ready)).toContain('생성 전 예상 비용을 다시 알리고');
    });
});
