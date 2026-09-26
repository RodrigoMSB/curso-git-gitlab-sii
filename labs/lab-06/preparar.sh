#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 06 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# Siete confirmaciones. La cuarta mete un ingrediente que no corresponde y
# quedan tres confirmaciones encima. El enunciado la trata como ya publicada,
# que es lo que hace preferible revertir antes que retroceder: retroceder
# obligaria a reescribir tres confirmaciones que otros ya tienen.
#
# El mensaje de esa cuarta confirmacion no delata el error a proposito: el
# enunciado la encuentra buscando «sal marina en polvo» por contenido.
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-06"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-06/recetario'

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
  echo "  preparacion del laboratorio 06: $*" >&2
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
echo "Preparando el escenario del laboratorio 06"
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

# 1 · 16 de enero de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1705407000 'Agrega el README del recetario'

# 2 · 6 de febrero de 2024
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1707229200 'Agrega la lista de platos'

# 3 · 27 de febrero de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1709055900 'Agrega los ingredientes base'

# 4 · 19 de marzo de 2024. El error que el participante va a revertir.
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- sal marina en polvo
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1710853500 'Suma un ingrediente a la lista base'

# 5 · 9 de abril de 2024
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1712687400 'Agrega la receta del pastel de choclo'

# 6 · 30 de abril de 2024
cat > recetas/cazuela.md <<'ARCHIVO'
# Cazuela

Presa de vacuno, zapallo, papa y choclo en caldo largo.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1714480800 'Agrega la receta de la cazuela'

# 7 · 21 de mayo de 2024
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
- Sofia Rojas, especialidad cazuela
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1716318900 'Agrega la tabla de cocineros'

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
echo "      git log --oneline --graph --all --decorate"
echo
echo "  Y en el simulador, elige el escenario de este laboratorio:"
echo "      Lab 06, en el selector que dice «escenario»"
echo "      o abrelo con la direccion SIMULADOR.html?lab=06"
echo
echo "  Abierto con doble clic parte en el del laboratorio 01, que"
echo "  todavia no tiene repositorio: ahi el grafo no dibuja nada."
echo
