@echo off
cd /d "%~dp0"

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo.
    echo 아래 주소에서 Node.js LTS 버전을 설치하세요:
    echo https://nodejs.org
    echo.
    echo 설치 후 이 파일을 다시 실행하세요.
    pause
    exit /b
)

echo Node.js 버전 확인:
node -v
echo.
echo 패키지 설치 중...
npm install playwright playwright-extra puppeteer-extra-plugin-stealth
echo.
echo Chromium 브라우저 설치 중...
call npx playwright install chromium
echo.
echo 설치 완료!
pause
