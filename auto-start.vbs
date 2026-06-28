Set WshShell = CreateObject("WScript.Shell")

' اجرای watchdog (ری‌استارت خودکار اگه سرور افتاد)
WshShell.CurrentDirectory = "D:\edari"
WshShell.Run "wscript.exe watchdog.vbs", 0, False

' اجرای Backend
WshShell.CurrentDirectory = "D:\edari\backend"
WshShell.Run "node server.js", 0, False

WScript.Sleep 3000

' اجرای Frontend
WshShell.CurrentDirectory = "D:\edari\frontend"
WshShell.Run "cmd /c npx vite --host 0.0.0.0 --port 5173", 0, False
