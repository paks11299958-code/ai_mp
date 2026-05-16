export type Theme = 'lavender' | 'midnight' | 'rose';

export interface ThemeConfig {
    name: string;
    desc: string;
    swatches: string[];
    accent: string;
    accentLight: string;
    heroGradient: string;
}

export const THEMES: Record<Theme, ThemeConfig> = {
    lavender: {
        name: '라벤더',
        desc: '기본 · 보라+크림',
        swatches: ['#7c3aed', '#a78bfa', '#ede9fe'],
        accent: '#7c3aed',
        accentLight: '#a78bfa',
        heroGradient: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #1e1035 100%)',
    },
    midnight: {
        name: '미드나잇',
        desc: '다크 · 깊은 밤',
        swatches: ['#1e1b4b', '#3730a3', '#c7d2fe'],
        accent: '#4f46e5',
        accentLight: '#818cf8',
        heroGradient: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #1e1b4b 100%)',
    },
    rose: {
        name: '로즈',
        desc: '따뜻한 · 핑크+살구',
        swatches: ['#9f1239', '#f43f5e', '#fda4af'],
        accent: '#e11d48',
        accentLight: '#fb7185',
        heroGradient: 'linear-gradient(135deg, #4c0519 0%, #0f172a 55%, #500724 100%)',
    },
};
