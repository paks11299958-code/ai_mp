const crypto = require('crypto');
require('dotenv').config();
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY;
const SECRET_KEY = process.env.COUPANG_SECRET_KEY;
const BASE = 'https://api-gateway.coupang.com';

function sign(method, urlPath, query='') {
    const now = new Date();
    const yy=String(now.getUTCFullYear()).slice(-2), MM=String(now.getUTCMonth()+1).padStart(2,'0'), dd=String(now.getUTCDate()).padStart(2,'0');
    const HH=String(now.getUTCHours()).padStart(2,'0'), mm=String(now.getUTCMinutes()).padStart(2,'0'), ss=String(now.getUTCSeconds()).padStart(2,'0');
    const dt=yy+MM+dd+'T'+HH+mm+ss+'Z';
    const sig=crypto.createHmac('sha256',SECRET_KEY).update(dt+method+urlPath+query).digest('hex');
    return { headers: {'Content-Type':'application/json;charset=UTF-8', Authorization:'CEA algorithm=HmacSHA256, access-key='+ACCESS_KEY+', signed-date='+dt+', signature='+sig}, dt };
}

const TEST_URL = 'https://cdn1.domeggook.com/upload/item/2023/02/11/16760977540A8DB1D7D60BBDA6B8849F/16760977540A8DB1D7D60BBDA6B8849F.png';

(async () => {
    // 1. GCP→도매꾹 다운로드 가능한지 테스트
    console.log('1. 도매꾹 이미지 다운로드 시도...');
    const imgRes = await fetch(TEST_URL, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://domeggook.com/'
        }
    });
    console.log('   상태:', imgRes.status, imgRes.headers.get('content-type'), '크기:', imgRes.headers.get('content-length'), 'bytes');
    if (!imgRes.ok) { console.log('   다운로드 실패'); return; }
    
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    console.log('   다운로드 성공! 버퍼 크기:', buffer.length, 'bytes');

    // 2. Coupang 이미지 업로드 시도 (multipart)
    console.log('2. Coupang CDN 업로드 시도...');
    const urlPath = '/v2/providers/seller_api/apis/api/v1/vendor-items/image';
    const { headers: authHeaders } = sign('POST', urlPath);
    
    const form = new FormData();
    const blob = new Blob([buffer], { type: 'image/png' });
    form.append('file', blob, 'image.png');
    
    delete authHeaders['Content-Type']; // multipart boundary 자동 설정
    
    const res = await fetch(BASE + urlPath, { method: 'POST', headers: authHeaders, body: form });
    const text = await res.text();
    console.log('   응답:', text.slice(0, 300));
})().catch(e => console.error(e.message));
