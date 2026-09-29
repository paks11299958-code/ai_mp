'use strict';
/**
 * 충전 유도 문구 A/B — ChargeAbEvent 테이블 생성(docs/ab-charge-copy.md).
 *
 *   DATABASE_URL=... node scripts/create-charge-ab-event-table.cjs
 *
 * ★추가 전용: CREATE TABLE/INDEX IF NOT EXISTS 만 쓴다 — DROP·ALTER 없음, 여러 번 돌려도 안전.
 * ★User FK를 걸지 않는다(탈퇴로 과거 실험 행이 사라지지 않게). schema.prisma도 관계 없음.
 * ★개발 서버(서버2)에서는 .env.local의 외부IP(34.50.27.95)가 막혀 있다 —
 *   DATABASE_URL의 호스트를 내부IP 10.178.0.2로 바꿔 넘겨야 붙는다.
 */
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const t = line.trim();
        if (!t || t.startsWith('#')) return;
        const i = t.indexOf('=');
        if (i > 0 && !process.env[t.slice(0, i).trim()]) {
            process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        }
    });
}

const SQL = [
`CREATE TABLE IF NOT EXISTS "ChargeAbEvent" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "experimentKey" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "packageId" TEXT,
  "orderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "ChargeAbEvent_userId_idx" ON "ChargeAbEvent"("userId")`,
`CREATE INDEX IF NOT EXISTS "ChargeAbEvent_experimentKey_idx" ON "ChargeAbEvent"("experimentKey")`,
];

(async () => {
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
        for (const sql of SQL) await prisma.$executeRawUnsafe(sql);
        const cols = await prisma.$queryRawUnsafe(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'ChargeAbEvent' ORDER BY ordinal_position`);
        const idx = await prisma.$queryRawUnsafe(
            `SELECT indexname FROM pg_indexes WHERE tablename = 'ChargeAbEvent' ORDER BY indexname`);
        console.log('컬럼:', cols.map(c => c.column_name).join(', '));
        console.log('인덱스:', idx.map(i => i.indexname).join(', '));
        console.log(cols.length === 8 && idx.length === 3 ? '✅ ChargeAbEvent 준비 완료' : '★일부 누락 — 확인 필요');
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
