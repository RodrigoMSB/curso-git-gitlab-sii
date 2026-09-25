#!/usr/bin/env bash
# Verificador del laboratorio 03 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado es que los tres
# archivos que sobran hayan salido del seguimiento y que exista el archivo de
# exclusiones. Contar confirmaciones no bastaria: el participante agrega tres.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-03"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-03/recetario'

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
  echo "Comprobando el escenario inicial del laboratorio 03"
else
  echo "Verificador del laboratorio 03 · ordenar el recetario"
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

SEGUIDOS=$(g ls-files | paste -sd ' ' -)

if [ "$MODO" = final ]; then
  # --- Criterio · los tres archivos salieron del seguimiento ----------------
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'los archivos que sobran salieron del seguimiento' \
      'ni notas.tmp, ni respaldo.bak, ni credenciales.txt bajo seguimiento'
  else
    COLADOS=''
    for archivo in notas.tmp respaldo.bak credenciales.txt; do
      case " $SEGUIDOS " in
        *" $archivo "*) COLADOS="${COLADOS:+$COLADOS }$archivo" ;;
      esac
    done
    if [ -z "$COLADOS" ]; then
      aprobado 'notas.tmp, respaldo.bak y credenciales.txt ya no estan bajo seguimiento'
    else
      fallido 'los archivos que sobran salieron del seguimiento' \
        'ninguno de los tres bajo seguimiento' \
        "siguen seguidos: $COLADOS; el archivo de exclusiones no basta, hace falta git rm --cached"
    fi
  fi

  # --- Criterio · el archivo de exclusiones esta confirmado -----------------
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el archivo de exclusiones esta confirmado' '.gitignore bajo seguimiento'
  else
    case " $SEGUIDOS " in
      *" .gitignore "*) aprobado 'el archivo de exclusiones esta confirmado' ;;
      *)
        fallido 'el archivo de exclusiones esta confirmado' '.gitignore bajo seguimiento' \
          'no esta; va dentro del repositorio para que el equipo comparta las reglas'
        ;;
    esac
  fi

  # --- Criterio · lo que queda en el disco ----------------------------------
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'notas.tmp y respaldo.bak siguen en la carpeta' 'los dos presentes'
  else
    FALTAN=''
    for archivo in notas.tmp respaldo.bak; do
      [ -e "$REPOSITORIO/$archivo" ] || FALTAN="${FALTAN:+$FALTAN }$archivo"
    done
    if [ -z "$FALTAN" ]; then
      aprobado 'notas.tmp y respaldo.bak siguen en tu carpeta, como corresponde'
    else
      fallido 'notas.tmp y respaldo.bak siguen en la carpeta' 'los dos presentes' \
        "faltan: $FALTAN; salieron del disco, y --cached era justamente para que no"
    fi
  fi

  # --- Criterio · la credencial ya no esta en el disco -----------------------
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'credenciales.txt ya no esta en la carpeta' 'el archivo borrado del disco'
  elif [ -e "$REPOSITORIO/credenciales.txt" ]; then
    fallido 'credenciales.txt ya no esta en la carpeta' 'el archivo borrado del disco' \
      'sigue ahi; con la credencial no basta sacarla del seguimiento'
  else
    aprobado 'credenciales.txt ya no esta en tu carpeta'
  fi

  # --- Criterio · las recetas quedaron ordenadas ----------------------------
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'las recetas quedaron ordenadas por tipo' 'recetas/principales y recetas/postres'
  else
    PRINCIPALES=$(ls "$REPOSITORIO/recetas/principales" 2>/dev/null | paste -sd ' ' -)
    POSTRES=$(ls "$REPOSITORIO/recetas/postres" 2>/dev/null | paste -sd ' ' -)
    if [ -n "$PRINCIPALES" ] && [ -n "$POSTRES" ]; then
      aprobado "las recetas quedaron ordenadas: principales ($PRINCIPALES) y postres ($POSTRES)"
    else
      fallido 'las recetas quedaron ordenadas por tipo' \
        'recetas/principales y recetas/postres con las recetas dentro' \
        "principales: ${PRINCIPALES:-vacia}; postres: ${POSTRES:-vacia}"
    fi
  fi

  # --- Criterio · el directorio de trabajo esta limpio ----------------------
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
  if [ "$CONFIRMACIONES" = '5' ]; then
    aprobado 'hay cinco confirmaciones en el historial'
  else
    fallido 'cantidad de confirmaciones' '5' "$CONFIRMACIONES"
  fi

  # Lo que hace al laboratorio: los tres estan confirmados, no sueltos.
  FALTAN=''
  for archivo in notas.tmp respaldo.bak credenciales.txt; do
    [ -n "$(g log --format=%H -1 -- "$archivo")" ] || FALTAN="${FALTAN:+$FALTAN }$archivo"
  done
  if [ -z "$FALTAN" ]; then
    aprobado 'los tres archivos que sobran estan en la historia confirmada'
  else
    fallido 'los tres archivos que sobran estan confirmados' \
      'notas.tmp, respaldo.bak y credenciales.txt en la historia' "faltan: $FALTAN"
  fi

  if grep -q 'clave:' "$REPOSITORIO/credenciales.txt" 2>/dev/null; then
    aprobado 'credenciales.txt lleva una clave dentro, que es el punto del ejercicio'
  else
    fallido 'credenciales.txt lleva una clave' 'una linea con «clave:»' 'no la tiene'
  fi

  if [ -e "$REPOSITORIO/.gitignore" ]; then
    fallido 'no hay archivo de exclusiones' 'que no exista; escribirlo es el ejercicio' 'ya existe'
  else
    aprobado 'no hay archivo de exclusiones: escribirlo es el ejercicio'
  fi

  RECETAS=$(ls "$REPOSITORIO/recetas" 2>/dev/null | sort | paste -sd ' ' -)
  ESPERADAS='empanadas.md leche-asada.md mote-con-huesillo.md pastel-de-choclo.md'
  if [ "$RECETAS" = "$ESPERADAS" ]; then
    aprobado 'las cuatro recetas estan mezcladas, sin carpetas por tipo'
  else
    fallido 'las cuatro recetas mezcladas' "$ESPERADAS" "${RECETAS:-ninguna}"
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
