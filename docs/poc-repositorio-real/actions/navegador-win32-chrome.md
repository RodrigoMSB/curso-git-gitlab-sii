# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 152.0.7977.83
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 923 ms
IGUAL    ramas          conectado y dibujado en 917 ms
IGUAL    empaquetado    conectado y dibujado en 807 ms
IGUAL    deltas         conectado y dibujado en 932 ms
IGUAL    desde-bundle   conectado y dibujado en 856 ms
IGUAL    desconectada   conectado y dibujado en 912 ms
IGUAL    empates        conectado y dibujado en 730 ms
IGUAL    estados        conectado y dibujado en 883 ms
IGUAL    conflicto      conectado y dibujado en 751 ms
IGUAL    completo       conectado y dibujado en 799 ms
IGUAL    clonado        conectado y dibujado en 769 ms
IGUAL    latin          conectado y dibujado en 679 ms
IGUAL    indice4        conectado y dibujado en 702 ms
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 681 ms, media 429 ms
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 610 ms, media 443 ms
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 552 ms, media 165 ms
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 453 ms, media 299 ms
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 371 ms, media 189 ms
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 376 ms, media 162 ms
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 340 ms, media 179 ms
```

- preparar.sh fallo con el repositorio armado: laboratorio 02: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-02/recetario /       encontro: la carpeta existe pero no es un repositorio /   ✗ cantidad de confirmaciones /       esperaba: 5 /       encontro: no se pudo comprobar, no hay repositorio /   ✗ la quinta confirma
- preparar.sh fallo con el repositorio armado: laboratorio 03: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-03/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 04: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-04/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 05: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-05/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 06: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-06/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 07: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-07/recetario /       encontro: la carpeta existe pero no es un repositorio
- preparar.sh fallo con el repositorio armado: laboratorio 08: preparar.sh termino con 1, con el repositorio armado —   ✗ existe el repositorio /       esperaba: un repositorio Git en taller-git-trabajo/lab-08/recetario /       encontro: la carpeta existe pero no es un repositorio

RESULTADO: todo igual
