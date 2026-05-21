@echo off
cd /d "%~dp0"
npm install playwright playwright-extra puppeteer-extra-plugin-stealth
call npx playwright install chromium
pause
