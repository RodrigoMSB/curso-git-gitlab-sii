#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 08.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-08' "${1:-.}"

v_cantidad_de_confirmaciones 6
v_mensajes 'Agrega el README del recetario|Agrega platos e ingredientes|wip|cambios|mas cambios|arreglos'
v_ramas 'main tailandesa'
v_rama_apunta_a main 'Agrega la tabla de cocineros'
v_rama_apunta_a tailandesa 'arreglos'
v_posicion tailandesa
v_remotos ''

# La receta a medio escribir, sin seguimiento: es lo que el participante va a
# guardar temporalmente antes de cambiar de rama.
v_estado_de_trabajo '?? recetas/curry-massaman.md'
v_archivo_presente recetas/curry-massaman.md

# El guardado temporal parte vacio a proposito: las entradas las crea el
# participante durante el ejercicio.
v_guardados 0

# main avanzo por su cuenta desde que la rama se separo, que es lo que da
# sentido al rebase del final del laboratorio.
v_esperar 'confirmaciones que main tiene y tailandesa no' '2' \
  "$(git rev-list --count tailandesa..main)"
v_esperar 'confirmaciones de la rama de trabajo' '4' \
  "$(git rev-list --count main..tailandesa)"

v_terminar
