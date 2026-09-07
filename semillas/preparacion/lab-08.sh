#!/usr/bin/env bash
# Preparacion del laboratorio 08.
#
# Deja una receta a medio escribir en el directorio de trabajo. Es lo que el
# participante va a guardar temporalmente antes de cambiar de rama, de modo
# que el guardado temporal tenga algo que guardar.

set -eu
cd "$1"

cat > recetas/curry-massaman.md <<'FIN'
# Curry massaman

Porciones: 6
Tiempo:

## Ingredientes

- 3 cucharadas de pasta massaman
- 800 ml de leche de coco
- 700 g de posta negra
- Papas, mani tostado, canela

## Preparacion

1. Sofreir la pasta en la crema de la leche de coco.
2.
FIN
