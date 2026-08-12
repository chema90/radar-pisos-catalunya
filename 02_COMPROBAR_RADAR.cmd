@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 (
  echo ERROR: No se ha podido abrir la carpeta del Radar.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo ERROR: Este archivo debe estar en la misma carpeta que package.json.
  pause
  exit /b 1
)
if not exist "package-lock.json" (
  echo ERROR: Falta package-lock.json. No se puede reconstruir el entorno de forma segura.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o Windows no lo encuentra.
  pause
  exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta disponible.
  pause
  exit /b 1
)

node scripts\check_environment.cjs >nul 2>&1
set "ENV_RC=%ERRORLEVEL%"
if "%ENV_RC%"=="10" (
  node scripts\check_environment.cjs
  echo.
  echo Instala una version compatible de Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
if "%ENV_RC%"=="2" (
  echo Preparando dependencias limpias desde package-lock.json...
  echo Solo se reconstruira node_modules. Tus datos y preferencias no se tocan.
  if exist "node_modules" rmdir /s /q "node_modules"
  call npm ci
  if errorlevel 1 (
    echo.
    echo ERROR: npm ci no ha podido completar la instalacion.
    echo Se elimina solo el node_modules incompleto para no dejar un entorno a medias.
    if exist "node_modules" rmdir /s /q "node_modules"
    pause
    exit /b 1
  )
)
if not "%ENV_RC%"=="0" if not "%ENV_RC%"=="2" if not "%ENV_RC%"=="10" (
  echo ERROR: La comprobacion del entorno devolvio un codigo inesperado: %ENV_RC%
  node scripts\check_environment.cjs
  pause
  exit /b 1
)
node scripts\check_environment.cjs
if errorlevel 1 (
  echo ERROR: El entorno sigue incompleto despues de la preparacion.
  pause
  exit /b 1
)

title 02 - Comprobar Radar de pisos Catalunya

echo ============================================
echo   02 - COMPROBAR RADAR
echo ============================================
echo.
echo Comprueba los datos y el codigo. No modifica tus preferencias.
echo.

where python >nul 2>&1
if errorlevel 1 (
  echo AVISO: Python no esta disponible. Se omiten las comprobaciones Python.
) else (
  echo [1/3] Catalogo y datos conocidos...
  python scripts\validate_data.py
  if errorlevel 1 (
    echo ERROR EN LA COMPROBACION DE DATOS.
    pause
    exit /b 1
  )
  echo.
  echo [2/3] Cobertura ICGC...
  python scripts\validate_icgc_coverage.py
  if errorlevel 1 (
    echo ERROR EN LA COMPROBACION ICGC.
    pause
    exit /b 1
  )
)

echo.
echo [3/3] TypeScript y build...
call npm run build
if errorlevel 1 (
  echo.
  echo ERROR EN LA COMPROBACION. Revisa el mensaje anterior.
  pause
  exit /b 1
)

echo.
echo TODO CORRECTO.
echo Siguiente paso: 03_ARRANCAR_RADAR.cmd
pause
exit /b 0
