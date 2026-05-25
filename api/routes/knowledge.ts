import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { getTokenFromRequest, verifyToken } from '../_lib/auth.js';
import { generateEmbedding } from '../_lib/embedding.js';
import { insertKnowledgeChunk, searchKnowledge } from '../_lib/vectorStore.js';
import { uploadToGCS } from '../_lib/storage.js';
import { compareDocuments } from '../_lib/gemini.js';
import crypto from 'crypto';

function chunkText(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
    const chunks: string[] = [];
    for (const para of paragraphs) {
        if (para.length <= 600) {
            chunks.push(para);
        } else {
            let i = 0;
            while (i < para.length) {
                chunks.push(para.slice(i, i + 600));
                i += 600 - 50;
            }
        }
    }
    return chunks;
}

export async function handler(
    req: VercelRequest,
    res: VercelResponse,
    seg1: string | undefined,
    seg2: string | undefined,
) {
    // knowledge 엔드포인트는 admin 전용 — requireAdmin이 인증도 처리
    const requireAdmin = async (): Promise<number | null> => {
        const token = getTokenFromRequest(req);
        if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
        return userId;
    };

        // POST /api/knowledge — 텍스트 업로드 → 중복 제목 비교 → 청크 분할 → 임베딩 → 저장
        if (req.method === 'POST' && !seg1) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { personaId, title, text } = req.body;
                if (!personaId || !text) return res.status(400).json({ error: 'personaId와 text는 필수입니다.' });

                let isReplaced = false;
                // 같은 제목의 문서가 이미 있으면 Gemini로 품질 비교
                if (title) {
                    const existing = await prisma.$queryRawUnsafe<{ sourceId: string; fullText: string }[]>(
                        `SELECT "sourceId", STRING_AGG("content", E'\n\n' ORDER BY "id") AS "fullText"
                         FROM "PersonaKnowledge"
                         WHERE "personaId" = $1 AND "title" = $2
                         GROUP BY "sourceId" LIMIT 1`,
                        personaId, title
                    );
                    if (existing.length > 0) {
                        const winner = await compareDocuments(existing[0].fullText, text);
                        if (winner === 'OLD') {
                            return res.status(200).json({ saved: 0, total: 0, action: 'kept_existing', message: '기존 문서가 더 품질이 높아 유지했습니다.' });
                        }
                        // 새 문서가 더 나음 → 기존 삭제 후 교체
                        await prisma.personaKnowledge.deleteMany({ where: { sourceId: existing[0].sourceId } });
                        isReplaced = true;
                    }
                }

                const sourceId = crypto.randomUUID();
                const chunks = chunkText(text);
                let saved = 0;
                for (const content of chunks) {
                    const embedding = await generateEmbedding(content);
                    await insertKnowledgeChunk(personaId, sourceId, title || null, content, embedding);
                    saved++;
                }
                return res.status(201).json({ saved, total: chunks.length, sourceId, action: isReplaced ? 'replaced' : 'created' });
            } catch (e: any) {
                console.error('[knowledge POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/knowledge/:personaId — 문서 단위 목록 (sourceId 기준 그룹)
        if (req.method === 'GET' && seg1) {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const list = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "sourceId", "title",
                            COUNT(*)::int AS "chunkCount",
                            LEFT(MIN("content"), 100) AS "preview",
                            MIN("createdAt") AS "createdAt"
                     FROM "PersonaKnowledge"
                     WHERE "personaId" = $1
                     GROUP BY "sourceId", "title"
                     ORDER BY MIN("createdAt") DESC`,
                    seg1
                );
                return res.status(200).json(list);
            } catch (e: any) {
                console.error('[knowledge GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/knowledge/source/:sourceId — 문서 단위 전체 삭제
        if (req.method === 'DELETE' && seg1 === 'source' && seg2) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { count } = await prisma.personaKnowledge.deleteMany({ where: { sourceId: seg2 } });
                return res.status(200).json({ message: '삭제 완료', deleted: count });
            } catch (e: any) {
                console.error('[knowledge DELETE source]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/knowledge/:id — 청크 단건 삭제 (하위 호환)
        if (req.method === 'DELETE' && seg1) {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                await prisma.personaKnowledge.delete({ where: { id: Number(seg1) } });
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[knowledge DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/knowledge/search — 채팅 시 관련 지식 검색
        if (req.method === 'POST' && seg1 === 'search') {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                verifyToken(token);
                const { personaId, query } = req.body;
                if (!personaId || !query) return res.status(400).json({ error: 'personaId와 query는 필수입니다.' });
                const embedding = await generateEmbedding(query);
                if (!embedding) return res.status(200).json([]);
                const results = await searchKnowledge(personaId, embedding, 3, 0.70);
                return res.status(200).json(results);
            } catch (e: any) {
                console.error('[knowledge search]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }
