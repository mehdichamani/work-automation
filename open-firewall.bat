@echo off
title UromSachi Firewall Port Opener
:: BatchGotAdmin
:-------------------------------------
REM --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"=""
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

set APP_PORT=2833
if "%~1" NEQ "" (
    set APP_PORT=%~1
) else if exist ".env" (
    for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
        if /i "%%A"=="PORT" set APP_PORT=%%B
    )
)

echo ==============================================
echo  Opening Windows Firewall for Port %APP_PORT%...
echo ==============================================
netsh advfirewall firewall delete rule name="UromSachi Port %APP_PORT%" >nul 2>&1
netsh advfirewall firewall add rule name="UromSachi Port %APP_PORT%" dir=in action=allow protocol=TCP localport=%APP_PORT%
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Firewall rule added successfully for port %APP_PORT%!
) else (
    echo [ERROR] Failed to add firewall rule.
)
echo.
pause
