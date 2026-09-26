#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 02 (seccion 3 del SPEC 005).
#
# Arma el repositorio desde cero con ordenes de Git reales. No usa semillas/,
# no clona ningun paquete y no depende de nada fuera de esta carpeta: un
# laboratorio es una carpeta con todo lo que necesita adentro.
#
# El escenario es determinista, o sea produce los mismos identificadores de
# confirmacion en cualquier maquina y en cualquier momento. Eso permite que el
# enunciado cite una confirmacion y que el verificador compare contra un estado
# conocido. Las tres tecnicas son las del SPEC 003: fechas como epoca en vez de
# `date`, que no acepta los mismos argumentos en BSD y en GNU; autor y
# confirmador fijados en cada confirmacion; y finales de linea fijados en el
# repositorio generado, porque sobre Windows `autocrlf` cambiaria el contenido
# confirmado y con el los identificadores.
#
# El trabajo del participante vive fuera del clon del curso, en una carpeta
# hermana (seccion 17 de docs/arquitectura.md).
#
# Escrito para Bash 3.2, el de macOS. Git Bash sobre Windows trae uno mas
# nuevo y acepta lo que funciona en el viejo, pero no al reves.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-02"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-02/recetario'

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
  echo "  preparacion del laboratorio 02: $*" >&2
  echo >&2
  exit 1
}

# Git 2.28 es el primero que acepta `init -b`. Antes de eso la rama inicial
# dependia de la configuracion de la maquina, que es justo lo que el
# determinismo prohibe.
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

# --- Rehacer un escenario que ya existe -------------------------------------

# Esto destruye el trabajo del participante en este laboratorio, asi que se
# avisa fuerte y se pregunta. `--forzar` es para las pruebas y para quien ya
# sabe lo que hace.
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

# --- El escenario ------------------------------------------------------------

echo
echo "Preparando el escenario del laboratorio 02"
echo

mkdir -p "$REPOSITORIO"
cd "$REPOSITORIO"

git init -q -b main
git config core.autocrlf false
git config core.eol lf
git config commit.gpgsign false

# Las cinco confirmaciones, repartidas en 2024. Las fechas van como epoca:
# `date` no acepta los mismos argumentos en BSD y en GNU, y de ahi salen
# historias distintas en cada maquina.
CORREO_JUANA='juana.perez@recetario.cl'
CORREO_MARCO='marco.diaz@recetario.cl'
CORREO_SOFIA='sofia.rojas@recetario.cl'

# Confirma todo lo que hay en el directorio de trabajo. Autor y confirmador
# llevan el mismo nombre y el mismo instante: si el confirmador tomara la hora
# de la maquina, el identificador cambiaria en cada ejecucion.
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

# 1 · 15 de enero de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1705321200 'se inicia el recetario'

# 2 · 27 de febrero de 2024. Aqui entra la palabra que el enunciado busca con
# `git log -S "curanto"`, y de aqui no se mueve.
cat > platos.md <<'ARCHIVO'
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1709045100 'se agregan los platos chilenos'

# 3 · 9 de abril de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- albahaca
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1712686200 'se agregan los ingredientes base'

# 4 · 18 de julio de 2024
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1721307900 'se suma la lista de cocineros'

# 5 · 30 de septiembre de 2024. El mensaje va mal escrito a proposito: es lo
# que el participante corrige con --amend en la parte 3.1 del enunciado.
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1727725200 'se docuemnta la reseta del pastel de choclo'

# --- La suciedad del directorio de trabajo -----------------------------------

# Un cambio que no sirve, sin preparar. El participante lo mira con `git diff`
# y lo descarta con `git restore`. Se borro una linea buena y se dejaron dos
# lineas de basura: asi el descarte tiene sentido a la vista.
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- albahaca
asdf probando
TODO borrar esto antes de confirmar
ARCHIVO

# Un cambio bueno, pero preparado por error. El participante lo saca del area
# de preparacion con `git restore --staged`, sin perder el contenido.
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
- Sofia Rojas, especialidad cazuela
ARCHIVO
git add cocineros.md

# --- Comprobacion del escenario ----------------------------------------------

# Un escenario mal armado descubierto en clase cuesta el bloque completo, asi
# que no se entrega sin revisar. El verificador sabe comprobar el estado
# inicial ademas del final: es el mismo archivo y los mismos criterios.
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
echo "  Y en el simulador, elige el escenario de este laboratorio:"
echo "      Lab 02, en el selector que dice «escenario»"
echo "      o abrelo con la direccion SIMULADOR.html?lab=02"
echo
echo "  Abierto con doble clic parte en el del laboratorio 01, que"
echo "  todavia no tiene repositorio: ahi el grafo no dibuja nada."
echo
