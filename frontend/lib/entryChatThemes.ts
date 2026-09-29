import { EUNBI_ID } from './personaEmotion';

export interface EntryChatTheme {
    personaId: string;
    displayName: string;
    fallbackPortrait: string;
    accent: string;
}

export const ENTRY_CHAT_THEMES: Record<string, EntryChatTheme> = {
    [EUNBI_ID]: {
        personaId: EUNBI_ID,
        displayName: '신은비',
        fallbackPortrait: '/eunbi/emo/greeting.jpg',
        accent: '#E8467F',
    },
};

export const getEntryChatTheme = (personaId: string | undefined): EntryChatTheme | undefined =>
    personaId ? ENTRY_CHAT_THEMES[personaId] : undefined;

/** 진입 CTA의 기존 기능 키 경로와 새 테마 채팅 경로를 한 곳에서 결정한다. */
export const entryStartDestination = (personaId: string | undefined, runKey?: string) =>
    !runKey && getEntryChatTheme(personaId) ? 'modal' as const : 'chat' as const;
