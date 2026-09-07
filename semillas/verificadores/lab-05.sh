#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 05.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-05' "${1:-.}"

v_cantidad_de_confirmaciones 6
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega los ingredientes base|Agrega la receta del pastel de choclo|Agrega la receta de la cazuela|Agrega la tabla de cocineros'
v_ramas 'main'
v_rama_apunta_a main 'Agrega la tabla de cocineros'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# Cada confirmacion toca un solo archivo, y uno distinto: es lo que deja
# separar las tres ramas en puntos distintos sin que las diferencias de una se
# confundan con las de otra.
v_esperar 'confirmaciones que tocan mas de un archivo' '0' \
  "$(git log --format='%H' | while read -r id; do
       git show --name-only --format='' "$id" | grep -c . || true
     done | grep -c -v '^1$' || true)"

v_esperar 'archivos distintos tocados por la historia' '6' \
  "$(git log --name-only --format='' | grep -c . )"

v_terminar
