# El modo real en msedge sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: msedge 153.0.4234.48
- Huella SHA-256 de SIMULADOR.html: 4922e81eadc3af557815922f8a9916d4b613bd83d6382b5956d59bc54053759a
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge.»
IGUAL    lineal         conectado y dibujado en 713 ms
DISTINTO ramas          conectado y dibujado en 866 ms · trabajo: pagina [], git ["azteca.md:modificado","criolla.md:modificado","tailandesa.md:modificado"]
DISTINTO empaquetado    conectado y dibujado en 667 ms · trabajo: pagina [], git ["azteca.md:modificado","criolla.md:modificado","tailandesa.md:modificado"]
IGUAL    deltas         conectado y dibujado en 731 ms
DISTINTO desde-bundle   conectado y dibujado en 695 ms · trabajo: pagina [], git ["a.md:modificado","azteca.md:modificado","criolla.md:modificado","tailandesa.md:modificado"]
DISTINTO desconectada   conectado y dibujado en 669 ms · trabajo: pagina [], git ["tailandesa.md:modificado"]
DISTINTO empates        conectado y dibujado en 620 ms · trabajo: pagina [], git ["b:modificado"]
IGUAL    estados        conectado y dibujado en 720 ms
IGUAL    conflicto      conectado y dibujado en 635 ms
DISTINTO completo       conectado y dibujado en 706 ms · trabajo: pagina [], git ["a:modificado"]
DISTINTO clonado        conectado y dibujado en 646 ms · trabajo: pagina [], git ["a:modificado"]
IGUAL    latin          conectado y dibujado en 615 ms
IGUAL    indice4        conectado y dibujado en 618 ms
```

RESULTADO: 7 diferencia(s)
