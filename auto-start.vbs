Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

WshShell.CurrentDirectory = scriptDir

' بررسی وجود فایل پیکربندی PM2 جهت جلوگیری از خطای ناخواسته
If objFSO.FileExists(objFSO.BuildPath(scriptDir, "ecosystem.config.js")) Then
    ' اجرای Backend با PM2 به صورت مخفی (بدون نمایش پنجره cmd)
    WshShell.Run "cmd /c pm2 start ecosystem.config.js", 0, False
End If