'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./src/generated/prisma/index.js');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'ai-mp-media';
let _gcsStorage = null;
function getGCSStorage() {
    if (_gcsStorage) return _gcsStorage;
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (creds) {
        const credentials = JSON.parse(creds);
        _gcsStorage = new Storage({ credentials, projectId: credentials.project_id });
    } else {
        _gcsStorage = new Storage();
    }
    return _gcsStorage;
}
async function uploadToGCS(buffer, destPath, mimeType) {
    const gcs = getGCSStorage();
    const file = gcs.bucket(BUCKET_NAME).file(destPath);
    await file.save(buffer, { metadata: { contentType: mimeType }, resumable: false });
    return `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
}
async function deleteFromGCS(publicUrl) {
    try {
        const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
        if (!publicUrl || !publicUrl.startsWith(prefix)) return;
        const filePath = publicUrl.slice(prefix.length);
        await getGCSStorage().bucket(BUCKET_NAME).file(filePath).delete();
    } catch { /* 파일 없으면 무시 */ }
}

// 구조적 \n (JSON 바깥)을 실제 줄바꿈으로 변환, 문자열 내부 \n은 그대로 유지
function fixPrettyJson(val) {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < val.length) {
    const ch = val[i];
    if (ch === '\\' && i + 1 < val.length) {
      if (inString) {
        result += ch + val[i + 1]; // 문자열 내부: 이스케이프 그대로 보존
      } else {
        result += (val[i + 1] === 'n') ? '\n' : ch + val[i + 1]; // 바깥: \n → 실제 줄바꿈
      }
      i += 2;
      continue;
    }
    if (ch === '"') inString = !inString;
    result += ch;
    i++;
  }
  return result;
}

// .env.local 직접 파싱 (dotenv는 \n을 실제 개행으로 변환해 JSON 오류 발생)
function loadEnvLocal() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        try {
          val = JSON.parse(val); // 이스케이프된 따옴표 처리: "{\"key\":\"val\"}"
        } catch {
          val = fixPrettyJson(val.slice(1, -1)); // pretty JSON: "{\n  "key": "val"\n}"
        }
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (e) {
    console.warn('Warning: .env.local not found');
  }
}
loadEnvLocal();

const PORT = 3002;
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;

if (!JWT_SECRET) { console.error('❌ JWT_SECRET not set'); process.exit(1); }
if (!DATABASE_URL) { console.error('❌ DATABASE_URL not set'); process.exit(1); }

// Validate credentials JSON at startup
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('✅ GOOGLE_APPLICATION_CREDENTIALS_JSON: OK');
  } catch (e) {
    const v = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    console.error(`❌ GOOGLE_APPLICATION_CREDENTIALS_JSON 파싱 실패: ${e.message}`);
    console.error(`   첫 20자: ${JSON.stringify(v.slice(0, 20))}`);
  }
} else {
  console.warn('⚠️  GOOGLE_APPLICATION_CREDENTIALS_JSON not set — AI 채팅 불가');
}

// Prisma
const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── JWT 헬퍼 ──────────────────────────────────────────────────
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(req) {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return jwt.verify(auth.slice(7), JWT_SECRET);
  const match = (req.headers.cookie || '').match(/token=([^;]+)/);
  if (match) return jwt.verify(match[1], JWT_SECRET);
  return null;
}
function tokenCookie(token) {
  return `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Strict`;
}

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { email, password, username } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, username: username || null },
      select: { id: true, email: true, username: true, role: true },
    });
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', tokenCookie(token));
    return res.status(201).json({ user: { ...user, personaXp: {} }, token });
  } catch (e) {
    console.error('[register]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { personaXps: { select: { personaId: true, xp: true } } },
    });
    if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', tokenCookie(token));
    const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
    return res.json({ user: { id: user.id, email: user.email, username: user.username, role: user.role, personaXp }, token });
  } catch (e) {
    console.error('[login]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict');
  return res.json({ message: '로그아웃 되었습니다.' });
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { personaXps: { select: { personaId: true, xp: true } } },
    });
    if (!user) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
    return res.json({ user: { id: user.id, email: user.email, username: user.username, role: user.role, personaXp } });
  } catch (e) {
    return res.status(401).json({ error: '인증이 만료되었습니다.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 30 * 60 * 1000);
      await prisma.user.update({
        where: { email },
        data: { resetToken: token, resetTokenExpiry: expiry },
      });

      const BREVO_API_KEY = process.env.BREVO_API_KEY;
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
      const resetUrl = `${baseUrl}/?token=${token}`;

      if (BREVO_API_KEY) {
        const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@dbzone.kr';
        await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
          body: JSON.stringify({
            sender: { name: 'AI 페르소나', email: senderEmail },
            to: [{ email }],
            subject: '[AI 페르소나] 비밀번호 재설정',
            htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#111827;color:#f9fafb;border-radius:12px;"><h2 style="color:#60a5fa;margin-bottom:16px;">비밀번호 재설정</h2><p style="color:#9ca3af;margin-bottom:24px;">아래 버튼을 클릭해 비밀번호를 재설정하세요.<br>링크는 30분 후 만료됩니다.</p><a href="${resetUrl}" style="display:inline-block;background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:bold;padding:12px 28px;border-radius:999px;text-decoration:none;">비밀번호 재설정하기</a><p style="margin-top:24px;font-size:12px;color:#6b7280;">이 요청을 하지 않으셨다면 무시하셔도 됩니다.</p></div>`,
          }),
        }).catch(e => console.error('[forgot-password] 이메일 전송 실패:', e.message));
      } else {
        console.log(`[forgot-password] BREVO_API_KEY 없음 — 재설정 링크: ${resetUrl}`);
      }
    }
    return res.json({ message: '입력한 이메일로 재설정 링크를 전송했습니다.' });
  } catch (e) {
    console.error('[forgot-password]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: '토큰과 새 비밀번호를 입력해주세요.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  try {
    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ error: '유효하지 않거나 만료된 링크입니다.' });
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });
    return res.json({ message: '비밀번호가 성공적으로 변경되었습니다.' });
  } catch (e) {
    console.error('[reset-password]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── App Settings ──────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const configs = await prisma.appConfig.findMany();
    const result = {};
    configs.forEach(c => { result[c.key] = c.value; });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const updates = req.body;
    await Promise.all(
      Object.entries(updates).map(([key, value]) =>
        prisma.appConfig.upsert({
          where: { key },
          update: { value: String(value), updatedAt: new Date() },
          create: { key, value: String(value) },
        })
      )
    );
    return res.json({ message: '저장 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Personas ──────────────────────────────────────────────────
app.get('/api/personas', async (req, res) => {
  try {
    const personas = await prisma.persona.findMany({ orderBy: { order: 'asc' } });
    return res.json(personas);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/personas', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const persona = await prisma.persona.create({ data: { ...req.body, createdBy: payload.userId } });
    return res.status(201).json(persona);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.put('/api/personas/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { id, isDefault, createdAt, user: _u, sessions: _s, ...data } = req.body;
    const updated = await prisma.persona.update({ where: { id: req.params.id }, data });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/personas/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const persona = await prisma.persona.findUnique({ where: { id: req.params.id } });
    if (persona?.isDefault) return res.status(400).json({ error: '기본 페르소나는 삭제할 수 없습니다.' });
    await prisma.persona.delete({ where: { id: req.params.id } });
    return res.json({ message: '삭제되었습니다.' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Persona Images ────────────────────────────────────────────
app.get('/api/personas/:id/images', async (req, res) => {
  try {
    const images = await prisma.personaImage.findMany({
      where: { personaId: req.params.id },
      orderBy: [{ isMain: 'desc' }, { order: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { videos: true } } },
    });
    return res.json(images);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/personas/:id/images', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

    // signed-url 발급 요청
    if (req.query.action === 'signed-url') {
      const { mimeType, filename } = req.body;
      if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
      const ext = mimeType.split('/')[1] || 'jpg';
      const destPath = `personas/${req.params.id}/images/${Date.now()}_${filename || 'image'}.${ext}`;
      const result = await generateSignedUrl(destPath, mimeType);
      return res.json(result);
    }

    const { imageUrl, description, isMain } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });

    let finalUrl = imageUrl;
    if (imageUrl.startsWith('data:')) {
      const mimeType = imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      const buffer = Buffer.from(imageUrl.split(',')[1], 'base64');
      const destPath = `personas/${req.params.id}/images/${Date.now()}.${ext}`;
      finalUrl = await uploadToGCS(buffer, destPath, mimeType);
    }

    if (isMain) {
      await prisma.personaImage.updateMany({ where: { personaId: req.params.id }, data: { isMain: false } });
    }
    const count = await prisma.personaImage.count({ where: { personaId: req.params.id } });
    const image = await prisma.personaImage.create({
      data: { personaId: req.params.id, imageUrl: finalUrl, description, isMain: isMain ?? count === 0, order: count },
    });
    return res.status(201).json(image);
  } catch (e) {
    console.error('[images POST]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.put('/api/personas/:id/images', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { imageId, isMain, description, requiredLevel, order } = req.body;
    if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
    if (isMain) {
      await prisma.personaImage.updateMany({ where: { personaId: req.params.id }, data: { isMain: false } });
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
    return res.json(image);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/personas/:id/images', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { imageId } = req.body;
    if (!imageId) return res.status(400).json({ error: 'imageId는 필수입니다.' });
    const deleted = await prisma.personaImage.delete({ where: { id: Number(imageId) } });
    await deleteFromGCS(deleted.imageUrl);
    if (deleted.isMain) {
      const first = await prisma.personaImage.findFirst({
        where: { personaId: req.params.id },
        orderBy: { order: 'asc' },
      });
      if (first) await prisma.personaImage.update({ where: { id: first.id }, data: { isMain: true } });
    }
    return res.json({ message: '삭제 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Signed URL ────────────────────────────────────────────────
async function generateSignedUrl(destPath, mimeType) {
  const gcs = getGCSStorage();
  const file = gcs.bucket(BUCKET_NAME).file(destPath);
  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: mimeType,
  });
  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
  return { signedUrl, publicUrl };
}


// POST /api/persona-videos/signed-url
app.post('/api/persona-videos/signed-url', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { mimeType, filename } = req.body;
    if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
    const ext = mimeType.split('/')[1] || 'mp4';
    const destPath = `personas/videos/${Date.now()}_${filename || 'video'}.${ext}`;
    const result = await generateSignedUrl(destPath, mimeType);
    return res.json(result);
  } catch (e) {
    console.error('[video signed-url]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Persona Videos ────────────────────────────────────────────
app.get('/api/persona-videos/:imageId', async (req, res) => {
  try {
    const videos = await prisma.personaVideo.findMany({
      where: { imageId: Number(req.params.imageId) },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return res.json(videos);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/persona-videos', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { imageId, videoUrl, videoBase64, mimeType, title } = req.body;
    if (!imageId || (!videoUrl && !videoBase64)) return res.status(400).json({ error: 'imageId와 videoUrl 또는 videoBase64는 필수입니다.' });

    let finalUrl = videoUrl || '';
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
  } catch (e) {
    console.error('[persona-videos POST]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.put('/api/persona-videos/:videoId', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { title, order, requiredLevel } = req.body;
    const video = await prisma.personaVideo.update({
      where: { id: Number(req.params.videoId) },
      data: {
        ...(title !== undefined && { title }),
        ...(order !== undefined && { order }),
        ...(requiredLevel !== undefined && { requiredLevel: Number(requiredLevel) }),
      },
    });
    return res.json(video);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/persona-videos/:videoId', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const deleted = await prisma.personaVideo.delete({ where: { id: Number(req.params.videoId) } });
    await deleteFromGCS(deleted.videoUrl);
    return res.json({ message: '삭제 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Sessions ──────────────────────────────────────────────────
app.get('/api/sessions', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessions = await prisma.chatSession.findMany({
      where: { userId: payload.userId },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json(sessions);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { personaId, title } = req.body;
    const session = await prisma.chatSession.create({
      data: { userId: payload.userId, personaId, title: title || '새 대화' },
    });
    return res.status(201).json(session);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/sessions/:id/messages', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });

    const sessionId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;

    const where = { sessionId };
    if (cursor) where.id = { lt: cursor };

    const raw = await prisma.message.findMany({
      where,
      orderBy: { id: 'desc' },
      take: limit + 1,
    });
    const hasMore = raw.length > limit;
    const messages = raw.slice(0, limit).reverse();

    return res.json({ messages, hasMore });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/sessions/:id/summary', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const summary = await prisma.conversationSummary.findUnique({ where: { sessionId } });
    return res.json(summary || null);
  } catch (e) {
    console.error('[summary GET]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sessions/:id/summary', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const { summary, messageCount } = req.body;
    if (!summary || !messageCount) return res.status(400).json({ error: 'summary와 messageCount는 필수입니다.' });
    const saved = await prisma.conversationSummary.upsert({
      where: { sessionId },
      update: { summary, messageCount, updatedAt: new Date() },
      create: { sessionId, summary, messageCount },
    });
    return res.json(saved);
  } catch (e) {
    console.error('[summary POST]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sessions/:id/messages', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { role, text } = req.body;
    const message = await prisma.message.create({
      data: { sessionId: Number(req.params.id), role, text },
    });
    let updatedXp;
    let personaId;
    if (role === 'user') {
      const session = await prisma.chatSession.findUnique({
        where: { id: Number(req.params.id) },
        select: { personaId: true },
      });
      if (session) {
        personaId = session.personaId;
        const upserted = await prisma.userPersonaXp.upsert({
          where: { userId_personaId: { userId: payload.userId, personaId } },
          update: { xp: { increment: 1 } },
          create: { userId: payload.userId, personaId, xp: 1 },
          select: { xp: true },
        });
        updatedXp = upserted.xp;
      }
    }
    return res.status(201).json({ ...message, personaId, xp: updatedXp });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Background Tasks (Gemini 호출 — 백엔드 처리) ──────────────
async function callGeminiText(prompt) {
  try {
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) return null;
    const creds = JSON.parse(credsJson);
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({
      vertexai: true,
      project: creds.project_id,
      location: 'us-central1',
      googleAuthOptions: { credentials: creds },
    });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text?.trim() || null;
  } catch (e) {
    console.error('[callGeminiText]', e.message);
    return null;
  }
}

async function extractMemoriesLocal(userText, aiText) {
  const content = aiText ? `사용자: ${userText}\nAI: ${aiText}` : `대화 요약: ${userText}`;
  const prompt = `다음 대화에서 "사용자(인간)"에 대한 장기 기억으로 저장할 중요한 사실을 추출하세요.
[추출 대상] 사용자의 직업, 취미, 선호도, 목표, 가족, 거주지, 기술 스택 등 개인 정보
[절대 추출 금지] AI 발화 내용, AI 페르소나 이름/직업, 일반 대화, 추측성 정보
반드시 "사용자:"가 직접 말한 내용만 추출하세요.
${content}
JSON 배열로 반환. 없으면 []. 형식: ["사실1", "사실2"]`;
  const text = await callGeminiText(prompt);
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

app.post('/api/sessions/:id/extract-memories', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const { userText, aiText } = req.body;
    if (!userText) return res.status(400).json({ error: 'userText는 필수입니다.' });
    const memories = await extractMemoriesLocal(userText, aiText || '');
    let saved = 0;
    for (const content of memories) {
      const embedding = await getEmbedding(content);
      const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "UserMemory" ("userId","content","embedding","category","createdAt") VALUES ($1,$2,$3::vector,$4,NOW())`,
        payload.userId, content, vectorStr, null
      );
      saved++;
    }
    return res.json({ saved });
  } catch (e) {
    console.error('[extract-memories]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/sessions/:id/summarize', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
    const messages = await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' }, take: 30 });
    if (messages.length < 2) return res.json({ summary: null });
    const conversation = messages.map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.text}`).join('\n');
    const prompt = `다음은 사용자와 AI의 대화입니다. 핵심 내용, 사용자의 주요 관심사, 중요한 결정사항을 4~6문장으로 간결하게 요약하세요. 한국어로 작성하세요.\n\n[대화]\n${conversation}\n\n[요약]`;
    const summaryText = await callGeminiText(prompt);
    if (!summaryText) return res.json({ summary: null });
    const saved = await prisma.conversationSummary.upsert({
      where: { sessionId },
      update: { summary: summaryText, messageCount: messages.length, updatedAt: new Date() },
      create: { sessionId, summary: summaryText, messageCount: messages.length },
    });
    // 요약에서 기억 추출
    const memories = await extractMemoriesLocal(summaryText, '');
    for (const content of memories) {
      const embedding = await getEmbedding(content);
      const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
      await prisma.$queryRawUnsafe(
        `INSERT INTO "UserMemory" ("userId","content","embedding","category","createdAt") VALUES ($1,$2,$3::vector,$4,NOW())`,
        payload.userId, content, vectorStr, '요약추출'
      );
    }
    return res.json(saved);
  } catch (e) {
    console.error('[summarize]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Memory ────────────────────────────────────────────────────
async function getEmbedding(text) {
  try {
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) return null;
    const creds = JSON.parse(credsJson);
    const { GoogleGenAI } = require('@google/genai');
    const ai = new GoogleGenAI({
      vertexai: true,
      project: creds.project_id,
      location: 'us-central1',
      googleAuthOptions: { credentials: creds },
    });
    const response = await ai.models.embedContent({ model: 'text-embedding-004', contents: text });
    return response.embeddings?.[0]?.values ?? null;
  } catch (e) {
    console.error('[embedding]', e.message);
    return null;
  }
}

app.post('/api/memory', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { content, category } = req.body;
    if (!content) return res.status(400).json({ error: 'content는 필수입니다.' });
    const embedding = await getEmbedding(content);
    const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO "UserMemory" ("userId", "content", "embedding", "category", "createdAt")
       VALUES ($1, $2, $3::vector, $4, NOW())
       RETURNING "id", "userId", "content", "category", "createdAt"`,
      payload.userId, content, vectorStr, category || null
    );
    return res.status(201).json(result[0]);
  } catch (e) {
    console.error('[memory POST]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/memory', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const memories = await prisma.$queryRawUnsafe(
      `SELECT "id", "userId", "content", "category", "createdAt"
       FROM "UserMemory" WHERE "userId" = $1
       ORDER BY "createdAt" DESC LIMIT 50`,
      payload.userId
    );
    return res.json(memories);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/memory/search', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query는 필수입니다.' });
    const embedding = await getEmbedding(query);
    if (!embedding) return res.json([]);
    const vectorStr = `[${embedding.join(',')}]`;
    const memories = await prisma.$queryRawUnsafe(
      `SELECT "id", "content", "category",
              1 - ("embedding" <=> $2::vector) AS similarity
       FROM "UserMemory"
       WHERE "userId" = $1 AND "embedding" IS NOT NULL
       ORDER BY "embedding" <=> $2::vector
       LIMIT 5`,
      payload.userId, vectorStr
    );
    return res.json(memories);
  } catch (e) {
    console.error('[memory search]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/memory/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    await prisma.$queryRawUnsafe(
      `DELETE FROM "UserMemory" WHERE "id" = $1 AND "userId" = $2`,
      Number(req.params.id), payload.userId
    );
    return res.json({ message: '삭제 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Knowledge ─────────────────────────────────────────────────
function chunkText(text) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
  const chunks = [];
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

app.post('/api/knowledge', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (caller?.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { personaId, title, text } = req.body;
    if (!personaId || !text) return res.status(400).json({ error: 'personaId, text는 필수입니다.' });
    const sourceId = crypto.randomUUID();
    const chunks = chunkText(text);
    let saved = 0;
    for (const chunk of chunks) {
      const embedding = await getEmbedding(chunk);
      if (embedding) {
        const vectorStr = `[${embedding.join(',')}]`;
        await prisma.$queryRawUnsafe(
          `INSERT INTO "PersonaKnowledge" ("personaId", "sourceId", "title", "content", "embedding", "createdAt")
           VALUES ($1, $2, $3, $4, $5::vector, NOW())`,
          personaId, sourceId, title || null, chunk, vectorStr
        );
      } else {
        await prisma.personaKnowledge.create({ data: { personaId, sourceId, title: title || null, content: chunk } });
      }
      saved++;
    }
    return res.json({ saved, total: chunks.length, sourceId });
  } catch (e) {
    console.error('[knowledge upload]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.get('/api/knowledge/:personaId', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (caller?.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const list = await prisma.$queryRawUnsafe(
      `SELECT "sourceId", "title",
              COUNT(*)::int AS "chunkCount",
              LEFT(MIN("content"), 100) AS "preview",
              MIN("createdAt") AS "createdAt"
       FROM "PersonaKnowledge"
       WHERE "personaId" = $1
       GROUP BY "sourceId", "title"
       ORDER BY MIN("createdAt") DESC`,
      req.params.personaId
    );
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/knowledge/source/:sourceId', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (caller?.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { count } = await prisma.personaKnowledge.deleteMany({ where: { sourceId: req.params.sourceId } });
    return res.json({ message: '삭제 완료', deleted: count });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (caller?.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    await prisma.personaKnowledge.delete({ where: { id: Number(req.params.id) } });
    return res.json({ message: '삭제 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/knowledge/search', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { personaId, query } = req.body;
    if (!personaId || !query) return res.status(400).json({ error: 'personaId, query는 필수입니다.' });
    const embedding = await getEmbedding(query);
    if (!embedding) return res.json([]);
    const vectorStr = `[${embedding.join(',')}]`;
    const results = await prisma.$queryRawUnsafe(
      `SELECT "id", "content", 1 - ("embedding" <=> $2::vector) AS similarity
       FROM "PersonaKnowledge"
       WHERE "personaId" = $1 AND "embedding" IS NOT NULL
         AND 1 - ("embedding" <=> $2::vector) > 0.70
       ORDER BY "embedding" <=> $2::vector
       LIMIT 3`,
      personaId, vectorStr
    );
    return res.json(results);
  } catch (e) {
    console.error('[knowledge search]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── AI Proxy ──────────────────────────────────────────────────
app.post('/api-proxy', async (req, res) => {
  try {
    const handler = require('./api/api-proxy.js');
    await handler(req, res);
  } catch (e) {
    console.error('[api-proxy]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Board ─────────────────────────────────────────────────

async function sendEmailLocal(to, subject, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.log(`[email] BREVO_API_KEY 없음 — to: ${to}, subject: ${subject}`); return; }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@dbzone.kr';
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: 'AI 페르소나', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  }).catch(e => console.error('[email] 전송 실패:', e.message));
}

async function getBoardUser(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: '로그인이 필요합니다.' }); return null; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const me = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true } });
    if (!me) { res.status(401).json({ error: '사용자를 찾을 수 없습니다.' }); return null; }
    return me;
  } catch { res.status(401).json({ error: '인증 오류' }); return null; }
}

// GET /api/board — 목록
app.get('/api/board', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  try {
    const posts = await prisma.boardPost.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, title: true, createdAt: true, userId: true,
        user: { select: { username: true, email: true } },
        _count: { select: { replies: true } },
      },
    });
    return res.json(posts);
  } catch (e) {
    console.error('[board GET]', e.message);
    return res.status(500).json({ error: '목록 조회 실패' });
  }
});

// POST /api/board — 작성
app.post('/api/board', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    const post = await prisma.boardPost.create({
      data: { userId: me.id, title: title.trim(), content: content.trim() },
    });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
    for (const admin of admins) {
      await sendEmailLocal(admin.email, '[AI 페르소나] 소통게시판 새 글이 등록되었습니다',
        `<div style="font-family:sans-serif;padding:24px;"><h2>새 문의글이 등록되었습니다</h2><p>제목: <strong>${title.trim()}</strong></p></div>`
      ).catch(() => {});
    }
    return res.json({ id: post.id });
  } catch (e) {
    console.error('[board POST]', e.message);
    return res.status(500).json({ error: '게시글 등록 실패' });
  }
});

// GET /api/board/:id — 상세
app.get('/api/board/:id', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.boardPost.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { username: true, email: true } },
        replies: {
          include: { user: { select: { username: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.userId !== me.id && !isAdmin) return res.status(403).json({ error: '열람 권한이 없습니다.' });
    return res.json(post);
  } catch (e) {
    console.error('[board GET detail]', e.message);
    return res.status(500).json({ error: '불러오기 실패' });
  }
});

// PUT /api/board/:id — 수정 (작성자 또는 관리자)
app.put('/api/board/:id', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.boardPost.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.userId !== me.id && !isAdmin) return res.status(403).json({ error: '수정 권한이 없습니다.' });
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    await prisma.boardPost.update({
      where: { id: parseInt(req.params.id) },
      data: { title: title.trim(), content: content.trim() },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[board PUT]', e.message);
    return res.status(500).json({ error: '수정 실패' });
  }
});

// DELETE /api/board/:id — 삭제 (작성자 또는 관리자)
app.delete('/api/board/:id', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.boardPost.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.userId !== me.id && !isAdmin) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    await prisma.boardPost.delete({ where: { id: parseInt(req.params.id) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[board DELETE]', e.message);
    return res.status(500).json({ error: '삭제 실패' });
  }
});

// POST /api/board/:id/reply — 답글 작성 (작성자 또는 관리자)
app.post('/api/board/:id/reply', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
    const post = await prisma.boardPost.findUnique({
      where: { id: postId },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    const isAuthor = post.userId === me.id;
    if (!isAdmin && !isAuthor) return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
    const reply = await prisma.boardReply.create({
      data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
    });
    if (isAdmin && !isAuthor) {
      sendEmailLocal(post.user.email, '[AI 페르소나] 소통게시판 답글이 등록되었습니다',
        `<div style="font-family:sans-serif;padding:24px;"><h2>관리자 답글이 등록되었습니다</h2><p>게시글: <strong>${post.title}</strong></p></div>`
      ).catch(() => {});
    }
    return res.json({ id: reply.id });
  } catch (e) {
    console.error('[board reply POST]', e.message);
    return res.status(500).json({ error: '답글 등록 실패' });
  }
});

// DELETE /api/board/:id/reply/:replyId — 답글 삭제 (작성자 또는 관리자)
app.delete('/api/board/:id/reply/:replyId', async (req, res) => {
  const me = await getBoardUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const reply = await prisma.boardReply.findUnique({ where: { id: parseInt(req.params.replyId) } });
    if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
    if (reply.userId !== me.id && !isAdmin) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    await prisma.boardReply.delete({ where: { id: parseInt(req.params.replyId) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[board reply DELETE]', e.message);
    return res.status(500).json({ error: '답글 삭제 실패' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Local API server: http://localhost:${PORT}`);
});
