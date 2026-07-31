/**
 * Site Monitor — 3시간마다 crontab으로 실행
 * 1. 사이트 열림 확인 (HTTP 상태)
 * 2. 로그인 + 페르소나 목록 확인
 * 결과를 **텔레그램**으로 발송 + 스크린샷 첨부
 *
 * ★알림 경로를 Brevo 이메일 → 텔레그램으로 교체(2026-07-31 사장 결정).
 *   Brevo가 서버 IP를 인식 못 해 401로 계속 실패하고 있었다:
 *     "unrecognised IP address 34.50.63.45"
 *   점검 자체는 정상 동작했지만 **결과가 전달되지 않아** "알림이 없다"가
 *   "정상이다"를 뜻하지 못하는 상태였다 — 감시의 존재 이유가 무너진다.
 *   텔레그램은 IP 화이트리스트가 없어 서버 IP가 바뀌어도 계속 동작한다.
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
const MONITOR_EMAIL    = process.env.MONITOR_EMAIL;
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD;
const TG_TOKEN         = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT          = process.env.TELEGRAM_CHAT_ID;

// ★IPv4 강제(2026-07-31 실측). 이 서버는 IPv6 경로가 막혀 있는데(curl -6 = 실패)
//   api.telegram.org는 AAAA 레코드를 준다. curl은 IPv4로 폴백해 성공하지만 node의
//   fetch는 폴백하지 못하고 ETIMEDOUT으로 죽는다 — "fetch failed"의 정체가 이것이다.
//   dns.setDefaultResultOrder('ipv4first')로는 안 잡히고, undici 커넥트 옵션이어야 한다.
const { Agent } = require('undici');
const ipv4Agent = new Agent({ connect: { family: 4 } });
// ──────────────────────────────────────────────────────

/**
 * 텔레그램 알림. 장애일 때만 스크린샷을 붙인다(정상 보고까지 이미지를 보내면
 * 알림이 무거워져 정작 장애 알림을 흘려보게 된다).
 * ★던지지 않고 false를 반환한다 — 발송 실패가 점검 결과 기록(monitor-status.json)까지
 *   막으면 안 된다. 예전 Brevo판은 여기서 throw해 크론이 통째로 죽었다.
 */
async function sendTelegram({ text, screenshotPath }) {
    if (!TG_TOKEN || !TG_CHAT) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN/CHAT_ID 없음 — 알림 건너뜀');
        return false;
    }

    const api = (m) => `https://api.telegram.org/bot${TG_TOKEN}/${m}`;
    try {
        if (screenshotPath && fs.existsSync(screenshotPath)) {
            // 사진 + 캡션을 한 번에 보낸다(캡션 상한 1024자).
            const form = new FormData();
            form.append('chat_id', TG_CHAT);
            form.append('parse_mode', 'HTML');
            form.append('caption', text.slice(0, 1024));
            form.append('photo', new Blob([fs.readFileSync(screenshotPath)]), 'site_status.png');
            const res = await fetch(api('sendPhoto'), { method: 'POST', body: form, dispatcher: ipv4Agent });
            if (res.ok) return true;
            console.error(`⚠️ 사진 발송 실패(${res.status}) — 텍스트로 폴백`);
        }
        const res = await fetch(api('sendMessage'), {
            method:     'POST',
            headers:    { 'Content-Type': 'application/json' },
            body:       JSON.stringify({ chat_id: TG_CHAT, text, parse_mode: 'HTML' }),
            dispatcher: ipv4Agent,
        });
        if (!res.ok) {
            console.error(`⚠️ 텔레그램 발송 실패 (${res.status}): ${await res.text().catch(() => '')}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`⚠️ 텔레그램 발송 예외: ${e.message}`);
        return false;
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

                // 햄버거 메뉴 먼저 열기 (2026-06-24 첫화면 개편: 로그인/로그아웃이 햄버거 안으로 이동).
                // 로고 바 우측 햄버거(aria-label="메뉴 열기")를 눌러야 '로그인' 항목이 드로어에 나타남.
                await page.getByRole('button', { name: '메뉴 열기' }).first().click({ force: true, timeout: TIMEOUT_MS });
                await page.waitForTimeout(500);

                // 로그인 버튼(드로어 안) 클릭 → 로그인 화면(authPage) 진입
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

                // 로그인 후 첫화면(MainPageNew) 노출 확인.
                // 로그인 시 헤더 개인화 인사 "{username}님, 다시 만나 반가워요 ✦"가 뜨므로 이를 성공 지표로 사용.
                // (2026-06-24: 옛 지표 'text=님 ✦'는 "님"과 "✦" 사이에 ", 다시 만나 반가워요"가 끼어 매칭 실패 → 문구로 변경)
                await page.waitForSelector('text=다시 만나 반가워요', { timeout: 10_000 });

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

        // ── 텔레그램 발송 ─────────────────────────────────────
        const allOk = results.site.ok && results.login.ok;
        const line  = (label, { ok, detail }) =>
            `${ok ? '✅' : '❌'} <b>${label}</b> — ${ok ? '정상' : '실패'}${ok ? '' : `\n     ${esc(detail)}`}`;

        const text = [
            allOk ? '✅ <b>사이트 정상</b>' : '🚨 <b>장애 감지</b>',
            'aichat.dbzone.kr',
            '',
            line('사이트 열림', results.site),
            line('로그인', results.login),
            '',
            `🕘 ${now}`,
            ...(allOk ? [] : ['', '<b>즉시 서버 상태를 확인해주세요.</b>']),
        ].join('\n');

        // 장애일 때만 스크린샷을 붙인다 — 정상 보고까지 이미지면 알림이 무거워져
        // 정작 장애 알림을 흘려보게 된다.
        const sent = await sendTelegram({
            text,
            screenshotPath: allOk ? null : SCREENSHOT_PATH,
        });
        console.log(sent ? '📨 텔레그램 발송 완료' : '⚠️ 텔레그램 발송 실패(점검 결과는 기록됨)');
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

/** 텔레그램 parse_mode=HTML용 이스케이프. 에러 메시지에 <, > 가 섞이면
 *  (Playwright 셀렉터 등) 태그로 해석돼 발송이 400으로 실패한다. */
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
