#!/usr/bin/env python3
"""
Ver fallar las pruebas del modelo del modo taller (tests/modo-taller.test.ts).

Cada mutacion mete un defecto en src/vista, corre la prueba y deja todo como
estaba. Uso, desde simulador:  python3 taller-java/mutaciones-modelo.py
"""
import pathlib
import subprocess
import sys

SIM = pathlib.Path(__file__).resolve().parents[1]
MT = 'src/vista/modoTaller.ts'
OC = 'src/vista/ordenesConocidas.ts'
CO = 'src/vista/contar.ts'

MUTACIONES = [
    (MT, "const confirmaciones = [...estado.confirmaciones].reverse().map", "const confirmaciones = [...estado.confirmaciones].map", "el orden de creacion"),
    (MT, "color: fallo ? 'error' : 'normal',", "color: 'error',", "el error estandar siempre en rojo"),
    (MT, "if (direccion.protocol !== 'http:' || direccion.hostname !== '127.0.0.1') return null;", "", "el modo taller desde file://"),
    (MT, "tono: e.tipo === 'D' ? ('borrado-preparado' as const) : ('preparado' as const),", "tono: 'preparado' as const,", "el borrado preparado"),
    (MT, "const vivas = estado.confirmaciones.filter((c) => !c.huerfana).length;", "const vivas = estado.confirmaciones.length;", "las huerfanas contadas"),
    (MT, "{ clave: `${prefijo}:orden`, texto: orden, color: 'orden', indicador, propia: esOrdenPropia(orden) },", "{ clave: `${prefijo}:orden`, texto: orden, color: 'orden', propia: esOrdenPropia(orden) },", "el eco sin su indicador"),
    (MT, "const deGit = /^\\s*git\\s/.test(orden);", "const deGit = true;", "la salida de ls con colores de Git"),
    (MT, "const visibles = arbol.slice(0, ARCHIVOS_DEL_ARBOL)", "const visibles = arbol.slice(0, 40)", "el arbol sin tope"),
    (MT, "...arbolVisible(estado.arbol ?? []),", "", "el area del repositorio sin archivos"),
    (MT, "propia: esOrdenPropia(orden) },", "propia: false },", "preparar sin la marca de orden propia"),
    (MT, "            color: 'programa',\n          },\n        ];", "            color: 'normal',\n          },\n        ];", "el aviso de dos ordenes con el color de Git"),
    (CO, "n === 1 ? singular : plural", "n === 0 ? singular : plural", "el singular"),
    (OC, "const desde = primera.texto !== 'git' ? 1 : CON_SUBORDENES.includes(sub) ? 3 : 2;", "const desde = 1;", "git diff tomado por dos ordenes"),
    (OC, "CON_SUBORDENES.includes(sub) ? 3 : 2;", "false ? 3 : 2;", "git stash clear tomado por dos ordenes"),
    (OC, "(p) => !p.citada && ORDENES_CONOCIDAS", "(p) => ORDENES_CONOCIDAS", "lo que va entre comillas tomado por orden"),
    (OC, "if (';&|\\n()`'.includes(c) || (c === '$' && linea[i + 1] === '(')) return null;", "", "ordenes bien separadas tomadas por pegadas"),
    (OC, "  '  clear                  limpia la consola',\n", "", "ayuda sin clear"),
]


def main() -> int:
    escapadas = 0
    for archivo, original, mutado, que in MUTACIONES:
        ruta = SIM / archivo
        texto = ruta.read_text(encoding='utf-8')
        if original not in texto:
            print(f'  ?  {que}: el texto a mutar ya no esta')
            escapadas += 1
            continue
        try:
            ruta.write_text(texto.replace(original, mutado, 1), encoding='utf-8')
            r = subprocess.run(['npx', 'vitest', 'run', 'tests/modo-taller.test.ts'], cwd=SIM, capture_output=True, text=True)
        finally:
            ruta.write_text(texto, encoding='utf-8')
        if r.returncode == 0:
            escapadas += 1
            print(f'  ✗  no atrapo: {que}')
        else:
            print(f'  ✓  atrapo: {que}')
    print(f'\n  {len(MUTACIONES) - escapadas} de {len(MUTACIONES)} mutaciones atrapadas')
    return 1 if escapadas else 0


if __name__ == '__main__':
    sys.exit(main())
