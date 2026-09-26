#!/usr/bin/env python3
"""
Ver fallar la prueba de la interfaz (taller-java/interfaz.test.ts, SPEC 028).

Cada mutacion mete en el motor de Python una diferencia con el de Java, corre
la prueba y deja todo como estaba. Uso, desde simulador:
python3 taller-java/mutaciones-interfaz.py
"""
import pathlib
import subprocess
import sys

SIM = pathlib.Path(__file__).resolve().parents[1]
PY = SIM.parent / "taller" / "python" / "taller.py"

MUTACIONES = [
    ('        self.send_header("Referrer-Policy", "no-referrer")\n', "", "sin Referrer-Policy"),
    ('"desnudo" if "desnudo" in s else "fuera"', '"fuera"', "un repositorio desnudo dicho como fuera"),
    ('etiquetas.append({"nombre": nombre[10:], "id": ident, "anotada": anotada})',
     'etiquetas.append({"nombre": nombre[10:], "id": ident, "anotada": True})', "toda etiqueta anotada"),
    ('self._json(409, {"ocupado": True, "enCurso": en_curso,', 'self._json(409, {"ocupado": True, "enCurso": "",',
     "el 409 sin la orden en curso"),
    ('"relativa": relativa(self.limite, donde),', '"relativa": con_barras(donde),', "la carpeta relativa absoluta"),
    ('if "chunked" in self.headers.get("Transfer-Encoding", "").lower():', "if False:",
     "el cuerpo por partes no se lee"),
]


def main() -> int:
    texto = PY.read_text(encoding="utf-8")
    escapadas = 0
    for original, mutado, que in MUTACIONES:
        assert original in texto, que
        try:
            PY.write_text(texto.replace(original, mutado, 1), encoding="utf-8")
            r = subprocess.run(["npx", "vitest", "run", "--config", "vitest.taller-java.config.ts",
                                "taller-java/interfaz.test.ts"], cwd=SIM, capture_output=True, text=True)
        finally:
            PY.write_text(texto, encoding="utf-8")
        if r.returncode == 0:
            escapadas += 1
            print(f"  ✗  la interfaz no atrapo: {que}")
        else:
            print(f"  ✓  la interfaz atrapo: {que}")
    return 1 if escapadas else 0


if __name__ == "__main__":
    sys.exit(main())
