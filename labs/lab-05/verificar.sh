#!/usr/bin/env bash
# Verificador del laboratorio 05 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado son las tres
# confirmaciones de union y que no quede ninguna rama de trabajo.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-05"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-05/recetario'

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
  echo "Comprobando el escenario inicial del laboratorio 05"
else
  echo "Verificador del laboratorio 05 · fusionar y resolver"
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
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'solo queda la rama main' 'main'
  elif [ "$RAMAS" = 'main' ]; then
    aprobado 'solo queda la rama main: las cuatro de trabajo ya cumplieron'
  else
    fallido 'solo queda la rama main' 'main' \
      "$RAMAS; falta borrar con git branch -d la que ya se fusiono"
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'hay tres confirmaciones de union' '3'
  else
    UNIONES=$(g log --merges --format=%H | grep -c .) || UNIONES=0
    if [ "$UNIONES" = '3' ]; then
      aprobado 'hay tres confirmaciones de union: las dos limpias y la que choco'
    else
      fallido 'confirmaciones de union en la historia' \
        '3, una por cada fusion que no fue avance rapido' \
        "$UNIONES; el avance rapido no crea ninguna, las otras tres si"
    fi
  fi

  # El marcador olvidado dentro de un archivo es el error clasico de este
  # laboratorio, y no lo delata ninguna otra comprobacion.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'no quedan marcadores de conflicto' 'ningun <<<<<<< en los archivos'
  else
    CON_MARCADOR=$(grep -rl '<<<<<<<' "$REPOSITORIO" --exclude-dir=.git 2>/dev/null | paste -sd ' ' -)
    if [ -z "$CON_MARCADOR" ]; then
      aprobado 'no quedo ningun marcador de conflicto dentro de los archivos'
    else
      fallido 'no quedan marcadores de conflicto' 'ningun <<<<<<< en los archivos' \
        "quedaron en: $CON_MARCADOR"
    fi
  fi

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el directorio de trabajo esta limpio' 'nada que confirmar'
  else
    SUCIO=$(suciedad)
    if [ -z "$SUCIO" ]; then
      aprobado 'el directorio de trabajo esta limpio, sin fusiones a medias'
    else
      fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' "hay cambios: $SUCIO"
    fi
  fi
fi

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  ESPERADAS='andina azteca criolla main tailandesa'
  if [ "$RAMAS" = "$ESPERADAS" ]; then
    aprobado 'estan main y las cuatro ramas de trabajo'
  else
    fallido 'las ramas del escenario' "$ESPERADAS" "$RAMAS"
  fi

  if [ "$(g branch --show-current)" = 'main' ]; then
    aprobado 'el participante arranca parado en main'
  else
    fallido 'posicion de partida' 'main' "$(g branch --show-current)"
  fi

  # tailandesa contiene main entera: su fusion es un avance rapido.
  if g merge-base --is-ancestor main tailandesa; then
    aprobado 'tailandesa contiene main: su fusion sera un avance rapido'
  else
    fallido 'tailandesa se fusiona por avance rapido' \
      'que main sea antepasada de tailandesa' 'no lo es'
  fi

  # azteca, criolla y andina divergieron: sus fusiones crean union.
  for rama in azteca criolla andina; do
    if g merge-base --is-ancestor main "$rama"; then
      fallido "$rama diverge de main" 'que main no sea antepasada suya' 'lo es, avanzaria rapido'
    else
      aprobado "$rama diverge de main: su fusion creara una confirmacion de union"
    fi
  done

  # Solo andina toca la misma linea que main: es la unica que debe chocar.
  BASE=$(g merge-base main andina)
  if g diff --name-only "$BASE" main | grep -q '^platos.md$' &&
     g diff --name-only "$BASE" andina | grep -q '^platos.md$'; then
    aprobado 'main y andina tocan ambas platos.md desde su base comun: van a chocar'
  else
    fallido 'andina choca con main' 'que las dos toquen platos.md desde la base comun' 'no lo hacen'
  fi

  BASE_AZTECA=$(g merge-base main azteca)
  if g diff --name-only "$BASE_AZTECA" azteca | grep -q '^platos.md$'; then
    fallido 'azteca no choca con main' 'que azteca no toque platos.md' 'lo toca, chocaria'
  else
    aprobado 'azteca no toca platos.md: su fusion sera limpia'
  fi

  # criolla es el caso del laboratorio: **toca el mismo archivo que main y no
  # choca**. Las dos mitades hay que comprobarlas, porque un escenario donde
  # criolla no tocara platos.md seria el mismo caso que azteca y el cuarto caso
  # del enunciado se quedaria sin ejercicio.
  BASE_CRIOLLA=$(g merge-base main criolla)
  if g diff --name-only "$BASE_CRIOLLA" criolla | grep -q '^platos.md$'; then
    aprobado 'criolla toca platos.md, igual que main'
  else
    fallido 'criolla toca el mismo archivo que main' \
      'que criolla cambie platos.md desde la base comun' \
      'no lo toca; su fusion no enseñaria nada distinto de la de azteca'
  fi

  # Y que no choque se comprueba fusionando de verdad los tres textos con
  # `git merge-file`, que devuelve cero cuando no queda ningun conflicto. Es
  # una orden vieja y portatil: no hace falta Git 2.38 para `merge-tree`.
  TRES=$(mktemp -d)
  g show "$BASE_CRIOLLA:platos.md" > "$TRES/base"
  g show 'main:platos.md' > "$TRES/main"
  g show 'criolla:platos.md' > "$TRES/criolla"
  if git merge-file -p "$TRES/main" "$TRES/base" "$TRES/criolla" >/dev/null 2>&1; then
    aprobado 'criolla no choca con main: su fusion sera automatica'
  else
    fallido 'criolla se fusiona sin chocar' \
      'que los cambios de main y de criolla en platos.md no se pisen' \
      'se pisan; criolla chocaria igual que andina'
  fi
  rm -rf "$TRES"

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
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-05 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-05 terminado"
fi
echo
