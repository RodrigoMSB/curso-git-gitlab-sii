#!/usr/bin/env bash
# Verificador del laboratorio 08 (reglas de la seccion 15 de
# docs/arquitectura.md).
#
# Sin argumentos comprueba el ESTADO FINAL, con los criterios de la seccion
# «Comprobacion» del enunciado. Con `--escenario` comprueba el ESTADO INICIAL,
# que es lo que usa preparar.sh antes de entregar el laboratorio.
#
# Lo que distingue un laboratorio hecho de uno recien preparado son las tres
# piezas que el participante pone: el submodulo incorporado, el gancho escrito
# y con permiso de ejecucion, y el segundo remoto ya quitado.
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
  echo "Verificador del laboratorio 08 · dos remotos, un submodulo y un gancho"
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
    aprobado 'el paquete del recetario esta al lado, y hace de remoto'
  else
    fallido 'el paquete que hace de remoto' \
      'taller-git-trabajo/lab-08/recetario.bundle' 'no existe'
  fi

  # Sin el segundo paquete no hay submodulo que incorporar.
  if [ -f "$TRABAJO/condimentos.bundle" ]; then
    aprobado 'el paquete de los condimentos esta al lado, para el submodulo'
  else
    fallido 'el paquete de los condimentos' \
      'taller-git-trabajo/lab-08/condimentos.bundle' 'no existe'
  fi

  # Incorporar el submodulo es el laboratorio: no puede venir puesto.
  if [ ! -e "$REPOSITORIO/.gitmodules" ]; then
    aprobado 'no hay .gitmodules: incorporar el submodulo es el ejercicio'
  else
    fallido 'el submodulo no viene puesto' 'que no exista .gitmodules' 'ya existe'
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

  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el submodulo quedo incorporado' 'un .gitmodules que apunta a los condimentos'
  elif [ ! -f "$REPOSITORIO/.gitmodules" ]; then
    fallido 'el submodulo quedo incorporado' \
      'un .gitmodules que apunta a los condimentos' \
      'no existe .gitmodules; falta el git submodule add del punto 2.2'
  elif grep -q 'condimentos' "$REPOSITORIO/.gitmodules"; then
    aprobado 'el submodulo quedo incorporado y .gitmodules apunta a los condimentos'
  else
    fallido 'el submodulo quedo incorporado' \
      'que .gitmodules nombre los condimentos' "$(cat "$REPOSITORIO/.gitmodules")"
  fi

  # Lo que el repositorio guarda del submodulo es un identificador, no
  # archivos. Es el punto 2.3 y el unico criterio que lo comprueba.
  if [ "$HAY_REPOSITORIO" = no ]; then
    sin_repositorio 'el submodulo se guardo como identificador' 'una linea con modo 160000'
  else
    ENTRADA=$(g ls-files -s condimentos)
    case $ENTRADA in
      160000\ *)
        aprobado 'el submodulo se guardo como un identificador de confirmacion, no como archivos'
        ;;
      '')
        fallido 'el submodulo se guardo como identificador' \
          'una linea de git ls-files -s condimentos' \
          'no hay ninguna; falta confirmar el submodulo'
        ;;
      *)
        fallido 'el submodulo se guardo como identificador' \
          'modo 160000, que es como Git anota un submodulo' "$ENTRADA"
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

  # El clon de prueba de la parte 2 se borra al terminar.
  if [ -e "$TRABAJO/recetario-copia" ]; then
    fallido 'no quedo el clon de prueba dando vueltas' \
      'que recetario-copia este borrado' 'sigue ahi'
  else
    aprobado 'no quedo el clon de prueba dando vueltas'
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
