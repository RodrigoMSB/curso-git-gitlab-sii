#!/usr/bin/env bash
# El motor de Python tiene treinta segundos para responder, como el de Java, y
# mientras espera la ventana lo dice (SPEC 029).
#
# Arma un taller sin el jar, para que la cascada vaya directo a Python, y pone
# primero en el PATH un python3 de mentira que tarda ocho segundos antes de
# arrancar el de verdad, como un primer arranque revisado por el antivirus. Con
# los cinco segundos de antes, la cascada lo cerraba y abria el respaldo.
#
# Solo Mac y Linux: en Windows el arrancador prueba antes py -3.
#
# Desde la raiz del clon:  bash taller/probar-espera-python.sh
set -eu

CLON=$(cd "$(dirname "$0")/.." && pwd -P)
REAL=$(command -v python3)
BASE=$(mktemp -d)
RAIZ="$BASE/taller-git"
mkdir -p "$RAIZ/curso/taller" "$BASE/falso"
PID=''
trap '[ -n "$PID" ] && kill "$PID" 2>/dev/null; wait 2>/dev/null; rm -rf "$BASE"' EXIT

cp "$CLON/SIMULADOR.html" "$RAIZ/curso/"
cp -R "$CLON/labs" "$RAIZ/curso/labs"
for archivo in arrancar.sh laboratorio.sh; do cp "$CLON/taller/$archivo" "$RAIZ/curso/taller/"; done
mkdir -p "$RAIZ/curso/taller/python"
cp "$CLON/taller/python/taller.py" "$RAIZ/curso/taller/python/"

cat > "$BASE/falso/python3" <<FALSO
#!/usr/bin/env bash
# La pregunta por la version se contesta enseguida; el arranque tarda.
case "\${1:-}" in -c) exec "$REAL" "\$@" ;; esac
sleep 8
exec "$REAL" "\$@"
FALSO
chmod +x "$BASE/falso/python3"

LOG="$BASE/arrancador.log"
INICIO=$(date +%s)
PATH="$BASE/falso:$PATH" TALLER_SIN_NAVEGADOR=1 bash "$RAIZ/curso/taller/arrancar.sh" > "$LOG" 2>&1 &
PID=$!
for _ in $(seq 1 180); do
  grep -q 'Motor del taller' "$LOG" 2>/dev/null && break
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.25
done
DEMORA=$(( $(date +%s) - INICIO ))
cat "$LOG"

falla() { echo "FALLA  $*"; exit 1; }
grep -q 'Motor del taller: Python.' "$LOG" || falla "con un Python que tarda ocho segundos, la cascada no quedo con el motor de Python"
[ "$DEMORA" -ge 8 ] || falla "arranco en $DEMORA s: el python3 de mentira no se uso"
# El aviso va antes de esperar a Python, despues de decir que se prueba.
PRUEBA=$(grep -n 'Se prueba el de Python' "$LOG" | head -1 | cut -d: -f1)
AVISO=$(grep -n 'El taller está arrancando. La primera vez puede tardar' "$LOG" | tail -1 | cut -d: -f1)
[ -n "$PRUEBA" ] && [ -n "$AVISO" ] && [ "$AVISO" -gt "$PRUEBA" ] || falla "mientras espera a Python, la ventana no dijo que el taller esta arrancando"
echo "BIEN   el motor de Python tardo $DEMORA s y la cascada lo espero, con el aviso en la ventana"
