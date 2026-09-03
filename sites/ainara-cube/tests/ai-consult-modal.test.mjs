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
  // 반복하면 인사말이 무한히 돈다 / 음소거면 멘트가 안 들린다
  assert.match(avatar, /video\.loop\s*=\s*!greeting/, 'GREETING 만 loop 를 꺼야 한다');
  assert.match(avatar, /video\.muted\s*=\s*!greeting/, 'GREETING 만 소리를 켜야 한다');
  // 끝나고 대기로 안 돌아가면 마지막 프레임에서 멈춘다
  assert.match(avatar, /addEventListener\('ended'/, '끝나면 IDLE 로 돌아가야 한다');
});

test('★인사가 idle·speaking 자리를 차지하지 않는다', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');
  // 대기와 답변은 여전히 각자의 영상을 써야 한다
  assert.match(avatar, /seoa-idle\.mp4/);
  assert.match(avatar, /seoa-speaking-poc\.mp4/);
});
