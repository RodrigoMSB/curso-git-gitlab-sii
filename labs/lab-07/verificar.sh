#!/usr/bin/env bash
# Verificador del laboratorio 07 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado es la historia
# recta sin uniones, los mensajes ya reescritos, y que **ningun identificador
# de los originales sobreviva**: es el concepto que el enunciado persigue y el
# unico criterio que no se puede deducir mirando el estado.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-07"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-07/recetario'

# La rama de trabajo del escenario, que el enunciado nombra en cada paso.
RAMA_DE_TRABAJO=''

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
  echo "Verificador del laboratorio 07 · interrumpir y limpiar la historia"
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

if [ "$HAY_REPOSITORIO" = si ] && g show-ref --verify --quiet refs/heads/trabajo; then
  RAMA_DE_TRABAJO='trabajo'
fi

# --- Estado inicial ----------------------------------------------------------

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  if [ -n "$RAMA_DE_TRABAJO" ]; then
    aprobado "estan main y la rama de trabajo «${RAMA_DE_TRABAJO}»"
  else
    fallido 'las ramas del escenario' 'main y una rama de trabajo' "$RAMAS"
  fi

  if [ "$(g branch --show-current)" = "$RAMA_DE_TRABAJO" ] && [ -n "$RAMA_DE_TRABAJO" ]; then
    aprobado 'el participante arranca parado en la rama de trabajo'
  else
    fallido 'posicion de partida' \
      'la rama de trabajo, que es donde el enunciado empieza' \
      "$(g branch --show-current)"
  fi

  # Cuatro y cuatro, separadas desde la segunda: es lo que hace que el rebase
  # de la Parte 2 tenga sobre que reordenarse.
  EN_MAIN=$(g log --oneline main | grep -c .) || EN_MAIN=0
  if [ "$EN_MAIN" = '4' ]; then
    aprobado 'main tiene cuatro confirmaciones'
  else
    fallido 'confirmaciones en main' '4' "$EN_MAIN"
  fi

  PROPIAS=$(g log --oneline "main..$RAMA_DE_TRABAJO" | grep -c .) || PROPIAS=0
  if [ "$PROPIAS" = '4' ]; then
    aprobado 'la rama de trabajo tiene cuatro confirmaciones propias'
  else
    fallido 'confirmaciones propias de la rama de trabajo' '4' "$PROPIAS"
  fi

  AVANZO=$(g log --oneline "$RAMA_DE_TRABAJO..main" | grep -c .) || AVANZO=0
  if [ "$AVANZO" = '2' ]; then
    aprobado 'main avanzo dos confirmaciones por su cuenta: el rebase tiene sentido'
  else
    fallido 'lo que main avanzo por su cuenta' \
      '2, que es lo que da sentido al rebase de la parte 2' "$AVANZO"
  fi

  # Los mensajes pobres son el material de la parte 3. Un escenario con
  # mensajes decentes le quitaria el ejercicio.
  MENSAJES=$(g log --format=%s "main..$RAMA_DE_TRABAJO" | sort | paste -sd ' ' -)
  if [ "$MENSAJES" = 'arreglos cambios mas cambios wip' ]; then
    aprobado 'los mensajes de la rama son pobres a proposito: wip, cambios, mas cambios, arreglos'
  else
    fallido 'los mensajes de la rama de trabajo' \
      'wip, cambios, mas cambios y arreglos, que son los que la parte 3 reescribe' \
      "$MENSAJES"
  fi

  # La receta a medio reescribir. **En seguimiento y modificada**, no sin
  # seguimiento: `git stash` sin `-u` no toca lo que nunca entro, y con la
  # receta fuera del seguimiento la parte 1 entera se queda sin materia.
  # La primera columna es un espacio porque el cambio no esta preparado: es la
  # leccion de la seccion 27, y por eso `suciedad` no lo recorta.
  if [ "$(suciedad)" = ' M recetas/curry-massaman.md' ]; then
    aprobado 'hay una receta versionada y reescrita a medias, que git stash si se lleva'
  else
    fallido 'el trabajo a medias del directorio' \
      'recetas/curry-massaman.md modificada y en seguimiento' "$(suciedad)"
  fi

  # El guardado temporal parte vacio: crear la primera entrada es el ejercicio.
  GUARDADAS=$(g stash list | grep -c .) || GUARDADAS=0
  if [ "$GUARDADAS" = '0' ]; then
    aprobado 'el guardado temporal parte vacio'
  else
    fallido 'entradas en el guardado temporal' '0' "$GUARDADAS"
  fi
fi

# --- Estado final ------------------------------------------------------------

if [ "$MODO" = final ]; then
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el guardado temporal quedo vacio' '0 entradas'
  else
    GUARDADAS=$(g stash list | grep -c .) || GUARDADAS=0
    if [ "$GUARDADAS" = '0' ]; then
      aprobado 'el guardado temporal quedo vacio'
    else
      fallido 'entradas en el guardado temporal' '0, la pila se vacia en el punto 1.11' \
        "$GUARDADAS; revisa git stash list"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ] || [ -z "$RAMA_DE_TRABAJO" ]; then
    sin_repositorio 'la rama de trabajo quedo con dos confirmaciones' '2'
  else
    PROPIAS=$(g log --oneline "main..$RAMA_DE_TRABAJO" | grep -c .) || PROPIAS=0
    if [ "$PROPIAS" = '2' ]; then
      aprobado 'la rama de trabajo quedo con dos confirmaciones: el squash junto las cuatro'
    else
      fallido 'confirmaciones propias de la rama de trabajo' \
        '2, que es lo que deja el rebase interactivo del punto 3.4' \
        "$PROPIAS; falta juntar o sobra alguna"
    fi
  fi

  # La historia recta es lo que distingue el rebase de la fusion.
  if [ "$HAY_REPOSITORIO" = no ] || [ -z "$RAMA_DE_TRABAJO" ]; then
    sin_repositorio 'la historia quedo recta, sin uniones' '0 confirmaciones de union'
  else
    UNIONES=$(g log --merges --format=%H "$RAMA_DE_TRABAJO" | grep -c .) || UNIONES=0
    if [ "$UNIONES" = '0' ]; then
      aprobado 'la historia quedo recta: el rebase no crea confirmaciones de union'
    else
      fallido 'confirmaciones de union en la rama' \
        '0; el rebase reordena en linea recta, no fusiona' \
        "$UNIONES; parece que se fusiono en vez de reordenar"
    fi
  fi

  # main tiene que estar contenida en la rama: es lo que prueba que el rebase
  # movio la base y no que simplemente se confirmo encima.
  if [ "$HAY_REPOSITORIO" = no ] || [ -z "$RAMA_DE_TRABAJO" ]; then
    sin_repositorio 'la rama de trabajo cuelga de la punta de main' 'que main sea antepasada suya'
  elif g merge-base --is-ancestor main "$RAMA_DE_TRABAJO"; then
    aprobado 'la rama de trabajo cuelga de la punta de main: el rebase movio la base'
  else
    fallido 'la rama de trabajo cuelga de la punta de main' \
      'que main sea antepasada de la rama' \
      'no lo es; el rebase no se completo'
  fi

  # Los mensajes ya no pueden ser los pobres del escenario.
  if [ "$HAY_REPOSITORIO" = no ] || [ -z "$RAMA_DE_TRABAJO" ]; then
    sin_repositorio 'los mensajes ya no son los del escenario' 'ninguno de los cuatro originales'
  else
    POBRES=$(g log --format=%s "main..$RAMA_DE_TRABAJO" |
      grep -c -x -e 'wip' -e 'cambios' -e 'mas cambios' -e 'arreglos') || POBRES=0
    if [ "$POBRES" = '0' ]; then
      aprobado 'no quedo ningun mensaje de los pobres: la parte 3 los reescribio'
    else
      fallido 'los mensajes de la rama de trabajo' \
        'ninguno de wip, cambios, mas cambios ni arreglos' \
        "$POBRES siguen ahi; el rebase interactivo no los toco"
    fi
  fi

  # El concepto que el enunciado persigue, y el unico que no se deduce del
  # estado final: **el rebase copia, no mueve**. Las originales no se movieron a
  # ninguna parte, quedaron donde estaban y sin nadie apuntandolas.
  #
  # Se comprueba por el rastro, como pide la regla 8: en la bitacora de la rama
  # tienen que quedar confirmaciones con los mensajes pobres que **ya no son
  # alcanzables** desde la rama. Si el participante hubiera fusionado en vez de
  # reordenar, o no hubiera llegado a la parte 3, no habria ninguna.
  if [ "$HAY_REPOSITORIO" = no ] || [ -z "$RAMA_DE_TRABAJO" ]; then
    sin_repositorio 'las originales quedaron huerfanas en la bitacora' 'al menos cuatro'
  else
    HUERFANAS=0
    for id in $(g reflog show "$RAMA_DE_TRABAJO" --format=%H | sort -u); do
      if g merge-base --is-ancestor "$id" "$RAMA_DE_TRABAJO"; then
        continue
      fi
      case $(g log -1 --format=%s "$id") in
        wip|cambios|'mas cambios'|arreglos) HUERFANAS=$((HUERFANAS + 1)) ;;
      esac
    done
    if [ "$HUERFANAS" -ge 4 ]; then
      aprobado "las originales quedaron huerfanas en la bitacora: $HUERFANAS, el rebase copio y no movio"
    else
      fallido 'las originales quedaron huerfanas en la bitacora' \
        'al menos cuatro confirmaciones con los mensajes pobres, ya sin nadie apuntandolas' \
        "$HUERFANAS; revisa git reflog $RAMA_DE_TRABAJO"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el directorio de trabajo esta limpio' 'nada que confirmar'
  else
    SUCIO=$(suciedad)
    if [ -z "$SUCIO" ]; then
      aprobado 'el directorio de trabajo esta limpio, sin rebases a medias'
    else
      fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' "hay cambios: $SUCIO"
    fi
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
