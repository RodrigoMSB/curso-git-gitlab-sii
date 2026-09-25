# El modo real en chrome sobre win32

- Sistema: win32 · Git: git version 2.55.0.windows.5 · Navegador: chrome 153.0.8010.53
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    lineal         conectado y dibujado en 1312 ms
IGUAL    ramas          conectado y dibujado en 2007 ms
IGUAL    empaquetado    conectado y dibujado en 1292 ms
IGUAL    deltas         conectado y dibujado en 1362 ms
IGUAL    desde-bundle   conectado y dibujado en 1332 ms
IGUAL    desconectada   conectado y dibujado en 1322 ms
IGUAL    empates        conectado y dibujado en 1232 ms
IGUAL    estados        conectado y dibujado en 1297 ms
IGUAL    conflicto      conectado y dibujado en 1232 ms
IGUAL    completo       conectado y dibujado en 1305 ms
IGUAL    clonado        conectado y dibujado en 1258 ms
IGUAL    latin          conectado y dibujado en 1200 ms
IGUAL    indice4        conectado y dibujado en 1201 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":9.9}; la ultima lectura {"referencias":11.3,"historia":14.2,"areas":13.1,"total":43.3,"motor":19.3}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 103 ms, media 76 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":11.5}; la ultima lectura {"referencias":12.2,"historia":14.6,"areas":21.4,"total":52.8,"motor":40.4}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 265 ms, media 182 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":11.3}; la ultima lectura {"referencias":19.9,"historia":23.2,"areas":13.7,"total":61.4,"motor":47.3}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 336 ms, media 113 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":9.9}; la ultima lectura {"referencias":12.5,"historia":25.2,"areas":12.8,"total":55.2,"motor":48.9}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 357 ms, media 193 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":10.3}; la ultima lectura {"referencias":17,"historia":17.8,"areas":12.4,"total":51.9,"motor":27.4}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 395 ms, media 125 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":10.3}; la ultima lectura {"referencias":12.4,"historia":25.5,"areas":12.9,"total":55.6,"motor":56.6}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 334 ms, media 125 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":13}; la ultima lectura {"referencias":18.5,"historia":17.9,"areas":12.2,"total":53.4,"motor":31}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 574 ms, media 183 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":9.6,"historia":8.5,"areas":9.9,"total":32.3,"motor":17.9}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 189 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":9.7,"historia":8.7,"areas":11.5,"total":34.1,"motor":19}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 175 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":9.5,"historia":8.3,"areas":9.4,"total":31.5,"motor":19.2}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 167 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":11.5,"historia":9.1,"areas":11.1,"total":36.4,"motor":21.1}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 176 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":8.7}
MEDIDA   SPEC 024 · demoras de los archivos: 189, 175, 167, 176 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 56 ms
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
IGUAL    SPEC 024 · la consola conectada dice, antes de escribir nada, que previsualiza y no ejecuta
IGUAL    SPEC 024 · modo relator y tema claro conectada: tema claro, indicador «recetario · leyendo en vivo», dibujo igual
IGUAL    SPEC 024 · Enter en modo relator conectada dice que la orden no se ejecuta aqui
```


RESULTADO: todo igual
