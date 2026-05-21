// 발렛파킹 예약 매크로 — 집 PC 실행용
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

function beep() {
    // Windows 콘솔 벨
    process.stdout.write('\x07');
}

async function tryClickDate(page) {
    // ── 날짜 입력창 클릭 (달력 열기) ─────────────────────
    const inputSelectors = [
        "input[placeholder*='년도']",
        "input[placeholder*='날짜']",
        "input[placeholder*='date']",
        "input[placeholder*='Date']",
        ".date-input",
        "[class*='departure'] input",
        "[class*='pickup'] input",
        "[id*='date']",
    ];

    let calendarOpened = false;
    for (const sel of inputSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
            await el.click();
            await sleep(800);
            calendarOpened = true;
            break;
        }
    }

    if (!calendarOpened) {
        // 달력 트리거 버튼 시도
        const btnSelectors = [
            "[class*='calendar'] button",
            "[class*='picker'] button",
            "button[class*='date']",
        ];
        for (const sel of btnSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
                await el.click();
                await sleep(800);
                calendarOpened = true;
                break;
            }
        }
    }

    if (!calendarOpened) return { ok: false, reason: '달력 열기 실패' };

    // ── 월 이동 (현재 월 확인 후 6월로 이동) ──────────────
    const maxMonthNav = 12;
    for (let i = 0; i < maxMonthNav; i++) {
        // 헤더 텍스트 확인
        const headerSelectors = [
            ".vc-title",          // vue-calendar
            ".datepicker-title",
            "[class*='header'] [class*='title']",
            "[class*='calendar'] [class*='header']",
            "[class*='month']",
            "table caption",
            "th[class*='month']",
        ];
        let headerText = '';
        for (const sel of headerSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
                headerText = (await el.textContent()) || '';
                if (headerText.trim()) break;
            }
        }

        const hasYear  = headerText.includes(TARGET_YEAR);
        const hasMonth = headerText.includes(`${TARGET_MONTH}월`)
                      || headerText.includes(`June`)
                      || headerText.includes(`Jun`)
                      || (hasYear && headerText.replace(/\D/g, '').includes(TARGET_MONTH));

        if (hasYear && hasMonth) break; // 6월 2026 도달

        // 다음 달 버튼
        const nextBtnSelectors = [
            ".vc-arrow.is-right",
            "button[aria-label*='next']",
            "button[aria-label*='다음']",
            "button[title*='다음']",
            "[class*='next']",
            ".datepicker-next",
            "button:has(svg):last-of-type",
        ];
        let moved = false;
        for (const sel of nextBtnSelectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
                await el.click();
                await sleep(500);
                moved = true;
                break;
            }
        }
        if (!moved) {
            // 키보드로 시도
            await page.keyboard.press('ArrowRight');
            await sleep(400);
        }
    }

    // ── 3일 클릭 시도 ────────────────────────────────────
    // 정확히 '3' 텍스트인 날짜 셀 (13, 23 제외)
    const daySelectors = [
        `//td[normalize-space(text())='${TARGET_DAY}']`,
        `//button[normalize-space(text())='${TARGET_DAY}']`,
        `//span[normalize-space(text())='${TARGET_DAY}']`,
        `//div[normalize-space(text())='${TARGET_DAY}' and contains(@class,'day')]`,
        `//li[normalize-space(text())='${TARGET_DAY}']`,
    ];

    for (const xpath of daySelectors) {
        const els = page.locator(`xpath=${xpath}`);
        const count = await els.count();
        for (let i = 0; i < count; i++) {
            const el = els.nth(i);
            if (!await el.isVisible({ timeout: 300 }).catch(() => false)) continue;

            // disabled 여부 확인
            const disabled = await el.evaluate(e => {
                return e.hasAttribute('disabled')
                    || e.getAttribute('aria-disabled') === 'true'
                    || e.classList.contains('disabled')
                    || e.classList.contains('is-disabled')
                    || e.classList.contains('unavailable')
                    || e.classList.contains('inactive')
                    || e.classList.contains('greyed');
            });

            if (disabled) return { ok: false, reason: `${TARGET_MONTH}월 ${TARGET_DAY}일 비활성화 (예약 불가)` };

            // 클릭 가능 → 클릭
            await el.click();
            await sleep(500);
            return { ok: true };
        }
    }

    return { ok: false, reason: `${TARGET_MONTH}월 ${TARGET_DAY}일 날짜 요소를 찾지 못함` };
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
            waitUntil: 'domcontentloaded',
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
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
                await sleep(RETRY_MS);
            }
        }

        if (!success) {
            console.log(`\n최대 재시도 횟수(${MAX_RETRIES}회) 초과. 종료합니다.`);
        }

    } catch (e) {
        console.log(`\n오류: ${e.message.split('\n')[0]}`);
    } finally {
        // 성공 시 브라우저를 닫지 않음 — 사용자가 직접 예약 완료
        if (!success) await browser.close().catch(() => {});
    }

    // 성공 시 프로세스를 유지해 브라우저가 살아있도록 대기 (4시간)
    if (success) await sleep(4 * 60 * 60 * 1000);
}

run();
