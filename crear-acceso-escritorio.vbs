Set oWS = WScript.CreateObject("WScript.Shell")
Set oFSO = WScript.CreateObject("Scripting.FileSystemObject")
sScriptDir = oFSO.GetParentFolderName(WScript.ScriptFullName)
sLinkFile = oWS.SpecialFolders("Desktop") & "\Carpeta Academica (Local).lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = sScriptDir & "\abrir-carpeta-academica.bat"
oLink.WorkingDirectory = sScriptDir
oLink.WindowStyle = 1
oLink.Description = "Iniciar Servidor Local de Carpeta Academica"
oLink.Save
