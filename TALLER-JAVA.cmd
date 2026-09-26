@echo off
rem Arranca el modo taller con doble clic (SPEC 026).
rem
rem Busca el Java que viene dentro del clon y lo ejecuta por su ruta. No se
rem instala nada y no se toca el PATH. Si ese Java falta, usa el del sistema
rem solo si es 21 o superior, y lo avisa.
rem
rem Este archivo va solo con caracteres ASCII: chcp 65001 hace que cmd relea
rem el resto del archivo en UTF-8.
setlocal EnableExtensions
chcp 65001 >nul
title Taller Git
set "AQUI=%~dp0"
set "JAR=%AQUI%taller-java\taller.jar"
set "JAVA=%AQUI%taller-java\jre\windows-x64\bin\java.exe"
if exist "%JAVA%" goto arrancar

set "JAVA="
for /f "delims=" %%j in ('where java 2^>nul') do if not defined JAVA set "JAVA=%%j"
if not defined JAVA goto sin_java
set "MAYOR="
for /f "tokens=3" %%v in ('call "%JAVA%" -version 2^>^&1 ^| findstr /i version') do if not defined MAYOR set "MAYOR=%%~v"
for /f "delims=." %%m in ("%MAYOR%") do set "MAYOR=%%m"
if "%MAYOR%"=="" goto sin_java
if %MAYOR% LSS 21 goto sin_java
echo.
echo   No esta el Java del taller en taller-java\jre\windows-x64.
echo   Se usa el Java del sistema, %JAVA%.
goto arrancar

:sin_java
echo.
echo   No hay un Java con que arrancar el taller.
echo   El que viene en el clon falta y en el sistema no hay uno 21 o superior.
echo   Vuelve a clonar el curso con git clone y prueba de nuevo.
echo.
pause
exit /b 1

:arrancar
"%JAVA%" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 -XX:-UsePerfData -Xshare:auto -jar "%JAR%" %*
if errorlevel 1 pause
exit /b %ERRORLEVEL%
