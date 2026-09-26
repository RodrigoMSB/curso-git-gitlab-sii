#!/usr/bin/env bash
# Arranca el programa del modo taller (SPEC 026).
#
# Lo llaman taller-java.sh, taller-java.command y comprobar-java.sh, que viven
# en la raiz del clon. Busca el Java que viene dentro del repositorio para esta
# plataforma y lo ejecuta por su ruta: no se instala nada y no se toca el PATH.
# Si ese Java falta, usa el del sistema solo si es 21 o superior, y lo avisa.
#
# Escrito para Bash 3.2, el de macOS.

set -u

AQUI=$(cd "$(dirname "$0")" && pwd -P)
JAR="$AQUI/taller.jar"

avisar() {
  printf '\n  %s\n' "$@"
}

version_mayor() {
  # La primera linea de `java -version` trae la version entre comillas:
  # «openjdk version "21.0.12" ...» o, en los viejos, «java version "1.8.0_..."».
  "$1" -version 2>&1 | awk -F'"' '/version/ {split($2, v, "."); print (v[1] == "1" ? v[2] : v[1]); exit}'
}

java_del_sistema() {
  local candidato
  for candidato in "${JAVA_HOME:+$JAVA_HOME/bin/java}" "$(command -v java 2>/dev/null)"; do
    [ -n "$candidato" ] && [ -x "$candidato" ] || continue
    # En Mac, /usr/bin/java es un envoltorio que abre un dialogo si no hay
    # ningun Java instalado; java_home dice antes si hay uno.
    if [ "$candidato" = /usr/bin/java ] && [ -x /usr/libexec/java_home ]; then
      /usr/libexec/java_home -v 21+ >/dev/null 2>&1 || continue
    fi
    local mayor
    mayor=$(version_mayor "$candidato")
    if [ -n "$mayor" ] && [ "$mayor" -ge 21 ] 2>/dev/null; then
      printf '%s' "$candidato"
      return 0
    fi
  done
  return 1
}

case "$(uname -s)" in
  Darwin)
    # uname -m dice x86_64 si la Terminal corre bajo Rosetta en un Mac con
    # chip de Apple; hw.optional.arm64 dice la verdad.
    if [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = 1 ]; then
      PROPIO="$AQUI/jre/macos-aarch64/bin/java"
    else
      PROPIO=""
      avisar "Este Mac tiene procesador Intel y el taller trae Java solo para Mac con chip de Apple."
    fi
    ;;
  MINGW*|MSYS*|CYGWIN*)
    PROPIO="$AQUI/jre/windows-x64/bin/java.exe"
    ;;
  *)
    PROPIO=""
    ;;
esac

if [ -n "$PROPIO" ] && [ -x "$PROPIO" ]; then
  JAVA="$PROPIO"
elif JAVA=$(java_del_sistema); then
  [ -n "$PROPIO" ] && avisar "No esta el Java del taller en $PROPIO."
  avisar "Se usa el Java del sistema, $JAVA."
else
  avisar "No hay un Java con que arrancar el taller." \
    "El que viene en el clon falta y en el sistema no hay uno 21 o superior." \
    "Vuelve a clonar el curso con git clone y prueba de nuevo."
  echo
  exit 1
fi

exec "$JAVA" \
  -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstderr.encoding=UTF-8 \
  -XX:-UsePerfData -Xshare:auto \
  -jar "$JAR" "$@"
