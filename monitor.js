/**
 * Site Monitor — 3시간마다 crontab으로 실행
 * 성공/실패 결과를 Brevo 이메일로 발송 + 스크린샷 첨부
 *
 * 실행: node /home/paks11299958/ai_mp/monitor.js
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── 설정 ──────────────────────────────────────────────
const TARGET_URL      = 'https://aichat.dbzone.kr';
const SCREENSHOT_PATH = path.join(__dirname, 'site_status.png');
const TIMEOUT_MS      = 10_000;
const RECIPIENT_EMAIL = 'paks11299958@gmail.com';
const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const SENDER_EMAIL    = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
// ──────────────────────────────────────────────────────

async function sendEmail({ subject, htmlContent, screenshotPath }) {
    if (!BREVO_API_KEY) {
        console.warn('⚠️  BREVO_API_KEY 없음 — 이메일 발송 건너뜀');
        return;
    }

    const attachments = [];
    if (screenshotPath && fs.existsSync(screenshotPath)) {
        const content = fs.readFileSync(screenshotPath).toString('base64');
        attachments.push({ name: 'site_status.png', content });
    }

    const body = JSON.stringify({
        sender:  { name: '사이트 모니터', email: SENDER_EMAIL },
        to:      [{ email: RECIPIENT_EMAIL }],
        subject,
        htmlContent,
        ...(attachments.length > 0 ? { attachment: attachments } : {}),
    });

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method:  'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body,
    });

    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Brevo 발송 실패 (${res.status}): ${err}`);
    }
}

(async () => {
    const now      = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const browser  = await chromium.launch({ headless: true });
    const page     = await browser.newPage();

    try {
        const response = await page.goto(TARGET_URL, {
            timeout:   TIMEOUT_MS,
            waitUntil: 'networkidle',
        });

        const status = response?.status() ?? 0;
        if (status >= 400) throw new Error(`HTTP ${status}`);

        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
        console.log(`✅ [성공] ${now} — ${TARGET_URL} (HTTP ${status})`);
        console.log(`📸 스크린샷: ${SCREENSHOT_PATH}`);

        await sendEmail({
            subject: `✅ [정상] aichat.dbzone.kr — ${now}`,
            htmlContent: `
                <h2 style="color:#16a34a">✅ 사이트 정상 운영 중</h2>
                <table style="font-size:14px;line-height:1.8">
                    <tr><td><b>URL</b></td><td>${TARGET_URL}</td></tr>
                    <tr><td><b>HTTP 상태</b></td><td>${status}</td></tr>
                    <tr><td><b>점검 시각</b></td><td>${now}</td></tr>
                </table>
                <p style="color:#6b7280;font-size:12px;margin-top:16px">스크린샷을 첨부파일에서 확인하세요.</p>
            `,
            screenshotPath: SCREENSHOT_PATH,
        });

        console.log(`📧 성공 이메일 발송 → ${RECIPIENT_EMAIL}`);

    } catch (err) {
        const now2 = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.error(`⚠️ [경고] 사이트 접속 실패! → ${err.message}`);

        try {
            await sendEmail({
                subject: `🚨 [장애] aichat.dbzone.kr 접속 불가 — ${now2}`,
                htmlContent: `
                    <h2 style="color:#dc2626">🚨 사이트 접속 장애 감지</h2>
                    <table style="font-size:14px;line-height:1.8">
                        <tr><td><b>URL</b></td><td>${TARGET_URL}</td></tr>
                        <tr><td><b>오류</b></td><td style="color:#dc2626">${err.message}</td></tr>
                        <tr><td><b>감지 시각</b></td><td>${now2}</td></tr>
                    </table>
                    <p style="margin-top:16px;font-weight:bold;color:#dc2626">즉시 서버 상태를 확인해주세요.</p>
                `,
                screenshotPath: null,
            });
            console.error(`📧 장애 알림 이메일 발송 → ${RECIPIENT_EMAIL}`);
        } catch (mailErr) {
            console.error(`❌ 이메일 발송도 실패: ${mailErr.message}`);
        }

        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
