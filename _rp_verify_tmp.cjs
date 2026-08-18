const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,150)));
  await p.goto('https://aichat.dbzone.kr/', { waitUntil: 'networkidle', timeout: 45000 });
  await p.waitForTimeout(3500);
  const txt = (await p.innerText('body')).replace(/\s+/g,' ');

  console.log('=== 메인에 진입점 노출됐나 ===');
  for (const w of ['이미지 → 프롬프트', '이미지', '프롬프트']) {
    console.log(`  "${w}" : ${txt.includes(w) ? '있음' : '없음'}`);
  }
  console.log('페이지 에러:', errs.length ? errs : '없음');

  // 검색 동작 확인
  console.log('\n=== 검색 "미드저니" ===');
  const inputs = await p.$$('input');
  let searched = false;
  for (const i of inputs) {
    const ph = await i.getAttribute('placeholder') || '';
    if (ph.includes('검색') || ph.includes('찾')) {
      await i.fill('미드저니'); await p.waitForTimeout(1800);
      const t2 = (await p.innerText('body')).replace(/\s+/g,' ');
      console.log('  결과에 "이미지 → 프롬프트":', t2.includes('이미지 → 프롬프트') ? '✅ 검색됨' : '❌ 안 나옴');
      searched = true; break;
    }
  }
  if (!searched) console.log('  (검색창 못 찾음 — placeholder:', (await Promise.all(inputs.map(i=>i.getAttribute('placeholder')))).filter(Boolean).join(' | '), ')');
  await b.close();
})();
