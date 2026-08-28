import { describe, expect, it } from 'vitest';
import { buildNewsCostNotice, buildNewsTtsUrl } from './SeoaNewsDeskEntry';

describe('buildNewsTtsUrl', () => {
    it('오늘 생성된 슬롯을 TTS 요청에 포함한다', () => {
        expect(buildNewsTtsUrl('국내뉴스', 'am')).toBe(
            '/api/news/tts?category=%EA%B5%AD%EB%82%B4%EB%89%B4%EC%8A%A4&slot=am',
        );
    });

    it('본문 조회만 유료이고 TTS 듣기는 무료라고 안내한다', () => {
        expect(buildNewsCostNotice(50)).toBe('글로 볼 때만 50P가 차감되고, ▶ 듣기는 무료예요.');
        expect(buildNewsCostNotice(null)).toBe('글로 볼 때만 포인트가 차감되고, ▶ 듣기는 무료예요.');
    });
});
