// 렌탈핏 맞춤 찾기 — /api/rental 의 손님용 추천을 부른다(2026-10-13).
// ★응답에는 정확한 금액이 없고 "월 N만 원대부터"만 온다. 수수료는 이 경로에 존재하지 않는다.
(() => {
  const $ = id => document.getElementById(id);
  const picked = { category: '', care: '', budget: '', term: '' };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function wire(group) {
    $(group).addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      picked[group] = chip.dataset.value;
      [...$(group).children].forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      $('go').disabled = !picked.category;
    });
  }
  ['category', 'care', 'budget', 'term'].forEach(wire);
  const chip = (box, value, label) => { const b = el('button', 'chip', label); b.type = 'button'; b.dataset.value = value; b.setAttribute('aria-pressed', 'false'); box.append(b); };

  async function load() {
    try {
      const res = await fetch('/api/rental/options'); if (!res.ok) throw new Error();
      const data = await res.json();
      data.categories.forEach(c => chip($('category'), c.value, c.value));
      data.budgets.forEach(b => chip($('budget'), String(b), `${b / 10000}만 원 이하`));
      if (!data.categories.length) $('category').append(el('p', 'empty', '지금은 보여 드릴 제품이 없습니다.'));
    } catch { $('category').append(el('p', 'empty', '목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.')); }
  }

  $('ask').addEventListener('submit', async e => {
    e.preventDefault(); if (!picked.category) return;
    const params = new URLSearchParams(Object.entries(picked).filter(([, v]) => v));
    $('go').disabled = true; $('go').textContent = '찾는 중…';
    let data = null;
    try { const res = await fetch('/api/rental/recommend?' + params); data = res.ok ? await res.json() : null; } catch { /* 아래에서 안내 */ }
    $('go').disabled = false; $('go').textContent = '맞는 제품 찾기';
    const list = $('cards'); list.textContent = ''; $('result').hidden = false;
    if (!data) { $('resultTitle').textContent = '추천을 불러오지 못했습니다'; $('notice').textContent = '잠시 후 다시 시도해 주세요.'; return; }
    if (!data.items.length) {
      $('resultTitle').textContent = '조건에 꼭 맞는 제품이 없어요';
      $('notice').textContent = '예산이나 약정 기간을 "상관없어요"로 바꾸면 더 많이 찾을 수 있어요.'; return;
    }
    $('resultTitle').textContent = `${data.category} 추천 ${data.items.length}개`;
    data.items.forEach((item, i) => {
      const li = el('li', 'pick'); li.append(el('span', 'rank', String(i + 1)), el('p', 'brandname', item.brand), el('h3', '', item.title), el('p', 'band', item.feeBandLabel));
      const tags = el('div', 'tags');
      if (item.contracts.length) tags.append(el('span', 'tag', '약정 ' + (item.contracts.length > 1 ? `${item.contracts[0]}~${item.contracts[item.contracts.length - 1]}개월` : `${item.contracts[0]}개월`)));
      item.careTypes.forEach(c => tags.append(el('span', 'tag', c)));
      if (item.hasPromotion) tags.append(el('span', 'tag promo', '이번 달 프로모션'));
      li.append(tags);
      if (item.reasons.length) { const why = el('ul', 'why'); item.reasons.forEach(r => why.append(el('li', '', r))); li.append(why); }
      if (item.spec) li.append(el('p', 'spec', item.spec));
      list.append(li);
    });
    $('notice').textContent = data.notice;
    $('result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  });

  load();
})();
