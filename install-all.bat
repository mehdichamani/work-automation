@echo off
echo ============================================
echo   سیستم اتوماسیون اداری - نصب آسان
echo ============================================
echo.

echo [1] نصب وابستگی‌های Backend...
cd /d "%~dp0backend"
call npm install

echo.
echo [2] نصب وابستگی‌های Frontend...
cd /d "%~dp0frontend"
call npm install

echo.
echo [3] ایجاد نسخه بیلد فرانت‌اند...
call npm run build

echo.
echo [4] دانلود ایمیج‌های داکر...
cd /d "%~dp0docker"
docker compose pull

echo.
echo ============================================
echo   نصب با موفقیت انجام شد!
echo   برای اجرای پروژه فایل start-all.bat را اجرا کنید.
echo ============================================
pause
