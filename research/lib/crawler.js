/**
 * crawler.js — Playwright 웹 리서치 (DuckDuckGo + stealth)
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const MAX_SOURCES  = 5;
const PAGE_TIMEOUT = 20_000;

function extractRealUrl(href) {
  try {
    const u = new URL(href);
    const uddg = u.searchParams.get('uddg');
    return uddg ? decodeURIComponent(uddg) : href;
  } catch {
    return href;
  }
}

async function crawl(topic) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ko-KR',
  });
  const sources = [];

  try {
    const page = await context.newPage();

    // 한국어 검색
    const koQuery = encodeURIComponent(`${topic} 설명 자료`);
    await page.goto(`https://html.duckduckgo.com/html/?q=${koQuery}&kl=kr-kr`, {
      timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded',
    });

    const koLinks = await page.$$eval('a.result__a', as =>
      as.map(a => a.href).filter(Boolean)
    );
    const koUrls = koLinks.map(extractRealUrl).filter(u => u.startsWith('http'));
    console.log(`🔍 한국어 검색 결과: ${koUrls.length}개 링크`);

    for (const url of koUrls.slice(0, MAX_SOURCES)) {
      const text = await fetchPageText(context, url);
      if (text) { sources.push({ url, text }); console.log(`✅ ${url.slice(0, 70)}`); }
    }

    // 영문 검색
    const enQuery = encodeURIComponent(`${topic} explained overview`);
    await page.goto(`https://html.duckduckgo.com/html/?q=${enQuery}&kl=us-en`, {
      timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded',
    });

    const enLinks = await page.$$eval('a.result__a', as =>
      as.map(a => a.href).filter(Boolean)
    );
    const enUrls = enLinks.map(extractRealUrl).filter(u => u.startsWith('http'));
    console.log(`🔍 영문 검색 결과: ${enUrls.length}개 링크`);

    for (const url of enUrls.slice(0, 3)) {
      const text = await fetchPageText(context, url);
      if (text) sources.push({ url, text });
    }

  } finally {
    await browser.close();
  }

  console.log(`📚 총 ${sources.length}개 소스 수집 완료`);
  return sources;
}

async function fetchPageText(context, url) {
  try {
    const page = await context.newPage();
    await page.goto(url, { timeout: 15_000, waitUntil: 'domcontentloaded' });
    const text = await page.evaluate(() => {
      ['script', 'style', 'nav', 'footer', 'header', 'aside'].forEach(t =>
        document.querySelectorAll(t).forEach(el => el.remove())
      );
      return (document.querySelector('main, article, .content, #content, body')?.innerText || '')
        .replace(/\s+/g, ' ').trim().slice(0, 3000);
    });
    await page.close();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

module.exports = { crawl };
