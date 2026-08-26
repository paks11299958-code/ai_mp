import test from 'node:test';
import assert from 'node:assert/strict';

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
