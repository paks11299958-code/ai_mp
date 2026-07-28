const { chromium } = require('playwright');
const S='/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:1280,height:800} });
  await p.goto('https://aichat.dbzone.kr/?p=cmopfkd4o000004la2q5p3nle&ref=D3USRYVH',{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(8000);
  const btn = p.locator('text=시작하기').first();
  if (await btn.count()>0) { await btn.click(); await p.waitForTimeout(4000); }
  // 프로필 이미지(왼쪽 패널) 존재 확인
  const imgs = await p.evaluate(() => Array.from(document.querySelectorAll('img'))
      .filter(i => i.naturalWidth > 100)
      .map(i => ({ src: i.src.slice(0,70), w: i.naturalWidth })));
  console.log('로드된 큰 이미지 수:', imgs.length);
  imgs.slice(0,4).forEach(i => console.log('  ', i.w+'px', i.src));
  await p.screenshot({path:S+'persona_img.png'});
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
