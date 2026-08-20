'use strict';
/**
 * InverseTraderConfig 에 손절 설정 3개 컬럼 추가.
 *
 *   DATABASE_URL=... node scripts/add-inverse-stoploss-columns.cjs
 *
 * ★ADD COLUMN IF NOT EXISTS 만 쓴다 — DROP 문 없음, 여러 번 돌려도 안전.
 *   기존 행에는 DEFAULT 값이 채워진다(손절 2% / 물타기 10회 / -3%).
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
    `ALTER TABLE "InverseTraderConfig" ADD COLUMN IF NOT EXISTS "stopLossPct" DOUBLE PRECISION NOT NULL DEFAULT 2`,
    `ALTER TABLE "InverseTraderConfig" ADD COLUMN IF NOT EXISTS "maxAddBuys" INTEGER NOT NULL DEFAULT 10`,
    `ALTER TABLE "InverseTraderConfig" ADD COLUMN IF NOT EXISTS "noAddBuyBelowPct" DOUBLE PRECISION NOT NULL DEFAULT 3`,
];

(async () => {
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
        for (const sql of SQL) await prisma.$executeRawUnsafe(sql);
        const cols = await prisma.$queryRawUnsafe(
            `SELECT column_name FROM information_schema.columns
             WHERE table_name='InverseTraderConfig'
               AND column_name IN ('stopLossPct','maxAddBuys','noAddBuyBelowPct')
             ORDER BY column_name`);
        console.log('컬럼 확인:', cols.map(c => c.column_name).join(', ') || '(없음)');
        console.log(cols.length === 3 ? '✅ 손절 설정 3개 컬럼 준비 완료' : '★일부 누락 — 확인 필요');
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
