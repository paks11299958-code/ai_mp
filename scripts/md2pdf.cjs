// 기획서 마크다운 → PDF (Playwright 인쇄). shared-api/lib/ebookPdf.ts 와 같은 방식.
// ★한글 폰트: 시스템에 Noto Sans KR 이 없을 수 있어 프로젝트 동봉 TTF 를 data URI 로 심는다
//   (폰트가 없으면 네모(두부)로 렌더되는데, PDF 라 나중에 고치기도 어렵다).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MD = process.argv[2];
const OUT = process.argv[3];
if (!MD || !OUT) { console.error('사용: node md2pdf.cjs <md> <pdf>'); process.exit(1); }

// 동봉 폰트를 base64 로
const FONT_DIR = '/home/paks11299958/shorts-factory/assets';
const b64 = (f) => fs.readFileSync(path.join(FONT_DIR, f)).toString('base64');
let fontFaces = '';
try {
  fontFaces = `
@font-face { font-family:'KRSans'; font-weight:400;
  src:url(data:font/ttf;base64,${b64('NanumMyeongjo-Regular.ttf')}) format('truetype'); }
@font-face { font-family:'KRSans'; font-weight:700;
  src:url(data:font/ttf;base64,${b64('NanumMyeongjo-Bold.ttf')}) format('truetype'); }`;
} catch (e) { console.warn('폰트 임베드 실패(시스템 폰트 사용):', e.message); }

const md = fs.readFileSync(MD, 'utf8');

// 최소 마크다운 렌더러 — 표/제목/목록/코드/굵게/링크만 (기획서에 쓰는 문법 범위)
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}
const lines = md.split('\n');
let html = '', inTable = false, inCode = false, inList = false, inQuote = false;
const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
const closeTable = () => { if (inTable) { html += '</tbody></table>'; inTable = false; } };
const closeQuote = () => { if (inQuote) { html += '</blockquote>'; inQuote = false; } };

for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  if (/^```/.test(ln)) {
    closeList(); closeTable(); closeQuote();
    html += inCode ? '</code></pre>' : '<pre><code>'; inCode = !inCode; continue;
  }
  if (inCode) { html += esc(ln) + '\n'; continue; }

  if (/^\|/.test(ln)) {                                  // 표
    const cells = ln.split('|').slice(1, -1).map(c => c.trim());
    if (/^\|[\s:|-]+\|$/.test(ln)) continue;             // 구분선
    if (!inTable) {
      closeList(); closeQuote();
      html += '<table><thead><tr>' + cells.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
      inTable = true;
    } else {
      html += '<tr>' + cells.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
    }
    continue;
  }
  closeTable();

  const h = ln.match(/^(#{1,4})\s+(.*)$/);
  if (h) { closeList(); closeQuote(); html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
  if (/^---+$/.test(ln)) { closeList(); closeQuote(); html += '<hr>'; continue; }
  if (/^>\s?/.test(ln)) {
    closeList();
    if (!inQuote) { html += '<blockquote>'; inQuote = true; }
    html += inline(ln.replace(/^>\s?/, '')) + '<br>'; continue;
  }
  closeQuote();
  const li = ln.match(/^(\s*)[-*]\s+(.*)$/);
  if (li) {
    if (!inList) { html += '<ul>'; inList = true; }
    html += `<li>${inline(li[2])}</li>`; continue;
  }
  const oli = ln.match(/^\s*\d+\.\s+(.*)$/);
  if (oli) {
    if (!inList) { html += '<ul>'; inList = true; }
    html += `<li>${inline(oli[1])}</li>`; continue;
  }
  closeList();
  if (ln.trim()) html += `<p>${inline(ln)}</p>`;
}
closeList(); closeTable(); closeQuote();

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFaces}
* { box-sizing: border-box; }
body { font-family:'KRSans','Noto Sans KR','Malgun Gothic',sans-serif; color:#1f2937;
       margin:0; font-size:10.5pt; line-height:1.7; }
h1 { font-size:20pt; color:#111827; border-bottom:3px solid #6366f1; padding-bottom:8px; margin:0 0 14px; }
h2 { font-size:14pt; color:#312e81; margin:22px 0 8px; padding-left:9px; border-left:5px solid #6366f1; }
h3 { font-size:11.5pt; color:#3730a3; margin:16px 0 6px; }
h4 { font-size:10.5pt; color:#4b5563; margin:12px 0 4px; }
p { margin:6px 0; }
ul { margin:6px 0 6px 18px; padding:0; }
li { margin:3px 0; }
table { border-collapse:collapse; width:100%; margin:10px 0; font-size:9.5pt; }
th { background:#eef2ff; color:#312e81; font-weight:700; text-align:left; }
th, td { border:1px solid #c7d2fe; padding:6px 8px; vertical-align:top; }
tbody tr:nth-child(even) { background:#f8fafc; }
code { background:#f1f5f9; color:#be123c; padding:1px 4px; border-radius:3px; font-size:9pt; }
pre { background:#0f172a; color:#e2e8f0; padding:10px 12px; border-radius:6px;
      font-size:8.5pt; line-height:1.5; overflow:hidden; white-space:pre-wrap; }
pre code { background:none; color:inherit; padding:0; }
blockquote { background:#f5f3ff; border-left:4px solid #a78bfa; margin:10px 0;
             padding:8px 12px; color:#4c1d95; font-size:9.5pt; }
hr { border:none; border-top:1px solid #e5e7eb; margin:18px 0; }
strong { color:#111827; }
a { color:#4338ca; text-decoration:none; }
h2, h3 { break-after:avoid; }
table, pre, blockquote { break-inside:avoid; }
</style></head><body>${html}</body></html>`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.setContent(page, { waitUntil: 'networkidle' });
  // ★data URI 폰트는 setContent 직후엔 아직 준비되지 않는다 — 기다리지 않으면
  //   브라우저가 폴백 폰트(중국어 WenQuanYi 등)로 렌더해 한글이 어색해진다.
  //   document.fonts.ready 로 실제 로드 완료를 확인한다.
  await p.evaluate(() => document.fonts.ready);
  await p.evaluate(() => document.fonts.load('700 20pt KRSans'));
  await p.evaluate(() => document.fonts.load('400 10pt KRSans'));
  const ok = await p.evaluate(() => document.fonts.check('400 10pt KRSans'));
  console.log('KRSans 로드됨:', ok);
  await p.waitForTimeout(500);
  await p.pdf({
    path: OUT, format: 'A4', printBackground: true,
    margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="width:100%;font-size:8pt;color:#9ca3af;text-align:center;padding:0 15mm;">
      <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
  });
  await b.close();
  console.log('PDF 생성:', OUT, fs.statSync(OUT).size, 'bytes');
})();
