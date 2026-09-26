#!/usr/bin/env bash
# La comprobacion del primer dia, desde Git Bash o la Terminal: ./comprobar.sh
# Envoltorio. Lo que hace vive en curso/taller/comprobar.sh.
exec bash "$(cd "$(dirname "$0")" && pwd -P)/curso/taller/comprobar.sh" "$@"
