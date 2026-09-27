#!/usr/bin/env bash
# preparar y verificar un laboratorio (SPEC 028, puntos 1.4 y 1.6).
#
#     laboratorio.sh preparar 02 [--forzar]
#     laboratorio.sh verificar 02
#
# Lo llaman los envoltorios preparar y verificar de la raiz del taller,
# taller-git/, y funciona igual en la consola del taller y en Git Bash. Corre
# el preparar.sh o el verificar.sh del laboratorio, que vive en el clon, con
# TALLER_RAIZ apuntando a taller-git: ahi va el trabajo, en taller-git/lab-NN.
#
# Aceptan 2 y 02. Sin numero, si la carpeta actual esta dentro de un
# laboratorio, usan ese.
#
# Escrito para Bash 3.2, el de macOS.

set -u

VERBO=${1:-}
shift || true
AQUI=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$AQUI/.." && pwd -P)
RAIZ=$(cd "$CLON/.." && pwd -P)

decir() { printf '  %s\n' "$@"; }

case $VERBO in
  preparar|verificar) ;;
  *) echo "uso: laboratorio.sh preparar|verificar [NN] [--forzar]" >&2; exit 2 ;;
esac

NUMERO=''
FORZAR=''
for argumento in "$@"; do
  case $argumento in
    --forzar) FORZAR='--forzar' ;;
    [0-9]|[0-9][0-9]) NUMERO=$argumento ;;
    *)
      decir "No entendí «$argumento». Se escribe, por ejemplo, $VERBO 02." >&2
      exit 2
      ;;
  esac
done

if [ -z "$NUMERO" ]; then
  # El laboratorio de la carpeta de la consola, si esta dentro de
  # taller-git/lab-NN. El taller la pasa en TALLER_CARPETA_CONSOLA, porque la
  # orden corre parada en el clon (SPEC 029); en Git Bash es la actual.
  ACTUAL=$(cd "${TALLER_CARPETA_CONSOLA:-.}" 2>/dev/null && pwd -P || pwd -P)
  case "$ACTUAL/" in
    "$RAIZ"/lab-[0-9][0-9]/*)
      RESTO=${ACTUAL#"$RAIZ"/lab-}
      NUMERO=${RESTO%%/*}
      ;;
  esac
fi
if [ -z "$NUMERO" ]; then
  decir "¿Qué laboratorio? Esta carpeta no está dentro de uno. Escribe, por ejemplo, $VERBO 02." >&2
  exit 2
fi
NN=$(printf '%02d' "$((10#$NUMERO))")

if [ "$VERBO" = verificar ] && [ -n "$FORZAR" ]; then
  decir "verificar no lleva --forzar. Escribe verificar $NN." >&2
  exit 2
fi
if [ ! -d "$CLON/labs/lab-$NN" ]; then
  decir "No hay un laboratorio $NN en el curso." >&2
  exit 2
fi
SCRIPT="$CLON/labs/lab-$NN/$VERBO.sh"
if [ ! -f "$SCRIPT" ]; then
  if [ "$VERBO" = preparar ]; then
    decir "El laboratorio $NN no tiene preparación. Se arma a mano, siguiendo su enunciado desde el principio." >&2
  else
    decir "El laboratorio $NN no tiene verificador." >&2
  fi
  exit 2
fi

REPOSITORIO="$RAIZ/lab-$NN/recetario"
if [ "$VERBO" = preparar ] && [ -e "$REPOSITORIO" ] && [ -z "$FORZAR" ] && [ ! -t 0 ]; then
  # El script preguntaria por teclado, y la consola del taller no tiene. Nunca
  # se pasa --forzar por el participante.
  decir "El laboratorio $NN ya está preparado. Prepararlo de nuevo borra todo tu trabajo en lab-$NN, y no hay vuelta atrás." \
    "Si es lo que quieres, escribe preparar $NN --forzar." >&2
  exit 1
fi

# Parado en la raiz del clon (SPEC 027, 4.2): en Windows una carpeta no se
# puede borrar mientras algun proceso la tenga como directorio actual, y
# preparar --forzar borra la del laboratorio (SPEC 029).
cd "$CLON" || exit 1
TALLER_RAIZ="$RAIZ" bash "$SCRIPT" $FORZAR
ESTADO=$?

if [ "$VERBO" = preparar ] && [ "$ESTADO" -eq 0 ] && [ -d "$REPOSITORIO" ]; then
  if [ -n "${TALLER_CD_DESPUES:-}" ]; then
    # La consola del taller va sola a la carpeta del laboratorio.
    printf '%s' "$REPOSITORIO" > "$TALLER_CD_DESPUES"
    decir "La consola quedó en lab-$NN/recetario."
  else
    # En Git Bash un script no puede cambiar la carpeta de quien lo llama.
    decir "Para entrar al laboratorio escribe cd lab-$NN/recetario, desde taller-git."
  fi
  echo
fi
exit "$ESTADO"
