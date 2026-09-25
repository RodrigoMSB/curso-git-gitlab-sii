# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 153.0.8010.53
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 937 ms
IGUAL    ramas          conectado y dibujado en 1696 ms
IGUAL    empaquetado    conectado y dibujado en 1391 ms
IGUAL    deltas         conectado y dibujado en 891 ms
IGUAL    desde-bundle   conectado y dibujado en 1512 ms
IGUAL    desconectada   conectado y dibujado en 1408 ms
IGUAL    empates        conectado y dibujado en 1300 ms
IGUAL    estados        conectado y dibujado en 1502 ms
IGUAL    conflicto      conectado y dibujado en 1456 ms
IGUAL    completo       conectado y dibujado en 1326 ms
IGUAL    clonado        conectado y dibujado en 1309 ms
IGUAL    latin          conectado y dibujado en 1212 ms
IGUAL    indice4        conectado y dibujado en 1239 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":17}; la ultima lectura {"referencias":17.8,"historia":22.5,"areas":18.7,"total":66.4,"motor":28.9}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 235 ms, media 163 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":20.6}; la ultima lectura {"referencias":16.7,"historia":26.9,"areas":31.4,"total":82.4,"motor":66}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 400 ms, media 322 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":62.3}; la ultima lectura {"referencias":29.5,"historia":29.4,"areas":20.3,"total":85.9,"motor":70.9}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 829 ms, media 215 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":17.5}; la ultima lectura {"referencias":63.9,"historia":34.6,"areas":20.1,"total":126.1,"motor":78.4}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 409 ms, media 265 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":17.6}; la ultima lectura {"referencias":24.8,"historia":26.9,"areas":18.9,"total":77.4,"motor":40}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 379 ms, media 165 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":15.8}; la ultima lectura {"referencias":20.3,"historia":36.7,"areas":18.8,"total":83,"motor":82.8}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 376 ms, media 204 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":21.7}; la ultima lectura {"referencias":28.2,"historia":26.8,"areas":17.1,"total":78.7,"motor":46.5}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 380 ms, media 200 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":16.2,"historia":13.2,"areas":15.3,"total":51.2,"motor":31.2}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 175 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":14.6,"historia":12.7,"areas":17.6,"total":51.8,"motor":29}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 108 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":14.6,"historia":18.5,"areas":16.2,"total":58.2,"motor":37}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 140 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":14.5,"historia":12.6,"areas":15.5,"total":48.8,"motor":30.9}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 108 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":13.8}
MEDIDA   SPEC 024 · demoras de los archivos: 175, 108, 140, 108 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 46 ms
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
