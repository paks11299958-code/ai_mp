@echo off
cd /d "%~dp0"
set /p target_date="예약 날짜 입력 (예: 2026-06-03, 엔터=기본값): "
if "%target_date%"=="" set target_date=2026-06-03
set /p retries="반복 횟수 입력 (엔터=기본 1800회): "
if "%retries%"=="" set retries=1800
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; node booking.js %target_date% %retries%"
pause
