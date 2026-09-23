#!/usr/bin/env bash
# Verificador del laboratorio 01 (seccion 3 del SPEC 004).
#
# Comprueba el resultado del ejercicio, no un estado inicial: los cinco
# criterios son los mismos que el enunciado lista en su seccion
# «Comprobacion». Se corre sin argumentos, desde la carpeta del laboratorio,
# y no recibe ninguna ruta: la deduce de su propia ubicacion.
#
# El repositorio del participante NO vive dentro del clon del curso, vive en
# una carpeta hermana (seccion 17 de docs/arquitectura.md). Trabajar dentro
# del clon hace que las ordenes del participante alcancen la configuracion y
# la historia del repositorio de arriba, y convierte errores que Git atrapaba
# en el acto en errores silenciosos.
#
# Escrito para Bash 3.2, el de macOS. Git Bash sobre Windows trae uno mas
# nuevo y acepta lo que funciona en el viejo, pero no al reves.

set -u

LABORATORIO='lab-01'
# `pwd -P`, la ruta fisica con los enlaces simbolicos resueltos. Ya no se
# compara contra lo que dice Git (SPEC 021), pero es la que se usa para
# ubicar el trabajo del participante.
RAIZ=$(cd "$(dirname "$0")" && pwd -P)
# Este script vive en <clon>/labs/lab-01, asi que el clon esta dos niveles mas
# arriba y el trabajo del participante es hermano del clon, no parte de el.
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-01"
REPOSITORIO="$TRABAJO/recetario"
# Como se nombra el repositorio en los mensajes: la ruta larga de la maquina
# de cada participante no le dice nada a nadie.
REPOSITORIO_DICHO='taller-git-trabajo/lab-01/recetario'

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
# con el de mas arriba. Sin esta comprobacion, olvidar el `git init` pasaba
# inadvertido y los demas criterios se median contra la historia del curso.
HAY_REPOSITORIO=no
if [ ! -d "$REPOSITORIO" ]; then
  fallido 'existe el repositorio' \
    "un repositorio Git en $REPOSITORIO_DICHO" \
    'la carpeta recetario no existe'
else
  # Se le pregunta todo a Git, sin comparar rutas: `--git-dir` responde `.git`
  # solo si la carpeta es la raiz de su propio repositorio; dentro de otro,
  # responde la ruta del .git de mas arriba. Comparar la cima con la ruta de
  # Bash fallaba en Windows, donde Bash escribe /c/Users/... y Git
  # C:/Users/... (SPEC 021).
  PROPIO=$(git -C "$REPOSITORIO" rev-parse --git-dir 2>/dev/null) || PROPIO=''
  if [ "$PROPIO" = '.git' ]; then
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

# Con repositorio se pregunta desde dentro, para que valgan tanto los alias
# globales como los locales: el enunciado los pide globales, pero quien los
# haya puesto solo en su recetario tambien hizo el ejercicio.
#
# Sin repositorio se pregunta solo por los globales, que es el unico lugar
# donde pueden estar legitimamente. Preguntar parado en una carpeta cualquiera
# hacia que Git subiera buscando un repositorio y respondiera con los alias de
# otro: el criterio salia aprobado leyendo una configuracion ajena.
if [ "$HAY_REPOSITORIO" = si ]; then
  ALIAS_S=$(git -C "$REPOSITORIO" config --get alias.s 2>/dev/null) || ALIAS_S=''
  ALIAS_LG=$(git -C "$REPOSITORIO" config --get alias.lg 2>/dev/null) || ALIAS_LG=''
else
  ALIAS_S=$(git config --global --get alias.s 2>/dev/null) || ALIAS_S=''
  ALIAS_LG=$(git config --global --get alias.lg 2>/dev/null) || ALIAS_LG=''
fi

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
