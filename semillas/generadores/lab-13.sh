#!/usr/bin/env bash
# Semilla del laboratorio 13: primera tuberia de integracion.
#
# El recetario terminado, con dos cosas puestas a proposito:
#
#   - No hay archivo de definicion de la tuberia. Escribirlo es el ejercicio.
#   - `platos.md` trae un error de formato, de modo que la primera ejecucion
#     de la tuberia falle y el participante vea el fallo antes que el exito.
#
# Ver semillas/descripciones/lab-13.md.

LAB=13
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
contenido_platos base | semilla_escribir platos.md
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega platos e ingredientes'

semilla_dia_siguiente
semilla_mas_tarde 5400
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
receta_empanadas | semilla_escribir recetas/empanadas.md
receta_cazuela | semilla_escribir recetas/cazuela.md
semilla_confirmar 'Agrega las tres primeras recetas'

semilla_dia_siguiente 2
semilla_mas_tarde 7200
contenido_cocineros completo | semilla_escribir cocineros.md
semilla_escribir .gitignore <<'FIN'
*.tmp
*.bak
credenciales.txt
FIN
semilla_confirmar 'Agrega cocineros y exclusiones'

# El error de formato. La tabla de la seccion de fondos queda con una fila de
# tres columnas donde el encabezado declara dos, y el listado mezcla guiones
# con asteriscos. Cualquier revisor de formato lo marca.
semilla_dia_siguiente
semilla_mas_tarde 1800
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

| Plato | Porciones |
|---|---|
| Pastel de choclo | 12 |
| Cazuela de vacuno | 10 | 75 minutos |
| Charquican | 8 |

## Entradas

- Empanadas de pino
* Ensalada chilena
- Sopaipillas

## Postres

- Leche asada
FIN
semilla_confirmar 'Pasa los fondos a tabla con porciones'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
