#!/usr/bin/env node
// 빌드 시 sites/designs/ 하위 폴더를 스캔해 manifest.json 생성.
// 어드민 'omd 디자인' 패널이 이 JSON을 읽어 목록을 만든다.
// /design 으로 새 디자인이 추가되면 다음 배포 때 자동 반영됨.
'use strict';
const fs = require('fs');
const path = require('path');

const DESIGNS_DIR = path.join(__dirname, 'designs');
// public/ 으로 출력 → Vite가 dist 루트로 복사 → /designs-manifest.json 로 서빙(SPA fallback 안 탐).
// (sites/designs/manifest.json 경로는 vercel sites rewrite와 얽혀 SPA로 fallback되는 문제가 있었음)
const OUT = path.join(__dirname, '..', 'public', 'designs-manifest.json');

function build() {
  if (!fs.existsSync(DESIGNS_DIR)) {
    fs.mkdirSync(DESIGNS_DIR, { recursive: true });
  }
  const entries = fs.readdirSync(DESIGNS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const slug = d.name;
      const indexPath = path.join(DESIGNS_DIR, slug, 'index.html');
      if (!fs.existsSync(indexPath)) return null;
      const stat = fs.statSync(indexPath);
      // slug 끝의 -<10자리 타임스탬프>가 있으면 생성시각으로, 없으면 파일 mtime.
      const m = slug.match(/-(\d{10})$/);
      const createdAt = m ? new Date(Number(m[1]) * 1000).toISOString() : stat.mtime.toISOString();
      // 표시용 제목: 타임스탬프 접미사 제거 + 하이픈→공백
      const title = slug.replace(/-\d{10}$/, '').replace(/-/g, ' ').trim() || slug;
      return { slug, title, createdAt, url: `/sites/designs/${slug}/` };
    })
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 최신순

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), designs: entries }, null, 2));
  console.log(`[gen-designs-manifest] ${entries.length}개 디자인 → ${OUT}`);
}

build();
