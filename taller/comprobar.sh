#!/usr/bin/env bash
# La comprobacion del primer dia (SPEC 026, seccion 5), con el mismo arrancador.
exec bash "$(cd "$(dirname "$0")" && pwd -P)/arrancar.sh" --comprobar "$@"
