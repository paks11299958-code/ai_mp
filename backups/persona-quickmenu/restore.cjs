#!/usr/bin/env node
/**
 * 퀵메뉴 복원 스크립트 (사고 시 수동 실행 전용 — 자동 실행되지 않음).
 * 스냅샷 파일의 quickMenuJson을 해당 페르소나의 DB 컬럼에 덮어쓴다.
 *
 *   cd ~/shared-api
 *   node ~/ai_mp/backups/persona-quickmenu/restore.cjs <스냅샷.json>
 *
 * DATABASE_URL은 shared-api/.env에서 읽으므로 shared-api 디렉터리에서 실행할 것.
 * 덮어쓰기 전 현재 DB 값을 같은 폴더에 .pre-restore-<timestamp>.json 으로 백업한다.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
  const file = process.argv[2];
  if (!file) { console.error('사용법: node restore.cjs <스냅샷.json>'); process.exit(1); }
  const snap = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!snap.personaId || !snap.quickMenuJson) {
    console.error('스냅샷 형식 오류: personaId / quickMenuJson 필요'); process.exit(1);
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const cur = await c.query('SELECT "quickMenuJson" FROM "Persona" WHERE id=$1', [snap.personaId]);
    if (cur.rowCount === 0) { console.error('해당 personaId 없음:', snap.personaId); process.exit(1); }

    // 덮어쓰기 전 현재 값 백업
    const bak = path.join(path.dirname(file), `.pre-restore-${Date.now()}.json`);
    fs.writeFileSync(bak, cur.rows[0].quickMenuJson || '{}');
    console.log('현재 값 백업:', bak);

    const json = JSON.stringify(snap.quickMenuJson);
    await c.query('UPDATE "Persona" SET "quickMenuJson"=$1 WHERE id=$2', [json, snap.personaId]);
    console.log('✅ 복원 완료:', snap.personaName || snap.personaId);
    console.log('메뉴:', (snap.quickMenuJson.menus || []).map(m => m.label).join(' | '));
  } finally {
    await c.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
