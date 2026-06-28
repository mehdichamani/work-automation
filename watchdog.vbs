Set WshShell = CreateObject("WScript.Shell")

Do
    Set colProcesses = GetObject("WinMgmts:").ExecQuery("SELECT Name, CommandLine FROM Win32_Process WHERE Name = 'node.exe'")
    backendRunning = False
    For Each proc In colProcesses
        If InStr(proc.CommandLine, "server.js") > 0 Then
            backendRunning = True
        End If
    Next

    If Not backendRunning Then
        WshShell.CurrentDirectory = "D:\edari\backend"
        WshShell.Run "node server.js", 0, False
    End If

    WScript.Sleep 10000
Loop
