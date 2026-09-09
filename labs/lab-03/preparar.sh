#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 03 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# El laboratorio 03 abre la carpeta .git y mira lo que hay adentro, asi que el
# escenario no necesita suciedad: necesita una historia corta y limpia, y una
# carpeta oculta que valga la pena inspeccionar. Cuatro confirmaciones, un
# arbol con una carpeta dentro para que la cadena de objetos tenga dos niveles,
# y configuracion local de verdad en .git/config.
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-03"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-03/recetario'

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

# El laboratorio entero se sostiene sobre que `.git/refs/heads/main` sea un
# archivo suelto de 41 bytes. Git 2.45 trajo un segundo formato de referencias,
# `reftable`, que las guarda en una base binaria: con el no existe
# `.git/refs/heads` y la parte 2.2 del enunciado se queda sin nada que leer. Se
# pide `files` explicitamente para que la maquina del participante no decida.
if git init -q -b main --ref-format=files . 2>/dev/null; then
  :
else
  git init -q -b main .
fi

# Configuracion local de verdad, que es lo que el participante lee en la parte
# 1.2. Sin esto `.git/config` no tiene nada que mirar.
git config user.name 'Juana Perez'
git config user.email 'juana.perez@recetario.cl'
git config core.autocrlf false
git config core.eol lf
git config commit.gpgsign false
# El registro de referencias es la unica huella que deja la parte 4, donde el
# participante crea una rama, se cambia a ella y la borra. Si la maquina lo
# tuviera apagado, esa parte no dejaria rastro.
git config core.logAllRefUpdates true
# Nada de empaquetado automatico: la parte 3 recorre objetos sueltos y la 2.2
# mide un archivo de referencia suelto.
git config gc.auto 0

CORREO_JUANA='juana.perez@recetario.cl'
CORREO_MARCO='marco.diaz@recetario.cl'

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

# 1 · 5 de marzo de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1709641800 'se inicia el recetario'

# 2 · 21 de mayo de 2024
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1716311700 'se agregan los platos chilenos'

# 3 · 13 de agosto de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
ARCHIVO
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1723557600 'se agregan los ingredientes y los cocineros'

# 4 · 6 de noviembre de 2024. La carpeta recetas es lo que hace que el arbol de
# la raiz tenga un arbol adentro, y sin eso la parte 3.5 del enunciado, la que
# entra a una carpeta, no tiene por donde entrar.
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
cat > recetas/empanadas.md <<'ARCHIVO'
# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1730920800 'se documentan las dos primeras recetas'

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
echo "      git status"
echo
