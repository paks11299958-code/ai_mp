const { chromium } = require('playwright');
const S='/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:414,height:896} });
  await p.goto('https://aichat.dbzone.kr/?f=dream&ref=D3USRYVH',{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(8000);
  console.log('1번째 모달:', (await p.evaluate(()=>document.body.innerText)).slice(0,60).replace(/\n/g,' '));
  // '시작하기' 눌러 환영 모달 닫기
  const btn = p.locator('text=시작하기').first();
  if (await btn.count()>0) { await btn.click(); await p.waitForTimeout(3000); }
  const t = await p.evaluate(()=>document.body.innerText);
  console.log('2번째 화면:', t.slice(0,120).replace(/\n/g,' '));
  console.log('꿈해몽 안내 모달:', /꿈해몽|입력창에 적어주시면/.test(t) ? '✅ 노출' : '❌ 없음');
  await p.screenshot({path:S+'deeplink2.png'});
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
