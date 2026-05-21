// 발렛파킹 달력 DOM 디버그 — 실행 후 debug_result.txt 확인
if (process.platform === 'win32') {
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch {}
}

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
chromium.use(StealthPlugin());

const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, 'debug_result.txt');

async function run() {
    console.log('디버그 시작...');
    const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
    const context = await browser.newContext({ viewport: null, locale: 'ko-KR' });
    const page = await context.newPage();

    let log = '';
    const out = (s) => { log += s + '\n'; console.log(s); };

    try {
        await page.goto('https://valet.amanopark.co.kr/booking', { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        // ── 모든 input 요소 ──
        out('\n=== INPUT 요소 ===');
        const inputs = await page.evaluate(() =>
            [...document.querySelectorAll('input')].map(el => ({
                type: el.type, id: el.id, name: el.name,
                placeholder: el.placeholder, class: el.className,
            }))
        );
        inputs.forEach(i => out(JSON.stringify(i)));

        // ── 클릭 가능한 날짜 관련 버튼/div ──
        out('\n=== 날짜 관련 클릭 요소 ===');
        const dateEls = await page.evaluate(() =>
            [...document.querySelectorAll('[class*="date"], [class*="Date"], [class*="calendar"], [class*="Calendar"], [class*="picker"], [class*="Picker"]')]
                .slice(0, 20)
                .map(el => ({ tag: el.tagName, class: el.className.slice(0, 80), text: el.innerText?.slice(0, 30) }))
        );
        dateEls.forEach(e => out(JSON.stringify(e)));

        // ── 첫번째 input 클릭 시도 ──
        out('\n=== 첫번째 input 클릭 시도 ===');
        const firstInput = page.locator('input').first();
        if (await firstInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstInput.click();
            await sleep(1500);
            out('클릭 완료. 달력 팝업 확인 중...');

            // 팝업 후 새로 생긴 요소들
            const after = await page.evaluate(() =>
                [...document.querySelectorAll('[class*="calendar"], [class*="Calendar"], [class*="datepicker"], [class*="picker"], [role="dialog"], [role="grid"]')]
                    .slice(0, 10)
                    .map(el => ({ tag: el.tagName, class: el.className.slice(0, 100), html: el.innerHTML.slice(0, 200) }))
            );
            out('\n=== 팝업 후 달력 요소 ===');
            after.forEach(e => out(JSON.stringify(e)));

            // 스크린샷
            await page.screenshot({ path: path.join(__dirname, 'debug_screenshot.png'), fullPage: false });
            out('\n스크린샷 저장: debug_screenshot.png');

            // td/button 날짜 셀 구조
            out('\n=== 날짜 셀 (td/button) 처음 15개 ===');
            const cells = await page.evaluate(() =>
                [...document.querySelectorAll('td, button')].filter(el => /^\d{1,2}$/.test(el.innerText?.trim()))
                    .slice(0, 15)
                    .map(el => ({
                        tag: el.tagName, text: el.innerText?.trim(),
                        class: el.className.slice(0, 80),
                        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled'),
                        parent: el.parentElement?.className?.slice(0, 60),
                    }))
            );
            cells.forEach(c => out(JSON.stringify(c)));

            // 헤더(월/년) 텍스트
            out('\n=== 달력 헤더 텍스트 ===');
            const headers = await page.evaluate(() =>
                [...document.querySelectorAll('h1,h2,h3,h4,[class*="header"],[class*="title"],[class*="month"],[class*="year"]')]
                    .filter(el => el.innerText?.trim())
                    .slice(0, 10)
                    .map(el => ({ tag: el.tagName, class: el.className.slice(0, 60), text: el.innerText?.trim().slice(0, 40) }))
            );
            headers.forEach(h => out(JSON.stringify(h)));

        } else {
            out('input 요소 없음. 다른 클릭 요소 탐색 중...');
        }

        // 전체 페이지 HTML 일부 저장
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug_page.html'), html, 'utf8');
        out('\n전체 HTML 저장: debug_page.html');

    } catch (e) {
        out(`오류: ${e.message}`);
    } finally {
        fs.writeFileSync(OUT, log, 'utf8');
        console.log(`\n결과 저장 완료: ${OUT}`);
        console.log('30초 후 종료...');
        await sleep(30000);
        await browser.close();
    }
}

run();
