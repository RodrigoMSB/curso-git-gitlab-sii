#!/usr/bin/env bash
# La instalacion y la cascada del arrancador, como las vive el participante
# (SPEC 028, puntos 2 y 6).
#
# Parte de cero en una carpeta temporal con tilde en el nombre: crea
# taller-git, clona el curso adentro como curso, corre INSTALAR.cmd o
# instalar.command, y arranca con TALLER.cmd o taller.command. Despues escribe
# en la consola, por la API, el comienzo del laboratorio 01 y preparar 02.
#
#     MOTOR=java       el camino normal: arranca el motor de Java
#     MOTOR=python     el jar saboteado: la cascada tiene que llegar a Python
#     MOTOR=respaldo   el jar y taller.py saboteados: se abre el simulador de
#                      respaldo, con el aviso, y el arrancador sale con 3
#
# VARIANTE=git-fuera-del-path, solo en Windows, arranca TALLER.cmd con un PATH
# sin Git, como en un equipo donde Git para Windows se instalo para usarse solo
# desde Git Bash.
#
# SIN_POWERSHELL, solo en Windows y con MOTOR=java, deja powershell.exe fuera
# de alcance para el custodio del motor de Java: bloqueado (sin permiso de
# ejecucion), no-existe (renombrado) o lento (se lanza y no responde). El
# taller tiene que arrancar igual, decir en la ventana que al cerrar pueden
# quedar procesos, y atender las ordenes sin esperar al custodio en cada una.
# Toca el sistema: solo en la integracion continua.
#
# Desde la raiz del clon:  MOTOR=python bash taller/probar-instalacion.sh
set -eu

CLON=$(cd "$(dirname "$0")/.." && pwd -P)
MOTOR=${MOTOR:-java}
VARIANTE=${VARIANTE:-normal}
SIN_POWERSHELL=${SIN_POWERSHELL:-}
AVISO_CUSTODIO='Al cerrar esta ventana pueden quedar procesos abiertos.'
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) WINDOWS=1 ;;
  *) WINDOWS=0 ;;
esac

BASE=$(mktemp -d)
RAIZ="$BASE/Ana Núñez/taller-git"
mkdir -p "$RAIZ"
LOG="$BASE/arrancador.log"
PID=''

cerrar() {
  [ -n "$PID" ] || return 0
  if [ "$WINDOWS" = 1 ] && [ -r "/proc/$PID/winpid" ]; then
    taskkill //T //F //PID "$(cat "/proc/$PID/winpid")" >/dev/null 2>&1 || true
  fi
  # En Mac el arrancador cierra el motor al recibir TERM.
  kill "$PID" 2>/dev/null || true
  wait "$PID" 2>/dev/null || true
  PID=''
}
devolver_powershell() {
  [ -n "$SIN_POWERSHELL" ] || return 0
  pwsh -NoProfile -Command '
    $ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    Remove-Item -Path "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\powershell.exe" -Recurse -ErrorAction SilentlyContinue
    if (Test-Path "$ps.fuera") { Rename-Item "$ps.fuera" "powershell.exe" }
    if (Test-Path $ps) { icacls $ps /remove:d "$env:USERNAME" | Out-Null }
  ' || true
}
trap 'cerrar; devolver_powershell; rm -rf "$BASE"' EXIT
falla() {
  echo "FALLA  $*"
  echo "--- lo que dijo el arrancador"
  cat "$LOG" 2>/dev/null || true
  exit 1
}

# 1. El clon, con el nombre curso. Lo que no esta confirmado todavia, como la
# pagina recien construida, se copia encima, para probar lo que se va a subir.
git clone -q "$CLON" "$RAIZ/curso"
for ruta in SIMULADOR.html taller labs INSTALAR.cmd instalar.command; do
  rm -rf "${RAIZ:?}/curso/$ruta"
  cp -R "$CLON/$ruta" "$RAIZ/curso/$ruta"
done
rm -rf "$RAIZ/curso/taller/java/fuente/target"

# 2. La instalacion, con doble clic.
if [ "$WINDOWS" = 1 ]; then
  (cd "$RAIZ/curso" && cmd //c INSTALAR.cmd < /dev/null) > "$BASE/instalar.log" 2>&1 || falla "INSTALAR.cmd fallo: $(cat "$BASE/instalar.log")"
else
  bash "$RAIZ/curso/instalar.command" < /dev/null > "$BASE/instalar.log" 2>&1 || falla "instalar.command fallo: $(cat "$BASE/instalar.log")"
fi
for archivo in TALLER.cmd comprobar.cmd taller.sh taller.command comprobar.sh preparar verificar; do
  [ -f "$RAIZ/$archivo" ] || falla "la instalacion no dejo $archivo en taller-git"
done
echo "BIEN   la instalacion dejo los siete envoltorios en taller-git"

# 3. Los sabotajes.
case $MOTOR in
  java) ESPERADO=Java ;;
  python)
    ESPERADO=Python
    echo "no es un jar" > "$RAIZ/curso/taller/java/taller.jar"
    ;;
  respaldo)
    ESPERADO=respaldo
    echo "no es un jar" > "$RAIZ/curso/taller/java/taller.jar"
    echo "raise SystemExit(1)" > "$RAIZ/curso/taller/python/taller.py"
    ;;
  *) echo "MOTOR es java, python o respaldo" >&2; exit 2 ;;
esac

# 3b. PowerShell fuera de alcance, si se pidio.
if [ -n "$SIN_POWERSHELL" ]; then
  [ "$WINDOWS" = 1 ] && [ "$MOTOR" = java ] || { echo "SIN_POWERSHELL es solo para Windows con MOTOR=java" >&2; exit 2; }
  [ "${CI:-}" = true ] || { echo "SIN_POWERSHELL toca el sistema: solo en la integracion continua" >&2; exit 2; }
  pwsh -NoProfile -Command '
    $ErrorActionPreference = "Stop"
    $ps = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    switch ($env:SIN_POWERSHELL) {
      "bloqueado" {
        takeown /f $ps | Out-Null
        icacls $ps /grant "$($env:USERNAME):F" | Out-Null
        icacls $ps /deny "$($env:USERNAME):(RX)" | Out-Null
      }
      "no-existe" {
        takeown /f $ps | Out-Null
        icacls $ps /grant "$($env:USERNAME):F" | Out-Null
        Rename-Item $ps "powershell.exe.fuera"
      }
      "lento" {
        $clave = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\powershell.exe"
        New-Item -Path $clave -Force | Out-Null
        Set-ItemProperty -Path $clave -Name Debugger -Value "C:\Windows\System32\cmd.exe /c ping -n 90 127.0.0.1 >nul & rem"
      }
      default { throw "SIN_POWERSHELL es bloqueado, no-existe o lento" }
    }
  '
  # Que de verdad no responda.
  if timeout 15 "$SYSTEMROOT/System32/WindowsPowerShell/v1.0/powershell.exe" -NoProfile -Command 'Write-Output si' 2>/dev/null | grep -q si; then
    echo "FALLA  powershell.exe sigue respondiendo; la prueba no probaria nada"
    exit 1
  fi
  echo "BIEN   powershell.exe fuera de alcance: $SIN_POWERSHELL"
fi

# 4. El arranque, con doble clic en la raiz de taller-git. La configuracion
# global de Git es una de prueba, para no tocar la del equipo.
export TALLER_SIN_NAVEGADOR=1
export GIT_CONFIG_GLOBAL="$BASE/gitconfig"
printf '[user]\n\tname = Ana Núñez\n\temail = ana@sii.cl\n' > "$GIT_CONFIG_GLOBAL"
if [ "$WINDOWS" = 1 ]; then
  if [ "$VARIANTE" = git-fuera-del-path ]; then
    # Solo lo que Windows trae: ni Git\cmd, ni mingw64, ni usr/bin.
    (cd "$RAIZ" && env PATH="/c/Windows/system32:/c/Windows" /c/Windows/system32/cmd.exe //c TALLER.cmd) > "$LOG" 2>&1 &
  else
    (cd "$RAIZ" && cmd //c TALLER.cmd) > "$LOG" 2>&1 &
  fi
else
  (cd "$RAIZ" && bash ./taller.command) > "$LOG" 2>&1 &
fi
PID=$!

if [ "$ESPERADO" = respaldo ]; then
  codigo=0
  wait "$PID" || codigo=$?
  PID=''
  [ "$codigo" = 3 ] || falla "el arrancador salio con $codigo y no con 3"
  grep -q 'ATENCIÓN' "$LOG" || falla "no dijo ATENCIÓN"
  grep -q 'SIMULADOR.html' "$LOG" || falla "no nombro el simulador de respaldo"
  [ "$(cat "$RAIZ/.taller/motor")" = respaldo ] || falla "no dejo respaldo en .taller/motor"
  cat "$LOG"
  echo "BIEN   sin los dos motores se abre el simulador de respaldo, con el aviso"
  exit 0
fi

for _ in $(seq 1 120); do
  grep -q 'Motor del taller' "$LOG" 2>/dev/null && break
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.5
done
cat "$LOG"
grep -q "Motor del taller: $ESPERADO." "$LOG" || falla "el arrancador no quedo con el motor de $ESPERADO"
[ "$(cat "$RAIZ/.taller/motor")" = "$ESPERADO" ] || falla ".taller/motor no dice $ESPERADO"
DIRECCION=$(head -n 1 "$RAIZ/.taller/direccion")
URL=${DIRECCION%%/?clave=*}
CLAVE=${DIRECCION##*clave=}

codigo=$(curl -s -o /dev/null -w '%{http_code}' "$URL/api/estado")
[ "$codigo" = 403 ] || falla "sin clave respondio $codigo"
codigo=$(curl -s -o /dev/null -w '%{http_code}' "$DIRECCION")
[ "$codigo" = 200 ] || falla "la pagina respondio $codigo"

# El cuerpo va por archivo y no como argumento: en Windows, curl recibe sus
# argumentos en la codificacion de la consola y las tildes se pierden antes de
# salir, que no es lo que hace el navegador.
CUERPO="$BASE/cuerpo.json"
orden() {
  printf '{"orden":"%s"}' "$1" > "$CUERPO"
  curl -s -H "X-Taller-Clave: $CLAVE" -H 'Content-Type: application/json; charset=utf-8' \
    --data-binary "@$CUERPO" "$URL/api/orden" > "$BASE/respuesta.json"
  cat "$BASE/respuesta.json"
  echo
}
estado() {
  curl -s -H "X-Taller-Clave: $CLAVE" -o "$BASE/estado.json" "$URL/api/estado"
}

motor=$(printf '%s' "$ESPERADO" | tr '[:upper:]' '[:lower:]')
estado
grep -q "\"motor\": *\"$motor\"" "$BASE/estado.json" || falla "la sesion no dice motor $motor: $(head -c 600 "$BASE/estado.json")"
grep -q '"relativa": *""' "$BASE/estado.json" || falla "la consola no parte en la raiz de taller-git"

# El comienzo del laboratorio 01, con tildes en la confirmacion.
orden 'mkdir -p lab-01/recetario && cd lab-01/recetario && git init -q && echo canción > README.md && git add . && git commit -qm \"señal ñ\" && git log --format=%s'
estado
grep -q '"relativa": *"lab-01/recetario"' "$BASE/estado.json" || falla "la consola no quedo en lab-01/recetario"
grep -q '"asunto": *"señal ñ"' "$BASE/estado.json" || falla "el estado no trae la confirmacion con tildes"
echo "BIEN   el laboratorio 01 empieza en taller-git/lab-01/recetario"

# preparar desde la consola, sin cd antes: la deja en el laboratorio.
inicio=$(date +%s)
orden 'preparar 02'
demora=$(( $(date +%s) - inicio ))
grep -q '"codigo": *0' "$BASE/respuesta.json" || falla "preparar 02 fallo"
estado
grep -q '"relativa": *"lab-02/recetario"' "$BASE/estado.json" || falla "preparar 02 no dejo la consola en lab-02/recetario"
[ -d "$RAIZ/lab-02/recetario/.git" ] || falla "preparar 02 no dejo el repositorio en taller-git/lab-02/recetario"
echo "BIEN   preparar 02 deja la consola en lab-02/recetario, en $demora s"

# El custodio del motor de Java, en Windows.
if [ "$WINDOWS" = 1 ] && [ "$MOTOR" = java ]; then
  if [ -n "$SIN_POWERSHELL" ]; then
    for _ in $(seq 1 60); do
      grep -q "$AVISO_CUSTODIO" "$LOG" && break
      sleep 0.5
    done
    grep -q "$AVISO_CUSTODIO" "$LOG" || falla "sin PowerShell la ventana no dijo que al cerrar pueden quedar procesos"
    [ "$demora" -lt 10 ] || falla "sin PowerShell preparar 02 tardo $demora s: las ordenes esperan al custodio"
    echo "BIEN   sin PowerShell ($SIN_POWERSHELL) el taller arranca, avisa en la ventana y atiende las ordenes"
  else
    grep -q "$AVISO_CUSTODIO" "$LOG" && falla "con PowerShell la ventana dijo que el cierre ordenado no esta"
  fi
fi

grep 'encontrado por' "$LOG" || true
if [ "$VARIANTE" = git-fuera-del-path ]; then
  grep 'encontrado por PATH' "$LOG" && falla "encontro Git por el PATH, que no deberia tener Git"
fi
cerrar

# 5. La comprobacion del primer dia, desde la raiz, con la visita del navegador
# hecha a mano. La hace el motor de Java, asi que solo con MOTOR=java.
if [ "$MOTOR" != java ]; then
  echo "BIEN   instalacion, motor $ESPERADO, guardia, laboratorio 01 y preparar 02"
  exit 0
fi
LOG2="$BASE/comprobar.log"
if [ "$WINDOWS" = 1 ]; then
  (cd "$RAIZ" && cmd //c comprobar.cmd < /dev/null) > "$LOG2" 2>&1 &
else
  (cd "$RAIZ" && bash ./comprobar.sh < /dev/null) > "$LOG2" 2>&1 &
fi
COMPROBAR=$!
for _ in $(seq 1 120); do
  grep -q 'llego?clave' "$LOG2" 2>/dev/null && break
  sleep 0.5
done
curl -s -f -o /dev/null "$(grep -o 'http://127.0.0.1:[0-9]*/llego?clave=[0-9a-f]*' "$LOG2")" || true
wait "$COMPROBAR" || true
cat "$LOG2"
grep -q 'Todo en orden' "$LOG2" || falla "la comprobacion del primer dia no paso"
echo "BIEN   instalacion, motor $ESPERADO, guardia, laboratorio 01, preparar 02 y comprobacion"
