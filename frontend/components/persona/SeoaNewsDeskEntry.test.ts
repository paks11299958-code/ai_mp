import { describe, expect, it } from 'vitest';
import { buildNewsTtsUrl } from './SeoaNewsDeskEntry';

describe('buildNewsTtsUrl', () => {
    it('오늘 생성된 슬롯을 TTS 요청에 포함한다', () => {
        expect(buildNewsTtsUrl('국내뉴스', 'am')).toBe(
            '/api/news/tts?category=%EA%B5%AD%EB%82%B4%EB%89%B4%EC%8A%A4&slot=am',
        );
    });
});
