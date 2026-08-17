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

echo ==============================================
echo  Opening Windows Firewall for Port 2833...
echo ==============================================
netsh advfirewall firewall delete rule name="UromSachi Port 2833" >nul 2>&1
netsh advfirewall firewall add rule name="UromSachi Port 2833" dir=in action=allow protocol=TCP localport=2833
echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Firewall rule added successfully for port 2833!
    echo Now other devices on the network can access http://172.30.39.126:2833
) else (
    echo [ERROR] Failed to add firewall rule.
)
echo.
pause
