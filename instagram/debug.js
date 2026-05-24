require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        viewport: { width: 393, height: 852 },
        isMobile: true, hasTouch: true, locale: 'ko-KR',
    });
    const page = await context.newPage();
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle', timeout: 40000 });
    await new Promise(r => setTimeout(r, 5000));
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
    const body = await page.locator('body').textContent().catch(() => '');
    console.log('Body(500):', body.replace(/\s+/g,' ').slice(0, 500));
    const inputs = await page.locator('input').count();
    console.log('Input count:', inputs);
    await browser.close();
})();
