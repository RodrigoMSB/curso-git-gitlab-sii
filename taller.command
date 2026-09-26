#!/bin/sh
# Taller de Git (SPEC 026). Doble clic para abrirlo en Mac: la consola de la
# pagina ejecuta Git de verdad. No cierres la ventana mientras trabajas.
cd "$(dirname "$0")" || exit 1
for python in python3 python; do
  if command -v "$python" >/dev/null 2>&1 && "$python" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' 2>/dev/null; then
    exec "$python" taller/taller.py
  fi
done
echo "No se encontro Python 3.9 o superior en este equipo. Avisa al relator antes de seguir."
read -r _
