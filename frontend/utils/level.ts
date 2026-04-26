const XP_PER_LEVEL = 15;
const MAX_LEVEL = 100;
const RANK_START_XP = MAX_LEVEL * XP_PER_LEVEL; // 1500 XP

export function getLevel(xp: number): number {
    return Math.min(MAX_LEVEL, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function getLevelProgress(xp: number): number {
    if (xp >= RANK_START_XP) return 100;
    return Math.floor((xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100);
}

export function getXpToNextLevel(xp: number): number {
    if (xp >= RANK_START_XP) return 0;
    return XP_PER_LEVEL - (xp % XP_PER_LEVEL);
}

const RANKS = [
    { name: '원사', xp: 18000 },
    { name: '상사', xp: 13000 },
    { name: '중사', xp:  9000 },
    { name: '하사', xp:  6000 },
    { name: '병장', xp:  4000 },
    { name: '상병', xp:  2500 },
    { name: '일병', xp: RANK_START_XP },
];

export function getRank(xp: number): string | null {
    if (xp < RANK_START_XP) return null;
    for (const r of RANKS) {
        if (xp >= r.xp) return r.name;
    }
    return null;
}

export function getLevelDisplay(xp: number): string {
    const rank = getRank(xp);
    return rank ?? `Lv.${getLevel(xp)}`;
}
