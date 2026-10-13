// 렌탈핏 상담 도구 — 관리자 로그인 뒤 /api/admin/rental 로 조회한다(2026-10-13).
// ★가격·수수료는 이 파일에 없다. 전부 로그인한 관리자에게만 API 로 온다.
(() => {
  const $ = id => document.getElementById(id);
  const won = n => (n == null ? '-' : Number(n).toLocaleString('ko-KR') + '원');
  const state = { meta: null, category: '', brand: '', rows: [], total: 0, offset: 0, picked: new Map() };
  const PAGE = 60;

  const api = async (path, options) => {
    const res = await fetch(path, { credentials: 'same-origin', ...options });
    if (res.status === 401 || res.status === 403) { showLogin(res.status === 403 ? '관리자 계정만 사용할 수 있습니다.' : ''); throw new Error('auth'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '요청에 실패했습니다.');
    return res.json();
  };

  function showLogin(message) {
    $('tool').hidden = true; $('login').hidden = false; $('logout').hidden = true; $('feeSwitch').hidden = true; $('comparebar').hidden = true;
    $('loginError').textContent = message || '';
  }

  async function start() {
    try {
      state.meta = await api('/api/admin/rental/meta');
    } catch (e) { if (e.message !== 'auth') showLogin(e.message); return; }
    $('login').hidden = true; $('tool').hidden = false; $('logout').hidden = false; $('feeSwitch').hidden = false;
    renderMeta(); search(true);
  }

  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('loginError').textContent = '';
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: $('identifier').value.trim(), password: $('password').value }) });
      if (!res.ok) { $('loginError').textContent = (await res.json().catch(() => ({}))).error || '로그인하지 못했습니다.'; return; }
      $('password').value = ''; start();
    } catch { $('loginError').textContent = '서버에 연결하지 못했습니다.'; }
  });
  $('logout').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); showLogin(''); });

  function chips(box, items, key, allLabel) {
    box.textContent = '';
    const make = (value, label, count) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.value = value;
      b.setAttribute('aria-pressed', String(state[key] === value)); b.textContent = label;
      if (count != null) { const s = document.createElement('small'); s.textContent = count.toLocaleString('ko-KR'); b.append(s); }
      b.addEventListener('click', () => { state[key] = value; [...box.children].forEach(c => c.setAttribute('aria-pressed', String(c.dataset.value === value))); search(true); });
      box.append(b);
    };
    make('', allLabel, null);
    items.forEach(i => make(String(i.value), i.label || String(i.value), i.count));
  }
  function options(select, items, suffix) {
    select.length = 1;
    items.forEach(i => select.add(new Option(`${i.value}${suffix || ''} (${i.count.toLocaleString('ko-KR')})`, i.value)));
  }
  function renderMeta() {
    const m = state.meta;
    if (!m.yearMonth) { $('status').textContent = '아직 올린 정책 자료가 없습니다.'; return; }
    const info = m.months.find(x => x.year_month === m.yearMonth);
    $('status').textContent = `${m.yearMonth} 정책 · 조건 ${info ? info.row_count.toLocaleString('ko-KR') : '-'}줄 · 브랜드 ${m.brands.length}곳`;
    chips($('categories'), m.categories, 'category', '전체');
    chips($('brands'), m.brands, 'brand', '전체');
    options($('contract'), m.contracts, '개월'); options($('care'), m.careTypes); options($('customer'), m.customerTypes);
  }

  function query(offset) {
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset), sort: $('sort').value });
    if (state.category) p.set('category', state.category);
    if (state.brand) p.set('brand', state.brand);
    for (const [id, name] of [['contract', 'contract'], ['care', 'care'], ['customer', 'customer'], ['q', 'q']]) { const v = $(id).value.trim(); if (v) p.set(name, v); }
    const max = $('maxFee').value.replace(/[^\d]/g, ''); if (max) p.set('maxFee', max);
    if ($('changed').checked) p.set('changed', '1');
    if ($('noPromo').checked) p.set('promo', 'none');
    return p;
  }

  async function search(reset) {
    if (reset) { state.offset = 0; state.rows = []; }
    $('count').textContent = '찾는 중…';
    let data;
    try { data = await api('/api/admin/rental/search?' + query(state.offset)); }
    catch (e) { if (e.message !== 'auth') $('count').textContent = e.message; return; }
    state.total = data.total; state.rows = state.rows.concat(data.rows); state.offset = state.rows.length;
    $('count').textContent = data.total ? `${data.total.toLocaleString('ko-KR')}건 중 ${state.rows.length.toLocaleString('ko-KR')}건` : '조건에 맞는 것이 없습니다.';
    renderRows(reset ? state.rows : data.rows, reset);
    $('more').hidden = state.rows.length >= state.total;
  }

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const title = r => r.marketing_name || r.product;

  function renderRows(rows, reset) {
    const list = $('results'); if (reset) list.textContent = '';
    for (const r of rows) {
      const li = el('li', 'item');
      const head = el('div', 'item-head'); const left = el('div');
      left.append(el('h3', '', title(r)), el('p', 'meta', [r.brand, r.category, r.model_code && r.model_code !== title(r) ? r.model_code : ''].filter(Boolean).join(' · ')));
      const price = el('div', 'price');
      if (r.fee_normal && r.fee_normal > r.fee) price.append(el('s', '', won(r.fee_normal)));
      price.append(el('b', '', '월 ' + won(r.fee)), el('span', '', `${r.contract_months}개월 총 ${won(r.total_cost)}`));
      head.append(left, price);
      const tags = el('div', 'tags');
      const tag = (t, cls) => t && tags.append(el('span', 'tag' + (cls ? ' ' + cls : ''), t));
      tag(r.customer_type); tag(r.care_type); tag(r.visit_cycle_text ? '방문 ' + r.visit_cycle_text.replace(/\s+/g, '') : '');
      tag(r.ownership_months ? `소유권 ${r.ownership_months}개월` : ''); tag(r.rule ? '규정 ' + r.rule : ''); tag(r.promotion, 'promo'); tag(r.changed ? '이번 달 변동' : '', 'changed');
      const fee = el('p', 'fee fee-only', `수수료(VAT 제외) ${won(r.commission_total)}` + (r.commission_rate != null && Number(r.commission_rate) !== 1 ? ` · 수수료율 ${Math.round(Number(r.commission_rate) * 100)}%` : ''));
      const foot = el('div', 'item-foot');
      const pick = el('label', 'pick'); const box = document.createElement('input'); box.type = 'checkbox'; box.checked = state.picked.has(r.id);
      box.addEventListener('change', () => togglePick(r, box)); pick.append(box, document.createTextNode('비교에 담기'));
      const all = el('button', 'link', '이 제품의 모든 조건'); all.type = 'button'; all.addEventListener('click', () => showProduct(r));
      foot.append(pick, all);
      li.append(head, tags, fee, foot);
      if (r.spec || r.note) { const d = el('details', 'spec'); d.append(el('summary', '', '제품 사양·비고'), el('pre', '', [r.spec, r.note].filter(Boolean).join('\n\n'))); li.append(d); }
      list.append(li);
    }
  }

  function togglePick(r, box) {
    if (box.checked) { if (state.picked.size >= 4) { box.checked = false; alert('비교는 4개까지 담을 수 있습니다.'); return; } state.picked.set(r.id, r); }
    else state.picked.delete(r.id);
    $('comparebar').hidden = state.picked.size === 0; $('compareCount').textContent = `비교 ${state.picked.size}개`;
  }

  function table(rows, heading) {
    const t = $('compareTable'); t.textContent = '';
    const line = (label, get, opts = {}) => {
      const tr = el('tr', opts.cls || ''); const th = el('th', '', label); th.scope = 'row'; tr.append(th);
      const values = rows.map(get); const nums = opts.best ? values.map(Number).filter(n => !isNaN(n) && n > 0) : [];
      const best = nums.length > 1 ? Math[opts.best](...nums) : null;
      rows.forEach((r, i) => { const td = el('td', best != null && Number(values[i]) === best ? 'best' : '', opts.format ? opts.format(values[i]) : (values[i] || '-')); tr.append(td); });
      t.append(tr);
    };
    line('제품', r => title(r)); line('브랜드', r => r.brand); line('구분', r => r.customer_type); line('관리', r => r.care_type);
    line('방문주기', r => r.visit_cycle_text); line('프로모션', r => r.promotion);
    line('약정', r => r.contract_months, { format: v => v + '개월' }); line('소유권 이전', r => r.ownership_months, { format: v => (v ? v + '개월' : '-') });
    line('월 렌탈료', r => r.fee, { format: won, best: 'min' }); line('약정 총액', r => r.total_cost, { format: won, best: 'min' });
    line('수수료', r => r.commission_total, { format: won, best: 'max', cls: 'fee-only' });
    document.querySelector('#compare h2').textContent = heading;
    $('compare').showModal();
  }
  async function showProduct(r) {
    try {
      const data = await api('/api/admin/rental/product?' + new URLSearchParams({ brand: r.brand_code, product: r.product }));
      table(data.rows.slice(0, 40), `${title(r)} — 조건 ${data.rows.length}개`);
    } catch (e) { if (e.message !== 'auth') alert(e.message); }
  }

  $('filters').addEventListener('submit', e => { e.preventDefault(); search(true); });
  for (const id of ['contract', 'care', 'customer', 'sort', 'changed', 'noPromo']) $(id).addEventListener('change', () => search(true));
  $('reset').addEventListener('click', () => { $('filters').reset(); state.category = ''; state.brand = ''; renderMeta(); search(true); });
  $('more').addEventListener('click', () => search(false));
  $('showFee').addEventListener('change', e => { document.body.classList.toggle('show-fee', e.target.checked); if (!e.target.checked && $('sort').value === 'commission') { $('sort').value = 'fee'; search(true); } });
  $('openCompare').addEventListener('click', () => table([...state.picked.values()], '조건 비교'));
  $('clearCompare').addEventListener('click', () => { state.picked.clear(); $('comparebar').hidden = true; document.querySelectorAll('.pick input').forEach(i => { i.checked = false; }); });
  $('closeCompare').addEventListener('click', () => $('compare').close());

  start();
})();
