# El modo real en msedge sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: msedge 152.0.4191.66
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 861 ms
IGUAL    ramas          conectado y dibujado en 857 ms
IGUAL    empaquetado    conectado y dibujado en 781 ms
IGUAL    deltas         conectado y dibujado en 850 ms
IGUAL    desde-bundle   conectado y dibujado en 833 ms
IGUAL    desconectada   conectado y dibujado en 816 ms
IGUAL    empates        conectado y dibujado en 689 ms
IGUAL    estados        conectado y dibujado en 843 ms
IGUAL    conflicto      conectado y dibujado en 771 ms
IGUAL    completo       conectado y dibujado en 1118 ms
IGUAL    clonado        conectado y dibujado en 787 ms
IGUAL    latin          conectado y dibujado en 658 ms
IGUAL    indice4        conectado y dibujado en 685 ms
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 277 ms, media 192 ms
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 623 ms, media 497 ms
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 560 ms, media 163 ms
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 431 ms, media 284 ms
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 372 ms, media 179 ms
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 428 ms, media 216 ms
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 371 ms, media 184 ms
```

- preparar.sh fallo con el repositorio armado: laboratorio 02: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-02/recetario /       encontro: la carpeta existe pero no es un repositorio /   ✗ cantidad de confirmaciones /       esperaba: 5 /       encontro: no se pudo comprobar, no hay repositorio /   ✗ la quinta confirma
- preparar.sh fallo con el repositorio armado: laboratorio 03: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-03/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 04: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-04/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 05: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-05/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 06: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-06/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 07: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-07/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 08: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-08/recetario /       encontro: la carpeta existe pero no es un repositorio

RESULTADO: todo igual
