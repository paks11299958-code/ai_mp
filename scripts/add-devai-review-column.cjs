'use strict';
/**
 * 개발AI 콘솔 — DevProject."useReview" 칼럼 추가 (2026-08-20).
 *
 *   DATABASE_URL=... node scripts/add-devai-review-column.cjs
 *
 * 허드 메이커-체커(Developer가 만들고 Reviewer가 검증)를 프로젝트별로 켤 수 있게 한다.
 *
 * ★왜 전역 환경변수가 아니라 프로젝트별인가(사장 지시 2026-08-20):
 *   단일 홈페이지처럼 눈으로 보면 되는 작업엔 검증 왕복이 낭비다(비용 2배, pane 2개).
 *   반면 로직이 있는 개발은 검증이 필요하다. 건별로 고르는 게 맞다.
 *
 * ★ADD COLUMN IF NOT EXISTS + DEFAULT false — 여러 번 돌려도 안전하고
 *   기존 프로젝트는 '꺼짐'으로 남아 동작이 바뀌지 않는다.
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
    `ALTER TABLE "DevProject" ADD COLUMN IF NOT EXISTS "useReview" BOOLEAN NOT NULL DEFAULT false`,
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
              WHERE table_name = 'DevProject' AND column_name = 'useReview'`);
        if (c.length) {
            console.log('✅ useReview 칼럼 준비 완료:', c[0].data_type, '기본값', c[0].column_default);
        } else {
            console.log('★useReview 칼럼이 없습니다 — 확인 필요');
            process.exit(1);
        }
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
