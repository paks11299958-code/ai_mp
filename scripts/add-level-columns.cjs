'use strict';
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

function fixPrettyJson(val) {
  let result = '', inString = false, i = 0;
  while (i < val.length) {
    const ch = val[i];
    if (ch === '\\' && i + 1 < val.length) {
      if (inString) { result += ch + val[i+1]; }
      else { result += (val[i+1] === 'n') ? '\n' : ch + val[i+1]; }
      i += 2; continue;
    }
    if (ch === '"') inString = !inString;
    result += ch; i++;
  }
  return result;
}

const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
content.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx === -1) return;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx+1).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    try { val = JSON.parse(val); } catch { val = fixPrettyJson(val.slice(1,-1)); }
  } else if (val.startsWith("'") && val.endsWith("'")) { val = val.slice(1,-1); }
  if (!process.env[key]) process.env[key] = val;
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function migrate() {
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0');
  console.log('User.xp 추가 완료');
  await prisma.$executeRawUnsafe('ALTER TABLE "PersonaImage" ADD COLUMN IF NOT EXISTS "requiredLevel" INTEGER NOT NULL DEFAULT 1');
  console.log('PersonaImage.requiredLevel 추가 완료');
  await prisma.$executeRawUnsafe('ALTER TABLE "PersonaVideo" ADD COLUMN IF NOT EXISTS "requiredLevel" INTEGER NOT NULL DEFAULT 1');
  console.log('PersonaVideo.requiredLevel 추가 완료');
  await prisma.$disconnect();
  console.log('마이그레이션 완료!');
}

migrate().catch(e => { console.error('[오류]', e.message); process.exit(1); });
