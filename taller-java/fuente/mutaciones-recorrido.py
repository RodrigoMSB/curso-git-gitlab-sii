#!/usr/bin/env python3
"""
Ver fallar el recorrido de punta a punta (seccion 7 del SPEC 026).

Mete un defecto en la pagina o en el programa, reconstruye, corre el
laboratorio 02 y deja todo como estaba. Si el recorrido pasa con el defecto
puesto, no esta comprobando lo que dice.

Uso, desde la raiz del clon:  python3 taller-java/fuente/mutaciones-recorrido.py
"""
import os
import pathlib
import shutil
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parents[2]
SIM = RAIZ / "simulador"
FUENTE = RAIZ / "taller-java" / "fuente"

MUTACIONES = [
    ("pagina", SIM / "src/vista/modoTaller.ts",
     "const confirmaciones = [...estado.confirmaciones].reverse().map((c) => ({",
     "const confirmaciones = [...estado.confirmaciones].filter((c) => !c.huerfana).reverse().map((c) => ({",
     "la pagina no dibuja las huerfanas"),
    ("pagina", SIM / "src/vista/modoTaller.ts",
     "    ...error,\n    ...avisos,",
     "    ...error.slice(0, 0),\n    ...avisos,",
     "la consola se come el error estandar"),
    ("programa", FUENTE / "src/main/java/taller/LectorEstado.java",
     'conRegistro.addAll(new java.util.LinkedHashSet<>(registro));',
     '',
     "el programa no lee el registro de HEAD"),
    ("programa", FUENTE / "src/main/java/taller/LectorEstado.java",
     'conf.put("huerfana", !vivas.contains((String) conf.get("id")));',
     'conf.put("huerfana", false);',
     "el programa no marca huerfanas, y el contador de confirmaciones las suma"),
    ("pagina", SIM / "src/ui/Consola.tsx",
     "      if (pegadoAlFinal.current) caja.scrollTop = caja.scrollHeight;\n    });",
     "    });",
     "la consola no vuelve a bajar cuando se achica", "01"),
    ("pagina", SIM / "src/vista/modoTaller.ts",
     "...arbolVisible(estado.arbol ?? []),", "...arbolVisible([]),", "el area del repositorio sin archivos"),
    ("pagina", SIM / "src/vista/contar.ts",
     "n === 1 ? singular : plural", "n === -1 ? singular : plural", "un contador en plural con uno"),
]


def construir(lado: str) -> None:
    if lado == "pagina":
        subprocess.run(["npm", "run", "build"], cwd=SIM, check=True, capture_output=True)
    else:
        subprocess.run(["./mvnw", "-q", "-B", "package", "-DskipTests"], cwd=FUENTE, check=True, capture_output=True)
        shutil.copy(FUENTE / "target/taller.jar", RAIZ / "taller-java/taller.jar")


def main() -> int:
    escapadas = 0
    entorno = {**os.environ, "TALLER_LABS": "02", "TALLER_CAPTURAS": str(SIM / "capturas-mutacion")}
    for mutacion in MUTACIONES:
        lado, ruta, original, mutado, que = mutacion[:5]
        lab = mutacion[5] if len(mutacion) > 5 else "02"
        entorno = {**entorno, "TALLER_LABS": lab}
        texto = ruta.read_text(encoding="utf-8")
        assert original in texto, que
        try:
            ruta.write_text(texto.replace(original, mutado, 1), encoding="utf-8")
            try:
                construir(lado)
            except subprocess.CalledProcessError:
                print(f"  ?  {que}: la mutacion no compila, no prueba nada")
                escapadas += 1
                continue
            r = subprocess.run(["npx", "vitest", "run", "--config", "vitest.taller-java.config.ts", "-t", f"laboratorio {lab}"],
                               cwd=SIM, env=entorno, capture_output=True, text=True)
        finally:
            ruta.write_text(texto, encoding="utf-8")
            construir(lado)
        if r.returncode == 0:
            escapadas += 1
            print(f"  ✗  el recorrido no atrapo: {que}")
        else:
            print(f"  ✓  el recorrido atrapo: {que}")
    shutil.rmtree(SIM / "capturas-mutacion", ignore_errors=True)
    return 1 if escapadas else 0


if __name__ == "__main__":
    sys.exit(main())
