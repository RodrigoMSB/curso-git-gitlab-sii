# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 153.0.8010.53
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 924 ms
IGUAL    ramas          conectado y dibujado en 1121 ms
IGUAL    empaquetado    conectado y dibujado en 822 ms
IGUAL    deltas         conectado y dibujado en 906 ms
IGUAL    desde-bundle   conectado y dibujado en 852 ms
IGUAL    desconectada   conectado y dibujado en 839 ms
IGUAL    empates        conectado y dibujado en 745 ms
IGUAL    estados        conectado y dibujado en 890 ms
IGUAL    conflicto      conectado y dibujado en 727 ms
IGUAL    completo       conectado y dibujado en 769 ms
IGUAL    clonado        conectado y dibujado en 775 ms
IGUAL    latin          conectado y dibujado en 659 ms
IGUAL    indice4        conectado y dibujado en 685 ms
```

RESULTADO: todo igual
