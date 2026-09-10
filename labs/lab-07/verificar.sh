#!/usr/bin/env bash
# Verificador del laboratorio 07 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado es la
# confirmacion de reversion y la etiqueta anotada. El escenario trae siete
# confirmaciones y ninguna etiqueta.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-07"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-07/recetario'

MODO=final
if [ "${1:-}" = '--escenario' ]; then
  MODO=escenario
elif [ $# -gt 0 ]; then
  echo "verificar.sh: opcion desconocida «${1}»" >&2
  echo "uso: ./verificar.sh" >&2
  exit 2
fi

APROBADOS=0
FALLIDOS=0

aprobado() {
  APROBADOS=$((APROBADOS + 1))
  echo "  ✓ $1"
}

fallido() {
  FALLIDOS=$((FALLIDOS + 1))
  echo "  ✗ $1"
  echo "      esperaba: $2"
  echo "      encontro: $3"
}

sin_repositorio() {
  fallido "$1" "$2" 'no se pudo comprobar, no hay repositorio'
}

g() {
  git -C "$REPOSITORIO" "$@" 2>/dev/null
}

# `--porcelain` deja un espacio en la primera columna cuando el cambio no esta
# preparado. Recortarlo lee el estado al reves (seccion 27 de la arquitectura).
suciedad() {
  git -C "$REPOSITORIO" status --porcelain 2>/dev/null | sed 's/[[:space:]]*$//' | paste -sd '|' -
}

echo
if [ "$MODO" = escenario ]; then
  echo "Comprobando el escenario inicial del laboratorio 07"
else
  echo "Verificador del laboratorio 07 · retroceder, revertir y etiquetar"
fi
echo

# --- Existe el repositorio ---------------------------------------------------

HAY_REPOSITORIO=no
if [ ! -d "$REPOSITORIO" ]; then
  fallido 'existe el repositorio' \
    "un repositorio Git en $REPOSITORIO_DICHO" \
    'la carpeta recetario no existe, falta preparar el laboratorio'
else
  CIMA=$(g rev-parse --show-toplevel) || CIMA=''
  if [ "$CIMA" = "$REPOSITORIO" ]; then
    HAY_REPOSITORIO=si
    aprobado "existe el repositorio en $REPOSITORIO_DICHO"
  else
    fallido 'existe el repositorio' \
      "un repositorio Git en $REPOSITORIO_DICHO" \
      'la carpeta existe pero no es un repositorio'
  fi
fi

if [ "$MODO" = final ]; then
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'hay una confirmacion mas que al empezar' '8'
  else
    CONFIRMACIONES=$(g rev-list --count HEAD) || CONFIRMACIONES=0
    if [ "$CONFIRMACIONES" = '8' ]; then
      aprobado 'hay ocho confirmaciones: las siete originales mas la reversion'
    else
      fallido 'cantidad de confirmaciones' \
        '8, o sea las siete del escenario mas la de la reversion' \
        "$CONFIRMACIONES; revertir agrega historia, no la quita"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'la reversion esta en la historia' 'una confirmacion que empiece por Revert'
  else
    REVERSIONES=$(g log --format=%s | grep -c '^Revert') || REVERSIONES=0
    if [ "$REVERSIONES" = '1' ]; then
      aprobado 'la reversion quedo en la historia, con su confirmacion propia'
    else
      fallido 'la reversion esta en la historia' 'una confirmacion que empiece por Revert' \
        "$REVERSIONES"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'solo queda la etiqueta v1.0' 'v1.0'
  else
    ETIQUETAS=$(g tag | sort | paste -sd ' ' -)
    if [ "$ETIQUETAS" = 'v1.0' ]; then
      aprobado 'solo queda la etiqueta v1.0'
    else
      fallido 'solo queda la etiqueta v1.0' 'v1.0' \
        "${ETIQUETAS:-ninguna}; v0.9 era de practica y hay que borrarla"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'v1.0 es una etiqueta anotada, con mensaje' 'una etiqueta de tipo tag'
  else
    TIPO=$(g cat-file -t v1.0) || TIPO=''
    if [ "$TIPO" = 'tag' ]; then
      aprobado 'v1.0 es una etiqueta anotada y lleva su mensaje'
    else
      fallido 'v1.0 es una etiqueta anotada' 'una etiqueta de tipo tag' \
        "${TIPO:-no existe}; una etiqueta simple no guarda mensaje ni autor"
    fi
  fi

  # Las dos confirmaciones siguen en la historia: la que metio el error y la
  # que lo deshizo. Ese es el punto del laboratorio.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el error y su reversion siguen los dos en la historia' '2 confirmaciones'
  else
    CON_ERROR=$(g log -S 'sal marina en polvo' --format=%H | grep -c .) || CON_ERROR=0
    if [ "$CON_ERROR" = '2' ]; then
      aprobado 'el error y su reversion siguen los dos en la historia'
    else
      fallido 'el error y su reversion siguen los dos en la historia' \
        '2 confirmaciones que tocan «sal marina en polvo»' \
        "$CON_ERROR; si es 1 falta revertir, si es 0 se reescribio la historia"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el directorio de trabajo esta limpio' 'nada que confirmar'
  else
    SUCIO=$(suciedad)
    if [ -z "$SUCIO" ]; then
      aprobado 'el directorio de trabajo esta limpio'
    else
      fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' "hay cambios: $SUCIO"
    fi
  fi
fi

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  CONFIRMACIONES=$(g rev-list --count HEAD) || CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" = '7' ]; then
    aprobado 'hay siete confirmaciones en el historial'
  else
    fallido 'cantidad de confirmaciones' '7' "$CONFIRMACIONES"
  fi

  if grep -q 'sal marina en polvo' "$REPOSITORIO/ingredientes.md" 2>/dev/null; then
    aprobado 'el error plantado esta en ingredientes.md, listo para encontrarse por contenido'
  else
    fallido 'el error plantado' 'la linea «sal marina en polvo» en ingredientes.md' 'no esta'
  fi

  # Tres confirmaciones encima del error: es lo que hace preferible revertir
  # antes que retroceder.
  ERROR=$(g log --format=%H -S 'sal marina en polvo' | tail -1)
  ENCIMA=$(g rev-list --count "$ERROR"..HEAD) || ENCIMA=0
  if [ "$ENCIMA" = '3' ]; then
    aprobado 'quedan tres confirmaciones encima del error'
  else
    fallido 'confirmaciones posteriores al error' '3' "$ENCIMA"
  fi

  # El mensaje no delata el error: el enunciado lo hace buscar por contenido.
  if g log --format=%s | grep -qi 'sal marina'; then
    fallido 'el mensaje no delata el error' \
      'ningun mensaje que nombre la sal marina' 'alguno la nombra'
  else
    aprobado 'ningun mensaje delata el error: hay que buscarlo por contenido'
  fi

  ETIQUETAS=$(g tag | paste -sd ' ' -)
  if [ -z "$ETIQUETAS" ]; then
    aprobado 'no hay etiquetas: ponerlas es el ejercicio'
  else
    fallido 'no hay etiquetas de partida' 'ninguna' "$ETIQUETAS"
  fi

  SUCIO=$(suciedad)
  if [ -z "$SUCIO" ]; then
    aprobado 'el directorio de trabajo esta limpio'
  else
    fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' "hay cambios: $SUCIO"
  fi
fi

# --- Resumen -----------------------------------------------------------------

TOTAL=$((APROBADOS + FALLIDOS))
echo
if [ "$FALLIDOS" -gt 0 ]; then
  if [ "$MODO" = escenario ]; then
    echo "  $APROBADOS de $TOTAL · el escenario NO quedo como corresponde"
  else
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-07 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-07 terminado"
fi
echo
