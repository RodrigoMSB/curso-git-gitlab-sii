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
# Desde la raiz del clon:  MOTOR=python bash taller/probar-instalacion.sh
set -eu

CLON=$(cd "$(dirname "$0")/.." && pwd -P)
MOTOR=${MOTOR:-java}
VARIANTE=${VARIANTE:-normal}
AVISO_SIN_TRABAJO='no se pudo preparar el cierre ordenado'
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
trap 'cerrar; rm -rf "$BASE"' EXIT
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
# En español y con tildes, sin el «Press any key» de pause (SPEC 029, 3.2).
cat "$BASE/instalar.log"
grep -q 'los demás' "$BASE/instalar.log" || falla "la instalacion no dijo «los demás» con tilde"
if [ "$WINDOWS" = 1 ]; then
  grep -q 'Presiona una tecla para cerrar esta ventana' "$BASE/instalar.log" || falla "INSTALAR.cmd no pidio la tecla en español"
fi
grep -qi 'press any key' "$BASE/instalar.log" && falla "la instalacion dijo «Press any key»"
echo "BIEN   la instalacion habla en español, con tildes"

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

# 4. El arranque, con doble clic en la raiz de taller-git. La configuracion
# global de Git es una de prueba, para no tocar la del equipo.
export TALLER_SIN_NAVEGADOR=1
export GIT_CONFIG_GLOBAL="$BASE/gitconfig"
printf '[user]\n\tname = Ana Núñez\n\temail = ana@sii.cl\n' > "$GIT_CONFIG_GLOBAL"

ahora_ms() {
  local t
  t=$(date +%s%3N 2>/dev/null)
  case $t in
    *[!0-9]*|'') python3 -c 'import time; print(int(time.time() * 1000))' ;;
    *) echo "$t" ;;
  esac
}

lanzar() {
  if [ "$WINDOWS" = 1 ]; then
    if [ "$VARIANTE" = git-fuera-del-path ]; then
      # Solo lo que Windows trae: ni Git\cmd, ni mingw64, ni usr/bin.
      (cd "$RAIZ" && env PATH="/c/Windows/system32:/c/Windows" /c/Windows/system32/cmd.exe //c TALLER.cmd) > "$1" 2>&1 &
    else
      (cd "$RAIZ" && cmd //c TALLER.cmd) > "$1" 2>&1 &
    fi
  else
    (cd "$RAIZ" && bash ./taller.command) > "$1" 2>&1 &
  fi
  PID=$!
}

# Cuanto tarda en quedar listo, desde el doble clic hasta "Motor del taller".
esperar_motor() {
  local desde=$1 registro=$2
  for _ in $(seq 1 240); do
    grep -q 'Motor del taller' "$registro" 2>/dev/null && break
    kill -0 "$PID" 2>/dev/null || break
    sleep 0.25
  done
  echo $(( $(ahora_ms) - desde ))
}

INICIO=$(ahora_ms)
lanzar "$LOG"

if [ "$ESPERADO" = respaldo ]; then
  codigo=0
  wait "$PID" || codigo=$?
  PID=''
  [ "$codigo" = 3 ] || falla "el arrancador salio con $codigo y no con 3"
  grep -q 'ATENCIÓN' "$LOG" || falla "no dijo ATENCIÓN"
  if [ "$WINDOWS" = 1 ]; then
    grep -q 'Presiona una tecla para cerrar esta ventana' "$LOG" || falla "arrancar.cmd no pidio la tecla en español"
    grep -qi 'press any key' "$LOG" && falla "arrancar.cmd dijo «Press any key»"
  fi
  grep -q 'SIMULADOR.html' "$LOG" || falla "no nombro el simulador de respaldo"
  [ "$(cat "$RAIZ/.taller/motor")" = respaldo ] || falla "no dejo respaldo en .taller/motor"
  cat "$LOG"
  echo "BIEN   sin los dos motores se abre el simulador de respaldo, con el aviso"
  exit 0
fi

EN_FRIO=$(esperar_motor "$INICIO" "$LOG")
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

# Con la consola dentro de lab-02/recetario (SPEC 029): en Windows, preparar
# --forzar no podia borrar la carpeta, porque el bash de la orden la tenia como
# directorio actual. Y verificar sin numero deduce el laboratorio de la consola.
orden 'preparar 02 --forzar'
grep -q '"codigo": *0' "$BASE/respuesta.json" || falla "preparar 02 --forzar dentro de lab-02/recetario fallo: $(head -c 800 "$BASE/respuesta.json")"
[ -d "$RAIZ/lab-02/recetario/.git" ] || falla "preparar 02 --forzar no dejo el repositorio"
estado
grep -q '"relativa": *"lab-02/recetario"' "$BASE/estado.json" || falla "despues de preparar 02 --forzar la consola no quedo en lab-02/recetario"
orden 'verificar'
grep -q 'Verificador del laboratorio 02' "$BASE/respuesta.json" || falla "verificar sin numero, dentro de lab-02/recetario, no dedujo el laboratorio: $(head -c 800 "$BASE/respuesta.json")"
estado
grep -q '"relativa": *"lab-02/recetario"' "$BASE/estado.json" || falla "despues de verificar la consola no quedo en lab-02/recetario"
echo "BIEN   con la consola dentro del laboratorio, preparar 02 --forzar lo rehace y verificar lo deduce"

# En Windows, el motor de Java arma su cierre ordenado con funciones nativas,
# sin PowerShell (SPEC 030): la ventana no avisa que falte.
if [ "$WINDOWS" = 1 ] && [ "$MOTOR" = java ]; then
  grep -q "$AVISO_SIN_TRABAJO" "$LOG" && falla "la ventana dijo que no se pudo preparar el cierre ordenado"
  echo "BIEN   el motor de Java tiene su cierre ordenado"
fi

# La ruta de Git y donde se encontro van al registro, no a la ventana (SPEC 029).
REGISTRO="$RAIZ/.taller/registro.txt"
grep -q 'encontrado por' "$LOG" && falla "la ventana dijo donde encontro Git, que va al registro"
grep 'encontrado por' "$REGISTRO" || falla "el registro no dice donde encontro Git"
if [ "$VARIANTE" = git-fuera-del-path ]; then
  grep 'encontrado por PATH' "$REGISTRO" && falla "encontro Git por el PATH, que no deberia tener Git"
fi
cerrar

# 4b. Un segundo arranque, ya sin frio: el primero es el que paga que el
# antivirus revise el runtime recien llegado.
if [ "$MOTOR" = java ]; then
  grep -q 'El taller está arrancando. La primera vez puede tardar' "$LOG" ||
    falla "mientras espera a Java, la ventana no dijo que el taller esta arrancando"
fi
if [ "$MOTOR" = python ]; then
  # El mismo aviso antes de esperar a Python (SPEC 029).
  PRUEBA=$(grep -n 'Se prueba el de Python' "$LOG" | head -1 | cut -d: -f1)
  AVISO=$(grep -n 'El taller está arrancando. La primera vez puede tardar' "$LOG" | tail -1 | cut -d: -f1)
  [ -n "$PRUEBA" ] && [ -n "$AVISO" ] && [ "$AVISO" -gt "$PRUEBA" ] ||
    falla "mientras espera a Python, la ventana no dijo que el taller esta arrancando"
fi
LOG_NORMAL="$BASE/arrancador-2.log"
INICIO=$(ahora_ms)
lanzar "$LOG_NORMAL"
NORMAL=$(esperar_motor "$INICIO" "$LOG_NORMAL")
grep -q "Motor del taller: $ESPERADO." "$LOG_NORMAL" || { cat "$LOG_NORMAL"; falla "el segundo arranque no quedo con el motor de $ESPERADO"; }
cerrar
ANTIVIRUS=''
if [ "$WINDOWS" = 1 ]; then
  ANTIVIRUS=$(pwsh -NoProfile -Command '$e = Get-MpComputerStatus -ErrorAction SilentlyContinue; if ($e) { "Defender en tiempo real: $($e.RealTimeProtectionEnabled)" } else { "Defender: sin datos" }' 2>/dev/null | tr -d '\r')
fi
MEDIDA="motor $ESPERADO, $(uname -s): primer arranque $(awk "BEGIN {printf \"%.1f\", $EN_FRIO / 1000}") s, arranque normal $(awk "BEGIN {printf \"%.1f\", $NORMAL / 1000}") s. $ANTIVIRUS"
echo "MEDIDA  $MEDIDA"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "- $MEDIDA" >> "$GITHUB_STEP_SUMMARY"

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
