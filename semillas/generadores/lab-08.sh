#!/usr/bin/env bash
# Semilla del laboratorio 08: guardado temporal y limpieza de la historia.
#
# La rama de trabajo trae cuatro confirmaciones con mensajes pobres, que es lo
# que el participante va a juntar y reescribir. `main` avanzo por su cuenta
# desde que la rama se separo, de modo que el rebase tenga sentido.
#
# El guardado temporal queda vacio a proposito: las entradas las crea el
# participante en el ejercicio. La receta a medio escribir la deja el script
# de preparacion, porque el directorio de trabajo no viaja en el paquete.

LAB=08
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
contenido_platos base | semilla_escribir platos.md
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega platos e ingredientes'

BASE_TAILANDESA=$(git rev-parse HEAD)

# main sigue avanzando por su cuenta.
semilla_dia_siguiente
semilla_mas_tarde 5400
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
semilla_confirmar 'Agrega la receta del pastel de choclo'

semilla_dia_siguiente 2
semilla_mas_tarde 7200
contenido_cocineros base | semilla_escribir cocineros.md
semilla_confirmar 'Agrega la tabla de cocineros'

# La rama de trabajo, con los mensajes que el laboratorio pide arreglar.
semilla_rama tailandesa "$BASE_TAILANDESA"

semilla_dia_siguiente
semilla_mas_tarde 1800
receta_pad_thai | semilla_escribir recetas/pad-thai.md
semilla_confirmar 'wip'

semilla_dia_siguiente
semilla_mas_tarde 3600
semilla_escribir recetas/pad-thai.md <<'FIN'
# Pad thai

Porciones: 6
Tiempo: 40 minutos

## Ingredientes

- 400 g de fideos de arroz
- 300 g de camarones
- 2 huevos
- Brotes de soya, mani, cebollin
- Salsa de tamarindo, salsa de pescado, azucar rubia

## Preparacion

1. Remojar los fideos en agua caliente por 20 minutos.
2. Saltear los camarones a fuego fuerte y reservar.
3. Revolver los huevos en el mismo wok y agregar los fideos escurridos.
4. Sumar la salsa, los brotes y los camarones. Servir con mani molido.

## Notas

Rinde justo para seis. Para diez conviene doblar todo menos la salsa.
FIN
semilla_confirmar 'cambios'

semilla_dia_siguiente
semilla_mas_tarde 9000
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican
- Pad thai

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
semilla_confirmar 'mas cambios'

semilla_dia_siguiente 2
semilla_mas_tarde 5400
semilla_escribir recetas/curry-verde.md <<'FIN'
# Curry verde

Porciones: 6
Tiempo: 45 minutos

## Ingredientes

- 2 cucharadas de pasta de curry verde
- 800 ml de leche de coco
- 600 g de pollo
- Berenjena tailandesa, albahaca, salsa de pescado
FIN
semilla_confirmar 'arreglos'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
