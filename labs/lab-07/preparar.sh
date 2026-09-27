#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 07 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# `main` con cuatro confirmaciones y la rama `trabajo` con otras cuatro,
# separada desde la segunda. El puntero queda **en `trabajo`**, que es donde el
# enunciado arranca, y en el directorio hay una receta ya versionada y
# reescrita a medias: es lo que el participante guarda temporalmente en su
# Parte 1. Tiene que estar en seguimiento, porque `git stash` sin `-u` no toca
# lo que nunca entro al repositorio.
#
# Los mensajes de la rama de trabajo son pobres a proposito —wip, cambios, mas
# cambios, arreglos— porque son los que la Parte 3 junta y reescribe.
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-07"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-07/recetario'

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
  echo "  preparacion del laboratorio 07: $*" >&2
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
  # Fuera de la carpeta antes de borrarla: en Windows no se puede borrar la
  # que es el directorio actual de un proceso, este incluido (SPEC 029).
  cd "$CLON" || exit 1
  rm -rf "$REPOSITORIO"
fi

comprobar_git

echo
echo "Preparando el escenario del laboratorio 07"
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
# La rama de trabajo la escribio el propio participante: son sus mensajes malos
# los que va a reescribir.
NOMBRE_PARTICIPANTE='Participante del taller'
CORREO_PARTICIPANTE='participante@sii.cl'

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

# 1 · 4 de junio de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1717503900 'Agrega el README del recetario'

# 2 · 18 de junio de 2024. De aqui cuelga la rama de trabajo.
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
ARCHIVO
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1718719800 'Agrega platos e ingredientes'
BASE=$(git rev-parse HEAD)

# --- Lo que main avanzo por su cuenta ----------------------------------------
#
# Que main haya avanzado es lo que le da sentido al rebase de la Parte 2: sin
# eso la rama no tendria sobre que reordenarse.

# 3 · 9 de julio de 2024
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1720549200 'Agrega la receta del pastel de choclo'

# 4 · 30 de julio de 2024
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
- Sofia Rojas, especialidad cazuela
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1722347100 'Agrega la tabla de cocineros'

# --- La rama de trabajo ------------------------------------------------------
#
# Cuatro confirmaciones con mensajes que no dicen nada, escritas por el propio
# participante entre medio de lo que main avanzaba. Son las que la Parte 3
# reescribe con `rebase -i`, asi que **no hay que mejorarlas aqui**.

git switch -q -c trabajo "$BASE"

# 25 de junio de 2024
mkdir -p recetas
cat > recetas/pad-thai.md <<'ARCHIVO'
# Pad thai

Fideos de arroz y salsa de pescado.
ARCHIVO
confirmar "$NOMBRE_PARTICIPANTE" "$CORREO_PARTICIPANTE" 1719345900 'wip'

# 26 de junio de 2024
cat > recetas/pad-thai.md <<'ARCHIVO'
# Pad thai

Fideos de arroz, tamarindo, mani y salsa de pescado.
ARCHIVO
confirmar "$NOMBRE_PARTICIPANTE" "$CORREO_PARTICIPANTE" 1719405000 'cambios'

# 27 de junio de 2024
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
- pad thai
ARCHIVO
confirmar "$NOMBRE_PARTICIPANTE" "$CORREO_PARTICIPANTE" 1719510600 'mas cambios'

# 2 de julio de 2024
cat > recetas/curry-verde.md <<'ARCHIVO'
# Curry verde

Pasta verde, leche de coco, albahaca tailandesa y berenjena.
ARCHIVO
cat > recetas/curry-massaman.md <<'ARCHIVO'
# Curry massaman

Pasta massaman, leche de coco, papa y mani tostado.
ARCHIVO
confirmar "$NOMBRE_PARTICIPANTE" "$CORREO_PARTICIPANTE" 1719949200 'arreglos'

# --- Lo que quedo a medias cuando lo interrumpieron --------------------------
#
# La receta **ya esta versionada** y se reescribe a medias encima: es lo que el
# participante guarda con `git stash` en el punto 1.3. Tiene que estar en
# seguimiento, porque `git stash` sin `-u` no toca lo que nunca entro. El
# guardado temporal parte vacio a proposito, porque crear la primera entrada es
# el ejercicio.
cat > recetas/curry-massaman.md <<'ARCHIVO'
# Curry massaman

Pasta massaman, leche de coco, papa y mani tostado.
Tiempo de preparacion:
Se sofrie la pasta, se agrega la leche de coco y
ARCHIVO

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
echo "      git status"
echo
# En la consola del taller no se nombra el simulador: la pagina ya es el
# taller (SPEC 029, 3.1). TALLER_CD_DESPUES lo exporta solo esa consola;
# desde Git Bash no esta, y se imprime como siempre.
if [ -z "${TALLER_CD_DESPUES:-}" ]; then
  echo "  Y en el simulador, elige el escenario de este laboratorio:"
  echo "      Lab 07, en el selector que dice «escenario»"
  echo "      o abrelo con la direccion SIMULADOR.html?lab=07"
  echo
  echo "  Abierto con doble clic parte en el del laboratorio 01, que"
  echo "  todavia no tiene repositorio: ahi el grafo no dibuja nada."
  echo
fi
