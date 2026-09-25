# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 153.0.8010.53
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 1442 ms
IGUAL    ramas          conectado y dibujado en 3789 ms
IGUAL    empaquetado    conectado y dibujado en 1430 ms
IGUAL    deltas         conectado y dibujado en 893 ms
IGUAL    desde-bundle   conectado y dibujado en 1392 ms
IGUAL    desconectada   conectado y dibujado en 1518 ms
IGUAL    empates        conectado y dibujado en 1281 ms
IGUAL    estados        conectado y dibujado en 1432 ms
IGUAL    conflicto      conectado y dibujado en 1271 ms
IGUAL    completo       conectado y dibujado en 1554 ms
IGUAL    clonado        conectado y dibujado en 1350 ms
IGUAL    latin          conectado y dibujado en 1244 ms
IGUAL    indice4        conectado y dibujado en 1316 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":13.8}; la ultima lectura {"referencias":16.1,"historia":19,"areas":16.5,"total":58.5,"motor":26.3}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 318 ms, media 216 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":17.2}; la ultima lectura {"referencias":16.3,"historia":21,"areas":29.9,"total":74.3,"motor":60.5}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 438 ms, media 347 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":15.2}; la ultima lectura {"referencias":62.9,"historia":30.1,"areas":19.9,"total":120,"motor":71.2}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 560 ms, media 179 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":15}; la ultima lectura {"referencias":16.3,"historia":32.4,"areas":18.4,"total":73.9,"motor":72.5}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 447 ms, media 313 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":17.1}; la ultima lectura {"referencias":25.2,"historia":27.6,"areas":19.8,"total":79.6,"motor":40.7}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 398 ms, media 184 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":14.7}; la ultima lectura {"referencias":22.1,"historia":35.5,"areas":19,"total":83.6,"motor":82.3}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 396 ms, media 152 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":18.9}; la ultima lectura {"referencias":31,"historia":28.1,"areas":19.8,"total":86.1,"motor":45.7}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 385 ms, media 210 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":15.8,"historia":16,"areas":19.4,"total":58,"motor":40.9}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 217 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":17.5,"historia":13.3,"areas":19.4,"total":57.1,"motor":28.9}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 111 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":14.6,"historia":13.3,"areas":13.8,"total":48.1,"motor":29.5}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 139 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":14.6,"historia":12.2,"areas":15.2,"total":48.6,"motor":34.9}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 395 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":12.8}
MEDIDA   SPEC 024 · demoras de los archivos: 217, 111, 139, 395 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 14 ms
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
MEDIDA   SPEC 024 · sin permiso, estados vistos en 2 s: sin-permiso/2/boton/1232,21
IGUAL    SPEC 024 · sin permiso: el indicador dice «recetario · sin permiso para leer» y se ofrece reconectar
IGUAL    SPEC 024 · con un clic vuelve: «recetario · leyendo en vivo»
IGUAL    SPEC 024 · carpeta borrada: el indicador dice «recetario ya no existe»
IGUAL    SPEC 024 · carpeta borrada: no queda el dibujo viejo (0 confirmaciones dibujadas)
IGUAL    SPEC 024 · la consola conectada dice, antes de escribir nada, que previsualiza y no ejecuta
IGUAL    SPEC 024 · modo relator y tema claro conectada: tema claro, indicador «recetario · leyendo en vivo», dibujo igual
IGUAL    SPEC 024 · Enter en modo relator conectada dice que la orden no se ejecuta aqui
```


RESULTADO: todo igual
