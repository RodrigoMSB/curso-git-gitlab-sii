#!/usr/bin/env bash
# Verificador del laboratorio 08 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado son tres cosas:
# que lo que traia el segundo remoto ya este incorporado, que el gancho este
# escrito y con permiso de ejecucion, y que el segundo remoto ya se haya
# quitado.
#
# Escrito para Bash 3.2, el de macOS.

set -u

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-08"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-08/recetario'

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
  echo "Comprobando el escenario inicial del laboratorio 08"
else
  echo "Verificador del laboratorio 08 · dos remotos y un gancho"
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

REMOTOS=$(g remote | sort | paste -sd ' ' -)

# --- Estado inicial ----------------------------------------------------------

if [ "$MODO" = escenario ] && [ "$HAY_REPOSITORIO" = si ]; then
  CONFIRMACIONES=$(g log --oneline | grep -c .) || CONFIRMACIONES=0
  if [ "$CONFIRMACIONES" = '4' ]; then
    aprobado 'el recetario trae cuatro confirmaciones'
  else
    fallido 'confirmaciones del recetario' '4' "$CONFIRMACIONES"
  fi

  # El remoto se conserva a proposito: en las demas semillas se quita, aqui es
  # la materia del ejercicio.
  if [ "$REMOTOS" = 'origin' ]; then
    aprobado 'esta puesto el remoto origin, y solo ese'
  else
    fallido 'los remotos del escenario' 'solo origin' "${REMOTOS:-ninguno}"
  fi

  if [ -f "$TRABAJO/recetario.bundle" ]; then
    aprobado 'el paquete del recetario esta al lado, y hace de origin'
  else
    fallido 'el paquete que hace de origin' \
      'taller-git-trabajo/lab-08/recetario.bundle' 'no existe'
  fi

  if [ ! -f "$TRABAJO/upstream.bundle" ]; then
    fallido 'el paquete del proyecto original' \
      'taller-git-trabajo/lab-08/upstream.bundle' 'no existe'
  else
    # **Tiene que ir por delante.** Si trajera lo mismo que origin, los puntos
    # 1.4 a 1.6 del enunciado no traerian nada y se quedarian sin ejercicio.
    ADELANTE=$(git -C "$REPOSITORIO" bundle list-heads "$TRABAJO/upstream.bundle" 2>/dev/null |
      awk '{print $1}' | head -1)
    if [ -n "$ADELANTE" ] && ! g merge-base --is-ancestor "$ADELANTE" main 2>/dev/null; then
      aprobado 'el paquete del proyecto original va por delante: traer desde el si trae algo'
    else
      fallido 'el paquete del proyecto original va por delante de origin' \
        'confirmaciones que el recetario todavia no tiene' \
        'trae lo mismo; el ejercicio de los dos remotos se quedaria sin materia'
    fi
  fi

  # Escribir el gancho tambien es el laboratorio.
  if [ ! -e "$REPOSITORIO/.git/hooks/commit-msg" ]; then
    aprobado 'no hay gancho commit-msg: escribirlo es el ejercicio'
  else
    fallido 'el gancho no viene puesto' \
      'que no exista .git/hooks/commit-msg' 'ya existe'
  fi

  if [ -z "$(suciedad)" ]; then
    aprobado 'el directorio de trabajo esta limpio'
  else
    fallido 'el directorio de trabajo esta limpio' 'nada que confirmar' "hay cambios: $(suciedad)"
  fi
fi

# --- Estado final ------------------------------------------------------------

if [ "$MODO" = final ]; then
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'quedo solo el remoto origin' 'origin'
  elif [ "$REMOTOS" = 'origin' ]; then
    aprobado 'quedo solo el remoto origin: el segundo se quito en el punto 1.8'
  else
    fallido 'los remotos' 'solo origin' \
      "${REMOTOS:-ninguno}; falta quitar el segundo con git remote remove"
  fi

  # Lo que el segundo remoto traia ya tiene que estar incorporado: es el punto
  # 1.6, y es lo unico que distingue haber traido de haber solo mirado.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'lo que traia el proyecto original ya esta incorporado' 'el comino y el oregano'
  else
    INGREDIENTES=$(g show HEAD:ingredientes.md)
    case $INGREDIENTES in
      *comino*oregano*)
        aprobado 'lo que traia el proyecto original ya esta incorporado en ingredientes.md'
        ;;
      *)
        fallido 'lo que traia el proyecto original ya esta incorporado' \
          'el comino y el oregano en ingredientes.md, que es lo que upstream tenia de mas' \
          'no estan; falta el git merge del punto 1.6'
        ;;
    esac
  fi

  # El gancho, con su permiso: sin la x no corre, y es el error mas comun.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el gancho commit-msg existe y es ejecutable' 'un archivo con permiso de ejecucion'
  elif [ ! -f "$REPOSITORIO/.git/hooks/commit-msg" ]; then
    fallido 'el gancho commit-msg existe y es ejecutable' \
      '.git/hooks/commit-msg' 'no existe; falta escribirlo en el punto 3.2'
  elif [ -x "$REPOSITORIO/.git/hooks/commit-msg" ]; then
    aprobado 'el gancho commit-msg existe y tiene permiso de ejecucion'
  else
    fallido 'el gancho commit-msg es ejecutable' \
      'permiso de ejecucion, que es lo que hace que corra' \
      'existe pero no es ejecutable; falta el chmod +x'
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

# --- Resumen -----------------------------------------------------------------

TOTAL=$((APROBADOS + FALLIDOS))
echo
if [ "$FALLIDOS" -gt 0 ]; then
  if [ "$MODO" = escenario ]; then
    echo "  $APROBADOS de $TOTAL · el escenario NO quedo como corresponde"
  else
    echo "  $APROBADOS de $TOTAL criterios aprobados · el laboratorio lab-08 no esta terminado"
  fi
  echo
  exit 1
fi
if [ "$MODO" = escenario ]; then
  echo "  $APROBADOS de $TOTAL · el escenario quedo correcto"
else
  echo "  $APROBADOS de $TOTAL criterios aprobados · laboratorio lab-08 terminado"
fi
echo
