const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://html.duckduckgo.com/html/?q=AI+역사+설명&kl=kr-kr', {
    timeout: 20000, waitUntil: 'domcontentloaded'
  });
  const title = await page.title();
  const length = (await page.content()).length;
  console.log('title:', title, 'len:', length);

  // 모든 링크 확인
  const allLinks = await page.$$eval('a', as => as.map(a => ({ href: a.href, cls: a.className })).slice(0, 20));
  console.log('links:', JSON.stringify(allLinks, null, 2));

  await browser.close();
})().catch(e => console.error(e.message));
