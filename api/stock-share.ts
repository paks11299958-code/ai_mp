import type { VercelRequest, VercelResponse } from '@vercel/node';

// 카카오톡·문자 등 링크 미리보기 카드용 — SPA는 index.html의 고정 OG만 내려가 종목별
// 카드를 못 만든다(주석: frontend/index.html "SPA라 페이지별 OG는 없고 사이트 공통 카드").
// 크롤러(카톡/페북 등은 JS를 실행하지 않음)에게는 서버에서 조립한 OG HTML을 바로 응답하고,
// 실제 사람(브라우저)은 기존 SPA(?stock=)로 리다이렉트해 React가 처리하게 한다.

const SHARED_API = 'http://34.50.27.95:3020/api/aimp/stock-analysis/shared';
const SITE_ORIGIN = 'https://aichat.dbzone.kr';

// 카카오톡/페이스북/트위터 등 링크 미리보기 크롤러의 UA 특징(전부 소문자 매칭).
const BOT_UA = /kakaotalk|katalk|facebookexternalhit|twitterbot|slackbot|discordbot|telegrambot|line|whatsapp/i;

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// analysisReport(Gemini, 표 형식)에서 투자의견 한 줄만 뽑아 카드 설명에 쓴다.
function extractOpinion(report: string | null): string {
    if (!report) return '';
    const m = report.match(/\|\s*투자의견\s*\|\s*\*?\*?([^\n|*]+)/);
    return m ? m[1].replace(/\*\*/g, '').trim() : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const shareId = String(req.query.id || '').trim();
    const dest = shareId ? `${SITE_ORIGIN}/?stock=${encodeURIComponent(shareId)}` : SITE_ORIGIN;

    const ua = String(req.headers['user-agent'] || '');
    if (req.query.debug === '1') {
        return res.status(200).json({ shareId, ua, matched: BOT_UA.test(ua), headerKeys: Object.keys(req.headers) });
    }
    if (!shareId || !BOT_UA.test(ua)) {
        res.setHeader('Cache-Control', 'no-store');
        res.writeHead(302, { Location: dest });
        return res.end();
    }

    try {
        const r = await fetch(`${SHARED_API}/${encodeURIComponent(shareId)}`);
        if (!r.ok) {
            res.writeHead(302, { Location: dest });
            return res.end();
        }
        const data = await r.json();
        const stockName = String(data.stockName || '종목');
        const opinion = extractOpinion(data.analysisReport);
        const desc = opinion
            ? `${stockName} AI 정밀분석 — 투자의견 ${opinion} · DART 공시 + Gemini/Claude/GPT 교차검증`
            : `${stockName} AI 정밀분석 보고서 — DART 공시 + Gemini/Claude/GPT 교차검증`;
        const title = `📊 ${stockName} 정밀분석 — AI 놀이터`;

        const html = `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="AI 놀이터">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(dest)}">
<meta property="og:image" content="${SITE_ORIGIN}/512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE_ORIGIN}/512.png">
<meta http-equiv="refresh" content="0; url=${esc(dest)}">
</head><body></body></html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).send(html);
    } catch {
        res.writeHead(302, { Location: dest });
        return res.end();
    }
}
