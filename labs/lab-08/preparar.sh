#!/usr/bin/env bash
# Preparacion del escenario del laboratorio 08 (forma de la seccion 18 de
# docs/arquitectura.md).
#
# Es el unico laboratorio que necesita un remoto de verdad, y la sala no tiene
# red hacia un servidor de Git. Un paquete sirve como remoto: se puede traer y
# enviar contra el como si fuera un repositorio remoto corriente, y todo ocurre
# en disco.
#
# Deja tres cosas, una al lado de la otra:
#
#   recetario/          el repositorio donde trabaja el participante, con
#                       `origin` apuntando al paquete de al lado
#   recetario.bundle    ese paquete, que hace de `origin`
#   upstream.bundle     el proyecto original del que salio la copia, **dos
#                       confirmaciones por delante**: sin esa diferencia,
#                       traer desde el segundo remoto no traeria nada y los
#                       puntos 1.4 a 1.6 del enunciado se quedarian sin materia
#
# No hay repositorio de condimentos: el submodulo salio del laboratorio porque
# Git bloquea el transporte `file` desde la version 2.38.1 (CVE-2022-39253) y
# en esta sala todos los remotos viven en carpetas del disco.
#
# Este laboratorio no lleva escenario de simulador. Lo que enseña son dos
# remotos y un gancho, y el motor no modela ninguna de las dos cosas
# (seccion 24 de docs/arquitectura.md).
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="${TALLER_RAIZ:-$(dirname "$CLON")}/lab-08"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='lab-08/recetario'

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
  echo "  preparacion del laboratorio 08: $*" >&2
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
echo "Preparando el escenario del laboratorio 08"
echo

# Los paquetes se rehacen enteros.
rm -rf "$TRABAJO/recetario.bundle" "$TRABAJO/upstream.bundle" "$TRABAJO/.upstream"

CORREO_JUANA='juana.perez@recetario.cl'
CORREO_MARCO='marco.diaz@recetario.cl'
CORREO_SOFIA='sofia.rojas@recetario.cl'

configurar() {
  git config user.name 'Participante del taller'
  git config user.email 'participante@sii.cl'
  git config core.autocrlf false
  git config core.eol lf
  git config commit.gpgsign false
  git config core.logAllRefUpdates true
  git config gc.auto 0
}

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

# --- El recetario ------------------------------------------------------------

mkdir -p "$REPOSITORIO"
cd "$REPOSITORIO"

if git init -q -b main --ref-format=files . 2>/dev/null; then
  :
else
  git init -q -b main .
fi
configurar

# 1 · 6 de agosto de 2024
cat > README.md <<'ARCHIVO'
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1722946500 'Agrega el README del recetario'

# 2 · 20 de agosto de 2024
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
confirmar 'Marco Diaz' "$CORREO_MARCO" 1724162400 'Agrega platos e ingredientes'

# 3 · 10 de septiembre de 2024
mkdir -p recetas
cat > recetas/pastel-de-choclo.md <<'ARCHIVO'
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
ARCHIVO
cat > recetas/empanadas.md <<'ARCHIVO'
# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1725991800 'Agrega las dos primeras recetas'

# 4 · 1 de octubre de 2024
cat > cocineros.md <<'ARCHIVO'
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
- Sofia Rojas, especialidad cazuela
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1727792100 'Agrega la tabla de cocineros'

# El paquete que hace de `origin`, con las cuatro confirmaciones. En las demas
# semillas `preparar.sh` quita el remoto; aqui se pone a proposito, porque el
# remoto es la materia del ejercicio.
git bundle create -q "$TRABAJO/recetario.bundle" --all HEAD

# --- El proyecto original, dos confirmaciones por delante --------------------
#
# Se arma clonando el paquete de origin en una carpeta aparte, agregandole lo
# que el proyecto original avanzo, y empaquetandolo. La carpeta se borra: lo
# que el participante recibe es el paquete.
#
# Las dos confirmaciones tocan `ingredientes.md`, que es un archivo que el
# recetario ya tiene, de modo que traerlas sea una fusion de verdad y no la
# aparicion de archivos nuevos.

# El clon lleva core.autocrlf en false desde antes de escribir nada. Fijarlo
# despues, en configurar, dejaba los archivos del clon con CRLF en Windows:
# si el git add -A de la confirmacion siguiente caia en otro segundo que el
# clonado, Git los volvia a leer, confirmaba los CRLF y los identificadores
# del proyecto original cambiaban de una corrida a otra (SPEC 028, 4.8).
git -c core.autocrlf=false -c core.eol=lf clone -q --config core.autocrlf=false --config core.eol=lf \
  "$TRABAJO/recetario.bundle" "$TRABAJO/.upstream"
cd "$TRABAJO/.upstream"
configurar

# 5 · 15 de octubre de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- comino molido
ARCHIVO
confirmar 'Juana Perez' "$CORREO_JUANA" 1729001700 'Suma el comino a la lista base'

# 6 · 29 de octubre de 2024
cat > ingredientes.md <<'ARCHIVO'
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- comino molido
- oregano
ARCHIVO
confirmar 'Marco Diaz' "$CORREO_MARCO" 1730212200 'Suma el oregano a la lista base'

git bundle create -q "$TRABAJO/upstream.bundle" --all HEAD
cd "$TRABAJO"
rm -rf "$TRABAJO/.upstream"

# El remoto de origen queda puesto, apuntando al paquete de al lado.
cd "$REPOSITORIO"
git remote add origin "$TRABAJO/recetario.bundle"
git fetch -q origin
git branch --set-upstream-to=origin/main main >/dev/null 2>&1 || true

cd "$REPOSITORIO"

if ! "$RAIZ/verificar.sh" --escenario; then
  fallar "el escenario no quedo como corresponde; no se entrega asi"
fi

echo
echo "  El repositorio quedo en:"
echo "      $REPOSITORIO"
echo
echo "  Y al lado, los dos paquetes que hacen de remotos:"
echo "      recetario.bundle    tu origin"
echo "      upstream.bundle     el proyecto original, dos confirmaciones adelante"
echo
echo "  Tu primera orden es:"
echo "      cd $REPOSITORIO_DICHO"
echo
echo "  Y desde ahi, para ubicarte:"
echo "      git log --oneline"
echo "      git remote -v"
echo
echo "  Este laboratorio va entero en tu terminal: es el unico que no se"
echo "  puede seguir en el simulador, porque enseña remotos y un gancho,"
echo "  y el motor no modela ninguna de las dos cosas."
echo
