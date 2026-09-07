#!/usr/bin/env bash
# Preparacion del laboratorio 09.
#
# Vuelve a poner el remoto de origen, que `preparar.sh` quita en todas las
# demas semillas. Aqui el remoto es la materia del ejercicio: apunta al
# paquete local, de modo que traer y enviar funcionen sin red.

set -eu
cd "$1"

PAQUETES=${SEMILLAS:-$(cd "$(dirname "$0")/.." && pwd)}/paquetes

git remote add origin "$PAQUETES/lab-09-recetario.bundle"
git fetch -q origin
git branch -q --set-upstream-to=origin/main main 2> /dev/null || true
