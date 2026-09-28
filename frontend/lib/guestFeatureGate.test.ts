import { describe, expect, it } from 'vitest';
import { GUEST_FREE_FEATURE_KEYS, guestNoticeForFeature, isGuestFreeFeature } from './guestFeatureGate';

describe('비로그인 기능 유료/무료 판정', () => {
    it('무료 허용목록은 MenuLimit 실측값 3개뿐이다', () => {
        expect([...GUEST_FREE_FEATURE_KEYS].sort()).toEqual(['golf-course', 'lookalike', 'webtoon']);
    });

    it.each(['webtoon', 'lookalike', 'golf-course'])('%s 는 무료', key => {
        expect(isGuestFreeFeature(key)).toBe(true);
        expect(guestNoticeForFeature(key)).toBe('free');
    });

    it.each(['hair', 'outfit', 'news', 'stock', 'ebook', 'swing', 'tarot', 'reverse-prompt', 'luxury', 'siwoon', '없는키'])(
        '%s 는 유료(목록 밖은 전부 유료)', key => {
            expect(isGuestFreeFeature(key)).toBe(false);
            expect(guestNoticeForFeature(key)).toBe('paid');
        });
});
