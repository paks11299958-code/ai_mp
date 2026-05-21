// 인스타그램 자동 좋아요 — 집 PC 실행용

// Task Scheduler 환경에서 한글 깨짐 방지: Node.js 내부에서 직접 UTF-8 강제 설정
if (process.platform === 'win32') {
    try { require('child_process').execSync('chcp 65001', { stdio: 'ignore' }); } catch {}
}

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const fs   = require('fs');
const path = require('path');

const INSTA_ID  = 'concealeunbi';
const INSTA_PW  = 'wlsgur0879@';
const MAX_LIKES = 10;
const KEYWORD   = 'AI채팅';
const LOG_FILE  = path.join(__dirname, 'daily_log.json');

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
    const log = loadLog(), today = todayKST();
    fs.writeFileSync(LOG_FILE, JSON.stringify({ date: today, count: log.date === today ? log.count + 1 : 1 }));
}
function recordResult(keyword, liked, status) {
    const log = loadLog(), today = todayKST();
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    fs.writeFileSync(LOG_FILE, JSON.stringify({
        date: today,
        count: log.count || 0,
        keyword,
        liked,
        status,
        lastRun: now,
    }, null, 2));
}
function getRemainingLikes() {
    const log = loadLog(), today = todayKST();
    return log.date !== today ? MAX_LIKES : Math.max(0, MAX_LIKES - log.count);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand  = (a, b) => Math.floor(Math.random() * (b - a) + a);
const delay = (a = 2000, b = 5000) => sleep(rand(a, b));

async function run() {
    const keyword   = process.argv[2] || KEYWORD;
    const remaining = getRemainingLikes();
    console.log(`\n오늘 남은 좋아요: ${remaining}/${MAX_LIKES}회`);
    if (remaining <= 0) { console.log('⛔ 오늘 한도 초과. 내일 다시 시도하세요.'); return; }

    console.log(`\n#${keyword} 좋아요 시작합니다...\n`);

    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
        userAgent:  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport:   { width: 1280, height: 800 },
        locale:     'ko-KR',
        timezoneId: 'Asia/Seoul',
    });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await context.newPage();

    try {
        // ── 로그인 ───────────────────────────────────────
        console.log('[1/4] 인스타그램 로그인 중...');
        await page.goto('https://www.instagram.com/accounts/login/', {
            waitUntil: 'load', timeout: 40000,
        });
        await delay(3000, 5000);

        // 쿠키 동의 버튼
        for (const sel of ['button:has-text("모두 허용")', 'button:has-text("Allow all")', 'button:has-text("수락")']) {
            if (await page.locator(sel).isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.locator(sel).click(); await delay(1000, 2000); break;
            }
        }

        // 페이지에 input이 몇 개인지 확인
        const inputCount = await page.evaluate(() => document.querySelectorAll('input').length);
        console.log(`  → 입력창 감지: ${inputCount}개`);

        if (inputCount === 0) throw new Error('로그인 폼이 로드되지 않았습니다. 브라우저 창을 확인하세요.');

        // JS로 직접 값 주입
        await page.evaluate(([id, pw]) => {
            const inputs = document.querySelectorAll('input');
            const setVal = (el, val) => {
                el.focus();
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(el, val);
                el.dispatchEvent(new Event('input',  { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            };
            if (inputs[0]) setVal(inputs[0], id);
            if (inputs[1]) setVal(inputs[1], pw);
        }, [INSTA_ID, INSTA_PW]);

        await delay(800, 1500);
        console.log('  → 아이디/비밀번호 입력 완료');

        // Enter 키로 로그인
        await page.keyboard.press('Enter');
        await delay(5000, 8000);

        // 팝업 닫기
        for (const sel of ['button:has-text("나중에")', 'button:has-text("Not Now")', 'button:has-text("저장 안 함")']) {
            if (await page.locator(sel).isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.locator(sel).click(); await delay(800, 1500);
            }
        }
        console.log('[2/4] 로그인 완료');

        // ── 해시태그 페이지 ──────────────────────────────
        const tag = keyword.replace(/^#/, '');
        console.log(`[3/4] #${tag} 해시태그 검색 중...`);
        await page.goto(`https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/`, {
            waitUntil: 'load', timeout: 30000,
        });
        await delay(4000, 6000);

        // 스크롤로 게시물 로딩 유도
        await page.evaluate(() => window.scrollBy(0, 600));
        await delay(2000, 3000);
        await page.evaluate(() => window.scrollBy(0, 600));
        await delay(2000, 3000);

        // ── 좋아요 실행 ──────────────────────────────────
        console.log('[4/4] 좋아요 시작...');
        let liked  = 0;
        const target = Math.min(remaining, MAX_LIKES);

        const hrefs = await page.evaluate(() => {
            const links = [...document.querySelectorAll('a')];
            const postLinks = links
                .map(a => a.getAttribute('href'))
                .filter(h => h && (h.startsWith('/p/') || h.includes('/p/')));
            return [...new Set(postLinks)].slice(0, 30);
        });
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
                await likeBtn.click();
                await delay(4000, 9000);
                recordLike();
                liked++;
                console.log(`  ✅ 좋아요 ${liked}/${target} — ${href}`);
            } catch (e) {
                console.log(`  ⚠️ 건너뜀: ${e.message.split('\n')[0]}`);
            }
        }

        console.log(`\n🎉 완료! 총 ${liked}개 좋아요 (오늘 남은 횟수: ${getRemainingLikes()}회)`);
        recordResult(keyword, liked, 'success');

    } catch (e) {
        console.log(`\n❌ 오류: ${e.message.split('\n')[0]}`);
        recordResult(keyword, liked, `error: ${e.message.split('\n')[0]}`);
        console.log('브라우저 창을 확인하세요. 30초 후 닫힙니다...');
        await sleep(30000);
    } finally {
        await browser.close();
    }
}

run();
