require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { loadCookies } = require('./lib/cookieStore');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const NLM_URL = 'https://notebooklm.google.com';

(async () => {
  const cookies = await loadCookies(2); // userId=1
  if (!cookies) { console.log('쿠키 없음'); process.exit(1); }
  console.log(`쿠키 ${cookies.length}개 로드됨`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  await context.addCookies(cookies);

  const page = await context.newPage();
  console.log('NotebookLM 접속 중...');
  await page.goto(NLM_URL, { timeout: 30000, waitUntil: 'domcontentloaded' });

  const url = page.url();
  const title = await page.title();
  console.log('현재 URL:', url);
  console.log('페이지 타이틀:', title);

  const content = await page.content();
  const isLogin = content.includes('Sign in') || content.includes('로그인') || url.includes('accounts.google.com');
  const hasNotebook = content.includes('notebook') || content.includes('노트북');
  console.log('로그인 필요:', isLogin);
  console.log('노트북 페이지:', hasNotebook);

  await browser.close();
})().catch(e => console.error('에러:', e.message));
