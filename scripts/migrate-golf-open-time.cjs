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
  // GolfCourse: 예약 오픈 규칙 컬럼 추가
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "GolfCourse"
      ADD COLUMN IF NOT EXISTS "advanceDays"  INTEGER NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "openHour"     INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "openMinute"   INTEGER NOT NULL DEFAULT 0
  `);
  console.log('GolfCourse: advanceDays/openHour/openMinute 컬럼 추가 완료');

  // GolfBookingSchedule: openAt 컬럼 추가 (실제 예약 오픈 시각)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "GolfBookingSchedule"
      ADD COLUMN IF NOT EXISTS "openAt" TIMESTAMP(3)
  `);
  console.log('GolfBookingSchedule: openAt 컬럼 추가 완료');

  // 청주떼제베CC 기본값 설정 (30일 전 00:00 KST)
  await prisma.$executeRawUnsafe(`
    UPDATE "GolfCourse"
    SET "advanceDays" = 30, "openHour" = 0, "openMinute" = 0
    WHERE "bookerType" = 'adtgv'
  `);
  console.log('청주떼제베CC advanceDays=30, openHour=0, openMinute=0 설정 완료');

  await prisma.$disconnect();
}

migrate().catch(e => { console.error('[오류]', e.message); process.exit(1); });
