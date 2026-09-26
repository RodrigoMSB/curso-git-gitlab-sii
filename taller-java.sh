#!/usr/bin/env bash
# Arranca el modo taller desde Git Bash o desde la Terminal de Mac (SPEC 026).
#
#     ./taller-java.sh
#
# Es el camino para cuando el doble clic en TALLER-JAVA.cmd esta bloqueado.
exec "$(cd "$(dirname "$0")" && pwd -P)/taller-java/arrancar.sh" "$@"
