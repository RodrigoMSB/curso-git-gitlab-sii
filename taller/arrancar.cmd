@echo off
rem El arrancador del taller en Windows (SPEC 028, seccion 2).
rem
rem Lo llaman TALLER.cmd y comprobar.cmd, en la raiz de taller-git. Busca el
rem bash de Git para Windows y le pasa el trabajo a arrancar.sh o a
rem comprobar.sh, que son los mismos de Mac y de Git Bash. Sin Git para Windows
rem no hay motor que arrancar: se abre el simulador de respaldo.
rem
rem Solo caracteres ASCII: chcp 65001 hace que cmd relea el resto en UTF-8.
setlocal EnableExtensions
chcp 65001 >nul
set "AQUI=%~dp0"
set "QUE=%~1"
if "%QUE%"=="" set "QUE=arrancar"

set "BASH="
if defined TALLER_GIT if exist "%TALLER_GIT%\bin\bash.exe" set "BASH=%TALLER_GIT%\bin\bash.exe"
if not defined BASH for /f "tokens=2,*" %%a in ('reg query "HKLM\SOFTWARE\GitForWindows" /v InstallPath 2^>nul ^| findstr InstallPath') do if exist "%%b\bin\bash.exe" set "BASH=%%b\bin\bash.exe"
if not defined BASH for /f "tokens=2,*" %%a in ('reg query "HKCU\SOFTWARE\GitForWindows" /v InstallPath 2^>nul ^| findstr InstallPath') do if exist "%%b\bin\bash.exe" set "BASH=%%b\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles%\Git\bin\bash.exe" set "BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined BASH if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" set "BASH=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
if not defined BASH goto sin_git

set "CHERE_INVOKING=1"
"%BASH%" --login "%AQUI%%QUE%.sh"
set "ESTADO=%ERRORLEVEL%"
if not "%ESTADO%"=="0" pause
exit /b %ESTADO%

:sin_git
echo.
echo   No se encontro Git para Windows, y sin el no hay taller.
echo   Instalalo desde https://git-scm.com/download/win y vuelve a abrir el taller.
echo.
echo   ATENCION. Mientras tanto se abre el simulador de respaldo, sin Git de verdad.
echo.
start "" "%AQUI%..\SIMULADOR.html"
pause
exit /b 3
