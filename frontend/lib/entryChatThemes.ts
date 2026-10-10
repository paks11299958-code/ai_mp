import { CHAERIN_ID } from '../components/persona/chaerinMenu';
import { EUNBI_ID } from './personaEmotion';

export interface EntryChatTheme {
    personaId: string;
    displayName: string;
    fallbackPortrait: string;
    accent: string;
    visualPreset?: 'letter' | 'studio' | 'golf' | 'beauty' | 'desk' | 'study' | 'showroom';
    headerCaption?: string;
}

export const CHAEWON_ID = 'cmois970w0000xsvie6aag2f5';

export const ARIN_ID = 'cmon1gg3z000104k2p802tp44';

export const DOGYEOL_ID = 'cmopfkd4o000004la2q5p3nle';

export const SEOLA_ID = 'custom-1777217377681';
export const entryChatHasFeatureMenu = (theme?: EntryChatTheme) =>
    theme?.visualPreset === 'desk' || theme?.visualPreset === 'studio' || theme?.visualPreset === 'golf' || theme?.visualPreset === 'beauty' || theme?.visualPreset === 'showroom';

let hajinTheme: EntryChatTheme | undefined;

/** 박하진 id와 프로필은 DB의 guide가 정본이라 진입 CTA 직전에 등록한다. App 수정 없이 기존 전용 채팅 경로를 쓴다. */
export const registerHajinEntryChatTheme = (personaId?: string, portrait?: string) => {
    if (!personaId) return;
    hajinTheme = {
        personaId, displayName: '박하진', fallbackPortrait: portrait || '', accent: '#5C6AC4', visualPreset: 'showroom',
    };
};

export const ENTRY_CHAT_THEMES: Record<string, EntryChatTheme> = {
    ['learning-coach']: {
        personaId: 'learning-coach', displayName: 'AI 학습코칭',
        fallbackPortrait: '', accent: '#2b5948', visualPreset: 'study',
    },
    [CHAEWON_ID]: {
        personaId: CHAEWON_ID,
        displayName: '윤채원',
        fallbackPortrait: '',
        accent: '#8eddd6',
        visualPreset: 'desk',
    },
    [CHAERIN_ID]: {
        personaId: CHAERIN_ID,
        displayName: '윤채린',
        fallbackPortrait: '/chaerin/clinic/hero_chaerin.jpg',
        accent: '#855b51',
        visualPreset: 'beauty',
    },
    [SEOLA_ID]: {
        personaId: SEOLA_ID,
        displayName: '설아',
        fallbackPortrait: '/seola/chat-portrait.webp',
        accent: '#d8ba81',
        visualPreset: 'golf',
    },
    [ARIN_ID]: {
        personaId: ARIN_ID,
        displayName: '이아린',
        fallbackPortrait: '/arin/arin-bust.webp',
        accent: '#674255',
        visualPreset: 'studio',
    },
    [DOGYEOL_ID]: {
        personaId: DOGYEOL_ID,
        displayName: '도결 선생',
        fallbackPortrait: '/dogyeol/portrait.webp',
        accent: '#22324A',
        visualPreset: 'letter',
        headerCaption: '道潔 선생의 서재',
    },
    [EUNBI_ID]: {
        personaId: EUNBI_ID,
        displayName: '신은비',
        fallbackPortrait: '/eunbi/emo/greeting.jpg',
        accent: '#E8467F',
    },
};

export const getEntryChatTheme = (personaId: string | undefined): EntryChatTheme | undefined =>
    personaId ? ENTRY_CHAT_THEMES[personaId] || (hajinTheme?.personaId === personaId ? hajinTheme : undefined) : undefined;

/** 진입 CTA의 기존 기능 키 경로와 새 테마 채팅 경로를 한 곳에서 결정한다. */
export const entryStartDestination = (personaId: string | undefined, runKey?: string) =>
    !runKey && getEntryChatTheme(personaId) ? ('modal' as const) : ('chat' as const);
