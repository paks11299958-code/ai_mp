/**
 * cookieStore.js — DB 기반 쿠키 저장소 (AES-256-GCM 암호화)
 * UserCookie 테이블에 암호화 저장, 복호화 후 반환
 */
const { Pool } = require('pg');
const crypto   = require('crypto');
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const pool      = new Pool({ connectionString: process.env.DATABASE_URL });
const ALGORITHM = 'aes-256-gcm';
const ENC_KEY   = process.env.COOKIE_ENC_KEY; // 32바이트 hex (64자)

function encrypt(text) {
  if (!ENC_KEY) throw new Error('COOKIE_ENC_KEY 환경변수가 설정되지 않았습니다');
  const key     = Buffer.from(ENC_KEY, 'hex');
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag     = cipher.getAuthTag();
  return JSON.stringify({
    iv:   iv.toString('hex'),
    tag:  tag.toString('hex'),
    data: encrypted.toString('hex'),
  });
}

function decrypt(stored) {
  if (!ENC_KEY) throw new Error('COOKIE_ENC_KEY 환경변수가 설정되지 않았습니다');
  const { iv, tag, data } = JSON.parse(stored);
  const key     = Buffer.from(ENC_KEY, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
}

// 쿠키 조회 (userId = User.id 또는 email)
async function loadCookies(userId) {
  const { rows } = await pool.query(
    `SELECT "cookieEnc" FROM "UserCookie" WHERE "userId" = $1`, [userId]
  );
  if (!rows.length) return null;
  return JSON.parse(decrypt(rows[0].cookieEnc));
}

// 쿠키 저장/갱신
async function saveCookies(userId, cookies) {
  const enc = encrypt(JSON.stringify(cookies));
  await pool.query(
    `INSERT INTO "UserCookie" ("userId", "cookieEnc", "updatedAt")
     VALUES ($1, $2, NOW())
     ON CONFLICT ("userId") DO UPDATE
       SET "cookieEnc" = $2, "updatedAt" = NOW()`,
    [userId, enc]
  );
}

// 쿠키 삭제
async function deleteCookies(userId) {
  await pool.query(`DELETE FROM "UserCookie" WHERE "userId" = $1`, [userId]);
}

// 쿠키 등록 여부 확인
async function hasCookies(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM "UserCookie" WHERE "userId" = $1`, [userId]
  );
  return rows.length > 0;
}

module.exports = { loadCookies, saveCookies, deleteCookies, hasCookies };
