#Requires -Version 5.1
<#
.SYNOPSIS
    Urmia Shishe Sachi Automation System - Native Manager (PowerShell TUI & CLI)
.DESCRIPTION
    Interactive TUI launcher, health-check utility, and management automation script.
    Supports Persian and English dual-language output with clean layout alignment and CLI parameters.
.EXAMPLE
    .\manage.ps1
.EXAMPLE
    .\manage.ps1 -Action start -Port 2833
.EXAMPLE
    .\manage.ps1 -Action update
.EXAMPLE
    .\manage.ps1 -Action check
#>

[CmdletBinding()]
param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "restart", "status", "check", "install", "init-db", "reset-db", "enable-startup", "disable-startup", "update", "deploy", "help", "")]
    [string]$Action = "",

    [Parameter(Position=1)]
    [int]$Port = 0,

    [switch]$NoBrowser,
    [switch]$Force
)

# تنظیم انکودینگ خروجی ترمینال به UTF-8
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$StartupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$StartupShortcut = [System.IO.Path]::Combine($StartupFolder, "EdariAutoStart.vbs")
$SourceVbs = [System.IO.Path]::Combine($ScriptDir, "auto-start.vbs")

# -------------------------------------------------------------
# توابع چاپ دو زبانه و شکیل با همترازی تمیز
# -------------------------------------------------------------
function Write-LogInfo ($label, $en, $fa) {
    Write-Host "  [$label] " -NoNewline -ForegroundColor Cyan
    Write-Host "$en " -NoNewline -ForegroundColor White
    if ($fa) { Write-Host "| $fa" -ForegroundColor Gray } else { Write-Host "" }
}

function Write-LogOk ($label, $en, $fa) {
    Write-Host "  [OK] " -NoNewline -ForegroundColor Green
    Write-Host "${label}: " -NoNewline -ForegroundColor White
    Write-Host "$en " -NoNewline -ForegroundColor White
    if ($fa) { Write-Host "| $fa" -ForegroundColor Gray } else { Write-Host "" }
}

function Write-LogWarn ($label, $en, $fa) {
    Write-Host "  [WARN] " -NoNewline -ForegroundColor Yellow
    Write-Host "${label}: " -NoNewline -ForegroundColor White
    Write-Host "$en " -NoNewline -ForegroundColor White
    if ($fa) { Write-Host "| $fa" -ForegroundColor Gray } else { Write-Host "" }
}

function Write-LogErr ($label, $en, $fa) {
    Write-Host "  [ERROR] " -NoNewline -ForegroundColor Red
    Write-Host "${label}: " -NoNewline -ForegroundColor White
    Write-Host "$en " -NoNewline -ForegroundColor White
    if ($fa) { Write-Host "| $fa" -ForegroundColor Gray } else { Write-Host "" }
}

# -------------------------------------------------------------
# مدیریت فایل .env
# -------------------------------------------------------------
function Ensure-Env {
    $envPath = Join-Path $ScriptDir ".env"
    if (-not (Test-Path $envPath)) {
        $examplePath = Join-Path $ScriptDir ".env.example"
        if (Test-Path $examplePath) {
            Write-LogWarn ".env" "File missing. Copying from .env.example..." "فایل .env یافت نشد؛ ایجاد از روی نمونه..."
            try {
                Copy-Item -Path $examplePath -Destination $envPath -Force
                Write-LogOk ".env" "Created successfully. Please review database credentials." "فایل پیکربندی با موفقیت ایجاد شد."
            } catch {
                Write-LogErr ".env" "Failed to create .env file: $_" "خطا در ساخت فایل پیکربندی."
            }
        } else {
            Write-LogWarn ".env" "Neither .env nor .env.example found." "فایل‌های پیکربندی در ریشه پروژه یافت نشدند."
        }
    }
}

function Load-Env {
    Ensure-Env
    $envPath = Join-Path $ScriptDir ".env"
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $parts = $line.Split("=", 2)
                $key = $parts[0].Trim()
                $value = $parts[1].Trim().Trim('"').Trim("'")
                [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            }
        }
    }
}

Load-Env

function Get-AppPort {
    if ($Port -gt 0) { return $Port }
    if ($env:PORT) { return [int]$env:PORT }
    return 2833
}

function Open-BrowserUrl ($url) {
    if (-not $NoBrowser) {
        Write-LogInfo "Browser" "Opening browser at $url..." "در حال باز کردن مرورگر..."
        try {
            Start-Process $url
        } catch {
            Write-LogWarn "Browser" "Failed to open browser automatically." "خطا در باز کردن خودکار مرورگر."
        }
    }
}

# -------------------------------------------------------------
# وضعیت سرویس‌ها
# -------------------------------------------------------------
function Get-PostgresStatus {
    if ($IsWindows -or $env:OS -like "*Windows*") {
        $services = Get-Service -Name *postgres* -ErrorAction SilentlyContinue
        if ($services) {
            $running = $services | Where-Object { $_.Status -eq 'Running' }
            if ($running) {
                return @{ Status = "Running"; Color = "Green"; Label = "RUNNING | فعال"; Services = $services }
            } else {
                return @{ Status = "Stopped"; Color = "Yellow"; Label = "STOPPED | متوقف"; Services = $services }
            }
        }
    }
    return @{ Status = "Unknown"; Color = "DarkGray"; Label = "UNKNOWN | نامشخص"; Services = @() }
}

function Get-Pm2Status {
    # روش سریع و آنی (زیر ۵ میلی‌ثانیه): بررسی فایل PID و پروسه فعال
    $pm2PidDir = [System.IO.Path]::Combine($env:USERPROFILE, ".pm2\pids")
    if (Test-Path $pm2PidDir) {
        $pidFiles = Get-ChildItem -Path $pm2PidDir -Filter "*.pid" -ErrorAction SilentlyContinue
        foreach ($pf in $pidFiles) {
            try {
                $pidVal = (Get-Content $pf.FullName -ErrorAction SilentlyContinue).Trim()
                if ($pidVal) {
                    $proc = Get-Process -Id ([int]$pidVal) -ErrorAction SilentlyContinue
                    if ($proc -and -not $proc.HasExited) {
                        return @{ Status = "Online"; Color = "Green"; Label = "ONLINE | فعال"; Apps = @($proc) }
                    }
                }
            } catch {}
        }
    }

    # بررسی سریع پورت سامانه
    try {
        $checkPort = Get-AppPort
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $iar = $tcpClient.BeginConnect("127.0.0.1", $checkPort, $null, $null)
        $wh = $iar.AsyncWaitHandle.WaitOne(50)
        if ($wh -and $tcpClient.Connected) {
            $tcpClient.Close()
            return @{ Status = "Online"; Color = "Green"; Label = "ONLINE | فعال"; Apps = @() }
        }
        $tcpClient.Close()
    } catch {}

    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        return @{ Status = "Stopped"; Color = "DarkGray"; Label = "STOPPED | غیرفعال"; Apps = @() }
    }
    return @{ Status = "NoPM2"; Color = "DarkGray"; Label = "NOT INSTALLED | نصب نیست"; Apps = @() }
}

function Get-StartupStatus {
    if (Test-Path $StartupShortcut) {
        return @{ Status = "Enabled"; Color = "Green"; Label = "ENABLED | فعال" }
    }
    return @{ Status = "Disabled"; Color = "DarkGray"; Label = "DISABLED | غیرفعال" }
}

# -------------------------------------------------------------
# عملیات پایگاه داده
# -------------------------------------------------------------
function Initialize-Database {
    Write-Host "`n══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Database Initialization | آماده‌سازی و ساخت پایگاه داده" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

    Write-LogInfo "Prisma" "Running database migrations (migrate deploy)..." "در حال اجرای مایگریشن‌ها..."
    Set-Location (Join-Path $ScriptDir "backend")
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        Write-LogErr "Prisma" "Prisma migrate deploy failed. Check PostgreSQL service and .env." "خطا در مایگریشن دیتابیس! دسترسی PostgreSQL و فایل .env را بررسی کنید."
        Set-Location $ScriptDir
        return $false
    }

    Write-LogInfo "Prisma" "Generating Prisma Client..." "در حال تولید کلاینت پریزما..."
    npx prisma generate
    if ($LASTEXITCODE -ne 0) {
        Write-LogErr "Prisma" "Prisma client generation failed." "خطا در تولید کلاینت پریزما."
        Set-Location $ScriptDir
        return $false
    }

    Write-LogInfo "Prisma" "Seeding database with default records..." "در حال درج اطلاعات اولیه (Seed)..."
    npm run db:seed
    if ($LASTEXITCODE -ne 0) {
        Write-LogWarn "Seed" "Seed completed with warnings (records may already exist)." "داده‌های اولیه احتمالاً قبلاً ثبت شده‌اند."
    } else {
        Write-LogOk "Seed" "Default seed data applied successfully." "داده‌های اولیه با موفقیت درج شدند."
    }

    Set-Location $ScriptDir
    Write-LogOk "Database" "Database initialized and ready." "پایگاه داده با موفقیت آماده‌سازی شد."
    return $true
}

function Start-PostgresService {
    Write-LogInfo "Postgres" "Checking PostgreSQL service..." "بررسی سرویس دیتابیس..."
    if ($IsWindows -or $env:OS -like "*Windows*") {
        $services = Get-Service -Name *postgres* -ErrorAction SilentlyContinue
        if ($services) {
            foreach ($s in $services) {
                if ($s.Status -eq 'Running') {
                    Write-LogOk "Postgres" "Service '$($s.Name)' is already running." "سرویس '$($s.Name)' در حال اجراست."
                } else {
                    Write-LogInfo "Postgres" "Starting service '$($s.Name)'..." "در حال راه‌اندازی سرویس '$($s.Name)'..."
                    try {
                        Start-Service -Name $s.Name -ErrorAction Stop
                        Write-LogOk "Postgres" "Service '$($s.Name)' started successfully." "سرویس با موفقیت راه‌اندازی شد."
                    } catch {
                        Write-LogErr "Postgres" "Failed to start service: $_" "خطا در شروع سرویس. لطفاً با دسترسی ادمین (Run as Administrator) اجرا کنید."
                    }
                }
            }
        } else {
            Write-LogErr "Postgres" "No PostgreSQL service found on this Windows system." "سرویس PostgreSQL در این سیستم یافت نشد."
        }
    } else {
        Write-LogWarn "Postgres" "Please start PostgreSQL using your system service manager (e.g. systemctl start postgresql)." "لطفاً از طریق سرویس‌های سیستم‌عامل دیتابیس را فعال کنید."
    }
}

function Reset-Database {
    if (-not $Force) {
        Write-Host "`n══════════════════════════════════════════════════════════════════════" -ForegroundColor Red
        Write-Host "  WARNING: COMPLETE DATABASE RESET | هشدار: پاکسازی کامل دیتابیس" -ForegroundColor Red
        Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor Red
        Write-Host "  This action will permanently delete all tables, users, logs and system data." -ForegroundColor White
        Write-Host "  | تمام داده‌ها، کاربران، لاگ‌ها و جداول به طور دائم حذف خواهند شد." -ForegroundColor Gray
        Write-Host ""
        $confirm = Read-Host "Are you sure you want to reset the database? [y/N] | آیا کاملاً مطمئن هستید؟"
        if ($confirm -notmatch "^[Yy]$") {
            Write-LogInfo "Reset" "Database reset cancelled by user." "عملیات لغو شد."
            return
        }
    }

    Write-LogInfo "Prisma" "Resetting database with Prisma (migrate reset --force)..." "در حال پاکسازی و بازسازی دیتابیس..."
    Set-Location (Join-Path $ScriptDir "backend")
    npx prisma migrate reset --force
    if ($LASTEXITCODE -ne 0) {
        Write-LogErr "Prisma" "Prisma migrate reset failed." "خطا در پاکسازی و بازنشانی دیتابیس."
    } else {
        npx prisma generate
        Write-LogInfo "Prisma" "Seeding fresh database..." "در حال درج اطلاعات اولیه..."
        npm run db:seed
        Write-LogOk "Database" "Database reset & re-seeded successfully." "دیتابیس کاملاً نوسازی و آماده شد."
    }
    Set-Location $ScriptDir
}

# -------------------------------------------------------------
# عملیات نصب و بیلد نرم‌افزار
# -------------------------------------------------------------
function Install-Application {
    Write-Host "`n══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Full Application Setup & Build | نصب پکیج‌ها و ساخت نسخه نهایی" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

    $success = $true

    Write-LogInfo "Setup" "[1/4] Installing backend dependencies..." "[۱/۴] در حال نصب پکیج‌های بک‌اند..."
    Set-Location (Join-Path $ScriptDir "backend")
    npm install --include=dev --ignore-scripts
    if ($LASTEXITCODE -ne 0) {
        Write-LogErr "Setup" "Backend npm install failed!" "خطا در نصب پکیج‌های بک‌اند!"
        $success = $false
    }

    if ($success) {
        Write-LogInfo "Setup" "[2/4] Generating Prisma Client..." "[۲/۴] در حال ساخت کلاینت پریزما..."
        npx prisma generate
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Setup" "Prisma generate failed!" "خطا در تولید کلاینت پریزما!"
            $success = $false
        }
    }

    if ($success) {
        Write-LogInfo "Setup" "[3/4] Installing frontend dependencies..." "[۳/۴] در حال نصب پکیج‌های فرانت‌اند..."
        Set-Location (Join-Path $ScriptDir "frontend")
        npm install --include=dev
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Setup" "Frontend npm install failed!" "خطا در نصب پکیج‌های فرانت‌اند!"
            $success = $false
        }
    }

    if ($success) {
        Write-LogInfo "Setup" "[4/4] Building React frontend production bundle..." "[۴/۴] در حال بیلد بهینه فرانت‌اند (Vite/React)..."
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Setup" "Frontend build failed!" "خطا در ساخت باندل فرانت‌اند!"
            $success = $false
        }
    }

    Set-Location $ScriptDir

    if ($success) {
        Write-LogOk "Setup" "All packages installed & frontend built successfully!" "عملیات نصب و بیلد با موفقیت کامل انجام شد."
    } else {
        Write-LogErr "Setup" "Application setup encountered errors. Please check the logs above." "نصب نرم‌افزار با خطا مواجه شد."
    }
}

# -------------------------------------------------------------
# مدیریت اجرای برنامه (PM2 & Dev Mode)
# -------------------------------------------------------------
function Ensure-Pm2 {
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        return $true
    }
    Write-LogWarn "PM2" "PM2 not found globally. Attempting global install..." "ابزار PM2 یافت نشد. در حال نصب..."
    npm install -g pm2
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        Write-LogOk "PM2" "PM2 installed globally." "ابزار PM2 با موفقیت نصب شد."
        return $true
    }
    Write-LogErr "PM2" "Failed to install PM2 automatically. Run: npm install -g pm2" "نصب خودکار PM2 ناموفق بود."
    return $false
}

function Start-Application {
    $hasPm2 = Ensure-Pm2
    $appPort = Get-AppPort

    if ($hasPm2) {
        Write-LogInfo "App" "Starting application cluster with PM2..." "در حال راه‌اندازی سرور با PM2..."
        Set-Location $ScriptDir
        pm2 start ecosystem.config.js
        if ($LASTEXITCODE -eq 0) {
            Write-LogOk "App" "Application started on port $appPort." "سامانه با موفقیت روی پورت $appPort اجرا شد."
            Open-BrowserUrl "http://localhost:$appPort"
        } else {
            Write-LogErr "App" "PM2 failed to start the application." "راه‌اندازی با PM2 با خطا مواجه شد."
        }
    } else {
        Write-LogWarn "App" "Starting in foreground fallback mode (node backend/server.js)..." "اجرای مستقیم بدون PM2..."
        Set-Location (Join-Path $ScriptDir "backend")
        Open-BrowserUrl "http://localhost:$appPort"
        node server.js
    }
}

function Stop-Application {
    Write-LogInfo "App" "Stopping application cluster..." "در حال متوقف کردن سامانه..."
    Set-Location $ScriptDir
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        pm2 delete ecosystem.config.js
        Write-LogOk "App" "Application stopped in PM2." "سرویس سامانه در PM2 متوقف شد."
    } else {
        Write-LogWarn "App" "PM2 is not running." "سرویس PM2 فعال نبود."
    }
}

function Restart-Application {
    Write-LogInfo "App" "Restarting application cluster..." "در حال بازنشانی و راه‌اندازی مجدد سامانه..."
    Set-Location $ScriptDir
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        pm2 restart ecosystem.config.js
        if ($LASTEXITCODE -ne 0) {
            Write-LogWarn "App" "PM2 restart failed, attempting fresh start..." "تلاش مجدد برای استارت..."
            pm2 start ecosystem.config.js
        }
        $appPort = Get-AppPort
        Write-LogOk "App" "Application restarted on port $appPort." "سامانه با موفقیت مجدداً راه‌اندازی شد."
    } else {
        Start-Application
    }
}

# -------------------------------------------------------------
# مدیریت استارت‌آپ ویندوز (Auto-Start)
# -------------------------------------------------------------
function Enable-Startup {
    Write-LogInfo "Startup" "Enabling Windows Auto-Start..." "در حال فعالسازی اجرای خودکار هنگام ورود به ویندوز..."
    if ($IsWindows -or $env:OS -like "*Windows*") {
        try {
            if (-not (Test-Path $SourceVbs)) {
                # Create default auto-start VBS if missing
                $vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$ScriptDir"
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptDir\manage.ps1`" -Action start -NoBrowser", 0, False
"@
                Set-Content -Path $SourceVbs -Value $vbsContent -Encoding ASCII
            }
            Copy-Item -Path $SourceVbs -Destination $StartupShortcut -Force
            Write-LogOk "Startup" "Auto-Start enabled successfully." "اجرای خودکار ویندوز فعال شد."
            Write-Host "       Target: $StartupShortcut" -ForegroundColor Gray
        } catch {
            Write-LogErr "Startup" "Failed to enable Auto-Start: $_" "خطا در تنظیم اجرای خودکار."
        }
    } else {
        Write-LogWarn "Startup" "Auto-Start is only supported on Windows." "این قابلیت فقط در محیط ویندوز پشتیبانی می‌شود."
    }
}

function Disable-Startup {
    Write-LogInfo "Startup" "Disabling Windows Auto-Start..." "در حال غیرفعالسازی اجرای خودکار ویندوز..."
    if (Test-Path $StartupShortcut) {
        Remove-Item $StartupShortcut -Force
        Write-LogOk "Startup" "Auto-Start removed successfully." "اجرای خودکار با موفقیت غیرفعال شد."
    } else {
        Write-LogWarn "Startup" "Auto-Start was not enabled." "اجرای خودکار فعال نبود."
    }
}

# -------------------------------------------------------------
# بروزرسانی از گیت و پیاده‌سازی کامل (Update from Git & Deploy)
# -------------------------------------------------------------
function Update-FromGitAndDeploy {
    Write-Host "`n══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Update from Git & Deploy | بروزرسانی از گیت و پیاده‌سازی سرور" -ForegroundColor Cyan
    Write-Host "  (Git Pull + DB Migrations + Frontend Build + PM2 Reload)" -ForegroundColor Gray
    Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

    $success = $true

    # 1. Git Pull
    if ($success) {
        Write-LogInfo "Git" "[1/6] Pulling latest code changes from repository..." "[۱/۶] دریافت آخرین تغییرات سورس کد از گیت..."
        Set-Location $ScriptDir
        if (Get-Command git -ErrorAction SilentlyContinue) {
            $gitOutput = git pull origin main 2>&1
            Write-Host "       $gitOutput" -ForegroundColor DarkGray
            if ($LASTEXITCODE -ne 0) {
                Write-LogWarn "Git" "git pull returned non-zero. Continuing with current workspace." "دریافت تغییرات گیت با اخطار همراه بود یا اتصال به اینترنت/سرور گیت وجود ندارد."
            } else {
                $lastCommit = git log -1 --pretty=format:"%h - %s (%cr)" 2>$null
                if ($lastCommit) {
                    Write-LogOk "Git" "Latest commit: $lastCommit" "آخرین کامیت فعال شد"
                }
            }
        } else {
            Write-LogWarn "Git" "Git command not found. Skipping git pull." "ابزار گیت یافت نشد؛ ادامه با فایل‌های فعلی."
        }
    }

    # 2. Backend Packages
    if ($success) {
        Write-LogInfo "Backend" "[2/6] Updating backend dependencies..." "[۲/۶] بررسی و بروزرسانی پکیج‌های بک‌اند..."
        Set-Location (Join-Path $ScriptDir "backend")
        npm install --include=dev --ignore-scripts
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Backend" "Backend npm install failed!" "خطا در نصب وابستگی‌های بک‌اند!"
            $success = $false
        }
    }

    # 3. Prisma Generate
    if ($success) {
        Write-LogInfo "Prisma" "[3/6] Generating Prisma Client..." "[۳/۶] ساخت و همگام‌سازی کلاینت دیتابیس پریزما..."
        npx prisma generate
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Prisma" "Prisma client generation failed!" "خطا در ساخت کلاینت پریزما!"
            $success = $false
        }
    }

    # 4. Database Migrations
    if ($success) {
        Write-LogInfo "Database" "[4/6] Applying database migrations (Prisma migrate deploy)..." "[۴/۶] اعمال تغییرات و ساختارهای جدید به پایگاه داده..."
        Set-Location (Join-Path $ScriptDir "backend")
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Database" "Database migrations failed! Check PostgreSQL service." "خطا در اعمال مایگریشن‌های پایگاه داده!"
            $success = $false
        } else {
            Write-LogOk "Database" "Database migrations applied successfully." "تغییرات دیتابیس با موفقیت اعمال شد."
        }
    }

    # 5. Frontend Build
    if ($success) {
        Write-LogInfo "Frontend" "[5/6] Installing frontend packages & compiling production bundle..." "[۵/۶] نصب و بیلد بهینه فرانت‌اند React/Vite..."
        Set-Location (Join-Path $ScriptDir "frontend")
        npm install --include=dev
        if ($LASTEXITCODE -ne 0) {
            Write-LogErr "Frontend" "Frontend npm install failed!" "خطا در نصب پکیج‌های فرانت‌اند!"
            $success = $false
        } else {
            npm run build
            if ($LASTEXITCODE -ne 0) {
                Write-LogErr "Frontend" "Frontend production build failed!" "خطا در بیلد نسخه نهایی فرانت‌اند!"
                $success = $false
            } else {
                Write-LogOk "Frontend" "Frontend build completed successfully." "باندل فرانت‌اند با موفقیت ساخته شد."
            }
        }
    }

    # 6. PM2 Reload / Restart
    if ($success) {
        Write-LogInfo "Server" "[6/6] Reloading application processes with PM2..." "[۶/۶] راه‌اندازی مجدد و بدون قطعی سرور با PM2..."
        Restart-Application
    }

    Set-Location $ScriptDir

    if ($success) {
        $appPort = Get-AppPort
        Write-Host ""
        Write-LogOk "Deploy" "Update & Deploy completed successfully! Web URL: http://localhost:$appPort" "بروزرسانی از گیت و پیاده‌سازی با موفقیت انجام شد."
    } else {
        Write-Host ""
        Write-LogErr "Deploy" "Deploy pipeline encountered errors. Please check the logs above." "عملیات بروزرسانی و پیاده‌سازی ناموفق بود."
    }
}

# -------------------------------------------------------------
# پایش سلامت سیستم (Health Check)
# -------------------------------------------------------------
function Test-HealthCheck {
    Write-Host "`n══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  System Health Check | پایش سلامت و نیازمندی‌های سیستم" -ForegroundColor Cyan
    Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

    # Node.js
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVer = (node --version 2>&1).Trim()
        Write-LogOk "Node.js" "$nodeVer" "نود جی‌اس آماده است"
    } else {
        Write-LogErr "Node.js" "Not Installed!" "نود جی‌اس نصب نیست!"
    }

    # NPM
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $npmVer = (npm --version 2>&1).Trim()
        Write-LogOk "NPM" "v$npmVer" "مدیر پکیج npm آماده است"
    } else {
        Write-LogErr "NPM" "Not Found!" "ابزار npm یافت نشد!"
    }

    # PM2
    if (Get-Command pm2 -ErrorAction SilentlyContinue) {
        $pm2Ver = (pm2 --version 2>&1).Trim()
        Write-LogOk "PM2" "v$pm2Ver (Process Manager)" "مدیریت پروسه PM2 نصب است"
    } else {
        Write-LogWarn "PM2" "Not installed globally" "ابزار PM2 به صورت سراسری نصب نیست"
    }

    # Git
    if (Get-Command git -ErrorAction SilentlyContinue) {
        $gitVer = (git --version 2>&1).Trim()
        Write-LogOk "Git" "$gitVer" "کنترل نسخه Git آماده است"
    } else {
        Write-LogWarn "Git" "Git not found in PATH" "ابزار گیت در دسترس نیست"
    }

    # Configuration .env
    if (Test-Path (Join-Path $ScriptDir ".env")) {
        Write-LogOk "Config" ".env file exists" "فایل تنظیمات .env موجود است"
    } else {
        Write-LogWarn "Config" ".env missing (will use .env.example)" "فایل .env یافت نشد"
    }

    # Prisma Schema
    $schemaPath = Join-Path $ScriptDir "backend\prisma\schema.prisma"
    if (Test-Path $schemaPath) {
        Write-LogOk "Prisma" "schema.prisma verified" "مدل دیتابیس پریزما تایید شد"
    } else {
        Write-LogErr "Prisma" "schema.prisma missing!" "فایل مدل پریزما یافت نشد!"
    }

    # Frontend Dist Build
    $distPath = Join-Path $ScriptDir "frontend\dist"
    if (Test-Path $distPath) {
        Write-LogOk "Frontend" "Production build exists (dist/)" "باندل فرانت‌اند آماده است"
    } else {
        Write-LogWarn "Frontend" "dist/ not found. Run option 7 to build." "فرانت‌اند بیلد نشده است"
    }

    # Uploads Dir
    $uploadsPath = Join-Path $ScriptDir "backend\uploads"
    if (-not (Test-Path $uploadsPath)) {
        New-Item -ItemType Directory -Path $uploadsPath -Force | Out-Null
    }
    Write-LogOk "Uploads" "uploads/ folder ready" "دایرکتوری فایل‌های ضمیمه آماده است"

    Write-Host "──────────────────────────────────────────────────────────────────────" -ForegroundColor DarkCyan
    Write-Host "  Service Status | وضعیت سرویس‌ها:" -ForegroundColor White

    # PostgreSQL Service
    $pg = Get-PostgresStatus
    Write-Host "  PostgreSQL Service: " -NoNewline -ForegroundColor White
    Write-Host "$($pg.Label)" -ForegroundColor $pg.Color

    # PM2 App Cluster
    $pm2 = Get-Pm2Status
    Write-Host "  PM2 App Cluster:    " -NoNewline -ForegroundColor White
    Write-Host "$($pm2.Label)" -ForegroundColor $pm2.Color

    # Auto-Start
    $st = Get-StartupStatus
    Write-Host "  Windows Auto-Start: " -NoNewline -ForegroundColor White
    Write-Host "$($st.Label)" -ForegroundColor $st.Color

    $appPort = Get-AppPort
    Write-Host "  Application URL:    " -NoNewline -ForegroundColor White
    Write-Host "http://localhost:$appPort" -ForegroundColor Cyan

    Write-Host "══════════════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
}

# -------------------------------------------------------------
# منوی تعاملی کاربر (Interactive TUI Menu)
# -------------------------------------------------------------
function Show-TuiMenu {
    while ($true) {
        Clear-Host
        $pg = Get-PostgresStatus
        $pm2 = Get-Pm2Status
        $st = Get-StartupStatus
        $appPort = Get-AppPort

        Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
        Write-Host "     Urom Shishe Sachi Office Automation System (TUI)     " -ForegroundColor Cyan
        Write-Host "        سامانه اتوماسیون اداری اروم شیشه ساچی | مدیریت سیستم" -ForegroundColor Gray
        Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan

        Write-Host "  --- Service Management | مدیریت سرویس و سامانه ---" -ForegroundColor DarkGray
        
        Write-Host "  [1] Start Application (PM2 Cluster) | اجرای سامانه        " -NoNewline -ForegroundColor White
        Write-Host "[$($pm2.Status)]" -ForegroundColor $pm2.Color

        Write-Host "  [2] Stop Application                | توقف سامانه" -ForegroundColor White
        Write-Host "  [3] Restart Application             | راه‌اندازی مجدد سامانه" -ForegroundColor White

        Write-Host "`n  --- Database Operations | عملیات پایگاه داده ---" -ForegroundColor DarkGray
        Write-Host "  [4] Start PostgreSQL Service        | شروع سرویس دیتابیس  " -NoNewline -ForegroundColor White
        Write-Host "[$($pg.Status)]" -ForegroundColor $pg.Color

        Write-Host "  [5] Initialize & Seed Database      | ساخت و مقداردهی اولیه پایگاه داده" -ForegroundColor White
        Write-Host "  [6] Reset / Wipe Database           | پاکسازی و بازنشانی کامل دیتابیس" -ForegroundColor Red

        Write-Host "`n  --- Setup & Production Deploy | پیکربندی و پیاده‌سازی سرور ---" -ForegroundColor DarkGray
        Write-Host "  [7] Full Setup (Install & Build)    | نصب پکیج‌ها و بیلد فرانت‌اند" -ForegroundColor White
        Write-Host "  [8] Update from Git & Deploy        | بروزرسانی از گیت و پیاده‌سازی سرور" -ForegroundColor Cyan
        Write-Host "  [9] System Health Check             | پایش سلامت و وضعیت سیستم" -ForegroundColor White

        Write-Host "`n  --- System & Startup | تنظیمات ویندوز و خروج ---" -ForegroundColor DarkGray
        Write-Host "  [10] Enable Windows Auto-Start      | فعالسازی اجرای خودکار  " -NoNewline -ForegroundColor White
        Write-Host "[$($st.Status)]" -ForegroundColor $st.Color

        Write-Host "  [11] Disable Windows Auto-Start     | غیرفعالسازی اجرای خودکار" -ForegroundColor White
        Write-Host "  [0]  Exit                           | خروج" -ForegroundColor Gray
        Write-Host "══════════════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
        Write-Host "  Web Panel: http://localhost:$appPort" -ForegroundColor DarkCyan

        $choice = Read-Host "`nSelect Option [0-11] | انتخاب گزینه"

        switch ($choice) {
            "1" {
                Start-Application
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "2" {
                Stop-Application
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "3" {
                Restart-Application
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "4" {
                Start-PostgresService
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "5" {
                Initialize-Database
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "6" {
                Reset-Database
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "7" {
                Install-Application
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "8" {
                Update-FromGitAndDeploy
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "9" {
                Test-HealthCheck
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "10" {
                Enable-Startup
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "11" {
                Disable-Startup
                Read-Host "`nPress Enter to return | جهت بازگشت کلید Enter را بزنید..."
            }
            "0" {
                Write-Host "`nGoodbye! | به امید دیدار!" -ForegroundColor Green
                return
            }
            default {
                Write-Host "Invalid choice | گزینه نامعتبر است." -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
    }
}

# -------------------------------------------------------------
# پردازش سوییچ‌های خط فرمان (CLI Action Router)
# -------------------------------------------------------------
switch ($Action.ToLower()) {
    "start"           { Start-Application }
    "stop"            { Stop-Application }
    "restart"         { Restart-Application }
    "status"          { Test-HealthCheck }
    "check"           { Test-HealthCheck }
    "install"         { Install-Application }
    "init-db"         { Initialize-Database }
    "reset-db"        { Reset-Database }
    "enable-startup"  { Enable-Startup }
    "disable-startup" { Disable-Startup }
    "update"          { Update-FromGitAndDeploy }
    "deploy"          { Update-FromGitAndDeploy }
    "help"            {
        Write-Host "Urom Shishe Sachi Management Script Options:" -ForegroundColor Cyan
        Write-Host "  .\manage.ps1                            Interactive TUI Menu"
        Write-Host "  .\manage.ps1 -Action start -Port 2833   Start PM2 Cluster & Open Browser"
        Write-Host "  .\manage.ps1 -Action stop               Stop Application in PM2"
        Write-Host "  .\manage.ps1 -Action restart            Restart Application"
        Write-Host "  .\manage.ps1 -Action check              Perform System Health Check"
        Write-Host "  .\manage.ps1 -Action install            Install Dependencies & Build UI"
        Write-Host "  .\manage.ps1 -Action init-db            Run Prisma Migrations & Seed"
        Write-Host "  .\manage.ps1 -Action reset-db           Wipe & Re-seed Database"
        Write-Host "  .\manage.ps1 -Action enable-startup     Configure Windows Auto-Start"
        Write-Host "  .\manage.ps1 -Action disable-startup    Remove Windows Auto-Start"
        Write-Host "  .\manage.ps1 -Action update             Update from Git & Deploy to Server"
    }
    default           { Show-TuiMenu }
}