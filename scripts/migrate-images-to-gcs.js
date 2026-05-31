/**
 * Persona.imageUrl base64 → GCS 마이그레이션
 * 실행: node scripts/migrate-images-to-gcs.js
 */
const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'ai-mp-media';

// .env.local에서 키 값 읽기 (시크릿은 git 추적되는 코드에 하드코딩하지 않음)
function readEnv(key) {
    const envPath = path.join(__dirname, '../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${key}=`)) {
            let val = trimmed.slice(`${key}=`.length).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            return val;
        }
    }
    return undefined;
}

function loadCredentials() {
    const val = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || readEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (!val) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found');
    return typeof val === 'string' ? JSON.parse(val) : val;
}

async function main() {
    const DB_URL = process.env.DATABASE_URL || readEnv('DATABASE_URL');
    if (!DB_URL) throw new Error('DATABASE_URL not found (.env.local 또는 환경변수)');
    const credentials = loadCredentials();
    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    const { rows } = await client.query(
        `SELECT id, name, "imageUrl" FROM "Persona" WHERE "imageUrl" LIKE 'data:image%' ORDER BY "order"`
    );

    console.log(`\n마이그레이션 대상: ${rows.length}개 페르소나\n`);

    let success = 0, failed = 0;

    for (const row of rows) {
        try {
            const mimeType = row.imageUrl.split(';')[0].split(':')[1] || 'image/png';
            const ext = mimeType.split('/')[1] || 'png';
            const base64Data = row.imageUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const destPath = `personas/${row.id}/profile.${ext}`;

            const file = storage.bucket(BUCKET_NAME).file(destPath);
            await file.save(buffer, {
                metadata: { contentType: mimeType },
                resumable: false,
            });
            const gcsUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;

            await client.query(
                `UPDATE "Persona" SET "imageUrl" = $1 WHERE id = $2`,
                [gcsUrl, row.id]
            );

            console.log(`✅ ${row.name} (${(buffer.length / 1024).toFixed(0)}KB) → ${gcsUrl}`);
            success++;
        } catch (e) {
            console.error(`❌ ${row.name} 실패:`, e.message);
            failed++;
        }
    }

    console.log(`\n완료: 성공 ${success}개, 실패 ${failed}개`);
    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
