import test from 'node:test';
import assert from 'node:assert/strict';

import { initMobileMenu } from '../mobile-menu.js';

function createTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) { listeners.set(type, handler); },
  };
}

function createFixture() {
  const document = createTarget();
  const window = createTarget();
  window.innerWidth = 390;
  const attributes = new Map([['aria-expanded', 'false'], ['aria-label', '메뉴 열기']]);
  const toggle = {
    ...createTarget(), focused: false,
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
    contains() { return false; },
    focus() { this.focused = true; },
  };
  const menu = {
    ...createTarget(), hidden: true,
    contains() { return false; },
  };
  document.querySelector = (selector) => selector === '[data-mobile-menu-toggle]' ? toggle : menu;
  return { document, window, toggle, menu };
}

test('opens and closes the mobile menu from the toggle', () => {
  const fixture = createFixture();
  initMobileMenu(fixture.document, fixture.window);

  fixture.toggle.listeners.get('click')();
  assert.equal(fixture.menu.hidden, false);
  assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(fixture.toggle.getAttribute('aria-label'), '메뉴 닫기');

  fixture.toggle.listeners.get('click')();
  assert.equal(fixture.menu.hidden, true);
  assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'false');
});

test('Escape closes the menu and restores focus', () => {
  const fixture = createFixture();
  initMobileMenu(fixture.document, fixture.window);
  fixture.toggle.listeners.get('click')();

  fixture.document.listeners.get('keydown')({ key: 'Escape' });
  assert.equal(fixture.menu.hidden, true);
  assert.equal(fixture.toggle.focused, true);
});

test('selecting a menu item closes the menu', () => {
  const fixture = createFixture();
  initMobileMenu(fixture.document, fixture.window);
  fixture.toggle.listeners.get('click')();

  fixture.menu.listeners.get('click')({ target: { closest: () => ({}) } });
  assert.equal(fixture.menu.hidden, true);
});
