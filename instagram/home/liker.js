// 인스타그램 자동 좋아요 — 집 PC 실행용
// 사용법: node liker.js 골프  (또는 실행하기.bat 더블클릭)

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');
const readline = require('readline');

// ── 계정 정보 ─────────────────────────────────────────────
const INSTA_ID  = 'concealeunbi';
const INSTA_PW  = 'wlsgur0879@';
const MAX_LIKES = 10; // 하루 최대 좋아요 수
// ────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'daily_log.json');

function todayKST() {
    return new Date().toLocaleDateString('ko-KR', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).replace(/\. /g, '-').replace('.', '');
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

async function getKeyword() {
    const arg = process.argv[2];
    if (arg) return arg;
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question('해시태그 키워드 입력 (# 없이, 예: 골프): ', ans => {
            rl.close();
            resolve(ans.trim());
        });
    });
}

async function run() {
    const keyword = await getKeyword();
    if (!keyword) { console.log('❌ 키워드를 입력해주세요.'); return; }

    const remaining = getRemainingLikes();
    console.log(`\n오늘 남은 좋아요: ${remaining}/${MAX_LIKES}회`);
    if (remaining <= 0) {
        console.log('⛔ 오늘 좋아요 한도(10회)에 도달했습니다. 내일 다시 시도하세요.');
        return;
    }

    console.log(`\n#${keyword} 좋아요 시작합니다...`);

    const browser = await chromium.launch({
        headless: false, // 집에서는 화면 보이게
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
        userAgent:   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        viewport:    { width: 393, height: 852 },
        isMobile:    true,
        hasTouch:    true,
        locale:      'ko-KR',
        timezoneId:  'Asia/Seoul',
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    try {
        // ── 로그인 ────────────────────────────────────────
        console.log('\n[1/4] 인스타그램 로그인 중...');
        await page.goto('https://www.instagram.com/accounts/login/', {
            waitUntil: 'load', timeout: 40000,
        });
        await delay(4000, 6000); // React 렌더링 대기

        // 쿠키 동의 버튼 처리
        for (const sel of ['button:has-text("모두 허용")', 'button:has-text("Allow all")', 'button:has-text("수락")']) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await btn.click(); await delay(1500, 2500); break;
            }
        }

        console.log('  → 로그인 폼 대기 중...');
        await page.waitForSelector('input[name="username"]', { timeout: 30000 });
        await page.fill('input[name="username"]', INSTA_ID);
        await delay(600, 1200);
        await page.fill('input[name="password"]', INSTA_PW);
        await delay(800, 1500);
        await page.tap('button[type="submit"]');
        await delay(4000, 7000);

        // 로그인 팝업 닫기
        for (const sel of ['button:has-text("나중에")', 'button:has-text("Not Now")', 'button:has-text("저장 안 함")']) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await btn.tap(); await delay(800, 1500);
            }
        }
        console.log('[2/4] 로그인 완료');

        // ── 해시태그 페이지 ─────────────────────────────
        const tag = keyword.replace(/^#/, '');
        console.log(`[3/4] #${tag} 해시태그 검색 중...`);
        await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await delay(3000, 5000);

        // ── 좋아요 실행 ─────────────────────────────────
        console.log('[4/4] 좋아요 시작...');
        let liked = 0;
        const target = Math.min(remaining, MAX_LIKES);

        const hrefs = await page.evaluate(() =>
            [...new Set(
                [...document.querySelectorAll('a[href*="/p/"]')]
                    .map(a => a.getAttribute('href'))
                    .filter(h => h && h.startsWith('/p/'))
            )].slice(0, 30)
        );
        console.log(`  게시물 ${hrefs.length}개 발견`);

        for (const href of hrefs) {
            if (liked >= target) break;
            try {
                await page.goto(`https://www.instagram.com${href}`, {
                    waitUntil: 'domcontentloaded', timeout: 15000,
                });
                await delay(1500, 3000);

                const likeBtn = page.locator('svg[aria-label="좋아요"], svg[aria-label="Like"]').first();
                if (!await likeBtn.isVisible({ timeout: 3000 }).catch(() => false)) continue;

                await likeBtn.tap();
                await delay(4000, 9000); // 랜덤 딜레이
                recordLike();
                liked++;
                console.log(`  ✅ 좋아요 ${liked}/${target} — ${href}`);
            } catch (e) {
                console.log(`  ⚠️ 건너뜀: ${e.message.split('\n')[0]}`);
            }
        }

        console.log(`\n🎉 완료! 총 ${liked}개 좋아요 완료 (오늘 남은 횟수: ${getRemainingLikes()}회)`);

    } catch (e) {
        console.log(`\n❌ 오류: ${e.message.split('\n')[0]}`);
        console.log('\n브라우저 창을 확인하세요. 30초 후 닫힙니다...');
        await sleep(30000);
    } finally {
        await browser.close();
    }
}

run();
