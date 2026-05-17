/**
 * GCS 고아 이미지 정리 스크립트
 *
 * DB의 모든 텍스트 컬럼을 자동 탐색해 GCS URL을 수집합니다.
 * 새 메뉴/테이블이 추가되어도 스크립트 수정 없이 자동 반영됩니다.
 *
 * 사용법:
 *   node scripts/cleanup-gcs.cjs           → dry-run (삭제 없이 목록만)
 *   node scripts/cleanup-gcs.cjs --delete  → 실제 삭제
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = 'ai-mp-media';
const GCS_PREFIX  = `https://storage.googleapis.com/${BUCKET_NAME}/`;
const DB_URL      = process.env.DATABASE_URL || 'postgresql://aichat_user:aichat_9958@localhost:5432/aichat';
const isDryRun    = !process.argv.includes('--delete');

function extractGcsPath(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith(GCS_PREFIX)) return url.slice(GCS_PREFIX.length);
    if (url.startsWith(`gs://${BUCKET_NAME}/`)) return url.slice(`gs://${BUCKET_NAME}/`.length);
    return null;
}

function collectFromValue(set, val) {
    if (!val) return;
    const trimmed = val.trim();

    // JSON 배열인 경우 (imageUrls 같은 컬럼)
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed);
            for (const item of arr) {
                const p = extractGcsPath(item);
                if (p) set.add(p);
            }
        } catch {}
        return;
    }

    // JSON 객체 안에 GCS URL이 포함된 경우 (quickMenuJson 등)
    if (trimmed.startsWith('{') && trimmed.includes(GCS_PREFIX)) {
        const matches = trimmed.match(/https:\/\/storage\.googleapis\.com\/[^\s"']+/g) || [];
        for (const m of matches) {
            const p = extractGcsPath(m);
            if (p) set.add(p);
        }
        return;
    }

    // 단일 URL
    const p = extractGcsPath(trimmed);
    if (p) set.add(p);
}

async function collectAllGcsUrlsFromDb(client) {
    const used = new Set();

    // information_schema에서 모든 텍스트 컬럼 동적 수집
    const { rows: columns } = await client.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('text', 'character varying', 'character', 'varchar')
        ORDER BY table_name, column_name
    `);

    console.log(`   스캔 대상: ${columns.length}개 컬럼`);

    for (const { table_name, column_name } of columns) {
        try {
            // GCS URL 패턴이 포함된 행만 조회
            const { rows } = await client.query(
                `SELECT "${column_name}" FROM "${table_name}"
                 WHERE "${column_name}" IS NOT NULL
                   AND (
                       "${column_name}" LIKE $1
                    OR "${column_name}" LIKE $2
                   )`,
                [`%${GCS_PREFIX}%`, `%gs://${BUCKET_NAME}/%`]
            );

            if (rows.length > 0) {
                console.log(`   ✓ ${table_name}.${column_name}: ${rows.length}행`);
                for (const row of rows) {
                    collectFromValue(used, row[column_name]);
                }
            }
        } catch {
            // 특수 타입이나 접근 불가 컬럼은 무시
        }
    }

    return used;
}

async function main() {
    console.log(`\n=== GCS 고아 파일 정리 (${isDryRun ? 'DRY-RUN' : '실제 삭제'}) ===\n`);

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수가 없습니다.');
    const credentials = JSON.parse(credsJson);

    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const client  = new Client({ connectionString: DB_URL });
    await client.connect();

    try {
        console.log('1. DB 전체 컬럼 자동 탐색 중...');
        const usedPaths = await collectAllGcsUrlsFromDb(client);
        console.log(`\n   → 사용 중인 GCS 파일: ${usedPaths.size}개\n`);

        console.log('2. GCS 버킷 전체 파일 목록 조회 중...');
        const [files] = await storage.bucket(BUCKET_NAME).getFiles();
        console.log(`   → 버킷 전체 파일: ${files.length}개\n`);

        const orphans   = files.filter(f => !usedPaths.has(f.name));
        const totalBytes = orphans.reduce((sum, f) => sum + parseInt(f.metadata.size || 0), 0);
        const totalMB   = (totalBytes / 1024 / 1024).toFixed(2);

        console.log(`3. 고아 파일: ${orphans.length}개 (${totalMB} MB)\n`);

        if (orphans.length === 0) {
            console.log('정리할 고아 파일이 없습니다. 깨끗합니다 ✅');
            return;
        }

        const preview = orphans.slice(0, 50);
        for (const f of preview) {
            const sizeMB = (parseInt(f.metadata.size || 0) / 1024 / 1024).toFixed(3);
            console.log(`  - ${f.name} (${sizeMB} MB)`);
        }
        if (orphans.length > 50) console.log(`  ... 외 ${orphans.length - 50}개`);

        if (isDryRun) {
            console.log('\n[DRY-RUN] 실제 삭제를 원하면 --delete 옵션으로 실행하세요.');
        } else {
            console.log('\n4. 삭제 중...');
            let deleted = 0, failed = 0;
            for (const f of orphans) {
                try {
                    await storage.bucket(BUCKET_NAME).file(f.name).delete();
                    console.log(`  ✅ 삭제: ${f.name}`);
                    deleted++;
                } catch (e) {
                    console.error(`  ❌ 실패: ${f.name} — ${e.message}`);
                    failed++;
                }
            }
            console.log(`\n완료: 삭제 ${deleted}개 / 실패 ${failed}개 / 절약 ${totalMB} MB`);
        }
    } finally {
        await client.end();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
