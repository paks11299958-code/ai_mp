// 포인트 넛지 3종 재현 — 빌드 번들(dist)을 띄우고 /api 를 전부 목으로 응답한다(운영 DB·API 무접촉).
const { chromium } = require('/home/paks11299958/ai_mp/node_modules/playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const OUT = '/home/paks11299958/ai_mp/artifacts/point-nudges';
const PERSONA = { id: 'p1', name: '테스트봇', description: '테스트용', iconName: 'Bot', systemInstruction: '', colorClass: 'bg-purple-500', isVisible: true, order: 1 };

function mkUser(o) {
  return { id: o.id ?? 777, email: 't@t.kr', username: '테스터', role: o.role ?? 'USER', provider: o.provider ?? 'local',
           paidPoints: 0, bonusPoints: o.balance, personaXp: { p1: o.xp ?? 0 } };
}

async function setup(browser, sc, { keepStorageFrom } = {}) {
  const ctx = keepStorageFrom || await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = { balance: sc.balance, xp: sc.xp ?? 0, nextPost: sc.nextPost || [] };
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()); const p = url.pathname; const m = route.request().method();
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/api/auth/me') return json({ user: mkUser({ ...sc, balance: state.balance, xp: state.xp }) });
    if (p === '/api/personas') return json([PERSONA]);
    if (p === '/api/points/balance' || p === '/api/points') return json({ paidPoints: 0, bonusPoints: state.balance, points: state.balance, transactions: [] });
    if (p === '/api/sessions' && m === 'GET') return json({ sessions: [], firstChatMap: {} });
    if (p === '/api/sessions' && m === 'POST') return json({ id: 55, personaId: 'p1', title: 't' });
    if (/\/api\/sessions\/\d+\/messages$/.test(p) && m === 'POST') {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.role !== 'user') return json({ id: Date.now() }, 201);
      const step = state.nextPost.shift() || {};
      if (step.status === 402) return json({ error: 'INSUFFICIENT_POINTS', required: 100, balance: state.balance, shortfall: 100 - state.balance }, 402);
      if (typeof step.balance === 'number') state.balance = step.balance;
      if (typeof step.xp === 'number') state.xp = step.xp; else state.xp += 1;
      return json({ id: Date.now(), role: 'user', text: body.text, personaId: 'p1', xp: state.xp,
        points: { balance: state.balance, paidBalance: 0, bonusBalance: state.balance, cost: 0, leveledUp: false, newStage: 0, levelupBonus: 0 } }, 201);
    }
    if (/\/api\/sessions\/\d+\/messages/.test(p)) return json({ messages: [], hasMore: false });
    if (/\/api\/sessions\/\d+\/greet$/.test(p)) return json({ skipped: true });
    if (p === '/api/chat-stream') return route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'data: {"text":"안녕하세요!"}\n\ndata: {"done":true,"fullText":"안녕하세요!"}\n\n' });
    return json({ error: 'mock-404' }, 404);
  });
  // personas_cache 가 있으면 로그인 확인 전에 딥링크가 처리돼 비로그인 인트로로 빠진다 → 매번 지운다
  await page.addInitScript(() => { localStorage.setItem('token', 'mock-token'); localStorage.removeItem('personas_cache'); });
  return { ctx, page, errors, state };
}

async function openChat(page) {
  await page.goto(BASE + '/?p=p1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // 페르소나 진입 시트의 '대화 시작' 계열 버튼을 누른다(있으면)
  for (let i = 0; i < 4; i++) {
    if (await page.locator('textarea:visible').count()) break;
    const btn = page.getByText('테스트봇과 대화하기').first();
    if (await btn.count()) { await btn.click().catch(() => {}); await page.waitForTimeout(1200); } else break;
  }
  try { await page.locator('textarea:visible').first().waitFor({ timeout: 10000 }); }
  catch (e) { await page.screenshot({ path: '/tmp/claude-1000/-home-paks11299958-ai-mp/95e589fd-584d-40e4-acaf-1dfe215999c6/scratchpad/dbg_fail.png' }); throw e; }
}
async function send(page, text) {
  const ta = page.locator('textarea:visible').first();
  await ta.fill(text);
  await ta.press('Enter');
  await page.waitForTimeout(1500);
}
const visible = async (page, id) => (await page.locator(`[data-testid="${id}"]`).count()) > 0;

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const log = (k, v) => { results.push([k, v]); console.log(k, v); };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  // ── 0. 백지 확인(빌드 번들) ──
  {
    const { page, errors } = await setup(browser, { balance: 5000 }, { keepStorageFrom: ctx });
    await page.goto(BASE, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
    const rootKids = await page.evaluate(() => document.getElementById('root')?.children.length || 0);
    const len = await page.evaluate(() => document.body.innerText.length);
    await page.screenshot({ path: `${OUT}/00_main_render.png` });
    log('00 메인 렌더(rootChildren, bodyLen, pageErrors)', [rootKids, len, errors]);
    await page.close();
  }

  // ── A. 소진 임박: 5000 → 250 ──
  {
    const { page, errors } = await setup(browser, { balance: 5000, xp: 0, nextPost: [{ balance: 250 }, { balance: 200 }] }, { keepStorageFrom: ctx });
    await openChat(page);
    await page.screenshot({ path: `${OUT}/A0_chat_before.png` });
    await send(page, '첫 메시지');
    const a1 = await visible(page, 'point-nudge-low');
    await page.screenshot({ path: `${OUT}/A1_low_balance_popup.png` });
    log('A1 5000→250 첫 하락: 팝업', a1);
    if (a1) await page.getByRole('button', { name: '나중에' }).click();
    await send(page, '두 번째 메시지');
    log('A2 같은 세션 250→200: 팝업(기대 false)', await visible(page, 'point-nudge-low'));
    log('A pageErrors', errors); await page.close();
  }
  // 같은 사용자, 재접속 후 다시 임계 하락(900→250) — 재무장 전이라 안 떠야 함
  {
    const { page } = await setup(browser, { balance: 900, xp: 0, nextPost: [{ balance: 250 }] }, { keepStorageFrom: ctx });
    await openChat(page); await send(page, '재접속 후 메시지');
    log('A3 재접속 900→250(충전 없음): 팝업(기대 false)', await visible(page, 'point-nudge-low'));
    await page.screenshot({ path: `${OUT}/A3_low_second_time_none.png` });
    await page.close();
  }
  // 충전으로 재무장(5000 로드) 후 다시 하락 — 다시 떠야 함 + '충전하기' → 기존 충전 모달
  {
    const { page } = await setup(browser, { balance: 5000, xp: 0, nextPost: [{ balance: 100 }] }, { keepStorageFrom: ctx });
    await openChat(page); await send(page, '충전 후 메시지');
    const a4 = await visible(page, 'point-nudge-low');
    log('A4 충전(5000) 뒤 재하락: 재노출(기대 true)', a4);
    if (a4) { await page.getByRole('button', { name: '충전하기' }).click(); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/A4_charge_click_opens_point_modal.png` });
    log('A4 충전하기 → PointModal(포인트 충전) 열림', await page.getByText('포인트 충전', { exact: true }).count() > 0);
    await page.close();
  }

  // ── C. 대화 횟수 9 → 10 ──
  {
    const { page, errors } = await setup(browser, { balance: 5000, xp: 9, nextPost: [{}, {}] }, { keepStorageFrom: ctx });
    await openChat(page); await send(page, '열 번째 대화');
    const c1 = await visible(page, 'point-nudge-milestone');
    await page.screenshot({ path: `${OUT}/C1_milestone_10_popup.png` });
    log('C1 누적 9→10: 팝업', c1);
    if (c1) await page.getByRole('button', { name: '계속 대화하기' }).click();
    await send(page, '열한 번째');
    log('C2 10→11: 팝업(기대 false)', await visible(page, 'point-nudge-milestone'));
    log('C pageErrors', errors); await page.close();
  }
  {
    const { page } = await setup(browser, { balance: 5000, xp: 9, nextPost: [{}] }, { keepStorageFrom: ctx });
    await openChat(page); await send(page, '같은 조건 재현');
    log('C3 같은 조건(9→10) 재접속: 팝업(기대 false)', await visible(page, 'point-nudge-milestone'));
    await page.screenshot({ path: `${OUT}/C3_milestone_second_time_none.png` });
    await page.close();
  }

  // ── B. 잔액 부족(402) — 입력 보존 ──
  {
    const { page, errors } = await setup(browser, { balance: 50, xp: 0, nextPost: [{ status: 402 }] }, { keepStorageFrom: ctx });
    await openChat(page);
    const TEXT = '포인트 부족 때 보낸 소중한 긴 메시지입니다';
    await send(page, TEXT);
    const modal = await page.getByText('포인트가 부족해요').count() > 0;
    const reassure = await visible(page, 'insufficient-reassure');
    await page.screenshot({ path: `${OUT}/B1_insufficient_popup.png` });
    log('B1 402: PointModal(포인트가 부족해요) + 안심문구', [modal, reassure]);
    // 모달 닫고 입력창 확인
    await page.mouse.click(10, 10); await page.waitForTimeout(500);
    const val = await page.locator('textarea:visible').first().inputValue();
    const bubble = await page.getByText(TEXT).count();
    await page.screenshot({ path: `${OUT}/B2_input_preserved.png` });
    log('B2 입력창 복원(값 일치), 미전송 말풍선 수(기대 0)', [val === TEXT, bubble - (val === TEXT ? 0 : 0)]);
    log('B pageErrors', errors); await page.close();
    // 결제창 이동을 흉내 낸 재진입(새로고침) — 입력 복원
    const { page: p2 } = await setup(browser, { balance: 5000, xp: 0 }, { keepStorageFrom: ctx });
    await openChat(p2);
    const val2 = await p2.locator('textarea:visible').first().inputValue();
    await p2.screenshot({ path: `${OUT}/B3_draft_restored_after_reload.png` });
    log('B3 충전 후 재진입: 입력창 복원', val2 === TEXT);
    await p2.close();
  }

  // ── 체험계정(guest) A → 회원가입 모달 ──
  {
    const { page } = await setup(browser, { id: 888, provider: 'guest', balance: 1000, xp: 0, nextPost: [{ balance: 200 }] }, { keepStorageFrom: ctx });
    await openChat(page); await send(page, '체험 메시지');
    const g = await visible(page, 'point-nudge-low');
    await page.screenshot({ path: `${OUT}/G1_guest_low_popup.png` });
    log('G1 체험 A 팝업', g);
    if (g) { await page.getByRole('button', { name: '회원가입하기' }).click(); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/G2_guest_signup_modal.png` });
    log('G2 회원가입하기 → GuestUpgradeModal(넛지 문구)', await page.getByText('가입하고 계속 이용하세요').count() > 0);
    await page.close();
  }
  // ── 어드민: A·C 모두 미노출 ──
  {
    const { page } = await setup(browser, { id: 999, role: 'ADMIN', balance: 5000, xp: 9, nextPost: [{ balance: 100 }] }, { keepStorageFrom: ctx });
    await openChat(page).catch(() => {});
    if (await page.locator('textarea').count()) await send(page, '어드민 메시지');
    log('AD 어드민 A/C 팝업(기대 false,false)', [await visible(page, 'point-nudge-low'), await visible(page, 'point-nudge-milestone')]);
    await page.close();
  }
  await browser.close();
  require('fs').writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
})().catch(e => { console.error('SCRIPT FAIL', e); process.exit(1); });
