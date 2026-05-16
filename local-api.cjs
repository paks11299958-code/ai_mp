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

// @google/genai is ESM-only — lazy import, singleton
let _geminiAI = null;
async function getGeminiAI() {
  if (_geminiAI) return _geminiAI;
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credsJson) return null;
  const creds = JSON.parse(credsJson);
  const { GoogleGenAI } = await import('@google/genai');
  _geminiAI = new GoogleGenAI({
    vertexai: true,
    project: creds.project_id,
    location: 'us-central1',
    googleAuthOptions: { credentials: creds },
  });
  return _geminiAI;
}
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
  const { email, phone, password, username } = req.body || {};
  if (!password) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
  if (!email && !phone) return res.status(400).json({ error: '이메일 또는 전화번호를 입력해주세요.' });
  const rawPhone = phone?.replace(/-/g, '');
  try {
    if (email) {
      const ex = await prisma.user.findUnique({ where: { email } });
      if (ex) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }
    if (rawPhone) {
      const ex = await prisma.user.findUnique({ where: { phone: rawPhone } });
      if (ex) return res.status(409).json({ error: '이미 사용 중인 전화번호입니다.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email || null, phone: rawPhone || null, password: hashed, username: username || null },
      select: { id: true, email: true, phone: true, username: true, role: true, paidPoints: true, bonusPoints: true },
    });
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', tokenCookie(token));
    return res.status(201).json({ user: { ...user, bonusPoints: 100, personaXp: {} }, token });
  } catch (e) {
    console.error('[register]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password)
    return res.status(400).json({ error: '이메일(전화번호)과 비밀번호를 입력해주세요.' });
  const normalized = identifier.replace(/-/g, '');
  const isPhoneId = /^\d{10,11}$/.test(normalized);
  try {
    const user = await prisma.user.findUnique({
      where: isPhoneId ? { phone: normalized } : { email: identifier },
      include: { personaXps: { select: { personaId: true, xp: true } } },
    });
    if (!user) return res.status(401).json({ error: '이메일(전화번호) 또는 비밀번호가 올바르지 않습니다.' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '이메일(전화번호) 또는 비밀번호가 올바르지 않습니다.' });
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', tokenCookie(token));
    const personaXp = Object.fromEntries(user.personaXps.map(p => [p.personaId, p.xp]));
    return res.json({ user: { id: user.id, email: user.email, phone: user.phone, username: user.username, role: user.role, paidPoints: user.paidPoints, bonusPoints: user.bonusPoints, personaXp }, token });
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

app.post('/api/auth/send-code', async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: '전화번호를 입력해주세요.' });
  const rawPhone = phone.replace(/-/g, '');
  try {
    const user = await prisma.user.findUnique({ where: { phone: rawPhone } });
    if (user) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({
        where: { phone: rawPhone },
        data: { resetToken: code, resetTokenExpiry: expiry },
      });
      console.log(`[send-code] 인증번호: ${code}`);
    }
    return res.json({ message: '인증코드를 발송했습니다.' });
  } catch (e) {
    console.error('[send-code]', e.message);
    return res.status(500).json({ error: 'SMS 전송에 실패했습니다.' });
  }
});

app.post('/api/auth/send-verify', async (req, res) => {
  const { type, identifier } = req.body || {};
  if (!type || !identifier) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
  const normalizedId = type === 'PHONE' ? identifier.replace(/-/g, '') : identifier.toLowerCase().trim();
  try {
    if (type === 'EMAIL') {
      const ex = await prisma.user.findUnique({ where: { email: normalizedId } });
      if (ex) return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    } else {
      const ex = await prisma.user.findUnique({ where: { phone: normalizedId } });
      if (ex) return res.status(409).json({ error: '이미 사용 중인 전화번호입니다.' });
    }
    const existing = await prisma.pendingVerification.findUnique({ where: { identifier: normalizedId } });
    const now = new Date();
    if (existing) {
      const secondsSinceLast = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
      if (secondsSinceLast < 60) {
        const wait = Math.ceil(60 - secondsSinceLast);
        return res.status(429).json({ error: `${wait}초 후에 다시 시도해주세요.` });
      }
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      if (existing.lastSentAt > dayAgo && existing.sentCount >= 5) {
        return res.status(429).json({ error: '일일 발송 한도(5회)를 초과했습니다.' });
      }
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const newSentCount = existing && existing.lastSentAt > new Date(now.getTime() - 24 * 60 * 60 * 1000)
      ? existing.sentCount + 1 : 1;
    await prisma.pendingVerification.upsert({
      where: { identifier: normalizedId },
      create: { type, identifier: normalizedId, codeHash, expiresAt, sentCount: 1, lastSentAt: now },
      update: { type, codeHash, expiresAt, attempts: 0, sentCount: newSentCount, lastSentAt: now },
    });
    console.log(`[LOCAL send-verify] type=${type} identifier=${normalizedId} 인증번호: ${code}`);
    res.json({ message: '인증코드를 발송했습니다.' });
  } catch (e) {
    console.error('[send-verify]', e.message);
    res.status(500).json({ error: '인증코드 발송에 실패했습니다.' });
  }
});

app.post('/api/auth/verify-register', async (req, res) => {
  const { type, identifier, code, password, username } = req.body || {};
  if (!type || !identifier || !code || !password) return res.status(400).json({ error: '필수 항목을 입력해주세요.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  const normalizedId = type === 'PHONE' ? identifier.replace(/-/g, '') : identifier.toLowerCase().trim();
  try {
    const pending = await prisma.pendingVerification.findUnique({ where: { identifier: normalizedId } });
    if (!pending) return res.status(400).json({ error: '인증을 먼저 요청해주세요.' });
    if (new Date() > pending.expiresAt) {
      await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
      return res.status(400).json({ error: '인증번호가 만료되었습니다. 다시 요청해주세요.' });
    }
    if (pending.attempts >= 5) {
      await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
      return res.status(400).json({ error: '인증번호 입력 횟수를 초과했습니다. 다시 요청해주세요.' });
    }
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    if (codeHash !== pending.codeHash) {
      await prisma.pendingVerification.update({
        where: { identifier: normalizedId },
        data: { attempts: { increment: 1 } },
      });
      const remaining = 4 - pending.attempts;
      return res.status(400).json({ error: `인증번호가 올바르지 않습니다. (남은 시도: ${remaining}회)` });
    }
    let ex;
    if (type === 'EMAIL') {
      ex = await prisma.user.findUnique({ where: { email: normalizedId } });
    } else {
      ex = await prisma.user.findUnique({ where: { phone: normalizedId } });
    }
    if (ex) {
      await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
      return res.status(409).json({ error: type === 'EMAIL' ? '이미 사용 중인 이메일입니다.' : '이미 사용 중인 전화번호입니다.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const userData = type === 'EMAIL'
      ? { email: normalizedId, phone: null, password: hashed, username: username || undefined }
      : { email: null, phone: normalizedId, password: hashed, username: username || undefined };
    const user = await prisma.user.create({
      data: userData,
      select: { id: true, email: true, phone: true, username: true, role: true, paidPoints: true, bonusPoints: true },
    });
    const bonusAmount = 100;
    await prisma.user.update({ where: { id: user.id }, data: { bonusPoints: { increment: bonusAmount } } });
    await prisma.pointTransaction.create({
      data: { userId: user.id, amount: bonusAmount, type: 'SIGNUP', description: '가입 보너스', balanceAfter: bonusAmount },
    });
    await prisma.pendingVerification.delete({ where: { identifier: normalizedId } });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
    res.cookie('auth_token', token, { httpOnly: true, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.status(201).json({ user: { ...user, bonusPoints: 100, personaXp: {} }, token });
  } catch (e) {
    console.error('[verify-register]', e);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
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
    configs.forEach(c => { if (!c.key.startsWith('memory_enabled_')) result[c.key] = c.value; });
    // 로그인된 유저라면 자신의 memory_enabled 읽기
    try {
      const payload = verifyToken(req);
      if (payload) {
        const userCfg = await prisma.appConfig.findUnique({ where: { key: `memory_enabled_${payload.userId}` } });
        if (userCfg) result.memory_enabled = userCfg.value;
      }
    } catch {}
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
    const isAdmin = user?.role === 'ADMIN';
    const updates = req.body;
    await Promise.all(
      Object.entries(updates).map(([key, value]) => {
        if (key === 'memory_enabled') {
          // 유저별 독립 저장
          const userKey = `memory_enabled_${payload.userId}`;
          return prisma.appConfig.upsert({
            where: { key: userKey },
            update: { value: String(value), updatedAt: new Date() },
            create: { key: userKey, value: String(value) },
          });
        }
        if (!isAdmin) return Promise.resolve();
        return prisma.appConfig.upsert({
          where: { key },
          update: { value: String(value), updatedAt: new Date() },
          create: { key, value: String(value) },
        });
      })
    );
    return res.json({ message: '저장 완료' });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Personas ──────────────────────────────────────────────────
app.get('/api/personas', async (req, res) => {
  try {
    const personas = await prisma.persona.findMany({
      orderBy: { order: 'asc' },
      include: { category: true },
    });
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
    const { id, isDefault, createdAt, user: _u, sessions: _s, category: _cat, ...data } = req.body;
    if (data.categoryId !== undefined) data.categoryId = data.categoryId || null;
    const updated = await prisma.persona.update({
      where: { id: req.params.id },
      data,
      include: { category: true },
    });
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

// ── Persona Intro Video ────────────────────────────────────────
app.get('/api/personas/:id/intro-video/upload-url', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const mimeType = req.query.mimeType || 'video/mp4';
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'mp4';
    const destPath = `personas/${req.params.id}/intro/${Date.now()}.${ext}`;
    const result = await generateSignedUrl(destPath, mimeType);
    return res.json(result);
  } catch (e) {
    console.error('[intro-video upload-url]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/personas/:id/intro-video', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { videoUrl } = req.body;
    if (!videoUrl) return res.status(400).json({ error: 'videoUrl은 필수입니다.' });
    const persona = await prisma.persona.update({ where: { id: req.params.id }, data: { introVideoUrl: videoUrl } });
    return res.json(persona);
  } catch (e) {
    console.error('[intro-video POST]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/personas/:id/intro-video', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const persona = await prisma.persona.findUnique({ where: { id: req.params.id } });
    if (persona?.introVideoUrl) await deleteFromGCS(persona.introVideoUrl).catch(() => {});
    const updated = await prisma.persona.update({ where: { id: req.params.id }, data: { introVideoUrl: null } });
    return res.json(updated);
  } catch (e) {
    console.error('[intro-video DELETE]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Chat BG ───────────────────────────────────────────────────
app.get('/api/personas/:id/chat-bg/upload-url', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const mimeType = req.query.mimeType || 'image/png';
    const ext = mimeType.split('/')[1]?.split(';')[0] || 'png';
    const destPath = `personas/${req.params.id}/bg/${Date.now()}.${ext}`;
    const { signedUrl, publicUrl } = await generateSignedUrl(destPath, mimeType);
    return res.json({ signedUrl, publicUrl });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/personas/:id/chat-bg', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl은 필수입니다.' });
    const persona = await prisma.persona.update({ where: { id: req.params.id }, data: { chatBgUrl: imageUrl } });
    return res.json(persona);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.post('/api/personas/:id/chat-bg/remove', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url은 필수입니다.' });
    const persona = await prisma.persona.findUnique({ where: { id: req.params.id }, select: { chatBgUrl: true } });
    let urls = [];
    try { urls = JSON.parse(persona?.chatBgUrl || '[]'); } catch { urls = persona?.chatBgUrl ? [persona.chatBgUrl] : []; }
    const newUrls = urls.filter(u => u !== url);
    await deleteFromGCS(url).catch(() => {});
    const updated = await prisma.persona.update({
      where: { id: req.params.id },
      data: { chatBgUrl: newUrls.length ? JSON.stringify(newUrls) : null },
    });
    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

app.delete('/api/personas/:id/chat-bg', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const persona = await prisma.persona.findUnique({ where: { id: req.params.id } });
    if (persona?.chatBgUrl) {
      let urls = [];
      try { urls = JSON.parse(persona.chatBgUrl); } catch { urls = [persona.chatBgUrl]; }
      for (const u of urls) await deleteFromGCS(u).catch(() => {});
    }
    const updated = await prisma.persona.update({ where: { id: req.params.id }, data: { chatBgUrl: null } });
    return res.json(updated);
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
    const firstChatMap = {};
    for (const s of sessions) {
      if (!firstChatMap[s.personaId] || s.createdAt < new Date(firstChatMap[s.personaId])) {
        firstChatMap[s.personaId] = s.createdAt.toISOString();
      }
    }
    return res.json({ sessions, firstChatMap });
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

// ── 포인트 헬퍼 (인라인) ──────────────────────────────────────
const STAGE_THRESHOLDS = [0, 30, 150, 500, 1200, 2500];
const STAGE_COSTS      = [10,  9,   8,   7,    6,    5];
const LEVELUP_BONUS    = [ 0, 20,  50, 100,  200,  500];

function getStageIndex(xp) {
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= STAGE_THRESHOLDS[i]) return i;
  }
  return 0;
}

function getMessageCost(xp) {
  return STAGE_COSTS[getStageIndex(xp)];
}

async function deductPointsForMessage(userId, personaId) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { paidPoints: true, bonusPoints: true } });
    if (!user) throw new Error('USER_NOT_FOUND');

    const xpRecord = await tx.userPersonaXp.findUnique({
      where: { userId_personaId: { userId, personaId } },
    });
    const currentXp = xpRecord?.xp ?? 0;
    const cost = getMessageCost(currentXp);
    const totalBalance = user.paidPoints + user.bonusPoints;

    if (totalBalance < cost) throw new Error('INSUFFICIENT_POINTS');

    const bonusDeduct = Math.min(cost, user.bonusPoints);
    const paidDeduct = cost - bonusDeduct;
    const newBonus = user.bonusPoints - bonusDeduct;
    const newPaid = user.paidPoints - paidDeduct;

    await tx.user.update({ where: { id: userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
    await tx.pointTransaction.create({
      data: { userId, amount: -cost, type: 'CHAT', personaId, balanceAfter: newBonus + newPaid },
    });

    const oldStage = getStageIndex(currentXp);
    const newXp = currentXp + 1;
    await tx.userPersonaXp.upsert({
      where: { userId_personaId: { userId, personaId } },
      create: { userId, personaId, xp: newXp },
      update: { xp: newXp },
    });
    const newStage = getStageIndex(newXp);

    let levelupBonus = 0;
    if (newStage > oldStage) {
      levelupBonus = LEVELUP_BONUS[newStage];
      if (levelupBonus > 0) {
        const finalBonus = newBonus + levelupBonus;
        await tx.user.update({ where: { id: userId }, data: { bonusPoints: finalBonus } });
        await tx.pointTransaction.create({
          data: { userId, amount: levelupBonus, type: 'LEVELUP', personaId, balanceAfter: newPaid + finalBonus, description: `${newStage}단계 달성 보너스` },
        });
        return { success: true, newBalance: newPaid + finalBonus, paidBalance: newPaid, bonusBalance: finalBonus, cost, leveledUp: true, newStage, levelupBonus };
      }
    }

    return { success: true, newBalance: newBonus + newPaid, paidBalance: newPaid, bonusBalance: newBonus, cost, leveledUp: newStage > oldStage, newStage, levelupBonus };
  });
}

app.post('/api/sessions/:id/messages', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { role, text } = req.body;

    let pointsInfo;
    let updatedXp;
    let personaId;

    if (role === 'user') {
      const session = await prisma.chatSession.findUnique({
        where: { id: Number(req.params.id) },
        select: { personaId: true },
      });
      if (session) {
        personaId = session.personaId;
        try {
          const result = await deductPointsForMessage(payload.userId, personaId);
          pointsInfo = { balance: result.newBalance, paidBalance: result.paidBalance, bonusBalance: result.bonusBalance, cost: result.cost, leveledUp: result.leveledUp, newStage: result.newStage, levelupBonus: result.levelupBonus };
          const xpRecord = await prisma.userPersonaXp.findUnique({
            where: { userId_personaId: { userId: payload.userId, personaId } },
          });
          updatedXp = xpRecord?.xp;
        } catch (e) {
          if (e.message === 'INSUFFICIENT_POINTS') {
            return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
          }
          throw e;
        }
      }
    }

    const message = await prisma.message.create({
      data: { sessionId: Number(req.params.id), role, text },
    });
    return res.status(201).json({ ...message, personaId, xp: updatedXp, points: pointsInfo });
  } catch (e) {
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Session Greet ─────────────────────────────────────────────
app.post('/api/sessions/:id/greet', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    const [persona, userRow] = await Promise.all([
      prisma.persona.findUnique({ where: { id: session.personaId } }),
      prisma.user.findUnique({ where: { id: payload.userId }, select: { username: true } }),
    ]);
    if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

    // 마지막 메시지 확인 — 2시간 이내이면 재인사 생략
    const lastMsg = await prisma.message.findFirst({ where: { sessionId }, orderBy: { createdAt: 'desc' } });
    const isFirstVisit = !lastMsg;
    if (lastMsg) {
      const elapsed = Date.now() - new Date(lastMsg.createdAt).getTime();
      if (elapsed < 2 * 60 * 60 * 1000) return res.status(200).json({ skipped: true });
    }

    const sysPrompt = [persona.systemInstruction, persona.identityPrompt].filter(Boolean).join('\n\n');
    const ai = await getGeminiAI();
    if (!ai) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });

    let greetPrompt;

    if (persona.name === '신은비') {
      const callAs = userRow?.username || '';
      const callStr = callAs ? `상대방 호칭은 "${callAs}"야.` : '';
      const elapsed = lastMsg ? Date.now() - new Date(lastMsg.createdAt).getTime() : Infinity;
      const kstHour = (new Date().getUTCHours() + 9) % 24;

      // D-Day 기념일 체크
      const MILESTONES = [7, 14, 22, 30, 50, 100];
      const firstSession = await prisma.chatSession.findFirst({
        where: { userId: payload.userId, personaId: session.personaId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      if (firstSession) {
        const daysElapsed = Math.floor((Date.now() - new Date(firstSession.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (MILESTONES.includes(daysElapsed)) {
          const milestonePrompt = `오늘은 우리가 처음 대화한 지 ${daysElapsed}일이 되는 날입니다. "벌써 우리 대화한 지 ${daysElapsed}일이나 됐어!" 같은 감성으로 기념일을 축하하며, 신은비의 말투로 두세 문장 멘트를 해주세요. ${callStr}`;
          const milestoneRes = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            config: { systemInstruction: sysPrompt },
            contents: [{ role: 'user', parts: [{ text: milestonePrompt }] }],
          });
          const milestoneText = milestoneRes.text?.trim();
          if (milestoneText) {
            const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text: milestoneText } });
            return res.status(201).json(message);
          }
        }
      }

      if (isFirstVisit) {
        greetPrompt = `사용자가 처음 입장했습니다. 신은비의 말투로 짧고 인상적인 첫인사를 해주세요. ${callStr}`;
      } else if (elapsed > 24 * 60 * 60 * 1000) {
        greetPrompt = `사용자가 24시간 이상 만에 돌아왔습니다. "나 잊어버린 줄 알았잖아... 오늘 올 줄 알았어!" 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
      } else if (kstHour >= 7 && kstHour < 9) {
        greetPrompt = `아침 시간입니다. "굿모닝! 오늘 하루도 힘내서 잘 다녀와!" 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
      } else if (kstHour >= 22) {
        greetPrompt = `늦은 밤입니다. "오늘 하루는 어땠어? 자기 전에 목소리 듣고 싶었어." 같은 감성으로, 신은비의 말투로 한두 문장만 해주세요. ${callStr}`;
      } else {
        greetPrompt = `사용자가 다시 돌아왔습니다. 신은비의 말투로 짧고 반갑게 맞이해주세요. 한두 문장만 해주세요. ${callStr}`;
      }
    } else {
      greetPrompt = isFirstVisit
        ? '사용자가 처음 입장했습니다. 당신의 정체성에 맞게 짧고 인상적인 첫인사를 한 문단으로 해주세요.'
        : '사용자가 다시 돌아왔습니다. 이전 대화를 기억하며 짧고 반갑게 맞이해주세요. 한 문장 또는 두 문장으로만 해주세요.';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: sysPrompt },
      contents: [{ role: 'user', parts: [{ text: greetPrompt }] }],
    });
    const greetText = response.text?.trim();
    if (!greetText) return res.status(500).json({ error: '인사말 생성 실패' });

    const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text: greetText } });
    return res.status(201).json(message);
  } catch (e) {
    console.error('[greet]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Session Quick Trigger ──────────────────────────────────────
app.post('/api/sessions/:id/quick-trigger', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const sessionId = Number(req.params.id);
    const session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId: payload.userId } });
    if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

    const { menuLabel, menuPrompt } = req.body;
    if (!menuLabel) return res.status(400).json({ error: '메뉴 정보가 필요합니다.' });

    const [persona, userRow] = await Promise.all([
      prisma.persona.findUnique({ where: { id: session.personaId } }),
      prisma.user.findUnique({ where: { id: payload.userId }, select: { birthInfoJson: true } }),
    ]);
    if (!persona) return res.status(404).json({ error: '페르소나를 찾을 수 없습니다.' });

    const birthInfo = userRow?.birthInfoJson ? JSON.parse(userRow.birthInfoJson) : null;
    const birthContext = birthInfo
      ? `\n사용자 정보: ${birthInfo.name || '사용자'}씨, ${birthInfo.year}년 ${birthInfo.month}월 ${birthInfo.day}일 ${birthInfo.time}생`
      : '';

    const sysPrompt = [persona.systemInstruction, persona.identityPrompt, birthContext].filter(Boolean).join('\n\n');
    const triggerPrompt = `사용자가 [${menuLabel}] 주제로 대화를 시작하고 싶어합니다. 사주 정보를 바탕으로 자연스럽고 흥미롭게 이 주제의 대화를 열어주세요. 한두 문장으로 짧게 시작하세요.`;

    const ai = await getGeminiAI();
    if (!ai) return res.status(500).json({ error: 'AI 서비스를 사용할 수 없습니다.' });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: { systemInstruction: sysPrompt },
      contents: [{ role: 'user', parts: [{ text: triggerPrompt }] }],
    });
    const text = response.text?.trim();
    if (!text) return res.status(500).json({ error: '응답 생성 실패' });

    const message = await prisma.message.create({ data: { sessionId, role: 'assistant', text } });
    await prisma.chatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
    return res.status(201).json(message);
  } catch (e) {
    console.error('[quick-trigger]', e);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── Background Tasks (Gemini 호출 — 백엔드 처리) ──────────────
async function callGeminiText(prompt) {
  try {
    const ai = await getGeminiAI();
    if (!ai) return null;
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
    const existingSummary = await prisma.conversationSummary.findUnique({ where: { sessionId } });
    const messages = (await prisma.message.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' }, take: 30 })).reverse();
    if (messages.length < 2 && !existingSummary) return res.json({ summary: null });
    const conversation = messages.map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.text}`).join('\n');
    const usePrevSummary = existingSummary && messages.length < 20;
    const prompt = usePrevSummary
      ? `다음은 이전 대화 요약과 최근 대화입니다. 두 내용을 통합하여 핵심 내용, 사용자의 주요 관심사, 중요한 결정사항을 4~6문장으로 간결하게 요약하세요. 한국어로 작성하세요.\n\n[이전 요약]\n${existingSummary.summary}\n\n[최근 대화]\n${conversation}\n\n[통합 요약]`
      : `다음은 사용자와 AI의 대화입니다. 핵심 내용, 사용자의 주요 관심사, 중요한 결정사항을 4~6문장으로 간결하게 요약하세요. 한국어로 작성하세요.\n\n[대화]\n${conversation}\n\n[요약]`;
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

app.post('/api/sessions/cleanup', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
    if (user?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { days = 30, keepCount = 10 } = req.body;
    const cutoff = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const staleSessions = await prisma.chatSession.findMany({
      where: { updatedAt: { lt: cutoff }, summary: { isNot: null } },
      select: { id: true },
    });
    let deletedMessages = 0, cleanedSessions = 0;
    for (const s of staleSessions) {
      const keep = await prisma.message.findMany({
        where: { sessionId: s.id },
        orderBy: { createdAt: 'desc' },
        take: Number(keepCount),
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
    return res.json({ cleanedSessions, deletedMessages });
  } catch (e) {
    console.error('[sessions cleanup]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ── User Profile ──────────────────────────────────────────────
app.get('/api/user/birth-info', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { birthInfoJson: true } });
    return res.status(200).json({ birthInfoJson: user?.birthInfoJson ?? null });
  } catch (e) {
    console.error('[user/birth-info GET]', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

app.put('/api/user/birth-info', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { birthInfoJson } = req.body;
    if (typeof birthInfoJson !== 'string') return res.status(400).json({ error: '잘못된 요청' });
    await prisma.user.update({ where: { id: payload.userId }, data: { birthInfoJson } });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[user/birth-info PUT]', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

// ── Memory ────────────────────────────────────────────────────
async function getEmbedding(text) {
  try {
    const ai = await getGeminiAI();
    if (!ai) return null;
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
    const ANALYSIS_CATEGORIES = ['swing_analysis', 'saju_analysis'];

    // 분석 카테고리는 유사도 무관 항상 포함
    const analysisMemories = await prisma.$queryRawUnsafe(
      `SELECT "id", "content", "category", 1.0 AS similarity
       FROM "UserMemory"
       WHERE "userId" = $1 AND "category" = ANY($2::text[])`,
      payload.userId, ANALYSIS_CATEGORIES
    );

    // 일반 메모리: 벡터 유사도 검색
    let vectorMemories = [];
    const embedding = await getEmbedding(query);
    if (embedding) {
      const vectorStr = `[${embedding.join(',')}]`;
      vectorMemories = await prisma.$queryRawUnsafe(
        `SELECT "id", "content", "category",
                1 - ("embedding" <=> $2::vector) AS similarity
         FROM "UserMemory"
         WHERE "userId" = $1 AND "embedding" IS NOT NULL
           AND "category" != ALL($3::text[])
           AND 1 - ("embedding" <=> $2::vector) > 0.72
         ORDER BY "embedding" <=> $2::vector
         LIMIT 4`,
        payload.userId, vectorStr, ANALYSIS_CATEGORIES
      );
    }

    const seen = new Set();
    const memories = [...analysisMemories, ...vectorMemories].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
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

async function compareDocumentsLocal(oldText, newText) {
  const sample = (t) => {
    if (t.length <= 1500) return t;
    const front = t.slice(0, 500);
    const mid = t.slice(Math.floor(t.length / 2) - 250, Math.floor(t.length / 2) + 250);
    const end = t.slice(-500);
    return `${front}\n...(중략)...\n${mid}\n...(중략)...\n${end}`;
  };
  const prompt = `AI 페르소나 지식 데이터베이스에 저장할 두 문서 중 더 품질이 높은 것을 선택하세요.

품질 기준: 정보의 완성도, 구체성, 상세함, AI 챗봇 대화 활용 가치

[기존 문서] (총 ${oldText.length}자)
${sample(oldText)}

[새 문서] (총 ${newText.length}자)
${sample(newText)}

"OLD" 또는 "NEW" 중 하나만 응답하세요. 새 문서가 더 낫거나 비슷하면 "NEW", 기존이 더 나으면 "OLD".`;
  try {
    const result = await callGeminiText(prompt);
    return result?.trim().startsWith('NEW') ? 'NEW' : 'OLD';
  } catch { return 'NEW'; }
}

app.post('/api/knowledge', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const caller = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (caller?.role !== 'ADMIN') return res.status(403).json({ error: '권한이 없습니다.' });
    const { personaId, title, text } = req.body;
    if (!personaId || !text) return res.status(400).json({ error: 'personaId, text는 필수입니다.' });

    let isReplaced = false;
    // 같은 제목의 문서가 있으면 Gemini로 품질 비교
    if (title) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT "sourceId", STRING_AGG("content", E'\\n\\n' ORDER BY "id") AS "fullText"
         FROM "PersonaKnowledge"
         WHERE "personaId" = $1 AND "title" = $2
         GROUP BY "sourceId" LIMIT 1`,
        personaId, title
      );
      if (existing.length > 0) {
        const winner = await compareDocumentsLocal(existing[0].fullText, text);
        if (winner === 'OLD') {
          return res.json({ saved: 0, total: 0, action: 'kept_existing', message: '기존 문서가 더 품질이 높아 유지했습니다.' });
        }
        // 새 문서가 더 나음 → 기존 삭제 후 교체
        await prisma.personaKnowledge.deleteMany({ where: { sourceId: existing[0].sourceId } });
        isReplaced = true;
      }
    }

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
    return res.json({ saved, total: chunks.length, sourceId, action: isReplaced ? 'replaced' : 'created' });
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
    const { default: handler } = await import('./api/api-proxy.js');
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
    const personaIdFilter = req.query.personaId;
    const posts = await prisma.boardPost.findMany({
      where: personaIdFilter ? { personaId: personaIdFilter } : undefined,
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
    const { title, content, personaId } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    if (!personaId)
      return res.status(400).json({ error: 'personaId는 필수입니다.' });
    const post = await prisma.boardPost.create({
      data: { userId: me.id, personaId, title: title.trim(), content: content.trim() },
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

// ── Partner Board ─────────────────────────────────────────────

async function getPartnerUser(req, res) {
  const auth = req.headers['authorization'];
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: '로그인이 필요합니다.' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, role: true, email: true } });
    if (!user) { res.status(401).json({ error: '사용자를 찾을 수 없습니다.' }); return null; }
    return user;
  } catch { res.status(401).json({ error: '인증 오류' }); return null; }
}

// GET /api/partner-board — 목록 (본인 글만, 관리자는 전체)
app.get('/api/partner-board', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
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
    return res.json(posts);
  } catch (e) {
    console.error('[partner-board GET]', e.message);
    return res.status(500).json({ error: '목록 조회 실패' });
  }
});

// POST /api/partner-board — 작성
app.post('/api/partner-board', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  try {
    const { title, content, contact } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    const post = await prisma.partnerPost.create({
      data: { userId: me.id, title: title.trim(), content: content.trim(), contact: contact?.trim() || null },
    });
    return res.json({ id: post.id });
  } catch (e) {
    console.error('[partner-board POST]', e.message);
    return res.status(500).json({ error: '게시글 등록 실패' });
  }
});

// GET /api/partner-board/:id — 상세
app.get('/api/partner-board/:id', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.partnerPost.findUnique({
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
    if (post.userId !== me.id && !isAdmin)
      return res.status(403).json({ error: '열람 권한이 없습니다.' });
    return res.json(post);
  } catch (e) {
    console.error('[partner-board GET detail]', e.message);
    return res.status(500).json({ error: '불러오기 실패' });
  }
});

// PUT /api/partner-board/:id — 수정
app.put('/api/partner-board/:id', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.userId !== me.id && !isAdmin) return res.status(403).json({ error: '수정 권한이 없습니다.' });
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim())
      return res.status(400).json({ error: '제목과 내용을 입력해주세요.' });
    await prisma.partnerPost.update({
      where: { id: parseInt(req.params.id) },
      data: { title: title.trim(), content: content.trim() },
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[partner-board PUT]', e.message);
    return res.status(500).json({ error: '수정 실패' });
  }
});

// DELETE /api/partner-board/:id — 삭제
app.delete('/api/partner-board/:id', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const post = await prisma.partnerPost.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.userId !== me.id && !isAdmin) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    await prisma.partnerPost.delete({ where: { id: parseInt(req.params.id) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[partner-board DELETE]', e.message);
    return res.status(500).json({ error: '삭제 실패' });
  }
});

// POST /api/partner-board/:id/reply — 답글 작성
app.post('/api/partner-board/:id/reply', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const postId = parseInt(req.params.id);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '내용을 입력해주세요.' });
    const post = await prisma.partnerPost.findUnique({
      where: { id: postId },
      include: { user: { select: { email: true, username: true } } },
    });
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    const isAuthor = post.userId === me.id;
    if (!isAdmin && !isAuthor) return res.status(403).json({ error: '댓글 작성 권한이 없습니다.' });
    const reply = await prisma.partnerReply.create({
      data: { postId, userId: me.id, isAdminReply: isAdmin, content: content.trim() },
    });
    return res.json({ id: reply.id });
  } catch (e) {
    console.error('[partner-board reply POST]', e.message);
    return res.status(500).json({ error: '답글 등록 실패' });
  }
});

// DELETE /api/partner-board/:id/reply/:replyId — 답글 삭제
app.delete('/api/partner-board/:id/reply/:replyId', async (req, res) => {
  const me = await getPartnerUser(req, res);
  if (!me) return;
  const isAdmin = me.role === 'ADMIN';
  try {
    const reply = await prisma.partnerReply.findUnique({ where: { id: parseInt(req.params.replyId) } });
    if (!reply) return res.status(404).json({ error: '답글을 찾을 수 없습니다.' });
    if (reply.userId !== me.id && !isAdmin) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    await prisma.partnerReply.delete({ where: { id: parseInt(req.params.replyId) } });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[partner-board reply DELETE]', e.message);
    return res.status(500).json({ error: '답글 삭제 실패' });
  }
});

// ── Trigger Videos ────────────────────────────────────────────

async function callGeminiVideo(videoGcsUri, mimeType, promptText) {
  try {
    const ai = await getGeminiAI();
    if (!ai) return null;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { fileData: { mimeType, fileUri: videoGcsUri } },
          { text: promptText },
        ],
      }],
    });
    return response.text?.trim() || null;
  } catch (e) {
    console.error('[callGeminiVideo]', e.message);
    return null;
  }
}

const GOLF_ANALYSIS_PROMPT = `당신은 엄격한 기준을 가진 전문 골프 티칭 프로입니다. 이 골프 스윙 영상을 분석하고 아래 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트는 절대 포함하지 마세요.

채점 기준 (반드시 엄격하게 적용):
- 90~100: 투어 프로 수준 (극히 드묾)
- 80~89: 싱글 핸디캡, 상위 5% 아마추어
- 65~79: 보기 플레이어 수준 (평균 아마추어)
- 50~64: 기초는 있으나 다수 개선 필요
- 35~49: 기본기부터 전면 교정 필요
- 35 미만: 전반적 재교육 필요
대부분의 일반 아마추어는 50~68점대입니다. 점수에 인색하게 채점하여 개선 동기를 부여하세요.

{
  "overallScore": 0~100 사이 정수,
  "overallComment": "전반적인 스윙 평가 2~3문장 (한국어)",
  "sections": [
    {
      "name": "어드레스 & 셋업",
      "score": 0~100 정수,
      "comment": "이 구간 평가 1~2문장",
      "good": ["잘된 점1", "잘된 점2"],
      "improve": ["개선점1", "개선점2"]
    },
    { "name": "백스윙", "score": ..., "comment": ..., "good": [...], "improve": [...] },
    { "name": "다운스윙", "score": ..., "comment": ..., "good": [...], "improve": [...] },
    { "name": "임팩트", "score": ..., "comment": ..., "good": [...], "improve": [...] },
    { "name": "팔로우스루", "score": ..., "comment": ..., "good": [...], "improve": [...] }
  ],
  "topPriorities": ["가장 중요한 개선점1", "개선점2", "개선점3"],
  "recommendedDrills": ["추천 드릴1", "추천 드릴2", "추천 드릴3"]
}`;

async function extractTriggerKeywordsLocal(title, description) {
  const prompt = `다음 영상의 제목과 설명을 보고, 채팅에서 이 영상을 재생할 때 사용할 트리거 키워드를 추출하세요.
제목: ${title}
설명: ${description || '(없음)'}
[추출 규칙]
- 사용자가 채팅에서 실제로 입력할 법한 짧은 단어/표현
- 비슷한 표현 여러 개 포함 (예: "안녕", "안녕하세요", "반가워")
- 한국어 구어체 위주, 10~20개 추출
JSON 배열로만 반환. 형식: ["키워드1", "키워드2"]`;
  const text = await callGeminiText(prompt);
  if (!text) return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try { return JSON.parse(match[0]); } catch { return []; }
}

// GET /api/trigger-videos/:personaId
app.get('/api/trigger-videos/:personaId', async (req, res) => {
  try {
    const list = await prisma.personaTriggerVideo.findMany({
      where: { personaId: req.params.personaId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: '조회 실패' });
  }
});

// POST /api/trigger-videos/signed-url
app.post('/api/trigger-videos/signed-url', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  try {
    const { mimeType, filename } = req.body;
    const ext = (mimeType || 'video/mp4').split('/')[1] || 'mp4';
    const destPath = `personas/triggers/${Date.now()}_${filename || 'video'}.${ext}`;
    const gcs = getGCSStorage();
    const file = gcs.bucket(BUCKET_NAME).file(destPath);
    const [signedUrl] = await file.getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: mimeType });
    return res.json({ signedUrl, publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}` });
  } catch (e) {
    return res.status(500).json({ error: '서명 URL 생성 실패' });
  }
});

// POST /api/trigger-videos/extract-keywords
app.post('/api/trigger-videos/extract-keywords', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title은 필수입니다.' });
    const keywords = await extractTriggerKeywordsLocal(title, description || '');
    return res.json({ keywords });
  } catch (e) {
    return res.status(500).json({ error: '키워드 추출 실패' });
  }
});

// POST /api/trigger-videos
app.post('/api/trigger-videos', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  try {
    const { personaId, videoUrl, title, description, keywords, tag } = req.body;
    if (!personaId || !videoUrl || !keywords) return res.status(400).json({ error: '필수 항목 누락' });
    const count = await prisma.personaTriggerVideo.count({ where: { personaId } });
    const video = await prisma.personaTriggerVideo.create({
      data: { personaId, videoUrl, title: title || null, description: description || null, keywords, tag: tag || null, order: count },
    });
    return res.status(201).json(video);
  } catch (e) {
    return res.status(500).json({ error: '저장 실패' });
  }
});

// PUT /api/trigger-videos/:id
app.put('/api/trigger-videos/:id', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  try {
    const { title, description, keywords, tag } = req.body;
    const video = await prisma.personaTriggerVideo.update({
      where: { id: Number(req.params.id) },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(keywords !== undefined && { keywords }),
        ...(tag !== undefined && { tag }),
      },
    });
    return res.json(video);
  } catch (e) {
    return res.status(500).json({ error: '수정 실패' });
  }
});

// DELETE /api/trigger-videos/:id
app.delete('/api/trigger-videos/:id', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  try {
    const deleted = await prisma.personaTriggerVideo.delete({ where: { id: Number(req.params.id) } });
    await deleteFromGCS(deleted.videoUrl);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: '삭제 실패' });
  }
});

// ── Swing Analysis ────────────────────────────────────────

// POST /api/swing-analysis/signed-url
app.post('/api/swing-analysis/signed-url', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    const { mimeType, filename } = req.body;
    if (!mimeType) return res.status(400).json({ error: 'mimeType은 필수입니다.' });
    const ext = (mimeType || 'video/mp4').split('/')[1] || 'mp4';
    const destPath = `users/${payload.userId}/swing/${Date.now()}_${filename || 'video'}.${ext}`;
    const gcs = getGCSStorage();
    const file = gcs.bucket(BUCKET_NAME).file(destPath);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType: mimeType,
    });
    return res.json({ signedUrl, publicUrl: `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}` });
  } catch (e) {
    console.error('[swing signed-url]', e.message);
    return res.status(500).json({ error: '서명 URL 생성 실패' });
  }
});

// POST /api/swing-analysis/analyze
app.post('/api/swing-analysis/analyze', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    const { videoUrl, personaId, mimeType, fileName } = req.body;
    if (!videoUrl || !personaId) return res.status(400).json({ error: '필수 항목 누락' });
    const gcsUri = videoUrl.replace('https://storage.googleapis.com/ai-mp-media/', 'gs://ai-mp-media/');
    const text = await callGeminiVideo(gcsUri, mimeType || 'video/mp4', GOLF_ANALYSIS_PROMPT);
    if (!text) return res.status(500).json({ error: 'Gemini 분석 실패' });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: '분석 결과 파싱 실패' });
    const analysis = JSON.parse(match[0]);
    // 분석 완료 즉시 GCS에서 영상 삭제 (개인정보 보호)
    await deleteFromGCS(videoUrl).catch(() => {});
    const record = await prisma.userSwingAnalysis.create({
      data: { userId: payload.userId, personaId, fileName: fileName || null, analysisJson: JSON.stringify(analysis) },
    });

    // UserMemory에 최신 스윙 분석 요약 upsert
    try {
      const date = new Date().toISOString().slice(0, 10);
      const secs = analysis.sections || [];
      const scoresStr = secs.map(s => `${s.name.replace(' & 셋업', '')} ${s.score}점`).join(' / ');
      const priorities = (analysis.topPriorities || []).slice(0, 3).join(' / ');
      const memContent = `[골프 스윙 분석 - ${date}] 종합 ${analysis.overallScore}점\n구간: ${scoresStr}\n주요 개선점: ${priorities}`;
      const embedding = await getEmbedding(memContent);
      const vectorStr = embedding ? `[${embedding.join(',')}]` : null;
      await prisma.$executeRawUnsafe(
        `DELETE FROM "UserMemory" WHERE "userId" = $1 AND "category" = 'swing_analysis'`,
        payload.userId
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "UserMemory" ("userId","content","embedding","category","createdAt") VALUES ($1,$2,$3::vector,'swing_analysis',NOW())`,
        payload.userId, memContent, vectorStr
      );
    } catch (memErr) {
      console.warn('[swing memory upsert]', memErr.message);
    }

    return res.json({ id: record.id, analysis, createdAt: record.createdAt });
  } catch (e) {
    console.error('[swing analyze]', e.message);
    return res.status(500).json({ error: '분석 실패: ' + e.message });
  }
});

// GET /api/swing-analysis?personaId=xxx
app.get('/api/swing-analysis', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    const { personaId } = req.query;
    const records = await prisma.userSwingAnalysis.findMany({
      where: { userId: payload.userId, ...(personaId ? { personaId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json(records.map(r => ({
      id: r.id, fileName: r.fileName, createdAt: r.createdAt, analysis: JSON.parse(r.analysisJson),
    })));
  } catch (e) {
    return res.status(500).json({ error: '조회 실패' });
  }
});

// DELETE /api/swing-analysis/:id
app.delete('/api/swing-analysis/:id', async (req, res) => {
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
  try {
    const record = await prisma.userSwingAnalysis.findFirst({
      where: { id: parseInt(req.params.id), userId: payload.userId },
    });
    if (!record) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
    await prisma.userSwingAnalysis.delete({ where: { id: record.id } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: '삭제 실패' });
  }
});

// ── Announcements ─────────────────────────────────────────────
app.get('/api/announcements', async (req, res) => {
  try {
    let isAdmin = false;
    try {
      const payload = verifyToken(req);
      if (payload) {
        const u = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
        isAdmin = u?.role === 'ADMIN';
      }
    } catch {}
    const showAll = isAdmin && req.query.all === 'true';
    const list = await prisma.announcement.findMany({
      where: showAll ? {} : { isVisible: true },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
    });
    return res.json(list);
  } catch (e) { return res.status(500).json({ error: '조회 실패' }); }
});

app.post('/api/announcements', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { title, content, category, isPinned, isVisible, personaId } = req.body;
    if (!title || !content) return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    const item = await prisma.announcement.create({
      data: { title, content, category: category || 'update', isPinned: isPinned ?? false, isVisible: isVisible ?? true, personaId: personaId || null },
      include: { persona: { select: { id: true, name: true, introVideoUrl: true, imageUrl: true } } },
    });
    return res.status(201).json(item);
  } catch (e) { return res.status(500).json({ error: '저장 실패' }); }
});

app.put('/api/announcements/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { title, content, category, isPinned, isVisible, personaId } = req.body;
    const item = await prisma.announcement.update({
      where: { id: Number(req.params.id) },
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
    return res.json(item);
  } catch (e) { return res.status(500).json({ error: '수정 실패' }); }
});

app.delete('/api/announcements/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    await prisma.announcement.delete({ where: { id: Number(req.params.id) } });
    return res.json({ ok: true });
  } catch (e) { return res.status(500).json({ error: '삭제 실패' }); }
});

// ── Categories ────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { order: 'asc' },
      include: { _count: { select: { personas: { where: { isVisible: true } } } } },
    });
    return res.json(categories);
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/categories', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { name, order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '카테고리 이름은 필수입니다.' });
    const count = await prisma.category.count();
    const category = await prisma.category.create({
      data: { name: name.trim(), order: order ?? count },
      include: { _count: { select: { personas: { where: { isVisible: true } } } } },
    });
    return res.status(201).json(category);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: '이미 존재하는 카테고리 이름입니다.' });
    return res.status(500).json({ error: '서버 오류' });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { name, order } = req.body;
    const category = await prisma.category.update({
      where: { id: Number(req.params.id) },
      data: { ...(name !== undefined && { name: name.trim() }), ...(order !== undefined && { order }) },
      include: { _count: { select: { personas: { where: { isVisible: true } } } } },
    });
    return res.json(category);
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const u = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (u?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const catId = Number(req.params.id);
    await prisma.persona.updateMany({ where: { categoryId: catId }, data: { categoryId: null } });
    await prisma.category.delete({ where: { id: catId } });
    return res.json({ message: '삭제되었습니다.' });
  } catch (e) { return res.status(500).json({ error: '삭제 실패' }); }
});

// ── Points ────────────────────────────────────────────────────
app.get('/api/points', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const [userData, transactions] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { paidPoints: true, bonusPoints: true } }),
      prisma.pointTransaction.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { persona: { select: { id: true, name: true } } },
      }),
    ]);
    return res.json({ paidPoints: userData?.paidPoints ?? 0, bonusPoints: userData?.bonusPoints ?? 0, points: (userData?.paidPoints ?? 0) + (userData?.bonusPoints ?? 0), transactions });
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/points/stats', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const [totalSpent, byPersona, balloonsSent] = await Promise.all([
      prisma.pointTransaction.aggregate({
        where: { userId: payload.userId, amount: { lt: 0 }, type: 'CHAT' },
        _sum: { amount: true },
      }),
      prisma.pointTransaction.groupBy({
        by: ['personaId'],
        where: { userId: payload.userId, type: 'CHAT' },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'asc' } },
      }),
      prisma.star.aggregate({
        where: { fromUserId: payload.userId },
        _sum: { amount: true, pointsSpent: true },
      }),
    ]);
    const personaIds = byPersona.map(b => b.personaId).filter(Boolean);
    const personaNames = await prisma.persona.findMany({
      where: { id: { in: personaIds } },
      select: { id: true, name: true, imageUrl: true },
    });
    const byPersonaWithName = byPersona.map(b => ({
      personaId: b.personaId,
      spent: Math.abs(b._sum.amount ?? 0),
      persona: personaNames.find(p => p.id === b.personaId),
    }));
    return res.json({
      totalSpent: Math.abs(totalSpent._sum.amount ?? 0),
      byPersona: byPersonaWithName,
      starsSent: balloonsSent._sum.amount ?? 0,
      starsPointsSpent: balloonsSent._sum.pointsSpent ?? 0,
    });
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/points/cost', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { personaId } = req.query;
    if (!personaId) return res.status(400).json({ error: 'personaId 필요' });
    const xpRecord = await prisma.userPersonaXp.findUnique({
      where: { userId_personaId: { userId: payload.userId, personaId } },
    });
    const xp = xpRecord?.xp ?? 0;
    return res.json({ cost: getMessageCost(xp), stage: getStageIndex(xp) + 1, xp });
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/points/admin-grant', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const requestUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
    if (requestUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { email, amount, description } = req.body;
    if (!email || !amount || amount <= 0) return res.status(400).json({ error: 'email과 양수 amount가 필요합니다.' });
    const target = await prisma.user.findUnique({ where: { email }, select: { id: true, paidPoints: true, bonusPoints: true, email: true } });
    if (!target) return res.status(404).json({ error: '해당 이메일 사용자를 찾을 수 없습니다.' });
    const newBonus = target.bonusPoints + amount;
    const newBalance = target.paidPoints + newBonus;
    await prisma.$transaction([
      prisma.user.update({ where: { id: target.id }, data: { bonusPoints: newBonus } }),
      prisma.pointTransaction.create({ data: { userId: target.id, amount, type: 'ADMIN', description: description || '관리자 지급', balanceAfter: newBalance } }),
    ]);
    return res.json({ email: target.email, granted: amount, newBalance });
  } catch (e) {
    console.error('[points/admin-grant]', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

// ── Star Balloon ──────────────────────────────────────────────
app.post('/api/star', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const { personaId, amount, message: msg } = req.body;
    if (!personaId || !amount || amount < 1) return res.status(400).json({ error: '잘못된 요청' });
    const pointsSpent = amount * 10;

    const result = await prisma.$transaction(async (tx) => {
      const userData = await tx.user.findUnique({ where: { id: payload.userId }, select: { paidPoints: true, bonusPoints: true } });
      if (!userData || (userData.paidPoints + userData.bonusPoints) < pointsSpent) throw new Error('INSUFFICIENT_POINTS');
      const bonusDeduct = Math.min(pointsSpent, userData.bonusPoints);
      const paidDeduct = pointsSpent - bonusDeduct;
      const newBonus = userData.bonusPoints - bonusDeduct;
      const newPaid = userData.paidPoints - paidDeduct;
      const newBalance = newBonus + newPaid;
      await tx.user.update({ where: { id: payload.userId }, data: { bonusPoints: newBonus, paidPoints: newPaid } });
      await tx.pointTransaction.create({
        data: { userId: payload.userId, amount: -pointsSpent, type: 'STAR', personaId, balanceAfter: newBalance, description: `스타 ${amount}개` },
      });
      const balloon = await tx.star.create({
        data: { fromUserId: payload.userId, personaId, amount, pointsSpent, message: msg },
      });
      return { balloon, newBalance };
    });

    return res.json(result);
  } catch (e) {
    if (e.message === 'INSUFFICIENT_POINTS') return res.status(402).json({ error: 'INSUFFICIENT_POINTS', message: '포인트가 부족합니다.' });
    return res.status(500).json({ error: '서버 오류' });
  }
});

app.get('/api/star/:personaId/ranking', async (req, res) => {
  try {
    const ranking = await prisma.star.groupBy({
      by: ['fromUserId'],
      where: { personaId: req.params.personaId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });
    const userIds = ranking.map(r => r.fromUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });
    return res.json(ranking.map(r => ({
      user: users.find(u => u.id === r.fromUserId),
      totalBalloons: r._sum.amount ?? 0,
    })));
  } catch (e) { return res.status(500).json({ error: '서버 오류' }); }
});

// ── Admin ─────────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const adminUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
    if (adminUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const users = await prisma.user.findMany({
      select: {
        id: true, email: true, username: true, role: true,
        paidPoints: true, bonusPoints: true, createdAt: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users.map(u => ({
      id: u.id, email: u.email, username: u.username, role: u.role,
      paidPoints: u.paidPoints, bonusPoints: u.bonusPoints,
      createdAt: u.createdAt, sessionCount: u._count.sessions,
    })));
  } catch (e) {
    console.error('[admin/users]', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

app.post('/api/admin/bulk-grant', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
    const adminUser = await prisma.user.findUnique({ where: { id: payload.userId }, select: { role: true } });
    if (adminUser?.role !== 'ADMIN') return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    const { amount, description } = req.body;
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
  } catch (e) {
    console.error('[admin/bulk-grant]', e);
    return res.status(500).json({ error: '서버 오류' });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ Local API server: http://localhost:${PORT}`);
});
