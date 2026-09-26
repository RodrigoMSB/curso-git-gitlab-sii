#!/usr/bin/env bash
# Arranca el modo taller con doble clic desde Finder (SPEC 026).
#
# Finder lo abre en una ventana de Terminal parada en la carpeta personal, y
# por eso se ubica solo. La ventana queda abierta mientras el taller corre.
exec "$(cd "$(dirname "$0")" && pwd -P)/taller-java/arrancar.sh" "$@"
