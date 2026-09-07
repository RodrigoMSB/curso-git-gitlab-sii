#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 10.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-10' "${1:-.}"

v_cantidad_de_confirmaciones 8
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega los ingredientes base|Agrega las dos primeras recetas|Agrega la cazuela y el charquican|Completa el listado con entradas y postres|Actualiza la tabla de cocineros|Agrega el archivo de exclusiones'
v_ramas 'main'
v_posicion main
v_estado_de_trabajo ''

# Sin remoto: conectarlo con la plataforma es el laboratorio.
v_remotos ''

v_archivo_presente .gitignore
v_archivo_presente recetas/sopaipillas.md
v_esperar 'etiquetas' 'v1.0' "$(git tag | paste -sd ' ' -)"

v_terminar
