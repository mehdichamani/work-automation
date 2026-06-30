Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

' اجرای Backend با PM2
WshShell.CurrentDirectory = scriptDir
WshShell.Run "cmd /c pm2 start ecosystem.config.js", 0, False

