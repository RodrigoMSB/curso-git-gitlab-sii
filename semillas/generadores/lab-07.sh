#!/usr/bin/env bash
# Semilla del laboratorio 07: deshacer sin reescribir la historia.
#
# Siete confirmaciones. La cuarta introduce un error evidente en la tabla de
# ingredientes y quedan tres confirmaciones encima. El enunciado la trata como
# ya publicada, que es lo que hace preferible revertir antes que retroceder:
# retroceder obligaria a reescribir tres confirmaciones que otros ya tienen.

LAB=07
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
contenido_platos base | semilla_escribir platos.md
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 5400
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega los ingredientes base'

# El error plantado. Ver semillas/descripciones/lab-07.md.
semilla_dia_siguiente
semilla_mas_tarde 1800
semilla_escribir ingredientes.md <<'FIN'
# Ingredientes

| Ingrediente | Unidad de compra |
|---|---|
| Choclo | Bolsa de 1 kg |
| Carne de vacuno | Saco de 25 kg por porcion |
| Cebolla | Malla de 2 kg |
| Zapallo camote | Kilo |
| Papas | Saco de 5 kg |
| Aji de color | Frasco de 100 g |
| Aceitunas | Frasco de 500 g |
FIN
semilla_confirmar 'Corrige la unidad de compra de la carne'

semilla_dia_siguiente 2
semilla_mas_tarde 7200
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
semilla_confirmar 'Agrega la receta del pastel de choclo'

semilla_dia_siguiente
semilla_mas_tarde 3600
receta_cazuela | semilla_escribir recetas/cazuela.md
semilla_confirmar 'Agrega la receta de la cazuela'

semilla_dia_siguiente 3
semilla_mas_tarde 10800
contenido_cocineros base | semilla_escribir cocineros.md
semilla_confirmar 'Agrega la tabla de cocineros'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
