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
#   recetario/            el repositorio donde trabaja el participante, con
#                         `origin` apuntando al paquete de al lado
#   recetario.bundle      ese paquete, que hace de remoto
#   condimentos.bundle    un segundo repositorio, chico, para incorporar como
#                         submodulo
#
# **No hay `.gitmodules`**: incorporar el submodulo es el laboratorio.
#
# Este laboratorio no lleva escenario de simulador. Lo que enseña son dos
# remotos, un submodulo y un gancho, y el motor no modela ninguna de las tres
# cosas (seccion 24 de docs/arquitectura.md).
#
# Determinista con las tecnicas de siempre: fechas como epoca, autor y
# confirmador fijados, finales de linea fijados en el repositorio generado.
#
# Escrito para Bash 3.2, el de macOS.

set -eu

RAIZ=$(cd "$(dirname "$0")" && pwd -P)
CLON=$(cd "$RAIZ/../.." && pwd -P)
TRABAJO="$(dirname "$CLON")/taller-git-trabajo/lab-08"
REPOSITORIO="$TRABAJO/recetario"
REPOSITORIO_DICHO='taller-git-trabajo/lab-08/recetario'

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
  rm -rf "$REPOSITORIO"
fi

comprobar_git

echo
echo "Preparando el escenario del laboratorio 08"
echo

# El clon de prueba de la parte 2 y los dos paquetes se rehacen enteros.
rm -rf "$TRABAJO/recetario-copia" "$TRABAJO/recetario.bundle" \
  "$TRABAJO/condimentos.bundle" "$TRABAJO/.condimentos"

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

# El paquete que hace de remoto, y el remoto que apunta a el. En las demas
# semillas `preparar.sh` quita el remoto; aqui se pone a proposito, porque el
# remoto es la materia del ejercicio.
git bundle create -q "$TRABAJO/recetario.bundle" --all HEAD
git remote add origin "$TRABAJO/recetario.bundle"
git fetch -q origin
git branch --set-upstream-to=origin/main main >/dev/null 2>&1 || true

# --- Los condimentos, que entran como submodulo ------------------------------
#
# Se arman en una carpeta aparte, se empaquetan y la carpeta se borra: lo que
# el participante recibe es el paquete, que es lo que `git submodule add`
# necesita. Que el submodulo no este puesto es el ejercicio.

mkdir -p "$TRABAJO/.condimentos"
cd "$TRABAJO/.condimentos"

if git init -q -b main --ref-format=files . 2>/dev/null; then
  :
else
  git init -q -b main .
fi
configurar

# 1 · 13 de agosto de 2024
cat > README.md <<'ARCHIVO'
# Condimentos del casino

Tabla de condimentos compartida entre los recetarios de las distintas
unidades. Se incorpora a cada recetario como submodulo, de modo que la
correccion de una cantidad llegue a todos.
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1723554900 'Agrega el README de los condimentos'

# 2 · 27 de agosto de 2024
cat > condimentos.md <<'ARCHIVO'
# Condimentos

| Condimento | Presentacion | Rinde |
|---|---|---|
| Aji de color | Frasco de 100 g | 40 porciones |
| Comino molido | Frasco de 50 g | 60 porciones |
| Oregano | Bolsa de 100 g | 80 porciones |
| Merken | Frasco de 80 g | 30 porciones |
ARCHIVO
confirmar 'Sofia Rojas' "$CORREO_SOFIA" 1724770800 'Agrega la tabla de condimentos'

git bundle create -q "$TRABAJO/condimentos.bundle" --all HEAD
cd "$TRABAJO"
rm -rf "$TRABAJO/.condimentos"

cd "$REPOSITORIO"

if ! "$RAIZ/verificar.sh" --escenario; then
  fallar "el escenario no quedo como corresponde; no se entrega asi"
fi

echo
echo "  El repositorio quedo en:"
echo "      $REPOSITORIO"
echo
echo "  Y al lado, los dos paquetes que vas a usar:"
echo "      recetario.bundle    el remoto"
echo "      condimentos.bundle  el submodulo"
echo
echo "  Tu primera orden es:"
echo "      cd $REPOSITORIO_DICHO"
echo
echo "  Y desde ahi, para ubicarte:"
echo "      git log --oneline"
echo "      git remote -v"
echo
echo "  Este laboratorio va entero en tu terminal: es el unico que no se"
echo "  puede seguir en el simulador, porque enseña remotos, un submodulo"
echo "  y un gancho, y el motor no modela ninguna de las tres cosas."
echo
