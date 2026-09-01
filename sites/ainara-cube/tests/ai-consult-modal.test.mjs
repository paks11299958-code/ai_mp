import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { initAiConsultModal } from '../ai-consult-modal.js';

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

test('uses the rigged Seoa model for the consultation avatar', async () => {
  const avatar = await readFile(new URL('../assets/ai-consult/avatar.html', import.meta.url), 'utf8');

  assert.match(avatar, /src="\.\/seoa-consult-rigged\.glb"/);
  assert.match(avatar, /poster="\.\/seoa-consult-poster\.png"/);
  assert.match(avatar, /camera-orbit="90deg 82deg auto"/);
  assert.match(avatar, /alt="AI 상담 매니저 서아 3D 아바타"/);
  assert.match(avatar, /class="face-mask" aria-hidden="true"/);
  assert.doesNotMatch(avatar, /poster="\.\/seoa-consult-poster\.png" camera-controls/);
  assert.doesNotMatch(avatar, /via3\.glb|animation-name="Wave"/);
});
