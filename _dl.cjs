const { chromium } = require('playwright');
const S = '/tmp/claude-1000/-home-paks11299958-ai-mp/c6a20199-7d95-4189-bc73-b134d9d5babe/scratchpad/';
const URL = process.argv[2] || 'https://aichat.dbzone.kr/?f=dream&ref=D3USRYVH';

(async () => {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 414, height: 896 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));

    await p.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
    // 게스트 자동가입 + 딥링크 처리 + 퀵메뉴 자동실행까지 시간 여유
    await p.waitForTimeout(9000);

    const t = await p.evaluate(() => document.body.innerText);
    // 인트로 판정: 입장 버튼/영상 오버레이 문구
    const intro = /입장하기|입장|둘러보기 전에/.test(t) && !/꿈해몽|해몽/.test(t);
    console.log('URL:', URL);
    console.log('에러:', errs.slice(0, 2));
    console.log('--- 화면 ---');
    console.log(t.slice(0, 450));
    console.log('---');
    console.log('꿈해몽 안내 노출:', /꿈해몽/.test(t) ? '✅' : '❌');
    console.log('인트로 화면인가 :', intro ? '❌ 인트로 뜸' : '✅ 인트로 없음');
    await p.screenshot({ path: S + 'deeplink.png' });
    await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
