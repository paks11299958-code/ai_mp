// Instagram 자동 좋아요 스크립트
// 사용법: node liker.js <키워드>
// 환경변수: INSTA_ID, INSTA_PW, INSTA_MAX_LIKES(기본 10)
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const INSTA_ID  = 'concealeunbi';
const INSTA_PW  = 'wlsgur0879@';
const MAX_LIKES = parseInt(process.env.INSTA_MAX_LIKES || '10', 10);

const LOG_FILE = path.join(__dirname, 'daily_log.json');

function todayKST() {
    return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul',
        year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
}

function loadLog() {
    try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
    catch { return { date: '', count: 0 }; }
}

function recordLike() {
    const log  = loadLog();
    const today = todayKST();
    fs.writeFileSync(LOG_FILE, JSON.stringify({
        date:  today,
        count: log.date === today ? log.count + 1 : 1,
    }));
}

function getRemainingLikes() {
    const log   = loadLog();
    const today = todayKST();
    if (log.date !== today) return MAX_LIKES;
    return Math.max(0, MAX_LIKES - log.count);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => Math.floor(Math.random() * (max - min) + min);
const delay = (min = 2000, max = 5000) => sleep(rand(min, max));

async function like(keyword) {
    const remaining = getRemainingLikes();
    console.log(`오늘 남은 좋아요: ${remaining}/${MAX_LIKES}`);
    if (remaining <= 0) {
        console.log('[한도 초과] 오늘 좋아요 한도에 도달했습니다.');
        return { ok: false, reason: 'daily_limit', remaining: 0 };
    }

    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
        ],
    });

    // iPhone 14 Pro 에뮬레이션 — 인스타 모바일 웹이 감지 확률 낮음
    const context = await browser.newContext({
        userAgent:       'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        viewport:        { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile:        true,
        hasTouch:        true,
        locale:          'ko-KR',
        timezoneId:      'Asia/Seoul',
        extraHTTPHeaders: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8' },
    });

    // webdriver 흔적 제거
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
    });

    const page = await context.newPage();

    try {
        // ── 로그인 ──────────────────────────────────────
        console.log('[1/4] 인스타그램 로그인 중...');
        await page.goto('https://www.instagram.com/accounts/login/', {
            waitUntil: 'domcontentloaded', timeout: 30000,
        });
        await delay(2000, 3500);

        // 쿠키 동의 버튼 처리
        for (const sel of [
            'button:has-text("모두 허용")', 'button:has-text("Allow all")',
            'button:has-text("Accept All")', 'button:has-text("수락")',
            '[data-cookiebanner="accept_button"]',
        ]) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.click(); await delay(1000, 2000);
                break;
            }
        }

        // username 입력창이 나타날 때까지 대기
        await page.waitForSelector('input[name="username"]', { timeout: 20000 });
        console.log('  → 로그인 폼 확인');

        await page.fill('input[name="username"]', INSTA_ID);
        await delay(600, 1400);
        await page.fill('input[name="password"]', INSTA_PW);
        await delay(800, 1800);
        await page.tap('button[type="submit"]');
        await delay(4000, 7000);

        // 로그인 저장/알림 팝업 닫기
        for (const sel of [
            'button:has-text("나중에")', 'button:has-text("Not Now")',
            'button:has-text("저장 안 함")', 'button:has-text("저장")',
        ]) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.tap(); await delay(800, 1500);
            }
        }

        // 로그인 성공 확인
        const isLoggedIn = await page.locator('svg[aria-label="홈"], svg[aria-label="Home"], a[href="/"]').count() > 0;
        if (!isLoggedIn) {
            const bodyText = await page.locator('body').textContent().catch(() => '');
            if (bodyText.includes('비밀번호') || bodyText.includes('incorrect') || bodyText.includes('password')) {
                throw new Error('로그인 실패: 아이디 또는 비밀번호를 확인해주세요.');
            }
        }
        console.log('[2/4] 로그인 완료');

        // ── 해시태그 페이지 이동 ────────────────────────
        const tag = keyword.replace(/^#/, '');
        console.log(`[3/4] #${tag} 해시태그 페이지 이동...`);
        await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await delay(3000, 5000);

        // ── 좋아요 실행 ─────────────────────────────────
        console.log('[4/4] 좋아요 시작...');
        let liked  = 0;
        const target = Math.min(remaining, MAX_LIKES);

        // 게시물 링크 수집
        const hrefs = await page.evaluate(() =>
            [...new Set(
                [...document.querySelectorAll('a[href*="/p/"]')]
                    .map(a => a.getAttribute('href'))
                    .filter(h => h && h.startsWith('/p/'))
            )].slice(0, 30)
        );

        console.log(`게시물 ${hrefs.length}개 발견`);

        for (const href of hrefs) {
            if (liked >= target) break;

            try {
                await page.goto(`https://www.instagram.com${href}`, {
                    waitUntil: 'domcontentloaded', timeout: 15000,
                });
                await delay(2000, 3500);

                // 이미 좋아요 눌렀는지 확인
                const alreadyLiked = await page.locator(
                    'svg[aria-label="좋아요 취소"], svg[aria-label="Unlike"]'
                ).count() > 0;

                if (!alreadyLiked) {
                    const likeBtn = page.locator(
                        'svg[aria-label="좋아요"], svg[aria-label="Like"]'
                    ).first();
                    if (await likeBtn.count() > 0) {
                        await likeBtn.tap();
                        liked++;
                        recordLike();
                        console.log(`✅ 좋아요 ${liked}/${target} — ${href}`);
                        // 좋아요 사이 딜레이 (4~9초, 자연스럽게)
                        await delay(4000, 9000);
                    }
                } else {
                    console.log(`⏭ 이미 좋아요 — ${href}`);
                    await delay(1000, 2000);
                }
            } catch (e) {
                console.warn(`⚠ 포스트 처리 실패 (${href}):`, e.message);
                await delay(2000, 3000);
            }
        }

        console.log(`완료: 총 ${liked}개 좋아요`);
        return { ok: true, liked, target, remaining: getRemainingLikes() };

    } catch (err) {
        console.error('오류:', err.message);
        return { ok: false, error: err.message };
    } finally {
        await browser.close();
    }
}

const [,, kwArg] = process.argv;
const keyword = kwArg || process.env.INSTA_KEYWORD || '';
if (!keyword || !INSTA_ID || !INSTA_PW) {
    console.error('INSTA_ID, INSTA_PW 환경변수와 키워드 인수가 필요합니다.');
    process.exit(1);
}

like(keyword).then(r => { console.log(JSON.stringify(r)); process.exit(r.ok ? 0 : 1); });
