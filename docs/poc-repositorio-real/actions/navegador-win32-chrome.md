# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 152.0.7977.83
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 897 ms
DISTINTO ramas          conectado y dibujado en 1203 ms · trabajo: pagina [], git ["criolla.md:modificado"]
DISTINTO empaquetado    conectado y dibujado en 873 ms · trabajo: pagina [], git ["azteca.md:modificado","criolla.md:modificado","tailandesa.md:modificado"]
IGUAL    deltas         conectado y dibujado en 864 ms
DISTINTO desde-bundle   conectado y dibujado en 824 ms · trabajo: pagina [], git ["a.md:modificado","azteca.md:modificado","criolla.md:modificado","tailandesa.md:modificado"]
DISTINTO desconectada   conectado y dibujado en 817 ms · trabajo: pagina [], git ["tailandesa.md:modificado"]
DISTINTO empates        conectado y dibujado en 721 ms · trabajo: pagina [], git ["b:modificado"]
IGUAL    estados        conectado y dibujado en 830 ms
IGUAL    conflicto      conectado y dibujado en 703 ms
DISTINTO completo       conectado y dibujado en 771 ms · trabajo: pagina [], git ["a:modificado"]
DISTINTO clonado        conectado y dibujado en 719 ms · trabajo: pagina [], git ["a:modificado"]
IGUAL    latin          conectado y dibujado en 671 ms
IGUAL    indice4        conectado y dibujado en 692 ms
```

RESULTADO: 7 diferencia(s)
