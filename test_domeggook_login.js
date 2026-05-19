require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // 로그인
    await page.goto('https://domeggook.com/main/member/mem_formLogin.php', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.fill('#idInput', process.env.DOMEGGOOK_ID);
    await page.fill('#pwInput', process.env.DOMEGGOOK_PASSWORD);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    console.log('로그인 후 URL:', page.url());

    // 메인으로 이동 후 검색
    await page.goto('https://domeggook.com/main/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('메인 URL:', page.url());
    
    const searchFormExists = await page.$('#searchWordForm') !== null;
    console.log('검색폼 존재:', searchFormExists);
    
    await page.fill('#searchWordForm', '칫솔');
    await page.click('#searchWordSubmit');
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);
    
    console.log('검색 후 URL:', page.url());
    console.log('타이틀:', await page.title());
    
    // 모든 _img_330/_stt_330 이미지 개수
    const imgCount = await page.$$eval('img[src*="_img_330"], img[src*="_stt_330"]', els => els.length);
    console.log('_img_330/_stt_330 이미지 수:', imgCount);
    
    // 모든 a 태그 href 중 from=lstGen 포함
    const lstGenLinks = await page.$$eval('a[href*="from=lstGen"]', els => 
        els.slice(0, 5).map(e => ({ href: e.href.slice(0, 80), text: e.textContent?.trim().slice(0, 50) }))
    );
    console.log('from=lstGen 링크:', JSON.stringify(lstGenLinks));
    
    // advcnt 없는 상품 링크
    const orgLinks = await page.$$eval('a[href*="domeggook.com/"]', els => 
        els.filter(e => !e.href.includes('advcnt') && /\/\d{5,}/.test(e.href))
           .slice(0,5).map(e => ({ href: e.href.slice(0,80), text: e.textContent?.trim().slice(0,50) }))
    );
    console.log('유기 상품 링크:', JSON.stringify(orgLinks));
    
    await browser.close();
})().catch(e => console.error('ERROR:', e.message));
