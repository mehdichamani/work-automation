@echo off
echo ============================================
echo   سیستم اتوماسیون اداری اروم شیشه ساچی
echo ============================================
echo.

echo [1] راه‌اندازی Backend...
start "Backend" cmd /c "cd /d D:\edari\backend && node server.js"

timeout /t 3 /nobreak >nul

echo [2] راه‌اندازی Frontend...
start "Frontend" cmd /c "cd /d D:\edari\frontend && npx vite --host 0.0.0.0 --port 5173"

echo.
echo ============================================
echo   سیستم راه‌اندازی شد!
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:5173
echo ============================================
pause
