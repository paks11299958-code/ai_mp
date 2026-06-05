#!/usr/bin/env node
/**
 * 현재 DB의 퀵메뉴를 스냅샷 파일로 다시 떠두는 스크립트 (수동 실행 전용).
 *
 *   cd ~/shared-api
 *   node ~/ai_mp/backups/persona-quickmenu/snapshot.cjs <personaId> <출력.json>
 *   # 예) node snapshot.cjs cmopfkd4o000004la2q5p3nle ./dogyeol.json
 *
 * 이후 git add/commit/push 로 백업을 보관할 것.
 */
require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

(async () => {
  const personaId = process.argv[2];
  const out = process.argv[3];
  if (!personaId || !out) { console.error('사용법: node snapshot.cjs <personaId> <출력.json>'); process.exit(1); }
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  try {
    const r = await c.query('SELECT id, name, "quickMenuJson" FROM "Persona" WHERE id=$1', [personaId]);
    if (r.rowCount === 0) { console.error('해당 personaId 없음:', personaId); process.exit(1); }
    const row = r.rows[0];
    const parsed = JSON.parse(row.quickMenuJson || '{}');
    const snapshot = {
      _comment: '퀵메뉴 복원용 스냅샷. 정본은 DB(Persona.quickMenuJson). 평소 수정은 어드민 화면에서. 자동 실행되지 않음.',
      personaId: row.id,
      personaName: row.name,
      snapshotAt: new Date().toISOString().slice(0, 10),
      quickMenuJson: parsed,
    };
    fs.writeFileSync(out, JSON.stringify(snapshot, null, 2));
    console.log('✅ 스냅샷 저장:', out);
    console.log('메뉴:', (parsed.menus || []).map(m => m.label).join(' | '));
  } finally {
    await c.end();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
