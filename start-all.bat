@echo off
echo ============================================
echo   سیستم اتوماسیون اداری - راه‌اندازی آسان
echo ============================================
echo.

echo [1] راه‌اندازی پایگاه‌داده PostgreSQL در داکر...
cd /d "%~dp0docker"
docker compose up -d

echo.
echo منتظر ماندن برای بالا آمدن پایگاه‌داده...
timeout /t 5 /nobreak >nul

echo [2] راه‌اندازی سرور بک‌اند با PM2...
cd /d "%~dp0"
call pm2 start ecosystem.config.js

echo.
echo [3] باز کردن برنامه در مرورگر...
start http://localhost:3001

echo.
echo ============================================
echo   سیستم با موفقیت اجرا شد!
echo   برای دیدن لاگ‌های سرور دستور زیر را اجرا کنید:
echo   pm2 logs
echo ============================================
pause
