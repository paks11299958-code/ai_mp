'use strict';
// Fully intercepted browser regression: no live API, account, or database access.
// Run: node scripts/rentalfit-admin-save.test.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const site = path.resolve(__dirname, '../sites/rentalfit-v2');

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function fixture(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [], unexpected = [], writes = [];
  let gate;
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (url.origin !== 'https://rentalfit.test') {
      unexpected.push(request.url());
      return route.abort();
    }
    const json = body => route.fulfill({ json: body });
    if (pathname === '/api/rental/manage/login') return json({ ok: true });
    if (pathname === '/api/rental/manage/brands') {
      return json({ items: [{ brand_code: 'fixture', brand: '테스트 회사' }] });
    }
    if (pathname === '/api/rental/manage/products') {
      return json({ items: ['1', '2'].map(id => ({
        id, name: '테스트 제품 ' + id, model_code: 'TEST' + id, category: '정수기', on_sale: true,
      })) });
    }
    if (pathname === '/api/rental/manage/promotions' && request.method() === 'GET') {
      return json({ items: [{ id: 'promo1', product_id: '1', title: '테스트', copy: '기존 문구',
        starts_on: '2026-10-01', ends_on: '2026-10-31', enabled: true }] });
    }
    if (/^\/api\/rental\/manage\/promotions(?:\/promo[12])?$/.test(pathname) && gate) {
      const current = gate;
      gate = null;
      writes.push({ method: request.method(), body: request.postDataJSON() });
      current.started.resolve();
      const result = await current.result.promise;
      return route.fulfill(result);
    }
    const file = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    if (/^\/(admin|assets)\/[\w./-]+$/.test(file) && !file.includes('..')) {
      const contentType = file.endsWith('.js') ? 'application/javascript'
        : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html'
          : file.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream';
      return route.fulfill({ body: await fs.readFile(site + file), contentType });
    }
    unexpected.push(request.method() + ' ' + pathname);
    return route.abort();
  });
  await page.goto('https://rentalfit.test/admin/');
  await page.locator('[name=username]').fill('fixture-user');
  await page.locator('[name=password]').fill('fixture-only');
  await page.locator('#login-form button').click();
  await page.locator('#brand').selectOption('fixture');
  await page.locator('#products tr').nth(1).waitFor();
  return {
    page, context, errors, unexpected, writes,
    hold() {
      assert.ok(!gate);
      gate = { started: deferred(), result: deferred() };
      const current = gate;
      return {
        started: current.started.promise,
        finish(status = 200, body = { ok: true, id: 'promo2' }) {
          current.result.resolve({ status, json: body });
        },
      };
    },
  };
}

async function idle(page) {
  await page.waitForFunction(() => !document.querySelector('#manage-panel').hasAttribute('aria-busy'));
}

async function locked(row, expected) {
  assert.deepEqual(await row.locator('input,select,button').evaluateAll(
    controls => controls.map(control => control.disabled)), Array(6).fill(expected));
  assert.equal(await row.getAttribute('aria-busy'), expected ? 'true' : null);
}

async function scenarios(browser, width) {
  const f = await fixture(browser, width), { page } = f;
  try {
    const row = page.locator('tr[data-product="1"]'), other = page.locator('tr[data-product="2"]');
    const copy = row.locator('[name=copy]');

    // Saving one row protects the submitted value while other drafts and filters remain usable.
    await copy.fill('저장할 문구');
    let request = f.hold();
    await row.locator('[data-save]').click(); await request.started;
    await locked(row, true);
    assert.equal(await other.locator('[name=copy]').isEnabled(), true);
    await other.locator('[name=copy]').fill('다른 행의 초안');
    await page.locator('#filter-name').fill('제품 2');
    assert.equal(await row.isHidden(), true);
    request.finish(); await idle(page);
    await page.locator('#clear-filters').click();
    await locked(row, false);
    assert.equal(await copy.inputValue(), '저장할 문구');
    assert.equal(await other.locator('[name=copy]').inputValue(), '다른 행의 초안');
    assert.match(await page.locator('#product-count').textContent(), /저장 안 한 행 1개/);
    assert.equal(f.writes[0].body.copy, '저장할 문구');
    console.log(`PASS ${width}: save locks only target row; filters preserve other drafts`);

    // Rejected writes retain the draft and release controls for retry.
    await copy.fill('실패해도 보존할 문구');
    request = f.hold();
    await row.locator('[data-save]').click(); await request.started;
    await locked(row, true);
    request.finish(500, { error: '테스트 저장 실패' }); await idle(page);
    await locked(row, false);
    assert.equal(await copy.inputValue(), '실패해도 보존할 문구');
    assert.match(await row.locator('.row-status').textContent(), /테스트 저장 실패/);
    assert.match(await page.locator('#product-count').textContent(), /저장 안 한 행 2개/);
    request = f.hold();
    await row.locator('[data-save]').click(); await request.started;
    request.finish(); await idle(page);
    assert.match(await page.locator('#product-count').textContent(), /저장 안 한 행 1개/);
    console.log(`PASS ${width}: failed save preserves draft and permits retry`);

    // Validation happens before locking so focus can move to the invalid input.
    await copy.fill('');
    const before = f.writes.length;
    await row.locator('[data-save]').click(); await idle(page);
    await locked(row, false);
    assert.equal(f.writes.length, before);
    assert.equal(await copy.getAttribute('aria-invalid'), 'true');
    assert.equal(await copy.evaluate(el => el === document.activeElement), true);
    await copy.fill('삭제 전 문구');
    page.once('dialog', dialog => dialog.dismiss());
    await row.locator('[data-delete]').click(); await idle(page);
    await locked(row, false);
    assert.equal(f.writes.length, before);
    console.log(`PASS ${width}: invalid input receives focus; cancelled delete sends no request`);

    // Delete has the same race as save: a pending response must not erase new user input.
    page.once('dialog', dialog => dialog.accept());
    request = f.hold();
    await row.locator('[data-delete]').click(); await request.started;
    await locked(row, true);
    request.finish(500, { error: '테스트 삭제 실패' }); await idle(page);
    await locked(row, false);
    assert.equal(await copy.inputValue(), '삭제 전 문구');
    page.once('dialog', dialog => dialog.accept());
    request = f.hold();
    await row.locator('[data-delete]').click(); await request.started;
    await locked(row, true);
    request.finish(); await idle(page);
    await locked(row, false);
    assert.equal(await copy.inputValue(), '');
    assert.equal(await row.locator('[data-delete]').isHidden(), true);
    assert.match(await page.locator('#product-count').textContent(), /저장 안 한 행 1개/);
    console.log(`PASS ${width}: delete locks the row and restores controls on success/failure`);

    // New promotions share the protection; session expiry may detach the locked row safely.
    await other.locator('[name=starts_on]').fill('2026-10-01');
    await other.locator('[name=ends_on]').fill('2026-10-31');
    await other.locator('[name=enabled]').selectOption('true');
    request = f.hold();
    await other.locator('[data-save]').click(); await request.started;
    await locked(other, true);
    request.finish(); await idle(page);
    await locked(other, false);
    assert.equal(f.writes.at(-1).method, 'POST');
    assert.equal(await other.locator('[data-delete]').isVisible(), true);
    request = f.hold();
    await other.locator('[data-save]').click(); await request.started;
    request.finish(401, { error: '다시 로그인해 주세요.' }); await idle(page);
    assert.equal(await page.locator('#login-panel').isVisible(), true);
    assert.equal(await page.locator('#login-form button').isEnabled(), true);
    assert.equal(await page.locator('#products tr').count(), 0);
    assert.deepEqual(f.errors, []);
    assert.deepEqual(f.unexpected, []);
    console.log(`PASS ${width}: create and expired-session paths; no unexpected requests or JS errors`);
  } finally { await f.context.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 390, 1440]) await scenarios(browser, width);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
