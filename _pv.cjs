const { chromium } = require('playwright');
const S='/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:414,height:896} });
  // 도결 선생 페르소나 링크
  await p.goto('https://aichat.dbzone.kr/?p=cmopfkd4o000004la2q5p3nle&ref=D3USRYVH',{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(8000);
  const btn = p.locator('text=시작하기').first();
  if (await btn.count()>0) { await btn.click(); await p.waitForTimeout(3000); }
  const t = await p.evaluate(()=>document.body.innerText);
  console.log(t.slice(0,320));
  console.log('---');
  console.log('기능 목록 노출:', /이런 걸 도와드려요/.test(t) ? '✅' : '❌');
  await p.screenshot({path:S+'persona_guide.png'});
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
