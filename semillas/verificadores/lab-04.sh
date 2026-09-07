#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 04.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-04' "${1:-.}"

v_cantidad_de_confirmaciones 5
v_mensajes 'Agrega el README y la lista de platos|Agrega las tres primeras recetas|Guarda notas de la reunion de cocina|Agrega el acceso al sistema del casino|Suma el charquican y completa los ingredientes'
v_ramas 'main'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# El punto del ejercicio: los tres archivos estan en la historia confirmada y
# no solo en el disco. Ignorarlos no basta; hay que sacarlos del seguimiento
# (criterio CA8).
v_archivo_en_la_historia notas.tmp
v_archivo_en_la_historia respaldo.bak
v_archivo_en_la_historia credenciales.txt
v_archivo_seguido notas.tmp
v_archivo_seguido respaldo.bak
v_archivo_seguido credenciales.txt
v_contiene credenciales.txt 'clave:'

# Sin archivo de exclusiones: escribirlo es parte del laboratorio.
v_archivo_ausente .gitignore

v_terminar
