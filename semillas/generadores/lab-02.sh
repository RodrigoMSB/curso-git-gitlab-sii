#!/usr/bin/env bash
# Semilla del laboratorio 02: historial, comparaciones y correccion del ultimo
# mensaje.
#
# Historia lineal de cinco confirmaciones con autores y fechas repartidas a lo
# largo de tres semanas, que es lo que permite filtrar el historial por autor y
# por fecha. La ultima confirmacion lleva el mensaje mal escrito a proposito.

LAB=02
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

semilla_autor 'Marta Quiroga' 'marta.quiroga@sii.cl'
contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 7200
semilla_autor 'Participante del taller' 'participante@sii.cl'
contenido_platos inicial | semilla_escribir platos.md
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente 3
semilla_mas_tarde 10800
semilla_autor 'Ignacio Pereira' 'ignacio.pereira@sii.cl'
contenido_ingredientes inicial | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega los ingredientes base'

semilla_dia_siguiente 5
semilla_mas_tarde 1800
semilla_autor 'Marta Quiroga' 'marta.quiroga@sii.cl'
contenido_platos base | semilla_escribir platos.md
receta_charquican | semilla_escribir recetas/charquican.md
semilla_confirmar 'Suma el charquican a la lista de platos'

# El mensaje va mal escrito a proposito: el laboratorio pide corregirlo con
# `git commit --amend`. Ver semillas/descripciones/lab-02.md.
semilla_dia_siguiente 1
semilla_mas_tarde 21600
semilla_autor 'Participante del taller' 'participante@sii.cl'
contenido_cocineros base | semilla_escribir cocineros.md
semilla_confirmar 'Agrega la lsita de cocinerps'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
