#!/usr/bin/env node
/**
 * sitemap.xml 재생성 — 기능 카드(FEATURES_GRID)를 읽어 딥링크 목록을 만든다.
 *
 * 사용: node scripts/gen-sitemap.cjs
 * ★기능 카드를 추가/삭제했으면 이걸 돌려야 검색 엔진이 새 기능을 찾아간다.
 *   (기능 키 등록 4곳 + 여기 = 사실상 5곳이므로 카드 작업 시 함께 챙길 것)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'frontend/components/MainPageNew.tsx');
const OUT = path.join(ROOT, 'public/sitemap.xml');
const BASE = 'https://aichat.dbzone.kr';

const src = fs.readFileSync(SRC, 'utf8');
// FEATURES_GRID 항목 = id/key/name 이 한 줄에 함께 있는 형태
const re = /\{ id: \d+,[\s\S]*?key: '([a-z-]+)'[\s\S]*?name: '([^']+)'/g;
const seen = new Set();
const feats = [];
let m;
while ((m = re.exec(src)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); feats.push(m[1]); }
}
if (feats.length === 0) {
    console.error('❌ 기능 카드를 하나도 못 찾음 — MainPageNew.tsx 구조가 바뀌었는지 확인');
    process.exit(1);
}

// ★날짜는 KST 기준. 서버가 UTC라 그냥 쓰면 하루 밀린다(2026-07-29 실측 교훈).
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

const url = (loc, priority, changefreq = 'weekly') =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- 자동 생성: node scripts/gen-sitemap.cjs (${today}) -->`,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    url(`${BASE}/`, '1.0', 'daily'),
    ...feats.map(k => url(`${BASE}/?f=${k}`, '0.8')),
    '</urlset>',
].join('\n') + '\n';

fs.writeFileSync(OUT, xml);
console.log(`✅ sitemap.xml 생성 — 메인 + 기능 ${feats.length}개 = ${feats.length + 1} URL (${today})`);
