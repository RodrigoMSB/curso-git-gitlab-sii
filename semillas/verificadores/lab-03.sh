#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 03.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-03' "${1:-.}"

v_cantidad_de_confirmaciones 4
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega la receta del pastel de choclo|Agrega las empanadas y completa los ingredientes'
v_ramas 'borrador main'
v_rama_apunta_a main 'Agrega las empanadas y completa los ingredientes'
v_rama_apunta_a borrador 'Agrega las empanadas y completa los ingredientes'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# Lo que hace que valga la pena mirar dentro de la carpeta oculta: una
# etiqueta anotada, que es un objeto propio, y mas de una rama en refs/heads.
v_esperar 'etiquetas' 'v1.0' "$(git tag | paste -sd ' ' -)"
v_esperar 'la etiqueta v1.0 es anotada' 'tag' "$(git cat-file -t v1.0)"

v_archivo_presente .git/HEAD
v_archivo_presente .git/refs/heads
v_terminar
