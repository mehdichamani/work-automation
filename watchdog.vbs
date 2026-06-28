Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
scriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)

Do
    Set colProcesses = GetObject("WinMgmts:").ExecQuery("SELECT Name, CommandLine FROM Win32_Process WHERE Name = 'node.exe'")
    backendRunning = False
    For Each proc In colProcesses
        If InStr(proc.CommandLine, "server.js") > 0 Then
            backendRunning = True
        End If
    Next

    If Not backendRunning Then
        WshShell.CurrentDirectory = scriptDir & "\backend"
        WshShell.Run "node server.js", 0, False
    End If

    WScript.Sleep 10000
Loop

