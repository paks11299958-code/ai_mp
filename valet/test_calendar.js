// booking.js와 동일한 로직으로 전체 루프 검증
const { chromium } = require('playwright');
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const rand   = (min, max) => Math.floor(Math.random() * (max - min) + min);
const delay  = (min, max) => sleep(rand(min, max));

const TARGET_MONTH = '6';
const TARGET_YEAR  = '2026';
const TARGET_DAY   = '3';

async function tryClickDate(page) {
    const dateInput = page.locator('input.el-input__inner[placeholder="년도-월-일"]').first();
    if (!await dateInput.isVisible({ timeout: 3000 }).catch(() => false))
        return { ok: false, reason: '날짜 입력창 없음' };

    await dateInput.click();
    await delay(700, 1200);

    const panel = page.locator('.el-picker-panel').first();
    if (!await panel.isVisible({ timeout: 3000 }).catch(() => false))
        return { ok: false, reason: '달력 팝업이 열리지 않음' };

    for (let i = 0; i < 15; i++) {
        const headerText = await panel.locator('.el-date-picker__header').textContent().catch(() => '');
        const isYear2026 = headerText.includes(TARGET_YEAR);
        const isMonth6   = headerText.includes('June') || headerText.includes('Jun') || /6[月월]/.test(headerText);
        if (isYear2026 && isMonth6) break;
        const nextBtn = panel.locator('button.el-icon-arrow-right').first();
        if (!await nextBtn.isVisible({ timeout: 500 }).catch(() => false))
            return { ok: false, reason: '다음달 버튼 없음' };
        await nextBtn.click();
        await delay(350, 650);
    }

    const allTds = panel.locator('.el-date-table tbody td');
    const count  = await allTds.count();
    for (let i = 0; i < count; i++) {
        const td  = allTds.nth(i);
        const cls = await td.getAttribute('class').catch(() => '') || '';
        if (cls.includes('prev-month') || cls.includes('next-month')) continue;
        const cellText = (await td.locator('span').textContent().catch(() => '')).trim();
        if (cellText !== TARGET_DAY) continue;

        if (cls.includes('disabled'))
            return { ok: false, reason: `${TARGET_MONTH}월 ${TARGET_DAY}일 비활성화` };

        await td.locator('span').click();
        await delay(500, 800);

        // 입력창에 2026-06-03 들어왔는지만 체크
        const inputVal = await dateInput.inputValue().catch(() => '');
        console.log(`  → 클릭 후 입력값: "${inputVal}"`);
        if (inputVal.includes('2026-06-03')) return { ok: true };

        return { ok: false, reason: `날짜 미입력 (현재값: "${inputVal || '빈값'}") — 재시도` };
    }
    return { ok: false, reason: '3일 요소 못찾음' };
}

async function run() {
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ locale: 'ko-KR' });
    const page    = await context.newPage();

    try {
        await page.goto('https://valet.amanopark.co.kr/booking', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        let attempt = 0;
        const MAX = 3;
        while (attempt < MAX) {
            attempt++;
            const result = await tryClickDate(page);
            console.log(`[${attempt}/${MAX}] ok=${result.ok} reason="${result.reason || '성공'}"`);

            if (result.ok) {
                console.log('✅ 성공 — 삐 3번');
                break;
            }

            await page.keyboard.press('Escape').catch(() => {});
            console.log('  → Escape 후 2초 대기...');
            await sleep(2000);
        }

        if (attempt >= MAX) console.log(`\n❌ ${MAX}회 반복 후 미성공 (예상된 결과 — 서버 headless 환경)`);

    } catch (e) {
        console.log('오류:', e.message.split('\n')[0]);
    } finally {
        await browser.close();
    }
}

run();
