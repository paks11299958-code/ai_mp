import { EUNBI_ID } from './personaEmotion';

export interface EntryChatTheme {
    personaId: string;
    displayName: string;
    fallbackPortrait: string;
    accent: string;
    visualPreset?: 'letter' | 'studio' | 'golf';
    headerCaption?: string;
}

export const ARIN_ID = 'cmon1gg3z000104k2p802tp44';

export const DOGYEOL_ID = 'cmopfkd4o000004la2q5p3nle';

export const SEOLA_ID = 'custom-1777217377681';
export const entryChatHasFeatureMenu = (theme?: EntryChatTheme) => theme?.visualPreset === 'studio' || theme?.visualPreset === 'golf';

export const ENTRY_CHAT_THEMES: Record<string, EntryChatTheme> = {
    [SEOLA_ID]: { personaId: SEOLA_ID, displayName: '설아', fallbackPortrait: '/seola/chat-portrait.webp', accent: '#d8ba81', visualPreset: 'golf' },
    [ARIN_ID]: { personaId: ARIN_ID, displayName: '이아린', fallbackPortrait: '/arin/arin-bust.webp', accent: '#674255', visualPreset: 'studio' },
    [DOGYEOL_ID]: { personaId: DOGYEOL_ID, displayName: '도결 선생', fallbackPortrait: '/dogyeol/portrait.webp', accent: '#22324A', visualPreset: 'letter', headerCaption: '道潔 선생의 서재' },
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
