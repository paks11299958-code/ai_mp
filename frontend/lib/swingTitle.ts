import type { SwingAnalysis } from '../types';
export const validSwingScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const order = ['어드레스', '백스윙', '다운스윙', '임팩트', '팔로우'];
export const weakestSwingSection = (analysis?: Partial<SwingAnalysis> | null) => [...(analysis?.sections || [])].filter(s => s.name?.trim() && validSwingScore(s.score)).sort((a,b) => a.score-b.score || (order.findIndex(n=>a.name.includes(n)) < 0 ? 99 : order.findIndex(n=>a.name.includes(n))) - (order.findIndex(n=>b.name.includes(n)) < 0 ? 99 : order.findIndex(n=>b.name.includes(n))) || a.name.localeCompare(b.name,'ko'))[0];
export function swingTitle(record: { title?: string | null; analysis?: Partial<SwingAnalysis> | null; fileName?: string }): string {
    const title = record.title?.trim();
    if (title && !/^스윙 분석 \d{4}\. \d{1,2}\. \d{1,2}\.?$/.test(title)) return title;
    const analysis = record.analysis;
    const score = validSwingScore(analysis?.overallScore) ? ` · ${analysis.overallScore}점` : '';
    const section = weakestSwingSection(analysis);
    if (section) return `${section.name.trim()} 점검${score}`;
    const priority = analysis?.topPriorities?.find(p => p?.trim());
    if (priority) return `${Array.from(priority.trim()).slice(0,36).join('')}${score}`;
    return score ? `스윙 점검${score}` : '스윙 점검 기록';
}
