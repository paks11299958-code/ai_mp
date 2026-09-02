'use strict';
/**
 * AI 아바타 어드민 — AiAvatar* 테이블 생성 (Phase 2).
 *
 *   DATABASE_URL=... node scripts/create-ai-avatar-tables.cjs
 *
 * ★CREATE TABLE IF NOT EXISTS 만 쓴다 — DROP 문 없음, 여러 번 돌려도 안전.
 *   `prisma db push`는 절대 금지다. 운영 DB에는 schema.prisma에 없는 실재 테이블이
 *   있어 push가 그것들을 지우려 든다(work_lessons.md). 신규 테이블은 raw SQL 만.
 *
 * 스키마 근거: doc/features/ai_avatar_admin.md §7.
 * ★입력 사진과 생성 영상은 bytea 로 넣지 않는다 — 객체 저장소 키(storageKey)만 저장한다.
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
`CREATE TABLE IF NOT EXISTS "AiAvatarProject" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "personaName" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'REFERENCE',
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "AiAvatarProject_stage_updatedAt_idx" ON "AiAvatarProject"("stage","updatedAt")`,

// kind: REFERENCE_IMAGE | IDLE_VIDEO | SPEAKING_VIDEO | REVIEW_BOARD
// sha256 으로 같은 파일 재업로드를 알아보고, 게시 시 체크섬 대조에 쓴다(문서 §6).
`CREATE TABLE IF NOT EXISTS "AiAvatarAsset" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "AiAvatarProject"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL DEFAULT 0,
  "sha256" TEXT NOT NULL,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "AiAvatarAsset_projectId_kind_idx" ON "AiAvatarAsset"("projectId","kind")`,

// status: QUEUED | RUNNING | READY | FAILED | CANCELLED
// ★같은 프로젝트·kind 로 동시에 두 작업이 돌지 않게 하는 멱등키를 부분 유니크 인덱스로 건다.
//   (문서 §6 — 앱 레벨 검사만 두면 동시 요청에서 새치기가 난다.)
`CREATE TABLE IF NOT EXISTS "AiAvatarJob" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "AiAvatarProject"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "inputJson" TEXT,
  "outputJson" TEXT,
  "errorCode" TEXT,
  "createdBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
)`,
`CREATE INDEX IF NOT EXISTS "AiAvatarJob_projectId_createdAt_idx" ON "AiAvatarJob"("projectId","createdAt")`,
`CREATE UNIQUE INDEX IF NOT EXISTS "AiAvatarJob_active_key"
  ON "AiAvatarJob"("projectId","kind") WHERE "status" IN ('QUEUED','RUNNING')`,

// target 은 allowlist('consult' | 'aiworld')로만 들어온다. previousAssetId 가 롤백 근거다.
`CREATE TABLE IF NOT EXISTS "AiAvatarPublication" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "AiAvatarProject"("id") ON DELETE CASCADE,
  "target" TEXT NOT NULL,
  "assetId" TEXT NOT NULL REFERENCES "AiAvatarAsset"("id"),
  "previousAssetId" TEXT REFERENCES "AiAvatarAsset"("id"),
  "publishedBy" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "AiAvatarPublication_target_createdAt_idx" ON "AiAvatarPublication"("target","createdAt")`,

// 감사 로그는 프로젝트가 지워져도 남아야 하므로 FK 를 걸지 않는다(문서 §6 "모든 동작을 감사 로그에").
`CREATE TABLE IF NOT EXISTS "AiAvatarAudit" (
  "id" SERIAL PRIMARY KEY,
  "actorId" INTEGER,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "detailJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS "AiAvatarAudit_createdAt_idx" ON "AiAvatarAudit"("createdAt")`,
];

const EXPECTED = ['AiAvatarAsset', 'AiAvatarAudit', 'AiAvatarJob', 'AiAvatarProject', 'AiAvatarPublication'];

(async () => {
    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
        for (const sql of SQL) await prisma.$executeRawUnsafe(sql);
        const t = await prisma.$queryRawUnsafe(
            `SELECT tablename FROM pg_tables WHERE tablename LIKE 'AiAvatar%' ORDER BY tablename`);
        const got = t.map(x => x.tablename);
        console.log('생성된 테이블:', got.length, '개');
        got.forEach(x => console.log('  ✓', x));
        const missing = EXPECTED.filter(e => !got.includes(e));
        if (missing.length) {
            console.error('★누락:', missing.join(', '));
            process.exit(1);
        }
        console.log('✅ AI 아바타 테이블 준비 완료');
    } finally {
        await prisma.$disconnect();
    }
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
