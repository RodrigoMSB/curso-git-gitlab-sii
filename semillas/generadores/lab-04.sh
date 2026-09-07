#!/usr/bin/env bash
# Semilla del laboratorio 04: exclusiones y salida del seguimiento.
#
# Los tres archivos que no deberian estar versionados entran a la historia
# confirmada, no solo al directorio de trabajo. Esa es la diferencia entre
# ignorar un archivo y sacarlo del seguimiento, que es el punto del ejercicio
# (criterio CA8). No hay archivo de exclusiones: lo crea el participante.

LAB=04
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
contenido_platos base | semilla_escribir platos.md
semilla_confirmar 'Agrega el README y la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 3600
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
receta_empanadas | semilla_escribir recetas/empanadas.md
receta_cazuela | semilla_escribir recetas/cazuela.md
semilla_confirmar 'Agrega las tres primeras recetas'

# Aqui entran los archivos que sobran. Van confirmados a proposito.
semilla_dia_siguiente
semilla_mas_tarde 7200
semilla_escribir notas.tmp <<'FIN'
ojo: revisar cantidades del pastel de choclo
la cazuela salio para 12 y no para 10
FIN
semilla_escribir respaldo.bak <<'FIN'
copia del listado de platos antes de sumar el charquican
FIN
semilla_confirmar 'Guarda notas de la reunion de cocina'

semilla_dia_siguiente 2
semilla_mas_tarde 1800
semilla_escribir credenciales.txt <<'FIN'
casino-intranet
usuario: casino_recetas
clave: choclo2026
FIN
semilla_confirmar 'Agrega el acceso al sistema del casino'

semilla_dia_siguiente 3
semilla_mas_tarde 5400
contenido_ingredientes base | semilla_escribir ingredientes.md
receta_charquican | semilla_escribir recetas/charquican.md
contenido_platos base | semilla_escribir platos.md
semilla_confirmar 'Suma el charquican y completa los ingredientes'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
