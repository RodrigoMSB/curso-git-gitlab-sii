# Las areas leidas del repositorio real, contra git status

Generado por `simulador/tests/real/laboratorios.test.ts` (SPEC 020, CA2).
Cada laboratorio se recorre en Git; despues de cada orden se compara lo
que el lector pone en las areas con `git status --porcelain`.

| laboratorio | ordenes | areas iguales | distintas | lectura media (ms) | lectura maxima (ms) |
|---|---|---|---|---|---|
| 02 | 52 | 52 | 0 | 2.8 | 11.0 |
| 03 | 66 | 66 | 0 | 2.6 | 10.7 |
| 04 | 85 | 85 | 0 | 2.5 | 8.7 |
| 05 | 55 | 55 | 0 | 2.4 | 5.9 |
| 06 | 51 | 51 | 0 | 2.2 | 6.9 |
| 07 | 75 | 75 | 0 | 1.9 | 3.2 |
| 08 | 54 | 54 | 0 | 2.0 | 5.6 |

Ordenes que no se ejecutaron:

- Laboratorio 07, linea 474 «git add <archivo>»: seccion de rescate, lleva un marcador de posicion que el participante reemplaza a mano.
- Laboratorio 07, linea 498 «git stash apply <identificador>»: seccion de rescate, lleva un marcador de posicion que el participante reemplaza a mano.
