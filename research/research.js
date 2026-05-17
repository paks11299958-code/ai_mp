/**
 * research.js — AI 리서치 메인 실행 파일
 *
 * 실행: node research.js <userId> <topic> <notebookName>
 * 예시: node research.js 1 "AI의 역사" "AI 기초 학습"
 *
 * shared-api에서 백그라운드로 spawn해서 사용
 */
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const path   = require('path');
const fs     = require('fs');
const { Pool } = require('pg');

const { crawl }                               = require('./lib/crawler');
const { write }                               = require('./lib/writer');
const { upload }                              = require('./lib/notebooklm');
const { sendResearchComplete, sendResearchError } = require('./lib/mailer');
const { loadCookies }                         = require('./lib/cookieStore');

const OUTPUT_DIR = path.join(__dirname, 'output');
const pool       = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateStatus(id, status, extra = {}) {
  const sets = ['status = $2', '"updatedAt" = NOW()'];
  const vals = [id, status];
  let i = 3;
  for (const [k, v] of Object.entries(extra)) {
    sets.push(`"${k}" = $${i++}`);
    vals.push(v);
  }
  await pool.query(`UPDATE "ResearchHistory" SET ${sets.join(', ')} WHERE id = $1`, vals);
}

(async () => {
  const [,, userId, topic, notebookName, historyId, userEmail] = process.argv;

  if (!userId || !topic || !notebookName) {
    console.error('사용법: node research.js <userId> <topic> <notebookName> [historyId] [email]');
    process.exit(1);
  }

  const hId = historyId ? parseInt(historyId) : null;
  console.log(`\n🚀 리서치 시작: "${topic}" → 노트북: "${notebookName}"\n`);

  try {
    if (hId) await updateStatus(hId, 'running');

    // 1. 웹 리서치
    console.log('── Step 1. 웹 리서치 ──');
    const sources = await crawl(topic);
    if (!sources.length) throw new Error('수집된 자료가 없습니다');

    // 2. Claude API 원고 작성
    console.log('\n── Step 2. 원고 작성 ──');
    const content = await write({ topic, sources });

    // 3. 파일 저장
    console.log('\n── Step 3. 파일 저장 ──');
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const fileName = `${notebookName}_${Date.now()}.txt`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ 파일 저장: ${filePath}`);
    if (hId) await updateStatus(hId, 'running', { filePath });

    // 4. NotebookLM 업로드 (쿠키 있을 때만)
    let notebookUrl = null;
    const cookies = await loadCookies(parseInt(userId));

    if (cookies) {
      console.log('\n── Step 4. NotebookLM 업로드 ──');
      try {
        notebookUrl = await upload({ cookies, notebookName, filePath });
        if (hId) await updateStatus(hId, 'running', { notebookUrl });
      } catch (e) {
        console.warn(`⚠️ NotebookLM 업로드 실패: ${e.message} (파일은 이메일로 발송)`);
      }
    } else {
      console.log('ℹ️  쿠키 미등록 — NotebookLM 업로드 건너뜀 (파일 이메일 발송)');
    }

    // 5. 이메일 발송
    console.log('\n── Step 5. 이메일 발송 ──');
    const to = userEmail || process.env.RECIPIENT_EMAIL || 'paks11299958@gmail.com';
    await sendResearchComplete({
      to,
      topic,
      notebookName,
      notebookUrl,
      filePath,
      previewText: content,
    });

    if (hId) await updateStatus(hId, 'done', { notebookUrl });
    console.log('\n🎉 리서치 완료!');

  } catch (err) {
    console.error(`\n❌ 리서치 실패: ${err.message}`);
    if (hId) await updateStatus(hId, 'error', { errorMessage: err.message });

    const to = userEmail || 'paks11299958@gmail.com';
    await sendResearchError({ to, topic, errorMessage: err.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
