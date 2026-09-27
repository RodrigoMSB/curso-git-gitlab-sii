#!/usr/bin/env bash
# Punto de entrada unico de las semillas (punto 5.4 del SPEC 003).
#
#   semillas/preparar.sh 06 [directorio] [--rehacer]
#
# Clona el paquete del laboratorio, deja el directorio de trabajo en el estado
# que el enunciado supone y comprueba que quedo asi. Con eso el enunciado dice
# una sola orden y no cinco. No usa la red: el paquete ya esta en disco.

set -eu

SEMILLAS=$(cd "$(dirname "$0")" && pwd)

uso() {
  cat >&2 <<'FIN'
uso: semillas/preparar.sh <laboratorio> [directorio] [--rehacer]

  laboratorio  numero de dos digitos: 02 03 04 05 06 07 08 09 10 13
  directorio   donde dejar el repositorio (por omision ./recetario)
  --rehacer    borra el directorio si ya existe

Los laboratorios 01, 11, 12, 14 y 15 no llevan semilla.
FIN
  exit 2
}

fallar() {
  echo "preparar: $*" >&2
  exit 1
}

LAB=''
DESTINO=''
REHACER=no

for argumento in "$@"; do
  case $argumento in
    --rehacer) REHACER=si ;;
    -h | --help) uso ;;
    -*) fallar "opcion desconocida: $argumento" ;;
    *)
      if [ -z "$LAB" ]; then LAB=$argumento
      elif [ -z "$DESTINO" ]; then DESTINO=$argumento
      else fallar "sobra el argumento $argumento"
      fi
      ;;
  esac
done

[ -n "$LAB" ] || uso

# Se acepta «6» ademas de «06»: en clase nadie escribe el cero.
case $LAB in
  [0-9]) LAB="0$LAB" ;;
  [0-9][0-9]) ;;
  *) fallar "el laboratorio se indica con un numero, no con «$LAB»" ;;
esac

case $LAB in
  01 | 11 | 12 | 14 | 15)
    fallar "el laboratorio $LAB no lleva semilla: parte de un directorio vacio o del resultado del anterior"
    ;;
  02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 13) ;;
  *) fallar "no existe el laboratorio $LAB" ;;
esac

[ -n "$DESTINO" ] || DESTINO=./recetario

# El paquete del laboratorio 09 lleva sufijo, porque son dos.
if [ "$LAB" = '09' ]; then
  PAQUETE="$SEMILLAS/paquetes/lab-09-recetario.bundle"
else
  PAQUETE="$SEMILLAS/paquetes/lab-$LAB.bundle"
fi

[ -f "$PAQUETE" ] ||
  fallar "falta el paquete $PAQUETE; se regenera con semillas/generar.sh $LAB"

# Absoluta desde ya, para poder salir de ella antes de borrarla.
case $DESTINO in
  /*) ;;
  *) DESTINO="$PWD/$DESTINO" ;;
esac

if [ -e "$DESTINO" ]; then
  if [ "$REHACER" = 'si' ]; then
    # Fuera de la carpeta antes de borrarla: en Windows no se puede borrar la
    # que es el directorio actual de un proceso (SPEC 029).
    cd "$(dirname "$DESTINO")" || exit 1
    rm -rf "$DESTINO"
  else
    fallar "$DESTINO ya existe; agregar --rehacer para reemplazarlo"
  fi
fi

echo "preparando el laboratorio $LAB en $DESTINO"

git clone -q "$PAQUETE" "$DESTINO" ||
  fallar "no se pudo clonar el paquete $PAQUETE"

DESTINO=$(cd "$DESTINO" && pwd)

cd "$DESTINO"

# Al clonar un paquete, las ramas que no son la principal quedan solo como
# ramas de seguimiento. Se crean como ramas locales para que el participante
# las vea con `git branch`, que es lo que el enunciado supone.
# Se recorre el nombre completo de cada referencia y no el abreviado: el
# paquete trae tambien `HEAD`, que al clonar queda como `refs/remotes/origin`
# a secas, y tomarla por una rama creaba una rama llamada «origin».
for referencia in $(git for-each-ref --format='%(refname)' refs/remotes/origin); do
  case $referencia in
    refs/remotes/origin/HEAD) continue ;;
    refs/remotes/origin/*) rama=${referencia#refs/remotes/origin/} ;;
    *) continue ;;
  esac
  git show-ref --verify --quiet "refs/heads/$rama" || git branch -q "$rama" "$referencia"
done

# El remoto apunta al paquete y solo sirvio para clonar. Se quita, salvo en el
# laboratorio 09, cuyo script de preparacion vuelve a ponerlo porque ahi el
# remoto es la materia del ejercicio.
git remote remove origin 2> /dev/null || true

# La identidad queda puesta como en el simulador, de modo que el indicador y
# las confirmaciones nuevas coincidan con lo que el participante ya vio.
git config user.name 'Participante del taller'
git config user.email 'participante@sii.cl'
git config core.autocrlf false
git config core.eol lf

PREPARACION="$SEMILLAS/preparacion/lab-$LAB.sh"
if [ -f "$PREPARACION" ]; then
  # shellcheck source=/dev/null
  SEMILLAS="$SEMILLAS" bash "$PREPARACION" "$DESTINO" ||
    fallar "el script de preparacion del laboratorio $LAB fallo"
fi

VERIFICADOR="$SEMILLAS/verificadores/lab-$LAB.sh"
if [ -f "$VERIFICADOR" ]; then
  bash "$VERIFICADOR" "$DESTINO" ||
    fallar "la semilla del laboratorio $LAB no quedo en el estado esperado"
fi

echo "listo: $DESTINO"
if [ "$LAB" = '09' ]; then
  echo "el repositorio de condimentos esta en $SEMILLAS/paquetes/lab-09-condimentos.bundle"
fi
