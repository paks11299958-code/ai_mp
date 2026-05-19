/**
 * 제품추출 스크립트
 * 1. 선택한 카테고리의 핫키워드 조회 (DB)
 * 2. 키워드별 도매꾹 검색 → 상위 상품 수집
 * 3. Claude AI로 소비자 친화 제목 생성
 * 4. 쿠팡윙 업로드용 엑셀 생성
 * 5. Brevo 이메일 첨부 발송
 *
 * 실행: node extractor.js <categoryCode> <recipientEmail>
 */

require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

const xlsx  = require('xlsx');
const path  = require('path');
const fs    = require('fs');
const { Pool } = require('pg');

const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const SENDER_EMAIL    = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const DOMEGGOOK_ID    = process.env.DOMEGGOOK_ID;
const DOMEGGOOK_PW    = process.env.DOMEGGOOK_PASSWORD;
const OUTPUT_DIR      = path.join(__dirname, 'output');
const TEMPLATE_PATH   = path.join(__dirname, '..', 'doc', 'coupang_sellertool_upload_example_V4.6.xlsm');

// 판매가격 마진율 (도매꾹 가격 × MARKUP)
const MARKUP = 2.5;

// ── 유틸 ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`); }

function parsePrice(str) {
    if (!str) return 0;
    return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

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
- 생활에서 쓰는 표현 사용 (예: "무침요리 편해지는", "허리 편한")

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

// ── 도매꾹 스크래퍼 ───────────────────────────────────────────────────────

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
    // 도매매(domemedb)에서 검색 — domeggook.com 로그인 세션 공유됨
    await page.goto('https://domemedb.domeggook.com/index/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    await page.fill('input[name="sw"]', keyword);
    await page.evaluate(() => document.getElementById('search_list')?.submit());
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // sub_cont_bane1 컨테이너에서 상품 추출
    const items = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll('.sub_cont_bane1'));
        const seen = new Set();
        return containers
            .map(c => {
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
            })
            .filter(p => p && p.name && p.itemNo);
    });

    return items;
}

async function getPriceAndImages(page, itemNo) {
    await page.goto(`https://domeggook.com/${itemNo}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    return await page.evaluate(() => {
        const priceEl = document.querySelector('.lItemPrice') || document.getElementById('lBaseAmtVal');
        const price = parseInt((priceEl?.textContent || '').replace(/[^0-9]/g, ''), 10) || 0;

        // 대표 이미지 (상품 상단 큰 이미지)
        const mainImg = document.querySelector('#divMainImage img, .goods_img img, .mainImg img');

        // 상세 이미지 (상세 설명 영역)
        const detailImgs = Array.from(
            document.querySelectorAll('#divDetailImage img, .detail_img img, .itemDetailImage img, .goods_description img')
        ).map(img => img.src).filter(s => s && s.startsWith('http')).slice(0, 9);

        return { price, mainImgSrc: mainImg?.src || '', detailImgSrcs: detailImgs };
    });
}

// ── 엑셀 생성 ────────────────────────────────────────────────────────────

// 카테고리명 → 쿠팡윙 시트명 매핑
function getSheetName(wb, categoryName) {
    const name = categoryName || '';
    if (/패션|의류|잡화|신발|가방|악세|액세|의상|티셔츠|원피스|청바지|레깅스|자켓|코트|니트/.test(name)) {
        return wb.SheetNames.find(s => s.includes('패션')) || wb.SheetNames[0];
    }
    if (/식품|음식|먹|간식|과자|음료|주류|건강식품/.test(name)) {
        return wb.SheetNames.find(s => s.includes('식품')) || wb.SheetNames[0];
    }
    if (/가전|전자|TV|냉장|세탁|청소기|에어컨|컴퓨터|노트북|스마트폰|태블릿/.test(name)) {
        return wb.SheetNames.find(s => s.includes('가전')) || wb.SheetNames[0];
    }
    return wb.SheetNames[0]; // 기본
}

function buildExcel(rows, categoryName) {
    const wb = xlsx.readFile(TEMPLATE_PATH);
    const sheetName = getSheetName(wb, categoryName);
    const ws = wb.Sheets[sheetName];
    log(`엑셀 시트: "${sheetName}"`);

    // 헤더는 1~4행 유지, 5행부터 데이터 삽입
    rows.forEach((row, i) => {
        const r = i + 5;
        const sellPrice = Math.ceil(row.wholesalePrice * MARKUP / 10) * 10;
        const discountBase = Math.ceil(sellPrice * 1.2 / 10) * 10;

        const set = (col, val) => {
            ws[col + r] = { v: val, t: typeof val === 'number' ? 'n' : 's' };
        };

        // 기본정보 (A~I)
        set('A', categoryName);
        set('B', row.title);
        set('E', '새 상품');
        set('G', '');
        set('H', '');
        set('I', row.keyword);

        // 가격/재고 (BJ~BS)
        set('BJ', sellPrice);
        set('BL', discountBase);
        set('BM', 99999);
        set('BN', 2);
        set('BO', 0);
        set('BR', 'N');
        set('BS', 'Y');

        // 이미지 (CZ: 대표이미지, DA: 직사각형, DB: 추가이미지)
        set('CZ', row.imageUrl);
        set('DA', row.imageUrl);
        if (row.detailImgSrcs && row.detailImgSrcs.length > 0) {
            set('DB', row.detailImgSrcs[0]);
        }
    });

    const lastRow = rows.length + 4;
    if (!ws['!ref']) {
        ws['!ref'] = `A1:DB${lastRow}`;
    } else {
        ws['!ref'] = ws['!ref'].replace(/:\w+\d+$/, `:DB${lastRow}`);
    }

    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const filename  = `coupang_${categoryName}_${timestamp}.xlsx`;
    const filepath  = path.join(OUTPUT_DIR, filename);
    xlsx.writeFile(wb, filepath);
    return { filepath, filename };
}

// ── 이메일 발송 ───────────────────────────────────────────────────────────

async function sendEmail(to, subject, htmlContent, attachmentPath) {
    const content = fs.readFileSync(attachmentPath).toString('base64');
    const filename = path.basename(attachmentPath);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sender:      { name: '왕주식 제품추출', email: SENDER_EMAIL },
            to:          [{ email: to }],
            subject,
            htmlContent,
            attachment:  [{ name: filename, content }],
        }),
    });
    if (!res.ok) throw new Error(`Brevo 발송 실패: ${await res.text()}`);
}

// ── 메인 ─────────────────────────────────────────────────────────────────

(async () => {
    const categoryCode = process.argv[2];
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
        const cat = cats[0];

        const keywords = JSON.parse(cat.keywords || '[]').slice(0, 5);
        log(`키워드 ${keywords.length}개: ${keywords.join(', ')}`);

        // 2. 도매꾹 검색
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        });
        const page = await context.newPage();

        await loginDomeggook(page);

        const results = [];
        for (const kw of keywords) {
            log(`[${kw}] 도매매 검색 중...`);
            try {
                const products = await searchDomemedb(page, kw);
                if (products.length === 0) {
                    log(`  → 검색 결과 없음`);
                    continue;
                }
                const top = products[0];
                log(`  → "${top.name}" (상품번호 ${top.itemNo}) — 가격+이미지 조회 중...`);

                const { price: wholesalePrice, mainImgSrc, detailImgSrcs } = await getPriceAndImages(page, top.itemNo);
                log(`  → 도매가 ${wholesalePrice.toLocaleString()}원, 상세이미지 ${detailImgSrcs.length}개`);
                if (wholesalePrice === 0) {
                    log(`  → 가격 0원 — 건너뜀`);
                    continue;
                }

                // 3. AI 제목 생성
                log(`  → AI 제목 생성 중...`);
                const title = await generateTitle(kw, top.name, wholesalePrice);
                log(`  → 제목: "${title}"`);

                // 대표이미지: 상품 페이지 큰 이미지 우선, 없으면 목록 썸네일
                const representativeImg = mainImgSrc || top.imgSrc;

                results.push({
                    keyword:        kw,
                    title,
                    originalName:   top.name,
                    wholesalePrice,
                    sellPrice:      Math.ceil(wholesalePrice * MARKUP / 10) * 10,
                    imageUrl:       representativeImg,
                    detailImgSrcs,
                    productUrl:     `https://domeggook.com/${top.itemNo}`,
                });
            } catch (e) {
                log(`  → 오류: ${e.message}`);
            }
            await page.waitForTimeout(1000);
        }

        await browser.close();
        browser = null;

        if (results.length === 0) {
            throw new Error('수집된 상품이 없습니다.');
        }

        // 4. 엑셀 생성
        log(`엑셀 생성 중... (${results.length}개 상품)`);
        const { filepath, filename } = buildExcel(results, cat.name);
        log(`엑셀 저장: ${filepath}`);

        // 5. 이메일 발송
        log(`이메일 발송 → ${recipientEmail}`);
        const tableRows = results.map(r => `
            <tr style="border-top:1px solid #e5e7eb">
                <td style="padding:8px 12px;font-size:13px;vertical-align:middle">
                    <a href="${r.productUrl}" target="_blank">
                        <img src="${r.imageUrl}" width="80" height="80" style="object-fit:cover;border-radius:6px;display:block" onerror="this.style.display='none'">
                    </a>
                </td>
                <td style="padding:8px 12px;font-size:13px">
                    <div style="font-size:11px;color:#6b7280;margin-bottom:4px">${r.keyword}</div>
                    <a href="${r.productUrl}" target="_blank" style="color:#1e3a5f;font-weight:bold;text-decoration:none">${r.title}</a>
                    <div style="font-size:11px;color:#9ca3af;margin-top:2px">${r.originalName}</div>
                </td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;vertical-align:middle">${r.wholesalePrice.toLocaleString()}원</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;color:#16a34a;font-weight:bold;vertical-align:middle">${r.sellPrice.toLocaleString()}원</td>
            </tr>`).join('');

        await sendEmail(
            recipientEmail,
            `[왕주식] ${cat.name} 제품추출 완료 — ${results.length}개 상품`,
            `
            <div style="font-family:'Apple SD Gothic Neo',sans-serif;max-width:600px;margin:0 auto">
                <div style="background:#1e3a5f;padding:24px;border-radius:12px 12px 0 0">
                    <h2 style="color:#fff;margin:0;font-size:20px">📦 제품추출 완료</h2>
                    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px">
                        카테고리: ${cat.emoji || ''} ${cat.name} / ${results.length}개 상품
                    </p>
                </div>
                <div style="background:#f9fafb;padding:20px;border-radius:0 0 12px 12px">
                    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden">
                        <thead>
                            <tr style="background:#1e3a5f;color:#fff">
                                <th style="padding:10px 12px;text-align:left;font-size:13px;width:90px">이미지</th>
                                <th style="padding:10px 12px;text-align:left;font-size:13px">키워드 / AI 제목</th>
                                <th style="padding:10px 12px;text-align:right;font-size:13px">도매가</th>
                                <th style="padding:10px 12px;text-align:right;font-size:13px">판매가(×2.5)</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
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
