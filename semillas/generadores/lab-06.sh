#!/usr/bin/env bash
# Semilla del laboratorio 06: fusiones y conflictos.
#
# Dos ramas con destinos distintos a proposito (criterio CA7):
#
#   mexicana  nace de la punta de main, que no avanzo despues, de modo que su
#             fusion es un avance rapido y no crea confirmacion de union.
#   peruana   nace una confirmacion antes y toca la misma linea de platos.md
#             que toco main despues, de modo que su fusion choca.

LAB=06
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 7200
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega los ingredientes base'

# De aqui cuelga la rama que va a chocar: nace antes de que main toque la
# linea de la cazuela.
BASE_PERUANA=$(git rev-parse HEAD)

semilla_dia_siguiente 2
semilla_mas_tarde 5400
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno con chuchoca
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
semilla_confirmar 'Precisa que la cazuela lleva chuchoca'

# La rama que choca: cambia la misma linea que acaba de cambiar main.
semilla_dia_siguiente
semilla_mas_tarde 3600
semilla_rama peruana "$BASE_PERUANA"
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Lomo saltado
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
receta_lomo_saltado | semilla_escribir recetas/lomo-saltado.md
semilla_confirmar 'Reemplaza la cazuela por el lomo saltado'

# La rama que se fusiona por avance rapido: nace de la punta de main y main no
# vuelve a moverse.
semilla_cambiar main
semilla_dia_siguiente
semilla_mas_tarde 1800
semilla_rama mexicana
receta_guacamole | semilla_escribir recetas/guacamole.md
semilla_confirmar 'Agrega la receta del guacamole'

semilla_dia_siguiente
semilla_mas_tarde 9000
semilla_escribir platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno con chuchoca
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
- Guacamole
FIN
semilla_confirmar 'Suma el guacamole a las entradas'

semilla_cambiar main

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
