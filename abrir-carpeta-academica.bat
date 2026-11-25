@echo off
setlocal
title Carpeta Academica - Servidor Local

cd /d "%~dp0"

echo ===================================================
echo           CARPETA ACADEMICA 4A
echo           Lanzador Local del Sistema
echo ===================================================
echo.

:: 1. Comprobar si Python esta disponible
python --version >nul 2>&1
if errorlevel 1 goto :error_python

:: 2. Comprobar si el puerto 8000 esta escuchando
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul 2>&1
if errorlevel 1 goto :iniciar_servidor

:: 3. El puerto 8000 esta en uso. Verificar si corresponde a Carpeta Academica
curl.exe -s --max-time 2 http://127.0.0.1:8000/index.html | findstr /I "Carpeta Academica" >nul 2>&1
if not errorlevel 1 goto :servidor_ya_activo

:: El puerto esta ocupado por otro servicio distinto
echo [ADVERTENCIA] El puerto 8000 esta ocupado por otro servicio o aplicacion distinta.
echo Para evitar conflictos, no se ha iniciado un servidor duplicado.
echo Cierre la aplicacion en conflicto o libere el puerto 8000 e intente nuevamente.
echo.
pause
exit /b 1

:iniciar_servidor
echo Iniciando servidor local en el puerto 8000...
start "Servidor Local - Carpeta Academica" /min python -m http.server 8000
ping 127.0.0.1 -n 3 >nul

:servidor_ya_activo
echo [OK] Servidor activo en http://localhost:8000
echo Abriendo Carpeta Academica en el navegador predeterminado...
start "" "http://localhost:8000/#attendance"
ping 127.0.0.1 -n 2 >nul
exit /b 0

:error_python
echo [ERROR] Python no esta disponible en el sistema o no esta en la variable PATH.
echo Por favor instale Python desde https://www.python.org/ y marque la casilla:
echo "Add python.exe to PATH" durante la instalacion.
echo.
pause
exit /b 1
