#!/usr/bin/env bash
# Verificador del laboratorio 03 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL. Con `--escenario` comprueba el
# ESTADO INICIAL, que es lo que usa preparar.sh.
#
# El laboratorio 03 es de mirar, no de tocar: el participante abre la carpeta
# .git y lee lo que hay. Por eso el estado final se parece muchisimo al
# inicial, y contar confirmaciones o mirar si el directorio esta limpio no
# distingue a quien hizo el laboratorio de quien no lo abrio nunca.
#
# Lo que si distingue es la parte 4, donde el participante crea la rama
# `prueba`, se cambia a ella, vuelve y la borra. Eso no deja nada en el
# directorio de trabajo, pero deja huella en el registro de referencias, que es
# justamente una de las cosas que el laboratorio enseña a mirar.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-03"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-03/recetario'

RAMA_DE_PRUEBA='prueba'

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

echo
if [ "$MODO" = escenario ]; then
  echo "Comprobando el escenario inicial del laboratorio 03"
else
  echo "Verificador del laboratorio 03 · abrir la caja"
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

# --- Criterio · HEAD apunta a main -------------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'HEAD apunta a main' 'ref: refs/heads/main'
else
  CABEZA=$(g symbolic-ref HEAD) || CABEZA=''
  if [ "$CABEZA" = 'refs/heads/main' ]; then
    aprobado 'HEAD apunta a main'
  elif [ -z "$CABEZA" ]; then
    fallido 'HEAD apunta a main' 'refs/heads/main' \
      'HEAD no apunta a ninguna rama, quedaste en estado desconectado; vuelve con git switch main'
  else
    fallido 'HEAD apunta a main' 'refs/heads/main' "$CABEZA"
  fi
fi

# --- Criterio · solo la rama main --------------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'solo existe la rama main' 'main'
else
  RAMAS=$(g for-each-ref --format='%(refname:short)' refs/heads | sort | paste -sd ' ' -)
  if [ "$RAMAS" = 'main' ]; then
    aprobado 'solo existe la rama main'
  else
    fallido 'solo existe la rama main' 'main' \
      "${RAMAS:-ninguna}; falta borrar la rama de prueba con git branch -d"
  fi
fi

# --- Criterio · el directorio de trabajo esta limpio -------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'el directorio de trabajo esta limpio' 'nada que confirmar'
else
  SUCIEDAD=$(g status --porcelain | sort | paste -sd ' ' -)
  if [ -z "$SUCIEDAD" ]; then
    aprobado 'el directorio de trabajo esta limpio, no se toco el proyecto'
  else
    fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' \
      "hay cambios: $SUCIEDAD"
  fi
fi

if [ "$MODO" = final ]; then
  # --- Criterio · la parte 4 se hizo -----------------------------------------
  #
  # Sin esto el verificador aprobaria un laboratorio que nadie abrio: el estado
  # final de un laboratorio de solo mirar es igual al inicial. La huella de la
  # parte 4 esta en el registro de referencias, que sobrevive al borrado de la
  # rama porque el registro de HEAD es aparte.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio "el registro de referencias muestra el paso por la rama $RAMA_DE_PRUEBA" \
      "haber creado la rama $RAMA_DE_PRUEBA y haberte cambiado a ella"
  else
    PASOS=$(g reflog --format='%gs' | grep -c "to $RAMA_DE_PRUEBA\$") || PASOS=0
    if [ "$PASOS" -ge 1 ]; then
      aprobado "el registro de referencias muestra el paso por la rama $RAMA_DE_PRUEBA"
    else
      fallido "el registro de referencias muestra el paso por la rama $RAMA_DE_PRUEBA" \
        "haber creado la rama $RAMA_DE_PRUEBA y haberte cambiado a ella, como pide la parte 4" \
        'no hay rastro de ese cambio de rama; falta hacer la parte 4'
    fi
  fi
fi

# --- Comprobaciones que solo tienen sentido sobre el escenario inicial -------

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  CONFIRMACIONES=$(g rev-list --count HEAD) || CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" = '4' ]; then
    aprobado 'hay cuatro confirmaciones en el historial'
  else
    fallido 'cantidad de confirmaciones' '4' "$CONFIRMACIONES"
  fi

  FUSIONES=$(g log --merges --format=%H | grep -c .) || FUSIONES=0
  if [ "$FUSIONES" = '0' ]; then
    aprobado 'la historia es lineal, sin confirmaciones de union'
  else
    fallido 'historia lineal' 'ninguna confirmacion de union' "$FUSIONES"
  fi

  # Lo que sostiene la parte 2.2 entera. Con el formato `reftable`, que Git
  # 2.45 trajo como alternativa, este archivo no existe y el enunciado se queda
  # sin nada que leer ni que medir.
  REFERENCIA="$REPOSITORIO/.git/refs/heads/main"
  if [ ! -f "$REFERENCIA" ]; then
    fallido 'la rama main es un archivo suelto' \
      '.git/refs/heads/main, un archivo de texto' \
      'no existe; el repositorio no usa el formato de referencias «files»'
  else
    BYTES=$(wc -c < "$REFERENCIA" | tr -d ' ')
    if [ "$BYTES" = '41' ]; then
      aprobado 'la rama main es un archivo suelto de 41 bytes, como dice el enunciado'
    else
      fallido 'la rama main mide 41 bytes' '41' "$BYTES"
    fi
  fi

  # La parte 3.5 entra a una carpeta, asi que el arbol de la raiz tiene que
  # tener un arbol adentro.
  if g cat-file -p 'HEAD^{tree}' | grep -q '	recetas$'; then
    aprobado 'el arbol de la raiz tiene la carpeta recetas como arbol'
  else
    fallido 'la carpeta recetas esta en el arbol de la raiz' \
      'una linea de tipo tree llamada recetas' 'no esta'
  fi

  # La parte 3 recorre objetos sueltos. Si algo los empaquetara, `cat-file`
  # seguiria funcionando, pero .git/objects dejaria de tener nada que mirar.
  SUELTOS=$(g count-objects | awk '{print $1}')
  if [ "$SUELTOS" -ge 10 ]; then
    aprobado "hay $SUELTOS objetos sueltos que mirar en .git/objects"
  else
    fallido 'objetos sueltos en .git/objects' 'al menos 10' "$SUELTOS"
  fi

  # La parte 1.2 lee .git/config, y sin configuracion local no hay nada ahi.
  if [ -f "$REPOSITORIO/.git/config" ] && g config --local --get user.name > /dev/null; then
    aprobado 'el .git/config local trae configuracion que mirar'
  else
    fallido 'configuracion local en .git/config' \
      'al menos user.name puesto en el repositorio' 'no hay'
  fi

  # La parte 3.7 sigue los padres hasta una confirmacion sin padre.
  RAICES=$(g rev-list --max-parents=0 HEAD | grep -c .) || RAICES=0
  if [ "$RAICES" = '1' ]; then
    aprobado 'la cadena de padres llega a una unica confirmacion sin padre'
  else
    fallido 'confirmaciones sin padre' '1' "$RAICES"
  fi
fi

# --- Resumen -----------------------------------------------------------------

TOTAL=$((APROBADOS + FALLIDOS))
echo
if [ "$FALLIDOS" -gt 0 ]; then
  if [ "$MODO" = escenario ]; then
    echo "  $APROBADOS de $TOTAL · el escenario NO quedo como corresponde"
  else
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-03 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-03 terminado"
fi
echo
