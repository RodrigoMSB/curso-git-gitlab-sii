@echo off
rem Deja listos los archivos de la raiz de taller-git (SPEC 028, punto 1.3).
rem
rem Se corre con doble clic, desde taller-git\curso, las veces que se quiera:
rem si los archivos ya estan, los reemplaza. Copia los envoltorios de
rem curso\taller\raiz, que no tienen logica propia y llaman a lo que vive en el
rem clon. Si la carpeta no es la esperada, dice como tiene que quedar y no hace
rem nada.
rem
rem Solo caracteres ASCII: chcp 65001 hace que cmd relea el resto en UTF-8.
setlocal EnableExtensions
chcp 65001 >nul
for %%I in ("%~dp0.") do set "AQUI=%%~nxI"
for %%I in ("%~dp0..") do set "ARRIBA=%%~nxI"
for %%I in ("%~dp0..") do set "RAIZ=%%~fI"
if /I not "%AQUI%"=="curso" goto mal
if /I not "%ARRIBA%"=="taller-git" goto mal

for %%F in (TALLER.cmd comprobar.cmd taller.sh taller.command comprobar.sh preparar verificar) do (
  copy /Y "%~dp0taller\raiz\%%F" "%RAIZ%\%%F" >nul || goto fallo
)
echo.
echo   Listo. En %RAIZ% quedaron TALLER.cmd, comprobar.cmd y los demas.
echo   Ahora haz doble clic en TALLER.cmd, en la carpeta taller-git.
echo.
pause
exit /b 0

:mal
echo.
echo   El clon no esta donde el taller lo espera, y no se hizo nada.
echo   La estructura tiene que quedar asi.
echo.
echo       taller-git\
echo         curso\          el clon del curso, con este INSTALAR.cmd adentro
echo.
echo   Crea una carpeta llamada taller-git, clona el curso adentro con el nombre
echo   curso, y vuelve a hacer doble clic en curso\INSTALAR.cmd.
echo.
pause
exit /b 1

:fallo
echo.
echo   No se pudieron copiar los archivos a %RAIZ%.
echo.
pause
exit /b 1
