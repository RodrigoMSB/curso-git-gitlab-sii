#!/usr/bin/env bash
# Deja listos los archivos de la raiz de taller-git (SPEC 028, punto 1.3).
#
# Con doble clic en Finder, o desde la Terminal o Git Bash con
# bash curso/instalar.command, las veces que se quiera: si los archivos ya
# estan, los reemplaza. Copia los envoltorios de curso/taller/raiz, que no
# tienen logica propia. Si la carpeta no es la esperada, dice como tiene que
# quedar y no hace nada.

set -u
AQUI=$(cd "$(dirname "$0")" && pwd -P)
RAIZ=$(cd "$AQUI/.." && pwd -P)

if [ "$(basename "$AQUI")" != curso ] || [ "$(basename "$RAIZ")" != taller-git ]; then
  cat <<'TEXTO'

  El clon no está donde el taller lo espera, y no se hizo nada.
  La estructura tiene que quedar así.

      taller-git/
        curso/          el clon del curso, con este instalar.command adentro

  Crea una carpeta llamada taller-git, clona el curso adentro con el nombre
  curso, y vuelve a correr curso/instalar.command.

TEXTO
  exit 1
fi

for archivo in TALLER.cmd comprobar.cmd taller.sh taller.command comprobar.sh preparar verificar; do
  cp -p "$AQUI/taller/raiz/$archivo" "$RAIZ/$archivo" || exit 1
done
chmod +x "$RAIZ/taller.sh" "$RAIZ/taller.command" "$RAIZ/comprobar.sh" "$RAIZ/preparar" "$RAIZ/verificar"
echo
echo "  Listo. En $RAIZ quedaron taller.command, taller.sh y los demás."
echo "  Ahora haz doble clic en taller.command, en la carpeta taller-git."
echo
