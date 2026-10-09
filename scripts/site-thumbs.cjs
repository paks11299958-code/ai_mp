#!/usr/bin/env node
/**
 * 독립사이트 썸네일 만들기 — 어드민 「독립사이트 관리」 카드에 쓰는 화면 캡처(2026-10-09 사장 지시
 * "텍스트로 보이니까 뭔지 모르겠음, 썸네일로 볼 수 있게").
 *
 * 사용:  node scripts/site-thumbs.cjs [사이트명 ...]        (생략하면 sites/README.md 의 전체)
 *   - 공개 사이트(/sites/*, https://*) → sites/_thumbs/<name>.webp  (커밋하면 Vercel 로 공개)
 *   - 비공개 사이트(/api/admin/private-sites/*) → ADMIN_TOKEN 이 있을 때만 찍어 PRIVATE_OUT/<name>/thumb.webp 에 둔다.
 *     ★비공개 썸네일은 ai_mp 에 커밋하지 않는다(ai_mp 는 공개 저장소) — 서버1 ~/private-sites/<name>/thumb.webp 로 복사.
 * 영상 히어로가 있는 사이트는 영상이 끝난 장면(최대 20초 대기)을 찍는다.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.SITE_BASE || 'https://aichat.dbzone.kr';
const OUT = path.join(ROOT, 'sites', '_thumbs');
const PRIVATE_OUT = process.env.PRIVATE_OUT || path.join(require('os').tmpdir(), 'private-site-thumbs');
const PRIVATE = /^\/api\/admin\/private-sites\//;

function readSites() {
    const md = fs.readFileSync(path.join(ROOT, 'sites', 'README.md'), 'utf8');
    return md.split('\n').map(l => l.split('|').slice(1, -1).map(c => c.trim()))
        .filter(c => c.length === 3 && c[0] !== '프로젝트명' && /^(\/sites\/|\/api\/admin\/private-sites\/|https:\/\/)/.test(c[1]))
        .map(([name, url]) => ({ name, url }));
}

(async () => {
    const only = process.argv.slice(2);
    const sites = readSites().filter(s => !only.length || only.includes(s.name));
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch();
    const results = [];
    for (const s of sites) {
        const isPrivate = PRIVATE.test(s.url);
        if (isPrivate && !process.env.ADMIN_TOKEN) { results.push(`${s.name}: 건너뜀(비공개 — ADMIN_TOKEN 필요)`); continue; }
        const url = /^https?:/.test(s.url) ? s.url : BASE + s.url;
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
        if (isPrivate) {
            await ctx.addCookies([{ name: 'token', value: process.env.ADMIN_TOKEN, domain: new URL(BASE).hostname, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
        }
        const page = await ctx.newPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 45000 }));
            await page.waitForTimeout(2500);
            // 첫 화면 팝업(상담 창 등)이 사이트를 가리면 무엇인지 알 수 없다 — 닫기 버튼을 누르고 Esc.
            await page.evaluate(() => {
                const closers = [...document.querySelectorAll('button, [role=button], a')].filter(el => {
                    const t = ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).trim();
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.width < 80 && /^(닫기|close|×|✕|x)$/i.test(t.replace(/\s+/g, ' ').trim());
                });
                closers.forEach(el => el.click());
            }).catch(() => {});
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(800);
            // 영상 히어로면 끝 장면까지 기다린다(포스터·첫 장면보다 무엇을 하는 사이트인지 잘 보인다).
            const dur = await page.evaluate(() => { const v = document.querySelector('video'); return v && isFinite(v.duration) ? v.duration - v.currentTime : 0; });
            if (dur > 0) await page.waitForTimeout(Math.min(dur + 1.5, 20) * 1000);
            const png = await page.screenshot({ type: 'png' });
            const outFile = isPrivate ? path.join(PRIVATE_OUT, s.name, 'thumb.webp') : path.join(OUT, `${s.name}.webp`);
            fs.mkdirSync(path.dirname(outFile), { recursive: true });
            await sharp(png).resize(640, 400).webp({ quality: 72 }).toFile(outFile);
            results.push(`${s.name}: ${path.relative(ROOT, outFile)} (${fs.statSync(outFile).size}B)`);
        } catch (e) {
            results.push(`${s.name}: 실패 — ${String(e.message || e).slice(0, 120)}`);
        } finally { await ctx.close(); }
    }
    await browser.close();
    console.log(results.join('\n'));
})();
