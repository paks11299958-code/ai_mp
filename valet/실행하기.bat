@echo off
cd /d "%~dp0"
set /p retries="반복 횟수 입력 (엔터=기본 1800회): "
if "%retries%"=="" set retries=1800
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; node booking.js %retries%"
pause
