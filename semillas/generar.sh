#!/usr/bin/env bash
# Regenera los paquetes de las semillas y anota su manifiesto.
#
#   semillas/generar.sh            todas
#   semillas/generar.sh 06 08      solo esas
#
# El manifiesto es lo que permite detectar despues que un generador cambio y
# su paquete no se regenero (criterio CA6). Guarda dos huellas por paquete: la
# del generador junto con las bibliotecas que usa, y la de las referencias que
# el paquete transporta.

set -eu

SEMILLAS=$(cd "$(dirname "$0")" && pwd)
MANIFIESTO="$SEMILLAS/paquetes/manifiesto.txt"
TODOS='02 03 04 05 06 07 08 09 10 13'

fallar() {
  echo "generar: $*" >&2
  exit 1
}

# Huella portatil. `git hash-object` esta siempre disponible, a diferencia de
# sha256sum, que macOS no trae.
huella_de_archivos() {
  cat "$@" | git hash-object --stdin
}

huella_del_generador() {
  huella_de_archivos \
    "$SEMILLAS/generadores/lab-$1.sh" \
    "$SEMILLAS/lib/comun.sh" \
    "$SEMILLAS/lib/contenido.sh" \
    "$SEMILLAS/lib/preambulo.sh"
}

# Las referencias que el paquete transporta, ordenadas para que la huella no
# dependa del orden en que Git las liste.
huella_del_paquete() {
  git bundle list-heads "$1" | sort | git hash-object --stdin
}

paquetes_de() {
  if [ "$1" = '09' ]; then
    echo "lab-09-recetario.bundle lab-09-condimentos.bundle"
  else
    echo "lab-$1.bundle"
  fi
}

LABORATORIOS=${*:-$TODOS}
TEMPORAL=$(mktemp -d)
trap 'rm -rf "$TEMPORAL"' EXIT

for lab in $LABORATORIOS; do
  [ -f "$SEMILLAS/generadores/lab-$lab.sh" ] ||
    fallar "no hay generador para el laboratorio $lab"
  bash "$SEMILLAS/generadores/lab-$lab.sh" "$TEMPORAL/lab-$lab" \
    "$SEMILLAS/paquetes/lab-$lab.bundle"
done

# El manifiesto se rehace entero, para que no queden filas de paquetes que ya
# no existen.
{
  echo '# Manifiesto de los paquetes de semilla. Lo escribe semillas/generar.sh.'
  echo '# columnas: paquete  huella-del-generador  huella-de-las-referencias'
  for lab in $TODOS; do
    for paquete in $(paquetes_de "$lab"); do
      [ -f "$SEMILLAS/paquetes/$paquete" ] || continue
      echo "$paquete $(huella_del_generador "$lab") $(huella_del_paquete "$SEMILLAS/paquetes/$paquete")"
    done
  done
} > "$MANIFIESTO"

echo "manifiesto actualizado en $MANIFIESTO"
