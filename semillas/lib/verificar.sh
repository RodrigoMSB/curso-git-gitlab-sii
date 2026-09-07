#!/usr/bin/env bash
# Biblioteca de los verificadores de estado inicial (seccion 6 del SPEC 003).
#
# Un verificador compara lo que el enunciado supone contra lo que la semilla
# dejo. Cuando algo no calza, dice que esperaba y que encontro: una semilla
# mal armada descubierta en clase cuesta el bloque completo (punto 6.2).

VERIFICADOR_FALLAS=0
VERIFICADOR_SEMILLA=''
VERIFICADOR_REPOSITORIO=''

v_iniciar() {
  VERIFICADOR_SEMILLA=$1
  VERIFICADOR_REPOSITORIO=$2
  VERIFICADOR_FALLAS=0

  [ -d "$VERIFICADOR_REPOSITORIO" ] ||
    v_abortar "no existe el repositorio $VERIFICADOR_REPOSITORIO"
  [ -d "$VERIFICADOR_REPOSITORIO/.git" ] ||
    v_abortar "$VERIFICADOR_REPOSITORIO no es un repositorio Git"
  cd "$VERIFICADOR_REPOSITORIO" || v_abortar "no se pudo entrar al repositorio"
}

v_abortar() {
  echo "verificador $VERIFICADOR_SEMILLA: $*" >&2
  exit 1
}

# Comparacion basica. Todo lo demas se construye sobre esta.
v_esperar() {
  local que=$1 esperado=$2 obtenido=$3
  if [ "$esperado" != "$obtenido" ]; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ $que" >&2
    echo "      esperaba: $esperado" >&2
    echo "      encontro: $obtenido" >&2
  fi
}

v_cantidad_de_confirmaciones() {
  v_esperar 'cantidad de confirmaciones' "$1" "$(git rev-list --count HEAD)"
}

# Los mensajes en orden, de la mas antigua a la mas reciente, separados por
# barras verticales. Comprobar el orden y no solo la cantidad es lo que detecta
# una historia reconstruida al reves.
v_mensajes() {
  local esperado=$1 obtenido
  obtenido=$(git log --reverse --format=%s | paste -sd '|' -)
  v_esperar 'mensajes de la historia' "$esperado" "$obtenido"
}

v_ramas() {
  local esperado=$1 obtenido
  obtenido=$(git for-each-ref --format='%(refname:short)' refs/heads | sort | paste -sd ' ' -)
  v_esperar 'ramas del repositorio' "$esperado" "$obtenido"
}

# A que confirmacion apunta una rama, dicha por el mensaje de esa confirmacion,
# que es mas legible en el error que un identificador.
v_rama_apunta_a() {
  local rama=$1 mensaje=$2 obtenido
  obtenido=$(git log -1 --format=%s "$rama" 2>/dev/null) ||
    obtenido='(la rama no existe)'
  v_esperar "la rama $rama apunta a" "$mensaje" "$obtenido"
}

v_posicion() {
  v_esperar 'rama actual' "$1" "$(git branch --show-current)"
}

# Estado del directorio de trabajo, en el formato corto de Git. Se pasa vacio
# para exigir que no haya nada pendiente.
v_estado_de_trabajo() {
  local esperado=$1 obtenido
  obtenido=$(git status --porcelain | sort | paste -sd '|' -)
  v_esperar 'estado del directorio de trabajo' "$esperado" "$obtenido"
}

v_archivo_seguido() {
  local ruta=$1
  if ! git ls-files --error-unmatch "$ruta" > /dev/null 2>&1; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ $ruta deberia estar bajo seguimiento y no lo esta" >&2
  fi
}

v_archivo_ausente() {
  local ruta=$1
  if [ -e "$ruta" ]; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ $ruta no deberia existir y existe" >&2
  fi
}

v_archivo_presente() {
  local ruta=$1
  if [ ! -e "$ruta" ]; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ falta el archivo $ruta" >&2
  fi
}

# Que el archivo este en la historia confirmada, no solo en el disco. Es la
# diferencia entre ignorar un archivo y sacarlo del seguimiento (criterio CA8).
v_archivo_en_la_historia() {
  local ruta=$1
  if [ -z "$(git log --format=%H -1 -- "$ruta")" ]; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ $ruta deberia estar en la historia confirmada y no aparece" >&2
  fi
}

v_contiene() {
  local ruta=$1 texto=$2
  if ! grep -q -- "$texto" "$ruta" 2>/dev/null; then
    VERIFICADOR_FALLAS=$((VERIFICADOR_FALLAS + 1))
    echo "  ✗ $ruta deberia contener «$texto»" >&2
  fi
}

v_remotos() {
  local esperado=$1 obtenido
  obtenido=$(git remote | sort | paste -sd ' ' -)
  v_esperar 'remotos configurados' "$esperado" "$obtenido"
}

v_guardados() {
  v_esperar 'entradas en el guardado temporal' "$1" "$(git stash list | wc -l | tr -d ' ')"
}

v_terminar() {
  if [ "$VERIFICADOR_FALLAS" -gt 0 ]; then
    echo "verificador $VERIFICADOR_SEMILLA: $VERIFICADOR_FALLAS comprobacion(es) fallaron" >&2
    exit 1
  fi
  echo "  semilla $VERIFICADOR_SEMILLA verificada"
}
