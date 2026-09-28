import type { VercelRequest, VercelResponse } from '@vercel/node';

// 은비 축하 카드 받는 사람 페이지(/c/:id, 2026-09-28).
// stock-share.ts 와 같은 틀이지만 **리다이렉트하지 않는다** — 사람·크롤러 모두에게 카드 페이지 HTML 전체를
// 응답한다(SPA·App.tsx 무관). 크롤러는 <head> OG 로 카톡 미리보기를 만들고, 사람은 <body> 연출을 본다.
// 승인 시안: ~/eunbi-entry/card/draft/eunbi-card.html 의 "받는 사람 화면"(봉투→카드→빛→상황별 효과→손글씨).
//
// ★XSS: 이름·문구는 사용자 입력(과 그걸 받은 AI 출력)이다.
//   - HTML 본문·속성에 넣는 값은 전부 esc().
//   - 스크립트로 넘기는 데이터는 scriptJson()(<,>,&,U+2028/2029 이스케이프) 후 DOM 엔 textContent 로만 쓴다.
//   - occasion 은 허용 목록 밖이면 birthday.

const PUBLIC_API = 'http://34.50.27.95:3020/api/aimp/eunbi-card/public';
const SITE_ORIGIN = 'https://aichat.dbzone.kr';
/** 은비 페르소나 진입 링크 — 답장·놀러 가기 버튼이 여기로 간다. */
export const EUNBI_ENTRY_URL = `${SITE_ORIGIN}/?p=cmoogeutq000004ifpx8r9xv2`;
const CARD_ID_RE = /^[A-Za-z0-9]{12}$/;   // shared-api CARD_ID_RE 와 같다
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&family=Nanum+Pen+Script&display=swap';

export const OCCASIONS = ['birthday', 'cheer', 'pass', 'thanks', 'comfort'] as const;
export type Occasion = typeof OCCASIONS[number];

// 시안 OCC 의 표시값(label·tint·ribbon). name 은 서버 OCCASION_LABEL 과 같다.
export const OCC: Record<Occasion, { name: string; tint: string; ribbon: string }> = {
    birthday: { name: '생일', tint: '#FFE0EA', ribbon: 'Happy Birthday' },
    cheer: { name: '응원', tint: '#FFF4C8', ribbon: '파이팅!' },
    pass: { name: '합격·시험', tint: '#DDEEFF', ribbon: '축하해!' },
    thanks: { name: '고마워', tint: '#FFEFE6', ribbon: 'Thank you' },
    comfort: { name: '위로', tint: '#E9E2FF', ribbon: '토닥토닥' },
};

export interface PublicCard {
    id: string;
    occasion: string;
    toName: string;
    fromName: string;
    message: string;
    refCode?: string | null;
    createdAt?: string;
}

export const safeOccasion = (o: unknown): Occasion =>
    (OCCASIONS as readonly string[]).includes(o as string) ? (o as Occasion) : 'birthday';

export function esc(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** <script> 안에 그대로 넣어도 태그를 닫거나 줄을 끊을 수 없는 JSON. */
export function scriptJson(v: unknown): string {
    return JSON.stringify(v)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** 답장·놀러 가기 링크 — refCode 가 있으면 추천 코드를 붙인다. */
export function entryUrl(refCode?: string | null): string {
    return refCode ? `${EUNBI_ENTRY_URL}&ref=${encodeURIComponent(refCode)}` : EUNBI_ENTRY_URL;
}

const CSS = `
:root{--milk:#FFF3F7;--blush:#FFE1EC;--rose:#E8467F;--rose-deep:#B92A5F;--peach:#FFC7B2;--lilac:#B89CFF;--ink:#4A2338;--ink-soft:#8A5A71;
  --line:rgba(232,70,127,.18);--paper:#FFFCF8;--display:"Jua","Gowun Dodum",system-ui,sans-serif;
  --body:"Gowun Dodum","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;--hand:"Nanum Pen Script","Gowun Dodum",cursive;--tint:#FFD6E4;color-scheme:light}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--milk);color:var(--ink);font-family:var(--body);overflow-x:hidden}
.wrap{max-width:440px;margin:0 auto;padding-inline:16px;padding-block:16px 48px;display:flex;flex-direction:column;gap:18px}
h1,h2,h3{font-family:var(--display);font-weight:400;margin:0;text-wrap:balance}
p{margin:0;line-height:1.6}
button{font:inherit;color:inherit}
button:focus-visible,a:focus-visible{outline:3px solid var(--lilac);outline-offset:2px}
.stage{position:relative;border-radius:28px;overflow:hidden;background:radial-gradient(120% 80% at 50% 0%,var(--tint),var(--milk) 70%);
  padding:22px 16px 20px;min-height:620px;display:flex;flex-direction:column;align-items:center;gap:14px}
.from{font-size:13.5px;color:var(--ink-soft);text-align:center;word-break:keep-all;overflow-wrap:anywhere}
.from b{color:var(--rose-deep)}
.env{position:relative;width:min(92%,330px);aspect-ratio:4/3;margin-top:70px;perspective:900px;cursor:pointer;border:0;background:none;padding:0}
.env .back{position:absolute;inset:0;border-radius:14px;background:#F7B6CB;box-shadow:0 18px 40px rgba(185,42,95,.25)}
.env .front{position:absolute;inset:0;border-radius:14px;z-index:3;
  background:linear-gradient(155deg,transparent 49.5%,#F39AB8 50%) left/50% 100% no-repeat,
             linear-gradient(-155deg,transparent 49.5%,#F39AB8 50%) right/50% 100% no-repeat,
             linear-gradient(0deg,#F6A9C2 0 58%,transparent 58%)}
.env .flap{position:absolute;left:0;right:0;top:0;height:62%;z-index:4;transform-origin:top center;transition:transform .7s cubic-bezier(.3,.6,.2,1),z-index 0s .35s;
  background:linear-gradient(180deg,#F48FB1,#F0729E);clip-path:polygon(0 0,100% 0,50% 100%);border-radius:14px 14px 0 0}
.env .seal{position:absolute;left:50%;top:52%;z-index:5;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#FF7AA6,var(--rose-deep));color:#fff;display:grid;place-items:center;font-size:22px;
  box-shadow:0 4px 10px rgba(0,0,0,.18);transition:transform .35s,opacity .35s}
.env .peek{position:absolute;left:8%;right:8%;top:10%;bottom:8%;z-index:2;border-radius:10px;background:var(--paper);transition:transform .8s cubic-bezier(.2,.8,.2,1) .35s}
.env .tap{position:absolute;left:0;right:0;bottom:-44px;text-align:center;font-family:var(--hand);font-size:24px;color:var(--rose-deep);animation:nudge 1.6s ease-in-out infinite}
@keyframes nudge{50%{transform:translateY(-4px)}}
.env:not(.open) .seal{animation:beat 1.3s ease-in-out infinite}
@keyframes beat{50%{transform:scale(1.08)}}
.env.open .flap{transform:rotateX(180deg);z-index:1}
.env.open .seal{transform:scale(.4);opacity:0}
.env.open .peek{transform:translateY(-40%)}
.env.gone{transition:opacity .35s,transform .35s;opacity:0;transform:translateY(30px) scale(.94);pointer-events:none}
.card{width:100%;background:var(--paper);border-radius:22px;box-shadow:0 20px 50px rgba(185,42,95,.22);overflow:hidden;
  opacity:0;transform:translateY(60px) scale(.9) rotate(-2deg);transition:opacity .5s,transform .8s cubic-bezier(.2,.9,.25,1.15)}
.card.show{opacity:1;transform:none}
.art{position:relative;aspect-ratio:720/894;overflow:hidden;background:var(--tint)}
.art .kb{position:absolute;inset:0;transform-origin:50% 40%}
.art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.card.show .art .kb{animation:kenburns 14s ease-in-out infinite alternate}
@keyframes kenburns{from{transform:scale(1.02) translate(0,0)}to{transform:scale(1.09) translate(-1.2%,-1.5%)}}
.art canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.art .shine{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 45%,transparent 60%);transform:translateX(-120%)}
.card.show .art .shine{animation:shine 1.6s ease-out .5s 1 forwards}
@keyframes shine{to{transform:translateX(120%)}}
.ribbon{position:absolute;left:14px;top:14px;background:rgba(255,255,255,.9);border-radius:99px;padding:6px 12px;font-family:var(--display);font-size:15px;color:var(--rose-deep);box-shadow:0 3px 10px rgba(0,0,0,.08)}
.msg{padding:16px 18px 18px;display:flex;flex-direction:column;gap:10px}
.msg .to{font-family:var(--display);font-size:20px;color:var(--rose-deep);overflow-wrap:anywhere}
.msg .body{font-family:var(--hand);font-size:25px;line-height:1.3;color:var(--ink);min-height:4.2em;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
.msg .body .cur{display:inline-block;width:2px;height:.9em;background:var(--rose);vertical-align:-2px;margin-left:2px;animation:blink .8s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.msg .sign{align-self:flex-end;font-size:13px;color:var(--ink-soft);opacity:0;transition:opacity .6s;text-align:right;overflow-wrap:anywhere}
.msg .sign.show{opacity:1}
.ctas{width:100%;display:flex;flex-direction:column;gap:10px;opacity:0;transform:translateY(10px);transition:.5s}
.ctas.show{opacity:1;transform:none}
.btn{appearance:none;display:block;text-align:center;text-decoration:none;border:0;border-radius:99px;padding:14px 18px;font-family:var(--display);font-size:18px;cursor:pointer}
.btn.primary{background:var(--rose);color:#fff;box-shadow:0 5px 0 var(--rose-deep)}
.btn.primary:active{transform:translateY(3px);box-shadow:0 2px 0 var(--rose-deep)}
.btn.ghost{background:#fff;color:var(--rose-deep);border:1.5px solid var(--line)}
.bonus{font-size:12.5px;color:var(--ink-soft);text-align:center}
.replay{appearance:none;border:0;background:none;color:var(--ink-soft);font-size:13px;text-decoration:underline;cursor:pointer}
.nf{min-height:420px;justify-content:center;text-align:center}
.nf h1{font-size:26px;color:var(--rose-deep)}
.nf .btn{width:100%;max-width:320px}
@media (prefers-reduced-motion:reduce){
  .env .flap,.env .peek,.card,.ctas,.env.gone{transition:none}
  .card.show .art .kb,.card.show .art .shine,.env .tap,.env:not(.open) .seal,.msg .body .cur{animation:none}
}
`;

// 시안 <script> 의 받는 사람 연출 그대로(탭·칩·보내는 화면 제거). 데이터는 D 로만 받고 DOM 엔 textContent 로만 쓴다.
const PLAYER_JS = `
(function () {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var occ = D.occasion;
    var $ = function (id) { return document.getElementById(id); };

    // ── 효과(캔버스) ──
    var cv = $('fx'), cx = cv.getContext('2d'), parts = [], raf = 0, t0 = 0, W = 0, H = 0;
    function size() { var r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; cx.setTransform(d, 0, 0, d, 0, 0); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    var CONF = ['#FF7AA6', '#FFC75F', '#8ED1FC', '#B89CFF', '#7BDCB5', '#FF9A76'];
    function spawn(kind) {
        if (kind === 'confetti') return { k: kind, x: rnd(0, W), y: rnd(-H * .4, -10), vx: rnd(-.4, .4), vy: rnd(1.1, 2.2), r: rnd(0, 6.28), vr: rnd(-.12, .12), w: rnd(5, 9), h: rnd(3, 5), c: CONF[(Math.random() * CONF.length) | 0] };
        if (kind === 'petal') return { k: kind, x: rnd(-20, W), y: rnd(-H * .3, -10), vx: rnd(.3, 1), vy: rnd(.7, 1.5), r: rnd(0, 6.28), vr: rnd(-.05, .05), s: rnd(5, 9), ph: rnd(0, 6.28) };
        if (kind === 'heart') return { k: kind, x: W * rnd(.38, .62), y: H * .8, vx: rnd(-.5, .5), vy: rnd(-1.4, -.7), s: rnd(10, 18), life: 1, ph: rnd(0, 6.28) };
        if (kind === 'steam') return { k: kind, x: W * rnd(.46, .55), y: H * .66, vy: rnd(-.55, -.35), s: rnd(8, 14), life: 1, ph: rnd(0, 6.28) };
        if (kind === 'spark') { var L = Math.random() < .5; return { k: kind, x: W * (L ? .25 : .76), y: H * .6, vx: rnd(-2.6, 2.6), vy: rnd(-3.2, -.6), s: rnd(6, 12), life: 1, c: Math.random() < .5 ? '#FFD54F' : '#FF7AA6' }; }
        if (kind === 'twinkle') return { k: kind, x: W * rnd(.02, .3), y: H * rnd(.1, .5), s: rnd(1.2, 2.6), ph: rnd(0, 6.28), sp: rnd(.03, .07) };
    }
    function heartPath(x, y, s) { cx.beginPath(); cx.moveTo(x, y + s * .3); cx.bezierCurveTo(x, y, x - s * .5, y, x - s * .5, y + s * .3); cx.bezierCurveTo(x - s * .5, y + s * .6, x, y + s * .8, x, y + s); cx.bezierCurveTo(x, y + s * .8, x + s * .5, y + s * .6, x + s * .5, y + s * .3); cx.bezierCurveTo(x + s * .5, y, x, y, x, y + s * .3); }
    function star(x, y, s) { cx.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? s * .42 : s; cx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } cx.closePath(); }
    var SPEC = {
        birthday: { kinds: [['confetti', 70]], flames: [[.458, .6], [.506, .587], [.555, .6]] },
        cheer:    { kinds: [['spark', 0]], burst: true, twk: 0 },
        pass:     { kinds: [['petal', 46]] },
        thanks:   { kinds: [['heart', 0]], stream: 'heart' },
        comfort:  { kinds: [['twinkle', 26]], stream: 'steam', lamp: [.14, .32] }
    };
    function startFx() {
        stopFx(); size(); parts = []; t0 = performance.now();
        if (reduce) return;
        var sp = SPEC[occ];
        sp.kinds.forEach(function (k) { for (var i = 0; i < k[1]; i++) parts.push(spawn(k[0])); });
        var last = 0;
        function frame(now) {
            var t = (now - t0) / 1000;
            cx.clearRect(0, 0, W, H);
            if (sp.stream && now - last > (sp.stream === 'steam' ? 260 : 380)) { parts.push(spawn(sp.stream)); last = now; }
            if (sp.burst && (t < .1 || Math.floor(t * 10) % 16 === 0) && parts.length < 90) for (var b = 0; b < 6; b++) parts.push(spawn('spark'));
            if (sp.lamp) { var g = cx.createRadialGradient(W * sp.lamp[0], H * sp.lamp[1], 2, W * sp.lamp[0], H * sp.lamp[1], W * .28); var a = .22 + Math.sin(t * 1.6) * .06;
                g.addColorStop(0, 'rgba(255,214,140,' + a + ')'); g.addColorStop(1, 'rgba(255,214,140,0)'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
            if (sp.flames) sp.flames.forEach(function (f, i) { var fx = W * f[0], fy = H * f[1], fl = 1 + Math.sin(t * 17 + i * 2) * .12 + Math.sin(t * 29 + i) * .06;
                var g2 = cx.createRadialGradient(fx, fy, 1, fx, fy, 26 * fl); g2.addColorStop(0, 'rgba(255,236,160,.85)'); g2.addColorStop(.4, 'rgba(255,170,60,.35)'); g2.addColorStop(1, 'rgba(255,150,40,0)');
                cx.fillStyle = g2; cx.beginPath(); cx.arc(fx, fy, 26 * fl, 0, 6.28); cx.fill(); });
            for (var i = parts.length - 1; i >= 0; i--) {
                var p = parts[i];
                if (p.k === 'confetti') { p.x += p.vx + Math.sin(t * 2 + p.y * .02) * .4; p.y += p.vy; p.r += p.vr; if (p.y > H + 10) { p.y = -10; p.x = rnd(0, W); }
                    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.cos(p.r * 2)); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore(); }
                else if (p.k === 'petal') { p.x += p.vx + Math.sin(t * 1.4 + p.ph) * .6; p.y += p.vy; p.r += p.vr; if (p.y > H + 10 || p.x > W + 20) { parts[i] = spawn('petal'); continue; }
                    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r + Math.sin(t * 2 + p.ph) * .6); cx.fillStyle = 'rgba(255,183,205,.92)'; cx.beginPath(); cx.ellipse(0, 0, p.s, p.s * .55, 0, 0, 6.28); cx.fill();
                    cx.fillStyle = 'rgba(255,255,255,.5)'; cx.beginPath(); cx.ellipse(-p.s * .3, -p.s * .1, p.s * .35, p.s * .15, 0, 0, 6.28); cx.fill(); cx.restore(); }
                else if (p.k === 'heart') { p.x += p.vx + Math.sin(t * 2 + p.ph) * .5; p.y += p.vy; p.life -= .006; if (p.life <= 0) { parts.splice(i, 1); continue; }
                    cx.globalAlpha = Math.min(1, p.life * 1.4); cx.fillStyle = '#FF6F9C'; heartPath(p.x, p.y, p.s); cx.fill(); cx.globalAlpha = 1; }
                else if (p.k === 'steam') { p.y += p.vy; p.x += Math.sin(t * 1.8 + p.ph) * .35; p.s += .12; p.life -= .007; if (p.life <= 0) { parts.splice(i, 1); continue; }
                    var gs = cx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s); gs.addColorStop(0, 'rgba(255,255,255,' + (.38 * p.life) + ')'); gs.addColorStop(1, 'rgba(255,255,255,0)');
                    cx.fillStyle = gs; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.28); cx.fill(); }
                else if (p.k === 'spark') { p.x += p.vx; p.y += p.vy; p.vy += .06; p.life -= .016; if (p.life <= 0) { parts.splice(i, 1); continue; }
                    cx.globalAlpha = p.life; cx.fillStyle = p.c; star(p.x, p.y, p.s * (.6 + p.life * .4)); cx.fill(); cx.globalAlpha = 1; }
                else if (p.k === 'twinkle') { p.ph += p.sp; cx.fillStyle = 'rgba(255,240,200,' + (.35 + Math.sin(p.ph) * .35) + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.28); cx.fill(); }
            }
            raf = requestAnimationFrame(frame);
        }
        raf = requestAnimationFrame(frame);
    }
    function stopFx() { if (raf) cancelAnimationFrame(raf); raf = 0; if (W) cx.clearRect(0, 0, W, H); }

    // ── 받는 사람 연출 ──
    var timers = [];
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }
    function typeText(el, text, done) {
        if (reduce) { el.textContent = text; done(); return; }
        var chars = Array.from(text), i = 0; el.textContent = '';
        var cur = document.createElement('span'); cur.className = 'cur';
        function step() {
            i++; el.textContent = chars.slice(0, i).join(''); el.appendChild(cur);
            if (i < chars.length) later(step, /[,.!\\n]/.test(chars[i - 1]) ? 180 : 42); else { later(function () { cur.remove(); done(); }, 400); }
        }
        if (!chars.length) { done(); return; }
        step();
    }
    function play() {
        clearTimers(); stopFx();
        $('body').textContent = ''; $('sign').classList.remove('show');
        var env = $('env'), card = $('card'), ctas = $('ctas');
        env.hidden = false; env.classList.remove('open', 'gone'); card.hidden = true; card.classList.remove('show'); ctas.hidden = true; ctas.classList.remove('show');
        var opened = false;
        function open() {
            if (opened) return; opened = true;
            env.classList.add('open');
            later(function () { env.classList.add('gone'); }, reduce ? 0 : 1050);
            later(function () {
                env.hidden = true; card.hidden = false;
                requestAnimationFrame(function () { card.classList.add('show'); });
                later(startFx, reduce ? 0 : 450);
                later(function () {
                    typeText($('body'), D.message, function () {
                        $('sign').classList.add('show'); ctas.hidden = false;
                        requestAnimationFrame(function () { ctas.classList.add('show'); });
                    });
                }, reduce ? 0 : 1100);
            }, reduce ? 0 : 1400);
        }
        env.onclick = open;
        later(open, reduce ? 0 : 2600);     // 안 눌러도 저절로 열림
    }
    $('replay').onclick = play;
    window.addEventListener('resize', function () { if (raf) { size(); } });
    play();
})();
`;

function page(opts: { title: string; head: string; body: string }): string {
    return `<!DOCTYPE html>
<html lang="ko"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(opts.title)}</title>
${opts.head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONT_HREF}">
<style>${CSS}</style>
</head><body>
${opts.body}
</body></html>`;
}

/** 카드 페이지 HTML(순수 함수). imageBase 는 테스트·로컬 확인용(기본 '/eunbi/'). */
export function renderCardHtml(card: PublicCard, imageBase = '/eunbi/'): string {
    const occasion = safeOccasion(card.occasion);
    const o = OCC[occasion];
    const toName = String(card.toName ?? '');
    const fromName = String(card.fromName ?? '');
    const message = String(card.message ?? '');
    const id = String(card.id ?? '');
    const title = `💌 ${toName}에게 은비가 카드를 전해요`;
    const desc = `${fromName}님이 보낸 ${o.name} 카드 · 눌러서 열어 보세요`;
    const ogImage = `${SITE_ORIGIN}/eunbi/card_${occasion}.jpg`;
    const ogUrl = `${SITE_ORIGIN}/c/${encodeURIComponent(id)}`;
    const link = entryUrl(card.refCode);
    const head = `<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AI 놀이터">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(ogUrl)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="720">
<meta property="og:image:height" content="894">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">`;
    const body = `<main class="wrap">
    <section aria-label="은비가 전하는 카드">
        <div class="stage" id="stage" style="--tint:${o.tint}">
            <p class="from" id="fromLine"><b>${esc(fromName)}</b>님이 은비를 통해 카드를 보냈어요</p>
            <button type="button" class="env" id="env" aria-label="봉투 열기">
                <span class="back"></span><span class="peek"></span><span class="front"></span><span class="flap"></span>
                <span class="seal" aria-hidden="true">♥</span>
                <span class="tap">톡 눌러서 열어 봐 ♥</span>
            </button>
            <article class="card" id="card" hidden>
                <div class="art">
                    <div class="kb"><img id="artImg" src="${esc(imageBase)}card_${occasion}.jpg" alt="은비가 ${esc(o.name)} 카드를 건네는 그림" width="720" height="894"><canvas id="fx" aria-hidden="true"></canvas></div>
                    <span class="shine" aria-hidden="true"></span>
                    <span class="ribbon" id="ribbon">${esc(o.ribbon)}</span>
                </div>
                <div class="msg">
                    <p class="to" id="toLine">To. ${esc(toName)}</p>
                    <p class="body" id="body" aria-live="polite">${esc(message)}</p>
                    <p class="sign" id="sign">From. ${esc(fromName)} · 은비가 대신 전해요</p>
                </div>
            </article>
            <div class="ctas" id="ctas" hidden>
                <a class="btn primary" id="reply" href="${esc(link)}">은비랑 답장 카드 보내기</a>
                <a class="btn ghost" id="visit" href="${esc(link)}">나도 은비랑 놀러 가기</a>
                <p class="bonus">이 카드 링크로 가입하면 두 분 모두 +1,000P</p>
                <button type="button" class="replay" id="replay">처음부터 다시 보기</button>
            </div>
        </div>
    </section>
</main>
<script>var D = ${scriptJson({ occasion, message })};</script>
<script>${PLAYER_JS}</script>`;
    return page({ title, head, body });
}

/** 없는 카드·조회 실패 안내 페이지(순수 함수). */
export function renderNotFoundHtml(): string {
    const title = '카드를 찾을 수 없어요 — AI 놀이터';
    const body = `<main class="wrap">
    <section class="stage nf" aria-labelledby="nf-h">
        <h1 id="nf-h">카드를 찾을 수 없어요</h1>
        <p class="from">링크가 잘못되었거나 카드가 사라졌어요.<br>은비랑 직접 놀러 가 볼까요?</p>
        <a class="btn primary" href="${esc(EUNBI_ENTRY_URL)}">은비 만나러 가기</a>
    </section>
</main>`;
    return page({ title, head: '<meta name="robots" content="noindex">', body });
}

function sendNotFound(res: VercelResponse) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(404).send(renderNotFoundHtml());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const id = String(req.query.id || '').trim();
    if (!CARD_ID_RE.test(id)) return sendNotFound(res);
    try {
        const r = await fetch(`${PUBLIC_API}/${encodeURIComponent(id)}`);
        if (!r.ok) return sendNotFound(res);
        const card = await r.json() as PublicCard;
        if (!card || typeof card !== 'object' || !card.id) return sendNotFound(res);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        return res.status(200).send(renderCardHtml(card));
    } catch {
        return sendNotFound(res);
    }
}
