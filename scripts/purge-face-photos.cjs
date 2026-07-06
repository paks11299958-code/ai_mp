/**
 * 얼굴 사진 개인정보 보존기간 파기 (2026-07-06, 개인정보 최소보존 정책)
 *
 * 정책(사장 승인):
 *   - 미래의나(age-transform): 저장 후 90일 경과 시 DB 행 + GCS 이미지 파기.
 *   - 헤어 합성(hair-tryon): DB 미저장(1회성 결과물)이라 GCS 생성 7일 경과분 파기.
 *
 * 고아 정리(cleanup-gcs.cjs)와 목적이 다름:
 *   저건 'DB에서 안 쓰는 파일' 정리, 이건 '개인정보 보존기간 만료' 파기.
 *   헤어는 애초에 DB에 안 남아 고아정리 관점엔 즉시삭제 대상이나, 방금 만든 것까지
 *   지우면 안 되므로 여기서 '7일 경과' 나이 가드를 둬 유예한다.
 *
 * 사용법:
 *   node scripts/purge-face-photos.cjs           → dry-run (삭제 없이 대상만)
 *   node scripts/purge-face-photos.cjs --delete  → 실제 파기
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { Client } = require('pg');
const { Storage } = require('@google-cloud/storage');

const BUCKET_NAME = 'ai-mp-media';
const GCS_PREFIX  = `https://storage.googleapis.com/${BUCKET_NAME}/`;
const DB_URL      = process.env.DATABASE_URL || 'postgresql://aichat_user:aichat_9958@localhost:5432/aichat';
const isDryRun    = !process.argv.includes('--delete');

// 보존기간(일)
const AGE_TRANSFORM_KEEP_DAYS = 90;   // 미래의나 = 사용자 저장분
const HAIR_TRYON_KEEP_DAYS    = 7;    // 헤어 = 1회성 결과물

function extractGcsPath(url) {
    if (!url || typeof url !== 'string') return null;
    if (url.startsWith(GCS_PREFIX)) return url.slice(GCS_PREFIX.length);
    if (url.startsWith(`gs://${BUCKET_NAME}/`)) return url.slice(`gs://${BUCKET_NAME}/`.length);
    return null;
}

async function deleteGcsFile(storage, path, log) {
    try {
        await storage.bucket(BUCKET_NAME).file(path).delete();
        log.push(`  ✅ GCS 삭제: ${path}`);
        return true;
    } catch (e) {
        if (e.code === 404) { log.push(`  · 이미 없음: ${path}`); return true; }
        log.push(`  ❌ GCS 실패: ${path} — ${e.message}`);
        return false;
    }
}

// ── 1. 미래의나: DB 90일 만료 행 → GCS 이미지 + DB 행 파기 ──────────────
async function purgeAgeTransform(client, storage) {
    console.log(`\n[1] 미래의나(age-transform) — ${AGE_TRANSFORM_KEEP_DAYS}일 경과분 파기`);
    const { rows } = await client.query(
        `SELECT id, "originalUrl", "imagesJson", "createdAt"
         FROM "AgeTransform"
         WHERE "createdAt" < now() - ($1 || ' days')::interval
         ORDER BY "createdAt"`,
        [String(AGE_TRANSFORM_KEEP_DAYS)]
    );
    console.log(`   만료 대상: ${rows.length}행`);
    if (rows.length === 0) return { rows: 0, files: 0 };

    let filesDeleted = 0;
    const idsToDelete = [];
    for (const row of rows) {
        const log = [];
        const paths = new Set();
        // imagesJson: {"70":"https://..."} 형식 → 값들 수집
        try {
            const imgs = JSON.parse(row.imagesJson || '{}');
            for (const u of Object.values(imgs)) { const p = extractGcsPath(u); if (p) paths.add(p); }
        } catch {}
        const op = extractGcsPath(row.originalUrl); if (op) paths.add(op);

        console.log(`   - id=${row.id} (${row.createdAt.toISOString().slice(0,10)}), 파일 ${paths.size}개`);
        if (!isDryRun) {
            let allOk = true;
            for (const p of paths) { const ok = await deleteGcsFile(storage, p, log); if (ok) filesDeleted++; else allOk = false; }
            log.forEach(l => console.log(l));
            // GCS 파일 삭제가 다 성공(또는 이미없음)했을 때만 DB 행 삭제(파일 고아 방지)
            if (allOk) idsToDelete.push(row.id);
            else console.log(`   ⚠️ id=${row.id}: 일부 GCS 삭제 실패 → DB 행 보류(다음 실행 재시도)`);
        } else {
            for (const p of paths) console.log(`     (dry) GCS 삭제 예정: ${p}`);
            filesDeleted += paths.size;
        }
    }
    if (!isDryRun && idsToDelete.length) {
        await client.query(`DELETE FROM "AgeTransform" WHERE id = ANY($1)`, [idsToDelete]);
        console.log(`   🗑️ DB 행 삭제: ${idsToDelete.length}개`);
    }
    return { rows: isDryRun ? rows.length : idsToDelete.length, files: filesDeleted };
}

// ── 2. 헤어: hair-tryon/ 중 생성 7일 경과 + DB 미참조 파일 파기 ──────────
async function purgeHairTryon(client, storage) {
    console.log(`\n[2] 헤어 합성(hair-tryon/) — ${HAIR_TRYON_KEEP_DAYS}일 경과분 파기`);
    // 혹시 어딘가 DB가 참조 중이면 제외(안전). hair-tryon URL을 쓰는 텍스트 컬럼 스캔.
    const referenced = new Set();
    const { rows: cols } = await client.query(`
        SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema='public' AND data_type IN ('text','character varying','character','varchar')`);
    for (const { table_name, column_name } of cols) {
        try {
            const { rows } = await client.query(
                `SELECT "${column_name}" v FROM "${table_name}"
                 WHERE "${column_name}" LIKE '%hair-tryon/%'`);
            for (const r of rows) {
                const m = (r.v || '').match(/hair-tryon\/[^\s"'}]+/g) || [];
                for (const x of m) referenced.add(x);
            }
        } catch {}
    }

    const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: 'hair-tryon/' });
    const cutoff = Date.now() - HAIR_TRYON_KEEP_DAYS * 86400 * 1000;
    const targets = files.filter(f => {
        if (f.name.endsWith('/')) return false;                       // 폴더 플레이스홀더 제외
        if (referenced.has(f.name)) return false;                     // DB 참조분 보호
        const created = new Date(f.metadata.timeCreated).getTime();
        return created < cutoff;                                      // 7일 경과분만
    });
    console.log(`   전체 ${files.length}개 중 파기 대상: ${targets.length}개 (참조보호 ${referenced.size}개)`);

    let deleted = 0;
    for (const f of targets) {
        if (isDryRun) { console.log(`     (dry) 삭제 예정: ${f.name}`); deleted++; continue; }
        const log = [];
        if (await deleteGcsFile(storage, f.name, log)) deleted++;
        log.forEach(l => console.log(l));
    }
    return { files: deleted };
}

async function main() {
    console.log(`\n=== 얼굴 사진 보존기간 파기 (${isDryRun ? 'DRY-RUN' : '실제 파기'}) ===`);
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON 환경변수가 없습니다.');
    const credentials = JSON.parse(credsJson);
    const storage = new Storage({ credentials, projectId: credentials.project_id });
    const client  = new Client({ connectionString: DB_URL });
    await client.connect();
    try {
        const a = await purgeAgeTransform(client, storage);
        const h = await purgeHairTryon(client, storage);
        console.log(`\n=== 요약 ===`);
        console.log(`  미래의나: 행 ${a.rows} / 이미지 ${a.files}`);
        console.log(`  헤어: 파일 ${h.files}`);
        if (isDryRun) console.log(`\n[DRY-RUN] 실제 파기하려면 --delete 로 실행.`);
    } finally {
        await client.end();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
