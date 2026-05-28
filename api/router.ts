import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from './_lib/prisma.js';
import { getTokenFromRequest, verifyToken, requireAuth } from './_lib/auth.js';
import { sendEmail } from './_lib/email.js';
import { generateEmbedding } from './_lib/embedding.js';
import { extractMemories, generateSummary, extractTriggerKeywords, analyzeGolfSwing, compareDocuments, analyzeFaceReading, generateQuickMenuResult } from './_lib/gemini.js';
import { uploadToGCS, deleteFromGCS, generateSignedUrl } from './_lib/storage.js';
import { saveMemoryIfNew, upsertAnalysisMemory, searchMemories } from './_lib/vectorStore.js';
import * as authRoute from './routes/auth.js';
import * as personasRoute from './routes/personas.js';
import * as sessionsRoute from './routes/sessions.js';
import * as knowledgeRoute from './routes/knowledge.js';
import * as pointsRoute from './routes/points.js';


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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const domain = req.query.d as string;
    const seg1 = req.query.s1 as string | undefined;
    const seg2 = req.query.s2 as string | undefined;
    const seg3 = req.query.s3 as string | undefined;

    // ── Auth ──────────────────────────────────────────────────

    if (domain === 'auth') {
        return authRoute.handler(req, res, seg1);
    }

    // ── Categories ────────────────────────────────────────────
    if (domain === 'categories') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/categories (public)
        if (!seg1 && req.method === 'GET') {
            try {
                const categories = await prisma.category.findMany({
                    orderBy: { order: 'asc' },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
                return res.status(200).json(categories);
            } catch (e: any) {
                console.error('[categories GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/categories
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, order } = req.body;
                if (!name?.trim()) return res.status(400).json({ error: '카테고리 이름은 필수입니다.' });
                const count = await prisma.category.count();
                const category = await prisma.category.create({
                    data: { name: name.trim(), order: order ?? count },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                return res.status(201).json(category);
            } catch (e: any) {
                if (e.code === 'P2002') return res.status(400).json({ error: '이미 존재하는 카테고리 이름입니다.' });
                console.error('[categories POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/categories/:id
        if (seg1 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { name, order } = req.body;
                const category = await prisma.category.update({
                    where: { id: Number(seg1) },
                    data: { ...(name !== undefined && { name: name.trim() }), ...(order !== undefined && { order }) },
                    include: { _count: { select: { personas: { where: { isVisible: true } } } } },
                });
                return res.status(200).json(category);
            } catch (e: any) {
                console.error('[categories PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/categories/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const catId = Number(seg1);
                await prisma.persona.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
                await prisma.category.delete({ where: { id: catId } });
                return res.status(200).json({ message: '삭제되었습니다.' });
            } catch (e: any) {
                console.error('[categories DELETE]', e?.message, e?.code);
                return res.status(500).json({ error: e?.message || '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── App Settings ──────────────────────────────────────────
    if (domain === 'settings') {
        if (req.method === 'GET') {
            const configs = await prisma.appConfig.findMany();
            const result: Record<string, string> = {};
            configs.forEach((c: any) => {
                if (!c.key.startsWith('memory_enabled_')) result[c.key] = c.value;
            });
            // 로그인된 유저라면 자신의 memory_enabled 읽기
            try {
                const token = getTokenFromRequest(req);
                if (token) {
                    const { userId } = verifyToken(token);
                    const userCfg = await prisma.appConfig.findUnique({ where: { key: `memory_enabled_${userId}` } });
                    if (userCfg) result.memory_enabled = userCfg.value;
                }
            } catch {}
            return res.json(result);
        }
        if (req.method === 'PUT') {
            const token = getTokenFromRequest(req);
            if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
            let userId: number;
            let isAdmin = false;
            try {
                const payload = verifyToken(token);
                userId = payload.userId;
                const user = await prisma.user.findUnique({ where: { id: userId } });
                isAdmin = user?.role === 'ADMIN';
            } catch {
                return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
            }
            const updates = req.body as Record<string, string>;
            await Promise.all(
                Object.entries(updates).map(async ([key, value]) => {
                    if (key === 'memory_enabled') {
                        // 유저별 독립 저장
                        const userKey = `memory_enabled_${userId}`;
                        return prisma.appConfig.upsert({
                            where: { key: userKey },
                            update: { value: String(value), updatedAt: new Date() },
                            create: { key: userKey, value: String(value) },
                        });
                    }
                    if (!isAdmin) return Promise.resolve();
                    if (key === 'heroImageUrl' && String(value).startsWith('data:')) {
                        const mimeType = String(value).split(';')[0].split(':')[1] || 'image/jpeg';
                        const ext = mimeType.split('/')[1] || 'jpg';
                        const base64Data = String(value).split(',')[1];
                        const buffer = Buffer.from(base64Data, 'base64');
                        const gcsUrl = await uploadToGCS(buffer, `hero/hero-image.${ext}`, mimeType);
                        return prisma.appConfig.upsert({
                            where: { key },
                            update: { value: gcsUrl, updatedAt: new Date() },
                            create: { key, value: gcsUrl },
                        });
                    }
                    return prisma.appConfig.upsert({
                        where: { key },
                        update: { value: String(value), updatedAt: new Date() },
                        create: { key, value: String(value) },
                    });
                })
            );
            return res.json({ message: '저장 완료' });
        }
    }

    // ── Personas ──────────────────────────────────────────────

    if (domain === 'personas') {
        return personasRoute.handler(req, res, seg1, seg2, seg3);
    }

    // ── Sessions ──────────────────────────────────────────────

    if (domain === 'sessions') {
        return sessionsRoute.handler(req, res, seg1, seg2);
    }

    // ── User Profile ──────────────────────────────────────────
    if (domain === 'user') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // GET /api/user/birth-info
        if (seg1 === 'birth-info' && req.method === 'GET') {
            try {
                const user = await prisma.user.findUnique({ where: { id: userId }, select: { birthInfoJson: true } });
                return res.status(200).json({ birthInfoJson: user?.birthInfoJson ?? null });
            } catch (e) {
                console.error('[user/birth-info GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // PUT /api/user/birth-info
        if (seg1 === 'birth-info' && req.method === 'PUT') {
            try {
                const { birthInfoJson } = req.body;
                if (typeof birthInfoJson !== 'string') return res.status(400).json({ error: '잘못된 요청' });
                await prisma.user.update({ where: { id: userId }, data: { birthInfoJson } });
                return res.status(200).json({ ok: true });
            } catch (e) {
                console.error('[user/birth-info PUT]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Memory ────────────────────────────────────────────────
    if (domain === 'memory') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/memory — 기억 저장 (임베딩 생성 후 저장)
        if (req.method === 'POST' && !seg1) {
            try {
                const { content, category } = req.body;
                if (!content) return res.status(400).json({ error: 'content는 필수입니다.' });
                const embedding = await generateEmbedding(content);
                const ok = await saveMemoryIfNew(userId, content, embedding, category || null);
                if (!ok) return res.status(200).json({ skipped: true, message: '유사한 기억이 이미 존재합니다.' });
                const result = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "userId", "content", "category", "createdAt"
                     FROM "UserMemory" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
                    userId
                );
                return res.status(201).json(result[0]);
            } catch (e: any) {
                console.error('[memory POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // GET /api/memory — 전체 기억 조회
        if (req.method === 'GET' && !seg1) {
            try {
                const memories = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "userId", "content", "category", "createdAt"
                     FROM "UserMemory" WHERE "userId" = $1
                     ORDER BY "createdAt" DESC LIMIT 50`,
                    userId
                );
                return res.status(200).json(memories);
            } catch (e: any) {
                console.error('[memory GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/memory/search — 유사도 검색
        if (req.method === 'POST' && seg1 === 'search') {
            try {
                const { query } = req.body;
                if (!query) return res.status(400).json({ error: 'query는 필수입니다.' });
                const embedding = await generateEmbedding(query);
                const ANALYSIS_CATEGORIES = ['swing_analysis', 'saju_analysis'];

                // 분석 카테고리는 유사도 무관 항상 포함 (임베딩 실패해도 누락 방지)
                const analysisMemories = await prisma.$queryRawUnsafe<any[]>(
                    `SELECT "id", "content", "category", 1.0 AS similarity
                     FROM "UserMemory"
                     WHERE "userId" = $1 AND "category" = ANY($2::text[])`,
                    userId, ANALYSIS_CATEGORIES
                );

                // 쿼리 ①: 사용자 메시지 기반 유사도 검색 (대화 맥락 관련 기억)
                // 쿼리 ②: 고정 신상 쿼리로 이름·직업 등 핵심 정보 항상 검색
                const IDENTITY_QUERY = '이름 나이 직업 거주지 가족';
                const identityEmbedding = await generateEmbedding(IDENTITY_QUERY);

                const [contextMemories, identityMemories] = await Promise.all([
                    embedding ? searchMemories(userId, embedding, 4, 0.72) : Promise.resolve([]),
                    identityEmbedding ? searchMemories(userId, identityEmbedding, 2, 0.72) : Promise.resolve([]),
                ]);

                // 합쳐서 반환 (분석 > 신상 > 맥락 순, 중복 제거)
                const seen = new Set<number>();
                const memories = [...analysisMemories, ...identityMemories, ...contextMemories].filter(r => {
                    if (seen.has(r.id)) return false;
                    seen.add(r.id);
                    return true;
                });
                return res.status(200).json(memories);
            } catch (e: any) {
                console.error('[memory search]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/memory/:id
        if (req.method === 'DELETE' && seg1) {
            try {
                await prisma.$queryRawUnsafe(
                    `DELETE FROM "UserMemory" WHERE "id" = $1 AND "userId" = $2`,
                    Number(seg1), userId
                );
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[memory DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Persona Videos ────────────────────────────────────────
    // GET    /api/persona-videos/:imageId  → 이미지에 연결된 동영상 목록
    // POST   /api/persona-videos           → 동영상 추가 (body: { imageId, videoUrl, title })
    // PUT    /api/persona-videos/:videoId  → 동영상 수정 (body: { title, order })
    // DELETE /api/persona-videos/:videoId  → 동영상 삭제

    if (domain === 'persona-videos') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/persona-videos/:imageId
        if (seg1 && req.method === 'GET') {
            try {
                const videos = await prisma.personaVideo.findMany({
                    where: { imageId: Number(seg1) },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                });
                return res.status(200).json(videos);
            } catch (e: any) {
                console.error('[persona-videos GET]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/persona-videos/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const token = getTokenFromRequest(req);
                if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
                const { userId } = verifyToken(token);
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `personas/videos/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                console.error('[persona-videos signed-url]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // POST /api/persona-videos
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { imageId, videoUrl, videoBase64, mimeType, title } = req.body;
                if (!imageId || (!videoUrl && !videoBase64)) return res.status(400).json({ error: 'imageId와 videoUrl 또는 videoBase64는 필수입니다.' });

                let finalUrl = videoUrl || '';
                // base64 동영상이면 GCS에 업로드
                if (videoBase64) {
                    const type = mimeType || 'video/mp4';
                    const ext = type.split('/')[1] || 'mp4';
                    const buffer = Buffer.from(videoBase64, 'base64');
                    const destPath = `personas/videos/${Date.now()}.${ext}`;
                    finalUrl = await uploadToGCS(buffer, destPath, type);
                }

                const count = await prisma.personaVideo.count({ where: { imageId: Number(imageId) } });
                const video = await prisma.personaVideo.create({
                    data: { imageId: Number(imageId), videoUrl: finalUrl, title: title || null, order: count },
                });
                return res.status(201).json(video);
            } catch (e: any) {
                console.error('[persona-videos POST]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // PUT /api/persona-videos/:videoId
        if (seg1 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, order, requiredLevel } = req.body;
                const video = await prisma.personaVideo.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(order !== undefined && { order }),
                        ...(requiredLevel !== undefined && { requiredLevel: Number(requiredLevel) }),
                    },
                });
                return res.status(200).json(video);
            } catch (e: any) {
                console.error('[persona-videos PUT]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }

        // DELETE /api/persona-videos/:videoId
        if (seg1 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const deleted = await prisma.personaVideo.delete({ where: { id: Number(seg1) } });
                await deleteFromGCS(deleted.videoUrl);
                return res.status(200).json({ message: '삭제 완료' });
            } catch (e: any) {
                console.error('[persona-videos DELETE]', e);
                return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        }
    }

    // ── Knowledge ─────────────────────────────────────────────
    if (domain === 'knowledge') {
        return knowledgeRoute.handler(req, res, seg1, seg2);
    }

    if (domain === 'board') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
        const payload = verifyToken(token);
        const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
        if (!me) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        const isAdmin = me.role === 'ADMIN';

        // GET /api/board — 목록 (제목만, 비밀글)
        if (!seg1 && req.method === 'GET') {
            try {
                const personaIdFilter = req.query.personaId as string | undefined;
                const posts = await prisma.boardPost.findMany({
                    where: personaIdFilter ? { personaId: personaIdFilter } : undefined,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, title: true, createdAt: true, userId: true,
                        user: { select: { username: true, email: true } },
                        _count: { select: { replies: true } },
                    },
                });
                return res.status(200).json(posts);
            } catch (e: any) {
                console.error('[board GET]', e);
                return res.status(500).json({ error: '목록 조회 실패' });
            }
        }

        // POST /api/board — 게시글 작성
        if (!seg1 && req.method === 'POST') {
            try {
                const { title, content, personaId: postPersonaId } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                if (!postPersonaId)
                    return res.status(400).json({ error: 'personaId는 필수입니다.' });
                const post = await prisma.boardPost.create({
                    data: { userId: me.id, personaId: postPersonaId, title: title.trim(), content: content.trim() },
                });
                try {
                    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
                    for (const admin of admins) {
                        await sendEmail(admin.email, '[AI 페르소나] 소통게시판 새 글이 등록되었습니다',
                            `<div style="font-family:sans-serif;padding:24px;"><h2>새 문의글이 등록되었습니다</h2><p>제목: <strong>${title.trim()}</strong></p></div>`
                        ).catch(() => {});
                    }
                } catch {}
                return res.status(200).json({ id: post.id });
            } catch (e: any) {
                console.error('[board POST]', e);
                return res.status(500).json({ error: '게시글 등록 실패' });
            }
        }

        // GET /api/board/:id — 상세 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const post = await prisma.boardPost.findUnique({
                    where: { id: parseInt(seg1) },
                    include: {
                        user: { select: { username: true } },
                        replies: {
                            include: { user: { select: { username: true } } },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '열람 권한이 없습니다.' });
                return res.status(200).json(post);
            } catch (e: any) {
                console.error('[board GET detail]', e);
                return res.status(500).json({ error: '불러오기 실패' });
            }
        }

        // PUT /api/board/:id — 수정 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const post = await prisma.boardPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '수정 권한이 없습니다.' });
                const { title, content } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                await prisma.boardPost.update({
                    where: { id: parseInt(seg1) },
                    data: { title: title.trim(), content: content.trim() },
                });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board PUT]', e);
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/board/:id — 삭제 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const post = await prisma.boardPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.boardPost.delete({ where: { id: parseInt(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }

        // POST /api/board/:id/reply — 답글 작성 (작성자 또는 관리자)
        if (seg1 && seg2 === 'reply' && !seg3 && req.method === 'POST') {
            try {
                const postId = parseInt(seg1);
                const { content } = req.body;
                if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
                const post = await prisma.boardPost.findUnique({
                    where: { id: postId },
                    include: { user: { select: { email: true, username: true } } },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                const isAuthor = post.userId === me.id;
                if (!isAdmin && !isAuthor)
                    return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
                const reply = await prisma.boardReply.create({
                    data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
                });
                if (isAdmin && !isAuthor) {
                    sendEmail(post.user.email, '[AI 페르소나] 소통게시판 답글이 등록되었습니다',
                        `<div style="font-family:sans-serif;padding:24px;"><h2>관리자 답글이 등록되었습니다</h2><p>게시글: <strong>${post.title}</strong></p></div>`
                    ).catch(() => {});
                }
                return res.status(200).json({ id: reply.id });
            } catch (e: any) {
                console.error('[board reply POST]', e);
                return res.status(500).json({ error: '답글 등록 실패' });
            }
        }

        // DELETE /api/board/:id/reply/:replyId — 답글 삭제 (작성자 또는 관리자)
        if (seg1 && seg2 === 'reply' && seg3 && req.method === 'DELETE') {
            try {
                const reply = await prisma.boardReply.findUnique({ where: { id: parseInt(seg3) } });
                if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
                if (reply.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.boardReply.delete({ where: { id: parseInt(seg3) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[board reply DELETE]', e);
                return res.status(500).json({ error: '답글 삭제 실패' });
            }
        }
    }

    // ── Partner Board ─────────────────────────────────────────

    if (domain === 'partner-board') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
        const payload = verifyToken(token);
        const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
        if (!me) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
        const isAdmin = me.role === 'ADMIN';

        // GET /api/partner-board — 목록 (본인 글만, 관리자는 전체)
        if (!seg1 && req.method === 'GET') {
            try {
                const posts = await prisma.partnerPost.findMany({
                    where: isAdmin ? undefined : { userId: me.id },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true, title: true, createdAt: true, userId: true,
                        user: { select: { username: true, email: true } },
                        _count: { select: { replies: true } },
                    },
                });
                return res.status(200).json(posts);
            } catch (e: any) {
                console.error('[partner-board GET]', e);
                return res.status(500).json({ error: '목록 조회 실패' });
            }
        }

        // POST /api/partner-board — 게시글 작성
        if (!seg1 && req.method === 'POST') {
            try {
                const { title, content, contact } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                const post = await prisma.partnerPost.create({
                    data: { userId: me.id, title: title.trim(), content: content.trim(), contact: contact?.trim() || null },
                });
                try {
                    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
                    for (const admin of admins) {
                        await sendEmail(admin.email, '[AI 페르소나] 제휴 게시판 새 문의가 등록되었습니다',
                            `<div style="font-family:sans-serif;padding:24px;"><h2>새 제휴 문의가 등록되었습니다</h2><p>제목: <strong>${title.trim()}</strong></p></div>`
                        ).catch(() => {});
                    }
                } catch {}
                return res.status(200).json({ id: post.id });
            } catch (e: any) {
                console.error('[partner-board POST]', e);
                return res.status(500).json({ error: '게시글 등록 실패' });
            }
        }

        // GET /api/partner-board/:id — 상세 (작성자 또는 관리자)
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const post = await prisma.partnerPost.findUnique({
                    where: { id: parseInt(seg1) },
                    include: {
                        user: { select: { username: true, email: true } },
                        replies: {
                            include: { user: { select: { username: true, email: true } } },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '열람 권한이 없습니다.' });
                return res.status(200).json(post);
            } catch (e: any) {
                console.error('[partner-board GET detail]', e);
                return res.status(500).json({ error: '불러오기 실패' });
            }
        }

        // PUT /api/partner-board/:id — 수정
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '수정 권한이 없습니다.' });
                const { title, content } = req.body;
                if (!title?.trim() || !content?.trim())
                    return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
                await prisma.partnerPost.update({
                    where: { id: parseInt(seg1) },
                    data: { title: title.trim(), content: content.trim() },
                });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board PUT]', e);
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/partner-board/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(seg1) } });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                if (post.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.partnerPost.delete({ where: { id: parseInt(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }

        // POST /api/partner-board/:id/reply — 답글 작성
        if (seg1 && seg2 === 'reply' && !seg3 && req.method === 'POST') {
            try {
                const postId = parseInt(seg1);
                const { content } = req.body;
                if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
                const post = await prisma.partnerPost.findUnique({
                    where: { id: postId },
                    include: { user: { select: { email: true, username: true } } },
                });
                if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
                const isAuthor = post.userId === me.id;
                if (!isAdmin && !isAuthor)
                    return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
                const reply = await prisma.partnerReply.create({
                    data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
                });
                if (isAdmin && !isAuthor) {
                    sendEmail(post.user.email, '[AI 페르소나] 제휴 게시판 답글이 등록되었습니다',
                        `<div style="font-family:sans-serif;padding:24px;"><h2>관리자 답글이 등록되었습니다</h2><p>게시글: <strong>${post.title}</strong></p></div>`
                    ).catch(() => {});
                }
                return res.status(200).json({ id: reply.id });
            } catch (e: any) {
                console.error('[partner-board reply POST]', e);
                return res.status(500).json({ error: '답글 등록 실패' });
            }
        }

        // DELETE /api/partner-board/:id/reply/:replyId — 답글 삭제
        if (seg1 && seg2 === 'reply' && seg3 && req.method === 'DELETE') {
            try {
                const reply = await prisma.partnerReply.findUnique({ where: { id: parseInt(seg3) } });
                if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
                if (reply.userId !== me.id && !isAdmin)
                    return res.status(403).json({ error: '삭제 권한이 없습니다.' });
                await prisma.partnerReply.delete({ where: { id: parseInt(seg3) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[partner-board reply DELETE]', e);
                return res.status(500).json({ error: '답글 삭제 실패' });
            }
        }
    }

    // ── Trigger Videos ────────────────────────────────────────
    if (domain === 'trigger-videos') {
        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // GET /api/trigger-videos/:personaId
        if (seg1 && !seg2 && req.method === 'GET') {
            try {
                const list = await prisma.personaTriggerVideo.findMany({
                    where: { personaId: seg1 },
                    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                });
                return res.status(200).json(list);
            } catch (e: any) {
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        // POST /api/trigger-videos/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `personas/triggers/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                return res.status(500).json({ error: '서명 URL 생성 실패' });
            }
        }

        // POST /api/trigger-videos/extract-keywords
        if (seg1 === 'extract-keywords' && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, description } = req.body;
                if (!title) return res.status(400).json({ error: 'title은 필수입니다.' });
                const keywords = await extractTriggerKeywords(title, description || '');
                return res.status(200).json({ keywords });
            } catch (e: any) {
                return res.status(500).json({ error: '키워드 추출 실패' });
            }
        }

        // POST /api/trigger-videos
        if (!seg1 && req.method === 'POST') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { personaId, videoUrl, title, description, keywords, tag } = req.body;
                if (!personaId || !videoUrl || !keywords)
                    return res.status(400).json({ error: 'personaId, videoUrl, keywords는 필수입니다.' });
                const count = await prisma.personaTriggerVideo.count({ where: { personaId } });
                const video = await prisma.personaTriggerVideo.create({
                    data: { personaId, videoUrl, title: title || null, description: description || null, keywords, tag: tag || null, order: count },
                });
                return res.status(201).json(video);
            } catch (e: any) {
                return res.status(500).json({ error: '저장 실패' });
            }
        }

        // PUT /api/trigger-videos/:id
        if (seg1 && !seg2 && req.method === 'PUT') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const { title, description, keywords, tag } = req.body;
                const video = await prisma.personaTriggerVideo.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(description !== undefined && { description }),
                        ...(keywords !== undefined && { keywords }),
                        ...(tag !== undefined && { tag }),
                    },
                });
                return res.status(200).json(video);
            } catch (e: any) {
                return res.status(500).json({ error: '수정 실패' });
            }
        }

        // DELETE /api/trigger-videos/:id
        if (seg1 && !seg2 && req.method === 'DELETE') {
            try {
                const userId = await requireAdmin();
                if (!userId) return;
                const deleted = await prisma.personaTriggerVideo.delete({ where: { id: Number(seg1) } });
                await deleteFromGCS(deleted.videoUrl);
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                return res.status(500).json({ error: '삭제 실패' });
            }
        }
    }

    // ── Swing Analysis ────────────────────────────────────────
    if (domain === 'swing-analysis') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/swing-analysis/signed-url
        if (seg1 === 'signed-url' && req.method === 'POST') {
            try {
                const { mimeType, filename } = req.body;
                if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
                const ext = mimeType.split('/')[1] || 'mp4';
                const destPath = `users/${userId}/swing/${Date.now()}_${filename || 'video'}.${ext}`;
                const result = await generateSignedUrl(destPath, mimeType);
                return res.status(200).json(result);
            } catch (e: any) {
                console.error('[swing signed-url]', e);
                return res.status(500).json({ error: '서명 URL 생성 실패' });
            }
        }

        // POST /api/swing-analysis/analyze
        if (seg1 === 'analyze' && req.method === 'POST') {
            try {
                const { videoUrl, personaId, mimeType, fileName, title, gender, skillLevel } = req.body;
                if (!videoUrl || !personaId) return res.status(400).json({ error: '필수 항목 누락' });
                const swingUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                try {
                    const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                    const { deductMenuPoints } = await import('./_lib/points.js');
                    const { pointsCost } = await checkMenuAccess(prisma, userId, swingUser?.role ?? 'USER', 'golf');
                    await deductMenuPoints(prisma, userId, pointsCost, '스윙 분석');
                } catch (e: any) {
                    if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                    if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                    throw e;
                }
                const gcsUri = videoUrl.replace(
                    'https://storage.googleapis.com/ai-mp-media/',
                    'gs://ai-mp-media/'
                );
                const analysis = await analyzeGolfSwing(gcsUri, mimeType || 'video/mp4');
                // 분석 완료 즉시 GCS에서 영상 삭제 (개인정보 보호)
                await deleteFromGCS(videoUrl).catch(() => {});
                const record = await prisma.userSwingAnalysis.create({
                    data: {
                        userId, personaId,
                        fileName: fileName || null,
                        analysisJson: JSON.stringify(analysis),
                        title: title || null,
                        gender: gender || null,
                        skillLevel: skillLevel || null,
                    },
                });

                // UserMemory에 최신 스윙 분석 요약 upsert
                try {
                    const a = analysis as any;
                    const date = new Date().toISOString().slice(0, 10);
                    const secs: any[] = a.sections || [];
                    const scoresStr = secs.map((s: any) => `${s.name.replace(' & 셋업', '')} ${s.score}점`).join(' / ');
                    const priorities = (a.topPriorities || []).slice(0, 3).join(' / ');
                    const memContent = `[골프 스윙 분석 - ${date}] 종합 ${a.overallScore}점\n구간: ${scoresStr}\n주요 개선점: ${priorities}`;
                    const swingEmbedding = await generateEmbedding(memContent);
                    await upsertAnalysisMemory(userId, memContent, swingEmbedding, 'swing_analysis');
                } catch (memErr: any) {
                    console.warn('[swing memory upsert]', memErr.message);
                }

                return res.status(200).json({ id: record.id, analysis, createdAt: record.createdAt });
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                console.error('[swing analyze]', e);
                return res.status(500).json({ error: '분석 실패: ' + (e.message || '알 수 없는 오류') });
            }
        }

        // GET /api/swing-analysis?personaId=xxx
        if (!seg1 && req.method === 'GET') {
            try {
                const personaId = req.query.personaId as string | undefined;
                const records = await prisma.userSwingAnalysis.findMany({
                    where: { userId, ...(personaId ? { personaId } : {}) },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                });
                return res.status(200).json(records.map(r => ({
                    id: r.id,
                    fileName: r.fileName,
                    title: r.title,
                    gender: r.gender,
                    skillLevel: r.skillLevel,
                    createdAt: r.createdAt,
                    analysis: JSON.parse(r.analysisJson),
                })));
            } catch (e: any) {
                console.error('[swing GET]', e);
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        // PATCH /api/swing-analysis/:id — title/gender/skillLevel 업데이트 (CF 경로용)
        if (seg1 && req.method === 'PATCH') {
            try {
                const { title, gender, skillLevel } = req.body;
                const record = await prisma.userSwingAnalysis.findFirst({ where: { id: parseInt(seg1), userId } });
                if (!record) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
                await prisma.userSwingAnalysis.update({
                    where: { id: record.id },
                    data: { title: title || null, gender: gender || null, skillLevel: skillLevel || null },
                });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[swing PATCH]', e);
                return res.status(500).json({ error: '업데이트 실패' });
            }
        }

        // DELETE /api/swing-analysis/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                const record = await prisma.userSwingAnalysis.findFirst({
                    where: { id: parseInt(seg1), userId },
                });
                if (!record) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
                await prisma.userSwingAnalysis.delete({ where: { id: record.id } });
                return res.status(200).json({ ok: true });
            } catch (e: any) {
                console.error('[swing DELETE]', e);
                return res.status(500).json({ error: '삭제 실패' });
            }
        }
    }

    // ── Announcements ─────────────────────────────────────────
    if (domain === 'announcements') {
        // GET /api/announcements  → 공개: visible만 / 어드민: ?all=true 로 전체
        if (!seg1 && req.method === 'GET') {
            try {
                let isAdmin = false;
                try {
                    const token = getTokenFromRequest(req);
                    if (token) {
                        const { userId } = verifyToken(token);
                        const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
                        isAdmin = u?.role === 'ADMIN';
                    }
                } catch {}
                const showAll = isAdmin && req.query.all === 'true';
                const list = await prisma.announcement.findMany({
                    where: showAll ? {} : { isVisible: true },
                    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                if (!showAll) res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
                return res.status(200).json(list);
            } catch (e: any) {
                return res.status(500).json({ error: '조회 실패' });
            }
        }

        const requireAdmin = async (): Promise<number | null> => {
            const token = getTokenFromRequest(req);
            if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
            const { userId } = verifyToken(token);
            const u = await prisma.user.findUnique({ where: { id: userId } });
            if (!u || u.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
            return userId;
        };

        // POST /api/announcements
        if (!seg1 && req.method === 'POST') {
            try {
                if (!await requireAdmin()) return;
                const { title, content, category, isPinned, isVisible, personaId } = req.body;
                if (!title || !content) return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
                const item = await prisma.announcement.create({
                    data: { title, content, category: category || 'update', isPinned: isPinned ?? false, isVisible: isVisible ?? true, personaId: personaId || null },
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                return res.status(201).json(item);
            } catch (e: any) { return res.status(500).json({ error: '저장 실패' }); }
        }

        // PUT /api/announcements/:id
        if (seg1 && req.method === 'PUT') {
            try {
                if (!await requireAdmin()) return;
                const { title, content, category, isPinned, isVisible, personaId } = req.body;
                const item = await prisma.announcement.update({
                    where: { id: Number(seg1) },
                    data: {
                        ...(title !== undefined && { title }),
                        ...(content !== undefined && { content }),
                        ...(category !== undefined && { category }),
                        ...(isPinned !== undefined && { isPinned }),
                        ...(isVisible !== undefined && { isVisible }),
                        ...(personaId !== undefined && { personaId: personaId || null }),
                    },
                    include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
                });
                return res.status(200).json(item);
            } catch (e: any) { return res.status(500).json({ error: '수정 실패' }); }
        }

        // DELETE /api/announcements/:id
        if (seg1 && req.method === 'DELETE') {
            try {
                if (!await requireAdmin()) return;
                await prisma.announcement.delete({ where: { id: Number(seg1) } });
                return res.status(200).json({ ok: true });
            } catch (e: any) { return res.status(500).json({ error: '삭제 실패' }); }
        }
    }

    // ── Cron Cleanup ───────────────────────────────────────────
    if (domain === 'cron-cleanup') {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
            return res.status(401).json({ error: '인증 실패' });
        }
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const staleSessions = await prisma.chatSession.findMany({
                where: { updatedAt: { lt: cutoff }, summary: { isNot: null } },
                select: { id: true },
            });
            let deletedMessages = 0, cleanedSessions = 0;
            for (const s of staleSessions) {
                const keep = await prisma.message.findMany({
                    where: { sessionId: s.id },
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: { id: true },
                });
                const keepIds = keep.map(m => m.id);
                const result = await prisma.message.deleteMany({
                    where: { sessionId: s.id, ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}) },
                });
                if (result.count > 0) {
                    deletedMessages += result.count;
                    cleanedSessions++;
                    await prisma.conversationSummary.update({
                        where: { sessionId: s.id },
                        data: { messageCount: keep.length },
                    });
                }
            }
            console.log(`[cron-cleanup] ${cleanedSessions}개 세션, ${deletedMessages}개 메시지 삭제`);
            return res.status(200).json({ cleanedSessions, deletedMessages });
        } catch (e: any) {
            console.error('[cron-cleanup]', e);
            return res.status(500).json({ error: '서버 오류' });
        }
    }

    // ── Points ────────────────────────────────────────────────
    if (domain === 'points') {
        return pointsRoute.handler(req, res, seg1);
    }

    // ── Star Balloon ──────────────────────────────────────────
    if (domain === 'star') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/star — 스타 전송
        if (req.method === 'POST' && !seg1) {
            try {
                const { personaId, amount, message: msg } = req.body as { personaId: string; amount: number; message?: string };
                if (!personaId || !amount || amount < 1) return res.status(400).json({ error: '잘못된 요청' });
                const pointsSpent = amount * 10;
                const xpGain = amount * 2;

                const { getStageIndex, LEVELUP_BONUS } = await import('./_lib/points.js');

                const result = await prisma.$transaction(async (tx) => {
                    const userData = await tx.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
                    if (!userData || (userData.paidPoints + userData.bonusPoints) < pointsSpent) throw new Error('INSUFFICIENT_POINTS');
                    const bonusDeduct = Math.min(pointsSpent, userData.bonusPoints);
                    const paidDeduct = pointsSpent - bonusDeduct;
                    const newBonus = userData.bonusPoints - bonusDeduct;
                    const newPaid = userData.paidPoints - paidDeduct;
                    let newBalance = newBonus + newPaid;
                    await tx.user.update({ where: { id: userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
                    await tx.pointTransaction.create({
                        data: { userId, amount: -pointsSpent, type: 'STAR', personaId, balanceAfter: newBalance, description: `스타 ${amount}개` },
                    });
                    const balloon = await tx.star.create({
                        data: { fromUserId: userId, personaId, amount, pointsSpent, message: msg },
                    });

                    // XP 적립 (별스타 1개 = 2 XP) + 레벨업 체크
                    const xpRecord = await tx.userPersonaXp.findUnique({ where: { userId_personaId: { userId, personaId } } });
                    const currentXp = xpRecord?.xp ?? 0;
                    const oldStage = getStageIndex(currentXp);
                    const newXp = currentXp + xpGain;
                    await tx.userPersonaXp.upsert({
                        where: { userId_personaId: { userId, personaId } },
                        create: { userId, personaId, xp: newXp },
                        update: { xp: newXp },
                    });
                    const newStage = getStageIndex(newXp);
                    const leveledUp = newStage > oldStage;
                    let levelupBonus = 0;
                    if (leveledUp) {
                        levelupBonus = LEVELUP_BONUS[newStage] ?? 0;
                        if (levelupBonus > 0) {
                            const finalBonus = newBonus + levelupBonus;
                            await tx.user.update({ where: { id: userId }, data: { bonusPoints: finalBonus } });
                            await tx.pointTransaction.create({
                                data: { userId, amount: levelupBonus, type: 'LEVELUP', personaId, balanceAfter: newPaid + finalBonus, description: `${newStage}단계 달성 보너스` },
                            });
                            newBalance = newPaid + finalBonus;
                        }
                    }

                    return { balloon, newBalance, xp: newXp, leveledUp, newStage, levelupBonus };
                });

                return res.json(result);
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') {
                    return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
                }
                console.error('[star POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/star/:personaId/ranking — 페르소나 스타 랭킹
        if (req.method === 'GET' && seg1) {
            try {
                const ranking = await prisma.star.groupBy({
                    by: ['fromUserId'],
                    where: { personaId: seg1 },
                    _sum: { amount: true },
                    orderBy: { _sum: { amount: 'desc' } },
                    take: 10,
                });
                const userIds = ranking.map(r => r.fromUserId);
                const users = await prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, username: true },
                });
                const rankingResult = ranking.map(r => ({
                    user: users.find(u => u.id === r.fromUserId),
                    totalBalloons: r._sum.amount ?? 0,
                }));
                return res.json(rankingResult);
            } catch (e: any) {
                console.error('[star ranking GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Balloon Thanks ────────────────────────────────────────
    if (domain === 'star-thanks' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }
        try {
            const { personaId, amount } = req.body as { personaId: string; amount: number };
            if (!personaId || !amount) return res.status(400).json({ error: '잘못된 요청' });

            const persona = await prisma.persona.findUnique({ where: { id: personaId } });
            if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

            // 세션 찾기 또는 생성
            let session = await prisma.chatSession.findFirst({
                where: { userId, personaId },
                orderBy: { updatedAt: 'desc' },
            });
            if (!session) {
                session = await prisma.chatSession.create({
                    data: { userId, personaId, title: `${persona.name}와의 대화` },
                });
            }

            // 수량별 감사 멘트 톤 결정
            const tone = amount >= 100
                ? `사용자가 무려 별스타 ${amount}개를 보내줬습니다! 당신의 캐릭터 감성을 극대화하여, 매우 감격하고 설레는 감사 인사를 세 문장 이내로 해주세요.`
                : amount >= 10
                ? `사용자가 별스타 ${amount}개를 보내줬습니다. 당신의 캐릭터에 맞게 따뜻하고 진심 어린 감사 인사를 두 문장으로 해주세요.`
                : `사용자가 별스타 ${amount}개를 보내줬습니다. 당신의 캐릭터에 맞게 짧고 가볍게 감사 인사를 한 문장으로 해주세요.`;

            const { GoogleGenAI } = await import('@google/genai');
            const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
            if (!credsJson) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });
            const creds = JSON.parse(credsJson);
            const ai = new GoogleGenAI({ vertexai: true, project: creds.project_id, location: 'us-central1', googleAuthOptions: { credentials: creds } });

            const sysPrompt = [persona.systemInstruction, persona.identityPrompt].filter(Boolean).join('\n\n');
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                config: { systemInstruction: sysPrompt },
                contents: [{ role: 'user', parts: [{ text: tone }] }],
            });
            const thanksText = response.text?.trim();
            if (!thanksText) return res.status(500).json({ error: '응답 생성 실패' });

            const message = await prisma.message.create({
                data: { sessionId: session.id, role: 'assistant', text: thanksText },
            });
            await prisma.chatSession.update({ where: { id: session.id }, data: { updatedAt: new Date() } });

            return res.json({ message, sessionId: session.id });
        } catch (e: any) {
            console.error('[star-thanks]', e);
            return res.status(500).json({ error: '서버 오류' });
        }
    }

    // ── Payments (Toss) ──────────────────────────────────────
    if (domain === 'payments') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try {
            ({ userId } = verifyToken(token));
        } catch {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
        }

        // POST /api/payments/confirm — Toss 결제 확인 후 paidPoints 지급
        if (req.method === 'POST' && seg1 === 'confirm') {
            const { paymentKey, orderId, amount } = req.body as { paymentKey: string; orderId: string; amount: number };
            if (!paymentKey || !orderId || !amount) return res.status(400).json({ error: '필수 파라미터 누락' });

            const PACKAGES: Record<number, number> = { 5000: 500, 10000: 1100, 50000: 6000 };
            const points = PACKAGES[amount];
            if (!points) return res.status(400).json({ error: '유효하지 않은 결제 금액' });

            try {
                // 중복 처리 방지
                const existing = await prisma.pointTransaction.findFirst({
                    where: { userId, type: 'CHARGE', description: { contains: orderId } },
                });
                if (existing) return res.status(409).json({ error: '이미 처리된 결제입니다.' });

                // Toss 결제 서버 확인
                const secretKey = process.env.TOSS_SECRET_KEY;
                if (!secretKey) return res.status(500).json({ error: '결제 설정 오류' });
                const encoded = Buffer.from(`${secretKey}:`).toString('base64');
                const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
                    method: 'POST',
                    headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentKey, orderId, amount }),
                });
                if (!tossRes.ok) {
                    const err: any = await tossRes.json().catch(() => ({}));
                    console.error('[payments/confirm] Toss API error', err);
                    return res.status(402).json({ error: err.message || '결제 확인 실패' });
                }

                // paidPoints 지급
                const userData = await prisma.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
                if (!userData) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                const newPaid = userData.paidPoints + points;
                const newBalance = newPaid + userData.bonusPoints;
                await prisma.$transaction([
                    prisma.user.update({ where: { id: userId }, data: { paidPoints: newPaid } }),
                    prisma.pointTransaction.create({
                        data: { userId, amount: points, type: 'CHARGE', description: `충전 ${orderId}`, balanceAfter: newBalance },
                    }),
                ]);
                return res.json({ success: true, points, newPaidBalance: newPaid, newBonusBalance: userData.bonusPoints, newBalance });
            } catch (e: any) {
                console.error('[payments/confirm]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // ── Admin ─────────────────────────────────────────────────
    if (domain === 'admin') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        let userId: number;
        try { ({ userId } = verifyToken(token)); } catch { return res.status(401).json({ error: '유효하지 않은 토큰입니다.' }); }
        const adminUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (adminUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

        // GET /api/admin/users — 전체 유저 목록
        if (req.method === 'GET' && seg1 === 'users') {
            try {
                const users = await prisma.user.findMany({
                    select: {
                        id: true, email: true, phone: true, username: true, role: true,
                        paidPoints: true, bonusPoints: true, createdAt: true,
                        _count: { select: { sessions: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                return res.json(users.map(u => ({
                    id: u.id, email: u.email, phone: u.phone, username: u.username, role: u.role,
                    paidPoints: u.paidPoints, bonusPoints: u.bonusPoints,
                    createdAt: u.createdAt, sessionCount: u._count.sessions,
                })));
            } catch (e: any) {
                console.error('[admin/users GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // POST /api/admin/change-role — 유저 역할 변경
        if (req.method === 'POST' && seg1 === 'change-role') {
            const { userId, role } = req.body as { userId: number; role: string };
            if (!userId || !role) return res.status(400).json({ error: 'userId, role 필수' });
            if (!['USER', 'ADMIN', 'MANAGE'].includes(role)) return res.status(400).json({ error: '유효하지 않은 역할입니다.' });
            const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
            return res.json({ id: updated.id, role: updated.role });
        }

        // POST /api/admin/bulk-grant — 전체 유저 일괄 포인트 지급
        if (req.method === 'POST' && seg1 === 'bulk-grant') {
            try {
                const { amount, description } = req.body as { amount: number; description?: string };
                if (!amount || amount <= 0) return res.status(400).json({ error: '양수 amount가 필요합니다.' });
                const users = await prisma.user.findMany({ select: { id: true, paidPoints: true, bonusPoints: true } });
                await prisma.$transaction(
                    users.flatMap(u => {
                        const newBonus = u.bonusPoints + amount;
                        const newBalance = u.paidPoints + newBonus;
                        return [
                            prisma.user.update({ where: { id: u.id }, data: { bonusPoints: newBonus } }),
                            prisma.pointTransaction.create({ data: { userId: u.id, amount, type: 'ADMIN', description: description || '관리자 일괄 지급', balanceAfter: newBalance } }),
                        ];
                    })
                );
                return res.json({ granted: amount, userCount: users.length });
            } catch (e: any) {
                console.error('[admin/bulk-grant POST]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // GET /api/admin/menu-limits — 메뉴권한 목록
        if (req.method === 'GET' && seg1 === 'menu-limits') {
            try {
                const limits = await (prisma as any).menuLimit.findMany({
                    orderBy: [{ feature: 'asc' }, { role: 'asc' }],
                });
                return res.json(limits);
            } catch (e: any) {
                console.error('[admin/menu-limits GET]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }

        // PUT /api/admin/menu-limits — 메뉴권한 수정
        if (req.method === 'PUT' && seg1 === 'menu-limits') {
            try {
                const { feature, role, dailyLimit, pointsCost } = req.body;
                if (!feature || !role) return res.status(400).json({ error: 'feature, role 필수' });
                const updated = await (prisma as any).menuLimit.upsert({
                    where: { feature_role: { feature, role } },
                    update: {
                        dailyLimit: dailyLimit === null || dailyLimit === '' ? null : Number(dailyLimit),
                        pointsCost: Number(pointsCost ?? 50),
                    },
                    create: {
                        feature, role,
                        dailyLimit: dailyLimit === null || dailyLimit === '' ? null : Number(dailyLimit),
                        pointsCost: Number(pointsCost ?? 50),
                    },
                });
                return res.json(updated);
            } catch (e: any) {
                console.error('[admin/menu-limits PUT]', e);
                return res.status(500).json({ error: '서버 오류' });
            }
        }
    }

    // POST /api/face-reading
    if (domain === 'face-reading' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { imageBase64, mimeType, personaId } = req.body;
            if (!imageBase64 || !mimeType || !personaId) return res.status(400).json({ error: '필수 항목 누락' });

            const faceUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            let newBalance = (faceUser?.paidPoints ?? 0) + (faceUser?.bonusPoints ?? 0);
            let paidBalance = faceUser?.paidPoints ?? 0;
            let bonusBalance = faceUser?.bonusPoints ?? 0;
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, faceUser?.role ?? 'USER', 'face');
                ({ newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, pointsCost, '관상 분석'));
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            const persona = await prisma.persona.findUnique({ where: { id: personaId }, select: { systemInstruction: true } });
            const sysInstruction = persona?.systemInstruction ?? '';

            const analysis = await analyzeFaceReading(imageBase64, mimeType, sysInstruction);
            return res.json({ analysis, newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[face-reading POST]', e);
            return res.status(500).json({ error: '관상 분석 실패: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // POST /api/quick-menu-result
    if (domain === 'quick-menu-result' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { personaId, prompt } = req.body;
            const persona = await prisma.persona.findUnique({ where: { id: personaId }, select: { systemInstruction: true } });
            if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

            const qmUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            let newBalance = (qmUser?.paidPoints ?? 0) + (qmUser?.bonusPoints ?? 0);
            let paidBalance = qmUser?.paidPoints ?? 0;
            let bonusBalance = qmUser?.bonusPoints ?? 0;
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, qmUser?.role ?? 'USER', 'quick-menu');
                ({ newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, pointsCost, '퀵메뉴 분석'));
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            const result = await generateQuickMenuResult(persona.systemInstruction, prompt);
            return res.json({ result, newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[quick-menu-result POST]', e);
            return res.status(500).json({ error: '분석 실패: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // POST /api/quick-menu-activate (꿈해몽 등 채팅 진입 전 포인트 차감)
    if (domain === 'quick-menu-activate' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        try {
            const { userId } = verifyToken(token);
            const { cost, description } = req.body;
            if (!cost || cost <= 0) return res.status(400).json({ error: '잘못된 요청' });

            const qaUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, paidPoints: true, bonusPoints: true } });
            if (qaUser?.role === 'MANAGE' || qaUser?.role === 'ADMIN') {
                const newBalance = (qaUser.paidPoints) + (qaUser.bonusPoints);
                return res.json({ newBalance, paidBalance: qaUser.paidPoints, bonusBalance: qaUser.bonusPoints });
            }
            const { deductMenuPoints } = await import('./_lib/points.js');
            const { newBalance, paidBalance, bonusBalance } = await deductMenuPoints(prisma, userId, cost, description ?? '퀵메뉴');
            return res.json({ newBalance, paidBalance, bonusBalance });
        } catch (e: any) {
            if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
            console.error('[quick-menu-activate POST]', e);
            return res.status(500).json({ error: '서버 오류: ' + (e.message || '알 수 없는 오류') });
        }
    }

    // ── Stock Analysis ────────────────────────────────────────
    if (domain === 'stock-analysis') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // GET /api/stock-analysis/suggest?q=... — 종목명 자동완성
        if (seg1 === 'suggest' && req.method === 'GET') {
            const q = ((req.query.q as string) || '').trim();
            if (q.length < 2) return res.status(200).json([]);
            const rows = await prisma.corpCode.findMany({
                where: { OR: [{ corpName: { contains: q } }, { corpNameEng: { contains: q, mode: 'insensitive' } }] },
                take: 20,
                select: { corpName: true, corpNameEng: true, stockCode: true },
            });
            const sorted = [
                ...rows.filter(r => r.stockCode),
                ...rows.filter(r => !r.stockCode),
            ].slice(0, 10);
            return res.status(200).json(sorted);
        }

        // POST /api/stock-analysis — 분석 요청
        if (!seg1 && req.method === 'POST') {
            const { stockName } = req.body || {};
            if (!stockName?.trim()) return res.status(400).json({ error: '종목명을 입력해주세요.' });
            const corp = await prisma.corpCode.findFirst({ where: { corpName: stockName.trim() } });
            if (!corp) return res.status(400).json({ error: `'${stockName.trim()}'은(는) 등록된 종목명이 아닙니다.\n정확한 종목명을 입력하거나 목록에서 선택해주세요.` });
            const stockUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, stockUser?.role ?? 'USER', 'stock');
                await deductMenuPoints(prisma, userId, pointsCost, '주식 분석');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            try {
                const task = await prisma.stockAnalysis.create({
                    data: { userId, stockName: stockName.trim() },
                });
                return res.status(201).json({ id: task.id, status: 'pending' });
            } catch (e: any) {
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                return res.status(500).json({ error: '요청 저장 실패' });
            }
        }

        // GET /api/stock-analysis — 내 분석 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.stockAnalysis.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: { id: true, stockName: true, status: true, createdAt: true, updatedAt: true, corpCode: true, errorMessage: true },
            });
            return res.status(200).json(list);
        }

        // GET /api/stock-analysis/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.stockAnalysis.findFirst({
                where: { id: Number(seg1), userId },
            });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // GET /api/stock-analysis/:id/download — .md 파일 다운로드
        if (seg1 && seg2 === 'download' && req.method === 'GET') {
            const task = await prisma.stockAnalysis.findFirst({
                where: { id: Number(seg1), userId },
            });
            if (!task || !task.analysisReport) return res.status(404).json({ error: '없음' });
            const filename = `${task.stockName}_분석_${task.createdAt.toISOString().slice(0, 10)}.md`;
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
            return res.status(200).send(task.analysisReport);
        }

        // POST /api/stock-analysis/:id/retry — 실패 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.stockAnalysis.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null, yahooSymbol: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/stock-analysis/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            await prisma.stockAnalysis.deleteMany({ where: { id: Number(seg1), userId } });
            return res.status(200).json({ ok: true });
        }
    }

    // ── Luxury Verification ───────────────────────────────────
    if (domain === 'luxury-verify') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/luxury-verify/upload-urls — GCS 서명 URL 요청
        if (seg1 === 'upload-urls' && req.method === 'POST') {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length)
                return res.status(400).json({ error: '파일 정보가 필요합니다.' });
            const results = await Promise.all(
                files.slice(0, 8).map(async (f: { name: string; type: string }, idx: number) => {
                    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
                    const path = `luxury-verify/${userId}/${Date.now()}_${idx}.${ext}`;
                    return generateSignedUrl(path, f.type);
                })
            );
            return res.status(200).json(results);
        }

        // POST /api/luxury-verify — 검증 요청 생성
        if (!seg1 && req.method === 'POST') {
            const { imageUrls, brandHint } = req.body || {};
            if (!Array.isArray(imageUrls) || !imageUrls.length)
                return res.status(400).json({ error: '이미지가 필요합니다.' });
            const reqUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, reqUser?.role ?? 'USER', 'luxury');
                await deductMenuPoints(prisma, userId, pointsCost, '명품 감정');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            const task = await prisma.luxuryVerification.create({
                data: { userId, imageUrls: JSON.stringify(imageUrls), brandHint: brandHint?.trim() || null },
            });
            return res.status(201).json(task);
        }

        // GET /api/luxury-verify — 내 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.luxuryVerification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, brandHint: true, geminiBrand: true, status: true,
                    finalScore: true, finalVerdict: true,
                    imageUrls: true, createdAt: true, updatedAt: true, errorMessage: true,
                },
            });
            return res.status(200).json(list);
        }

        // GET /api/luxury-verify/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.luxuryVerification.findFirst({ where: { id: Number(seg1), userId } });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // POST /api/luxury-verify/:id/retry — 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.luxuryVerification.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/luxury-verify/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            const target = await prisma.luxuryVerification.findFirst({ where: { id: Number(seg1), userId } });
            if (target) {
                const urls: string[] = JSON.parse(target.imageUrls || '[]');
                await Promise.allSettled(urls.map(url => deleteFromGCS(url)));
                await prisma.luxuryVerification.delete({ where: { id: target.id } });
            }
            return res.status(200).json({ ok: true });
        }
    }

    // ── Used Item Listing ─────────────────────────────────────
    if (domain === 'used-item') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);

        // POST /api/used-item/upload-urls — GCS 서명 URL 요청
        if (seg1 === 'upload-urls' && req.method === 'POST') {
            const { files } = req.body || {};
            if (!Array.isArray(files) || !files.length)
                return res.status(400).json({ error: '파일 정보가 필요합니다.' });
            const results = await Promise.all(
                files.slice(0, 5).map(async (f: { name: string; type: string }, idx: number) => {
                    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
                    const path = `used-items/${userId}/${Date.now()}_${idx}.${ext}`;
                    return generateSignedUrl(path, f.type);
                })
            );
            return res.status(200).json(results);
        }

        // POST /api/used-item — 분석 요청 생성
        if (!seg1 && req.method === 'POST') {
            const { imageUrls, itemName } = req.body || {};
            if (!Array.isArray(imageUrls) || !imageUrls.length)
                return res.status(400).json({ error: '이미지가 필요합니다.' });
            const usedUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, usedUser?.role ?? 'USER', 'used-item');
                await deductMenuPoints(prisma, userId, pointsCost, '중고 판매 분석');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }
            const task = await prisma.usedItemListing.create({
                data: { userId, imageUrls: JSON.stringify(imageUrls), itemName: itemName?.trim() || null },
            });
            return res.status(201).json(task);
        }

        // GET /api/used-item — 내 목록
        if (!seg1 && req.method === 'GET') {
            const list = await prisma.usedItemListing.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true, itemName: true, modelName: true, brand: true,
                    status: true, suggestedPrice: true, finalPrice: true,
                    imageUrls: true, createdAt: true, updatedAt: true, errorMessage: true,
                },
            });
            return res.status(200).json(list);
        }

        // GET /api/used-item/:id — 상세 조회
        if (seg1 && !seg2 && req.method === 'GET') {
            const task = await prisma.usedItemListing.findFirst({ where: { id: Number(seg1), userId } });
            if (!task) return res.status(404).json({ error: '없음' });
            return res.status(200).json(task);
        }

        // PATCH /api/used-item/:id — 제목/가격/본문 수정
        if (seg1 && !seg2 && req.method === 'PATCH') {
            const { finalTitle, finalPrice, finalDescription } = req.body || {};
            await prisma.usedItemListing.updateMany({
                where: { id: Number(seg1), userId },
                data: {
                    ...(finalTitle !== undefined && { finalTitle }),
                    ...(finalPrice !== undefined && { finalPrice: Number(finalPrice) }),
                    ...(finalDescription !== undefined && { finalDescription }),
                },
            });
            return res.status(200).json({ ok: true });
        }

        // POST /api/used-item/:id/retry — 재시도
        if (seg1 && seg2 === 'retry' && req.method === 'POST') {
            await prisma.usedItemListing.updateMany({
                where: { id: Number(seg1), userId },
                data: { status: 'pending', errorMessage: null },
            });
            return res.status(200).json({ ok: true });
        }

        // DELETE /api/used-item/:id — 삭제
        if (seg1 && !seg2 && req.method === 'DELETE') {
            const target = await prisma.usedItemListing.findFirst({ where: { id: Number(seg1), userId } });
            if (target) {
                const urls: string[] = JSON.parse(target.imageUrls || '[]');
                await Promise.allSettled(urls.map(url => deleteFromGCS(url)));
                await prisma.usedItemListing.delete({ where: { id: target.id } });
            }
            return res.status(200).json({ ok: true });
        }
    }

    // GET /api/dart-test/종목명 — corp_code DB 조회 테스트
    if (domain === 'dart-test' && req.method === 'GET') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { findCorpCode } = await import('./_lib/dartService.js');
        const name = seg1 || (req.query.name as string) || '삼성전자';
        const corpCode = await findCorpCode(name);
        const total = await prisma.corpCode.count();
        return res.status(200).json({ name, corpCode, totalInDb: total });
    }

    // POST /api/dart-import — DART 전체 기업 코드 DB 갱신 (어드민)
    if (domain === 'dart-import' && req.method === 'POST') {
        const token = getTokenFromRequest(req);
        if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자만 가능' });
        const { importCorpCodes } = await import('./_lib/dartService.js');
        const count = await importCorpCodes();
        return res.status(200).json({ ok: true, count });
    }

    // ── Hot Keyword ───────────────────────────────────────────
    if (domain === 'hot-keyword') {
        // GET /api/hot-keyword/categories — 네이버 쇼핑 카테고리 목록
        if (seg1 === 'categories' && req.method === 'GET') {
            const cats = await prisma.naverShoppingCategory.findMany({
                orderBy: { order: 'asc' },
                select: { code: true, name: true, emoji: true, keywords: true },
            });
            return res.status(200).json(cats);
        }

        // POST /api/hot-keyword/run — n8n webhook 호출 (일회성 발송)
        if (seg1 === 'run' && req.method === 'POST') {
            const token = getTokenFromRequest(req);
            if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });
            const { userId } = verifyToken(token);

            const { categories, deliveryMethod, email, phone } = req.body || {};
            if (!categories || !Array.isArray(categories) || categories.length === 0)
                return res.status(400).json({ error: '카테고리를 1개 이상 선택해주세요.' });
            if (categories.length > 3)
                return res.status(400).json({ error: '카테고리는 최대 3개까지 선택 가능합니다.' });
            if (!deliveryMethod || !['email', 'sms'].includes(deliveryMethod))
                return res.status(400).json({ error: '발송 방법을 선택해주세요.' });
            if (deliveryMethod === 'email' && !email)
                return res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
            if (deliveryMethod === 'sms' && !phone)
                return res.status(400).json({ error: '전화번호를 입력해주세요.' });

            const N8N_WEBHOOK_URL = process.env.N8N_HOT_KEYWORD_WEBHOOK_URL;
            if (!N8N_WEBHOOK_URL) return res.status(500).json({ error: 'n8n webhook URL이 설정되지 않았습니다.' });

            // 기능 접근 정책 체크 (1일 1회 + 포인트 차감)
            const hkUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
            try {
                const { checkMenuAccess } = await import('./_lib/menuAccess.js');
                const { deductMenuPoints } = await import('./_lib/points.js');
                const { pointsCost } = await checkMenuAccess(prisma, userId, hkUser?.role ?? 'USER', 'hot-keyword');
                await deductMenuPoints(prisma, userId, pointsCost, '핫쇼핑키워드');
            } catch (e: any) {
                if (e.name === 'DAILY_LIMIT_EXCEEDED') return res.status(429).json({ error: e.message });
                if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: '포인트가 부족합니다.' });
                throw e;
            }

            // 카테고리별 TOP 5 키워드로 제한 후 이메일/SMS 내용 사전 포맷
            const top5Categories = categories.map((cat: any) => ({
                ...cat,
                keywords: Array.isArray(cat.keywords) ? cat.keywords.slice(0, 5) : [],
            }));

            const todayStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
            const emailSubject = `[핫쇼핑키워드] ${todayStr} 네이버 쇼핑 인기 키워드 TOP 5`;

            const categoryHtmlBlocks = top5Categories.map((cat: any) => {
                const keywordRows = cat.keywords.map((kw: string, i: number) =>
                    `<tr><td style="padding:6px 12px;color:#888;font-size:13px;">${i + 1}</td><td style="padding:6px 12px;font-size:14px;color:#1a1a1a;">${kw}</td></tr>`
                ).join('');
                return `
<div style="margin-bottom:24px;">
  <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:10px;">${cat.emoji} ${cat.name} TOP 5</div>
  <table style="border-collapse:collapse;width:100%;background:#f9f9f9;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#ff6b00;"><td style="padding:8px 12px;color:#fff;font-size:12px;font-weight:600;">순위</td><td style="padding:8px 12px;color:#fff;font-size:12px;font-weight:600;">키워드</td></tr></thead>
    <tbody>${keywordRows}</tbody>
  </table>
</div>`;
            }).join('');

            const emailHtml = `
<div style="font-family:'Apple SD Gothic Neo',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
  <div style="background:#ff6b00;padding:24px;text-align:center;">
    <div style="font-size:22px;font-weight:800;color:#fff;">🛒 핫쇼핑키워드</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${todayStr} 기준 네이버 쇼핑 인기 키워드</div>
  </div>
  <div style="padding:24px;">
    ${categoryHtmlBlocks}
    <div style="margin-top:16px;padding:12px;background:#fff8f3;border-radius:8px;font-size:12px;color:#888;text-align:center;">
      본 메일은 AI.MP 핫쇼핑키워드 서비스에서 발송되었습니다.
    </div>
  </div>
</div>`;

            const smsText = top5Categories.map((cat: any) =>
                `[${cat.emoji}${cat.name} TOP5]\n${cat.keywords.map((kw: string, i: number) => `${i + 1}. ${kw}`).join('\n')}`
            ).join('\n\n') + `\n\n- AI.MP 핫쇼핑키워드`;

            const payload = {
                categories: top5Categories,
                deliveryMethod,
                email: email || null,
                phone: phone || null,
                emailSubject,
                emailHtml,
                smsText,
            };
            const n8nRes = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!n8nRes.ok) {
                const errText = await n8nRes.text();
                console.error('n8n webhook 오류:', errText);
                return res.status(502).json({ error: '발송 요청 실패. 잠시 후 다시 시도해주세요.' });
            }
            // n8n이 "Respond to Webhook" 노드로 응답할 경우 ok 필드 확인
            let n8nBody: any = {};
            try { n8nBody = await n8nRes.json(); } catch { /* 빈 응답 무시 */ }
            if (n8nBody?.ok === false) {
                const errMsg = n8nBody?.error || '발송 중 오류가 발생했습니다.';
                console.error('n8n 워크플로우 오류:', errMsg);
                return res.status(502).json({ error: errMsg });
            }
            return res.status(200).json({ ok: true, message: '발송이 완료되었습니다.', content: n8nBody?.content || null, subject: n8nBody?.subject || null });
        }
    }

    return res.status(404).json({ error: 'Not found' });
}
