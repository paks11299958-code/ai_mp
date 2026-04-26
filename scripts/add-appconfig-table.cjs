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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppConfig" (
      "key"       TEXT NOT NULL PRIMARY KEY,
      "value"     TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);
  console.log('AppConfig 테이블 생성 완료');
  await prisma.$disconnect();
}

migrate().catch(e => { console.error('[오류]', e.message); process.exit(1); });
