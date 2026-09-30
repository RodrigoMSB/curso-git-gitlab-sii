#!/usr/bin/env bash
# Verificador del laboratorio 02 (seccion 6 del SPEC 005).
#
# Sin argumentos comprueba el ESTADO FINAL, o sea si el participante hizo el
# laboratorio. Sus criterios son los de la seccion «Comprobacion» del
# enunciado.
#
# Con `--escenario` comprueba el ESTADO INICIAL, o sea si la preparacion dejo
# el escenario como corresponde. Ese modo lo usa preparar.sh y no el
# participante.
#
# Los dos modos hacen falta y no son el mismo: en el estado inicial tambien hay
# cinco confirmaciones. Lo que separa un laboratorio hecho de uno sin empezar
# es el mensaje corregido y el area de preparacion vacia, no la cantidad.
#
# Sigue las reglas de la seccion 15 de docs/arquitectura.md. En particular la
# regla 1: se comprueba que la carpeta sea la raiz de su propio repositorio.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-02"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-02/recetario'

# El mensaje mal escrito que la preparacion planta y que el participante tiene
# que corregir. Si sigue en la historia, el laboratorio no esta hecho.
MENSAJE_MALO='se docuemnta la reseta del pastel de choclo'
MENSAJE_BUENO='recetas/pastel-de-choclo.md: se documenta la receta'

MODO=final
if [ "${1:-}" = '--escenario' ]; then
  MODO=escenario
elif [ $# -gt 0 ]; then
  echo "verificar.sh: opcion desconocida «$1»" >&2
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
  echo "Comprobando el escenario inicial del laboratorio 02"
else
  echo "Verificador del laboratorio 02 · leer la historia y deshacer"
fi
echo

# --- Existe el repositorio ---------------------------------------------------

# Regla 1 de la seccion 15. El trabajo vive fuera del clon, pero si alguna vez
# volviera a quedar bajo un repositorio, Git subiria hasta el de mas arriba y
# todos los criterios se medirian contra una historia ajena.
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

# --- Criterio · cinco confirmaciones -----------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'cantidad de confirmaciones' '5'
else
  CONFIRMACIONES=$(g rev-list --count HEAD) || CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" = '5' ]; then
    aprobado 'hay cinco confirmaciones en el historial'
  elif [ "$CONFIRMACIONES" = '0' ]; then
    fallido 'cantidad de confirmaciones' '5' 'ninguna, el repositorio no tiene historial'
  else
    fallido 'cantidad de confirmaciones' '5' "$CONFIRMACIONES"
  fi
fi

# --- Criterio · el mensaje mal escrito -------------------------------------

# En el escenario inicial tiene que estar; en el final, no. Es el criterio que
# distingue un laboratorio hecho de uno recien preparado.
if [ "$HAY_REPOSITORIO" = no ]; then
  if [ "$MODO" = escenario ]; then
    sin_repositorio 'la quinta confirmacion va mal escrita' "«${MENSAJE_MALO}»"
  else
    sin_repositorio 'el mensaje mal escrito ya no esta en la historia' \
      "ninguna confirmacion con «${MENSAJE_MALO}»"
  fi
else
  CUANTAS_MALAS=$(g log --format=%s | grep -c -F -x "$MENSAJE_MALO") || CUANTAS_MALAS=0
  if [ "$MODO" = escenario ]; then
    ULTIMO=$(g log -1 --format=%s) || ULTIMO=''
    if [ "$ULTIMO" = "$MENSAJE_MALO" ]; then
      aprobado 'la quinta confirmacion lleva el mensaje mal escrito'
    else
      fallido 'la quinta confirmacion va mal escrita' "«${MENSAJE_MALO}»" "«${ULTIMO}»"
    fi
  else
    if [ "$CUANTAS_MALAS" = '0' ]; then
      aprobado 'el mensaje mal escrito ya no esta en la historia'
    else
      fallido 'el mensaje mal escrito ya no esta en la historia' \
        "ninguna confirmacion con «${MENSAJE_MALO}»" \
        "todavia hay $CUANTAS_MALAS, falta corregirla con --amend"
    fi
  fi
fi

# --- Criterio · el mensaje corregido, con la convencion del taller ------------

# SPEC 031: el nucleo corrige el mensaje con --amend y despues lo rehace con
# reset --soft y commit, siempre con el mismo mensaje, archivo: descripcion.
if [ "$MODO" != escenario ]; then
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'la ultima confirmacion lleva el mensaje corregido' "«${MENSAJE_BUENO}»"
  else
    ULTIMO=$(g log -1 --format=%s) || ULTIMO=''
    if [ "$ULTIMO" = "$MENSAJE_BUENO" ]; then
      aprobado 'la ultima confirmacion lleva el mensaje corregido, archivo: descripcion'
    else
      fallido 'la ultima confirmacion lleva el mensaje corregido' "«${MENSAJE_BUENO}»" "«${ULTIMO}»"
    fi
  fi
fi

# --- Criterio · el area de preparacion ---------------------------------------

# En el escenario inicial hay un archivo preparado por error; en el final no
# tiene que quedar nada.
if [ "$HAY_REPOSITORIO" = no ]; then
  if [ "$MODO" = escenario ]; then
    sin_repositorio 'cocineros.md preparado por error' 'cocineros.md preparado'
  else
    sin_repositorio 'area de preparacion vacia' 'nada preparado'
  fi
else
  PREPARADO=$(g diff --cached --name-only | sort | paste -sd ' ' -) || PREPARADO=''
  if [ "$MODO" = escenario ]; then
    if [ "$PREPARADO" = 'cocineros.md' ]; then
      aprobado 'cocineros.md quedo preparado por error, como pide el escenario'
    else
      fallido 'cocineros.md preparado por error' 'cocineros.md' \
        "${PREPARADO:-nada preparado}"
    fi
  else
    if [ -z "$PREPARADO" ]; then
      aprobado 'el area de preparacion esta vacia'
    else
      fallido 'area de preparacion vacia' 'nada preparado' \
        "preparado y sin confirmar: $PREPARADO"
    fi
  fi
fi

# --- Criterio · cocineros.md modificado --------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'cocineros.md modificado y sin preparar' \
    'cocineros.md con cambios sin preparar'
else
  SIN_PREPARAR=$(g diff --name-only) || SIN_PREPARAR=''
  if [ "$MODO" = escenario ]; then
    # En el escenario inicial el que esta modificado sin preparar es
    # ingredientes.md, con el cambio que el participante va a descartar.
    if [ "$SIN_PREPARAR" = 'ingredientes.md' ]; then
      aprobado 'ingredientes.md quedo modificado sin preparar, con el cambio que sobra'
    else
      fallido 'ingredientes.md modificado y sin preparar' 'ingredientes.md' \
        "${SIN_PREPARAR:-nada sin preparar}"
    fi
  else
    if echo "$SIN_PREPARAR" | grep -q '^cocineros\.md$'; then
      aprobado 'cocineros.md aparece modificado y sin preparar'
    elif [ -z "$SIN_PREPARAR" ]; then
      fallido 'cocineros.md modificado y sin preparar' \
        'cocineros.md con cambios sin preparar' \
        'no hay ningun cambio sin preparar; el de cocineros.md se confirmo o se descarto'
    else
      fallido 'cocineros.md modificado y sin preparar' \
        'cocineros.md con cambios sin preparar' \
        "sin preparar hay: $(echo "$SIN_PREPARAR" | paste -sd ' ' -)"
    fi
  fi
fi

# --- Criterio · solo queda la rama main --------------------------------------

# La parte 4 hace crear la rama `prueba`, cambiarse a ella y borrarla. Si quedo
# viva, el laboratorio no esta terminado.
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

# --- Criterio · HEAD apunta a main -------------------------------------------

if [ "$HAY_REPOSITORIO" = no ]; then
  sin_repositorio 'HEAD apunta a main' 'refs/heads/main'
else
  CABEZA=$(g symbolic-ref HEAD) || CABEZA=''
  if [ "$CABEZA" = 'refs/heads/main' ]; then
    aprobado 'HEAD apunta a main'
  elif [ -z "$CABEZA" ]; then
    fallido 'HEAD apunta a main' 'refs/heads/main' \
      'HEAD no apunta a ninguna rama; quedaste desconectado, vuelve con git switch main'
  else
    fallido 'HEAD apunta a main' 'refs/heads/main' "$CABEZA"
  fi
fi

# --- Comprobaciones que solo tienen sentido sobre el escenario inicial -------

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  AUTORES=$(g log --format=%an | sort -u | paste -sd '|' - | sed 's/|/, /g')
  CUANTOS=$(g log --format=%an | sort -u | grep -c .)
  if [ "$CUANTOS" = '3' ]; then
    aprobado "hay tres autores distintos: $AUTORES"
  else
    fallido 'autores distintos en la historia' '3' "$CUANTOS ($AUTORES)"
  fi

  if g log --format=%an | grep -q '^Juana Perez$'; then
    aprobado 'Juana Perez firma alguna confirmacion, que es por quien filtra el enunciado'
  else
    fallido 'Juana Perez en la historia' 'al menos una confirmacion suya' 'ninguna'
  fi

  MESES=$(g log --format=%ad --date=format:%Y-%m | sort -u | grep -c .)
  ANOS=$(g log --format=%ad --date=format:%Y | sort -u | paste -sd ' ' -)
  if [ "$MESES" -ge 3 ] && [ "$ANOS" = '2024' ]; then
    aprobado "las fechas se reparten en $MESES meses distintos de 2024"
  else
    fallido 'fechas repartidas en varios meses de 2024' \
      'al menos 3 meses distintos, todos de 2024' "$MESES mes(es), año(s): $ANOS"
  fi

  FUSIONES=$(g log --merges --format=%H | grep -c .) || FUSIONES=0
  if [ "$FUSIONES" = '0' ]; then
    aprobado 'la historia es lineal, sin confirmaciones de union'
  else
    fallido 'historia lineal' 'ninguna confirmacion de union' "$FUSIONES"
  fi

  FALTANTES=''
  for archivo in README.md platos.md ingredientes.md cocineros.md recetas; do
    [ -e "$REPOSITORIO/$archivo" ] || FALTANTES="${FALTANTES:+$FALTANTES }$archivo"
  done
  if [ -z "$FALTANTES" ]; then
    aprobado 'estan los archivos del recetario y la carpeta recetas'
  else
    fallido 'archivos del recetario' \
      'README.md platos.md ingredientes.md cocineros.md recetas' \
      "faltan: $FALTANTES"
  fi

fi

# --- Resumen -----------------------------------------------------------------

TOTAL=$((APROBADOS + FALLIDOS))
echo
if [ "$FALLIDOS" -gt 0 ]; then
  if [ "$MODO" = escenario ]; then
    echo "  $APROBADOS de $TOTAL · el escenario NO quedo como corresponde"
  else
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-02 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-02 terminado"
fi
echo
