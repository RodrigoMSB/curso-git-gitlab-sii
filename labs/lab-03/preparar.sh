#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 03 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# Los tres archivos que no deberian estar versionados entran a la historia
# confirmada, no solo al directorio de trabajo. Esa es la diferencia entre
# ignorar un archivo y sacarlo del seguimiento, que es el punto del ejercicio.
# No hay archivo de exclusiones: lo escribe el participante.
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-03"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-03/recetario'

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
  echo "  preparacion del laboratorio 03: $*" >&2
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
echo "Preparando el escenario del laboratorio 03"
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

# 1 · 5 de febrero de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- leche asada
- mote con huesillo
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1707136800 'Agrega el README y la lista de platos'

# 2 · 19 de febrero de 2024. Cuatro recetas mezcladas sin orden: dos de fondo y
# dos de postre. El participante las separa en dos carpetas con `git mv`.
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
cat > recetas/empanadas.md <<'ARCHIVO'
# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
ARCHIVO
cat > recetas/leche-asada.md <<'ARCHIVO'
# Leche asada

Leche, huevos y azucar al horno, con caramelo en el molde.
ARCHIVO
cat > recetas/mote-con-huesillo.md <<'ARCHIVO'
# Mote con huesillo

Huesillos cocidos con canela y azucar rubia, mote de trigo aparte.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1708352100 'Agrega las cuatro primeras recetas'

# 3 · 11 de marzo de 2024. Basura que nunca debio versionarse, confirmada.
cat > notas.tmp <<'ARCHIVO'
Reunion de cocina del martes.
Pendiente: definir el menu de septiembre.
ARCHIVO
cat > respaldo.bak <<'ARCHIVO'
Respaldo automatico del listado de platos.
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1710183900 'Guarda notas de la reunion de cocina'

# 4 · 2 de abril de 2024. La credencial, que es el punto del laboratorio.
cat > credenciales.txt <<'ARCHIVO'
usuario: casino_recetario
clave: 4lm3ndr4s-2024
servidor: casino.interno.cl
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1712064600 'Agrega el acceso al sistema del casino'

# 5 · 23 de abril de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- leche
- huesillos
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1713898200 'Completa la lista de ingredientes'

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
echo "      git log --oneline"
echo "      ls recetas"
echo "      git status"
echo
# En la consola del taller no se nombra el simulador: la pagina ya es el
# taller (SPEC 029, 3.1). TALLER_CD_DESPUES lo exporta solo esa consola;
# desde Git Bash no esta, y se imprime como siempre.
if [ -z "${TALLER_CD_DESPUES:-}" ]; then
  echo "  Y en el simulador, elige el escenario de este laboratorio:"
  echo "      Lab 03, en el selector que dice «escenario»"
  echo "      o abrelo con la direccion SIMULADOR.html?lab=03"
  echo
  echo "  Abierto con doble clic parte en el del laboratorio 01, que"
  echo "  todavia no tiene repositorio: ahi el grafo no dibuja nada."
  echo
fi
