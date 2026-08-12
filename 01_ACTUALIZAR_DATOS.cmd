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

title 01 - Actualizar datos - Radar de pisos Catalunya

echo ============================================
echo   01 - ACTUALIZAR DATOS
echo ============================================
echo.
echo Este paso hace SOLO operaciones seguras:
echo - intenta actualizar capas municipales oficiales;
echo - conserva una capa local valida si un servidor falla;
echo - incorpora referencias oficiales de nucleos/urbanizaciones DIBA sin llamarlas barrios;
echo - descarga AMB solamente como CANDIDATO para revisar;
echo - NO activa AMB y NO sustituye barrios municipales por AMB.
echo.

echo [1/4] Actualizando fuentes municipales oficiales...
node --use-system-ca scripts\ensure_priority_city_zones.mjs
if errorlevel 1 (
  echo.
  echo ERROR REAL durante la actualizacion municipal.
  echo No se ha autorizado ningun borrado de datos.
  pause
  exit /b 1
)

echo.
echo [2/4] Actualizando referencias DIBA de nucleos/urbanizaciones...
call npm run zones:diba-settlements
if errorlevel 1 (
  echo AVISO: DIBA no ha podido descargarse ahora. No se ha sustituido ninguna capa municipal.
)

echo.
echo [3/4] Preparando AMB como candidato NO ACTIVO...
call npm run zones:amb
if errorlevel 1 (
  echo AVISO: AMB no ha podido descargarse ahora. No se ha sustituido nada.
)

echo.
echo [4/4] Generando informe legible de fuentes...
call npm run audit:amb
if errorlevel 1 (
  echo AVISO: No se pudo generar el informe AMB.
)

echo.
echo ACTUALIZACION TERMINADA.
echo Nada de AMB se ha activado automaticamente.
echo Si existe, puedes abrir: data\reports\LEER_INFORME_AMB.txt
echo.
echo Siguiente paso recomendado: 02_COMPROBAR_RADAR.cmd
pause
exit /b 0
