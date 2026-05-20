/**
 * 제품추출 스크립트 (블루오션 전략)
 * 1. 카테고리 핫키워드 조회 (DB)
 * 2. 키워드별 쿠팡 검색 → 경쟁도 측정 (상품 수 + 리뷰수)
 * 3. 경쟁 가장 낮은 키워드 선택
 * 4. 도매매에서 해당 키워드 검색 → 상품 1개 수집
 * 5. Claude AI로 쿠팡 최적화 제목 생성
 * 6. 쿠팡윙 업로드용 엑셀 생성 → 이메일 발송
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const xlsx  = require('xlsx');
const path  = require('path');
const fs    = require('fs');
const { Pool } = require('pg');

const BREVO_API_KEY  = process.env.BREVO_API_KEY;
const SENDER_EMAIL   = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;
const DOMEGGOOK_ID   = process.env.DOMEGGOOK_ID;
const DOMEGGOOK_PW   = process.env.DOMEGGOOK_PASSWORD;
const OUTPUT_DIR     = path.join(__dirname, 'output');
const TEMPLATE_PATH  = path.join(__dirname, '..', 'doc', 'coupang_sellertool_upload_example_V4.6.xlsm');
const MARKUP         = 2.5;

// 블루오션 기준: 상품수 < 이 값이면 경쟁 낮음
const BLUE_OCEAN_PRODUCT_COUNT = 500;
// 블루오션 기준: 상위 상품 평균 리뷰 < 이 값이면 경쟁 낮음
const BLUE_OCEAN_AVG_REVIEWS   = 300;

function log(msg) { console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Claude AI 제목 생성 ───────────────────────────────────────────────────

async function generateTitle(keyword, productName, price) {
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 200,
                messages: [{
                    role: 'user',
                    content: `쿠팡에서 잘 팔리는 상품 제목을 만들어주세요.

검색 키워드: ${keyword}
도매꾹 상품명: ${productName}
도매가: ${price}원

규칙:
- 소비자가 검색할 법한 자연스러운 한국어 제목
- 키워드를 자연스럽게 포함
- 40~60자 사이
- 상품코드/모델번호 제거
- 브랜드명 제거 (있으면)
- 생활에서 쓰는 표현 사용

제목만 출력하세요. 설명 없이.`,
                }],
            }),
        });
        if (!res.ok) throw new Error(`Claude API ${res.status}`);
        const data = await res.json();
        return data.content?.[0]?.text?.trim() || productName;
    } catch (e) {
        log(`AI 제목 생성 실패: ${e.message} → 원본 사용`);
        return productName;
    }
}

// ── 쿠팡 경쟁도 분석 ─────────────────────────────────────────────────────

async function checkCoupangCompetition(page, keyword) {
    try {
        await page.goto(`https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}&channel=user`, {
            waitUntil: 'domcontentloaded', timeout: 20000,
        });
        await sleep(2500);

        const result = await page.evaluate(() => {
            // 전체 결과 수
            const countEl = document.querySelector('.total-count strong, .js-search-count, [class*="total-count"]');
            const totalText = countEl?.textContent?.replace(/[^0-9]/g, '') || '0';
            const totalCount = parseInt(totalText) || 0;

            // 상위 상품 리뷰수 (최대 5개)
            const reviewEls = [...document.querySelectorAll('.rating-total-count, [class*="rating-total"], [class*="count-review"]')].slice(0, 5);
            const reviews = reviewEls.map(el => parseInt(el.textContent.replace(/[^0-9]/g, '') || '0'));

            // 상품 카드 수 (결과수 대안)
            const productCount = document.querySelectorAll('.search-product, [class*="search-product"]').length;

            const avgReviews = reviews.length > 0
                ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length)
                : 0;
            const maxReviews = reviews.length > 0 ? Math.max(...reviews) : 0;

            return { totalCount: totalCount || productCount * 10, productCount, avgReviews, maxReviews, reviews };
        });

        // 경쟁도 점수 (낮을수록 블루오션)
        const score = (result.totalCount / 100) + (result.avgReviews / 10);
        const isBlueOcean = result.totalCount < BLUE_OCEAN_PRODUCT_COUNT && result.avgReviews < BLUE_OCEAN_AVG_REVIEWS;

        log(`  [쿠팡] "${keyword}" → 상품수:${result.totalCount} 평균리뷰:${result.avgReviews} ${isBlueOcean ? '🟢블루오션' : '🔴경쟁많음'}`);
        return { ...result, score, isBlueOcean };
    } catch (e) {
        log(`  [쿠팡] "${keyword}" 조회 실패: ${e.message}`);
        return { totalCount: 9999, productCount: 0, avgReviews: 9999, maxReviews: 9999, score: 9999, isBlueOcean: false };
    }
}

// ── 도매꾹/도매매 스크래퍼 ────────────────────────────────────────────────

async function loginDomeggook(page) {
    await page.goto('https://domeggook.com/main/member/mem_formLogin.php', {
        waitUntil: 'domcontentloaded', timeout: 20000,
    });
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

    const items = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('.sub_cont_bane1'));
        const seen = new Set();
        return containers.map(c => {
            const text = c.innerText || '';
            const noMatch = text.match(/상품번호\s+(\d+)/);
            const itemNo = noMatch ? noMatch[1] : '';
            if (!itemNo || seen.has(itemNo)) return null;
            seen.add(itemNo);
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const noIdx = lines.findIndex(l => l.startsWith('상품번호'));
            const name = noIdx >= 0 ? lines[noIdx + 1] || '' : '';
            const img = c.querySelector('img[src*="_img_330"], img[src*="_stt_330"]');
            return { itemNo, name, imgSrc: img?.src || '' };
        }).filter(p => p && p.name && p.itemNo);
    });
    return items;
}

async function getPriceAndImages(page, itemNo) {
    await page.goto(`https://domeggook.com/${itemNo}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    return await page.evaluate(() => {
        const priceEl = document.querySelector('.lItemPrice') || document.getElementById('lBaseAmtVal');
        const price = parseInt((priceEl?.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
        const mainImg = document.querySelector('#divMainImage img, .goods_img img, .mainImg img');
        const detailImgs = Array.from(
            document.querySelectorAll('#divDetailImage img, .detail_img img, .itemDetailImage img, .goods_description img')
        ).map(img => img.src).filter(s => s && s.startsWith('http')).slice(0, 9);
        return { price, mainImgSrc: mainImg?.src || '', detailImgSrcs: detailImgs };
    });
}

// ── 엑셀 생성 ────────────────────────────────────────────────────────────

function getSheetName(wb, categoryName) {
    const name = categoryName || '';
    if (/패션|의류|잡화|신발|가방|악세|액세/.test(name)) return wb.SheetNames.find(s => s.includes('패션')) || wb.SheetNames[0];
    if (/식품|음식|먹|간식|과자|음료/.test(name))       return wb.SheetNames.find(s => s.includes('식품')) || wb.SheetNames[0];
    if (/가전|전자|TV|냉장|세탁/.test(name))             return wb.SheetNames.find(s => s.includes('가전')) || wb.SheetNames[0];
    return wb.SheetNames[0];
}

function buildExcel(row, categoryName) {
    const wb = xlsx.readFile(TEMPLATE_PATH);
    const sheetName = getSheetName(wb, categoryName);
    const ws = wb.Sheets[sheetName];
    log(`엑셀 시트: "${sheetName}"`);

    const r = 5;
    const sellPrice    = Math.ceil(row.wholesalePrice * MARKUP / 10) * 10;
    const discountBase = Math.ceil(sellPrice * 1.2 / 10) * 10;

    const set = (col, val) => { ws[col + r] = { v: val, t: typeof val === 'number' ? 'n' : 's' }; };

    set('A', categoryName);
    set('B', row.title);
    set('E', '새 상품');
    set('I', row.keyword);
    set('BJ', sellPrice);
    set('BL', discountBase);
    set('BM', 99999);
    set('BN', 2);
    set('BO', 0);
    set('BR', 'N');
    set('BS', 'Y');
    set('CZ', row.imageUrl);
    set('DA', row.imageUrl);
    if (row.detailImgSrcs?.[0]) set('DB', row.detailImgSrcs[0]);

    ws['!ref'] = `A1:DB5`;

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const safeName  = categoryName.replace(/[/\\?%*:|"<>]/g, '_');
    const filename  = `coupang_${safeName}_${timestamp}.xlsx`;
    const filepath  = path.join(OUTPUT_DIR, filename);
    xlsx.writeFile(wb, filepath);
    return { filepath, filename };
}

// ── 이메일 발송 ───────────────────────────────────────────────────────────

async function sendEmail(to, subject, htmlContent, attachmentPath) {
    const content  = fs.readFileSync(attachmentPath).toString('base64');
    const filename = path.basename(attachmentPath);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender:     { name: '제품추출', email: SENDER_EMAIL },
            to:         [{ email: to }],
            subject,
            htmlContent,
            attachment: [{ name: filename, content }],
        }),
    });
    if (!res.ok) throw new Error(`Brevo 발송 실패: ${await res.text()}`);
}

// ── 메인 ─────────────────────────────────────────────────────────────────

(async () => {
    const categoryCode   = process.argv[2];
    const recipientEmail = process.argv[3];

    if (!categoryCode || !recipientEmail) {
        console.error('사용법: node extractor.js <categoryCode> <email>');
        process.exit(1);
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    let browser;

    try {
        // 1. 카테고리 키워드 조회
        log(`카테고리 ${categoryCode} 키워드 조회 중...`);
        const { rows: cats } = await pool.query(
            `SELECT code, name, emoji, keywords FROM "NaverShoppingCategory" WHERE code = $1 LIMIT 1`,
            [categoryCode]
        );
        if (cats.length === 0) throw new Error(`카테고리 ${categoryCode} 없음`);
        const cat      = cats[0];
        const keywords = JSON.parse(cat.keywords || '[]').slice(0, 5);
        log(`키워드 ${keywords.length}개: ${keywords.join(', ')}`);

        browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        // 2. 쿠팡 경쟁도 분석 — 블루오션 키워드 선정
        log('\n── 쿠팡 경쟁도 분석 ──');
        const competition = [];
        for (const kw of keywords) {
            const result = await checkCoupangCompetition(page, kw);
            competition.push({ keyword: kw, ...result });
            await sleep(1500);
        }

        // 모두 0이면 쿠팡 차단 → 첫 번째 키워드 사용
        const allZero    = competition.every(c => c.totalCount === 0 && c.avgReviews === 0);
        const blueOceans = competition.filter(c => c.isBlueOcean && !allZero);
        const selected   = allZero
            ? { ...competition[0], isBlueOcean: false, note: '쿠팡 경쟁도 조회 불가 (IP 차단)' }
            : blueOceans.length > 0
                ? blueOceans[0]
                : competition.sort((a, b) => a.score - b.score)[0];
        if (allZero) log('⚠️  쿠팡 IP 차단 — 경쟁도 측정 불가. 첫 번째 키워드로 진행합니다.');

        log(`\n선택된 키워드: "${selected.keyword}" (상품수:${selected.totalCount}, 평균리뷰:${selected.avgReviews})`);

        // 3. 도매매 검색 — 상품 1개
        log('\n── 도매매 검색 ──');
        await loginDomeggook(page);
        log(`"${selected.keyword}" 도매매 검색 중...`);

        const products = await searchDomemedb(page, selected.keyword);
        if (products.length === 0) throw new Error(`도매매에서 "${selected.keyword}" 상품을 찾을 수 없습니다.`);

        const top = products[0];
        log(`상품 발견: "${top.name}" (번호: ${top.itemNo})`);

        const { price: wholesalePrice, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
        if (wholesalePrice === 0) throw new Error('도매가 조회 실패 (0원)');
        log(`도매가: ${wholesalePrice.toLocaleString()}원 / 이미지: ${detailImgSrcs.length}개`);

        // 4. AI 제목 생성
        log('\nAI 제목 생성 중...');
        const title = await generateTitle(selected.keyword, top.name, wholesalePrice);
        log(`제목: "${title}"`);

        await browser.close();
        browser = null;

        const productData = {
            keyword:        selected.keyword,
            title,
            originalName:   top.name,
            wholesalePrice,
            sellPrice:      Math.ceil(wholesalePrice * MARKUP / 10) * 10,
            imageUrl:       mainImgSrc || top.imgSrc,
            detailImgSrcs,
            productUrl:     `https://domeggook.com/${top.itemNo}`,
            coupangCompetition: {
                totalCount:  selected.totalCount,
                avgReviews:  selected.avgReviews,
                isBlueOcean: selected.isBlueOcean,
            },
        };

        // 5. 엑셀 생성
        log('\n엑셀 생성 중...');
        const { filepath, filename } = buildExcel(productData, cat.name);
        log(`엑셀 저장: ${filepath}`);

        // 6. 이메일 발송
        log(`이메일 발송 → ${recipientEmail}`);
        const competitionBadge = selected.isBlueOcean
            ? `<span style="background:#166534;color:#bbf7d0;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">🟢 블루오션</span>`
            : `<span style="background:#7f1d1d;color:#fca5a5;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">🔴 경쟁있음</span>`;

        await sendEmail(
            recipientEmail,
            `[제품추출] ${cat.name} — "${title.slice(0, 20)}..."`,
            `
            <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#1e3a5f;padding:24px;border-radius:12px 12px 0 0">
                    <h2 style="color:#fff;margin:0;font-size:20px">📦 제품추출 완료</h2>
                    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">카테고리: ${cat.emoji || ''} ${cat.name}</p>
                </div>
                <div style="background:#f9fafb;padding:20px;border-radius:0 0 12px 12px">
                    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden">
                        <tr style="background:#1e3a5f;color:#fff">
                            <th style="padding:10px 12px;text-align:left;font-size:13px;width:90px">이미지</th>
                            <th style="padding:10px 12px;text-align:left;font-size:13px">상품 정보</th>
                            <th style="padding:10px 12px;text-align:right;font-size:13px">가격</th>
                        </tr>
                        <tr>
                            <td style="padding:12px;vertical-align:top">
                                <a href="${productData.productUrl}" target="_blank">
                                    <img src="${productData.imageUrl}" width="80" height="80" style="object-fit:cover;border-radius:6px;display:block" onerror="this.style.display='none'">
                                </a>
                            </td>
                            <td style="padding:12px;vertical-align:top">
                                <div style="margin-bottom:6px">${competitionBadge}</div>
                                <div style="font-size:11px;color:#6b7280;margin-bottom:4px">키워드: ${productData.keyword} | 쿠팡 상품수: ${selected.totalCount.toLocaleString()} | 평균리뷰: ${selected.avgReviews}</div>
                                <a href="${productData.productUrl}" target="_blank" style="color:#1e3a5f;font-weight:bold;font-size:13px;text-decoration:none">${title}</a>
                                <div style="font-size:11px;color:#9ca3af;margin-top:4px">${top.name}</div>
                            </td>
                            <td style="padding:12px;text-align:right;vertical-align:top">
                                <div style="font-size:12px;color:#6b7280">도매가</div>
                                <div style="font-size:14px;font-weight:600">${wholesalePrice.toLocaleString()}원</div>
                                <div style="font-size:12px;color:#6b7280;margin-top:8px">판매가(×${MARKUP})</div>
                                <div style="font-size:14px;font-weight:600;color:#16a34a">${productData.sellPrice.toLocaleString()}원</div>
                            </td>
                        </tr>
                    </table>
                    <p style="font-size:12px;color:#6b7280;margin-top:16px">
                        첨부파일(${filename})을 쿠팡윙 → 상품일괄등록에서 업로드하세요.
                    </p>
                </div>
            </div>`,
            filepath,
        );

        log('✅ 완료!');
        process.exit(0);

    } catch (e) {
        log(`❌ 오류: ${e.message}`);
        console.error(e);
        process.exit(1);
    } finally {
        if (browser) await browser.close().catch(() => {});
        await pool.end().catch(() => {});
    }
})();
