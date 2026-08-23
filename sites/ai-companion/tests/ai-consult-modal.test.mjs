import test from 'node:test';
import assert from 'node:assert/strict';

import { initAiConsultModal } from '../ai-consult-modal.js';

function createFixture() {
  const listeners = new Map();
  const closeListeners = new Map();
  const modal = {
    hidden: false,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };
  const closeButton = {
    addEventListener(type, handler) {
      closeListeners.set(type, handler);
    },
  };
  const document = {
    body: { style: { overflow: '' } },
    querySelector(selector) {
      if (selector === '[data-ai-consult-modal]') return modal;
      if (selector === '[data-ai-consult-close]') return closeButton;
      return null;
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
  };

  return { document, modal, listeners, closeListeners };
}

test('locks page scrolling while the consultation modal starts open', () => {
  const fixture = createFixture();

  initAiConsultModal(fixture.document);

  assert.equal(fixture.modal.hidden, false);
  assert.equal(fixture.document.body.style.overflow, 'hidden');
});

test('closes the consultation modal from the close button', () => {
  const fixture = createFixture();
  initAiConsultModal(fixture.document);

  fixture.closeListeners.get('click')();

  assert.equal(fixture.modal.hidden, true);
  assert.equal(fixture.document.body.style.overflow, '');
});

test('closes the consultation modal when Escape is pressed', () => {
  const fixture = createFixture();
  initAiConsultModal(fixture.document);

  fixture.listeners.get('keydown')({ key: 'Escape' });

  assert.equal(fixture.modal.hidden, true);
});
