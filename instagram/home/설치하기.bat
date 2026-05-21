@echo off
chcp 65001 > nul
call npm install
call npx playwright install chromium
pause
