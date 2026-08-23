import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const html=readFileSync(resolve(root,'index.html'),'utf8');
const css=readFileSync(resolve(root,'style.css'),'utf8');
const js=readFileSync(resolve(root,'script.js'),'utf8');

test('uses one approved local ThreeUI particle network mount',()=>{
  assert.equal((html.match(/data-threeui-effect=/g)||[]).length,1);
  assert.match(html,/data-threeui-effect="particle-network"/);
  assert.match(html,/src="\.\/threeui-runtime\.js"/);
  assert.doesNotMatch(html,/three\.js|unpkg\.com|cdn\.jsdelivr\.net/i);
});

test('keeps semantic structure and accessible consultation dialog',()=>{
  for(const tag of ['<header','<main','<section','<footer'])assert.match(html,new RegExp(tag));
  assert.match(html,/role="dialog"/);
  assert.match(html,/aria-modal="true"/);
  assert.match(html,/data-consult-close aria-label="AI 상담 닫기"/);
  assert.match(js,/event\.key==='Escape'/);
  assert.match(js,/returnFocus\?\.focus/);
});

test('supports mobile and reduced motion and keeps the referenced business content',()=>{
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(html,/\b(?:010[- ]?\d{4}|\d{2,3}-\d{3,4}-\d{4})\b/);
  for(const content of ['AI 포인트형','AI 임대형','AI 홍보형','STARTER','GROWTH','CREATOR','BUSINESS','매월 10일']){
    assert.match(html,new RegExp(content));
  }
  assert.match(html,/특정 수익을 보장하지 않습니다/);
});

test('draws the AINARA logo with local SVG light strokes',()=>{
  assert.match(html,/class="brand-mark light-logo"/);
  assert.match(html,/<ellipse cx="20" cy="20"/);
  assert.match(css,/@keyframes draw-logo/);
});

test('loads the external chat only after an explicit consultation action',()=>{
  assert.match(html,/data-chat-src="https:\/\/bot\.dbzone\.kr\//);
  assert.doesNotMatch(html,/<iframe src="https:\/\/bot\.dbzone\.kr\//);
  assert.match(js,/chat\.src=chat\.dataset\.chatSrc/);
});
