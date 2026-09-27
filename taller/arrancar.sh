#!/usr/bin/env bash
# El arrancador del taller (SPEC 028, seccion 2).
#
# Lo llaman taller.sh y taller.command, en la raiz de taller-git, y en Windows
# arrancar.cmd, con el bash de Git para Windows. El participante no elige
# nada. Primero el motor de Java, con el runtime que viene en el clon. Si en
# treinta segundos no responde en su puerto, se cierra y se prueba el de Python,
# con el Python del equipo si es 3.9 o superior. Si tampoco, se abre
# SIMULADOR.html en el modo de escenarios, y se dice que es el respaldo.
#
# Treinta segundos para Java porque en un equipo corporativo el antivirus revisa
# el runtime la primera vez que arranca; si responde antes, se sigue en ese
# momento. TALLER_ESPERA_JAVA cambia los treinta segundos y TALLER_ESPERA los
# cinco del motor de Python. TALLER_SIN_NAVEGADOR=1 no abre el navegador, para
# las pruebas.
#
# Escrito para Bash 3.2, el de macOS.

set -u

AQUI=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$AQUI/.." && pwd -P)
RAIZ=$(cd "$CLON/.." && pwd -P)
PROPIA="$RAIZ/.taller"
mkdir -p "$PROPIA"
DIRECCION="$PROPIA/direccion"
ESPERA=${TALLER_ESPERA:-5}
ESPERA_JAVA=${TALLER_ESPERA_JAVA:-30}
ABRIR=yes
[ "${TALLER_SIN_NAVEGADOR:-}" = 1 ] && ABRIR=no

decir() { printf '  %s\n' "$@"; }

case "$(uname -s)" in
  Darwin) SO=mac ;;
  MINGW*|MSYS*|CYGWIN*) SO=windows ;;
  *) SO=otro ;;
esac

abrir() {
  [ "$ABRIR" = yes ] || return 0
  case $SO in
    mac) /usr/bin/open "$1" ;;
    windows) rundll32 url.dll,FileProtocolHandler "$1" ;;
    *) xdg-open "$1" >/dev/null 2>&1 & ;;
  esac
}

# El motor escribe su direccion en $DIRECCION cuando esta escuchando. Se da por
# arrancado si ademas responde a la clave en su puerto.
responde() {
  local pid=$1 intentos=$(($2 * 5)) direccion base clave
  while [ "$intentos" -gt 0 ]; do
    kill -0 "$pid" 2>/dev/null || return 1
    if [ -s "$DIRECCION" ]; then
      direccion=$(head -n 1 "$DIRECCION")
      base=${direccion%%/?clave=*}
      clave=${direccion##*clave=}
      if [ "$(curl -s -o /dev/null -m 2 -w '%{http_code}' -H "X-Taller-Clave: $clave" "$base/api/diagnostico")" = 200 ]; then
        return 0
      fi
    fi
    sleep 0.2
    intentos=$((intentos - 1))
  done
  return 1
}

cerrar() {
  local pid=$1
  if [ "$SO" = windows ] && [ -r "/proc/$pid/winpid" ]; then
    taskkill //T //F //PID "$(cat "/proc/$pid/winpid")" >/dev/null 2>&1
  fi
  kill "$pid" 2>/dev/null
  sleep 0.3
  kill -9 "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
}

version_mayor_de_java() {
  "$1" -version 2>&1 | awk -F'"' '/version/ {split($2, v, "."); print (v[1] == "1" ? v[2] : v[1]); exit}'
}

java_del_taller() {
  local propio=''
  case $SO in
    mac)
      # uname -m dice x86_64 bajo Rosetta en un Mac con chip de Apple.
      if [ "$(/usr/sbin/sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]; then
        propio="$AQUI/java/jre/macos-aarch64/bin/java"
      else
        decir "Este Mac tiene procesador Intel, y el taller trae Java solo para Mac con chip de Apple." >&2
      fi
      ;;
    windows) propio="$AQUI/java/jre/windows-x64/bin/java.exe" ;;
  esac
  if [ -n "$propio" ] && [ -x "$propio" ]; then
    printf '%s' "$propio"
    return 0
  fi
  local candidato mayor
  for candidato in "${JAVA_HOME:+$JAVA_HOME/bin/java}" "$(command -v java 2>/dev/null)"; do
    [ -n "$candidato" ] && [ -x "$candidato" ] || continue
    if [ "$candidato" = /usr/bin/java ] && [ -x /usr/libexec/java_home ]; then
      /usr/libexec/java_home -v 21+ >/dev/null 2>&1 || continue
    fi
    mayor=$(version_mayor_de_java "$candidato")
    if [ -n "$mayor" ] && [ "$mayor" -ge 21 ] 2>/dev/null; then
      printf '%s' "$candidato"
      return 0
    fi
  done
  return 1
}

python_del_equipo() {
  # Un Python dentro del repositorio, si algun dia lo hay, y si no el del equipo.
  local candidato
  for candidato in "$AQUI/python/runtime/python.exe" "$AQUI/python/runtime/bin/python3" py python3 python; do
    if [ "$candidato" = py ]; then
      command -v py >/dev/null 2>&1 || continue
      if [ "$(py -3 -c 'import sys; print(sys.version_info >= (3, 9))' 2>/dev/null | tr -d '\r')" = True ]; then
        printf '%s' 'py -3'
        return 0
      fi
      continue
    fi
    case $candidato in
      /*) [ -x "$candidato" ] || continue ;;
      *) command -v "$candidato" >/dev/null 2>&1 || continue ;;
    esac
    # En Windows, python puede ser el atajo de la tienda, que no es un Python.
    if [ "$("$candidato" -c 'import sys; print(sys.version_info >= (3, 9))' 2>/dev/null | tr -d '\r')" = True ]; then
      printf '%s' "$candidato"
      return 0
    fi
  done
  return 1
}

intentar() {
  local nombre=$1 segundos=$2
  shift 2
  rm -f "$DIRECCION"
  TALLER_SIN_NAVEGADOR=1 TALLER_ARCHIVO_DIRECCION="$DIRECCION" "$@" &
  PID=$!
  if responde "$PID" "$segundos"; then
    MOTOR=$nombre
    return 0
  fi
  cerrar "$PID"
  return 1
}

# La comprobacion del primer dia la hace el motor de Java. Si no hay Java, se
# dice que motor le queda al taller.
if [ "${1:-}" = --comprobar ]; then
  shift
  if JAVA=$(java_del_taller) && [ -f "$AQUI/java/taller.jar" ]; then
    exec "$JAVA" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 \
      -XX:-UsePerfData -Xshare:auto -jar "$AQUI/java/taller.jar" --comprobar "$@"
  fi
  echo
  decir "No hay un Java con que correr el motor de Java, así que no se puede hacer la comprobación completa."
  if PYTHON=$(python_del_equipo); then
    decir "El taller va a usar el motor de Python, con $PYTHON."
  else
    decir "Tampoco hay un Python 3.9 o superior: el taller va a abrir el simulador de respaldo. Avisa al relator."
  fi
  echo
  exit 1
fi

echo
MOTOR=''
PID=''
if [ ! -f "$AQUI/java/taller.jar" ]; then
  decir "Falta el motor de Java en el clon. Se prueba el de Python."
elif JAVA=$(java_del_taller); then
  decir "El taller está arrancando. La primera vez puede tardar hasta medio minuto."
  intentar Java "$ESPERA_JAVA" "$JAVA" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 \
    -XX:-UsePerfData -Xshare:auto -jar "$AQUI/java/taller.jar" "$@" ||
    decir "El motor de Java no arrancó. Se prueba el de Python."
else
  decir "No hay un Java con que arrancar el motor de Java. Se prueba el de Python."
fi

if [ -z "$MOTOR" ]; then
  if [ ! -f "$AQUI/python/taller.py" ]; then
    decir "Falta el motor de Python en el clon."
  elif PYTHON=$(python_del_equipo); then
    # shellcheck disable=SC2086
    intentar Python "$ESPERA" $PYTHON "$AQUI/python/taller.py" "$@" ||
      decir "El motor de Python tampoco arrancó."
  else
    decir "No hay un Python 3.9 o superior con que arrancar el motor de Python."
  fi
fi

if [ -z "$MOTOR" ]; then
  PAGINA="$CLON/SIMULADOR.html"
  [ "$SO" = windows ] && PAGINA=$(cd "$CLON" && pwd -W)/SIMULADOR.html
  echo
  decir "ATENCIÓN. El taller no pudo arrancar, y se abre el simulador de respaldo." \
    "Es el mismo simulador, en el modo de escenarios, sin Git de verdad." \
    "Avísale al relator. El resultado de la comprobación del primer día le sirve."
  echo
  decir "Simulador de respaldo: $PAGINA"
  abrir "$PAGINA"
  echo "respaldo" > "$PROPIA/motor"
  exit 3
fi

# El motor corre en segundo plano, y en un bash sin terminal propia no recibe
# Ctrl+C: la trampa lo cierra junto con el arrancador.
trap 'cerrar "$PID"; exit 130' INT TERM HUP
echo "$MOTOR" > "$PROPIA/motor"
decir "Motor del taller: $MOTOR."
echo
abrir "$(head -n 1 "$DIRECCION")"
wait "$PID"
