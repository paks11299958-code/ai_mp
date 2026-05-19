require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const crypto = require('crypto');

const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const VENDOR_ID  = process.env.COUPANG_VENDOR_ID;

// 쿠팡 공식 SDK 방식 (https://github.com/coupang/coupang-wing-api-sdk 참고)
function generateAuthorization(method, url) {
    const datetime = new Date().toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}Z$/, 'Z');
    
    // path + query string 분리
    const [path, qs] = url.split('?');
    const message = datetime + method + path + (qs ? '?' + qs : '');
    
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(message)
        .digest('hex');
    
    return {
        authorization: `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`,
        datetime,
    };
}

async function api(method, path, qs = '') {
    const url = path + (qs ? '?' + qs : '');
    const { authorization } = generateAuthorization(method, url);
    const res = await fetch(`https://api-gateway.coupang.com${url}`, {
        method,
        headers: {
            'Authorization': authorization,
            'Content-Type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
        },
    });
    console.log(`[${res.status}] ${method} ${path.slice(-60)}`);
    return res.json().catch(() => res.text());
}

(async () => {
    // Wing Seller API - 실제 문서 기준 엔드포인트들
    const endpoints = [
        // 상품 조회
        ['GET', `/v2/providers/seller_api/apis/api/v1/products`, `vendorId=${VENDOR_ID}&pageNum=1&pageSize=1`],
        // 카테고리 메타 
        ['GET', `/v2/providers/seller_api/apis/api/v1/categories/53069/items`, ``],
        // 주문 조회 (아무거나 동작하는지 확인용)
        ['GET', `/v2/providers/seller_api/apis/api/v1/orders`, `vendorId=${VENDOR_ID}&status=ACCEPT&limit=1&createdAtFrom=2026-05-01T00:00:00&createdAtTo=2026-05-18T23:59:59`],
        // 정산 조회
        ['GET', `/v2/providers/seller_api/apis/api/v1/vendor-settlements`, `vendorId=${VENDOR_ID}&settlementDate=20260501`],
    ];
    
    for (const [m, p, q] of endpoints) {
        const result = await api(m, p, q);
        console.log('  →', JSON.stringify(result).slice(0, 120));
    }
})();
