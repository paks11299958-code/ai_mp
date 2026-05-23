@echo off
cd /d "%~dp0"
set HEADLESS=true
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; $env:HEADLESS='true'; node liker.js"
