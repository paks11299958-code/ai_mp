'use strict';
/**
 * 개발AI 콘솔 — DevProject* 테이블 생성.
 *
 *   DATABASE_URL=... node scripts/create-devai-tables.cjs
 *
 * ★CREATE TABLE IF NOT EXISTS 만 쓴다 — DROP 문 없음, 여러 번 돌려도 안전.
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
`CREATE TABLE IF NOT EXISTS "DevProject" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "herdrProjectId" TEXT,
  "workdir" TEXT NOT NULL DEFAULT '/home/paks11299958/ai_mp',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "DevProject_status_updatedAt_idx" ON "DevProject"("status","updatedAt")`,

`CREATE TABLE IF NOT EXISTS "DevProjectVersion" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "DevProject"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "features" TEXT NOT NULL DEFAULT '',
  "specBody" TEXT NOT NULL DEFAULT '',
  "refUrls" TEXT NOT NULL DEFAULT '[]',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE UNIQUE INDEX IF NOT EXISTS "DevProjectVersion_projectId_version_key" ON "DevProjectVersion"("projectId","version")`,

`CREATE TABLE IF NOT EXISTS "DevProjectFile" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "DevProject"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "DevProjectFile_projectId_kind_idx" ON "DevProjectFile"("projectId","kind")`,

`CREATE TABLE IF NOT EXISTS "DevProjectEvent" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "DevProject"("id") ON DELETE CASCADE,
  "actor" TEXT NOT NULL DEFAULT 'system',
  "phase" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "meta" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "DevProjectEvent_projectId_at_idx" ON "DevProjectEvent"("projectId","at")`,

`CREATE TABLE IF NOT EXISTS "DevProjectResult" (
  "id" SERIAL PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE REFERENCES "DevProject"("id") ON DELETE CASCADE,
  "deployUrl" TEXT,
  "summary" TEXT,
  "commits" TEXT NOT NULL DEFAULT '[]',
  "designSourceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
];

(async () => {
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
        for (const sql of SQL) await prisma.$executeRawUnsafe(sql);
        const t = await prisma.$queryRawUnsafe(
            `SELECT tablename FROM pg_tables WHERE tablename LIKE 'DevProject%' ORDER BY tablename`);
        console.log('생성된 테이블:', t.length, '개');
        t.forEach(x => console.log('  ✓', x.tablename));
        console.log(t.length === 5 ? '✅ 개발AI 테이블 준비 완료' : '★일부 누락 — 확인 필요');
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
