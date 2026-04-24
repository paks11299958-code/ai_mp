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
    CREATE TABLE IF NOT EXISTS "PersonaImage" (
      "id"          SERIAL PRIMARY KEY,
      "personaId"   TEXT NOT NULL,
      "imageUrl"    TEXT NOT NULL,
      "description" TEXT,
      "isMain"      BOOLEAN NOT NULL DEFAULT false,
      "order"       INTEGER NOT NULL DEFAULT 0,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PersonaImage_personaId_fkey"
        FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE CASCADE
    );
  `);
  console.log('✅ PersonaImage 테이블 생성 완료');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
