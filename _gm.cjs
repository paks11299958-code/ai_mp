const { chromium } = require('playwright');
const S='/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport:{width:414,height:896} });
  await p.goto('https://aichat.dbzone.kr/?p=cmopfkd4o000004la2q5p3nle&ref=KIN',{waitUntil:'networkidle',timeout:90000});
  await p.waitForTimeout(8000);
  // 체험 안내 닫기
  const b1 = p.locator('text=시작하기').first();
  if (await b1.count()>0) { await b1.click(); await p.waitForTimeout(2500); }
  let t = await p.evaluate(()=>document.body.innerText);
  console.log('모달 내용:', t.slice(0,200).replace(/\n/g,' | '));
  await p.screenshot({path:S+'guide_card.png'});
  // '꿈해몽' 카드 클릭
  const card = p.locator('text=꿈해몽').first();
  if (await card.count()>0) {
    await card.click(); await p.waitForTimeout(3500);
    t = await p.evaluate(()=>document.body.innerText);
    console.log('클릭 후:', /어젯밤|꿈의 내용/.test(t) ? '✅ 꿈해몽 실행됨' : '❌ 반응없음');
  } else console.log('❌ 꿈해몽 카드 못찾음');
  await b.close();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
