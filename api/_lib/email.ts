export async function sendEmail(to: string, subject: string, htmlContent: string) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY not set');

    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@dbzone.kr';

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': apiKey,
        },
        body: JSON.stringify({
            sender: { name: 'AI 페르소나', email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`이메일 전송 실패: ${err}`);
    }

    return res.json();
}
