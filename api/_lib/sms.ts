import crypto from 'crypto';

function makeAuthHeader(apiKey: string, apiSecret: string): string {
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(16).toString('hex');
    const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
    return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export async function sendSms(to: string, text: string): Promise<void> {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;
    const from = process.env.SOLAPI_SENDER_PHONE;
    if (!apiKey || !apiSecret || !from) throw new Error('SOLAPI 환경변수가 설정되지 않았습니다.');

    const res = await fetch('https://api.solapi.com/messages/v4/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: makeAuthHeader(apiKey, apiSecret),
        },
        body: JSON.stringify({ message: { to, from, text } }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`SMS 전송 실패: ${err}`);
    }
}
