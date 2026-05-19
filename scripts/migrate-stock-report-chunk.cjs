'use strict';
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
content.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('='); if (idx === -1) return;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) { try { val = JSON.parse(val); } catch { val = val.slice(1, -1); } }
  else if (val.startsWith("'") && val.endsWith("'")) { val = val.slice(1, -1); }
  if (!process.env[key]) process.env[key] = val;
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function migrate() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StockReportChunk" (
      "id"          SERIAL PRIMARY KEY,
      "userId"      INTEGER NOT NULL,
      "ticker"      TEXT NOT NULL,
      "stockName"   TEXT NOT NULL,
      "reportDate"  TEXT NOT NULL,
      "quarter"     TEXT,
      "chunkIndex"  INTEGER NOT NULL,
      "content"     TEXT NOT NULL,
      "embedding"   vector(768),
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StockReportChunk_userId_ticker_idx"
    ON "StockReportChunk"("userId", "ticker")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StockReportChunk_embedding_idx"
    ON "StockReportChunk" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100)
  `);
  console.log('StockReportChunk 테이블 생성 완료');
  await prisma.$disconnect();
}

migrate().catch(e => { console.error('[오류]', e.message); process.exit(1); });
