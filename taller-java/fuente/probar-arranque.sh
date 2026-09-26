#!/usr/bin/env bash
# Arranca el taller como lo arranca el participante y le hace las preguntas
# minimas: que responda, que rechace sin clave, que ejecute ordenes con tildes
# y que la comprobacion del primer dia pase (etapa 2 del SPEC 026).
#
# VARIANTE=git-fuera-del-path arranca con TALLER-JAVA.cmd y un PATH sin Git,
# como en un equipo donde Git para Windows se instalo para usarse solo desde
# Git Bash.
set -eu
# Escribe en la carpeta hermana del clon, taller-git-trabajo. En un equipo de
# trabajo esa carpeta es la de verdad, asi que solo corre en la integracion
# continua o en un clon de prueba que lo pida.
if [ "${CI:-}" != true ] && [ "${TALLER_CLON_DE_PRUEBA:-}" != 1 ]; then
  echo "probar-arranque.sh escribe junto al clon; correlo en un clon de prueba con TALLER_CLON_DE_PRUEBA=1" >&2
  exit 2
fi
RAIZ=$(cd "$(dirname "$0")/../.." && pwd -P)
cd "$RAIZ"
# Cada corrida parte como la primera: sin la carpeta que recuerda la consola.
TRABAJO="$(dirname "$RAIZ")/taller-git-trabajo"
rm -rf "$TRABAJO/prueba ñandú" "$TRABAJO/.taller/carpeta"
LOG=$(mktemp)
export TALLER_SIN_NAVEGADOR=1

if [ "${VARIANTE:-normal}" = git-fuera-del-path ]; then
  # Solo lo que Windows trae: ni Git\cmd, ni mingw64, ni usr/bin.
  env PATH="/c/Windows/system32:/c/Windows" /c/Windows/system32/cmd.exe //c TALLER-JAVA.cmd > "$LOG" 2>&1 &
else
  ./taller-java.sh > "$LOG" 2>&1 &
fi

for _ in $(seq 1 60); do
  grep -q 'Dirección' "$LOG" 2>/dev/null && break
  sleep 0.5
done
cat "$LOG"
DIRECCION=$(grep -o 'http://127.0.0.1:[0-9]*/?clave=[0-9a-f]*' "$LOG")
BASE=${DIRECCION%%/?clave=*}
CLAVE=${DIRECCION##*clave=}

falla() { echo "FALLA  $*"; cat "$LOG"; exit 1; }
[ -n "$DIRECCION" ] || falla "el programa no mostro su direccion"
grep -q 'Java' "$LOG" && grep 'Se usa el Java del sistema' "$LOG" && falla "no uso el runtime del repositorio"

codigo=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/estado")
[ "$codigo" = 403 ] || falla "sin clave respondio $codigo"
codigo=$(curl -s -o /dev/null -w '%{http_code}' "$DIRECCION")
[ "$codigo" = 200 ] || falla "la pagina respondio $codigo"

# El cuerpo va por archivo y no como argumento: en Windows, curl recibe sus
# argumentos en la codificacion de la consola y las tildes se pierden antes de
# salir, que no es lo que hace el navegador.
CUERPO=$(mktemp)
orden() {
  printf '{"orden":"%s"}' "$1" > "$CUERPO"
  curl -s -H "X-Taller-Clave: $CLAVE" -H 'Content-Type: application/json; charset=utf-8' \
    --data-binary "@$CUERPO" "$BASE/api/orden"
  echo
}
orden 'mkdir -p \"prueba ñandú\" && cd \"prueba ñandú\" && git init -q && echo canción > canción.md && git add . && git -c user.name=Ana -c user.email=a@b.cl commit -qm \"señal ñ\" && git log --format=%s && pwd'
curl -s -H "X-Taller-Clave: $CLAVE" -o "$CUERPO.estado" "$BASE/api/estado"
estado=$(cat "$CUERPO.estado")
echo "$estado" | head -c 1500; echo
echo "$estado" | grep -q '"asunto":"señal ñ"' || falla "el estado no trae la confirmacion con tildes"
echo "$estado" | grep -q '"relativa":"taller-git-trabajo/prueba ñandú"' || falla "la consola no quedo en la carpeta nueva"

grep -q 'encontrado por' "$LOG" && grep 'encontrado por' "$LOG"
if [ "${VARIANTE:-normal}" = git-fuera-del-path ]; then
  grep 'encontrado por PATH' "$LOG" && falla "encontro Git por el PATH, que no deberia tener Git"
fi

# La comprobacion del primer dia, con la visita del navegador hecha a mano.
LOG2=$(mktemp)
./comprobar-java.sh > "$LOG2" 2>&1 &
COMPROBAR=$!
for _ in $(seq 1 60); do
  grep -q 'llego?clave' "$LOG2" 2>/dev/null && break
  sleep 0.5
done
curl -s -f -o /dev/null "$(grep -o 'http://127.0.0.1:[0-9]*/llego?clave=[0-9a-f]*' "$LOG2")"
wait "$COMPROBAR" || true
cat "$LOG2"
grep -q 'Todo en orden' "$LOG2" || falla "la comprobacion del primer dia no paso"
echo "BIEN   arranque, guardia, orden con tildes y comprobacion"
