#!/usr/bin/env python3
"""
Ver fallar taller/probar-instalacion.sh (SPEC 028).

Mete un defecto en la instalacion, en el arrancador o en preparar, corre la
prueba con el motor que corresponde y deja todo como estaba. Si la prueba pasa
con el defecto puesto, no esta comprobando lo que dice.

Uso, desde la raiz del clon:  python3 taller/mutaciones-instalacion.py
"""
import os
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[1]
INSTALAR = RAIZ / "instalar.command"
ARRANCAR = RAIZ / "taller" / "arrancar.sh"
LABORATORIO = RAIZ / "taller" / "laboratorio.sh"

MUTACIONES = [
    (INSTALAR, "comprobar.sh preparar verificar; do", "comprobar.sh preparar; do",
     "la instalacion no copia verificar", "java"),
    (ARRANCAR, 'intentar Java "$ESPERA_JAVA" "$JAVA"', 'false "$ESPERA_JAVA" "$JAVA"',
     "el arrancador no prueba Java", "java"),
    (ARRANCAR, 'intentar Python "$ESPERA" $PYTHON', 'false "$ESPERA" $PYTHON',
     "la cascada no llega a Python", "python"),
    (ARRANCAR, "  exit 3\nfi", "  exit 0\nfi",
     "el respaldo sale como si el taller hubiera arrancado", "respaldo"),
    (ARRANCAR, '  decir "ATENCIÓN. El taller no pudo arrancar', '  decir "El taller no pudo arrancar',
     "el respaldo sin ATENCIÓN", "respaldo"),
    (ARRANCAR, 'echo "$MOTOR" > "$PROPIA/motor"', 'echo Java > "$PROPIA/motor"',
     "el arrancador anota Java aunque corra Python", "python"),
    (LABORATORIO, 'printf \'%s\' "$REPOSITORIO" > "$TALLER_CD_DESPUES"', "true",
     "preparar no deja la consola en el laboratorio", "python"),
]


def main() -> int:
    escapadas = 0
    for ruta, original, mutado, que, motor in MUTACIONES:
        texto = ruta.read_text(encoding="utf-8")
        assert original in texto, que
        try:
            ruta.write_text(texto.replace(original, mutado, 1), encoding="utf-8")
            r = subprocess.run(["bash", str(RAIZ / "taller" / "probar-instalacion.sh")], cwd=RAIZ,
                               env={**os.environ, "MOTOR": motor}, capture_output=True, text=True)
        finally:
            ruta.write_text(texto, encoding="utf-8")
        if r.returncode == 0:
            escapadas += 1
            print(f"  ✗  la instalacion con {motor} no atrapo: {que}")
        else:
            falla = next((l for l in r.stdout.splitlines() if l.startswith("FALLA")), "sin linea FALLA")
            print(f"  ✓  la instalacion con {motor} atrapo: {que}  ({falla})")
    return 1 if escapadas else 0


if __name__ == "__main__":
    sys.exit(main())
