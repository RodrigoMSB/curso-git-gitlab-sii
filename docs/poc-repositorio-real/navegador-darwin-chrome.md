# El modo real en chrome sobre darwin

- Sistema: darwin · Git: git version 2.54.0 (Apple Git-157) · Navegador: chrome 153.0.8010.54
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 882 ms
IGUAL    ramas          conectado y dibujado en 665 ms
IGUAL    empaquetado    conectado y dibujado en 716 ms
IGUAL    deltas         conectado y dibujado en 848 ms
IGUAL    desde-bundle   conectado y dibujado en 644 ms
IGUAL    desconectada   conectado y dibujado en 794 ms
IGUAL    empates        conectado y dibujado en 567 ms
IGUAL    estados        conectado y dibujado en 792 ms
IGUAL    conflicto      conectado y dibujado en 653 ms
IGUAL    completo       conectado y dibujado en 579 ms
IGUAL    clonado        conectado y dibujado en 561 ms
IGUAL    latin          conectado y dibujado en 502 ms
IGUAL    indice4        conectado y dibujado en 600 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":11.4}; la ultima lectura {"referencias":11.6,"historia":30.8,"areas":10.4,"total":57.5,"motor":20.5}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 174 ms, media 119 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":22.8}; la ultima lectura {"referencias":14.6,"historia":24.7,"areas":27.9,"total":73.5,"motor":58}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 424 ms, media 254 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":11.6}; la ultima lectura {"referencias":78.5,"historia":27.4,"areas":17.2,"total":129.3,"motor":68.3}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 207 ms, media 83 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":11.8}; la ultima lectura {"referencias":11.9,"historia":33.1,"areas":19.4,"total":72.3,"motor":66.3}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 429 ms, media 225 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":13.6}; la ultima lectura {"referencias":24.5,"historia":34,"areas":21.4,"total":88.4,"motor":52.4}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 192 ms, media 92 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":14.8}; la ultima lectura {"referencias":20.6,"historia":36.9,"areas":18.1,"total":84.4,"motor":84.5}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 451 ms, media 200 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":13.1}; la ultima lectura {"referencias":29.6,"historia":21.1,"areas":26.1,"total":83.7,"motor":65.8}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 210 ms, media 108 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":12.5,"historia":13,"areas":14.5,"total":45.7,"motor":26.7}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 195 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":12.2,"historia":10.3,"areas":18.5,"total":47.6,"motor":27.6}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 157 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":18.8,"historia":11.4,"areas":14,"total":51,"motor":29.7}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 153 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":13,"historia":13.7,"areas":11.8,"total":48.8,"motor":38.1}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 136 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":14.8}
MEDIDA   SPEC 024 · demoras de los archivos: 195, 157, 153, 136 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 277 ms
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
