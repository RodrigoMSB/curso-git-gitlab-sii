#!/usr/bin/env bash
# Semilla del laboratorio 09: remotos y submodulos. Produce dos paquetes.
#
#   lab-09-recetario.bundle   el repositorio con el que trabaja el
#                             participante; su remoto de origen es el paquete
#                             mismo, de modo que traer y enviar funcionan sin
#                             red (punto 5.5).
#   lab-09-condimentos.bundle un repositorio aparte, chico, para incorporar
#                             como submodulo.

LAB=09
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

CARPETA_PAQUETES=$(dirname "$PAQUETE")
PAQUETE_RECETARIO="$CARPETA_PAQUETES/lab-09-recetario.bundle"
PAQUETE_CONDIMENTOS="$CARPETA_PAQUETES/lab-09-condimentos.bundle"

# --- El recetario -----------------------------------------------------------

semilla_iniciar "$TRABAJO/recetario"

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
semilla_confirmar 'Agrega las dos primeras recetas'

semilla_dia_siguiente 2
semilla_mas_tarde 7200
contenido_cocineros base | semilla_escribir cocineros.md
semilla_confirmar 'Agrega la tabla de cocineros'

semilla_empaquetar "$PAQUETE_RECETARIO"
semilla_avisar "paquete en $PAQUETE_RECETARIO"

# --- Los condimentos, que entran como submodulo ------------------------------

semilla_iniciar "$TRABAJO/condimentos"
semilla_reloj_partir 4

semilla_escribir README.md <<'FIN'
# Condimentos del casino

Tabla de condimentos compartida entre los recetarios de las distintas
unidades. Se incorpora a cada recetario como submodulo, de modo que la
correccion de una cantidad llegue a todos.
FIN
semilla_confirmar 'Agrega el README de los condimentos'

semilla_dia_siguiente
semilla_mas_tarde 3600
semilla_escribir condimentos.md <<'FIN'
# Condimentos

| Condimento | Presentacion | Rinde |
|---|---|---|
| Aji de color | Frasco de 100 g | 40 porciones |
| Comino molido | Frasco de 50 g | 60 porciones |
| Oregano | Bolsa de 100 g | 80 porciones |
| Merken | Frasco de 80 g | 30 porciones |
FIN
semilla_confirmar 'Agrega la tabla de condimentos'

semilla_empaquetar "$PAQUETE_CONDIMENTOS"
semilla_avisar "paquete en $PAQUETE_CONDIMENTOS"
