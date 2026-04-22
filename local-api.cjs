'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./src/generated/prisma/client.js');
const fs = require('fs');
const path = require('path');

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
app.use(express.json({ limit: '10mb' }));

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
    return res.status(201).json({ user, token });
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
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    const { password: _p, ...safeUser } = user;
    const token = signToken(user.id);
    res.setHeader('Set-Cookie', tokenCookie(token));
    return res.json({ user: safeUser, token });
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
      select: { id: true, email: true, username: true, role: true },
    });
    if (!user) return res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return res.json({ user });
  } catch (e) {
    return res.status(401).json({ error: '인증이 만료되었습니다.' });
  }
});

// ── Personas ──────────────────────────────────────────────────
app.get('/api/personas', async (req, res) => {
  try {
    const payload = verifyToken(req);
    if (!payload) return res.status(401).json({ error: '인증이 필요합니다.' });
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
    const messages = await prisma.message.findMany({
      where: { sessionId: Number(req.params.id) },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(messages);
  } catch (e) {
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
    return res.status(201).json(message);
  } catch (e) {
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

app.listen(PORT, () => {
  console.log(`\n✅ Local API server: http://localhost:${PORT}`);
});
