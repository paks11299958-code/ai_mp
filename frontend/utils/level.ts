export interface Stage {
    stage: number;
    name: string;
    description: string;
    minXp: number;
    color: string; // tailwind gradient text color
}

export const STAGES: Stage[] = [
    { stage: 1, name: '언어의 씨앗',   description: '이제 막 대화의 기초를 배우는 단계',                      minXp: 0,    color: 'from-gray-400 to-gray-300' },
    { stage: 2, name: '문장의 메아리', description: 'AI의 반응을 이끌어내기 시작한 단계',                      minXp: 30,   color: 'from-green-400 to-teal-400' },
    { stage: 3, name: '공명하는 펜',   description: 'AI와 매끄러운 티키타카가 가능한 단계',                    minXp: 150,  color: 'from-blue-400 to-cyan-400' },
    { stage: 4, name: '지식의 조각사', description: 'AI를 이용해 정보와 지식을 가공하는 단계',                  minXp: 500,  color: 'from-purple-400 to-indigo-400' },
    { stage: 5, name: '영혼의 투사자', description: 'AI에게 완벽한 페르소나를 부여해 살아있게 만드는 단계',    minXp: 1200, color: 'from-orange-400 to-rose-400' },
    { stage: 6, name: '진언의 지배자', description: '말 한마디로 시스템의 한계를 시험하는 전설적 존재',        minXp: 2500, color: 'from-yellow-300 to-amber-500' },
];

export function getStage(xp: number): Stage {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (xp >= STAGES[i].minXp) return STAGES[i];
    }
    return STAGES[0];
}

export function getStageProgress(xp: number): number {
    const current = getStage(xp);
    const idx = STAGES.findIndex(s => s.stage === current.stage);
    const next = STAGES[idx + 1];
    if (!next) return 100;
    return Math.floor(((xp - current.minXp) / (next.minXp - current.minXp)) * 100);
}

export function getXpToNextStage(xp: number): number {
    const current = getStage(xp);
    const idx = STAGES.findIndex(s => s.stage === current.stage);
    const next = STAGES[idx + 1];
    if (!next) return 0;
    return next.minXp - xp;
}
