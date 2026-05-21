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
        await panel.locator('button.el-icon-arrow-right').first().click();
        await sleep(500);

        const tds = panel.locator('.el-date-table tbody td');
        const count = await tds.count();
        for (let i = 0; i < count; i++) {
            const td  = tds.nth(i);
            const cls = await td.getAttribute('class') || '';
            if (cls.includes('prev-month') || cls.includes('next-month')) continue;
            const text = (await td.locator('span').textContent().catch(() => '')).trim();
            if (text === '3') {
                await td.locator('span').click();
                break;
            }
        }
        await sleep(1000);

        // 방법1: inputValue()
        const v1 = await dateInput.inputValue().catch(() => '');

        // 방법2: Vue 컴포넌트 내부 값
        const v2 = await page.evaluate(() => {
            const el = document.querySelector('.el-date-editor.el-date-editor--date');
            return el?.__vue__?.value || el?.__vue__?.currentValue || null;
        });

        // 방법3: placeholder 변화 (날짜 입력되면 placeholder 사라짐)
        const ph = await dateInput.getAttribute('placeholder').catch(() => '');

        // 방법4: 달력 패널이 닫혔는지 (날짜 선택되면 패널 닫힘)
        const panelClosed = !await panel.isVisible({ timeout: 500 }).catch(() => true);

        console.log(`inputValue: "${v1}"`);
        console.log(`Vue value: "${v2}"`);
        console.log(`placeholder: "${ph}"`);
        console.log(`패널 닫힘: ${panelClosed}`);

    } catch (e) {
        console.log('오류:', e.message.split('\n')[0]);
    } finally {
        await browser.close();
    }
}

run();
