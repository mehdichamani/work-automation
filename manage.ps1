# Set console encoding to UTF-8 to display Persian characters correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Header {
    Clear-Host
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   سیستم اتوماسیون اداری اروم شیشه ساچی       " -ForegroundColor Cyan
    Write-Host "          مدیریت و راه‌اندازی پروژه            " -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Menu {
    Show-Header
    Write-Host "لطفاً یکی از گزینه‌های زیر را انتخاب کنید:" -ForegroundColor Yellow
    Write-Host "1. نصب وابستگی‌ها و بیلد فرانت‌اند (Install & Build)"
    Write-Host "2. راه‌اندازی پایگاه‌داده در داکر (Start Database)"
    Write-Host "3. راه‌اندازی برنامه با کلاستر PM2 (Start Frontend + Backend)"
    Write-Host "4. تنظیم اجرای خودکار با ورود کاربر (Setup Auto-Start)"
    Write-Host "5. حذف تنظیم اجرای خودکار (Remove Auto-Start)"
    Write-Host "6. خروج (Exit)"
    Write-Host ""
    $choice = Read-Host "گزینه مورد نظر (1-6)"
    return $choice
}

do {
    $c = Menu
    switch ($c) {
        "1" {
            Show-Header
            Write-Host "[1/4] نصب وابستگی‌های بک‌اند..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            npm install
            
            Write-Host "`n[2/4] نصب وابستگی‌های فرانت‌اند..." -ForegroundColor Green
            Set-Location "$scriptDir\frontend"
            npm install
            
            Write-Host "`n[3/4] ایجاد نسخه نهایی فرانت‌اند (Build)..." -ForegroundColor Green
            npm run build
            
            Write-Host "`n[4/4] دانلود ایمیج داکر PostgreSQL..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose pull
            
            Write-Host "`nنصب با موفقیت انجام شد!" -ForegroundColor Green
            Read-Host "برای بازگشت به منو Enter بزنید"
        }
        "2" {
            Show-Header
            Write-Host "راه‌اندازی پایگاه‌داده در داکر..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose up -d
            Write-Host "`nپایگاه‌داده با موفقیت راه‌اندازی شد." -ForegroundColor Green
            Read-Host "برای بازگشت به منو Enter بزنید"
        }
        "3" {
            Show-Header
            Write-Host "راه‌اندازی سرور با PM2..." -ForegroundColor Green
            Set-Location $scriptDir
            
            # Ensure PostgreSQL is running
            Set-Location "$scriptDir\docker"
            docker compose up -d
            Set-Location $scriptDir
            
            # Start via PM2
            pm2 start ecosystem.config.js
            
            Write-Host "`nبرنامه با موفقیت اجرا شد. در حال باز کردن مرورگر..." -ForegroundColor Green
            Start-Process "http://localhost:3001"
            Read-Host "برای بازگشت به منو Enter بزنید"
        }
        "4" {
            Show-Header
            Write-Host "تنظیم اجرای خودکار سیستم با ورود کاربر..." -ForegroundColor Green
            $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
            $shortcutPath = [System.IO.Path]::Combine($startupFolder, "EdariAutoStart.vbs")
            $sourceVbs = [System.IO.Path]::Combine($scriptDir, "auto-start.vbs")
            
            try {
                Copy-Item -Path $sourceVbs -Destination $shortcutPath -Force
                Write-Host "اسکریپت اجرای خودکار با موفقیت ثبت شد!" -ForegroundColor Green
                Write-Host "فایل: $shortcutPath" -ForegroundColor Gray
            } catch {
                Write-Host "خطا در ثبت اجرای خودکار: $_" -ForegroundColor Red
            }
            Read-Host "برای بازگشت به منو Enter بزنید"
        }
        "5" {
            Show-Header
            Write-Host "حذف اجرای خودکار سیستم..." -ForegroundColor Green
            $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
            $shortcutPath = [System.IO.Path]::Combine($startupFolder, "EdariAutoStart.vbs")
            
            if (Test-Path $shortcutPath) {
                Remove-Item -Path $shortcutPath -Force
                Write-Host "اجرای خودکار با موفقیت حذف شد." -ForegroundColor Green
            } else {
                Write-Host "فایل اجرای خودکار یافت نشد (قبلاً حذف شده است)." -ForegroundColor Yellow
            }
            Read-Host "برای بازگشت به منو Enter بزنید"
        }
        "6" {
            break
        }
        default {
            Write-Host "گزینه نامعتبر است. لطفا عددی بین ۱ تا ۶ وارد کنید." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
