const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });
    const page = await ctx.newPage();

    await page.goto('https://domeggook.com/main/member/mem_formLogin.php', { waitUntil: 'domcontentloaded' });
    await page.fill('#idInput', 'c2clo');
    await page.fill('#pwInput', 'rhkdtjr9958$');
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.goto('https://domeggook.com/65146873', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    const moreBtn = await page.$('text=상품상세 더보기');
    if (moreBtn) {
        await moreBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        // 스크롤
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 2000));
    }

    // 현재 페이지의 모든 /upload/item/ 이미지 URL
    const imgUrls = await page.$$eval('img', els =>
        els.map(e => e.src).filter(s => s && s.includes('/upload/item/'))
    );
    console.log('찾은 이미지 수:', imgUrls.length);
    imgUrls.slice(0, 5).forEach(u => console.log(' -', u.slice(-60)));

    // page.request.get() 으로 다운로드 시도 (CORS 우회)
    if (imgUrls.length > 0) {
        const testUrl = imgUrls[0];
        console.log('\npage.request 다운로드 시도:', testUrl.slice(-50));
        try {
            const r = await ctx.request.get(testUrl);
            const buf = await r.body();
            console.log('상태:', r.status(), '| 크기:', buf.length, 'bytes | 타입:', r.headers()['content-type']);
        } catch(e) { console.log('실패:', e.message); }
    }
    await browser.close();
})().catch(e => console.error(e.message));
