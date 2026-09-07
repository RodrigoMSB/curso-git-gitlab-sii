#!/usr/bin/env bash
# Semilla del laboratorio 03: que hay dentro de la carpeta oculta.
#
# Historia corta y limpia. Lo que importa no es el largo sino que haya de todo
# que mirar con `git cat-file`: confirmaciones, arboles, elementos, una rama
# ademas de la principal y una etiqueta anotada, que es un objeto propio.

LAB=03
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 5400
contenido_platos inicial | semilla_escribir platos.md
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 3600
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
semilla_confirmar 'Agrega la receta del pastel de choclo'

semilla_dia_siguiente 2
semilla_mas_tarde 9000
receta_empanadas | semilla_escribir recetas/empanadas.md
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega las empanadas y completa los ingredientes'

# La etiqueta anotada es un objeto de pleno derecho, con su propio
# identificador: da algo mas que mirar dentro de la carpeta oculta.
semilla_etiquetar_anotado v1.0 'Primera version del recetario'

# Una rama de trabajo sin confirmaciones propias, para que refs/heads tenga
# mas de una entrada y se vea que una rama es un archivo con un identificador.
semilla_rama borrador
semilla_cambiar main

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
