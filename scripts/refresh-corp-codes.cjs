'use strict';
// DART OpenAPI에서 corpCode.xml 다운로드 후 CorpCode 테이블 upsert
// 사용법: node scripts/refresh-corp-codes.cjs
const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const AdmZip  = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
const { PrismaPg }  = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

// .env.local 로드
const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
content.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('='); if (idx === -1) return;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) { try { val = JSON.parse(val); } catch { val = val.slice(1, -1); } }
  else if (val.startsWith("'") && val.endsWith("'")) { val = val.slice(1, -1); }
  if (!process.env[key]) process.env[key] = val;
});

const DART_API_KEY = process.env.DART_API_KEY;
if (!DART_API_KEY) { console.error('DART_API_KEY 환경변수가 없습니다.'); process.exit(1); }

const { execSync } = require('child_process');
function downloadZip(url) {
  const tmpFile = '/tmp/dart_corp_code.zip';
  execSync(`curl -sL --max-time 60 -o ${tmpFile} "${url}"`);
  return fs.readFileSync(tmpFile);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma  = new PrismaClient({ adapter });

  try {
    console.log('DART에서 corpCode.zip 다운로드 중...');
    const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_API_KEY}`;
    const zipBuf = await downloadZip(url);
    const zip = new AdmZip(zipBuf);
    const xmlEntry = zip.getEntries().find(e => e.entryName.endsWith('.xml'));
    if (!xmlEntry) throw new Error('XML 파일을 찾을 수 없습니다.');

    const xml = xmlEntry.getData().toString('utf8');
    console.log('XML 파싱 중...');
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const items = parsed?.result?.list;
    if (!Array.isArray(items)) throw new Error('XML 파싱 실패: items가 배열이 아닙니다.');

    console.log(`총 ${items.length}개 종목 처리 중...`);

    // 배치 처리 (500개씩)
    const BATCH = 500;
    let upserted = 0;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(batch.map(item => {
        const corpCode  = String(item.corp_code  || '').trim();
        const corpName  = String(item.corp_name  || '').trim();
        const stockCode = String(item.stock_code || '').trim() || null;
        const modifyDt  = String(item.modify_dt  || '').trim() || null;
        if (!corpCode || !corpName) return;
        return prisma.$executeRawUnsafe(`
          INSERT INTO "CorpCode" ("corpCode", "corpName", "stockCode", "modifyDt")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT ("corpCode") DO UPDATE SET
            "corpName"  = EXCLUDED."corpName",
            "stockCode" = EXCLUDED."stockCode",
            "modifyDt"  = EXCLUDED."modifyDt"
        `, corpCode, corpName, stockCode, modifyDt);
      }));
      upserted += batch.length;
      process.stdout.write(`\r처리: ${upserted}/${items.length}`);
    }
    console.log('\nUpsert 완료!');

    // 결과 확인
    const [{ cnt }] = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "CorpCode"`;
    console.log(`CorpCode 테이블 총 종목 수: ${cnt}`);

    // 삼성전기우 확인
    const check = await prisma.$queryRaw`
      SELECT "corpName", "stockCode" FROM "CorpCode" WHERE "corpName" ILIKE '%삼성전기%'
    `;
    console.log('삼성전기 관련:', JSON.stringify(check));

  } catch (e) {
    console.error('\n오류:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
