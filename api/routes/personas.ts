import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../_lib/prisma.js';
import { getTokenFromRequest, verifyToken, requireAuth } from '../_lib/auth.js';
import { generateSignedUrl, uploadToGCS, deleteFromGCS } from '../_lib/storage.js';

export async function handler(
    req: VercelRequest,
    res: VercelResponse,
    seg1: string | undefined,
    seg2: string | undefined,
    seg3: string | undefined,
) {
    const requireAdmin = async (): Promise<number | null> => {
        const token = getTokenFromRequest(req);
        if (!token) { res.status(401).json({ error: '인증이 필요합니다.' }); return null; }
        const { userId } = verifyToken(token);
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.role !== 'ADMIN') { res.status(403).json({ error: '관리자 권한이 필요합니다.' }); return null; }
        return userId;
    };

    // GET /api/personas
    if (!seg1 && req.method === 'GET') {
        try {
            const personas = await prisma.persona.findMany({
                orderBy: { order: 'asc' },
                include: { category: true },
            });
            res.setHeader('Cache-Control', 'no-store');
            return res.status(200).json(personas);
        } catch (e: any) {
            console.error('[personas GET]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas
    if (!seg1 && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, introVideoUrl, chatBgUrl, order } = req.body;
            if (!name || !systemInstruction) return res.status(400).json({ error: '이름과 시스템 프롬프트는 필수입니다.' });
            const count = await prisma.persona.count();
            const persona = await prisma.persona.create({
                data: { name, jobTitle: jobTitle || null, description, systemInstruction, iconName: iconName || 'Bot', colorClass: colorClass || 'from-blue-500 to-cyan-500', imageUrl, introVideoUrl: introVideoUrl || null, chatBgUrl: chatBgUrl || null, order: order ?? count, isDefault: false, createdBy: userId },
            });
            return res.status(201).json(persona);
        } catch (e: any) {
            console.error('[personas POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // PUT /api/personas/:id
    if (seg1 && !seg2 && req.method === 'PUT') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { name, jobTitle, description, systemInstruction, iconName, colorClass, imageUrl, introVideoUrl, starVideoUrl, faceReadingBgUrl, chatBgUrl, quickMenuJson, order, isVisible, adminOnly, categoryId } = req.body;
            const persona = await prisma.persona.update({
                where: { id: seg1 },
                data: {
                    name, jobTitle: jobTitle ?? null, description, systemInstruction, iconName, colorClass,
                    imageUrl, introVideoUrl: introVideoUrl ?? null, starVideoUrl: starVideoUrl ?? null,
                    faceReadingBgUrl: faceReadingBgUrl ?? null,
                    chatBgUrl: chatBgUrl ?? null,
                    quickMenuJson: quickMenuJson ?? null, order,
                    ...(isVisible !== undefined && { isVisible }),
                    ...(adminOnly !== undefined && { adminOnly }),
                    categoryId: categoryId !== undefined ? (categoryId || null) : undefined,
                },
                include: { category: true },
            });
            return res.status(200).json(persona);
        } catch (e: any) {
            console.error('[personas PUT]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id
    if (seg1 && !seg2 && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
            if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });
            if (persona.isDefault) return res.status(400).json({ error: '기본 페르소나는 삭제할 수 없습니다.' });
            await prisma.persona.delete({ where: { id: seg1 } });
            return res.status(200).json({ message: '삭제 완료' });
        } catch (e: any) {
            console.error('[personas DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // GET /api/personas/:id/images
    if (seg1 && seg2 === 'images' && req.method === 'GET') {
        try {
            const images = await prisma.personaImage.findMany({
                where: { personaId: seg1 },
                orderBy: [{ isMain: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
                include: { _count: { select: { videos: true } } },
            });
            return res.status(200).json(images);
        } catch (e: any) {
            console.error('[persona images GET]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/images/signed-url
    if (seg1 && seg2 === 'images' && req.query.action === 'signed-url' && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { mimeType, filename } = req.body;
            if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
            const ext = mimeType.split('/')[1] || 'jpg';
            const destPath = `personas/${seg1}/images/${Date.now()}_${filename || 'image'}.${ext}`;
            const result = await generateSignedUrl(destPath, mimeType);
            return res.status(200).json(result);
        } catch (e: any) {
            console.error('[persona images signed-url]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/images
    if (seg1 && seg2 === 'images' && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { imageUrl, description, isMain } = req.body;
            if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });

            let finalUrl = imageUrl;
            if (imageUrl.startsWith('data:')) {
                const mimeType = imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
                const ext = mimeType.split('/')[1] || 'jpg';
                const base64Data = imageUrl.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const destPath = `personas/${seg1}/images/${Date.now()}.${ext}`;
                finalUrl = await uploadToGCS(buffer, destPath, mimeType);
            }

            if (isMain) {
                await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
            }
            const count = await prisma.personaImage.count({ where: { personaId: seg1 } });
            const image = await prisma.personaImage.create({
                data: { personaId: seg1, imageUrl: finalUrl, description, isMain: isMain ?? count === 0, order: count },
            });
            return res.status(201).json(image);
        } catch (e: any) {
            console.error('[persona images POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // PUT /api/personas/:id/images
    if (seg1 && seg2 === 'images' && req.method === 'PUT') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { imageId, isMain, description, requiredLevel, order } = req.body;
            if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
            if (isMain) {
                await prisma.personaImage.updateMany({ where: { personaId: seg1 }, data: { isMain: false } });
            }
            const image = await prisma.personaImage.update({
                where: { id: Number(imageId) },
                data: {
                    ...(isMain !== undefined && { isMain }),
                    ...(description !== undefined && { description }),
                    ...(requiredLevel !== undefined && { requiredLevel: Number(requiredLevel) }),
                    ...(order !== undefined && { order: Number(order) }),
                },
            });
            return res.status(200).json(image);
        } catch (e: any) {
            console.error('[persona images PUT]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id/images
    if (seg1 && seg2 === 'images' && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { imageId } = req.body;
            if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
            const deleted = await prisma.personaImage.delete({ where: { id: Number(imageId) } });
            await deleteFromGCS(deleted.imageUrl);
            if (deleted.isMain) {
                const first = await prisma.personaImage.findFirst({
                    where: { personaId: seg1 },
                    orderBy: { order: 'asc' },
                });
                if (first) await prisma.personaImage.update({ where: { id: first.id }, data: { isMain: true } });
            }
            return res.status(200).json({ message: '삭제 완료' });
        } catch (e: any) {
            console.error('[persona images DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // GET /api/personas/:id/intro-video/upload-url
    if (seg1 && seg2 === 'intro-video' && seg3 === 'upload-url' && req.method === 'GET') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const mimeType = (req.query.mimeType as string) || 'video/mp4';
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
            const destPath = `personas/${seg1}/intro/${Date.now()}.${ext}`;
            const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
            return res.status(200).json({ signedUrl, publicUrl });
        } catch (e: any) {
            console.error('[personas intro-video upload-url]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/intro-video
    if (seg1 && seg2 === 'intro-video' && !seg3 && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { videoUrl } = req.body;
            if (!videoUrl) return res.status(400).json({ error: 'videoUrl은 필수입니다.' });
            const persona = await prisma.persona.update({ where: { id: seg1 }, data: { introVideoUrl: videoUrl } });
            return res.status(200).json(persona);
        } catch (e: any) {
            console.error('[personas intro-video POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id/intro-video
    if (seg1 && seg2 === 'intro-video' && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
            if (persona?.introVideoUrl) await deleteFromGCS(persona.introVideoUrl).catch(() => {});
            const updated = await prisma.persona.update({ where: { id: seg1 }, data: { introVideoUrl: null } });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error('[personas intro-video DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // GET /api/personas/:id/star-video/upload-url
    if (seg1 && seg2 === 'star-video' && seg3 === 'upload-url' && req.method === 'GET') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const mimeType = (req.query.mimeType as string) || 'video/mp4';
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
            const destPath = `personas/${seg1}/balloon/${Date.now()}.${ext}`;
            const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
            return res.status(200).json({ signedUrl, publicUrl });
        } catch (e: any) {
            console.error('[personas star-video upload-url]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/star-video
    if (seg1 && seg2 === 'star-video' && !seg3 && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { videoUrl } = req.body;
            if (!videoUrl) return res.status(400).json({ error: 'videoUrl은 필수입니다.' });
            const persona = await prisma.persona.update({ where: { id: seg1 }, data: { starVideoUrl: videoUrl } });
            return res.status(200).json(persona);
        } catch (e: any) {
            console.error('[personas star-video POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id/star-video
    if (seg1 && seg2 === 'star-video' && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
            if (persona?.starVideoUrl) await deleteFromGCS(persona.starVideoUrl).catch(() => {});
            const updated = await prisma.persona.update({ where: { id: seg1 }, data: { starVideoUrl: null } });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error('[personas star-video DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // GET /api/personas/:id/face-reading-bg/upload-url
    if (seg1 && seg2 === 'face-reading-bg' && seg3 === 'upload-url' && req.method === 'GET') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const mimeType = (req.query.mimeType as string) || 'image/jpeg';
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
            const destPath = `personas/${seg1}/face-reading-bg/${Date.now()}.${ext}`;
            const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
            return res.status(200).json({ signedUrl, publicUrl });
        } catch (e: any) {
            console.error('[personas face-reading-bg upload-url]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/face-reading-bg
    if (seg1 && seg2 === 'face-reading-bg' && !seg3 && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { imageUrl } = req.body;
            if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
            const persona = await prisma.persona.update({ where: { id: seg1 }, data: { faceReadingBgUrl: imageUrl } });
            return res.status(200).json(persona);
        } catch (e: any) {
            console.error('[personas face-reading-bg POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id/face-reading-bg
    if (seg1 && seg2 === 'face-reading-bg' && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
            if (persona?.faceReadingBgUrl) await deleteFromGCS(persona.faceReadingBgUrl).catch(() => {});
            const updated = await prisma.persona.update({ where: { id: seg1 }, data: { faceReadingBgUrl: null } });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error('[personas face-reading-bg DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // GET /api/personas/:id/chat-bg/upload-url
    if (seg1 && seg2 === 'chat-bg' && seg3 === 'upload-url' && req.method === 'GET') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const mimeType = (req.query.mimeType as string) || 'image/png';
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
            const destPath = `personas/${seg1}/bg/${Date.now()}.${ext}`;
            const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
            return res.status(200).json({ signedUrl, publicUrl });
        } catch (e: any) {
            console.error('[personas chat-bg upload-url]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/chat-bg
    if (seg1 && seg2 === 'chat-bg' && !seg3 && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { imageUrl } = req.body;
            if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
            const persona = await prisma.persona.update({ where: { id: seg1 }, data: { chatBgUrl: imageUrl } });
            return res.status(200).json(persona);
        } catch (e: any) {
            console.error('[personas chat-bg POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // POST /api/personas/:id/chat-bg/remove
    if (seg1 && seg2 === 'chat-bg' && seg3 === 'remove' && req.method === 'POST') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const { url } = req.body as { url: string };
            if (!url) return res.status(400).json({ error: 'url은 필수입니다.' });
            const persona = await prisma.persona.findUnique({ where: { id: seg1 }, select: { chatBgUrl: true } });
            let urls: string[] = [];
            try { urls = JSON.parse(persona?.chatBgUrl || '[]'); } catch { urls = persona?.chatBgUrl ? [persona.chatBgUrl] : []; }
            const newUrls = urls.filter(u => u !== url);
            await deleteFromGCS(url).catch(() => {});
            const updated = await prisma.persona.update({
                where: { id: seg1 },
                data: { chatBgUrl: newUrls.length ? JSON.stringify(newUrls) : null },
            });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error('[personas chat-bg/remove POST]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }

    // DELETE /api/personas/:id/chat-bg
    if (seg1 && seg2 === 'chat-bg' && req.method === 'DELETE') {
        try {
            const userId = await requireAdmin();
            if (!userId) return;
            const persona = await prisma.persona.findUnique({ where: { id: seg1 } });
            if (persona?.chatBgUrl) {
                let urls: string[] = [];
                try { urls = JSON.parse(persona.chatBgUrl); } catch { urls = [persona.chatBgUrl]; }
                for (const u of urls) await deleteFromGCS(u).catch(() => {});
            }
            const updated = await prisma.persona.update({ where: { id: seg1 }, data: { chatBgUrl: null } });
            return res.status(200).json(updated);
        } catch (e: any) {
            console.error('[personas chat-bg DELETE]', e);
            return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    }
}
