#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 02.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-02' "${1:-.}"

v_cantidad_de_confirmaciones 5
v_mensajes 'Agrega el README del recetario|Agrega la lista de platos|Agrega los ingredientes base|Suma el charquican a la lista de platos|Agrega la lsita de cocinerps'
v_ramas 'main'
v_rama_apunta_a main 'Agrega la lsita de cocinerps'
v_posicion main
v_remotos ''

# La suciedad que deja el script de preparacion: uno modificado sin preparar y
# otro preparado por error.
v_estado_de_trabajo ' M platos.md|A  notas.tmp'
v_archivo_seguido platos.md
v_archivo_seguido cocineros.md

# El mensaje mal escrito esta puesto a proposito: si alguien lo corrige, el
# laboratorio se queda sin ejercicio.
v_esperar 'el ultimo mensaje va mal escrito a proposito' \
  'Agrega la lsita de cocinerps' "$(git log -1 --format=%s)"

# Cinco autores repartidos en tres semanas: sin eso el filtrado del historial
# por autor y por fecha no tiene nada que filtrar.
v_esperar 'autores distintos en la historia' '3' \
  "$(git log --format=%an | sort -u | wc -l | tr -d ' ')"
v_esperar 'dias distintos en la historia' '5' \
  "$(git log --format=%ad --date=format:%Y-%m-%d | sort -u | wc -l | tr -d ' ')"

v_terminar
