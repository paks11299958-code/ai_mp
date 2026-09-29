import { describe, expect, it } from 'vitest';
import { EUNBI_ID } from './personaEmotion';
import { entryStartDestination, getEntryChatTheme } from './entryChatThemes';

describe('entry chat themes', () => {
    it('은비 테마만 등록되어 있다', () => {
        expect(getEntryChatTheme(EUNBI_ID)?.displayName).toBe('신은비');
        expect(getEntryChatTheme('not-registered')).toBeUndefined();
    });

    it('기능 키 없는 은비만 모달, 기능 키나 미등록 페르소나는 기존 채팅 경로다', () => {
        expect(entryStartDestination(EUNBI_ID)).toBe('modal');
        expect(entryStartDestination(EUNBI_ID, 'tarot')).toBe('chat');
        expect(entryStartDestination('not-registered')).toBe('chat');
    });
});
