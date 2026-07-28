#!/usr/bin/env node
/**
 * 공유·초대 링크 전수 테스트 (2026-07-28 사장 지시).
 *
 * 마케팅 링크는 하나라도 깨지면 그 유입이 통째로 날아간다. 페르소나(?p=) 14개 +
 * 기능(?f=) 27개를 실제 브라우저로 하나씩 열어 "제대로 도착했는지" 확인한다.
 *
 * 판정 기준(모두 만족해야 통과):
 *   1) 페이지가 렌더된다(root 자식 > 0, 본문 길이 충분)
 *   2) 치명적 콘솔 에러가 없다(React #310, Cannot read 등)
 *   3) 도착 신호가 있다 — 안내 모달 / 전용 보드 / 퀵메뉴 입력창 중 하나
 *   ★"메인 화면에 그대로 남음"은 실패다. 실제로 그 버그가 있었다(보드형 17개).
 *
 * 사용:
 *   node scripts/test-all-links.cjs                    # 전체 41개
 *   node scripts/test-all-links.cjs --only=지우,윤채린   # 실패한 것만 재확인(이름/키 부분일치)
 *   node scripts/test-all-links.cjs --telegram         # 결과를 텔레그램으로
 *
 * ★수정 후에는 전체가 아니라 --only로 실패분만 돌릴 것(41개는 15~20분 걸린다).
 */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const BASE = process.env.TEST_BASE || 'https://aichat.dbzone.kr';
// ★테스트에서는 ?ref를 붙이지 않는다(2026-07-28 실측): ?ref가 있으면 App이 게스트 자동가입을
// 다시 시도하는데(arrivedViaReferral), 미리 심어둔 토큰이 반영되기 전이라 매번 새 계정을 만들려
// 들고 → IP 제한(10분 5개)에 걸리면 'failed'가 되어 가입 유도 화면이 뜬다. 그게 "렌더 실패"로
// 집계돼 실행할 때마다 실패 목록이 바뀌었다(1차 6건·2차 8건, 겹치는 건 2건뿐).
// 검사 대상은 "?p=/?f= 도착 처리"이므로 ref 없이도 동일하게 검증된다.
const REF = process.env.TEST_REF || '';
const SEND_TG = process.argv.includes('--telegram');
// --only=이름1,이름2 → 해당 대상만 검사(이름/키 부분일치). 수정 후 실패분만 빠르게 재확인.
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
    .split(',').map(s => s.trim()).filter(Boolean);
const matchOnly = (name, key) => !ONLY.length || ONLY.some(o => (name || '').includes(o) || (key || '').includes(o));

// 메인 화면에만 있는 문구 — 이게 보이면 딥링크가 도착하지 못한 것
const MAIN_MARKERS = ['오늘은 누구와', '오늘의 추천', '새로운 기능'];
const FATAL = /Minified React error|Cannot read|is not a function|is not defined/i;

async function fetchTargets() {
    const res = await fetch(`${BASE}/api/personas`);
    const personas = (await res.json()).filter(p => p.isVisible !== false);
    // FEATURES_GRID는 번들에만 있으므로 소스에서 추출
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../frontend/components/MainPageNew.tsx'), 'utf8');
    const s = src.indexOf('export const FEATURES_GRID');
    const e = src.indexOf('\n];', s);
    const features = src.slice(s, e).split('\n').filter(l => l.includes('key:')).map(l => ({
        key: (l.match(/key:\s*'([^']+)'/) || [])[1],
        name: (l.match(/name:\s*'([^']+)'/) || [])[1],
        persona: (l.match(/personaName:\s*'([^']+)'/) || [])[1],
    })).filter(f => f.key);
    return { personas, features };
}

/**
 * ★게스트 계정을 매번 만들면 안 된다(2026-07-28 실측): guest-register는 IP당 10분에 5개
 * 제한이라, 41개를 연속으로 열면 6번째부터 429로 막혀 로그인이 안 되고 화면이 렌더되지
 * 않는다 → "38개 렌더 실패"라는 가짜 결과가 나왔다(실제 사이트는 정상이었다).
 * 토큰 하나를 만들어 모든 케이스에서 재사용한다.
 */
async function issueToken() {
    if (process.env.TEST_TOKEN) return process.env.TEST_TOKEN;
    const r = await fetch(`${BASE}/api/auth/guest-register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!r.ok) throw new Error(`게스트 토큰 발급 실패(${r.status}) — IP 제한일 수 있습니다. 10분 뒤 재시도하거나 TEST_TOKEN 환경변수로 직접 주세요.`);
    return (await r.json()).token;
}

async function testOne(browser, url, label, token) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    // 미리 발급한 토큰을 심어 ?ref로 인한 게스트 자동생성을 건너뛴다
    if (token) await page.addInitScript(t => localStorage.setItem('token', t), token);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 120)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

    let info = { rootChildren: -1, bodyLen: 0, text: '' };
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(7000);
        // 체험 회원 환영 모달 닫기 — ★모달이 2겹일 수 있다(환영 → 기능 안내).
        // 한 번만 닫으면 환영 모달 상태에서 판정해 "렌더 실패" 오탐이 난다(2026-07-28 실측).
        for (let i = 0; i < 2; i++) {
            const btn = page.locator('button', { hasText: /시작하기|시작$/ }).first();
            if (await btn.count() === 0) break;
            await btn.click().catch(() => {});
            await page.waitForTimeout(2500);
        }
        info = await page.evaluate(() => ({
            rootChildren: document.getElementById('root')?.children.length ?? -1,
            bodyLen: document.body.innerText.trim().length,
            text: document.body.innerText.slice(0, 1200),
            ph: (document.querySelector('textarea') || {}).placeholder || '',
            hasModal: !!document.querySelector('div[class*="z-[85]"]'),
        }));
    } catch (e) {
        errors.push('NAV: ' + String(e.message).slice(0, 100));
    }
    await ctx.close();

    const fatal = errors.filter(e => FATAL.test(e));
    // ★본문 길이 기준을 200→80으로(2026-07-28 실측): 안내 모달만 떠 있는 화면은 본문이
    // 206~289자로 짧아 200 기준에 아슬아슬하게 걸려 정상인 페르소나 5개가 "렌더 실패"로
    // 잡혔다. 백지(React #310)는 본문이 0자라 80이면 충분히 걸러진다.
    const rendered = info.rootChildren > 0 && info.bodyLen > 80;
    // 도착 신호: 안내 모달 / 퀵메뉴 입력창 안내 / 메인 화면 아님
    const onMain = MAIN_MARKERS.some(m => (info.text || '').includes(m));
    const arrived = info.hasModal || (info.ph && info.ph.length > 8) || !onMain;

    const ok = rendered && !fatal.length && arrived;
    return {
        label, url, ok,
        reason: !rendered ? '렌더 실패' : fatal.length ? ('치명 에러: ' + fatal[0]) : !arrived ? '메인에 머무름(도착 실패)' : '',
    };
}

(async () => {
    const { personas, features } = await fetchTargets();
    const selP = personas.filter(x => matchOnly(x.name, x.id));
    const selF = features.filter(x => matchOnly(x.name, x.key));
    console.log(ONLY.length
        ? `선택 검사(--only=${ONLY.join(',')}): 페르소나 ${selP.length} + 기능 ${selF.length} = ${selP.length + selF.length}개\n`
        : `대상: 페르소나 ${personas.length} + 기능 ${features.length} = ${personas.length + features.length}개\n`);

    const token = await issueToken();
    console.log('게스트 토큰 1개로 전체 케이스를 검사합니다(IP 제한 회피).\n');
    const browser = await chromium.launch();
    const results = [];

    for (const p of personas.filter(x => matchOnly(x.name, x.id))) {
        const r = await testOne(browser, `${BASE}/?p=${p.id}${REF ? `&ref=${REF}` : ''}`, `[P] ${p.name}`, token);
        results.push(r);
        console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.reason ? ' — ' + r.reason : ''}`);
    }
    for (const f of features.filter(x => matchOnly(x.name, x.key))) {
        const r = await testOne(browser, `${BASE}/?f=${f.key}${REF ? `&ref=${REF}` : ''}`, `[F] ${f.name}(${f.key})`, token);
        results.push(r);
        console.log(`${r.ok ? '✅' : '❌'} ${r.label}${r.reason ? ' — ' + r.reason : ''}`);
    }
    await browser.close();

    const fail = results.filter(r => !r.ok);
    const summary = [
        `*🔗 공유링크 전수 테스트* (${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})`,
        ``,
        `대상: *${results.length}개*${ONLY.length ? ` (선택: ${ONLY.join(',')})` : ` (페르소나 ${personas.length} + 기능 ${features.length})`}`,
        `결과: 정상 *${results.length - fail.length}* / 실패 *${fail.length}*`,
        ``,
    ];
    if (fail.length) {
        summary.push(`*❌ 실패 목록*`);
        fail.forEach(r => summary.push(`• ${r.label} — ${r.reason}`));
    } else {
        summary.push(`✅ 전부 정상 도착했습니다.`);
    }
    const msg = summary.join('\n');
    console.log('\n' + msg);

    require('fs').writeFileSync('/tmp/_linktest.txt', msg);
    if (SEND_TG) {
        try {
            execFileSync('/home/paks11299958/rag-env/bin/python', ['-c',
                "import sys; sys.path.insert(0,'/home/paks11299958/rag')\n" +
                "from telegram_utils import tg_send\n" +
                "tg_send(open('/tmp/_linktest.txt', encoding='utf-8').read())",
            ], { cwd: '/home/paks11299958/rag' });
            console.log('\n텔레그램 전송 완료');
        } catch (e) {
            console.error('텔레그램 전송 실패:', e.message);
        }
    }
    process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
