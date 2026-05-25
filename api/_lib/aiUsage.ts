import { prisma } from './prisma.js';

const COST_PER_1K: Record<string, { input: number; output: number }> = {
    'gpt-4o':            { input: 0.0025,  output: 0.010 },
    'gpt-4o-mini':       { input: 0.00015, output: 0.0006 },
    'gpt-4-turbo':       { input: 0.010,   output: 0.030 },
    'gpt-4':             { input: 0.030,   output: 0.060 },
    'gpt-3.5-turbo':     { input: 0.0005,  output: 0.0015 },
    'claude-opus-4':     { input: 0.015,   output: 0.075 },
    'claude-sonnet-4-5': { input: 0.003,   output: 0.015 },
    'claude-haiku-4-5':  { input: 0.0008,  output: 0.004 },
    'gemini-2.0-flash':  { input: 0.00010, output: 0.00040 },
    'gemini-1.5-pro':    { input: 0.00125, output: 0.005 },
};

export function calcCost(model: string, promptTokens: number, completionTokens: number): number {
    const key = Object.keys(COST_PER_1K).find(k => model.toLowerCase().includes(k));
    if (!key) return 0;
    const r = COST_PER_1K[key];
    return (promptTokens / 1000) * r.input + (completionTokens / 1000) * r.output;
}

export async function logAiUsage(params: {
    service: 'openai' | 'anthropic' | 'gemini';
    model: string;
    feature: string;
    promptTokens: number;
    completionTokens: number;
    userId?: number;
}): Promise<void> {
    try {
        const totalTokens = params.promptTokens + params.completionTokens;
        const costUsd = calcCost(params.model, params.promptTokens, params.completionTokens);
        await (prisma as any).aiUsageLog.create({
            data: {
                service: params.service,
                model: params.model,
                feature: params.feature,
                promptTokens: params.promptTokens,
                completionTokens: params.completionTokens,
                totalTokens,
                costUsd,
                userId: params.userId ?? null,
            },
        });
    } catch (e) {
        console.error('[aiUsage] 로그 저장 실패:', e);
    }
}
