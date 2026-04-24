'use strict';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  try {
    const content = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    });
  } catch (e) {
    console.warn('.env.local not found');
  }
}
loadEnvLocal();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log('✅ DB 연결 성공');

  await client.query(`
    CREATE TABLE IF NOT EXISTS "ConversationSummary" (
      "id"           SERIAL PRIMARY KEY,
      "sessionId"    INTEGER NOT NULL UNIQUE,
      "summary"      TEXT NOT NULL,
      "messageCount" INTEGER NOT NULL,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ConversationSummary_sessionId_fkey"
        FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE
    );
  `);
  console.log('✅ ConversationSummary 테이블 생성 완료');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
