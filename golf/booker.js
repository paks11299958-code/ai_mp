// 골프장 자동예약 스크립트
// 사용법: node booker.js YYYY-MM-DD [morning|afternoon|evening] [openAt-ISO]
//   openAt: 예약 오픈 시각(ISO). 지정 시 오픈 직전부터 대기 → 오픈 즉시 예약 시도
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { chromium } = require('/home/paks11299958/ai_mp/node_modules/playwright');

const GOLF_URL  = 'https://www.adtgv.co.kr';
const LOGIN_URL = `${GOLF_URL}/html/member/login.asp`;
const BOOK_URL  = `${GOLF_URL}/html/reserve/reserve01.asp`;
const ID        = process.env.GOLF_LOGIN_ID || 'paks1012';
const PW        = process.env.GOLF_LOGIN_PW || 'paks9958!';

const TIME_RANGES = {
    morning:   { min: 0,    max: 1159 },
    afternoon: { min: 1200, max: 1659 },
    evening:   { min: 1700, max: 2359 },
};

const BREVO_API_KEY  = process.env.BREVO_API_KEY;
const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL || '';
const NOTIFY_PHONE   = process.env.NOTIFY_PHONE || '';
const SOLAPI_API_KEY = process.env.SOLAPI_API_KEY;
const SOLAPI_SECRET  = process.env.SOLAPI_API_SECRET;
const SOLAPI_FROM    = process.env.SOLAPI_SENDER_PHONE;

const crypto = require('crypto');

async function sendNotification(subject, html, smsText) {
    if (NOTIFY_EMAIL && BREVO_API_KEY) {
        try {
            await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: { name: 'Golf Booking Bot', email: 'noreply@golf.dbzone.kr' },
                    to: [{ email: NOTIFY_EMAIL }],
                    subject,
                    htmlContent: html,
                }),
            });
            console.log('이메일 발송 완료:', NOTIFY_EMAIL);
        } catch (e) {
            console.error('이메일 발송 실패:', e.message);
        }
    } else if (NOTIFY_PHONE && SOLAPI_API_KEY && SOLAPI_SECRET && SOLAPI_FROM) {
        try {
            const date = new Date().toISOString();
            const salt = crypto.randomBytes(16).toString('hex');
            const sig  = crypto.createHmac('sha256', SOLAPI_SECRET).update(date + salt).digest('hex');
            const auth = `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${sig}`;
            await fetch('https://api.solapi.com/messages/v4/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: auth },
                body: JSON.stringify({ message: { to: NOTIFY_PHONE, from: SOLAPI_FROM, text: smsText } }),
            });
            console.log('SMS 발송 완료:', NOTIFY_PHONE);
        } catch (e) {
            console.error('SMS 발송 실패:', e.message);
        }
    } else {
        console.warn('알림 수단 없음 (이메일/SMS 모두 미설정)');
    }
}

// 페이지에서 슬롯 목록 추출
async function getSlots(page) {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll('.step2_table2.in_table')).map((row, idx) => {
            const cells = Array.from(row.querySelectorAll('li'));
            return {
                idx,
                time:   cells[0]?.textContent?.trim() ?? '',
                course: cells[1]?.textContent?.trim() ?? '',
                price:  cells[2]?.textContent?.trim() ?? '',
            };
        })
    );
}

// 날짜 클릭 후 슬롯이 나타날 때까지 대기
// openAt: Date 객체 (예약 오픈 시각). null이면 즉시 조회
async function waitForSlots(page, year, month, day, openAt) {
    const POLL_INTERVAL   = 2000;   // 오픈 전 새로고침 간격 (ms)
    const POST_OPEN_POLL  = 500;    // 오픈 후 새로고침 간격 (ms)
    const MAX_WAIT_AFTER  = 10 * 60 * 1000; // 오픈 후 최대 대기 10분

    const clickDate = async () => {
        await page.evaluate(([y, m, d]) => Date_Click(y, m, d), [year, month, day]);
        await page.waitForTimeout(1500);
    };

    await clickDate();

    if (!openAt) {
        return getSlots(page);
    }

    const openMs  = openAt.getTime();
    const deadline = openMs + MAX_WAIT_AFTER;

    console.log(`[대기모드] 예약 오픈 시각: ${openAt.toISOString()} (KST ${toKST(openAt)})`);

    while (true) {
        const now = Date.now();

        if (now > deadline) {
            throw new Error('예약 오픈 후 10분이 지났으나 예약 가능한 슬롯을 찾지 못했습니다.');
        }

        const slots = await getSlots(page);

        if (now >= openMs && slots.length > 0) {
            console.log(`[대기모드] 슬롯 ${slots.length}개 감지 — 즉시 예약 시도`);
            return slots;
        }

        const remaining = openMs - now;
        if (remaining > 5000) {
            console.log(`[대기모드] 오픈까지 ${Math.ceil(remaining / 1000)}초 남음 — 대기 중...`);
            await page.waitForTimeout(POLL_INTERVAL);
        } else if (remaining > 0) {
            // 오픈 직전 — 정확히 오픈 시각에 맞춰 대기
            await page.waitForTimeout(remaining);
        } else {
            // 오픈 후인데 슬롯 없음 — 빠르게 새로고침
            console.log(`[대기모드] 오픈 후 슬롯 없음 — 새로고침`);
            await page.waitForTimeout(POST_OPEN_POLL);
        }

        await clickDate();
    }
}

function toKST(date) {
    return new Date(date.getTime() + 9 * 60 * 60 * 1000)
        .toISOString().replace('T', ' ').slice(0, 16);
}

async function book(dateStr, timePeriod = 'morning', openAt = null) {
    const [year, month, day] = dateStr.split('-');
    const range = TIME_RANGES[timePeriod] ?? TIME_RANGES.morning;
    const openAtDate = openAt ? new Date(openAt) : null;

    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    try {
        // 1. 로그인
        await page.goto(LOGIN_URL);
        await page.fill('#loginId', ID);
        await page.fill('#loginPw', PW);
        await page.click('button.btn-main');
        await page.waitForLoadState('networkidle');

        if (page.url().includes('login')) {
            throw new Error('로그인 실패 — ID/PW 확인 필요');
        }
        console.log('로그인 완료');

        // 2. 예약 페이지 이동
        await page.goto(BOOK_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // 3. 날짜 예약 가능 여부 확인
        const dateAvailable = await page.evaluate(([y, m, d]) => {
            const cells = Array.from(document.querySelectorAll('.calendar .days li div.book'));
            return cells.some(el => el.getAttribute('onclick')?.includes(`Date_Click('${y}','${m}','${d}')`));
        }, [year, month, day]);

        if (!dateAvailable) {
            throw new Error(`${dateStr} 예약 가능한 날짜가 아닙니다.`);
        }

        // 4. 오픈 시각까지 대기 후 슬롯 수집
        const slots = await waitForSlots(page, year, month, day, openAtDate);

        if (slots.length === 0) {
            throw new Error(`${dateStr} 예약 가능한 티타임이 없습니다.`);
        }

        // 5. 시간대 필터 후 가장 빠른 슬롯 선택
        const filtered = slots
            .filter(s => {
                const t = parseInt(s.time.replace(':', ''), 10);
                return t >= range.min && t <= range.max;
            })
            .sort((a, b) =>
                parseInt(a.time.replace(':', ''), 10) - parseInt(b.time.replace(':', ''), 10)
            );

        if (filtered.length === 0) {
            const label = { morning: '오전', afternoon: '오후', evening: '저녁' }[timePeriod];
            throw new Error(`${dateStr} ${label} 시간대에 예약 가능한 티타임이 없습니다.`);
        }

        const target = filtered[0];
        console.log(`예약 시도: ${dateStr} ${target.time} ${target.course} ${target.price}`);

        // 6. 다이얼로그 핸들러를 버튼 클릭 전에 등록
        page.on('dialog', async dialog => {
            console.log('다이얼로그:', dialog.message());
            await dialog.accept();
        });

        // 7. 예약 버튼 클릭
        const allButtons = await page.$$('.step2_table2.in_table button');
        const btn = allButtons[target.idx];
        if (!btn) throw new Error('예약 버튼을 찾을 수 없습니다.');
        await btn.click();
        await page.waitForTimeout(3000);

        // 8. 예약 확인 페이지 → "예약" 버튼 한 번 더 클릭
        const pageBtns = await page.$$('button');
        let finalClicked = false;
        for (const pb of pageBtns) {
            const txt = (await pb.textContent() || '').trim();
            if (txt === '예약') {
                console.log('예약 확인 페이지 — 최종 예약 버튼 클릭');
                await pb.click();
                finalClicked = true;
                await page.waitForTimeout(3000);
                break;
            }
        }
        if (!finalClicked) console.log('단일 단계 예약 처리');

        // 9. 성공 여부 판단
        const pageText = await page.evaluate(() => document.body?.innerText ?? '');
        const confirmed = pageText.includes(year) &&
            (pageText.includes(month) || pageText.includes(target.time)) &&
            !pageText.includes('예약된 사항이 없습니다');

        const screenshotPath = `/home/paks11299958/ai_mp/golf/result_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });

        if (!confirmed) {
            throw new Error('예약 버튼을 눌렀으나 예약 내역에서 확인되지 않았습니다. 골프장 사이트를 직접 확인해주세요.');
        }

        console.log(`✅ 예약 완료: ${dateStr} ${target.time} ${target.course}`);

        await sendNotification(
            `[골프예약 완료] ${dateStr} ${target.time} ${target.course}`,
            `<h2>골프 예약이 완료되었습니다</h2>
             <table border="1" cellpadding="8">
               <tr><td>날짜</td><td>${dateStr}</td></tr>
               <tr><td>시간</td><td>${target.time}</td></tr>
               <tr><td>코스</td><td>${target.course}</td></tr>
               <tr><td>요금</td><td>${target.price}</td></tr>
             </table>`,
            `[골프예약 완료]\n날짜: ${dateStr}\n시간: ${target.time}\n코스: ${target.course}\n요금: ${target.price}`
        );

        return { ok: true, time: target.time, course: target.course, price: target.price };

    } catch (err) {
        console.error('예약 실패:', err.message);
        await sendNotification(
            `[골프예약 실패] ${dateStr}`,
            `<h2>골프 예약에 실패했습니다</h2><p>${err.message}</p>`,
            `[골프예약 실패]\n날짜: ${dateStr}\n사유: ${err.message}`
        );
        return { ok: false, error: err.message };
    } finally {
        await browser.close();
    }
}

// CLI 실행
const [,, dateArg, periodArg, openAtArg] = process.argv;
if (!dateArg) {
    console.error('사용법: node booker.js YYYY-MM-DD [morning|afternoon|evening] [openAt-ISO]');
    process.exit(1);
}
book(dateArg, periodArg || 'morning', openAtArg || null).then(r => {
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
});
