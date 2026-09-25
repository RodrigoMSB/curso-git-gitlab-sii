# El modo real en chrome sobre darwin

- Sistema: darwin · Git: git version 2.55.0 · Navegador: chrome 152.0.7977.83
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 1674 ms
IGUAL    ramas          conectado y dibujado en 546 ms
IGUAL    empaquetado    conectado y dibujado en 489 ms
IGUAL    deltas         conectado y dibujado en 662 ms
IGUAL    desde-bundle   conectado y dibujado en 748 ms
IGUAL    desconectada   conectado y dibujado en 538 ms
IGUAL    empates        conectado y dibujado en 553 ms
IGUAL    estados        conectado y dibujado en 777 ms
IGUAL    conflicto      conectado y dibujado en 429 ms
IGUAL    completo       conectado y dibujado en 523 ms
IGUAL    clonado        conectado y dibujado en 625 ms
IGUAL    latin          conectado y dibujado en 475 ms
IGUAL    indice4        conectado y dibujado en 442 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":19.9}; la ultima lectura {"referencias":9.6,"historia":9.8,"areas":7.4,"total":30.5,"motor":11.8}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 258 ms, media 160 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":16.6}; la ultima lectura {"referencias":11.2,"historia":12.1,"areas":14.7,"total":41.8,"motor":26.3}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 279 ms, media 259 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":21.6}; la ultima lectura {"referencias":20.3,"historia":15.8,"areas":9.8,"total":50.1,"motor":29.6}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 294 ms, media 108 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":19.3}; la ultima lectura {"referencias":11.3,"historia":17.4,"areas":9.1,"total":41.5,"motor":31.1}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 279 ms, media 217 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":20.8}; la ultima lectura {"referencias":15.3,"historia":14,"areas":8.6,"total":41.5,"motor":17.4}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 250 ms, media 123 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":19}; la ultima lectura {"referencias":11.3,"historia":21.8,"areas":10.1,"total":47.4,"motor":36.2}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 263 ms, media 119 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":22.7}; la ultima lectura {"referencias":18.2,"historia":13.7,"areas":9.5,"total":45,"motor":19.5}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 216 ms, media 112 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":12.9,"historia":9.8,"areas":9.2,"total":36.9,"motor":14.4}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 280 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":11.7,"historia":8.6,"areas":9.1,"total":34.2,"motor":13}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 244 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":8.9,"historia":7,"areas":7.1,"total":26.6,"motor":13.1}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 238 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":7.4,"historia":6.1,"areas":7.7,"total":24.3,"motor":14.8}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 246 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":12.9}
MEDIDA   SPEC 024 · demoras de los archivos: 280, 244, 238, 246 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 241 ms
IGUAL    SPEC 024 · despues de git init el indicador dice «recetario · leyendo en vivo»
IGUAL    lab 01 · antes de git init el indicador dice «recetario · en vivo, todavía sin repositorio»
IGUAL    lab 01 · desde la carpeta vacia: 54 de 54 ordenes iguales
IGUAL    lab 01 · la carpeta se eligio 1 vez/veces
IGUAL    SPEC 024 · SecurityError: el boton dice «Este equipo no permite que el navegador abra carpetas (lo bloquea una política o un permiso). Los escenarios siguen funcionando.»
IGUAL    SPEC 024 · SecurityError: el escenario sigue ejecutando ordenes
IGUAL    SPEC 024 · SecurityError: sin errores en la pagina []
IGUAL    SPEC 024 · NotAllowedError: el boton dice «Este equipo no permite que el navegador abra carpetas (lo bloquea una política o un permiso). Los escenarios siguen funcionando.»
IGUAL    SPEC 024 · NotAllowedError: el escenario sigue ejecutando ordenes
IGUAL    SPEC 024 · NotAllowedError: sin errores en la pagina []
IGUAL    SPEC 024 · al recargar se ofrece «reconectar «recetario»»
IGUAL    SPEC 024 · un clic y queda conectada: «recetario · leyendo en vivo»
IGUAL    SPEC 024 · incognito: al recargar el navegador sigue vivo y ofrece «reconectar «recetario»»
IGUAL    SPEC 024 · sin IndexedDB, conectada y dibujada igual que Git
IGUAL    SPEC 024 · sin IndexedDB, al recargar se pide la carpeta de nuevo: «conectar a mi repositorio», errores []
IGUAL    SPEC 024 · conectada: el indicador dice «recetario · leyendo en vivo»
IGUAL    SPEC 024 · sin permiso: el indicador dice «recetario · sin permiso para leer» y se ofrece reconectar
IGUAL    SPEC 024 · con un clic vuelve: «recetario · leyendo en vivo»
IGUAL    SPEC 024 · carpeta borrada: el indicador dice «recetario ya no existe»
IGUAL    SPEC 024 · carpeta borrada: no queda el dibujo viejo (0 confirmaciones dibujadas)
IGUAL    SPEC 024 · la consola conectada dice, antes de escribir nada, que previsualiza y no ejecuta
IGUAL    SPEC 024 · modo relator y tema claro conectada: tema claro, indicador «recetario · leyendo en vivo», dibujo igual
IGUAL    SPEC 024 · Enter en modo relator conectada dice que la orden no se ejecuta aqui
```


RESULTADO: todo igual
