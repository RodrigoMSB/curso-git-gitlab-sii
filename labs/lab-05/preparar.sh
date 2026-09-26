#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 05 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# Cuatro ramas de trabajo, una por cada caso de fusion: avance rapido,
# union con archivos distintos, union del mismo archivo sin chocar, y conflicto.
#
# Tres ramas con destinos distintos a proposito, que es lo que el enunciado
# necesita para mostrar los tres casos de fusion:
#
#   tailandesa  cuelga de la punta de main, que no avanzo despues, de modo que
#               su fusion es un avance rapido y no crea nada.
#   azteca      nace una confirmacion antes y toca archivos que main no toco,
#               de modo que su fusion crea una confirmacion de union limpia.
#   andina      nace en el mismo punto y cambia la misma linea de platos.md que
#               cambio main, de modo que su fusion choca.
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-05"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-05/recetario'

FORZAR=no
for argumento in "$@"; do
  case $argumento in
    --forzar) FORZAR=si ;;
    *)
      echo "preparar.sh: opcion desconocida «${argumento}»" >&2
      echo "uso: ./preparar.sh [--forzar]" >&2
      exit 2
      ;;
  esac
done

fallar() {
  echo >&2
  echo "  preparacion del laboratorio 05: $*" >&2
  echo >&2
  exit 1
}

comprobar_git() {
  local version mayor menor
  version=$(git --version | awk '{print $3}')
  mayor=${version%%.*}
  menor=${version#*.}
  menor=${menor%%.*}
  if [ "$mayor" -lt 2 ] || { [ "$mayor" -eq 2 ] && [ "$menor" -lt 28 ]; }; then
    fallar "hace falta Git 2.28 o superior; hay $version"
  fi
}

if [ -e "$REPOSITORIO" ]; then
  echo
  echo "  ATENCION"
  echo
  echo "  Ya existe un repositorio en:"
  echo "      $REPOSITORIO"
  echo
  echo "  Rehacer el escenario lo BORRA COMPLETO. Si trabajaste en este"
  echo "  laboratorio, se pierde todo lo que hiciste: confirmaciones, cambios"
  echo "  sin confirmar y cualquier rama que hayas creado. No hay vuelta atras."
  echo
  if [ "$FORZAR" = si ]; then
    echo "  Se recibio --forzar, asi que se borra sin preguntar."
    echo
  else
    if [ ! -t 0 ]; then
      fallar "hace falta confirmar el borrado y no hay terminal; usa --forzar si es lo que quieres"
    fi
    printf '  Escribe «si» para borrarlo y rehacer el escenario: '
    read -r respuesta
    if [ "$respuesta" != 'si' ]; then
      echo
      echo "  No se toco nada. El repositorio quedo como estaba."
      echo
      exit 0
    fi
    echo
  fi
  echo "  BORRANDO $REPOSITORIO_DICHO"
  rm -rf "$REPOSITORIO"
fi

comprobar_git

echo
echo "Preparando el escenario del laboratorio 05"
echo

mkdir -p "$REPOSITORIO"
cd "$REPOSITORIO"

if git init -q -b main --ref-format=files . 2>/dev/null; then
  :
else
  git init -q -b main .
fi

git config user.name 'Participante del taller'
git config user.email 'participante@sii.cl'
git config core.autocrlf false
git config core.eol lf
git config commit.gpgsign false
git config core.logAllRefUpdates true
git config gc.auto 0

CORREO_JUANA='juana.perez@recetario.cl'
CORREO_MARCO='marco.diaz@recetario.cl'
CORREO_SOFIA='sofia.rojas@recetario.cl'

# Autor y confirmador llevan el mismo nombre y el mismo instante: si el
# confirmador tomara la hora de la maquina, el identificador cambiaria en cada
# ejecucion.
confirmar() {
  local nombre=$1 correo=$2 epoca=$3 mensaje=$4
  git add -A
  GIT_AUTHOR_NAME="$nombre" \
  GIT_AUTHOR_EMAIL="$correo" \
  GIT_AUTHOR_DATE="@$epoca -0300" \
  GIT_COMMITTER_NAME="$nombre" \
  GIT_COMMITTER_EMAIL="$correo" \
  GIT_COMMITTER_DATE="@$epoca -0300" \
    git commit -q -m "$mensaje"
}

# 1 · 7 de mayo de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1715084400 'Agrega el README del recetario'

# 2 · 21 de mayo de 2024
cat > platos.md <<'ARCHIVO'
# Platos

## Fondos

- pastel de choclo
- cazuela
- curanto

## Entradas

- empanadas de pino
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1716302100 'Agrega la lista de platos'

# 3 · 11 de junio de 2024. De aqui cuelgan las dos ramas que nacen antes de que
# main toque la linea de la cazuela.
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1718131500 'Agrega los ingredientes base'
BASE=$(git rev-parse HEAD)

# 4 · 2 de julio de 2024. main cambia la linea de la cazuela.
cat > platos.md <<'ARCHIVO'
# Platos

## Fondos

- pastel de choclo
- cazuela con chuchoca
- curanto

## Entradas

- empanadas de pino
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1719926700 'Precisa que la cazuela lleva chuchoca'

# La rama que se fusiona por avance rapido: cuelga de la punta de main, y main
# no vuelve a moverse.
git switch -q -c tailandesa
mkdir -p recetas
cat > recetas/pad-thai.md <<'ARCHIVO'
# Pad thai

Fideos de arroz, tamarindo, mani y salsa de pescado.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1720537500 'Agrega la receta del pad thai'

# La rama que se fusiona con confirmacion de union: nace antes de la punta y
# toca archivos que main no toco.
git switch -q -c azteca "$BASE"
mkdir -p recetas
cat > recetas/guacamole.md <<'ARCHIVO'
# Guacamole

Palta, cebolla morada, cilantro y limon de pica.
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1721134200 'Agrega la receta del guacamole'

# La rama que toca el mismo archivo que main y **no** choca: nace en el mismo
# punto que andina y le suma una entrada al final, lejos de la linea de la
# cazuela. Es el cuarto caso de fusion del laboratorio, y el que desarma la
# creencia de que tocar el mismo archivo es conflicto seguro.
git switch -q -c criolla "$BASE"
cat > platos.md <<'ARCHIVO'
# Platos

## Fondos

- pastel de choclo
- cazuela
- curanto

## Entradas

- empanadas de pino
- sopaipillas
ARCHIVO
mkdir -p recetas
cat > recetas/sopaipillas.md <<'ARCHIVO'
# Sopaipillas

Masa de zapallo y harina, fritas, con pebre o chancaca.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1721323200 'Suma las sopaipillas a las entradas'

# La rama que choca: nace en el mismo punto y cambia la misma linea de la
# cazuela que acaba de cambiar main.
git switch -q -c andina "$BASE"
cat > platos.md <<'ARCHIVO'
# Platos

## Fondos

- pastel de choclo
- lomo saltado
- curanto

## Entradas

- empanadas de pino
ARCHIVO
mkdir -p recetas
cat > recetas/lomo-saltado.md <<'ARCHIVO'
# Lomo saltado

Lomo en tiras, cebolla, tomate y papas fritas, al wok.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1721763000 'Reemplaza la cazuela por el lomo saltado'

git switch -q main

if ! "$RAIZ/verificar.sh" --escenario; then
  fallar "el escenario no quedo como corresponde; no se entrega asi"
fi

echo
echo "  El repositorio quedo en:"
echo "      $REPOSITORIO"
echo
echo "  Tu primera orden es:"
echo "      cd $REPOSITORIO_DICHO"
echo
echo "  Y desde ahi, para ubicarte:"
echo "      git branch"
echo "      git log --oneline --graph --all --decorate"
echo
echo "  Y en el simulador, elige el escenario de este laboratorio:"
echo "      Lab 05, en el selector que dice «escenario»"
echo "      o abrelo con la direccion SIMULADOR.html?lab=05"
echo
echo "  Abierto con doble clic parte en el del laboratorio 01, que"
echo "  todavia no tiene repositorio: ahi el grafo no dibuja nada."
echo
