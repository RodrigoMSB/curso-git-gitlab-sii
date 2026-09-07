#!/usr/bin/env bash
# Biblioteca comun de los generadores de semillas (punto 4.2 del SPEC 003).
#
# Fija el entorno determinista que exige la restriccion R7 y ofrece las pocas
# operaciones que todos los generadores repiten: iniciar un repositorio,
# escribir un archivo, confirmar con fecha controlada y empaquetar.
#
# Se escribe para bash 3.2, que es el que trae macOS. Git Bash sobre Windows
# trae uno mas nuevo, pero lo contrario no es cierto: nada de arreglos
# asociativos, `mapfile` ni expansiones de bash 4.

# Identidad que firma las confirmaciones. Es la misma del simulador, de modo
# que el indicador y la historia coincidan con lo que el participante ya vio
# en pantalla (punto 4.3).
SEMILLA_AUTOR_NOMBRE='Participante del taller'
SEMILLA_AUTOR_CORREO='participante@sii.cl'

# Lunes 2 de marzo de 2026, 09:14, hora de Chile continental. Es el instante
# del que cuelgan todas las fechas. Se guarda como epoca y no como texto para
# no depender de `date`, que no acepta los mismos argumentos en BSD y en GNU.
SEMILLA_EPOCA_BASE=1772453640
SEMILLA_ZONA='-0300'

# Tope de la jornada: nueve horas y cuarenta minutos despues de las 09:14 son
# las 18:54. Pasado eso el generador se detiene, porque una confirmacion a las
# tres de la manana delataria que la historia esta fabricada (punto 4.4).
SEMILLA_JORNADA_MAXIMA=34800

semilla_fallar() {
  echo "semillas: $*" >&2
  exit 1
}

semilla_avisar() {
  echo "  $*"
}

# Git 2.28 es el primero que acepta `init -b`. Antes de eso la rama inicial
# dependia de la configuracion de la maquina, que es justo lo que R7 prohibe.
semilla_comprobar_git() {
  local version mayor menor
  version=$(git --version | awk '{print $3}')
  mayor=${version%%.*}
  menor=${version#*.}
  menor=${menor%%.*}
  if [ "$mayor" -lt 2 ] || { [ "$mayor" -eq 2 ] && [ "$menor" -lt 28 ]; }; then
    semilla_fallar "hace falta Git 2.28 o superior; hay $version"
  fi
}

# Reloj de la semilla. `SEMILLA_DIAS` cuenta dias desde el lunes base y
# `SEMILLA_SEGUNDOS` el avance dentro de la jornada.
semilla_reloj_partir() {
  SEMILLA_DIAS=${1:-0}
  SEMILLA_SEGUNDOS=0
}

# Avanza al siguiente dia habil. El dia base es lunes, de modo que el resto
# entre siete dice que dia es: cinco es sabado y seis domingo.
semilla_dia_siguiente() {
  local saltos=${1:-1} resto
  while [ "$saltos" -gt 0 ]; do
    SEMILLA_DIAS=$((SEMILLA_DIAS + 1))
    resto=$((SEMILLA_DIAS % 7))
    if [ "$resto" -eq 5 ]; then SEMILLA_DIAS=$((SEMILLA_DIAS + 2)); fi
    saltos=$((saltos - 1))
  done
  SEMILLA_SEGUNDOS=0
}

# Avanza dentro del mismo dia. Se le pasan segundos.
semilla_mas_tarde() {
  SEMILLA_SEGUNDOS=$((SEMILLA_SEGUNDOS + $1))
  if [ "$SEMILLA_SEGUNDOS" -gt "$SEMILLA_JORNADA_MAXIMA" ]; then
    semilla_fallar "la jornada se paso de las 18:54; conviene usar semilla_dia_siguiente"
  fi
}

semilla_instante() {
  echo "@$((SEMILLA_EPOCA_BASE + SEMILLA_DIAS * 86400 + SEMILLA_SEGUNDOS)) $SEMILLA_ZONA"
}

# Quien firma. Por omision es el participante del taller; el laboratorio 02
# necesita varios autores para que el filtrado del historial tenga sentido.
semilla_autor() {
  SEMILLA_AUTOR_NOMBRE=$1
  SEMILLA_AUTOR_CORREO=$2
}

# Crea el repositorio desde cero. Toda la configuracion que puede cambiar el
# contenido confirmado se fija aqui, en el repositorio y no en la maquina.
semilla_iniciar() {
  local destino=$1
  semilla_comprobar_git
  rm -rf "$destino"
  mkdir -p "$destino"
  cd "$destino" || semilla_fallar "no se pudo entrar a $destino"

  git init -q -b main
  git config user.name "$SEMILLA_AUTOR_NOMBRE"
  git config user.email "$SEMILLA_AUTOR_CORREO"
  # Sobre Windows, `autocrlf` cambiaria los finales de linea y con ellos el
  # contenido confirmado, y los identificadores dejarian de coincidir (R7).
  git config core.autocrlf false
  git config core.eol lf
  git config commit.gpgsign false
  git config tag.gpgsign false
  # El nombre del empaquetador no entra en los identificadores, pero si en el
  # paquete: se fija para que dos maquinas produzcan paquetes comparables.
  git config pack.threads 1

  semilla_reloj_partir 0
}

# Escribe un archivo con el contenido que llega por la entrada estandar.
semilla_escribir() {
  local ruta=$1 carpeta
  carpeta=$(dirname "$ruta")
  [ "$carpeta" = '.' ] || mkdir -p "$carpeta"
  cat > "$ruta"
}

semilla_borrar() {
  rm -f "$@"
}

# Confirma todo lo que hay en el directorio de trabajo con la fecha del reloj.
# Autor y confirmador llevan el mismo instante: si el confirmador tomara la
# hora de la maquina, el identificador cambiaria en cada ejecucion.
semilla_confirmar() {
  local mensaje=$1 instante
  instante=$(semilla_instante)
  git add -A
  GIT_AUTHOR_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_AUTHOR_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_AUTHOR_DATE="$instante" \
  GIT_COMMITTER_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_COMMITTER_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_COMMITTER_DATE="$instante" \
    git commit -q -m "$mensaje"
}

# Confirmacion de union, con los dos padres que correspondan.
semilla_fusionar() {
  local rama=$1 mensaje=$2 instante
  instante=$(semilla_instante)
  GIT_AUTHOR_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_AUTHOR_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_AUTHOR_DATE="$instante" \
  GIT_COMMITTER_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_COMMITTER_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_COMMITTER_DATE="$instante" \
    git merge -q --no-ff -m "$mensaje" "$rama"
}

# Etiqueta anotada: es un objeto propio dentro de la carpeta oculta, con su
# identificador, su etiquetador y su mensaje. La fecha va fijada como la de
# las confirmaciones, porque tambien entra en el identificador del objeto.
semilla_etiquetar_anotado() {
  local nombre=$1 mensaje=$2 instante
  instante=$(semilla_instante)
  GIT_COMMITTER_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_COMMITTER_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_COMMITTER_DATE="$instante" \
  GIT_AUTHOR_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_AUTHOR_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_AUTHOR_DATE="$instante" \
    git tag -a "$nombre" -m "$mensaje"
}

semilla_etiquetar() {
  local nombre=$1 instante
  instante=$(semilla_instante)
  GIT_COMMITTER_NAME="$SEMILLA_AUTOR_NOMBRE" \
  GIT_COMMITTER_EMAIL="$SEMILLA_AUTOR_CORREO" \
  GIT_COMMITTER_DATE="$instante" \
    git tag "$nombre"
}

# Crea una rama y se cambia a ella.
semilla_rama() {
  git switch -q -c "$1" "${2:-HEAD}"
}

semilla_cambiar() {
  git switch -q "$1"
}

# Empaqueta el repositorio completo en un archivo unico (punto 5.1).
semilla_empaquetar() {
  local destino=$1
  mkdir -p "$(dirname "$destino")"
  rm -f "$destino"
  git bundle create "$destino" --all HEAD > /dev/null 2>&1 ||
    semilla_fallar "no se pudo crear el paquete $destino"
  git bundle verify "$destino" > /dev/null 2>&1 ||
    semilla_fallar "el paquete $destino quedo invalido"
}
