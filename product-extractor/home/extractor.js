/**
 * 제품추출 — 집 PC 실행용 (블루오션 전략)
 * 사용법: node extractor.js [카테고리코드]
 * 예시:   node extractor.js 50000007   (스포츠/레저)
 *         node extractor.js             (랜덤 카테고리)
 */

require('dotenv').config();

const { chromium } = require('playwright');

const xlsx     = require('xlsx');
const path     = require('path');
const fs       = require('fs');

const BREVO_API_KEY  = process.env.BREVO_API_KEY;
const SENDER_EMAIL   = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DOMEGGOOK_ID   = process.env.DOMEGGOOK_ID  || 'c2clo';
const DOMEGGOOK_PW   = process.env.DOMEGGOOK_PASSWORD;
const NOTIFY_EMAIL   = process.env.NOTIFY_EMAIL;
const TEMPLATE_PATH  = path.join(__dirname, 'template.xlsm');
const OUTPUT_DIR     = path.join(__dirname, 'output');
const CATEGORIES     = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories.json'), 'utf8'));
const MARKUP         = 2.5;

// 블루오션 기준
const BLUE_OCEAN_COUNT   = 500;   // 쿠팡 상품 수
const BLUE_OCEAN_REVIEWS = 300;   // 평균 리뷰수

function log(msg) { console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 카테고리 선택 ─────────────────────────────────────────

function getCategory() {
    const code = process.argv[2];
    if (code) {
        const cat = CATEGORIES.find(c => c.code === code);
        if (!cat) { console.log(`카테고리 ${code} 없음. 사용 가능:`); CATEGORIES.forEach(c => console.log(`  ${c.code} - ${c.emoji}${c.name}`)); process.exit(1); }
        return cat;
    }
    // 랜덤 선택
    return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

// ── Gemini AI 제목 생성 ───────────────────────────────────

async function generateTitle(keyword, productName, price) {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `쿠팡에서 잘 팔리는 상품 제목을 만들어주세요.\n\n검색 키워드: ${keyword}\n도매꾹 상품명: ${productName}\n도매가: ${price}원\n\n규칙:\n- 소비자가 검색할 법한 자연스러운 한국어 제목\n- 키워드를 자연스럽게 포함\n- 40~60자 사이\n- 상품코드/모델번호 제거\n- 브랜드명 제거\n\n제목만 출력하세요.` }] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 200 },
            }),
        });
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || productName;
    } catch { return productName; }
}

// ── 쿠팡 경쟁도 분석 (집 IP라 실제로 작동!) ──────────────

let coupangReady = false;

async function checkCoupangCompetition(page, keyword) {
    try {
        if (!coupangReady) {
            coupangReady = true;
            log('  [쿠팡] 홈페이지 진입...');
            await page.goto('https://www.coupang.com', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(3000);
            // 사람처럼 마우스 이동
            await page.mouse.move(300 + Math.random() * 400, 200 + Math.random() * 200);
            await sleep(500 + Math.random() * 500);
        }

        // URL 직접 이동 대신 검색창 타이핑
        const searchBox = await page.$('#headerSearchKeyword, input[name="q"], .search-input input, input[type="search"]');
        if (searchBox) {
            await searchBox.click();
            await sleep(300);
            await searchBox.fill('');
            await page.keyboard.type(keyword, { delay: 80 });
            await sleep(400);
            await page.keyboard.press('Enter');
            await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
        } else {
            await page.goto(`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user`, {
                waitUntil: 'domcontentloaded', timeout: 20000,
            });
        }
        await sleep(2000);
        // Access Denied 체크
        const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 200) || '');
        if (bodyText.includes('Access Denied') || bodyText.includes('Forbidden')) {
            log(`  [쿠팡] 접근 차단 — 건너뜀`);
            return { totalCount: 9999, productCount: 0, avgReviews: 9999, score: 9999, isBlueOcean: false };
        }

        await sleep(3000); // 검색 결과 렌더링 대기

        const result = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            // 총 상품 수: "총 N,NNN개" 텍스트 파싱 (클래스명 무관)
            const countMatch = bodyText.match(/총\s*([\d,]+)\s*개/) ||
                               bodyText.match(/([\d,]+)\s*개의?\s*상품/) ||
                               bodyText.match(/([\d,]+)\s*개의?\s*검색/);
            const totalCount = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : 0;

            // 상품 아이템 수 (백업)
            const productCount = Math.max(
                document.querySelectorAll('li[class*="search-product"]').length,
                document.querySelectorAll('li[class*="Product"]').length,
                document.querySelectorAll('[data-item-id]').length
            );

            // 리뷰 수: (숫자) 패턴 — 클래스명 불필요
            const reviewNums = [...bodyText.matchAll(/\(([\d,]+)\)/g)]
                .map(m => parseInt(m[1].replace(/,/g, '')))
                .filter(n => n > 0 && n < 500000)
                .slice(0, 10);
            const avgReviews = reviewNums.length > 0
                ? Math.round(reviewNums.reduce((a,b) => a+b,0) / reviewNums.length)
                : 0;

            return { totalCount: totalCount || productCount * 20, productCount, avgReviews };
        });

        // 상품수는 1200으로 고정(쿠팡 캡)이라 신뢰 불가 → 리뷰 평균만으로 판단
        const isBlueOcean = result.avgReviews < BLUE_OCEAN_REVIEWS;
        const score = (result.totalCount / 100) + (result.avgReviews / 10);
        log(`  [쿠팡] "${keyword}" → 상품수:${result.totalCount} 평균리뷰:${result.avgReviews} ${isBlueOcean ? '🟢블루오션' : '🔴경쟁많음'}`);
        return { ...result, score, isBlueOcean };
    } catch (e) {
        log(`  [쿠팡] "${keyword}" 오류: ${e.message.slice(0,50)}`);
        return { totalCount: 9999, productCount: 0, avgReviews: 9999, score: 9999, isBlueOcean: false };
    }
}

// ── 도매매 스크래퍼 ───────────────────────────────────────

async function loginDomeggook(page) {
    await page.goto('https://domeggook.com/main/member/mem_formLogin.php', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.fill('#idInput', DOMEGGOOK_ID);
    await page.fill('#pwInput', DOMEGGOOK_PW);
    await page.click('input[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    log('도매꾹 로그인 완료');
}

async function searchDomemedbWithFallback(page, keyword) {
    // 전체 키워드 → 앞 두 단어 → 첫 단어 순서로 시도
    const attempts = [keyword];
    const words = keyword.split(' ');
    if (words.length > 2) attempts.push(words.slice(0, 2).join(' '));
    if (words.length > 1) attempts.push(words[0]);

    for (const q of attempts) {
        const results = await searchDomemedb(page, q);
        if (results.length > 0) {
            if (q !== keyword) log(`  도매꾹 "${q}"로 재검색 → ${results.length}개`);
            return results;
        }
    }
    return [];
}

async function searchDomemedb(page, keyword) {
    await page.goto('https://domemedb.domeggook.com/index/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    await page.fill('input[name="sw"]', keyword);
    await page.evaluate(() => document.getElementById('search_list')?.submit());
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await sleep(5000);
    return await page.evaluate(() => {
        const seen = new Set();
        return Array.from(document.querySelectorAll('.sub_cont_bane1')).map(c => {
            const text = c.innerText || '';
            const m = text.match(/상품번호\s+(\d+)/);
            const itemNo = m ? m[1] : '';
            if (!itemNo || seen.has(itemNo)) return null;
            seen.add(itemNo);
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const idx = lines.findIndex(l => l.startsWith('상품번호'));
            const name = idx >= 0 ? lines[idx + 1] || '' : '';
            const img = c.querySelector('img[src*="_img_330"], img[src*="_stt_330"]');
            return { itemNo, name, imgSrc: img?.src || '' };
        }).filter(p => p && p.name && p.itemNo);
    });
}

async function getPriceAndImages(page, itemNo) {
    await page.goto(`https://domeggook.com/${itemNo}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    return await page.evaluate(() => {
        const priceEl = document.querySelector('.lItemPrice') || document.getElementById('lBaseAmtVal');
        const price = parseInt((priceEl?.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
        const mainImg = document.querySelector('#divMainImage img, .goods_img img, .mainImg img');
        const detailImgs = Array.from(document.querySelectorAll('#divDetailImage img, .detail_img img')).map(i => i.src).filter(s => s?.startsWith('http')).slice(0, 9);
        return { price, mainImgSrc: mainImg?.src || '', detailImgSrcs: detailImgs };
    });
}

// ── 엑셀 생성 ────────────────────────────────────────────

function buildExcel(row, categoryName) {
    // 폴더에서 template 파일 자동 탐색 (Windows 확장자 숨김 대응)
    const searchDirs = [__dirname, process.cwd()];
    let usePath = null;
    for (const dir of searchDirs) {
        const files = fs.readdirSync(dir).filter(f => f.toLowerCase().startsWith('template') && /\.(xlsm|xlsx)$/i.test(f));
        if (files.length > 0) { usePath = path.join(dir, files[0]); break; }
    }
    log(`템플릿 파일: ${usePath || '없음'}`);
    if (!usePath) throw new Error(`template.xlsm 없음 (폴더: ${__dirname})`);
    const wb = xlsx.readFile(usePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const r  = 5;
    const sellPrice    = Math.ceil(row.wholesalePrice * MARKUP / 10) * 10;
    const discountBase = Math.ceil(sellPrice * 1.2 / 10) * 10;
    const set = (col, val) => { ws[col + r] = { v: val, t: typeof val === 'number' ? 'n' : 's' }; };
    set('A', categoryName); set('B', row.title); set('E', '새 상품'); set('I', row.keyword);
    set('BJ', sellPrice); set('BL', discountBase); set('BM', 99999); set('BN', 2); set('BO', 0); set('BR', 'N'); set('BS', 'Y');
    set('CZ', row.imageUrl); set('DA', row.imageUrl);
    if (row.detailImgSrcs?.[0]) set('DB', row.detailImgSrcs[0]);
    ws['!ref'] = 'A1:DB5';
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const safeName = categoryName.replace(/[/\\?%*:|"<>]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const filename  = `coupang_${safeName}_${timestamp}.xlsx`;
    const filepath  = path.join(OUTPUT_DIR, filename);
    xlsx.writeFile(wb, filepath);
    return { filepath, filename };
}

// ── 이메일 발송 ───────────────────────────────────────────

async function sendEmail(to, subject, html, attachmentPath) {
    if (!BREVO_API_KEY || !to) { log('이메일 설정 없음 — 로컬 저장만 완료'); return; }
    const content  = fs.readFileSync(attachmentPath).toString('base64');
    const filename = path.basename(attachmentPath);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: { name: '제품추출', email: SENDER_EMAIL }, to: [{ email: to }], subject, htmlContent: html, attachment: [{ name: filename, content }] }),
    });
    if (!res.ok) log(`이메일 발송 실패: ${await res.text()}`);
    else log(`이메일 발송 완료 → ${to}`);
}

// ── 메인 ─────────────────────────────────────────────────

(async () => {
    const cat      = getCategory();
    const keywords = cat.keywords.slice(0, 5);
    log(`카테고리: ${cat.emoji}${cat.name}`);
    log(`키워드: ${keywords.join(', ')}`);

    let browser;
    let ownBrowser = false;
    try {
        // 자동실행.bat이 켠 Chrome에 CDP로 연결 (봇 탐지 없음)
        try {
            browser = await chromium.connectOverCDP('http://localhost:9222');
            log('기존 Chrome에 연결 완료 (CDP)');
        } catch {
            log('CDP 연결 실패 — Chrome 직접 실행');
            browser = await chromium.launch({ headless: false, channel: 'chrome', args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'] });
            ownBrowser = true;
        }
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            locale: 'ko-KR',
            timezoneId: 'Asia/Seoul',
        });
        const page = await context.newPage();

        // 1. 쿠팡 경쟁도 분석
        log('\n── 쿠팡 경쟁도 분석 ──');
        const competition = [];
        for (const kw of keywords) {
            const r = await checkCoupangCompetition(page, kw);
            competition.push({ keyword: kw, ...r });
            await sleep(1000);
        }

        const blueOceans = competition.filter(c => c.isBlueOcean);
        const selected   = blueOceans.length > 0
            ? blueOceans[0]
            : competition.sort((a, b) => a.score - b.score)[0];
        log(`\n✅ 선택 키워드: "${selected.keyword}" (상품수:${selected.totalCount}, 평균리뷰:${selected.avgReviews})`);

        // 2. 도매매 검색
        log('\n── 도매매 검색 ──');
        await loginDomeggook(page);
        const products = await searchDomemedb(page, selected.keyword);
        if (!products.length) throw new Error(`"${selected.keyword}" 도매매 상품 없음`);

        // 키워드 단어 중 하나라도 포함된 상품 우선 선택
        const kwWords = selected.keyword.split(' ').filter(w => w.length >= 2);
        const matched = products.filter(p => kwWords.some(w => p.name.includes(w)));
        const top = matched.length > 0 ? matched[0] : products[0];
        log(`상품: "${top.name}" (번호: ${top.itemNo})${matched.length === 0 ? ' ⚠️키워드 불일치' : ''}`);
        const { price: wholesalePrice, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
        if (!wholesalePrice) throw new Error('도매가 조회 실패');
        log(`도매가: ${wholesalePrice.toLocaleString()}원`);

        // 3. AI 제목
        log('\nAI 제목 생성 중...');
        const title = await generateTitle(selected.keyword, top.name, wholesalePrice);
        log(`제목: "${title}"`);

        if (ownBrowser) { await browser.close(); browser = null; }

        // 4. 엑셀 생성
        const productData = { keyword: selected.keyword, title, wholesalePrice, sellPrice: Math.ceil(wholesalePrice * MARKUP / 10) * 10, imageUrl: mainImgSrc || top.imgSrc, detailImgSrcs };
        const { filepath, filename } = buildExcel(productData, cat.name);
        log(`\n엑셀 저장: ${filepath}`);

        // 5. 이메일 발송
        await sendEmail(NOTIFY_EMAIL, `[제품추출] ${cat.emoji}${cat.name} — ${title.slice(0,25)}...`, `
            <div style="font-family:sans-serif;max-width:500px">
                <h2 style="color:#1e3a5f">📦 ${cat.emoji}${cat.name} 제품추출 완료</h2>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
                    <tr><td><b>키워드</b></td><td>${selected.keyword}</td></tr>
                    <tr><td><b>AI 제목</b></td><td>${title}</td></tr>
                    <tr><td><b>원상품명</b></td><td>${top.name}</td></tr>
                    <tr><td><b>도매가</b></td><td>${wholesalePrice.toLocaleString()}원</td></tr>
                    <tr><td><b>판매가(×2.5)</b></td><td style="color:#16a34a;font-weight:bold">${productData.sellPrice.toLocaleString()}원</td></tr>
                    <tr><td><b>쿠팡 경쟁</b></td><td>${selected.isBlueOcean ? '🟢 블루오션' : '🔴 경쟁있음'} (상품수: ${selected.totalCount}, 리뷰: ${selected.avgReviews})</td></tr>
                </table>
                <p style="color:#6b7280;font-size:12px">첨부 엑셀을 쿠팡윙 → 상품일괄등록에서 업로드하세요.</p>
            </div>`, filepath);

        console.log('\n🎉 완료!');
        console.log(`   엑셀 위치: ${filepath}`);
    } catch (e) {
        log(`❌ 오류: ${e.message}`);
    } finally {
        if (browser && ownBrowser) await browser.close().catch(() => {});
    }
})();
