// 청주떼제베CC 자동예약 스크립트
// 사용법: node booker.js YYYY-MM-DD [morning|afternoon|evening]
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { chromium } = require('/home/paks11299958/ai_mp/node_modules/playwright');

const GOLF_URL  = 'https://www.adtgv.co.kr';
const LOGIN_URL = `${GOLF_URL}/html/member/login.asp`;
const BOOK_URL  = `${GOLF_URL}/html/reserve/reserve01.asp`;
// 환경변수 우선, 없으면 하드코딩된 기본값 (개인 계정)
const ID        = process.env.GOLF_LOGIN_ID || 'paks1012';
const PW        = process.env.GOLF_LOGIN_PW || 'paks9958!';

// 시간대 범위 (HHMM 숫자 비교)
const TIME_RANGES = {
    morning:   { min: 0,    max: 1159 },
    afternoon: { min: 1200, max: 1659 },
    evening:   { min: 1700, max: 2359 },
};

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const NOTIFY_EMAIL  = 'paks1012@naver.com';

async function sendNotification(subject, html) {
    if (!BREVO_API_KEY) return;
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
    } catch (e) {
        console.error('이메일 발송 실패:', e.message);
    }
}

async function book(dateStr, timePeriod = 'morning') {
    // dateStr: YYYY-MM-DD
    const [year, month, day] = dateStr.split('-');
    const range = TIME_RANGES[timePeriod] ?? TIME_RANGES.morning;

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

        // 2. 예약 페이지 이동
        await page.goto(BOOK_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        // 3. 날짜 클릭
        const dateAvailable = await page.evaluate(([y, m, d]) => {
            const cells = Array.from(document.querySelectorAll('.calendar .days li div.book'));
            return cells.some(el => el.getAttribute('onclick')?.includes(`Date_Click('${y}','${m}','${d}')`));
        }, [year, month, day]);

        if (!dateAvailable) {
            throw new Error(`${dateStr} 예약 가능한 날짜가 아닙니다.`);
        }

        await page.evaluate(([y, m, d]) => Date_Click(y, m, d), [year, month, day]);
        await page.waitForTimeout(2500);

        // 4. 타임슬롯 수집 (인덱스 포함)
        const slots = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.step2_table2.in_table')).map((row, idx) => {
                const cells = Array.from(row.querySelectorAll('li'));
                return {
                    idx,
                    time:   cells[0]?.textContent?.trim() ?? '',
                    course: cells[1]?.textContent?.trim() ?? '',
                    price:  cells[2]?.textContent?.trim() ?? '',
                };
            });
        });

        if (slots.length === 0) {
            throw new Error(`${dateStr} 예약 가능한 티타임이 없습니다.`);
        }

        // 5. 시간대 필터 후 가장 빠른 시간 선택
        const filtered = slots
            .filter(s => {
                const t = parseInt(s.time.replace(':', ''), 10);
                return t >= range.min && t <= range.max;
            })
            .sort((a, b) => {
                const ta = parseInt(a.time.replace(':', ''), 10);
                const tb = parseInt(b.time.replace(':', ''), 10);
                return ta - tb;
            });

        if (filtered.length === 0) {
            const periodLabel = { morning: '오전', afternoon: '오후', evening: '저녁' }[timePeriod];
            throw new Error(`${dateStr} ${periodLabel} 시간대에 예약 가능한 티타임이 없습니다.`);
        }

        const target = filtered[0];
        console.log(`예약 시도: ${dateStr} ${target.time} ${target.course} ${target.price}`);

        // 6. 다이얼로그 핸들러를 버튼 클릭 전에 등록
        page.on('dialog', async dialog => {
            console.log('다이얼로그:', dialog.message());
            await dialog.accept();
        });

        // 7. 실제 버튼 요소를 찾아서 클릭
        const allButtons = await page.$$('.step2_table2.in_table button');
        const btn = allButtons[target.idx];
        if (!btn) throw new Error('예약 버튼을 찾을 수 없습니다.');
        await btn.click();
        await page.waitForTimeout(3000);

        // 8. 예약정보 확인 페이지 감지 → "예약" 버튼 한 번 더 클릭 (2단계 확인)
        const pageBtns = await page.$$('button');
        let finalClicked = false;
        for (const pb of pageBtns) {
            const txt = (await pb.textContent() || '').trim();
            if (txt === '예약') {
                console.log('예약 확인 페이지 감지 — 최종 예약 버튼 클릭');
                await pb.click();
                finalClicked = true;
                await page.waitForTimeout(3000);
                break;
            }
        }
        if (!finalClicked) {
            console.log('예약 확인 페이지 없음 — 단일 단계로 처리');
        }

        // 9. 현재 페이지 텍스트로 성공 여부 판단
        const pageText = await page.evaluate(() => document.body?.innerText ?? '');
        const confirmed = pageText.includes(year) && (
            pageText.includes(month) || pageText.includes(target.time)
        ) && !pageText.includes('예약된 사항이 없습니다');

        // 결과 스크린샷
        const screenshotPath = `/home/paks11299958/ai_mp/golf/result_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });

        if (!confirmed) {
            throw new Error(`예약 버튼을 눌렀으나 예약 내역에서 확인되지 않았습니다. 골프장 사이트를 직접 확인해주세요.`);
        }

        const successMsg = `✅ 예약 완료\n날짜: ${dateStr}\n시간: ${target.time}\n코스: ${target.course}\n요금: ${target.price}`;
        console.log(successMsg);

        await sendNotification(
            `[골프예약 완료] ${dateStr} ${target.time} ${target.course}`,
            `<h2>골프 예약이 완료되었습니다</h2>
             <table border="1" cellpadding="8">
               <tr><td>날짜</td><td>${dateStr}</td></tr>
               <tr><td>시간</td><td>${target.time}</td></tr>
               <tr><td>코스</td><td>${target.course}</td></tr>
               <tr><td>요금</td><td>${target.price}</td></tr>
             </table>`
        );

        return { ok: true, time: target.time, course: target.course, price: target.price };

    } catch (err) {
        console.error('예약 실패:', err.message);
        await sendNotification(
            `[골프예약 실패] ${dateStr}`,
            `<h2>골프 예약에 실패했습니다</h2><p>${err.message}</p>`
        );
        return { ok: false, error: err.message };
    } finally {
        await browser.close();
    }
}

// CLI 실행
const [,, dateArg, periodArg] = process.argv;
if (!dateArg) {
    console.error('사용법: node booker.js YYYY-MM-DD [morning|afternoon|evening]');
    process.exit(1);
}
book(dateArg, periodArg || 'morning').then(r => {
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
});
