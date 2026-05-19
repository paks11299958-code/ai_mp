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

// 프리미엄 HTML 이메일 빌더
function buildSuccessEmail(dateStr, time, course, price) {
    const reservationNo = `GF-${Date.now().toString(36).toUpperCase().slice(-8)}`;
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>골프 예약 완료</title></head>
<body style="margin:0;padding:0;background:#0d1f17;font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1f17;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- 헤더 -->
        <tr><td style="background:linear-gradient(135deg,#0f2d1a 0%,#1a4a2a 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;border-bottom:1px solid #c9a84c40;">
          <div style="width:56px;height:56px;background:rgba(201,168,76,0.15);border:2px solid #c9a84c;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:26px;">&#x26F3;</div>
          <p style="margin:0 0 8px;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:600;">RESERVATION CONFIRMED</p>
          <h1 style="margin:0 0 6px;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">예약이 완료되었습니다</h1>
          <p style="margin:0;color:#7a9e8a;font-size:13px;">예약번호 &nbsp;<span style="color:#c9a84c;font-weight:600;font-family:monospace;">${reservationNo}</span></p>
        </td></tr>

        <!-- 예약 정보 카드 -->
        <tr><td style="background:#132b1d;padding:0 40px;">

          <!-- 날짜 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #1e3d2a;padding:22px 0;">
            <tr>
              <td style="padding:22px 0 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#6b9678;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;width:80px;">DATE</td>
                    <td style="color:#ffffff;font-size:16px;font-weight:600;text-align:right;">${dateStr}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 시간 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #1e3d2a;">
            <tr>
              <td style="padding:20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#6b9678;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;width:80px;">TIME</td>
                    <td style="color:#c9a84c;font-size:22px;font-weight:700;text-align:right;font-family:monospace;">${time}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 코스 -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #1e3d2a;">
            <tr>
              <td style="padding:20px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#6b9678;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;width:80px;">COURSE</td>
                    <td style="color:#ffffff;font-size:15px;font-weight:500;text-align:right;">${course}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- 요금 -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:20px 0 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#6b9678;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;width:80px;">FEE</td>
                    <td style="color:#ffffff;font-size:18px;font-weight:700;text-align:right;">${price}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- 하단 정보 -->
        <tr><td style="background:#0f2d1a;border-radius:0 0 16px 16px;padding:20px 40px 28px;border-top:1px solid #c9a84c30;">
          <p style="margin:0 0 4px;color:#4a7a5a;font-size:11px;text-align:center;">예약 확정 시각: ${now}</p>
          <p style="margin:0;color:#3a6040;font-size:11px;text-align:center;">본 메일은 자동으로 발송되었습니다. aichat.dbzone.kr</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildFailEmail(dateStr, reason) {
    return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#1a0d0d;font-family:'Apple SD Gothic Neo',Malgun Gothic,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0d0d;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#2d0f0f 0%,#3d1a1a 100%);border-radius:16px;padding:40px;text-align:center;">
          <p style="margin:0 0 16px;font-size:36px;">&#x26A0;&#xFE0F;</p>
          <h1 style="margin:0 0 12px;color:#ffffff;font-size:20px;font-weight:700;">예약에 실패했습니다</h1>
          <p style="margin:0 0 24px;color:#c07070;font-size:14px;">라운드 날짜: ${dateStr}</p>
          <div style="background:#2a1515;border-radius:10px;padding:16px 20px;text-align:left;">
            <p style="margin:0;color:#e08080;font-size:13px;line-height:1.6;">${reason}</p>
          </div>
          <p style="margin:24px 0 0;color:#7a4040;font-size:11px;">골프장 사이트에서 직접 예약 상태를 확인해주세요.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

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
            buildSuccessEmail(dateStr, target.time, target.course, target.price),
            `✅ 골프 예약 완료\n\n📅 ${dateStr}\n⏰ ${target.time}\n⛳ ${target.course}\n💰 ${target.price}`
        );

        return { ok: true, time: target.time, course: target.course, price: target.price };

    } catch (err) {
        console.error('예약 실패:', err.message);
        await sendNotification(
            `[골프예약 실패] ${dateStr}`,
            buildFailEmail(dateStr, err.message),
            `❌ 골프 예약 실패\n\n📅 ${dateStr}\n사유: ${err.message}`
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
