#!/usr/bin/env bash
# Preambulo comun de los generadores. Resuelve rutas y carga las bibliotecas.
#
# Se espera que el generador haya definido LAB antes de cargarlo, y acepta dos
# argumentos opcionales: donde construir el repositorio y donde dejar el
# paquete. Las pruebas los usan para trabajar sobre directorios temporales.

set -eu

SEMILLAS=$(cd "$(dirname "$0")/.." && pwd)
. "$SEMILLAS/lib/comun.sh"
. "$SEMILLAS/lib/contenido.sh"

TRABAJO=${1:-${TMPDIR:-/tmp}/semilla-lab-$LAB}
PAQUETE=${2:-$SEMILLAS/paquetes/lab-$LAB.bundle}

case $TRABAJO in /*) ;; *) TRABAJO=$PWD/$TRABAJO ;; esac
case $PAQUETE in /*) ;; *) PAQUETE=$PWD/$PAQUETE ;; esac

echo "generando la semilla del laboratorio $LAB"
