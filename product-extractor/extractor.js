/**
 * 제품추출 — 서버 실행용 (GCP)
 * 사용법: node extractor.js [카테고리코드]
 * 예시:   node extractor.js 50000007   (스포츠/레저)
 *         node extractor.js             (랜덤 카테고리)
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
require('dotenv').config({ override: false }); // product-extractor/.env 보완

const { chromium } = require('playwright');
const xlsx   = require('xlsx');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const BREVO_API_KEY       = process.env.BREVO_API_KEY;
const SENDER_EMAIL        = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const GEMINI_API_KEY      = process.env.GEMINI_API_KEY;
const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || 'GQTM16ASwMR5e817MQvZ';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'iz7FciCCdG';
const DOMEGGOOK_ID        = process.env.DOMEGGOOK_ID        || 'c2clo';
const DOMEGGOOK_PW        = process.env.DOMEGGOOK_PASSWORD;
const NOTIFY_EMAIL        = 'sjy4926@hanmail.net';
const NOTIFY_PHONE        = '01050294926';
const COUPANG_VENDOR_ID   = process.env.COUPANG_VENDOR_ID   || 'A01662881';
const COUPANG_ACCESS_KEY  = process.env.COUPANG_ACCESS_KEY;
const COUPANG_SECRET_KEY  = process.env.COUPANG_SECRET_KEY;
const OUTPUT_DIR          = path.join(__dirname, 'output');
const CATEGORIES          = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories.json'), 'utf8'));
const MARKUP              = 2.5;   // 도매가 × 2.5 = 판매가
const MARKUP_DISPLAY      = 3.5;   // 도매가 × 3.5 = 정가(할인 전 표시가) → 판매가 대비 약 28% 할인처럼 보임

// 블루오션 기준
const BLUE_OCEAN_SEARCH_MIN  = 3;      // 네이버 검색량 ratio 최소 (수요 있어야 함)
const BLUE_OCEAN_PRODUCT_MAX = 30000;  // 네이버 쇼핑 상품 수 최대

function log(msg) { console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 카테고리 선택 ─────────────────────────────────────────

async function getCategory() {
    const code = process.argv[2];
    if (code) {
        const cat = CATEGORIES.find(c => c.code === code);
        if (!cat) {
            console.log(`카테고리 ${code} 없음. 사용 가능:`);
            CATEGORIES.forEach(c => console.log(`  ${c.code} - ${c.emoji}${c.name}`));
            process.exit(1);
        }
        return cat;
    }

    // 네이버 쇼핑인사이트로 카테고리 트렌드 조회
    try {
        const endDate   = new Date().toISOString().slice(0, 10);
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const res = await fetch('https://openapi.naver.com/v1/datalab/shopping/categories', {
            method: 'POST',
            headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startDate, endDate, timeUnit: 'month',
                category: CATEGORIES.map(c => ({ name: c.name, param: [c.code] })),
                device: '', ages: [], gender: '',
            }),
        });
        const data = await res.json();

        // 카테고리별 평균 클릭 비율 계산 후 순위 매기기
        const ranked = (data.results || []).map(r => {
            const ratios = (r.data || []).map(d => d.ratio);
            const avg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
            return { cat: CATEGORIES.find(c => c.name === r.title), trend: avg };
        }).filter(r => r.cat).sort((a, b) => b.trend - a.trend);

        log('\n── 카테고리 트렌드 ──');
        ranked.forEach((r, i) => log(`  ${i + 1}위 ${r.cat.emoji}${r.cat.name}: ${r.trend.toFixed(1)}`));

        // 4~7위 중간 인기 카테고리에서 랜덤 선택 (수요O + 경쟁과열X)
        const midRange = ranked.slice(3, 7).filter(r => r.trend > 0);
        const picked   = midRange.length > 0
            ? midRange[Math.floor(Math.random() * midRange.length)].cat
            : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
        log(`→ 선택: ${picked.emoji}${picked.name} (중간 인기)\n`);
        return picked;
    } catch (e) {
        log(`카테고리 트렌드 조회 실패 (${e.message.slice(0, 40)}) → 랜덤 선택`);
        return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    }
}

// ── 네이버 블루오션 분석 ─────────────────────────────────

async function analyzeBlueOcean(keywords) {
    const naverHeaders = {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        'Content-Type': 'application/json',
    };
    const endDate   = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const results = [];
    for (const keyword of keywords) {
        try {
            // 1. 검색량 트렌드 (DataLab 검색어트렌드)
            const dlRes = await fetch('https://openapi.naver.com/v1/datalab/search', {
                method: 'POST',
                headers: naverHeaders,
                body: JSON.stringify({
                    startDate, endDate, timeUnit: 'month',
                    keywordGroups: [{ groupName: keyword, keywords: [keyword] }],
                }),
            });
            const dlData = await dlRes.json();
            const ratios = dlData.results?.[0]?.data?.map(d => d.ratio) || [];
            const searchRatio = ratios.length > 0
                ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length * 10) / 10
                : 0;

            // 2. 상품 수 (네이버 쇼핑 검색)
            const shopRes = await fetch(
                `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(keyword)}&display=1`,
                { headers: { 'X-Naver-Client-Id': NAVER_CLIENT_ID, 'X-Naver-Client-Secret': NAVER_CLIENT_SECRET } }
            );
            const shopData = await shopRes.json();
            const productCount = shopData.total || 0;

            // 블루오션 점수: 검색량 높고 상품 수 적을수록 높음
            const score = productCount > 0 ? searchRatio / Math.log10(productCount + 10) : searchRatio;
            const isBlueOcean = searchRatio >= BLUE_OCEAN_SEARCH_MIN && productCount < BLUE_OCEAN_PRODUCT_MAX;

            log(`  [네이버] "${keyword}" → 검색량:${searchRatio} 상품수:${productCount.toLocaleString()} ${isBlueOcean ? '🟢블루오션' : '🔴경쟁많음'}`);
            results.push({ keyword, searchRatio, productCount, score, isBlueOcean });
        } catch (e) {
            log(`  [네이버] "${keyword}" 오류: ${e.message.slice(0, 60)}`);
            results.push({ keyword, searchRatio: 0, productCount: 99999, score: 0, isBlueOcean: false });
        }
        await sleep(300);
    }
    return results;
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
    await sleep(4000);
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

async function searchDomemedbWithFallback(page, keyword) {
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

async function getPriceAndImages(page, itemNo) {
    await page.goto(`https://domeggook.com/${itemNo}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);

    const priceAndUrls = await page.evaluate(() => {
        const priceEl = document.querySelector('.lItemPrice') || document.getElementById('lBaseAmtVal');
        const price = parseInt((priceEl?.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;

        // 대표이미지: #lThumb 라이트박스 링크 → _img_760 포맷 (760px, 쿠팡 500px 기준 통과)
        const lightboxImgs = Array.from(document.querySelectorAll('#lThumb a.thumbLightbox img'))
            .map(i => i.src.split('?')[0]).filter(Boolean);
        const fallbackImgs = Array.from(document.querySelectorAll('#lThumbWrap img'))
            .map(i => i.src.split('?')[0]).filter(s => s.includes('_img_'));
        const allMainImgs = [...new Set([...lightboxImgs, ...fallbackImgs])];
        const mainSrc = allMainImgs[0] || '';

        return { price, mainSrc, extraMainSrcs: allMainImgs.slice(1, 4) };
    });

    // "상품상세 더보기" 클릭 후 상세 이미지 수집
    let detailSrcs = [];
    try {
        const moreBtn = await page.$('text=상품상세 더보기');
        if (moreBtn) {
            await moreBtn.click();
            await sleep(1500);
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(1500);
            log('  상품상세 더보기 클릭 완료');
        }
        // #lInfoView: 셀러 업로드 상품 상세 이미지 전용 컨테이너 (860px+, 연관상품/배너 제외)
        detailSrcs = await page.evaluate((mainSrc) => {
            const seen = new Set([mainSrc]);
            const container = document.querySelector('#lInfoView');
            if (!container) return [];
            const SKIP = ['/image/', 'pstatic.net', 'ico_', 'btn_', '/sns/', '/common/'];
            return Array.from(container.querySelectorAll('img'))
                .map(e => (e.src || e.dataset.src || '').split('?')[0])
                .filter(s => s && s.startsWith('http') && !SKIP.some(k => s.includes(k))
                    && !seen.has(s) && !!seen.add(s))
                .slice(0, 8);
        }, priceAndUrls.mainSrc);
    } catch {}

    // page.request.get()으로 이미지 다운로드 (브라우저 세션 — 핫링크 우회)
    const downloadImage = async (url) => {
        if (!url) return null;
        try {
            const r = await page.request.get(url, { headers: { 'Referer': 'https://domeggook.com/' } });
            if (!r.ok()) return null;
            const buffer = await r.body();
            if (buffer.length < 3000) return null;
            return { buffer, type: r.headers()['content-type'] || 'image/jpeg' };
        } catch { return null; }
    };

    const mainData = priceAndUrls.mainSrc ? await downloadImage(priceAndUrls.mainSrc) : null;
    const detailData = [];
    const usedDetailSrcs = [];
    for (const url of detailSrcs.slice(0, 5)) {
        const d = await downloadImage(url);
        if (d) { detailData.push(d); usedDetailSrcs.push(url); }
    }
    log(`  이미지 다운로드: 대표 ${mainData ? `✓ (${(mainData.buffer.length/1024).toFixed(0)}KB)` : '✗'}, 상세 ${detailData.length}개`);

    return {
        price:         priceAndUrls.price,
        mainImgData:   mainData,
        detailImgData: detailData,
        mainImgSrc:    priceAndUrls.mainSrc,
        detailImgSrcs: usedDetailSrcs,
    };
}

// ── 엑셀 생성 ────────────────────────────────────────────

function buildExcel(row, categoryName) {
    const sellPrice    = Math.ceil(row.wholesalePrice * MARKUP / 10) * 10;
    const discountBase = Math.ceil(row.wholesalePrice * MARKUP_DISPLAY / 10) * 10; // 정가 = 도매가×3.5 (판매가 대비 ~28% 할인)

    // template.xlsm 있으면 사용, 없으면 자체 생성
    const searchDirs = [__dirname, process.cwd()];
    let templatePath = null;
    for (const dir of searchDirs) {
        const files = fs.readdirSync(dir).filter(f => f.toLowerCase().startsWith('template') && /\.(xlsm|xlsx)$/i.test(f));
        if (files.length > 0) { templatePath = path.join(dir, files[0]); break; }
    }

    let wb, ws;
    if (templatePath) {
        wb = xlsx.readFile(templatePath);
        ws = wb.Sheets[wb.SheetNames[0]];
        const r = 5;
        const set = (col, val) => { ws[col + r] = { v: val, t: typeof val === 'number' ? 'n' : 's' }; };
        set('A', categoryName);
        set('B', row.title);
        set('E', '새 상품');
        set('G', '상표없음');
        set('H', '상표없음');
        set('I', row.keyword);
        set('BJ', sellPrice);
        set('BL', discountBase);
        set('BM', 99999);
        set('BN', 2);
        set('BO', 0);
        set('BR', 'N');
        set('BS', 'Y');
        if (row.itemNo) set('BU', `DMG-${row.itemNo}`);
        set('CZ', row.imageUrl);
        set('DA', row.imageUrl);
        if (row.detailImgSrcs?.[0]) set('DB', row.detailImgSrcs[0]);
        ws['!ref'] = 'A1:DM5';
    } else {
        // 템플릿 없을 때 — 쿠팡윙 참고용 데이터 엑셀 자체 생성
        wb = xlsx.utils.book_new();
        const data = [
            ['항목', '내용'],
            ['카테고리', categoryName],
            ['AI 제목', row.title],
            ['키워드', row.keyword],
            ['원상품명', row.originalName || ''],
            ['도매가', row.wholesalePrice],
            ['판매가 (×2.5)', sellPrice],
            ['정가 (판매가×1.2)', discountBase],
            ['재고', 99999],
            ['배송비타입', 2],
            ['새상품여부', '새 상품'],
            ['대표이미지', row.imageUrl],
            ...(row.detailImgSrcs || []).map((url, i) => [`상세이미지${i + 1}`, url]),
        ];
        ws = xlsx.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 20 }, { wch: 80 }];
        xlsx.utils.book_append_sheet(wb, ws, '제품정보');
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const safeName  = categoryName.replace(/[/\\?%*:|"<>]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const filename  = `coupang_${safeName}_${timestamp}.xlsx`;
    const filepath  = path.join(OUTPUT_DIR, filename);
    xlsx.writeFile(wb, filepath);
    log(`템플릿: ${templatePath ? '쿠팡윙 양식' : '자체 생성 (참고용)'}`);
    return { filepath, filename };
}

// ── 쿠팡윙 Open API 업로드 ───────────────────────────────

// 카테고리명 → 쿠팡 displayCategoryCode 매핑
// 80745 = 주방/생활(확인된 유효코드), 나머지는 추후 확인 필요
const COUPANG_CAT_CODE = {
    '생활/건강':    80745,   // 확인됨 (주방/욕실용품)
    '패션의류':     null,
    '패션잡화':     null,
    '화장품/미용':  null,
    '가전/디지털':  null,
    '가구/인테리어':null,
    '식품':         null,
    '스포츠/레저':  null,
    '유아동/출산':  null,
    '반려동물':     null,
};

// 이미지 버퍼 → Coupang CDN 업로드 (Playwright로 다운받은 버퍼 사용)
async function uploadBufferToCoupang(buffer, contentType) {
    if (!buffer || !COUPANG_ACCESS_KEY) return null;
    try {
        const urlPath = '/v2/providers/seller_api/apis/api/v1/vendor-items/image';
        const { headers } = coupangSign('POST', urlPath);
        const res = await fetch('https://api-gateway.coupang.com' + urlPath, {
            method: 'POST',
            headers: { Authorization: headers.Authorization, 'Content-Type': contentType || 'image/jpeg' },
            body: buffer,
        });
        const data = await res.json();
        if (data.code === 'SUCCESS') return data.data; // CDN 경로 반환 (예: /img/...)
        log(`  이미지 CDN 실패: ${JSON.stringify(data).slice(0, 100)}`);
        return null;
    } catch (e) {
        log(`  이미지 CDN 오류: ${e.message}`);
        return null;
    }
}

function coupangSign(method, urlPath, query = '') {
    // 쿠팡 Open API: yyMMddTHHmmssZ (2자리 연도), 구분자 없이 이어붙임
    const now = new Date();
    const yy  = String(now.getUTCFullYear()).slice(-2);
    const MM  = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd  = String(now.getUTCDate()).padStart(2, '0');
    const HH  = String(now.getUTCHours()).padStart(2, '0');
    const mm  = String(now.getUTCMinutes()).padStart(2, '0');
    const ss  = String(now.getUTCSeconds()).padStart(2, '0');
    const dt  = `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
    const msg = dt + method + urlPath + query;   // \n 구분자 없음
    const sig = crypto.createHmac('sha256', COUPANG_SECRET_KEY).update(msg).digest('hex');
    return {
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            Authorization: `CEA algorithm=HmacSHA256, access-key=${COUPANG_ACCESS_KEY}, signed-date=${dt}, signature=${sig}`,
        },
        dt,
    };
}

async function uploadToCoupangWing(productData, cat, sellPrice, discountBase) {
    if (!COUPANG_ACCESS_KEY || !COUPANG_SECRET_KEY) {
        log('쿠팡 API 키 없음 — 업로드 스킵');
        return null;
    }
    const displayCategoryCode = COUPANG_CAT_CODE[cat.name];
    if (!displayCategoryCode) {
        log(`쿠팡 카테고리 코드 미정의(${cat.name}) — 업로드 스킵`);
        return null;
    }

    const BASE    = 'https://api-gateway.coupang.com';
    const urlPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';

    // CDN path (starts with /) → cdnPath 필드, 외부 URL → vendorPath 필드
    const makeImgObj = (url, order, type) => {
        if (!url) return null;
        return url.startsWith('/')
            ? { imageOrder: order, imageType: type, cdnPath: url }
            : { imageOrder: order, imageType: type, vendorPath: url };
    };

    const mainUrl    = productData.imageUrl;
    const detailUrls = (productData.detailImgSrcs || []).filter(Boolean);

    // 상품 이미지 (대표 + 추가)
    const itemImages = [
        makeImgObj(mainUrl, 0, 'REPRESENTATION'),
        makeImgObj(mainUrl, 0, 'DETAIL'),
        ...detailUrls.slice(0, 8).map((u, i) => makeImgObj(u, i + 1, 'DETAIL')),
    ].filter(Boolean);

    // 상세설명 컨텐츠 (최소 1개 필수 — 없으면 대표이미지로 대체)
    const contentUrls = detailUrls.length > 0 ? detailUrls.slice(0, 10) : [mainUrl];
    const contents = contentUrls
        .filter(Boolean)
        .map(u => ({ contentsType: 'IMAGE_NO_SPACE', contentDetails: [{ content: u, detailType: 'IMAGE' }] }));

    const tags = productData.keyword.split(/\s+/).filter(w => w.length >= 2);

    const body = {
        displayCategoryCode,
        sellerProductName:   productData.title,
        vendorId:            COUPANG_VENDOR_ID,
        vendorUserId:        'sjy4926',
        saleStartedAt:       '2030-01-01T00:00:00',   // 판매중지 — 윙에서 날짜 바꾸면 바로 판매 시작
        saleEndedAt:         '2099-12-31T00:00:00',
        displayProductName:  productData.title,
        brand:               '',
        generalProductName:  productData.originalName || productData.keyword,
        productGroup:        '',
        deliveryMethod:      'SEQUENCIAL',
        deliveryCompanyCode: 'CJGLS',
        deliveryChargeType:  'NOT_FREE',
        deliveryCharge:      3000,
        freeShipOverAmount:  0,
        deliveryChargeOnReturn: 0,
        deliverySurcharge:   0,
        remoteAreaDeliverable: 'N',
        bundlePackingDelivery: 0,
        unionDeliveryType:   'NOT_UNION_DELIVERY',
        returnCenterCode:    '1002556031',
        returnChargeName:    '프라임유통',
        companyContactNumber:'010-5029-2445',
        returnZipCode:       '21632',
        returnAddress:       '인천광역시 남동구 남동서로236번길 30',
        returnAddressDetail: ' 2층 222-a235호',
        returnCharge:        5000,
        exchangeType:        'AFTER',
        outboundShippingPlaceCode: 24363515,
        items: [{
            itemName:               '기본',
            originalPrice:          discountBase,
            salePrice:              sellPrice,
            unitCount:              1,
            maximumBuyCount:        99999,
            maximumBuyForPerson:    0,
            maximumBuyForPersonPeriod: 1,
            outboundShippingTimeDay: 1,
            stopSellEmergency:      false,
            coupangInventoryCount:  99999,
            adultOnly:              'EVERYONE',
            taxType:                'TAX',
            parallelImported:       'NOT_PARALLEL_IMPORTED',
            overseasPurchased:      'NOT_OVERSEAS_PURCHASED',
            emptyBarcode:           true,
            emptyBarcodeReason:     'COUPANG',
            attributes: [
                { attributeTypeName: '수량',    attributeValueName: '1개' },
                { attributeTypeName: '개당 수량', attributeValueName: '1개' },
            ],
            images:   itemImages,
            contents: contents,
            notices: [
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '품명 및 모델명', content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '재질',          content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '구성품',         content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '크기',          content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '출시년월',       content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '제조자(수입자)', content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '제조국',         content: '상품 상세페이지 참조' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '수입신고 문구 여부', content: '해당없음' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: '품질보증기준',   content: '제품 이상 시 소비자분쟁해결기준에 의거 보상합니다.' },
                { noticeCategoryName: '주방용품', noticeCategoryDetailName: 'A/S 책임자와 전화번호', content: '010-5029-2445' },
            ],
            certifications: [{ certificationType: 'NOT_REQUIRED', certificationCode: '', certificationAttachments: [] }],
        }],
        searchTags: tags,
    };

    try {
        log('\n── 쿠팡윙 업로드 ──');

        const { headers } = coupangSign('POST', urlPath);
        const res  = await fetch(BASE + urlPath, { method: 'POST', headers, body: JSON.stringify(body) });
        const data = await res.json();

        if (data.code === 'SUCCESS') {
            const pid = data.data;
            log(`✅ 쿠팡윙 등록 성공! 상품ID: ${pid} (판매중지 — 윙에서 판매시작일 오늘로 변경 시 활성화)`);
            if (data.details) log(`  ⚠ ${data.details.slice(0, 80)}`);
            return pid;
        } else {
            log(`❌ 쿠팡윙 등록 실패: ${JSON.stringify(data).slice(0, 300)}`);
            return null;
        }
    } catch (e) {
        log(`쿠팡윙 업로드 오류: ${e.message}`);
        return null;
    }
}

// ── SMS 발송 ─────────────────────────────────────────────

async function sendSms(to, text) {
    const apiKey    = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from      = process.env.SOLAPI_SENDER_PHONE;
    if (!apiKey || !apiSecret || !from) { log('SMS 환경변수 없음 — 건너뜀'); return; }
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const sig  = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
    const res  = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${sig}`,
        },
        body: JSON.stringify({ message: { to, from, text } }),
    });
    if (!res.ok) log(`SMS 발송 실패: ${await res.text()}`);
    else log(`SMS 발송 완료 → ${to}`);
}

// ── DB 중복 체크 ──────────────────────────────────────────

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

async function initExtractedTable() {
    await dbPool.query(`
        CREATE TABLE IF NOT EXISTS extracted_products (
            id         SERIAL PRIMARY KEY,
            item_no    TEXT UNIQUE NOT NULL,
            keyword    TEXT,
            title      TEXT,
            extracted_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

async function isAlreadyExtracted(itemNo) {
    const { rows } = await dbPool.query('SELECT 1 FROM extracted_products WHERE item_no=$1', [String(itemNo)]);
    return rows.length > 0;
}

async function saveExtracted(itemNo, keyword, title) {
    await dbPool.query(
        'INSERT INTO extracted_products (item_no, keyword, title) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
        [String(itemNo), keyword, title]
    );
}

// ── 이메일 발송 ───────────────────────────────────────────

async function sendEmail(to, subject, html, attachmentPath) {
    if (!BREVO_API_KEY || !to) { log('이메일 설정 없음 — 로컬 저장만 완료'); return; }
    const content  = fs.readFileSync(attachmentPath).toString('base64');
    const filename = path.basename(attachmentPath);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender: { name: '제품추출', email: SENDER_EMAIL },
            to: [{ email: to }], subject, htmlContent: html,
            attachment: [{ name: filename, content }],
        }),
    });
    if (!res.ok) log(`이메일 발송 실패: ${await res.text()}`);
    else log(`이메일 발송 완료 → ${to}`);
}

// ── 메인 ─────────────────────────────────────────────────

(async () => {
    const cat      = await getCategory();
    const keywords = cat.keywords.slice(0, 5);
    log(`카테고리: ${cat.emoji}${cat.name}`);
    log(`키워드: ${keywords.join(', ')}`);

    let browser;
    try {
        await initExtractedTable();
        // 1. 네이버 블루오션 분석 (브라우저 불필요)
        log('\n── 네이버 블루오션 분석 ──');
        const competition = await analyzeBlueOcean(keywords);

        const blueOceans = competition.filter(c => c.isBlueOcean);
        const candidates = blueOceans.length > 0
            ? blueOceans.sort((a, b) => b.score - a.score)
            : competition.sort((a, b) => b.score - a.score);
        log(`블루오션 ${blueOceans.length}개 발견 → "${candidates[0].keyword}" 선택`);

        // 2. 도매매 검색
        log('\n── 도매매 검색 ──');
        browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();
        await loginDomeggook(page);

        let products = [], selected = candidates[0];
        for (const candidate of candidates) {
            log(`키워드 시도: "${candidate.keyword}" (검색량:${candidate.searchRatio}, 상품수:${candidate.productCount.toLocaleString()})`);
            const found = await searchDomemedbWithFallback(page, candidate.keyword);
            if (found.length > 0) { products = found; selected = candidate; break; }
            log(`  도매꾹 상품 없음 — 다음 키워드`);
        }
        if (!products.length) throw new Error('모든 키워드에서 도매꾹 상품 없음');

        const kwWords = selected.keyword.split(' ').filter(w => w.length >= 2);
        const matched = products.filter(p => kwWords.some(w => p.name.includes(w)));

        // DB 중복 체크 — 이미 추출한 상품 건너뜀
        let top = null;
        for (const p of matched.length > 0 ? matched : products) {
            if (await isAlreadyExtracted(p.itemNo)) {
                log(`⏭ 이미 추출한 상품 건너뜀: "${p.name}" (${p.itemNo})`);
                continue;
            }
            top = p; break;
        }
        if (!top) throw new Error('새로운 상품 없음 — 모든 후보가 이미 추출됨');
        log(`상품: "${top.name}" (번호: ${top.itemNo})${matched.length === 0 ? ' ⚠️키워드 불일치' : ''}`);

        const { price: wholesalePrice, mainImgData, detailImgData, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
        if (!wholesalePrice) throw new Error('도매가 조회 실패');
        log(`도매가: ${wholesalePrice.toLocaleString()}원`);
        const domeggookUrl = `https://domeggook.com/${top.itemNo}`;
        log(`도매꾹 URL: ${domeggookUrl}`);

        // Coupang CDN 이미지 업로드 (브라우저 닫기 전 — Playwright 세션으로 다운받은 버퍼 사용)
        log('\n── 쿠팡 이미지 CDN 업로드 ──');
        const cdnMain = mainImgData ? await uploadBufferToCoupang(mainImgData.buffer, mainImgData.type) : null;
        log(`  대표이미지: ${cdnMain ? '✓ CDN 업로드 성공' : '✗ 실패 (원본 URL 사용)'}`);
        const cdnDetails = [];
        for (const d of detailImgData) {
            const cdn = await uploadBufferToCoupang(d.buffer, d.type);
            if (cdn) cdnDetails.push(cdn);
        }
        log(`  상세이미지: ${cdnDetails.length}개 CDN 업로드 성공`);

        await browser.close(); browser = null;

        // 3. AI 제목
        log('\nAI 제목 생성 중...');
        const title = await generateTitle(selected.keyword, top.name, wholesalePrice);
        log(`제목: "${title}"`);

        // 4. 엑셀
        const sellPrice    = Math.ceil(wholesalePrice * MARKUP / 10) * 10;
        const discountBase = Math.ceil(wholesalePrice * MARKUP_DISPLAY / 10) * 10;
        const productData  = {
            keyword:      selected.keyword,
            title,
            wholesalePrice,
            originalName: top.name,
            imageUrl:     cdnMain || mainImgSrc || top.imgSrc,       // CDN 우선, 없으면 원본 URL
            detailImgSrcs: cdnDetails.length > 0 ? cdnDetails : detailImgSrcs,  // CDN 우선
            itemNo:       top.itemNo,
        };
        const { filepath } = buildExcel(productData, cat.name);
        log(`\n엑셀 저장: ${filepath}`);

        // 5. 쿠팡윙 자동 업로드 (판매중지 상태)
        const coupangProductId = await uploadToCoupangWing(productData, cat, sellPrice, discountBase);

        // 6. 이메일
        await sendEmail(
            NOTIFY_EMAIL,
            `[제품추출] ${cat.emoji}${cat.name} — ${title.slice(0, 25)}...`,
            `<div style="font-family:sans-serif;max-width:500px">
                <h2 style="color:#1e3a5f">📦 ${cat.emoji}${cat.name} 제품추출 완료</h2>
                <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">
                    <tr><td><b>키워드</b></td><td>${selected.keyword}</td></tr>
                    <tr><td><b>네이버 검색량</b></td><td>${selected.searchRatio} (0~100)</td></tr>
                    <tr><td><b>네이버 상품수</b></td><td>${selected.productCount.toLocaleString()}개</td></tr>
                    <tr><td><b>AI 제목</b></td><td>${title}</td></tr>
                    <tr><td><b>원상품명</b></td><td>${top.name}</td></tr>
                    <tr><td><b>도매꾹 원본</b></td><td><a href="${domeggookUrl}" style="color:#2563eb">${domeggookUrl}</a></td></tr>
                    <tr><td><b>도매가</b></td><td>${wholesalePrice.toLocaleString()}원</td></tr>
                    <tr><td><b>판매가(×2.5)</b></td><td style="color:#16a34a;font-weight:bold">${sellPrice.toLocaleString()}원</td></tr>
                    <tr><td><b>블루오션</b></td><td>${selected.isBlueOcean ? '🟢 블루오션' : '🔴 경쟁있음'}</td></tr>
                    <tr><td><b>쿠팡윙</b></td><td>${coupangProductId ? `✅ 등록완료 (ID: ${coupangProductId}) — 판매중지 상태` : '⚠️ 수동 업로드 필요 (첨부 엑셀 사용)'}</td></tr>
                </table>
                ${coupangProductId
                    ? `<p style="color:#16a34a;font-size:13px">✅ 쿠팡윙에 자동 등록됐습니다. <b>판매중지 상태</b>이니 윙에서 확인 후 판매시작일을 오늘로 변경하세요.</p>`
                    : `<p style="color:#6b7280;font-size:12px">첨부 엑셀을 쿠팡윙 → 상품일괄등록에서 업로드하세요.</p>`
                }
            </div>`,
            filepath
        );

        // 7. SMS
        await sendSms(NOTIFY_PHONE,
            `[제품추출완료] ${cat.emoji}${cat.name}\n키워드: ${selected.keyword}\n판매가: ${sellPrice.toLocaleString()}원\n${coupangProductId ? '쿠팡윙 자동등록 완료' : '수동업로드 필요'}`
        );

        // 8. DB 저장 (중복 방지)
        await saveExtracted(top.itemNo, selected.keyword, title);
        log(`DB 저장 완료: ${top.itemNo}`);

        console.log('\n🎉 완료!');
        console.log(`   엑셀 위치: ${filepath}`);
    } catch (e) {
        log(`❌ 오류: ${e.message}`);
    } finally {
        if (browser) await browser.close().catch(() => {});
        await dbPool.end().catch(() => {});
    }
})();
