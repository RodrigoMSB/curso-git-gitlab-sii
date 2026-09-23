# Las areas leidas del repositorio real, contra git status

Generado por `simulador/tests/real/laboratorios.test.ts` (SPEC 020, CA2).
Cada laboratorio se recorre en Git; despues de cada orden se compara lo
que el lector pone en las areas con `git status --porcelain`.

| laboratorio | ordenes | areas iguales | distintas | lectura media (ms) | lectura maxima (ms) |
|---|---|---|---|---|---|
| 02 | 52 | 52 | 0 | 1.5 | 2.2 |
| 03 | 66 | 66 | 0 | 1.4 | 2.0 |
| 04 | 85 | 85 | 0 | 1.4 | 1.7 |
| 05 | 55 | 55 | 0 | 1.4 | 2.0 |
| 06 | 51 | 51 | 0 | 1.3 | 2.1 |
| 07 | 75 | 75 | 0 | 1.4 | 2.1 |
| 08 | 54 | 54 | 0 | 1.4 | 2.0 |

Ordenes que no se ejecutaron:

- Laboratorio 07, linea 472 «git add <archivo>»: seccion de rescate, lleva un marcador de posicion que el participante reemplaza a mano.
- Laboratorio 07, linea 496 «git stash apply <identificador>»: seccion de rescate, lleva un marcador de posicion que el participante reemplaza a mano.
