Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' اجرای watchdog (ری‌استارت خودکار اگه سرور افتاد)
WshShell.CurrentDirectory = scriptDir
WshShell.Run "wscript.exe watchdog.vbs", 0, False

' اجرای Backend
WshShell.CurrentDirectory = scriptDir & "\backend"
WshShell.Run "node server.js", 0, False

WScript.Sleep 3000

' اجرای Frontend
WshShell.CurrentDirectory = scriptDir & "\frontend"
WshShell.Run "cmd /c npx vite --host 0.0.0.0 --port 5173", 0, False

