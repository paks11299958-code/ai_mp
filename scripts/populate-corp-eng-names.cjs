#!/usr/bin/env node
/**
 * CorpCode 테이블의 corpNameEng 컬럼을 Yahoo Finance 검색 API로 채운다.
 * 상장 종목(stockCode 있는 것)만 대상 — 약 3,965건
 * 실행: node scripts/populate-corp-eng-names.cjs
 */

'use strict';

const { Client } = require('pg');

const DB_URL = 'postgresql://aichat_user:aichat_9958@localhost:5432/aichat';
const DELAY_MS = 150;   // 요청 간 딜레이
const BATCH_LOG = 50;   // N건마다 진행 로그

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchEngName(stockCode) {
    for (const suffix of ['.KS', '.KQ']) {
        const symbol = encodeURIComponent(stockCode + suffix);
        const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&lang=en-US&region=KR&quotesCount=3`;
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok) continue;
            const data = await res.json();
            const match = (data.quotes || []).find(q => q.symbol === stockCode + suffix);
            if (match?.shortname) return match.shortname;
            if (match?.longname) return match.longname;
        } catch {
            // 타임아웃/네트워크 오류 무시
        }
    }
    return null;
}

async function main() {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    // 영문명 아직 없는 상장 종목만 처리
    const { rows } = await client.query(`
        SELECT "corpCode", "stockCode"
        FROM "CorpCode"
        WHERE "stockCode" IS NOT NULL AND "stockCode" != ''
          AND ("corpNameEng" IS NULL OR "corpNameEng" = '')
        ORDER BY "stockCode"
    `);

    console.log(`[시작] 처리 대상: ${rows.length}건`);

    let updated = 0;
    let notFound = 0;

    for (let i = 0; i < rows.length; i++) {
        const { corpCode, stockCode } = rows[i];
        const engName = await fetchEngName(stockCode);

        if (engName) {
            await client.query(
                `UPDATE "CorpCode" SET "corpNameEng" = $1 WHERE "corpCode" = $2`,
                [engName, corpCode]
            );
            updated++;
        } else {
            notFound++;
        }

        if ((i + 1) % BATCH_LOG === 0) {
            console.log(`[진행] ${i + 1}/${rows.length} — 업데이트: ${updated}, 미발견: ${notFound}`);
        }

        await sleep(DELAY_MS);
    }

    console.log(`\n[완료] 전체: ${rows.length} | 업데이트: ${updated} | 미발견: ${notFound}`);
    await client.end();
}

main().catch(err => {
    console.error('[오류]', err);
    process.exit(1);
});
