const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

const BUCKET_NAME = 'ai-mp-media';
const DB_URL = 'postgresql://aichat_user:aichat_9958@34.50.27.95:5432/aichat';

// .env.local에서 GCP 서비스 계정 읽기
function loadCredentials() {
    const envPath = path.join(__dirname, '../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
            let val = trimmed.slice('GOOGLE_APPLICATION_CREDENTIALS_JSON='.length).trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"');
            return JSON.parse(val);
        }
    }
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found in .env.local');
}

async function uploadToGCS(storage, buffer, destPath, mimeType) {
    const bucket = storage.bucket(BUCKET_NAME);
    const file = bucket.file(destPath);
    await file.save(buffer, { metadata: { contentType: mimeType }, resumable: false });
    await file.makePublic();
    return `https://storage.googleapis.com/${BUCKET_NAME}/${destPath}`;
}

async function main() {
    const credentials = loadCredentials();
    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const client = new Client({ connectionString: DB_URL });
    await client.connect();

    const { rows } = await client.query(
        `SELECT id, "personaId", "imageUrl" FROM "PersonaImage" WHERE "imageUrl" LIKE 'data:%'`
    );

    console.log(`base64 이미지 ${rows.length}개 마이그레이션 시작...`);

    let success = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            const mimeType = row.imageUrl.split(';')[0].split(':')[1] || 'image/jpeg';
            const ext = mimeType.split('/')[1] || 'jpg';
            const base64Data = row.imageUrl.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const destPath = `personas/${row.personaId}/images/${row.id}.${ext}`;

            const gcsUrl = await uploadToGCS(storage, buffer, destPath, mimeType);
            await client.query(`UPDATE "PersonaImage" SET "imageUrl" = $1 WHERE id = $2`, [gcsUrl, row.id]);

            console.log(`✅ [${row.id}] → ${gcsUrl}`);
            success++;
        } catch (e) {
            console.error(`❌ [${row.id}] 실패:`, e.message);
            failed++;
        }
    }

    console.log(`\n완료: 성공 ${success}개, 실패 ${failed}개`);
    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
