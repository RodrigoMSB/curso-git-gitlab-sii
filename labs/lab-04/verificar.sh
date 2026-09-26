#!/usr/bin/env bash
# Verificador del laboratorio 04 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado son las ramas:
# el escenario trae una sola y el enunciado deja seis.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-04"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-04/recetario'

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
  echo "Comprobando el escenario inicial del laboratorio 04"
else
  echo "Verificador del laboratorio 04 · tres cocinas en paralelo"
fi
echo

# --- Existe el repositorio ---------------------------------------------------

HAY_REPOSITORIO=no
if [ ! -d "$REPOSITORIO" ]; then
  fallido 'existe el repositorio' \
    "un repositorio Git en $REPOSITORIO_DICHO" \
    'la carpeta recetario no existe, falta preparar el laboratorio'
else
  # Se le pregunta todo a Git, sin comparar rutas: `--git-dir` responde `.git`
  # solo si la carpeta es la raiz de su propio repositorio; dentro de otro,
  # responde la ruta del .git de mas arriba. Comparar la cima con la ruta de
  # Bash fallaba en Windows, donde Bash escribe /c/Users/... y Git
  # C:/Users/... (SPEC 021).
  PROPIO=$(g rev-parse --git-dir) || PROPIO=''
  if [ "$PROPIO" = '.git' ]; then
    HAY_REPOSITORIO=si
    aprobado "existe el repositorio en $REPOSITORIO_DICHO"
  else
    fallido 'existe el repositorio' \
      "un repositorio Git en $REPOSITORIO_DICHO" \
      'la carpeta existe pero no es un repositorio'
  fi
fi

RAMAS=$(g for-each-ref --format='%(refname:short)' refs/heads | sort | paste -sd ' ' -)

if [ "$MODO" = final ]; then
  ESPERADAS='andina azteca fritangas main rescate tailandesa'
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'las seis ramas del enunciado' "$ESPERADAS"
  elif [ "$RAMAS" = "$ESPERADAS" ]; then
    aprobado 'estan las seis ramas: main, tailandesa, azteca, andina, rescate y fritangas'
  else
    fallido 'las seis ramas del enunciado' "$ESPERADAS" "${RAMAS:-ninguna}"
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'estas parado en main' 'main'
  else
    ACTUAL=$(g branch --show-current)
    if [ "$ACTUAL" = 'main' ]; then
      aprobado 'estas parado en main, no en una posicion desconectada'
    elif [ -z "$ACTUAL" ]; then
      fallido 'estas parado en main' 'main' \
        'HEAD no apunta a ninguna rama; quedaste desconectado, vuelve con git switch main'
    else
      fallido 'estas parado en main' 'main' "$ACTUAL"
    fi
  fi

  # Cinco puntos de separacion distintos, que es lo que el enunciado hace
  # dibujar en el grafo.
  if [ "$HAY_REPOSITORIO" = si ]; then
    BASES=$(for rama in tailandesa azteca andina rescate fritangas; do
      g merge-base main "$rama" 2>/dev/null
    done | sort -u | grep -c .)
    if [ "$BASES" -ge 4 ]; then
      aprobado "las ramas nacen de $BASES puntos distintos de la historia"
    else
      fallido 'las ramas nacen de puntos distintos' 'al menos 4 puntos de separacion' "$BASES"
    fi
  else
    sin_repositorio 'las ramas nacen de puntos distintos' 'al menos 4 puntos de separacion'
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
  if [ "$CONFIRMACIONES" = '6' ]; then
    aprobado 'hay seis confirmaciones en el historial'
  else
    fallido 'cantidad de confirmaciones' '6' "$CONFIRMACIONES"
  fi

  if [ "$RAMAS" = 'main' ]; then
    aprobado 'hay una sola rama: abrir las otras es el ejercicio'
  else
    fallido 'una sola rama de partida' 'main' "$RAMAS"
  fi

  FUSIONES=$(g log --merges --format=%H | grep -c .) || FUSIONES=0
  if [ "$FUSIONES" = '0' ]; then
    aprobado 'la historia es una sola linea recta'
  else
    fallido 'historia lineal' 'ninguna confirmacion de union' "$FUSIONES"
  fi

  # Cada confirmacion toca un archivo distinto: es lo que hace que las ramas
  # nazcan de puntos que se distinguen.
  VARIAS=$(g log --format=%H | while read -r id; do
    g show --name-only --format='' "$id" | grep -c .
  done | grep -c -v '^1$') || VARIAS=0
  if [ "$VARIAS" = '0' ]; then
    aprobado 'cada confirmacion toca un solo archivo'
  else
    fallido 'cada confirmacion toca un solo archivo' '0 con mas de uno' "$VARIAS"
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
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-04 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-04 terminado"
fi
echo
