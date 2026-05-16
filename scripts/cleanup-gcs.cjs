const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'ai-mp-media';
const DB_URL = 'postgresql://aichat_user:aichat_9958@34.50.27.95:5432/aichat';
const isDryRun = !process.argv.includes('--delete');

function fixPrettyJson(val) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < val.length) {
        const ch = val[i];
        if (ch === '\\' && i + 1 < val.length) {
            if (inString) {
                result += ch + val[i + 1];
            } else {
                result += (val[i + 1] === 'n') ? '\n' : ch + val[i + 1];
            }
            i += 2;
            continue;
        }
        if (ch === '"') inString = !inString;
        result += ch;
        i++;
    }
    return result;
}

function loadCredentials() {
    const envPath = path.join(__dirname, '../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
            let val = trimmed.slice('GOOGLE_APPLICATION_CREDENTIALS_JSON='.length).trim();
            if (val.startsWith('"') && val.endsWith('"')) {
                try {
                    val = JSON.parse(val);
                } catch {
                    val = fixPrettyJson(val.slice(1, -1));
                }
            }
            return typeof val === 'string' ? JSON.parse(val) : val;
        }
    }
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found in .env.local');
}

function extractGcsPath(url) {
    // https://storage.googleapis.com/BUCKET/path/to/file
    const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
    if (url && url.startsWith(prefix)) {
        return url.slice(prefix.length);
    }
    return null;
}

async function getDbUrls(client) {
    const usedPaths = new Set();

    // Persona.imageUrl
    const p = await client.query(`SELECT "imageUrl" FROM "Persona" WHERE "imageUrl" LIKE '%storage.googleapis.com%'`);
    for (const r of p.rows) {
        const gp = extractGcsPath(r.imageUrl);
        if (gp) usedPaths.add(gp);
    }

    // PersonaImage.imageUrl
    const pi = await client.query(`SELECT "imageUrl" FROM "PersonaImage" WHERE "imageUrl" LIKE '%storage.googleapis.com%'`);
    for (const r of pi.rows) {
        const gp = extractGcsPath(r.imageUrl);
        if (gp) usedPaths.add(gp);
    }

    // StockAnalysis.chartImageUrl
    try {
        const sa = await client.query(`SELECT "chartImageUrl" FROM "StockAnalysis" WHERE "chartImageUrl" IS NOT NULL AND "chartImageUrl" LIKE '%storage.googleapis.com%'`);
        for (const r of sa.rows) {
            const gp = extractGcsPath(r.chartImageUrl);
            if (gp) usedPaths.add(gp);
        }
    } catch (e) {
        console.log('  StockAnalysis 테이블 없음 (스킵)');
    }

    // LuxuryVerification.imageUrls (JSON array)
    try {
        const lv = await client.query(`SELECT "imageUrls" FROM "LuxuryVerification" WHERE "imageUrls" IS NOT NULL`);
        for (const r of lv.rows) {
            const urls = Array.isArray(r.imageUrls) ? r.imageUrls : (typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : []);
            for (const url of urls) {
                const gp = extractGcsPath(url);
                if (gp) usedPaths.add(gp);
            }
        }
    } catch (e) {
        console.log('  LuxuryVerification 테이블 없음 (스킵)');
    }

    // UsedItemListing.imageUrls (JSON array)
    try {
        const ul = await client.query(`SELECT "imageUrls" FROM "UsedItemListing" WHERE "imageUrls" IS NOT NULL`);
        for (const r of ul.rows) {
            const urls = Array.isArray(r.imageUrls) ? r.imageUrls : (typeof r.imageUrls === 'string' ? JSON.parse(r.imageUrls) : []);
            for (const url of urls) {
                const gp = extractGcsPath(url);
                if (gp) usedPaths.add(gp);
            }
        }
    } catch (e) {
        console.log('  UsedItemListing 테이블 없음 (스킵)');
    }

    return usedPaths;
}

async function main() {
    console.log(`\n=== GCS 고아 이미지 정리 (${isDryRun ? 'DRY-RUN' : '실제 삭제'}) ===\n`);

    const credentials = loadCredentials();
    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    console.log('1. DB에서 사용 중인 이미지 URL 수집 중...');
    const usedPaths = await getDbUrls(client);
    console.log(`   → 사용 중인 GCS 파일: ${usedPaths.size}개\n`);

    console.log('2. GCS 버킷 파일 목록 조회 중...');
    const [files] = await storage.bucket(BUCKET_NAME).getFiles();
    console.log(`   → 버킷 전체 파일: ${files.length}개\n`);

    const orphans = files.filter(f => !usedPaths.has(f.name));
    const totalSizeBytes = orphans.reduce((sum, f) => sum + parseInt(f.metadata.size || 0), 0);
    const totalSizeMB = (totalSizeBytes / 1024 / 1024).toFixed(2);

    console.log(`3. 고아 파일: ${orphans.length}개 (${totalSizeMB} MB)\n`);

    if (orphans.length === 0) {
        console.log('정리할 고아 이미지가 없습니다.');
        await client.end();
        return;
    }

    // 목록 출력 (최대 50개)
    const preview = orphans.slice(0, 50);
    for (const f of preview) {
        const sizeMB = (parseInt(f.metadata.size || 0) / 1024 / 1024).toFixed(3);
        console.log(`  - ${f.name} (${sizeMB} MB)`);
    }
    if (orphans.length > 50) {
        console.log(`  ... 외 ${orphans.length - 50}개`);
    }

    if (isDryRun) {
        console.log('\n[DRY-RUN] 실제 삭제는 --delete 옵션으로 실행하세요.');
    } else {
        console.log('\n4. 삭제 중...');
        let deleted = 0;
        let failed = 0;
        for (const f of orphans) {
            try {
                await storage.bucket(BUCKET_NAME).file(f.name).delete();
                console.log(`  ✅ 삭제: ${f.name}`);
                deleted++;
            } catch (e) {
                console.error(`  ❌ 실패: ${f.name} - ${e.message}`);
                failed++;
            }
        }
        console.log(`\n완료: 삭제 ${deleted}개, 실패 ${failed}개 / 절약 용량: ${totalSizeMB} MB`);
    }

    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
