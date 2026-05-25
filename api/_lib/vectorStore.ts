import { prisma } from './prisma.js';

const MEMORY_ANALYSIS_CATS = ['swing_analysis', 'saju_analysis'];
const MAX_USER_MEMORIES = 100;

// ── UserMemory ──────────────────────────────────────────────────────────────

/**
 * 중복 기억 방지: 유사도 0.95 이상 기억이 있으면 false 반환.
 * 분석 카테고리는 중복 체크 없이 항상 저장.
 */
export async function saveMemoryIfNew(
    userId: number,
    content: string,
    embedding: number[] | null,
    category: string | null
): Promise<boolean> {
    const isAnalysis = category !== null && MEMORY_ANALYSIS_CATS.includes(category);

    if (!isAnalysis && embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        const similar = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "UserMemory"
             WHERE "userId" = $1 AND "embedding" IS NOT NULL
               AND "category" != ALL($3::text[])
               AND 1 - ("embedding" <=> $2::vector) > 0.95
             LIMIT 1`,
            userId, vectorStr, MEMORY_ANALYSIS_CATS
        );
        if (similar.length > 0) return false;
    }

    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
    await prisma.$queryRawUnsafe(
        `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
         VALUES ($1, $2, $3::vector, $4, NOW())`,
        userId, content, vectorStr, category
    );

    if (!isAnalysis) {
        const excess = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id FROM "UserMemory"
             WHERE "userId" = $1 AND ("category" IS NULL OR "category" != ALL($2::text[]))
             ORDER BY "createdAt" ASC
             OFFSET $3`,
            userId, MEMORY_ANALYSIS_CATS, MAX_USER_MEMORIES
        );
        if (excess.length > 0) {
            const ids = excess.map((r: any) => r.id);
            await prisma.$queryRawUnsafe(
                `DELETE FROM "UserMemory" WHERE "id" = ANY($1::int[])`,
                ids
            );
        }
    }

    return true;
}

/**
 * 분석 카테고리 기억 upsert: 기존 category 행 삭제 후 새로 삽입.
 */
export async function upsertAnalysisMemory(
    userId: number,
    content: string,
    embedding: number[] | null,
    category: string
): Promise<void> {
    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
    await prisma.$executeRawUnsafe(
        `DELETE FROM "UserMemory" WHERE "userId" = $1 AND "category" = $2`,
        userId, category
    );
    await prisma.$executeRawUnsafe(
        `INSERT INTO "UserMemory" ("userId","content","embedding","category","createdAt")
         VALUES ($1,$2,$3::vector,$4,NOW())`,
        userId, content, vectorStr, category
    );
}

export interface MemoryRow {
    id: number;
    content: string;
    category: string | null;
    similarity: number;
}

/**
 * 유사도 기반 기억 검색 (분석 카테고리 제외).
 */
export async function searchMemories(
    userId: number,
    embedding: number[],
    topK: number,
    minSimilarity: number,
    excludeCategories: string[] = MEMORY_ANALYSIS_CATS
): Promise<MemoryRow[]> {
    const vectorStr = `[${embedding.join(',')}]`;
    return prisma.$queryRawUnsafe<MemoryRow[]>(
        `SELECT "id", "content", "category",
                1 - ("embedding" <=> $2::vector) AS similarity
         FROM "UserMemory"
         WHERE "userId" = $1 AND "embedding" IS NOT NULL
           AND "category" != ALL($3::text[])
           AND 1 - ("embedding" <=> $2::vector) > $4
         ORDER BY "embedding" <=> $2::vector
         LIMIT $5`,
        userId, vectorStr, excludeCategories, minSimilarity, topK
    );
}

// ── PersonaKnowledge ────────────────────────────────────────────────────────

export interface KnowledgeRow {
    id: number;
    content: string;
    similarity: number;
}

/**
 * 페르소나 지식 유사도 검색.
 */
export async function searchKnowledge(
    personaId: string,
    embedding: number[],
    topK: number,
    minSimilarity: number
): Promise<KnowledgeRow[]> {
    const vectorStr = `[${embedding.join(',')}]`;
    return prisma.$queryRawUnsafe<KnowledgeRow[]>(
        `SELECT "id", "content",
                1 - ("embedding" <=> $2::vector) AS similarity
         FROM "PersonaKnowledge"
         WHERE "personaId" = $1 AND "embedding" IS NOT NULL
           AND 1 - ("embedding" <=> $2::vector) > $3
         ORDER BY "embedding" <=> $2::vector
         LIMIT $4`,
        personaId, vectorStr, minSimilarity, topK
    );
}

/**
 * 페르소나 지식 청크 저장.
 */
export async function insertKnowledgeChunk(
    personaId: string,
    sourceId: string,
    title: string | null,
    content: string,
    embedding: number[] | null
): Promise<void> {
    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
    await prisma.$queryRawUnsafe(
        `INSERT INTO "PersonaKnowledge" ("personaId", "sourceId", "title", "content", "embedding", "createdAt")
         VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
        personaId, sourceId, title, content, vectorStr
    );
}
