#!/usr/bin/env bash
# El laboratorio 08 queda igual cada vez que se prepara (SPEC 028, 4.8).
#
# Con core.autocrlf en true, como lo deja el instalador de Git para Windows, el
# proyecto original del laboratorio cambiaba de identificadores de una
# preparacion a otra, y en Mac quedaba siempre con otros identificadores que
# con autocrlf en false. Este script lo prepara una vez con autocrlf en false,
# que es la referencia, y VECES veces, por omision cinco, en true, y compara
# las referencias del recetario y de los dos paquetes con las de la primera.
#
# Desde la raiz del clon:  bash taller/probar-lab-08.sh
set -eu

CLON=$(cd "$(dirname "$0")/.." && pwd -P)
VECES=${VECES:-5}
BASE=$(mktemp -d)
trap 'rm -rf "$BASE"' EXIT
export GIT_CONFIG_GLOBAL="$BASE/gitconfig"
export GIT_CONFIG_NOSYSTEM=1
configurar() {
  printf '[core]\n\tautocrlf = %s\n[user]\n\tname = Ana\n\temail = ana@sii.cl\n' "$1" > "$GIT_CONFIG_GLOBAL"
}

huella() {
  local lab=$1
  git -C "$lab/recetario" for-each-ref --format='%(objectname) %(refname)'
  git bundle list-heads "$lab/recetario.bundle"
  git bundle list-heads "$lab/upstream.bundle"
}

for i in $(seq 0 "$VECES"); do
  if [ "$i" = 0 ]; then configurar false; else configurar true; fi
  TALLER_RAIZ="$BASE/taller-git" bash "$CLON/labs/lab-08/preparar.sh" --forzar > "$BASE/preparar-$i.log" 2>&1 ||
    { cat "$BASE/preparar-$i.log"; echo "FALLA  la preparacion $i no termino"; exit 1; }
  huella "$BASE/taller-git/lab-08" > "$BASE/huella-$i"
  if [ "$i" -gt 0 ] && ! diff -u "$BASE/huella-0" "$BASE/huella-$i"; then
    echo "FALLA  la preparacion $i, con autocrlf en true, dejo otros identificadores que con autocrlf en false"
    exit 1
  fi
done
cat "$BASE/huella-0"
echo "BIEN   $VECES preparaciones del laboratorio 08 con autocrlf en true, los mismos identificadores"
