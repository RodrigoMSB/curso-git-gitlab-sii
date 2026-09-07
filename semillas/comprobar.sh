#!/usr/bin/env bash
# Comprueba que los paquetes del repositorio esten al dia (criterio CA6) y,
# con --determinismo, que los generadores sigan produciendo los mismos
# identificadores (criterio CA1).
#
#   semillas/comprobar.sh
#   semillas/comprobar.sh --determinismo
#
# La segunda forma es tambien la que sirve para comparar entre maquinas: se
# corre en cada una y se comparan las huellas que imprime (criterio CA2).

set -eu

SEMILLAS=$(cd "$(dirname "$0")" && pwd)
MANIFIESTO="$SEMILLAS/paquetes/manifiesto.txt"
TODOS='02 03 04 05 06 07 08 09 10 13'
FALLAS=0

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

huella_del_paquete() {
  git bundle list-heads "$1" | sort | git hash-object --stdin
}

# Corre un generador y resume los identificadores que produjo. El laboratorio
# 09 arma dos repositorios: se mira el del recetario.
huella_de_una_corrida() {
  local lab=$1 trabajo=$2 repositorio identificadores
  bash "$SEMILLAS/generadores/lab-$lab.sh" "$trabajo" "$trabajo.bundle" > /dev/null

  repositorio=$trabajo
  [ "$lab" = '09' ] && repositorio="$trabajo/recetario"

  identificadores=$(git -C "$repositorio" log --format=%H --all | sort)
  if [ -z "$identificadores" ]; then
    echo "comprobar: el generador $lab no produjo ninguna confirmacion" >&2
    exit 1
  fi
  printf '%s\n' "$identificadores" | git hash-object --stdin
}

lab_de_paquete() {
  local nombre=${1#lab-}
  echo "${nombre%%[-.]*}"
}

[ -f "$MANIFIESTO" ] || {
  echo "comprobar: falta el manifiesto; correr semillas/generar.sh" >&2
  exit 1
}

echo 'paquetes contra sus generadores'
while read -r paquete huella_generador huella_referencias; do
  case $paquete in '#'* | '') continue ;; esac
  lab=$(lab_de_paquete "$paquete")
  ruta="$SEMILLAS/paquetes/$paquete"

  if [ ! -f "$ruta" ]; then
    echo "  ✗ $paquete esta en el manifiesto y falta en disco" >&2
    FALLAS=$((FALLAS + 1))
    continue
  fi
  if [ "$(huella_del_generador "$lab")" != "$huella_generador" ]; then
    echo "  ✗ $paquete: el generador cambio y el paquete no se regenero" >&2
    echo "      correr: semillas/generar.sh $lab" >&2
    FALLAS=$((FALLAS + 1))
    continue
  fi
  if [ "$(huella_del_paquete "$ruta")" != "$huella_referencias" ]; then
    echo "  ✗ $paquete: las referencias del paquete no son las del manifiesto" >&2
    FALLAS=$((FALLAS + 1))
    continue
  fi
  echo "  ok $paquete"
done < "$MANIFIESTO"

if [ "${1:-}" = '--determinismo' ]; then
  echo
  echo 'determinismo de los generadores'
  TEMPORAL=$(mktemp -d)
  trap 'rm -rf "$TEMPORAL"' EXIT
  for lab in $TODOS; do
    primera=$(huella_de_una_corrida "$lab" "$TEMPORAL/a-$lab")
    segunda=$(huella_de_una_corrida "$lab" "$TEMPORAL/b-$lab")
    if [ "$primera" != "$segunda" ]; then
      echo "  ✗ lab-$lab: dos ejecuciones dieron identificadores distintos" >&2
      FALLAS=$((FALLAS + 1))
    else
      echo "  ok lab-$lab  $primera"
    fi
  done
fi

if [ "$FALLAS" -gt 0 ]; then
  echo "comprobar: $FALLAS problema(s)" >&2
  exit 1
fi
echo 'todo al dia'
