# El modo real en msedge sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: msedge 152.0.4191.66
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 923 ms
IGUAL    ramas          conectado y dibujado en 904 ms
IGUAL    empaquetado    conectado y dibujado en 784 ms
IGUAL    deltas         conectado y dibujado en 891 ms
IGUAL    desde-bundle   conectado y dibujado en 944 ms
IGUAL    desconectada   conectado y dibujado en 840 ms
IGUAL    empates        conectado y dibujado en 716 ms
IGUAL    estados        conectado y dibujado en 884 ms
IGUAL    conflicto      conectado y dibujado en 741 ms
IGUAL    completo       conectado y dibujado en 802 ms
IGUAL    clonado        conectado y dibujado en 772 ms
IGUAL    latin          conectado y dibujado en 674 ms
IGUAL    indice4        conectado y dibujado en 694 ms
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 368 ms, media 246 ms
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 806 ms, media 675 ms
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 353 ms, media 142 ms
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 434 ms, media 316 ms
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 352 ms, media 168 ms
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 395 ms, media 201 ms
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 373 ms, media 186 ms
```

- preparar.sh fallo con el repositorio armado: laboratorio 02: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-02/recetario /       encontro: la carpeta existe pero no es un repositorio /   ✗ cantidad de confirmaciones /       esperaba: 5 /       encontro: no se pudo comprobar, no hay repositorio /   ✗ la quinta confirma
- preparar.sh fallo con el repositorio armado: laboratorio 03: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-03/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 04: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-04/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 05: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-05/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 06: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-06/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 07: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-07/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 08: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-08/recetario /       encontro: la carpeta existe pero no es un repositorio

RESULTADO: todo igual
