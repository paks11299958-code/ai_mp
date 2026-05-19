'use strict';
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
content.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx === -1) return;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    try { val = JSON.parse(val); } catch { val = val.slice(1, -1); }
  } else if (val.startsWith("'") && val.endsWith("'")) { val = val.slice(1, -1); }
  if (!process.env[key]) process.env[key] = val;
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function migrate() {
  // 누락된 컬럼 추가
  const alterCols = [
    `ALTER TABLE "GolfCourse" ADD COLUMN IF NOT EXISTS "bookerType" TEXT`,
    `ALTER TABLE "GolfCourse" ADD COLUMN IF NOT EXISTS "loginId"    TEXT`,
    `ALTER TABLE "GolfCourse" ADD COLUMN IF NOT EXISTS "loginPw"    TEXT`,
    `ALTER TABLE "GolfCourse" ADD COLUMN IF NOT EXISTS "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
    `ALTER TABLE "GolfCourse" ADD COLUMN IF NOT EXISTS "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
  ];
  for (const sql of alterCols) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log('컬럼 추가 완료 (bookerType, loginId, loginPw, createdAt, updatedAt)');

  // 인덱스
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "GolfCourse_sido_sigungu_idx"
    ON "GolfCourse"("sido", "sigungu")
  `);
  console.log('인덱스 생성 완료');

  // 청주떼제베CC의 bookerType 업데이트 (name으로 찾아서)
  await prisma.$executeRawUnsafe(`
    UPDATE "GolfCourse"
    SET "bookerType" = 'adtgv', "hasAuto" = true, "bookingUrl" = 'https://www.adtgv.co.kr', "updatedAt" = NOW()
    WHERE name = '청주떼제베CC' AND "bookerType" IS NULL
  `);
  console.log('청주떼제베CC bookerType 업데이트 완료');

  await prisma.$disconnect();
}

migrate().catch(e => { console.error('[오류]', e.message); process.exit(1); });
