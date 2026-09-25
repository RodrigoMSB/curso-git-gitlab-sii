# El modo real en msedge sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: msedge 153.0.4234.48
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 896 ms
IGUAL    ramas          conectado y dibujado en 1736 ms
IGUAL    empaquetado    conectado y dibujado en 1496 ms
IGUAL    deltas         conectado y dibujado en 878 ms
IGUAL    desde-bundle   conectado y dibujado en 1370 ms
IGUAL    desconectada   conectado y dibujado en 1318 ms
IGUAL    empates        conectado y dibujado en 1255 ms
IGUAL    estados        conectado y dibujado en 897 ms
IGUAL    conflicto      conectado y dibujado en 1253 ms
IGUAL    completo       conectado y dibujado en 1483 ms
IGUAL    clonado        conectado y dibujado en 1319 ms
IGUAL    latin          conectado y dibujado en 1230 ms
IGUAL    indice4        conectado y dibujado en 1298 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":32.8}; la ultima lectura {"referencias":18.6,"historia":21.5,"areas":73.9,"total":123.8,"motor":45}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 277 ms, media 166 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":21.3}; la ultima lectura {"referencias":18.5,"historia":23.6,"areas":34,"total":84.1,"motor":70.1}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 430 ms, media 411 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":19.4}; la ultima lectura {"referencias":30.8,"historia":30.1,"areas":20.3,"total":88.2,"motor":72}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 451 ms, media 160 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":16.2}; la ultima lectura {"referencias":19,"historia":33.6,"areas":19.4,"total":79.9,"motor":78.7}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 435 ms, media 288 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":15.3}; la ultima lectura {"referencias":27.2,"historia":28.1,"areas":18.9,"total":81.5,"motor":42.3}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 444 ms, media 231 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":20.3}; la ultima lectura {"referencias":20.5,"historia":39,"areas":20.1,"total":86.8,"motor":92.1}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 418 ms, media 200 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":19.4}; la ultima lectura {"referencias":28.8,"historia":28.1,"areas":23.1,"total":87.2,"motor":51.2}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 393 ms, media 212 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":15.8,"historia":13.6,"areas":16.3,"total":52.7,"motor":32.6}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 202 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":17.2,"historia":13.3,"areas":17.6,"total":54.7,"motor":29}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 117 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":16.6,"historia":15,"areas":16.5,"total":55.2,"motor":32.2}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 140 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":15.3,"historia":13.4,"areas":16,"total":51.4,"motor":31.5}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 139 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":13.8}
MEDIDA   SPEC 024 · demoras de los archivos: 202, 117, 140, 139 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 66 ms
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
IGUAL    SPEC 024 · la consola conectada dice, antes de escribir nada, que previsualiza y no ejecuta
IGUAL    SPEC 024 · modo relator y tema claro conectada: tema claro, indicador «recetario · leyendo en vivo», dibujo igual
IGUAL    SPEC 024 · Enter en modo relator conectada dice que la orden no se ejecuta aqui
```


RESULTADO: todo igual
