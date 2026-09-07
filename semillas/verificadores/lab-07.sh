#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 07.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-07' "${1:-.}"

v_cantidad_de_confirmaciones 7
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega los ingredientes base|Corrige la unidad de compra de la carne|Agrega la receta del pastel de choclo|Agrega la receta de la cazuela|Agrega la tabla de cocineros'
v_ramas 'main'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# El error plantado sigue en su sitio, y con tres confirmaciones encima: es lo
# que hace preferible revertir antes que retroceder.
v_contiene ingredientes.md 'Saco de 25 kg por porcion'
v_esperar 'confirmaciones posteriores al error' '3' \
  "$(git rev-list --count "$(git log --format=%H -1 --grep='Corrige la unidad de compra')"..HEAD)"

v_terminar
