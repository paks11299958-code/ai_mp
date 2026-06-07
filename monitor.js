/**
 * Site Monitor — 3시간마다 crontab으로 실행
 * 1. 사이트 열림 확인 (HTTP 상태)
 * 2. 로그인 + 페르소나 목록 확인
 * 결과를 Brevo 이메일로 발송 + 스크린샷 첨부
 *
 * 실행: node /home/paks11299958/ai_mp/monitor.js
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── 설정 ──────────────────────────────────────────────
const TARGET_URL       = 'https://aichat.dbzone.kr';
const SCREENSHOT_PATH  = path.join(__dirname, 'site_status.png');
// 점검 결과 요약 — 어드민 대시보드가 "마지막 실행 시각/성공여부"를 읽는다
const STATUS_PATH      = path.join(__dirname, 'monitor-status.json');
const TIMEOUT_MS       = 15_000;
const RECIPIENT_EMAIL  = 'paks11299958@gmail.com';
const BREVO_API_KEY    = process.env.BREVO_API_KEY;
const SENDER_EMAIL     = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const MONITOR_EMAIL    = process.env.MONITOR_EMAIL;
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD;
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
        sender:     { name: '사이트 모니터', email: SENDER_EMAIL },
        to:         [{ email: RECIPIENT_EMAIL }],
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
    const now     = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const startedAt = Date.now();
    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage();

    const results = {
        site:  { ok: false, detail: '' },
        login: { ok: false, detail: '' },
    };

    try {
        // ── Check 1: 사이트 열림 ──────────────────────────────
        try {
            const response = await page.goto(TARGET_URL, {
                timeout:   TIMEOUT_MS,
                waitUntil: 'networkidle',
            });
            const status = response?.status() ?? 0;
            if (status >= 400) throw new Error(`HTTP ${status}`);
            results.site = { ok: true, detail: `HTTP ${status}` };
            console.log(`✅ [사이트] ${TARGET_URL} — HTTP ${status}`);
        } catch (err) {
            results.site = { ok: false, detail: err.message };
            console.error(`❌ [사이트] ${err.message}`);
        }

        // ── Check 2: 로그인 + 페르소나 목록 ──────────────────
        if (!results.site.ok) {
            results.login = { ok: false, detail: '사이트 접속 실패로 로그인 점검 건너뜀' };
        } else if (!MONITOR_EMAIL || !MONITOR_PASSWORD) {
            results.login = { ok: false, detail: 'MONITOR_EMAIL/MONITOR_PASSWORD 환경변수 미설정' };
        } else {
            try {
                // 페이지 안정화 대기
                await page.waitForTimeout(2000);

                // 공지사항 모달이 자동 팝업된 경우 배경 클릭으로 닫기
                // (AnnouncementModal z-50이 AuthModal z-50 위를 덮어 email input을 가림)
                const announcementVisible = await page.locator('text=공지사항').first().isVisible().catch(() => false);
                if (announcementVisible) {
                    await page.mouse.click(10, 10); // 모달 외부 배경 클릭 → onClose
                    await page.waitForTimeout(500);
                }

                // 로그인 버튼 클릭 (공지사항 모달 닫힌 후)
                await page.getByRole('button', { name: '로그인' }).first().click({ force: true, timeout: TIMEOUT_MS });

                // 이메일 입력창 대기 후 입력
                await page.waitForSelector('input[placeholder*="example@email.com"]', { timeout: 10_000 });
                await page.fill('input[placeholder*="example@email.com"]', MONITOR_EMAIL);

                // 비밀번호 입력
                await page.fill('input[type="password"]', MONITOR_PASSWORD);

                // 폼 제출 (Enter)
                await page.keyboard.press('Enter');

                // 모달 닫힘 대기 (비밀번호 input 사라짐 = 로그인 성공)
                await page.waitForSelector('input[type="password"]', {
                    state:   'hidden',
                    timeout: TIMEOUT_MS,
                });

                // 로그인 후 첫화면(LandingPageNew) 노출 확인
                // 로그인 시 헤더에 "{username}님 ✦"이 항상 뜨므로 이를 성공 지표로 사용.
                // (구버전 '채팅 시작하기' 버튼은 2026-06 첫화면 개편으로 제거됨)
                await page.waitForSelector('text=님 ✦', { timeout: 10_000 });

                results.login = { ok: true, detail: '로그인 성공 — 첫화면 확인' };
                console.log('✅ [로그인] 성공 — 첫화면 노출 확인');
            } catch (err) {
                results.login = { ok: false, detail: err.message };
                console.error(`❌ [로그인] ${err.message}`);
            }
        }

        // ── 스크린샷 ──────────────────────────────────────────
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
        console.log(`📸 스크린샷: ${SCREENSHOT_PATH}`);

        // ── 이메일 발송 ───────────────────────────────────────
        const allOk     = results.site.ok && results.login.ok;
        const siteRow   = row('사이트 열림', results.site);
        const loginRow  = row('로그인',     results.login);

        await sendEmail({
            subject: allOk
                ? `✅ [정상] aichat.dbzone.kr — ${now}`
                : `🚨 [장애] aichat.dbzone.kr — ${now}`,
            htmlContent: `
                <h2 style="color:${allOk ? '#16a34a' : '#dc2626'}">
                    ${allOk ? '✅ 사이트 정상 운영 중' : '🚨 장애 감지'}
                </h2>
                <table style="font-size:14px;line-height:2;border-collapse:collapse;width:100%;max-width:480px">
                    <thead>
                        <tr style="background:#f3f4f6">
                            <th style="padding:8px 14px;text-align:left">점검 항목</th>
                            <th style="padding:8px 14px;text-align:left">결과</th>
                            <th style="padding:8px 14px;text-align:left">상세</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${siteRow}
                        ${loginRow}
                    </tbody>
                </table>
                <p style="font-size:13px;color:#6b7280;margin-top:16px">점검 시각: ${now}</p>
                ${!allOk ? '<p style="margin-top:12px;font-weight:bold;color:#dc2626">즉시 서버 상태를 확인해주세요.</p>' : ''}
                <p style="color:#9ca3af;font-size:12px;margin-top:8px">스크린샷을 첨부파일에서 확인하세요.</p>
            `,
            screenshotPath: SCREENSHOT_PATH,
        });

        console.log(`📧 이메일 발송 → ${RECIPIENT_EMAIL}`);
        if (!allOk) process.exitCode = 1;

    } finally {
        await browser.close();

        // ── 결과 요약 기록 (대시보드용) ─────────────────────
        // try 안에서 예외가 나도 results는 부분 채워진 상태로 남기 위해 finally에서 기록.
        try {
            const ok = results.site.ok && results.login.ok;
            fs.writeFileSync(STATUS_PATH, JSON.stringify({
                lastRun:    new Date().toISOString(),
                lastRunKST: now,
                ok,
                site:       results.site,
                login:      results.login,
                durationMs: Date.now() - startedAt,
                host:       os.hostname(),
            }, null, 2));
        } catch (e) {
            console.error(`⚠️ monitor-status.json 기록 실패: ${e.message}`);
        }
    }
})();

function row(label, { ok, detail }) {
    const icon  = ok ? '✅' : '❌';
    const color = ok ? '#16a34a' : '#dc2626';
    return `
        <tr style="border-top:1px solid #e5e7eb">
            <td style="padding:8px 14px">${label}</td>
            <td style="padding:8px 14px;color:${color};font-weight:bold">${icon} ${ok ? '정상' : '실패'}</td>
            <td style="padding:8px 14px;color:#6b7280;font-size:13px">${detail}</td>
        </tr>
    `;
}
