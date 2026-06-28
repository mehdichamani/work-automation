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
    Write-Host "Please select one of the options below:" -ForegroundColor Yellow
    Write-Host "1. Install dependencies & Build Frontend (Install & Build)"
    Write-Host "2. Start PostgreSQL Database in Docker (Start Database)"
    Write-Host "3. Start Application with PM2 Cluster (Start Frontend + Backend)"
    Write-Host "4. Enable Autostart on user login (Setup Auto-Start)"
    Write-Host "5. Disable Autostart on user login (Remove Auto-Start)"
    Write-Host "6. Exit"
    Write-Host ""
    $choice = Read-Host "Enter option (1-6)"
    return $choice
}

do {
    $c = Menu
    switch ($c) {
        "1" {
            Show-Header
            Write-Host "[1/4] Installing backend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\backend"
            npm install
            
            Write-Host "`n[2/4] Installing frontend dependencies..." -ForegroundColor Green
            Set-Location "$scriptDir\frontend"
            npm install
            
            Write-Host "`n[3/4] Generating React production bundle (Build)..." -ForegroundColor Green
            npm run build
            
            Write-Host "`n[4/4] Pulling PostgreSQL Docker image..." -ForegroundColor Green
            Set-Location "$scriptDir\docker"
            docker compose pull
            
            Write-Host "`nInstallation and build completed successfully!" -ForegroundColor Green
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
        "4" {
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
                Write-Host "Failed to register autostart script: $_" -ForegroundColor Red
            }
            Read-Host "Press Enter to return to the menu..."
        }
        "5" {
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
        "6" {
            break
        }
        default {
            Write-Host "Invalid option. Please enter a number between 1 and 6." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
