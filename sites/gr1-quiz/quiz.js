// GR1 촬영법 OX 퀴즈 — 2026-10-15. 사진·정답은 서버(/api/quiz, quizdb)에서만 온다. 이 파일에는 문제·정답이 없다.
(() => {
  const $ = id => document.getElementById(id);
  const API = '/api/quiz';
  const state = { ids: [], index: 0, results: [], mode: 'all', wrongPool: [], busy: false };

  const show = id => { for (const s of ['login', 'start', 'quiz', 'result', 'bye']) $(s).hidden = s !== id; window.scrollTo(0, 0); };
  const api = async (path, body) => {
    const res = await fetch(API + path, body === undefined ? { credentials: 'same-origin' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.status === 401) { show('login'); throw new Error('auth'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || '잠시 후 다시 시도해 주세요.');
    return data;
  };
  const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const imageUrl = id => `${API}/image/${id}`;

  // 로그인
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('loginError').textContent = '';
    try { await api('/login', { id: $('userId').value.trim() }); await toStart(); }
    catch (err) { if (err.message !== 'auth') $('loginError').textContent = err.message; else $('loginError').textContent = '아이디를 확인해 주세요.'; }
  });
  $('logoutBtn').addEventListener('click', async () => { await fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {}); $('userId').value = ''; show('login'); });

  async function toStart() {
    const data = await api('/questions');
    state.allIds = data.ids;
    $('totalInfo').textContent = `전체 ${data.total}문제 · 무작위로 한 번씩`;
    show('start');
  }
  $('startBtn').addEventListener('click', () => begin(state.allIds, 'all'));

  // 문제 진행
  function begin(ids, mode) {
    state.ids = shuffle(ids); state.index = 0; state.results = []; state.mode = mode;
    if (!state.ids.length) return finish();
    show('quiz'); render();
  }
  function render() {
    const total = state.ids.length, n = state.index + 1;
    $('progress').textContent = `${n} / ${total}`;
    $('progressBar').style.width = `${(state.index / total) * 100}%`;
    const o = state.results.filter(r => r.correct).length;
    $('score').textContent = `O ${o} · X ${state.results.length - o}`;
    $('photoLoading').hidden = false; $('photo').style.visibility = 'hidden';
    $('photo').src = imageUrl(state.ids[state.index]);
    $('answer').value = ''; $('submitBtn').disabled = false;
    setTimeout(() => $('answer').focus(), 50);
    const next = state.ids[state.index + 1];
    if (next) { const pre = new Image(); pre.src = imageUrl(next); }   // 다음 사진 미리 받기
  }
  $('photo').addEventListener('load', () => { $('photoLoading').hidden = true; $('photo').style.visibility = 'visible'; });
  $('photo').addEventListener('error', () => { $('photoLoading').textContent = '사진을 불러오지 못했어요'; });

  $('answerForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (state.busy) return;
    const answer = $('answer').value.trim();
    if (!answer) return;
    state.busy = true; $('submitBtn').disabled = true;
    try {
      const id = state.ids[state.index];
      const r = await api('/answer', { id, answer });
      state.results.push({ id, no: state.index + 1, given: answer, correct: r.correct, answer_ko: r.answer_ko, answer_en: r.answer_en });
      openModal(r, answer);
    } catch (err) { if (err.message !== 'auth') alert(err.message); $('submitBtn').disabled = false; }
    finally { state.busy = false; }
  });

  const answerText = r => [r.answer_ko, r.answer_en].filter(Boolean).join(' · ');
  function openModal(r, given) {
    $('modalCount').textContent = `총 ${state.ids.length}문제 중 ${state.index + 1}번째`;
    $('modalMark').textContent = r.correct ? 'O' : 'X';
    $('modalMark').className = 'mark ' + (r.correct ? 'o' : 'x');
    $('modalVerdict').textContent = r.correct ? '정답!' : '아쉬워요';
    $('modalAnswer').textContent = '정답: ' + answerText(r);
    $('modalGiven').textContent = '내 답: ' + given;
    $('nextBtn').textContent = state.index + 1 < state.ids.length ? '다음' : '결과 보기';
    $('modal').hidden = false;
    setTimeout(() => $('nextBtn').focus(), 30);
  }
  function next() {
    if ($('modal').hidden) return;
    $('modal').hidden = true;
    state.index += 1;
    if (state.index < state.ids.length) render(); else finish();
  }
  $('nextBtn').addEventListener('click', next);
  document.addEventListener('keydown', e => { if (!$('modal').hidden && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); } });

  // 결과
  function finish() {
    const total = state.results.length, o = state.results.filter(r => r.correct).length;
    const wrong = state.results.filter(r => !r.correct);
    state.wrongPool = wrong.map(r => r.id);
    $('resultMode').textContent = state.mode === 'wrong' ? '오답 다시 풀기 결과' : '결과';
    $('resultScore').textContent = `${total}문제 중 ${o}개 정답`;
    $('resultRate').textContent = total ? `정답률 ${Math.round((o / total) * 100)}%` : '';
    const list = $('wrongList'); list.textContent = '';
    $('wrongTitle').textContent = `틀린 문제 ${wrong.length}개 · 맞힌 문제 ${total - wrong.length}개`;
    // 틀린 문제 먼저, 그다음 맞힌 문제 — 둘 다 사진·정답·내 답을 똑같이 자세히(사장 2026-10-15)
    const ordered = [...wrong, ...state.results.filter(r => r.correct)];
    if (!ordered.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = '푼 문제가 없어요.'; list.append(li); }
    for (const r of ordered) {
      const li = document.createElement('li'); li.className = r.correct ? 'is-o' : 'is-x';
      const fig = document.createElement('div'); fig.className = 'shot';
      const img = document.createElement('img'); img.src = imageUrl(r.id); img.alt = (r.correct ? '맞힌' : '틀린') + ' 문제 사진'; img.loading = 'lazy';
      const badge = document.createElement('span'); badge.className = 'badge ' + (r.correct ? 'o' : 'x'); badge.textContent = r.correct ? 'O' : 'X';
      const wrap = document.createElement('div'); wrap.className = 'shotwrap';
      const lens = document.createElement('button'); lens.type = 'button'; lens.className = 'lens'; lens.textContent = '🔍'; lens.setAttribute('aria-label', '돋보기로 크게 보기');
      wrap.append(img, lens); fig.append(wrap, badge);
      const info = document.createElement('div'); info.className = 'info';
      const no = document.createElement('p'); no.className = 'no'; no.textContent = `${total}문제 중 ${r.no}번째`;
      const ans = document.createElement('p'); ans.className = 'ans'; ans.textContent = '정답: ' + answerText(r);
      const mine = document.createElement('p'); mine.className = 'mine ' + (r.correct ? 'ok' : 'no'); mine.textContent = '내 답: ' + r.given;
      info.append(no, ans, mine); li.append(fig, info); list.append(li);
    }
    $('retryWrongBtn').hidden = !wrong.length;
    show('result');
  }
  $('retryWrongBtn').addEventListener('click', () => begin(state.wrongPool, 'wrong'));
  $('restartBtn').addEventListener('click', () => begin(state.allIds, 'all'));
  $('exitBtn').addEventListener('click', async () => {
    await fetch(API + '/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    window.close();
    setTimeout(() => show('bye'), 300);   // 브라우저가 창 닫기를 막으면 안내
  });

  // 돋보기(2026-10-15 사장): 사진은 원본 그대로, 🔍 나 사진을 누르면 크게 보기 — 화면 맞춤 → 원본 → 1.5·2·3배
  const zoom = { levels: ['fit', 1, 1.5, 2, 3], i: 1 };
  const applyZoom = () => {
    const img = $('zoomImg'), lv = zoom.levels[zoom.i];
    const fit = Math.min((innerWidth - 24) / img.naturalWidth, (innerHeight - 110) / img.naturalHeight, 1);
    const scale = lv === 'fit' ? fit : lv;
    img.style.width = Math.round(img.naturalWidth * scale) + 'px';
    $('zoomLevel').textContent = lv === 'fit' ? '화면 맞춤' : lv === 1 ? '원본' : lv + '배';
    $('zoomOut').disabled = zoom.i === 0; $('zoomIn').disabled = zoom.i === zoom.levels.length - 1;
  };
  const openZoom = src => {
    const img = $('zoomImg'); zoom.i = 1;
    img.onload = () => { applyZoom(); const st = $('zoomStage'); st.scrollTo((st.scrollWidth - st.clientWidth) / 2, (st.scrollHeight - st.clientHeight) / 2); };
    img.src = src; $('zoom').hidden = false;
  };
  const closeZoom = () => { $('zoom').hidden = true; $('zoomImg').removeAttribute('src'); };
  $('zoomIn').addEventListener('click', () => { if (zoom.i < zoom.levels.length - 1) { zoom.i++; applyZoom(); } });
  $('zoomOut').addEventListener('click', () => { if (zoom.i > 0) { zoom.i--; applyZoom(); } });
  $('photo').addEventListener('click', () => openZoom($('photo').src));
  $('photoLens').addEventListener('click', () => openZoom($('photo').src));
  $('wrongList').addEventListener('click', e => {
    const lens = e.target.closest('.lens'), img = e.target.tagName === 'IMG' ? e.target : lens && lens.parentElement.querySelector('img');
    if (img) openZoom(img.src);
  });
  $('zoomClose').addEventListener('click', closeZoom);
  $('zoomStage').addEventListener('click', e => { if (e.target === $('zoomStage')) closeZoom(); });
  document.addEventListener('keydown', e => { if ($('zoom').hidden) return; if (e.key === 'Escape') closeZoom(); if (e.key === '+') $('zoomIn').click(); if (e.key === '-') $('zoomOut').click(); });

  // 처음: 이미 로그인돼 있으면 바로 시작 화면
  api('/me').then(toStart).catch(() => show('login'));
})();
