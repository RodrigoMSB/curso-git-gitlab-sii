#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 09.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-09' "${1:-.}"

v_cantidad_de_confirmaciones 4
v_mensajes 'Agrega el README del recetario|Agrega platos e ingredientes|Agrega las dos primeras recetas|Agrega la tabla de cocineros'
v_ramas 'main'
v_posicion main
v_estado_de_trabajo ''

# Aqui el remoto es la materia del ejercicio y se conserva. Apunta al paquete
# local, de modo que traer y enviar funcionen sin red.
v_remotos 'origin'
v_esperar 'el remoto apunta a un paquete local' 'lab-09-recetario.bundle' \
  "$(basename "$(git remote get-url origin)")"
v_esperar 'main sigue a origin/main' 'origin/main' \
  "$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2> /dev/null || echo ninguno)"

# El segundo paquete, el que se incorpora como submodulo.
PAQUETES=$(cd "$(dirname "$0")/../paquetes" && pwd)
v_archivo_presente "$PAQUETES/lab-09-condimentos.bundle"

# Todavia no hay submodulo: incorporarlo es el ejercicio.
v_archivo_ausente .gitmodules

v_terminar
