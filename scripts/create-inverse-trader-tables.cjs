'use strict';
/**
 * 인버스 ETF 1호가 스캘핑 — Inverse* 테이블 생성 마이그레이션.
 *
 *   node scripts/create-inverse-trader-tables.cjs
 *   npx prisma generate          # ← 실행 후 반드시 클라이언트 재생성
 *
 * 이 프로젝트는 `prisma migrate` 대신 raw SQL 스크립트로 스키마를 반영한다
 * (prisma/migrations 디렉터리가 없다). prisma/schema.prisma 의 Inverse* 모델 6개와
 * 1:1로 맞춘 DDL 이며 전부 IF NOT EXISTS 라 여러 번 돌려도 안전하다.
 *
 * ★DROP 문은 한 줄도 없다 — 기존 테이블/데이터는 건드리지 않는다.
 */
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

// .env.local 로드(다른 마이그레이션 스크립트와 동일한 방식)
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
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
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TABLES = [
    `CREATE TABLE IF NOT EXISTS "InverseTraderConfig" (
        "id"             SERIAL PRIMARY KEY,
        "symbol"         TEXT NOT NULL,
        "symbolName"     TEXT NOT NULL,
        "defaultQty"     INTEGER NOT NULL DEFAULT 1000000,
        "closeBufferMin" INTEGER NOT NULL DEFAULT 10,
        "maxPositionQty" INTEGER NOT NULL DEFAULT 3000000,
        "dailyLossLimit" DOUBLE PRECISION NOT NULL DEFAULT 500000,
        "tradingMode"    TEXT NOT NULL DEFAULT 'SIMULATION',
        "enabled"        BOOLEAN NOT NULL DEFAULT false,
        "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "InverseTraderSession" (
        "id"        TEXT PRIMARY KEY,
        "status"    TEXT NOT NULL DEFAULT 'IDLE',
        "startedAt" TIMESTAMP(3),
        "endedAt"   TIMESTAMP(3),
        "lastError" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "InverseOrder" (
        "id"            SERIAL PRIMARY KEY,
        "sessionId"     TEXT NOT NULL,
        "symbol"        TEXT NOT NULL,
        "side"          TEXT NOT NULL,
        "limitPrice"    INTEGER NOT NULL,
        "orderQty"      INTEGER NOT NULL,
        "filledQty"     INTEGER NOT NULL DEFAULT 0,
        "remainingQty"  INTEGER NOT NULL,
        "status"        TEXT NOT NULL DEFAULT 'PENDING',
        "parentOrderId" INTEGER,
        "brokerOrderId" TEXT,
        "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "InverseFill" (
        "id"        SERIAL PRIMARY KEY,
        "orderId"   INTEGER NOT NULL,
        "symbol"    TEXT NOT NULL,
        "side"      TEXT NOT NULL,
        "fillPrice" INTEGER NOT NULL,
        "fillQty"   INTEGER NOT NULL,
        "filledAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "InversePosition" (
        "id"            SERIAL PRIMARY KEY,
        "sessionId"     TEXT NOT NULL,
        "symbol"        TEXT NOT NULL,
        "qty"           INTEGER NOT NULL DEFAULT 0,
        "avgPrice"      DOUBLE PRECISION NOT NULL DEFAULT 0,
        "realizedPnl"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "unrealizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "InverseDailyStat" (
        "id"           SERIAL PRIMARY KEY,
        "date"         DATE NOT NULL,
        "sessionId"    TEXT,
        "buyQty"       DOUBLE PRECISION NOT NULL DEFAULT 0,
        "buyAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
        "sellQty"      DOUBLE PRECISION NOT NULL DEFAULT 0,
        "sellAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
        "realizedPnl"  DOUBLE PRECISION NOT NULL DEFAULT 0,
        "fillCount"    INTEGER NOT NULL DEFAULT 0,
        "forceSettled" BOOLEAN NOT NULL DEFAULT false,
        "closingQty"   INTEGER NOT NULL DEFAULT 0,
        "note"         TEXT,
        "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),
        "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW()
    )`,
];

const INDEXES = [
    `CREATE INDEX        IF NOT EXISTS "InverseTraderConfig_symbol_idx"        ON "InverseTraderConfig"("symbol")`,
    `CREATE INDEX        IF NOT EXISTS "InverseTraderSession_status_startedAt_idx" ON "InverseTraderSession"("status", "startedAt")`,
    `CREATE INDEX        IF NOT EXISTS "InverseOrder_sessionId_createdAt_idx"  ON "InverseOrder"("sessionId", "createdAt")`,
    `CREATE INDEX        IF NOT EXISTS "InverseOrder_symbol_idx"               ON "InverseOrder"("symbol")`,
    `CREATE INDEX        IF NOT EXISTS "InverseFill_orderId_idx"               ON "InverseFill"("orderId")`,
    `CREATE INDEX        IF NOT EXISTS "InverseFill_symbol_filledAt_idx"       ON "InverseFill"("symbol", "filledAt")`,
    // ★ 세션×종목 유니크 — position upsert(sessionId_symbol)가 이 제약에 의존한다.
    `CREATE UNIQUE INDEX IF NOT EXISTS "InversePosition_sessionId_symbol_key"  ON "InversePosition"("sessionId", "symbol")`,
    // ★ 영업일 유니크 — DailyStat upsert(where: { date })가 이 제약에 의존한다.
    `CREATE UNIQUE INDEX IF NOT EXISTS "InverseDailyStat_date_key"             ON "InverseDailyStat"("date")`,
    `CREATE INDEX        IF NOT EXISTS "InverseDailyStat_sessionId_idx"        ON "InverseDailyStat"("sessionId")`,
];

async function migrate() {
    for (const sql of TABLES) {
        await prisma.$executeRawUnsafe(sql);
    }
    console.log('테이블 6개 생성 완료 (InverseTraderConfig / InverseTraderSession / InverseOrder / InverseFill / InversePosition / InverseDailyStat)');

    for (const sql of INDEXES) {
        await prisma.$executeRawUnsafe(sql);
    }
    console.log('인덱스·유니크 제약 9개 생성 완료');

    const rows = await prisma.$queryRawUnsafe(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name LIKE 'Inverse%'
          ORDER BY table_name`
    );
    console.log('확인:', rows.map(r => r.table_name).join(', '));
}

migrate()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error('마이그레이션 실패:', e);
        await prisma.$disconnect();
        process.exit(1);
    });
