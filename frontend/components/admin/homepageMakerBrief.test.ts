import { describe, expect, it } from 'vitest';
import {
    EMPTY_HOMEPAGE_MAKER_BRIEF,
    buildHomepageMakerHandoff,
    isHomepageMakerBriefReady,
} from './homepageMakerBrief';

describe('홈페이지 생성 메이커-체커 명세', () => {
    it('핵심 콘셉트 5개가 모두 있어야 준비 완료다', () => {
        expect(isHomepageMakerBriefReady(EMPTY_HOMEPAGE_MAKER_BRIEF)).toBe(false);
        expect(isHomepageMakerBriefReady({
            ...EMPTY_HOMEPAGE_MAKER_BRIEF,
            projectName: 'cube',
            brandMood: '고급스럽고 절제된 느낌',
            heroSummary: 'AI 서비스를 한눈에 보여준다',
            heroObject: '3×3×3 큐브',
            motionStory: '큐브가 펼쳐져 서비스 메뉴가 된다',
        })).toBe(true);
    });

    it('오퍼스 전달문에 제작·검토·승인 안전 경계를 포함한다', () => {
        const text = buildHomepageMakerHandoff({
            ...EMPTY_HOMEPAGE_MAKER_BRIEF,
            projectName: 'aiworld',
            brandMood: '프리미엄',
            heroSummary: 'AI 사업 구조',
            heroObject: '큐브',
            motionStory: '펼쳐져 메뉴가 됨',
        });
        expect(text).toContain('메이커가 제작하고 체커가');
        expect(text).toContain('승인 전에는 운영 도메인에 배포하지 않는다');
        expect(text).toContain('사실 정보는 제공되지 않았다면 만들지 않는다');
    });
});
