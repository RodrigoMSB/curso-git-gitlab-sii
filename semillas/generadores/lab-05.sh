#!/usr/bin/env bash
# Semilla del laboratorio 05: crear y recorrer ramas.
#
# Seis confirmaciones en `main` con puntos de separacion claros: cada una toca
# un archivo distinto, de modo que las tres ramas que el participante crea
# puedan nacer de sitios distintos y las diferencias se lean sin ambiguedad.

LAB=05
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
contenido_platos inicial | semilla_escribir platos.md
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 5400
contenido_ingredientes inicial | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega los ingredientes base'

semilla_dia_siguiente 2
semilla_mas_tarde 7200
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
semilla_confirmar 'Agrega la receta del pastel de choclo'

semilla_dia_siguiente 1
semilla_mas_tarde 1800
receta_cazuela | semilla_escribir recetas/cazuela.md
semilla_confirmar 'Agrega la receta de la cazuela'

semilla_dia_siguiente 3
semilla_mas_tarde 10800
contenido_cocineros base | semilla_escribir cocineros.md
semilla_confirmar 'Agrega la tabla de cocineros'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
