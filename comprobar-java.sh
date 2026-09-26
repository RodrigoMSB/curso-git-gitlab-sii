#!/usr/bin/env bash
# Comprobacion del primer dia del modo taller, desde Git Bash o la Terminal de Mac (SPEC 026).
#
#     ./comprobar-java.sh
exec "$(cd "$(dirname "$0")" && pwd -P)/taller-java/arrancar.sh" --comprobar "$@"
