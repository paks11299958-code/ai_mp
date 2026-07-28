const { chromium } = require('playwright');
const S='/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:414,height:896} });
  await p.goto('https://aichat.dbzone.kr/?p=cmoogeutq000004ifpx8r9xv2&ref=KIN',{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(8000);
  const b1 = p.locator('text=시작하기').first();
  if (await b1.count()>0) { await b1.click(); await p.waitForTimeout(2500); }
  const modal = p.locator('div[class*="z-[85]"]').first();
  console.log((await modal.innerText()).slice(0,220));
  await p.screenshot({path:S+'final.png'});
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
