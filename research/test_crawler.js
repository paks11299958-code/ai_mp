const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  await page.goto('https://www.google.com/search?q=AI+역사+설명+자료&hl=ko&num=10', { timeout: 15000, waitUntil: 'domcontentloaded' });
  const title = await page.title();
  console.log('title:', title);

  // 구글 검색 결과 링크 추출 시도
  const links1 = await page.$$eval('a[href^="http"]', as => as.map(a => a.href).slice(0, 5));
  console.log('http links:', links1);

  const links2 = await page.$$eval('h3', hs => hs.map(h => h.closest('a')?.href).filter(Boolean).slice(0, 5));
  console.log('h3 links:', links2);

  const content = await page.content();
  console.log('page length:', content.length);
  console.log('has captcha:', content.includes('captcha') || content.includes('unusual traffic'));

  await browser.close();
})().catch(e => console.error('ERROR:', e.message));
