@echo off
echo ============================================
echo   تنظیم اجرای خودکار سیستم اداری
echo ============================================
echo.

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

echo [1] کپی اسکریپت خودکار...
copy /Y "D:\edari\auto-start.vbs" "%STARTUP%\EdariAutoStart.vbs" >nul

if exist "%STARTUP%\EdariAutoStart.vbs" (
    echo     با موفقیت ثبت شد!
    echo     فایل: %STARTUP%\EdariAutoStart.vbs
) else (
    echo     خطا در ثبت.
)

echo.
echo ============================================
echo   تنظیم کامل شد!
echo   برنامه با هر بار ورود کاربر خودکار اجرا می‌شود.
echo.
echo   برای حذف اجرای خودکار:
echo   del "%STARTUP%\EdariAutoStart.vbs"
echo ============================================
pause
