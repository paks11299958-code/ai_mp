@echo off
chcp 65001 > nul
echo.
echo ========================================
echo   인스타 자동 좋아요
echo ========================================
echo.
set /p keyword="해시태그 키워드 입력 (# 없이, 예: 골프): "
echo.
echo #%keyword% 좋아요를 시작합니다...
echo.
node liker.js %keyword%
echo.
pause
