@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   인스타 자동 좋아요 - 최초 설치
echo ========================================
echo.
echo [1/2] 패키지 설치 중...
call npm install
echo.
echo [2/2] 브라우저 설치 중... (시간이 걸릴 수 있습니다)
call npx playwright install chromium
echo.
echo ========================================
echo   설치 완료! 이제 실행하기.bat 를 사용하세요.
echo ========================================
pause
