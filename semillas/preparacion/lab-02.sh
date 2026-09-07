#!/usr/bin/env bash
# Preparacion del laboratorio 02.
#
# El paquete solo transporta historia confirmada (punto 5.3). Lo que el
# enunciado necesita ademas es suciedad en el directorio de trabajo: un
# archivo modificado sin preparar y otro preparado por error.

set -eu
cd "$1"

# Modificado y sin preparar: el participante lo vera en rojo en `git status`.
cat > platos.md <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican
- Porotos granados

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN

# Preparado por error: es un archivo temporal que nunca debio prepararse, y el
# laboratorio pide sacarlo del area de preparacion con `git restore --staged`.
cat > notas.tmp <<'FIN'
pendiente: confirmar con Marta las porciones de la cazuela
FIN
git add notas.tmp
