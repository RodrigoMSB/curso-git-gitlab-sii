@echo off
rem Taller de Git (SPEC 026). Doble clic para abrirlo: la consola de la pagina
rem ejecuta Git de verdad. No cierres la ventana negra mientras trabajas.
chcp 65001 >nul
cd /d "%~dp0"
set "TALLER_PY="
for %%P in (py python python3) do (
  if not defined TALLER_PY (
    %%P -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul && set "TALLER_PY=%%P"
  )
)
if not defined TALLER_PY (
  echo No se encontro Python 3.9 o superior en este equipo.
  echo Avisa al relator antes de seguir.
  pause
  exit /b 1
)
%TALLER_PY% "%~dp0taller\taller.py"
if errorlevel 1 pause
