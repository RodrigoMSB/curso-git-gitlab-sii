#!/usr/bin/env bash
# Verificador del estado inicial de la semilla del laboratorio 13.
# Comprueba lo que el enunciado supone, no el resultado del ejercicio
# (punto 6.4 del SPEC 003).

set -eu
. "$(cd "$(dirname "$0")/.." && pwd)/lib/verificar.sh"

v_iniciar 'lab-13' "${1:-.}"

v_cantidad_de_confirmaciones 5
v_mensajes 'Agrega el README del recetario|Agrega platos e ingredientes|Agrega las tres primeras recetas|Agrega cocineros y exclusiones|Pasa los fondos a tabla con porciones'
v_ramas 'main'
v_posicion main
v_remotos ''
v_estado_de_trabajo ''

# No hay definicion de tuberia: escribirla es el ejercicio.
v_archivo_ausente .gitlab-ci.yml

# El error de formato esta plantado a proposito, para que la primera ejecucion
# de la tuberia falle. La fila de la cazuela lleva tres columnas donde el
# encabezado declara dos, y el listado de entradas mezcla guiones y asteriscos.
v_contiene platos.md '| Cazuela de vacuno | 10 | 75 minutos |'
v_contiene platos.md '^\* Ensalada chilena'

v_terminar
