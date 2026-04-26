'use strict';
const fs = require('fs');
const path = require('path');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../src/generated/prisma/index.js');

function fixPrettyJson(val) {
  let result = '', inString = false, i = 0;
  while (i < val.length) {
    const ch = val[i];
    if (ch === '\\' && i + 1 < val.length) {
      if (inString) { result += ch + val[i+1]; }
      else { result += (val[i+1] === 'n') ? '\n' : ch + val[i+1]; }
      i += 2; continue;
    }
    if (ch === '"') inString = !inString;
    result += ch; i++;
  }
  return result;
}

const content = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
content.split('\n').forEach(line => {
  const t = line.trim();
  if (!t || t.startsWith('#')) return;
  const idx = t.indexOf('=');
  if (idx === -1) return;
  const key = t.slice(0, idx).trim();
  let val = t.slice(idx+1).trim();
  if (val.startsWith('"') && val.endsWith('"')) {
    try { val = JSON.parse(val); } catch { val = fixPrettyJson(val.slice(1,-1)); }
  } else if (val.startsWith("'") && val.endsWith("'")) { val = val.slice(1,-1); }
  if (!process.env[key]) process.env[key] = val;
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function run() {
  const email = process.argv[2];
  const xp = Number(process.argv[3]);
  if (!email || isNaN(xp)) {
    console.error('사용법: node scripts/update-user-xp.cjs <email> <xp>');
    process.exit(1);
  }
  const user = await prisma.user.update({
    where: { email },
    data: { xp },
    select: { email: true, xp: true, username: true },
  });
  console.log('업데이트 완료:', user);
  await prisma.$disconnect();
}

run().catch(e => { console.error('[오류]', e.message); process.exit(1); });
