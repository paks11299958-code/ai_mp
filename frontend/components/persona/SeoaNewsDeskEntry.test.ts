import { describe, expect, it } from 'vitest';
import { buildNewsCostNotice, buildNewsTtsUrl, formatAudioTime, selectHeadlineCue } from './SeoaNewsDeskEntry';

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

    it('재생 시간을 분:초로 안전하게 표시한다', () => {
        expect(formatAudioTime(65.9)).toBe('1:05');
        expect(formatAudioTime(Number.NaN)).toBe('0:00');
    });

    it('재생 위치에 맞는 무료 제목 자막만 고른다', () => {
        const cues = [
            { title: '첫 제목', at: 0.05 },
            { title: '둘째 제목', at: 0.25 },
        ];
        expect(selectHeadlineCue(cues, 0)).toBe('첫 제목');
        expect(selectHeadlineCue(cues, 0.3)).toBe('둘째 제목');
        expect(selectHeadlineCue(cues, Number.NaN)).toBe('첫 제목');
        expect(selectHeadlineCue([], 0.5)).toBe('');
    });
});
