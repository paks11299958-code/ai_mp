/**
 * 제품추출 — 서버 실행용 (GCP)
 * 사용법: node extractor.js [카테고리코드]
 * 예시:   node extractor.js 50000007   (스포츠/레저)
 *         node extractor.js             (랜덤 카테고리)
 */

require('dotenv').config();

const { chromium } = require('playwright');
const xlsx  = require('xlsx');
const path  = require('path');
const fs    = require('fs');

const BREVO_API_KEY       = process.env.BREVO_API_KEY;
const SENDER_EMAIL        = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const ANTHROPIC_KEY       = process.env.ANTHROPIC_API_KEY;
const NAVER_CLIENT_ID     = process.env.NAVER_CLIENT_ID     || 'GQTM16ASwMR5e817MQvZ';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'iz7FciCCdG';
const DOMEGGOOK_ID        = process.env.DOMEGGOOK_ID        || 'c2clo';
const DOMEGGOOK_PW        = process.env.DOMEGGOOK_PASSWORD;
const NOTIFY_EMAIL        = process.env.NOTIFY_EMAIL;
const OUTPUT_DIR          = path.join(__dirname, 'output');
const CATEGORIES          = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories.json'), 'utf8'));
const MARKUP              = 2.5;

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
    return await page.evaluate(() => {
        const priceEl = document.querySelector('.lItemPrice') || document.getElementById('lBaseAmtVal');
        const price = parseInt((priceEl?.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;
        const mainImg = document.querySelector('#divMainImage img, .goods_img img, .mainImg img');
        const detailImgs = Array.from(document.querySelectorAll('#divDetailImage img, .detail_img img'))
            .map(i => i.src).filter(s => s?.startsWith('http')).slice(0, 9);
        return { price, mainImgSrc: mainImg?.src || '', detailImgSrcs: detailImgs };
    });
}

// ── 엑셀 생성 ────────────────────────────────────────────

function buildExcel(row, categoryName) {
    const sellPrice    = Math.ceil(row.wholesalePrice * MARKUP / 10) * 10;
    const discountBase = Math.ceil(sellPrice * 1.2 / 10) * 10;

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
        const top     = matched.length > 0 ? matched[0] : products[0];
        log(`상품: "${top.name}" (번호: ${top.itemNo})${matched.length === 0 ? ' ⚠️키워드 불일치' : ''}`);

        const { price: wholesalePrice, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
        if (!wholesalePrice) throw new Error('도매가 조회 실패');
        log(`도매가: ${wholesalePrice.toLocaleString()}원`);

        await browser.close(); browser = null;

        // 3. AI 제목
        log('\nAI 제목 생성 중...');
        const title = await generateTitle(selected.keyword, top.name, wholesalePrice);
        log(`제목: "${title}"`);

        // 4. 엑셀
        const sellPrice   = Math.ceil(wholesalePrice * MARKUP / 10) * 10;
        const productData = { keyword: selected.keyword, title, wholesalePrice, originalName: top.name, imageUrl: mainImgSrc || top.imgSrc, detailImgSrcs };
        const { filepath } = buildExcel(productData, cat.name);
        log(`\n엑셀 저장: ${filepath}`);

        // 5. 이메일
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
                    <tr><td><b>도매가</b></td><td>${wholesalePrice.toLocaleString()}원</td></tr>
                    <tr><td><b>판매가(×2.5)</b></td><td style="color:#16a34a;font-weight:bold">${sellPrice.toLocaleString()}원</td></tr>
                    <tr><td><b>블루오션</b></td><td>${selected.isBlueOcean ? '🟢 블루오션' : '🔴 경쟁있음'}</td></tr>
                </table>
                <p style="color:#6b7280;font-size:12px">첨부 엑셀을 쿠팡윙 → 상품일괄등록에서 업로드하세요.</p>
            </div>`,
            filepath
        );

        console.log('\n🎉 완료!');
        console.log(`   엑셀 위치: ${filepath}`);
    } catch (e) {
        log(`❌ 오류: ${e.message}`);
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
})();
