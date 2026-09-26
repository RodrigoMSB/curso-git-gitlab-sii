#!/usr/bin/env bash
# Arranca el taller desde Git Bash o desde la Terminal: ./taller.sh
# Envoltorio. Lo que hace vive en curso/taller/arrancar.sh, que se actualiza con git pull.
exec bash "$(cd "$(dirname "$0")" && pwd -P)/curso/taller/arrancar.sh" "$@"
