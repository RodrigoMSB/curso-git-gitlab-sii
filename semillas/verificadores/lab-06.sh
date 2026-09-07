#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 06.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-06' "${1:-.}"

v_cantidad_de_confirmaciones 4
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega los ingredientes base|Precisa que la cazuela lleva chuchoca'
v_ramas 'main mexicana peruana'
v_rama_apunta_a main 'Precisa que la cazuela lleva chuchoca'
v_rama_apunta_a mexicana 'Suma el guacamole a las entradas'
v_rama_apunta_a peruana 'Reemplaza la cazuela por el lomo saltado'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# Las dos fusiones que el laboratorio necesita (criterio CA7).
if ! git merge-base --is-ancestor main mexicana; then
  VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
  echo '  ✗ mexicana deberia poder fusionarse por avance rapido y no cuelga de main' >&2
fi
if git merge-base --is-ancestor main peruana; then
  VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
  echo '  ✗ peruana no deberia poder fusionarse por avance rapido' >&2
fi

# Que ambas tocaron la misma linea del mismo archivo, que es de donde sale el
# choque. Se comprueba sin fusionar, para no ensuciar el repositorio.
BASE=$(git merge-base main peruana)
if ! git diff --name-only "$BASE" main | grep -q '^platos.md$' ||
   ! git diff --name-only "$BASE" peruana | grep -q '^platos.md$'; then
  VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
  echo '  ✗ main y peruana deberian tocar ambas platos.md desde su base comun' >&2
fi

v_terminar
