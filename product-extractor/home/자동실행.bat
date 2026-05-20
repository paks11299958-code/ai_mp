@echo off
cd /d %~dp0
echo [1/2] Chrome 실행 중 (원격 디버그 모드)...
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --no-first-run --no-default-browser-check --user-data-dir="%TEMP%\chrome_extractor"
timeout /t 4 /nobreak > nul
echo [2/2] 제품추출 시작...
"C:\Program Files\nodejs\node.exe" extractor.js
pause
