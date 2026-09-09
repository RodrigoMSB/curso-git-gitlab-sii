#!/usr/bin/env bash
# Verificador del laboratorio 01 (seccion 3 del SPEC 004).
#
# Comprueba el resultado del ejercicio, no un estado inicial: los cinco
# criterios son los mismos que el enunciado lista en su seccion
# «Comprobacion». Se corre sin argumentos y trabaja siempre sobre el
# ./recetario que queda junto a este script, sin importar desde donde se
# invoque.
#
# Escrito para Bash 3.2, el de macOS. Git Bash sobre Windows trae uno mas
# nuevo y acepta lo que funciona en el viejo, pero no al reves.

set -u

LABORATORIO='lab-01'
RAIZ=$(cd "$(dirname "$0")" && pwd)
REPOSITORIO="$RAIZ/recetario"
# Como se nombra el repositorio en los mensajes: la ruta larga de la maquina
# de cada participante no le dice nada a nadie.
REPOSITORIO_DICHO='labs/lab-01/recetario'

APROBADOS=0
FALLIDOS=0

aprobado() {
  APROBADOS=$((APROBADOS + 1))
  echo "  ✓ $1"
}

# Un criterio fallido dice que esperaba y que encontro. Decir solo que fallo
# deja al participante sin nada que hacer con la informacion.
fallido() {
  FALLIDOS=$((FALLIDOS + 1))
  echo "  ✗ $1"
  echo "      esperaba: $2"
  echo "      encontro: $3"
}

echo
echo "Verificador del laboratorio 01 · el recetario nace"
echo

# --- Criterio 1 · existe el repositorio ------------------------------------

# El repositorio tiene que ser el de la carpeta recetario y no otro. Preguntar
# solo si Git responde ahi no sirve: recetario vive dentro del repositorio del
# curso, y Git, cuando no encuentra un .git propio, sigue subiendo hasta dar
# con el de mas arriba. Sin esta comparacion, olvidar el `git init` pasaba
# inadvertido y los demas criterios se median contra la historia del curso.
HAY_REPOSITORIO=no
if [ ! -d "$REPOSITORIO" ]; then
  fallido 'existe el repositorio' \
    "un repositorio Git en $REPOSITORIO_DICHO" \
    'la carpeta recetario no existe'
else
  CIMA=$(git -C "$REPOSITORIO" rev-parse --show-toplevel 2>/dev/null) || CIMA=''
  if [ "$CIMA" = "$REPOSITORIO" ]; then
    HAY_REPOSITORIO=si
    aprobado "existe el repositorio en $REPOSITORIO_DICHO"
  else
    fallido 'existe el repositorio' \
      "un repositorio Git en $REPOSITORIO_DICHO" \
      'la carpeta existe pero no es un repositorio, falta el git init'
  fi
fi

# Los tres criterios que siguen leen el repositorio. Sin el no se pueden
# evaluar, pero igual se imprime una linea por cada uno: el participante tiene
# que ver los cinco criterios y no una lista que se corta a la primera falla.
sin_repositorio() {
  fallido "$1" "$2" 'no se pudo comprobar, no hay repositorio'
}

# --- Criterio 2 · cuatro confirmaciones ------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'cantidad de confirmaciones' '4'
else
  CONFIRMACIONES=$(git -C "$REPOSITORIO" rev-list --count HEAD 2>/dev/null) ||
    CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" = '4' ]; then
    aprobado 'hay cuatro confirmaciones en el historial'
  elif [ "$CONFIRMACIONES" = '0' ]; then
    fallido 'cantidad de confirmaciones' '4' \
      'ninguna, el repositorio no tiene historial todavia'
  else
    fallido 'cantidad de confirmaciones' '4' "$CONFIRMACIONES"
  fi
fi

# --- Criterio 3 · cocineros.md modificado y sin preparar -------------------

# La comparacion es contra el arbol de trabajo, no contra el indice: lo que se
# exige es que el cambio siga pendiente, que es el objetivo del laboratorio.
if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'cocineros.md modificado y sin preparar' \
    'cocineros.md con cambios sin preparar'
else
  SIN_PREPARAR=$(git -C "$REPOSITORIO" diff --name-only 2>/dev/null) || SIN_PREPARAR=''
  if echo "$SIN_PREPARAR" | grep -q '^cocineros\.md$'; then
    aprobado 'cocineros.md aparece modificado y sin preparar'
  elif [ -z "$SIN_PREPARAR" ]; then
    if git -C "$REPOSITORIO" ls-files --error-unmatch cocineros.md > /dev/null 2>&1; then
      fallido 'cocineros.md modificado y sin preparar' \
        'cocineros.md con cambios sin preparar' \
        'no hay ningun cambio sin preparar, el de cocineros.md se confirmo o se deshizo'
    else
      fallido 'cocineros.md modificado y sin preparar' \
        'cocineros.md con cambios sin preparar' \
        'cocineros.md no esta bajo seguimiento, falta crearlo y confirmarlo'
    fi
  else
    fallido 'cocineros.md modificado y sin preparar' \
      'cocineros.md con cambios sin preparar' \
      "sin preparar hay: $(echo "$SIN_PREPARAR" | paste -sd ' ' -)"
  fi
fi

# --- Criterio 4 · area de preparacion vacia --------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'area de preparacion vacia' 'nada preparado'
else
  # Con historial se compara contra HEAD; sin el, contra el arbol vacio, que
  # es lo que hace `git diff --cached` cuando no hay ninguna confirmacion.
  PREPARADO=$(git -C "$REPOSITORIO" diff --cached --name-only 2>/dev/null) || PREPARADO=''
  if [ -z "$PREPARADO" ]; then
    aprobado 'el area de preparacion esta vacia'
  else
    fallido 'area de preparacion vacia' 'nada preparado' \
      "preparado y sin confirmar: $(echo "$PREPARADO" | paste -sd ' ' -)"
  fi
fi

# --- Criterio 5 · los alias s y lg -----------------------------------------

# Se pregunta desde dentro del repositorio para que valgan tanto los alias
# globales como los locales: el enunciado los pide globales, pero quien los
# haya puesto solo en este repositorio tambien hizo el ejercicio.
if [ "$HAY_REPOSITORIO" = si ]; then
  DONDE=$REPOSITORIO
else
  DONDE=$RAIZ
fi

ALIAS_S=$(git -C "$DONDE" config --get alias.s 2>/dev/null) || ALIAS_S=''
ALIAS_LG=$(git -C "$DONDE" config --get alias.lg 2>/dev/null) || ALIAS_LG=''

if [ -n "$ALIAS_S" ] && [ -n "$ALIAS_LG" ]; then
  aprobado 'los alias s y lg estan configurados'
else
  FALTANTES=''
  [ -z "$ALIAS_S" ] && FALTANTES='s'
  [ -z "$ALIAS_LG" ] && FALTANTES="${FALTANTES:+$FALTANTES y }lg"
  fallido 'los alias s y lg' \
    'alias.s y alias.lg configurados' \
    "falta configurar: $FALTANTES"
fi

# --- Resumen ---------------------------------------------------------------

TOTAL=$((APROBADOS + FALLIDOS))
echo
if [ "$FALLIDOS" -gt 0 ]; then
  echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio $LABORATORIO no esta terminado"
  echo
  exit 1
fi
echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio $LABORATORIO terminado"
echo
