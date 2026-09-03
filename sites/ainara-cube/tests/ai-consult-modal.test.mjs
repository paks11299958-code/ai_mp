import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { initAiConsultModal, setAvatarState } from '../ai-consult-modal.js';

function createFixture() {
  const listeners = new Map();
  const modalListeners = new Map();
  const closeListeners = new Map();
  const openListeners = new Map();
  const openButton = {
    focused: false,
    addEventListener(type, handler) { openListeners.set(type, handler); },
    focus() { this.focused = true; },
  };
  const modal = {
    hidden: true,
    addEventListener(type, handler) { modalListeners.set(type, handler); },
  };
  const closeButton = {
    focused: false,
    addEventListener(type, handler) { closeListeners.set(type, handler); },
    focus() { this.focused = true; },
  };
  const document = {
    body: { style: { overflow: '' } },
    querySelector(selector) {
      if (selector === '[data-ai-consult-modal]') return modal;
      if (selector === '[data-ai-consult-close]') return closeButton;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '[data-ai-consult-open]' ? [openButton] : [];
    },
    addEventListener(type, handler) { listeners.set(type, handler); },
  };

  return { document, modal, openButton, closeButton, listeners, closeListeners, openListeners };
}

test('keeps the consultation modal hidden on first visit', () => {
  const fixture = createFixture();
  initAiConsultModal(fixture.document);

  assert.equal(fixture.modal.hidden, true);
  assert.equal(fixture.document.body.style.overflow, '');
});

test('opens from the partner button and closes back to that button', () => {
  const fixture = createFixture();
  initAiConsultModal(fixture.document);

  let prevented = false;
  fixture.openListeners.get('click')({
    currentTarget: fixture.openButton,
    preventDefault() { prevented = true; },
  });

  assert.equal(prevented, true);
  assert.equal(fixture.modal.hidden, false);
  assert.equal(fixture.document.body.style.overflow, 'hidden');
  assert.equal(fixture.closeButton.focused, true);

  fixture.closeListeners.get('click')();
  assert.equal(fixture.modal.hidden, true);
  assert.equal(fixture.document.body.style.overflow, '');
  assert.equal(fixture.openButton.focused, true);
});

test('closes an open modal when Escape is pressed', () => {
  const fixture = createFixture();
  initAiConsultModal(fixture.document);
  fixture.openListeners.get('click')({ currentTarget: fixture.openButton, preventDefault() {} });

  fixture.listeners.get('keydown')({ key: 'Escape' });

  assert.equal(fixture.modal.hidden, true);
});

test('uses the AIworld consultation workspace instead of the legacy Typebot iframe', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /data-ai-chat-form/);
  assert.match(html, /data-ai-inquiry-form/);
  assert.match(html, /담당자 상담 접수/);
  assert.doesNotMatch(html, /lead-generation-7o4fpsk/);
  assert.doesNotMatch(html, /generativelanguage\.googleapis\.com/);
});

test('routes AI and inquiry requests through separate n8n webhooks without browser secrets', async () => {
  const source = await readFile(new URL('../ai-consult-modal.js', import.meta.url), 'utf8');

  assert.match(source, /GEMINI_WEBHOOK = 'https:\/\/n8n\.dbzone\.kr\/webhook\//);
  assert.match(source, /INQUIRY_WEBHOOK = 'https:\/\/n8n\.dbzone\.kr\/webhook\//);
  assert.match(source, /button\.disabled = true/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source, /AIza|api[_-]?key/i);
});

test('uses the SeoA 2.5D videos for the consultation avatar', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');

  assert.match(avatar, /src="\.\/seoa-idle\.mp4"/);
  assert.match(avatar, /seoa-speaking-poc\.mp4/);
  assert.match(avatar, /SEOA_AVATAR_STATE/);
  assert.match(avatar, /data-state="idle"/);
  assert.doesNotMatch(avatar, /model-viewer|\.glb|face-mask/);
});

test('sends only allowed avatar states to the same-origin iframe', () => {
  const messages = [];
  const frame = { contentWindow: { postMessage: (...args) => messages.push(args) } };
  const document = {
    defaultView: { location: { origin: 'https://aiworld.dbzone.kr' } },
    querySelector: (selector) => selector === '[data-ai-consult-avatar]' ? frame : null,
  };

  assert.equal(setAvatarState(document, 'THINKING'), true);
  assert.equal(setAvatarState(document, 'UNKNOWN'), false);
  assert.deepEqual(messages, [[
    { type: 'SEOA_AVATAR_STATE', state: 'THINKING' },
    'https://aiworld.dbzone.kr',
  ]]);
});

// ── 상담창 진입 인사 (2026-09-03) ─────────────────────────────
// ★인사 영상은 **대사가 있는** 영상이다. idle 처럼 반복하면 "안녕하세요"가 무한히 돌고,
//   speaking 자리에 두면 답변할 때마다 인사한다. 그래서 자리와 반복 여부를 못박는다.

test('상담창을 열면 인사 상태로 시작한다', () => {
  const fixture = createFixture();
  const messages = [];
  const frame = { contentWindow: { postMessage: (m) => messages.push(m) } };
  const baseQuery = fixture.document.querySelector.bind(fixture.document);
  fixture.document.querySelector = (sel) =>
    sel === '[data-ai-consult-avatar]' ? frame : baseQuery(sel);
  fixture.document.defaultView = { location: { origin: 'https://aiworld.dbzone.kr' } };

  initAiConsultModal(fixture.document);
  fixture.openListeners.get('click')({ preventDefault() {}, currentTarget: fixture.openButton });

  const states = messages.filter(m => m?.type === 'SEOA_AVATAR_STATE').map(m => m.state);
  assert.ok(states.includes('GREETING'), `열었을 때 GREETING 이어야 한다: ${states}`);
  assert.equal(fixture.modal.hidden, false);
});

test('GREETING 이 허용 상태에 포함된다', () => {
  const messages = [];
  const frame = { contentWindow: { postMessage: (...a) => messages.push(a[0]) } };
  const document = {
    defaultView: { location: { origin: 'https://aiworld.dbzone.kr' } },
    querySelector: (s) => s === '[data-ai-consult-avatar]' ? frame : null,
  };
  assert.equal(setAvatarState(document, 'GREETING'), true);
});

test('★인사 영상은 1회 재생이고 소리가 켜진다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');

  assert.match(avatar, /seoa-greeting\.mp4/, '인사 영상 파일을 써야 한다');
  // 반복하면 인사말이 무한히 돈다
  assert.match(avatar, /video\.loop\s*=\s*!greeting/, 'GREETING 만 loop 를 꺼야 한다');
  // ★기본은 음소거다 — 자동재생 정책상 소리가 켜져 있으면 재생이 막혀
  //   인사 영상 자체가 안 나온다(2026-09-03 운영 실측으로 fallback 확인).
  //   사용자가 버튼으로 켠 뒤에는 그 선택(soundOn)을 따른다.
  assert.match(avatar, /video\.muted\s*=\s*!soundOn/, '사용자 선택을 따라 음소거해야 한다');
  assert.match(avatar, /let soundOn = false/, '기본값은 음소거여야 한다');
  // 끝나고 대기로 안 돌아가면 마지막 프레임에서 멈춘다
  assert.match(avatar, /addEventListener\('ended'/, '끝나면 IDLE 로 돌아가야 한다');
});

test('★인사가 idle·speaking 자리를 차지하지 않는다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 대기와 답변은 여전히 각자의 영상을 써야 한다
  assert.match(avatar, /seoa-idle\.mp4/);
  assert.match(avatar, /seoa-speaking-poc\.mp4/);
});

test('★iframe 이 준비되기 전에 열어도 인사가 도달한다', () => {
  // 2026-09-03 실측 결함: 열자마자 postMessage 하면 iframe 이 아직 안 떠서 버려졌다.
  // 운영에서 계속 idle 이었고, 코드만 봐서는 멀쩡해 보였다.
  const fixture = createFixture();
  const messages = [];
  const frame = { contentWindow: { postMessage: (m) => messages.push(m) } };
  const baseQuery = fixture.document.querySelector.bind(fixture.document);
  fixture.document.querySelector = (sel) =>
    sel === '[data-ai-consult-avatar]' ? frame : baseQuery(sel);

  const viewListeners = [];
  fixture.document.defaultView = {
    location: { origin: 'https://aiworld.dbzone.kr' },
    addEventListener: (t, h) => viewListeners.push([t, h]),
    removeEventListener: () => {},
    setTimeout: () => {},
  };

  initAiConsultModal(fixture.document);
  fixture.openListeners.get('click')({ preventDefault() {}, currentTarget: fixture.openButton });

  // iframe 이 뒤늦게 준비 신호를 보낸 상황을 재현
  const before = messages.filter(m => m?.state === 'GREETING').length;
  viewListeners.filter(([t]) => t === 'message')
    .forEach(([, h]) => h({ data: { type: 'SEOA_AVATAR_READY' } }));
  const after = messages.filter(m => m?.state === 'GREETING').length;

  assert.ok(after > before, 'READY 를 받으면 인사를 다시 보내야 한다');
});

test('★iframe 초기화가 먼저 온 인사를 덮어쓰지 않는다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 무조건 setState('IDLE') 하면 먼저 도착한 GREETING 이 지워진다.
  assert.match(avatar, /if \(root\.dataset\.state === 'idle'\) setState\('IDLE'\)/);
});

test('★소리 버튼이 눈에 띄게 있고 동작한다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');

  assert.match(avatar, /id="sound-toggle"/, '소리 버튼이 있어야 한다');
  // 인사 중 아직 음소거면 강조해야 한다 — 안 그러면 멘트를 놓친다.
  assert.match(avatar, /\[data-state="greeting"\] \.sound\[data-muted="true"\]/,
    '인사 중에는 소리 버튼을 강조해야 한다');
  // 터치 대상 44px 이상(모바일 기준)
  assert.match(avatar, /min-height:44px/, '버튼은 44px 이상이어야 한다');
  // 켠 뒤 상태가 바뀌어도 유지돼야 한다
  assert.match(avatar, /soundOn = !soundOn/, '토글이 있어야 한다');
  assert.match(avatar, /aria-pressed/, '스크린리더에 상태를 알려야 한다');
});

test('★인사 중 소리를 켜면 처음부터 다시 튼다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 중간에 켜면 멘트 앞부분을 이미 놓쳤다 — 되감아야 의미가 있다.
  assert.match(avatar, /video\.currentTime = 0/, '인사 중 켜면 되감아야 한다');
});

// ── 인사 자막 (2026-09-03) ────────────────────────────────────
// ★자막은 어긋나도 에러가 안 난다. 입과 안 맞거나 대기 중에 남아 있어도
//   화면상 멀쩡해 보이므로, 시각과 정리 시점을 코드로 못박는다.

test('★자막 시각이 실제 음성과 맞는다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  const block = avatar.match(/const GREETING_CUES = \[([\s\S]*?)\];/);
  assert.ok(block, 'GREETING_CUES 가 있어야 한다');

  const cues = [...block[1].matchAll(/\[([\d.]+),\s*([\d.]+),\s*'([^']+)'\]/g)]
    .map(m => [Number(m[1]), Number(m[2]), m[3]]);
  assert.equal(cues.length, 3, '문장 3개여야 한다');

  // 영상은 7.416초다 — 넘어가면 자막이 영상보다 오래 떠 있다.
  assert.ok(cues.at(-1)[1] <= 7.5, `마지막 자막이 영상 길이를 넘는다: ${cues.at(-1)[1]}`);
  // 시각이 앞뒤로 뒤집히면 자막이 안 뜨거나 겹친다.
  for (const [a, b] of cues) assert.ok(a < b, `시작<끝이어야 한다: ${a},${b}`);
  for (let i = 1; i < cues.length; i++) {
    assert.ok(cues[i][0] >= cues[i-1][1], `자막이 겹친다: ${cues[i-1]} / ${cues[i]}`);
  }
  // ★실측한 문장 사이 쉼(3.255~3.792)에 세 번째 자막이 걸쳐 있으면 안 된다.
  assert.ok(cues[2][0] >= 3.6, `두 번째 문장 시작이 너무 이르다: ${cues[2][0]}`);
});

test('★인사가 끝나면 자막을 지운다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 대기·답변 중에 인사말이 남아 있으면 안 된다.
  assert.match(avatar, /if \(!greeting\) \{ caption\.dataset\.show = 'false'/,
    '인사가 아니면 자막을 지워야 한다');
  assert.match(avatar, /addEventListener\('timeupdate', updateCaption\)/,
    '재생 위치에 따라 자막을 갱신해야 한다');
});

test('자막이 얼굴을 가리지 않는 위치에 있다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  assert.match(avatar, /\.caption\{[^}]*position:absolute/, '영상 위에 얹어야 한다');
  assert.match(avatar, /\.caption\{[^}]*bottom:/, '아래쪽에 둬야 한다');
});

test('★모바일에서 자막·버튼이 서로 겹치지 않는다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 390px 실측: 자막이 얼굴을 가리고(화면 48% 지점), 소리 버튼 글자가 닫기 버튼에 잘렸다.
  assert.match(avatar, /@media\(max-width:480px\)[\s\S]{0,400}\.caption\{/,
    '모바일에서 자막 위치를 따로 잡아야 한다');
  assert.match(avatar, /@media\(max-width:480px\)\{\.sound\{[^}]*left:12px/,
    '모바일에서 소리 버튼을 왼쪽으로 옮겨 닫기 버튼과 겹치지 않게 해야 한다');
  assert.match(avatar, /\.sound #sound-label\{display:none\}/,
    '모바일에서는 아이콘만 남겨 폭을 줄여야 한다');
});
