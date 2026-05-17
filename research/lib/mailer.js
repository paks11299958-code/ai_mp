/**
 * mailer.js — Brevo 이메일 발송
 */
require('dotenv').config({ path: '/home/paks11299958/shared-api/.env' });
const fs = require('fs');

const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const SENDER_EMAIL    = process.env.BREVO_SENDER_EMAIL || 'noreply@golf.dbzone.kr';

async function sendResearchComplete({ to, topic, notebookName, notebookUrl, filePath, previewText }) {
  if (!BREVO_API_KEY) { console.warn('⚠️ BREVO_API_KEY 없음'); return; }

  const attachments = [];
  if (filePath && fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath).toString('base64');
    const fileName = require('path').basename(filePath);
    attachments.push({ name: fileName, content });
  }

  const preview = previewText ? previewText.slice(0, 500).replace(/[<>]/g, '') : '';
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const body = JSON.stringify({
    sender:  { name: 'AI 리서치 봇', email: SENDER_EMAIL },
    to:      [{ email: to }],
    subject: `✅ [리서치 완료] ${topic} — ${now}`,
    htmlContent: `
      <h2 style="color:#16a34a">✅ 리서치가 완료됐습니다</h2>
      <table style="font-size:14px;line-height:2;border-collapse:collapse;width:100%;max-width:480px">
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 14px;font-weight:bold">주제</td>
          <td style="padding:8px 14px">${topic}</td>
        </tr>
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 14px;font-weight:bold">노트북</td>
          <td style="padding:8px 14px">${notebookName}</td>
        </tr>
        ${notebookUrl ? `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:8px 14px;font-weight:bold">NotebookLM</td>
          <td style="padding:8px 14px"><a href="${notebookUrl}" style="color:#2563eb">바로 열기 →</a></td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 14px;font-weight:bold">완료 시각</td>
          <td style="padding:8px 14px">${now}</td>
        </tr>
      </table>
      ${preview ? `
      <h3 style="margin-top:24px;color:#374151">원고 미리보기</h3>
      <pre style="background:#f9fafb;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;max-width:600px">${preview}...</pre>
      ` : ''}
      <p style="color:#9ca3af;font-size:12px;margin-top:16px">원고 파일이 첨부됐습니다. NotebookLM에 드래그앤드롭 하세요.</p>
    `,
    ...(attachments.length > 0 ? { attachment: attachments } : {}),
  });

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) throw new Error(`Brevo 발송 실패 (${res.status})`);
  console.log(`📧 이메일 발송 완료 → ${to}`);
}

async function sendResearchError({ to, topic, errorMessage }) {
  if (!BREVO_API_KEY) return;
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'AI 리서치 봇', email: SENDER_EMAIL },
      to:     [{ email: to }],
      subject: `❌ [리서치 실패] ${topic} — ${now}`,
      htmlContent: `
        <h2 style="color:#dc2626">❌ 리서치 중 오류가 발생했습니다</h2>
        <p><b>주제:</b> ${topic}</p>
        <p><b>오류:</b> ${errorMessage}</p>
        <p style="color:#6b7280;font-size:13px">${now}</p>
      `,
    }),
  });
}

module.exports = { sendResearchComplete, sendResearchError };
