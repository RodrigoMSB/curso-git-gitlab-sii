#!/usr/bin/env bash
# Verificador del laboratorio 01 (seccion 3 del SPEC 004).
#
# Comprueba el resultado del ejercicio, no un estado inicial: los nueve
# criterios miden el nucleo del enunciado (SPEC 031, 3.8), la configuracion,
# un archivo por confirmacion con su mensaje, la carpeta recetas y el atajo
# -am. La seccion opcional del final no se mide. Se corre sin argumentos, desde la carpeta del laboratorio,
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
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-01"
REPOSITORIO="$TRABAJO/recetario"
# Como se nombra el repositorio en los mensajes: la ruta larga de la maquina
# de cada participante no le dice nada a nadie.
REPOSITORIO_DICHO='lab-01/recetario'

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

# Los criterios que siguen leen el repositorio. Sin el no se pueden evaluar,
# pero igual se imprime una linea por cada uno: el participante tiene que ver
# todos los criterios y no una lista que se corta a la primera falla.
sin_repositorio() {
  fallido "$1" "$2" 'no se pudo comprobar, no hay repositorio'
}

# Desde el SPEC 031 el verificador mide el nucleo del enunciado y nada de la
# seccion «Para ir mas alla», que es opcional. Quien la hizo tiene una
# confirmacion mas y cocineros.md a medias, y el verificador igual aprueba.

# El asunto de una confirmacion, o nada si no existe.
asunto() {
  git -C "$REPOSITORIO" log -1 --format=%s "$1" 2>/dev/null
}

# La confirmacion que agrego un archivo, la mas antigua si hay varias.
la_que_agrego() {
  git -C "$REPOSITORIO" log --diff-filter=A --format=%H -- "$1" 2>/dev/null | tail -1
}

# --- Criterio 2 · seis confirmaciones --------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'cantidad de confirmaciones' '6'
else
  CONFIRMACIONES=$(git -C "$REPOSITORIO" rev-list --count HEAD 2>/dev/null) ||
    CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" -ge 6 ] 2>/dev/null; then
    aprobado "hay $CONFIRMACIONES confirmaciones en el historial"
  elif [ "$CONFIRMACIONES" = '0' ]; then
    fallido 'cantidad de confirmaciones' '6' \
      'ninguna, el repositorio no tiene historial todavia'
  else
    fallido 'cantidad de confirmaciones' '6' "$CONFIRMACIONES"
  fi
fi

# --- Criterio 3 · un archivo por confirmacion ------------------------------

# README.md, platos.md, ingredientes.md y cocineros.md entran cada uno en su
# propia confirmacion, y el mensaje empieza con el nombre del archivo. El de
# platos.md se escribe en el editor: si Git no lo abrio o el participante no
# escribio nada, aqui se nota.
if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'un archivo por confirmacion' 'cada archivo en su confirmacion, con su nombre en el mensaje'
else
  PROBLEMA=''
  for ARCHIVO in README.md platos.md ingredientes.md cocineros.md; do
    CUAL=$(la_que_agrego "$ARCHIVO")
    if [ -z "$CUAL" ]; then
      PROBLEMA="$ARCHIVO no esta en ninguna confirmacion"
      break
    fi
    OTROS=$(git -C "$REPOSITORIO" show --name-only --format= "$CUAL" 2>/dev/null | grep -v "^$ARCHIVO\$" | paste -sd ' ' -)
    if [ -n "$OTROS" ]; then
      PROBLEMA="$ARCHIVO se confirmo junto con $OTROS"
      break
    fi
    MENSAJE=$(asunto "$CUAL")
    case "$MENSAJE" in
      "$ARCHIVO: "*) ;;
      *)
        PROBLEMA="la confirmacion de $ARCHIVO dice «${MENSAJE}»"
        break
        ;;
    esac
  done
  if [ -z "$PROBLEMA" ]; then
    aprobado 'un archivo por confirmacion, cada una con su nombre en el mensaje'
  else
    fallido 'un archivo por confirmacion' \
      'cada archivo en su confirmacion, con un mensaje que empiece con su nombre' \
      "$PROBLEMA"
  fi
fi

# --- Criterio 4 · la carpeta recetas ---------------------------------------

MENSAJE_CARPETA='CARPETA recetas: se agrega carpeta'
if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'la carpeta recetas' "las dos recetas en una confirmacion «${MENSAJE_CARPETA}»"
else
  CUAL=$(la_que_agrego recetas/pastel-de-choclo.md)
  OTRA=$(la_que_agrego recetas/empanadas.md)
  if [ -z "$CUAL" ] || [ -z "$OTRA" ]; then
    fallido 'la carpeta recetas' "las dos recetas en una confirmacion «${MENSAJE_CARPETA}»" \
      'falta confirmar alguna de las dos recetas'
  elif [ "$CUAL" != "$OTRA" ]; then
    fallido 'la carpeta recetas' "las dos recetas en una confirmacion «${MENSAJE_CARPETA}»" \
      'las recetas se confirmaron por separado'
  elif [ "$(asunto "$CUAL")" != "$MENSAJE_CARPETA" ]; then
    fallido 'la carpeta recetas' "el mensaje «${MENSAJE_CARPETA}»" "«$(asunto "$CUAL")»"
  else
    aprobado "la carpeta recetas entro entera, con «${MENSAJE_CARPETA}»"
  fi
fi

# --- Criterio 5 · las sopaipillas, con el atajo -----------------------------

MENSAJE_ATAJO='platos.md: se agregan sopaipillas'
if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'las sopaipillas' "una confirmacion «${MENSAJE_ATAJO}»"
else
  CUAL=$(git -C "$REPOSITORIO" log --format='%H %s' 2>/dev/null | grep -F " $MENSAJE_ATAJO" | tail -1 | cut -d' ' -f1)
  if [ -z "$CUAL" ]; then
    fallido 'las sopaipillas' "una confirmacion «${MENSAJE_ATAJO}»" 'ninguna confirmacion con ese mensaje'
  elif ! git -C "$REPOSITORIO" show "$CUAL:platos.md" 2>/dev/null | grep -q -- '- sopaipillas'; then
    fallido 'las sopaipillas' 'platos.md con la linea - sopaipillas en esa confirmacion' \
      'la confirmacion existe pero platos.md no trae sopaipillas'
  else
    aprobado "las sopaipillas se confirmaron con «${MENSAJE_ATAJO}»"
  fi
fi

# --- Criterio 6 · area de preparacion vacia --------------------------------

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

# --- Criterio 7 · los alias s y lg -----------------------------------------

# Con repositorio se pregunta desde dentro, para que valgan tanto los alias
# globales como los locales: el enunciado los pide globales, pero quien los
# haya puesto solo en su recetario tambien hizo el ejercicio.
#
# Sin repositorio se pregunta solo por los globales, que es el unico lugar
# donde pueden estar legitimamente. Preguntar parado en una carpeta cualquiera
# hacia que Git subiera buscando un repositorio y respondiera con los alias de
# otro: el criterio salia aprobado leyendo una configuracion ajena.
leer_config() {
  if [ "$HAY_REPOSITORIO" = si ]; then
    git -C "$REPOSITORIO" config --get "$1" 2>/dev/null
  else
    git config --global --get "$1" 2>/dev/null
  fi
}
ALIAS_S=$(leer_config alias.s) || ALIAS_S=''
ALIAS_LG=$(leer_config alias.lg) || ALIAS_LG=''

if [ -z "$ALIAS_S" ] || [ -z "$ALIAS_LG" ]; then
  FALTANTES=''
  [ -z "$ALIAS_S" ] && FALTANTES='s'
  [ -z "$ALIAS_LG" ] && FALTANTES="${FALTANTES:+$FALTANTES y }lg"
  fallido 'los alias s y lg' \
    'alias.s y alias.lg configurados' \
    "falta configurar: $FALTANTES"
else
  # El lg del SPEC 031 muestra el autor y la fecha relativa. El de antes, sin
  # ellos, no es el que el enunciado pide copiar y pegar.
  case "$ALIAS_S" in
    'status --short' | 'status -s') S_BIEN=si ;;
    *) S_BIEN=no ;;
  esac
  case "$ALIAS_LG" in
    *%an*%ar* | *%ar*%an*) LG_BIEN=si ;;
    *) LG_BIEN=no ;;
  esac
  if [ "$S_BIEN" = no ]; then
    fallido 'los alias s y lg' 'alias.s con status --short' "alias.s es «${ALIAS_S}»"
  elif [ "$LG_BIEN" = no ]; then
    fallido 'los alias s y lg' 'el alias lg del enunciado, con el autor %an y la fecha %ar, copiado y pegado' \
      "alias.lg es «${ALIAS_LG}»"
  else
    aprobado 'los alias s y lg estan configurados'
  fi
fi

# --- Criterio 8 · el editor ------------------------------------------------

EDITOR_GIT=$(leer_config core.editor) || EDITOR_GIT=''
case "$EDITOR_GIT" in
  code*--wait*) aprobado 'el editor de Git es Visual Studio Code' ;;
  '') fallido 'el editor' 'core.editor en code --wait' 'no hay editor configurado' ;;
  *) fallido 'el editor' 'core.editor en code --wait' "«${EDITOR_GIT}»" ;;
esac

# --- Criterio 9 · la rama se llama main ------------------------------------

# El enunciado configura init.defaultBranch en main (SPEC 027, punto 5.4): asi
# la rama principal se llama igual en todos los equipos, y los laboratorios
# que vienen la nombran asi.
if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'la rama se llama main' 'main'
else
  RAMA=$(git -C "$REPOSITORIO" symbolic-ref --short -q HEAD 2>/dev/null) || RAMA=''
  if [ "$RAMA" = main ]; then
    aprobado 'la rama se llama main'
  else
    fallido 'la rama se llama main' 'main' "${RAMA:-una posicion desconectada}"
  fi
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
