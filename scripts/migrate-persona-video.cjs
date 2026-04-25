const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://aichat_user:aichat_9958@34.50.27.95:5432/aichat',
});

async function main() {
    await client.connect();

    await client.query(`
        CREATE TABLE IF NOT EXISTS "PersonaVideo" (
            "id"        SERIAL PRIMARY KEY,
            "imageId"   INTEGER NOT NULL REFERENCES "PersonaImage"("id") ON DELETE CASCADE,
            "videoUrl"  TEXT NOT NULL,
            "title"     TEXT,
            "order"     INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS "PersonaVideo_imageId_idx" ON "PersonaVideo"("imageId");
    `);

    console.log('PersonaVideo 테이블 생성 완료');
    await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
