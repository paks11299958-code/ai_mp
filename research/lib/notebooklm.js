/**
 * notebooklm.js — Playwright로 NotebookLM 자동 업로드
 * 저장된 세션 쿠키로 로그인, 노트북 생성/소스 추가
 */
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());
const fs   = require('fs');
const path = require('path');

const NLM_URL = 'https://notebooklm.google.com';
const TIMEOUT = 20_000;

async function upload({ cookies, notebookName, filePath }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  // 쿠키 주입 (sameSite null → Lax 정규화)
  const normalizedCookies = cookies.map(c => ({
    ...c,
    sameSite: ['Strict', 'Lax', 'None'].includes(c.sameSite) ? c.sameSite : 'Lax',
  }));
  await context.addCookies(normalizedCookies);

  let notebookUrl = null;

  try {
    const page = await context.newPage();
    await page.goto(NLM_URL, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });

    // 로그인 확인
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com')) {
      await page.screenshot({ path: '/home/paks11299958/ai_mp/research/logs/nlm_debug.png', fullPage: false });
      throw new Error('쿠키 만료 — 재등록 필요');
    }

    // 기존 노트북 찾기
    const existingNotebook = page.locator(`text="${notebookName}"`).first();
    const exists = await existingNotebook.isVisible({ timeout: 3_000 }).catch(() => false);

    if (exists) {
      await existingNotebook.click();
      await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT });
      console.log(`📖 기존 노트북 열기: ${notebookName}`);
    } else {
      await page.locator('button:has-text("새로 만들기"), button:has-text("New notebook"), [aria-label*="New notebook"]').first().click();
      await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUT });

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

    // 오버레이 닫기
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const backdrop = page.locator('.cdk-overlay-backdrop').first();
    if (await backdrop.isVisible({ timeout: 2000 }).catch(() => false)) {
      await backdrop.click({ force: true });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: '/home/paks11299958/ai_mp/research/logs/nlm_before_click.png' });

    // ── 파일 업로드 ──
    // 1단계: dragenter 이벤트로 소스 추가 모달 열기
    // (스크린샷에서 확인: 드래그 이벤트 → "파일 업로드" 버튼이 있는 모달 등장)
    const fileContent = fs.readFileSync(filePath, 'base64');
    const fileName = path.basename(filePath);

    console.log(`소스 추가 모달 열기: ${fileName}`);

    await page.evaluate(({ content, name }) => {
      const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'text/plain' });
      const file = new File([blob], name, { type: 'text/plain' });
      const dt = new DataTransfer();
      dt.items.add(file);

      // dragenter만 발생 → 소스 추가 모달 오픈 유도
      const targets = ['[class*="empty"]', 'source-panel', 'notebook-sidebar', 'body'];
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el) {
          el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
          break;
        }
      }
    }, { content: fileContent, name: fileName });

    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/home/paks11299958/ai_mp/research/logs/nlm_upload_dialog.png' });

    // 2단계: "파일 업로드" 버튼 클릭 → filechooser
    const uploadBtn = page.locator('button:has-text("파일 업로드"), button:has-text("파일"), button:has-text("Upload")').first();
    const uploadBtnVisible = await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    console.log(`"파일 업로드" 버튼 표시 여부: ${uploadBtnVisible}`);

    if (uploadBtnVisible) {
      const [fc] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: TIMEOUT }),
        uploadBtn.click(),
      ]);
      await fc.setFiles(filePath);
      console.log('✅ "파일 업로드" 버튼 → filechooser 업로드 성공');
    } else {
      // 3단계 폴백: "또는 파일 드롭" 존에 직접 드롭
      console.log('"파일 업로드" 버튼 없음, 파일 드롭 존에 직접 드롭 시도');

      const dropResult = await page.evaluate(({ content, name }) => {
        const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'text/plain' });
        const file = new File([blob], name, { type: 'text/plain' });
        const dt = new DataTransfer();
        dt.items.add(file);

        // "또는 파일 드롭" 존 찾기
        const allEls = Array.from(document.querySelectorAll('*'));
        const dropZone = allEls.find(el =>
          (el.textContent || '').includes('파일 드롭') ||
          (el.textContent || '').includes('File drop') ||
          (el.className && el.className.toString().includes('drop'))
        );

        if (dropZone) {
          dropZone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
          dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          return `dropped: ${dropZone.tagName} .${(dropZone.className || '').toString().slice(0, 40)}`;
        }
        return null;
      }, { content: fileContent, name: fileName });

      console.log(`드롭 존 결과: ${dropResult}`);

      if (!dropResult) {
        throw new Error('NotebookLM 파일 업로드 불가 — 소스 추가 모달이 열리지 않음');
      }
    }

    // 업로드 완료 대기
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/home/paks11299958/ai_mp/research/logs/nlm_after_upload.png' });
    console.log(`✅ NotebookLM 업로드 완료: ${notebookUrl}`);

  } finally {
    await browser.close();
  }

  return notebookUrl;
}

module.exports = { upload };
