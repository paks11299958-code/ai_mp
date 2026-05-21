// 최종 검증 — 6월 3일 클릭까지
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page    = await browser.newPage();

    try {
        await page.goto('https://valet.amanopark.co.kr/booking', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        const dateInput = page.locator('input.el-input__inner[placeholder="년도-월-일"]').first();
        await dateInput.click();
        await sleep(800);

        const panel = page.locator('.el-picker-panel').first();

        // 6월로 이동
        for (let i = 0; i < 5; i++) {
            const h = await panel.locator('.el-date-picker__header').textContent().catch(() => '');
            const is6 = h.includes('June') || h.includes('Jun');
            console.log(`[${i}] 헤더: "${h.trim()}" → June=${is6}`);
            if (h.includes('2026') && is6) break;
            await panel.locator('button.el-icon-arrow-right').first().click();
            await sleep(500);
        }

        // 3일 찾기
        const tds   = panel.locator('.el-date-table tbody td');
        const count = await tds.count();
        let found = false;
        for (let i = 0; i < count; i++) {
            const td  = tds.nth(i);
            const cls = await td.getAttribute('class') || '';
            if (cls.includes('prev-month') || cls.includes('next-month')) continue;
            const text = (await td.locator('span').textContent().catch(() => '')).trim();
            if (text === '3') {
                console.log(`\n3일 발견! class="${cls}" disabled=${cls.includes('disabled')}`);
                if (!cls.includes('disabled')) {
                    await td.locator('span').click();
                    console.log('✅ 클릭 성공!');
                }
                found = true;
                break;
            }
        }
        if (!found) console.log('3일 못찾음');

    } catch (e) {
        console.log('오류:', e.message.split('\n')[0]);
    } finally {
        await browser.close();
    }
}

run();
