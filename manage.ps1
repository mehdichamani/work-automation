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
    Write-Host "1. Install Database (Pull Docker Image)"
    Write-Host "2. Start Database (Docker Compose Up)"
    Write-Host "3. Stop Database (Docker Compose Down)"
    Write-Host ""
    Write-Host "--- Application Actions (Backend + Frontend) ---" -ForegroundColor Gray
    Write-Host "4. Install Application (Npm Install & Build)"
    Write-Host "5. Start Application (PM2 Cluster Start)"
    Write-Host "6. Stop Application (PM2 Cluster Stop)"
    Write-Host ""
    Write-Host "--- Autostart Actions ---" -ForegroundColor Gray
    Write-Host "7. Enable Autostart on user login"
    Write-Host "8. Disable Autostart on user login"
    Write-Host ""
    Write-Host "--- System ---" -ForegroundColor Gray
    Write-Host "9. Exit"
    Write-Host ""
    $choice = Read-Host "Enter option (1-9)"
    return $choice
}

do {
    $c = Menu
    switch ($c) {
        "1" {
            Show-Header
            Write-Host "Pulling PostgreSQL Docker image..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose pull
            Write-Host "`nDocker pull completed." -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "2" {
            Show-Header
            Write-Host "Starting database in Docker..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose up -d
            Write-Host "`nDatabase is running." -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "3" {
            Show-Header
            Write-Host "Stopping database in Docker..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose down
            Write-Host "`nDatabase has stopped." -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "4" {
            Show-Header
            Write-Host "[1/3] Installing backend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            npm install
            
            Write-Host "`n[2/3] Installing frontend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\frontend"
            npm install
            
            Write-Host "`n[3/3] Generating React production bundle (Build)..." -ForegroundColor Green
            npm run build
            
            Write-Host "`nApplication install and build completed successfully!" -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "5" {
            Show-Header
            Write-Host "Starting server cluster with PM2..." -ForegroundColor Green
            Set-Location $scriptDir
            
            # Ensure PostgreSQL is running
            Set-Location "$scriptDir\docker"
            docker compose up -d
            Set-Location $scriptDir
            
            # Start via PM2
            pm2 start ecosystem.config.js
            
            Write-Host "`nApplication successfully started. Opening browser..." -ForegroundColor Green
            Start-Process "http://localhost:3001"
            Read-Host "Press Enter to return to the menu..."
        }
        "6" {
            Show-Header
            Write-Host "Stopping server cluster in PM2..." -ForegroundColor Green
            Set-Location $scriptDir
            pm2 delete ecosystem.config.js
            Write-Host "`nApplication has stopped." -ForegroundColor Green
            Read-Host "Press Enter to return to the menu..."
        }
        "7" {
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
        "8" {
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
        "9" {
            break
        }
        default {
            Write-Host "Invalid option. Please enter a number between 1 and 9." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
