/**
 * 제품추출 — 집 PC 실행용 (블루오션 전략)
 * 사용법: node extractor.js [카테고리코드]
 * 예시:   node extractor.js 50000007   (스포츠/레저)
 *         node extractor.js             (랜덤 카테고리)
 */

require('dotenv').config();

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const xlsx     = require('xlsx');
const path     = require('path');
const fs       = require('fs');

const BREVO_API_KEY  = process.env.BREVO_API_KEY;
const SENDER_EMAIL   = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
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

// ── Claude AI 제목 생성 ───────────────────────────────────

async function generateTitle(keyword, productName, price) {
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages: [{ role: 'user', content: `쿠팡에서 잘 팔리는 상품 제목을 만들어주세요.\n\n검색 키워드: ${keyword}\n도매꾹 상품명: ${productName}\n도매가: ${price}원\n\n규칙:\n- 소비자가 검색할 법한 자연스러운 한국어 제목\n- 키워드를 자연스럽게 포함\n- 40~60자 사이\n- 상품코드/모델번호 제거\n- 브랜드명 제거\n\n제목만 출력하세요.` }],
            }),
        });
        const data = await res.json();
        return data.content?.[0]?.text?.trim() || productName;
    } catch { return productName; }
}

// ── 쿠팡 경쟁도 분석 (집 IP라 실제로 작동!) ──────────────

async function checkCoupangCompetition(page, keyword) {
    try {
        await page.goto(`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await sleep(2500);

        const result = await page.evaluate(() => {
            const countEl = document.querySelector('.total-count strong, .js-search-count');
            const totalCount = parseInt(countEl?.textContent?.replace(/[^0-9]/g, '') || '0') || 0;
            const productCount = document.querySelectorAll('.search-product').length;
            const reviewEls = [...document.querySelectorAll('.rating-total-count')].slice(0, 5);
            const reviews = reviewEls.map(el => parseInt(el.textContent.replace(/[^0-9]/g, '') || '0'));
            const avgReviews = reviews.length > 0 ? Math.round(reviews.reduce((a,b) => a+b,0) / reviews.length) : 0;
            return { totalCount: totalCount || productCount * 10, productCount, avgReviews };
        });

        const isBlueOcean = result.totalCount < BLUE_OCEAN_COUNT && result.avgReviews < BLUE_OCEAN_REVIEWS;
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
    if (!fs.existsSync(TEMPLATE_PATH)) throw new Error('template.xlsm 파일이 없습니다. README를 확인하세요.');
    const wb = xlsx.readFile(TEMPLATE_PATH);
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
    try {
        browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
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

        const top = products[0];
        log(`상품: "${top.name}" (번호: ${top.itemNo})`);
        const { price: wholesalePrice, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
        if (!wholesalePrice) throw new Error('도매가 조회 실패');
        log(`도매가: ${wholesalePrice.toLocaleString()}원`);

        // 3. AI 제목
        log('\nAI 제목 생성 중...');
        const title = await generateTitle(selected.keyword, top.name, wholesalePrice);
        log(`제목: "${title}"`);

        await browser.close(); browser = null;

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
        if (browser) await browser.close().catch(() => {});
    }
})();
