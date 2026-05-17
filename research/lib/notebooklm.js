/**
 * notebooklm.js — Playwright로 NotebookLM 자동 업로드
 * 저장된 세션 쿠키로 로그인, 노트북 생성/소스 추가
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const fs           = require('fs');
const path         = require('path');

const NLM_URL = 'https://notebooklm.google.com';
const TIMEOUT = 20_000;

async function upload({ cookies, notebookName, filePath }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // 쿠키 주입
  await context.addCookies(cookies);

  let notebookUrl = null;

  try {
    const page = await context.newPage();
    await page.goto(NLM_URL, { timeout: TIMEOUT, waitUntil: 'networkidle' });

    // 로그인 확인 (로그인 안 됐으면 쿠키 만료)
    const isLoggedIn = await page.locator('text=New notebook').or(
      page.locator('[aria-label*="notebook"]')
    ).isVisible({ timeout: 8_000 }).catch(() => false);

    if (!isLoggedIn) throw new Error('쿠키 만료 — 재등록 필요');

    // 기존 노트북 찾기
    const existingNotebook = page.locator(`text="${notebookName}"`).first();
    const exists = await existingNotebook.isVisible({ timeout: 3_000 }).catch(() => false);

    if (exists) {
      // 기존 노트북 열기
      await existingNotebook.click();
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
      console.log(`📖 기존 노트북 열기: ${notebookName}`);
    } else {
      // 새 노트북 생성
      await page.locator('button:has-text("New notebook"), [aria-label*="New notebook"]').first().click();
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });

      // 노트북 이름 변경
      const titleEl = page.locator('[placeholder*="Untitled"], [aria-label*="title"], h1[contenteditable]').first();
      if (await titleEl.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await titleEl.triple_click ? titleEl.click({ clickCount: 3 }) : titleEl.click();
        await page.keyboard.selectAll();
        await page.keyboard.type(notebookName);
        await page.keyboard.press('Enter');
      }
      console.log(`📓 새 노트북 생성: ${notebookName}`);
    }

    notebookUrl = page.url();

    // 소스 추가 버튼 클릭
    const addSourceBtn = page.locator('button:has-text("Add source"), button:has-text("소스 추가"), [aria-label*="Add source"]').first();
    await addSourceBtn.click({ timeout: TIMEOUT });
    await page.waitForTimeout(1000);

    // 파일 업로드 선택
    const uploadBtn = page.locator('button:has-text("Upload"), label:has-text("Upload"), [aria-label*="Upload"]').first();
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: TIMEOUT }),
      uploadBtn.click(),
    ]);
    await fileChooser.setFiles(filePath);

    // 업로드 완료 대기
    await page.waitForSelector('[aria-label*="source"], .source-item, text=Processing', {
      timeout: 30_000,
    }).catch(() => {});
    await page.waitForTimeout(3000);

    console.log(`✅ NotebookLM 업로드 완료: ${notebookUrl}`);

  } finally {
    await browser.close();
  }

  return notebookUrl;
}

module.exports = { upload };
