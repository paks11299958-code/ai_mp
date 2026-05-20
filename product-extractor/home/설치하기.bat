@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   제품추출 - 최초 설치
echo ========================================
echo.
echo [1/2] 패키지 설치 중...
call npm install
echo.
echo [2/2] 브라우저 설치 중...
call npx playwright install chromium
echo.
echo ========================================
echo   설치 완료!
echo.
echo   다음 단계:
echo   1. .env.template 파일을 .env 로 복사
echo   2. .env 파일 안에 API 키 입력
echo   3. template.xlsm 파일을 이 폴더에 복사
echo   4. 자동실행.bat 실행
echo ========================================
pause
