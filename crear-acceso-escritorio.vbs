Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\Carpeta Academica (Local).lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\Polledo\Documents\GitHub\carpeta-academica-4a\abrir-carpeta-academica.bat"
oLink.WorkingDirectory = "C:\Users\Polledo\Documents\GitHub\carpeta-academica-4a"
oLink.WindowStyle = 1
oLink.Description = "Iniciar Servidor Local de Carpeta Academica"
oLink.Save
