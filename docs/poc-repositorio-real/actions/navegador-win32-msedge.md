# El modo real en msedge sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: msedge 152.0.4191.66
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 825 ms
IGUAL    ramas          conectado y dibujado en 817 ms
IGUAL    empaquetado    conectado y dibujado en 734 ms
IGUAL    deltas         conectado y dibujado en 803 ms
IGUAL    desde-bundle   conectado y dibujado en 775 ms
IGUAL    desconectada   conectado y dibujado en 757 ms
IGUAL    empates        conectado y dibujado en 662 ms
IGUAL    estados        conectado y dibujado en 780 ms
IGUAL    conflicto      conectado y dibujado en 658 ms
IGUAL    completo       conectado y dibujado en 685 ms
IGUAL    clonado        conectado y dibujado en 695 ms
IGUAL    latin          conectado y dibujado en 631 ms
IGUAL    indice4        conectado y dibujado en 658 ms
```

RESULTADO: todo igual
