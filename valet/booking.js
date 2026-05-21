// 발렛파킹 예약 매크로 — 집 PC 실행용 (Element UI / Vue.js)
// 대상: https://valet.amanopark.co.kr/booking
// 목표: 6월 3일 날짜 선택 가능해질 때까지 반복 클릭

if (process.platform === 'win32') {
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch {}
}

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const TARGET_MONTH  = '6';    // 6월
const TARGET_YEAR   = '2026';
const TARGET_DAY    = '3';    // 3일
const RETRY_MS      = 2000;   // 실패 시 재시도 간격 (ms)
const MAX_RETRIES   = 1800;   // 최대 시도 횟수 (기본 1시간)

const sleep  = ms => new Promise(r => setTimeout(r, ms));
const rand   = (min, max) => Math.floor(Math.random() * (max - min) + min);
const delay  = (min, max) => sleep(rand(min, max));  // 랜덤 딜레이

function beep() {
    process.stdout.write('\x07');
}

async function tryClickDate(page) {
    // ── 1. 출발일 입력창 클릭 (placeholder="년도-월-일" 첫번째) ──
    const dateInput = page.locator('input.el-input__inner[placeholder="년도-월-일"]').first();
    if (!await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        return { ok: false, reason: '날짜 입력창 없음 (페이지 로딩 확인)' };
    }
    await dateInput.click();
    await delay(700, 1200);

    // ── 2. Element UI 피커 패널 대기 ─────────────────────────
    const panel = page.locator('.el-picker-panel').first();
    if (!await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
        return { ok: false, reason: '달력 팝업이 열리지 않음' };
    }

    // ── 3. 2026년 6월로 이동 ─────────────────────────────────
    // 헤더 전체 텍스트 읽기 (연도·월이 별도 span으로 나뉘어 있으므로 header div 전체를 읽음)
    for (let i = 0; i < 15; i++) {
        const headerText = await panel.locator('.el-date-picker__header')
            .textContent().catch(() => '');

        const isYear2026 = headerText.includes(TARGET_YEAR);
        const isMonth6   = headerText.includes('June') || headerText.includes('Jun')
                        || /6[月월]/.test(headerText)
                        || headerText.includes(' 6 ')
                        || headerText.includes('\n6');

        if (isYear2026 && isMonth6) break;

        const nextBtn = panel.locator('button.el-icon-arrow-right').first();
        if (await nextBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await nextBtn.click();
            await delay(350, 650);
        } else {
            return { ok: false, reason: '다음달 버튼 없음' };
        }
    }

    // ── 4. 3일 셀 찾기 & 클릭 ────────────────────────────────
    const allTds = panel.locator('.el-date-table tbody td');
    const count  = await allTds.count();

    for (let i = 0; i < count; i++) {
        const td = allTds.nth(i);
        const cls = await td.getAttribute('class').catch(() => '') || '';

        if (cls.includes('prev-month') || cls.includes('next-month')) continue;

        const cellText = (await td.locator('span').textContent().catch(() => '')).trim();
        if (cellText !== TARGET_DAY) continue;

        if (cls.includes('disabled')) {
            return { ok: false, reason: `${TARGET_MONTH}월 ${TARGET_DAY}일 비활성화 (아직 예약 불가)` };
        }

        await td.locator('span').click();
        await delay(400, 700);
        return { ok: true };
    }

    return { ok: false, reason: `${TARGET_MONTH}월 ${TARGET_DAY}일 날짜 요소 못찾음` };
}

async function run() {
    console.log(`\n발렛파킹 예약 매크로 시작`);
    console.log(`목표: ${TARGET_YEAR}년 ${TARGET_MONTH}월 ${TARGET_DAY}일`);
    console.log(`재시도 간격: ${RETRY_MS / 1000}초 | 최대: ${MAX_RETRIES}회\n`);

    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
    });
    const context = await browser.newContext({
        userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport:   null,
        locale:     'ko-KR',
        timezoneId: 'Asia/Seoul',
    });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();

    let success = false;
    try {
        console.log('사이트 접속 중...');
        await page.goto('https://valet.amanopark.co.kr/booking', {
            waitUntil: 'networkidle',
            timeout: 30000,
        });
        await sleep(2000);
        console.log('사이트 로딩 완료. 예약 시도 시작...\n');

        let attempt = 0;
        while (attempt < MAX_RETRIES) {
            attempt++;
            const now = new Date().toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });

            const result = await tryClickDate(page);

            if (result.ok) {
                success = true;
                beep(); beep(); beep();
                break;
            } else {
                process.stdout.write(`\r[${attempt}회] ${now} — ${result.reason}  `);
                // 달력만 닫고 재시도 (페이지 새로고침 없음)
                await page.keyboard.press('Escape').catch(() => {});
                await delay(RETRY_MS, RETRY_MS + 1000);
            }
        }

        if (!success) {
            console.log(`\n최대 재시도 횟수(${MAX_RETRIES}회) 초과. 종료합니다.`);
        }

    } catch (e) {
        console.log(`\n오류: ${e.message.split('\n')[0]}`);
    } finally {
        if (!success) await browser.close().catch(() => {});
    }

    // 성공 시 브라우저 유지 (사용자가 직접 예약 완료)
    if (success) await sleep(4 * 60 * 60 * 1000);
}

run();
