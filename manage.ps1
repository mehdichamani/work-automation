$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Header {
    Clear-Host
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host "   Urmia Shishe Sachi Office Automation App   " -ForegroundColor Cyan
    Write-Host "          Management & Startup Utility        " -ForegroundColor Cyan
    Write-Host "==============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Menu {
    Show-Header
    Write-Host "Please select an option:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "--- Database Actions ---" -ForegroundColor Gray
    Write-Host "1. Initialize/Create Local Database (If not exists)"
    Write-Host "2. Check Local PostgreSQL Service Status"
    Write-Host "3. Start Local PostgreSQL Service (Needs Admin)"
    Write-Host "4. Reset/Wipe Local Database (Fresh Start)"
    Write-Host ""
    Write-Host "--- Application Actions (Backend + Frontend) ---" -ForegroundColor Gray
    Write-Host "5. Install Application (Npm Install & Build)"
    Write-Host "6. Start Application (PM2 Cluster Start)"
    Write-Host "7. Stop Application (PM2 Cluster Stop)"
    Write-Host ""
    Write-Host "--- Autostart Actions ---" -ForegroundColor Gray
    Write-Host "8. Enable Autostart on user login"
    Write-Host "9. Disable Autostart on user login"
    Write-Host ""
    Write-Host "--- System ---" -ForegroundColor Gray
    Write-Host "10. Exit"
    Write-Host ""
    $choice = Read-Host "Enter option (1-10)"
    return $choice
}

do {
    $c = Menu
    switch ($c) {
        "1" {
            Show-Header
            Write-Host "Initializing Local PostgreSQL Database..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            node database/init_local_db.js
            Read-Host "`nPress Enter to return to the menu..."
        }
        "2" {
            Show-Header
            Write-Host "Checking local PostgreSQL service status..." -ForegroundColor Green
            $services = Get-Service -Name *postgres* -ErrorAction SilentlyContinue
            if ($services) {
                foreach ($s in $services) {
                    $color = if ($s.Status -eq 'Running') { 'Green' } else { 'Yellow' }
                    Write-Host "Service: $($s.Name) ($($s.DisplayName)) - " -NoNewline -ForegroundColor Gray
                    Write-Host "$($s.Status)" -ForegroundColor $color
                }
            } else {
                Write-Host "No PostgreSQL service found on this system. Please verify installation." -ForegroundColor Red
            }
            Read-Host "`nPress Enter to return to the menu..."
        }
        "3" {
            Show-Header
            Write-Host "Attempting to start PostgreSQL service..." -ForegroundColor Green
            $services = Get-Service -Name *postgres* -ErrorAction SilentlyContinue
            if ($services) {
                foreach ($s in $services) {
                    if ($s.Status -eq 'Running') {
                        Write-Host "Service '$($s.Name)' is already running." -ForegroundColor Green
                    } else {
                        Write-Host "Starting service '$($s.Name)'..." -ForegroundColor Yellow
                        try {
                            Start-Service -Name $s.Name -ErrorAction Stop
                            Write-Host "Service started successfully!" -ForegroundColor Green
                        } catch {
                            Write-Host "Failed to start service: $_" -ForegroundColor Red
                            Write-Host "Note: Starting services may require Administrator privileges. Try running this prompt/PowerShell as Administrator." -ForegroundColor Yellow
                        }
                    }
                }
            } else {
                Write-Host "No PostgreSQL service found." -ForegroundColor Red
            }
            Read-Host "`nPress Enter to return to the menu..."
        }
        "4" {
            Show-Header
            Write-Host "Resetting Local Database (Fresh Start)..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            node database/reset_local_db.js
            Read-Host "`nPress Enter to return to the menu..."
        }
        "5" {
            Show-Header
            Write-Host "[1/3] Installing backend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`nError: npm install failed in backend!" -ForegroundColor Red
                Read-Host "Press Enter to return to the menu..."
                return
            }
            
            Write-Host "`n[2/3] Installing frontend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\frontend"
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`nError: npm install failed in frontend!" -ForegroundColor Red
                Read-Host "Press Enter to return to the menu..."
                return
            }
            
            Write-Host "`n[3/3] Generating React production bundle (Build)..." -ForegroundColor Green
            # Run build via node directly to bypass Windows PowerShell script execution restrictions
            node node_modules/vite/bin/vite.js build
            if ($LASTEXITCODE -ne 0) {
                Write-Host "`nWarning: Vite direct build failed, attempting fallback npm run build..." -ForegroundColor Yellow
                npm run build
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "`nError: Frontend build failed!" -ForegroundColor Red
                    Read-Host "Press Enter to return to the menu..."
                    return
                }
            }
            
            Write-Host "`nApplication install and build completed successfully!" -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "6" {
            Show-Header
            Write-Host "Starting server cluster with PM2..." -ForegroundColor Green
            Set-Location $scriptDir
            
            # Start via PM2
            pm2 start ecosystem.config.js
            
            Write-Host "`nApplication successfully started. Opening browser..." -ForegroundColor Green
            Start-Process "http://localhost:2833"
            Read-Host "Press Enter to return to the menu..."
        }
        "7" {
            Show-Header
            Write-Host "Stopping server cluster in PM2..." -ForegroundColor Green
            Set-Location $scriptDir
            pm2 delete ecosystem.config.js
            Write-Host "`nApplication has stopped." -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "8" {
            Show-Header
            Write-Host "Setting up autostart..." -ForegroundColor Green
            $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
            $shortcutPath = [System.IO.Path]::Combine($startupFolder, "EdariAutoStart.vbs")
            $sourceVbs = [System.IO.Path]::Combine($scriptDir, "auto-start.vbs")
            
            try {
                Copy-Item -Path $sourceVbs -Destination $shortcutPath -Force
                Write-Host "Autostart script registered successfully!" -ForegroundColor Green
                Write-Host "Path: $shortcutPath" -ForegroundColor Gray
            } catch {
                Write-Host "Failed to register autostart: $_" -ForegroundColor Red
            }
            Read-Host "Press Enter to return to the menu..."
        }
        "9" {
            Show-Header
            Write-Host "Removing autostart..." -ForegroundColor Green
            $startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
            $shortcutPath = [System.IO.Path]::Combine($startupFolder, "EdariAutoStart.vbs")
            
            if (Test-Path $shortcutPath) {
                Remove-Item -Path $shortcutPath -Force
                Write-Host "Autostart removed successfully." -ForegroundColor Green
            } else {
                Write-Host "Autostart script not found (already removed)." -ForegroundColor Yellow
            }
            Read-Host "Press Enter to return to the menu..."
        }
        "10" {
            break
        }
        default {
            Write-Host "Invalid option. Please enter a number between 1 and 10." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
