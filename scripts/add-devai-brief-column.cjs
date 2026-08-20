'use strict';
/**
 * 개발AI 콘솔 — DevProjectVersion."brief" 칼럼 추가 (2026-08-20).
 *
 *   DATABASE_URL=... node scripts/add-devai-brief-column.cjs
 *
 * 홈페이지 요구사항(상호명·서비스·톤앤매너·연락처 등)을 담는다.
 *
 * ★칼럼을 15개로 쪼개지 않고 JSON 한 칸에 둔 이유: 항목이 계속 늘어날 자리이고,
 *   버전마다 통째로 스냅샷돼야 '비포/애프터' 비교가 그대로 성립한다.
 *
 * ★ADD COLUMN IF NOT EXISTS + DEFAULT '{}' 만 쓴다 — 여러 번 돌려도 안전하고,
 *   기존 행은 빈 객체로 채워져 기존 프로젝트가 깨지지 않는다.
 *   prisma migrate 대신 raw SQL 을 쓰는 것은 이 프로젝트의 기존 방식이다
 *   (prisma/migrations 디렉터리가 없다).
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
    `ALTER TABLE "DevProjectVersion" ADD COLUMN IF NOT EXISTS "brief" TEXT NOT NULL DEFAULT '{}'`,
];

(async () => {
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
        for (const sql of SQL) await prisma.$executeRawUnsafe(sql);
        const c = await prisma.$queryRawUnsafe(
            `SELECT column_name, data_type, column_default
               FROM information_schema.columns
              WHERE table_name = 'DevProjectVersion' AND column_name = 'brief'`);
        if (c.length) {
            console.log('✅ brief 칼럼 준비 완료:', c[0].data_type, '기본값', c[0].column_default);
        } else {
            console.log('★brief 칼럼이 없습니다 — 확인 필요');
            process.exit(1);
        }
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
