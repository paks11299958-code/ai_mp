import test from 'node:test';
import assert from 'node:assert/strict';

import { scanHtmlSource } from './threeui-inventory.mjs';

test('marks a local-only canvas scene as self-contained', () => {
  const result = scanHtmlSource(`
    <canvas id="scene"></canvas>
    <style>@media (prefers-reduced-motion: reduce) { canvas { display:none } }</style>
    <script>new IntersectionObserver(() => {})</script>
  `, 'local-scene.html.js');

  assert.equal(result.selfContained, true);
  assert.equal(result.usesCanvas, true);
  assert.equal(result.hasReducedMotion, true);
  assert.equal(result.hasVisibilityPause, true);
});

test('reports CDN libraries and remote assets', () => {
  const result = scanHtmlSource(`
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <img src="https://assets.example.com/hero.webp">
  `, 'remote-scene.html.js');

  assert.equal(result.selfContained, false);
  assert.equal(result.usesTailwindCdn, true);
  assert.equal(result.usesGsap, true);
  assert.equal(result.remoteAssetCount, 1);
  assert.deepEqual(result.hosts, ['assets.example.com', 'cdn.tailwindcss.com', 'cdnjs.cloudflare.com']);
});
