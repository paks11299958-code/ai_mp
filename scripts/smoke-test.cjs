#!/usr/bin/env node
/**
 * 배포 스모크 테스트 — 실제 브라우저로 화면이 뜨는지 확인한다.
 *
 * 배경(2026-07-28 실사고): 훅 순서 실수로 앱 전체가 백지가 됐는데 tsc·빌드는 모두 통과해
 * 배포됐고, 사장이 "어드민 페이지가 안 열린다"고 알려줘서 발견했다. 정적 검사로 잡을 수
 * 있는 건 check-react-safety.cjs가 맡고, **잡을 수 없는 런타임 오류는 이 테스트가 맡는다.**
 *
 * 사용:
 *   node scripts/smoke-test.cjs                      # 운영(aichat.dbzone.kr)
 *   node scripts/smoke-test.cjs http://127.0.0.1:4173 # 로컬 프리뷰
 *   TOKENS='admin=eyJ...,user=eyJ...' node scripts/smoke-test.cjs  # 로그인 상태까지
 *
 * 판정: root에 자식이 없거나 / 본문이 비었거나 / pageerror가 나면 실패(exit 1).
 *
 * ★반드시 **배포 후 운영 URL**에 대고 돌릴 것. 로컬 프리뷰(vite preview)는 API 프록시가
 *   없어 토큰을 심어도 로그인 상태가 되지 않는다 — 실제로 2026-07-28 사고 코드를 로컬
 *   프리뷰로 검사했을 때 "정상"으로 통과했다(본문 길이가 비로그인과 동일한 게 신호).
 *   그 사고는 로그인 상태에서만 터졌으므로, 운영에 TOKENS를 주고 돌려야만 잡힌다.
 */
const BASE = process.argv[2] || 'https://aichat.dbzone.kr';
const MIN_BODY_LEN = 200;

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('❌ playwright 없음 — npm i -D playwright 후 실행하세요'); process.exit(1); }

// 검사할 시나리오: 라벨 → 토큰(없으면 비로그인)
const scenarios = [{ label: '비로그인', token: null }];
if (process.env.TOKENS) {
    for (const pair of process.env.TOKENS.split(',')) {
        const [label, token] = pair.split('=');
        if (label && token) scenarios.push({ label: label.trim(), token: token.trim() });
    }
}

(async () => {
    const browser = await chromium.launch();
    let failed = 0;

    for (const sc of scenarios) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        const pageErrors = [];
        const httpErrors = [];

        page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
        page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 200)); });
        page.on('response', r => { if (r.status() >= 500) httpErrors.push(`${r.status()} ${r.url().slice(0, 100)}`); });

        if (sc.token) await page.addInitScript(t => localStorage.setItem('token', t), sc.token);

        // 배포 직후엔 엣지 캐시 전파 중이라 빈 화면이 잡힐 수 있다(2026-07-28 실제 오탐 1회).
        // 진짜 백지는 몇 번을 해도 백지이므로, 성공할 때까지 최대 3회 재시도한다.
        let info = { rootChildren: -1, bodyLen: 0 };
        for (let attempt = 1; attempt <= 3; attempt++) {
            pageErrors.length = 0;
            try {
                await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
                await page.waitForTimeout(3500);
                info = await page.evaluate(() => ({
                    rootChildren: document.getElementById('root')?.children.length ?? -1,
                    bodyLen: document.body.innerText.trim().length,
                }));
            } catch (e) {
                pageErrors.push('NAVIGATION: ' + String(e.message).slice(0, 150));
            }
            if (info.rootChildren > 0 && info.bodyLen >= MIN_BODY_LEN) break;
            if (attempt < 3) { console.log(`   (${sc.label}: ${attempt}차 빈 화면 → 재시도)`); await page.waitForTimeout(5000); }
        }

        // React #310 등 렌더 자체가 죽은 경우를 확실히 잡는다
        const renderDead = info.rootChildren <= 0 || info.bodyLen < MIN_BODY_LEN;
        const fatal = pageErrors.filter(e => /Minified React error|Cannot read|is not a function|is not defined/i.test(e));
        const ok = !renderDead && !fatal.length;

        if (ok) {
            console.log(`✅ ${sc.label}: 렌더 정상 (root 자식 ${info.rootChildren}, 본문 ${info.bodyLen}자)`);
        } else {
            failed++;
            console.error(`\n❌ ${sc.label}: 화면이 정상 렌더되지 않았습니다`);
            console.error(`   root 자식 ${info.rootChildren} / 본문 ${info.bodyLen}자`);
            fatal.slice(0, 5).forEach(e => console.error(`   치명적: ${e}`));
            httpErrors.slice(0, 3).forEach(e => console.error(`   5xx: ${e}`));
        }
        await ctx.close();
    }

    await browser.close();
    console.log(`\n${failed ? '실패 ' + failed + '건' : '전체 통과'} (대상: ${BASE})`);
    process.exit(failed ? 1 : 0);
})().catch(e => { console.error('SMOKE_ERR', e.message); process.exit(1); });
