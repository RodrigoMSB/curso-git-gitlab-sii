# El modo real en msedge sobre darwin

- Sistema: darwin · Git: git version 2.54.0 (Apple Git-157) · Navegador: msedge 153.0.4234.48
- Huella SHA-256 de SIMULADOR.html: 1cebd0e530c37acc345389d297b999ab7bdaa5d4ead7b44aa43f978d967d20a1
- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).

```
IGUAL    file:// · contexto seguro true · permite elegir carpetas true
IGUAL    file:// · el boton dice «conectar a mi repositorio»
IGUAL    sin la API · la pagina dice «Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.»
IGUAL    lineal         conectado y dibujado en 978 ms
IGUAL    ramas          conectado y dibujado en 882 ms
IGUAL    empaquetado    conectado y dibujado en 887 ms
IGUAL    deltas         conectado y dibujado en 850 ms
IGUAL    desde-bundle   conectado y dibujado en 889 ms
IGUAL    desconectada   conectado y dibujado en 673 ms
IGUAL    empates        conectado y dibujado en 586 ms
IGUAL    estados        conectado y dibujado en 979 ms
IGUAL    conflicto      conectado y dibujado en 629 ms
IGUAL    completo       conectado y dibujado en 547 ms
IGUAL    clonado        conectado y dibujado en 595 ms
IGUAL    latin          conectado y dibujado en 494 ms
IGUAL    indice4        conectado y dibujado en 529 ms
MEDIDA   lab 02: una vuelta de vigilancia {"archivos":14,"carpetas":8,"ms":21.3}; la ultima lectura {"referencias":22.5,"historia":50.3,"areas":58.3,"total":188.2,"motor":111.7}
IGUAL    lab 02: 52 de 52 ordenes iguales
IGUAL    lab 02: 3 confirmaciones nuevas vistas en la pagina, demora maxima 293 ms, media 149 ms
MEDIDA   lab 03: una vuelta de vigilancia {"archivos":17,"carpetas":10,"ms":24.1}; la ultima lectura {"referencias":102.3,"historia":25,"areas":85.2,"total":229.3,"motor":80.9}
IGUAL    lab 03: 66 de 66 ordenes iguales
IGUAL    lab 03: 3 confirmaciones nuevas vistas en la pagina, demora maxima 385 ms, media 244 ms
MEDIDA   lab 04: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":15.3}; la ultima lectura {"referencias":35.3,"historia":44.2,"areas":26.1,"total":112.1,"motor":76.4}
IGUAL    lab 04: 85 de 85 ordenes iguales
IGUAL    lab 04: 13 confirmaciones nuevas vistas en la pagina, demora maxima 233 ms, media 86 ms
MEDIDA   lab 05: una vuelta de vigilancia {"archivos":16,"carpetas":8,"ms":15.5}; la ultima lectura {"referencias":13.4,"historia":29.2,"areas":13,"total":61.3,"motor":62.7}
IGUAL    lab 05: 55 de 55 ordenes iguales
IGUAL    lab 05: 5 confirmaciones nuevas vistas en la pagina, demora maxima 252 ms, media 164 ms
MEDIDA   lab 06: una vuelta de vigilancia {"archivos":17,"carpetas":8,"ms":12.9}; la ultima lectura {"referencias":22.7,"historia":23.8,"areas":14.8,"total":67.6,"motor":38.5}
IGUAL    lab 06: 51 de 51 ordenes iguales
IGUAL    lab 06: 8 confirmaciones nuevas vistas en la pagina, demora maxima 228 ms, media 108 ms
MEDIDA   lab 07: una vuelta de vigilancia {"archivos":19,"carpetas":8,"ms":14.2}; la ultima lectura {"referencias":21.4,"historia":46.1,"areas":18.3,"total":91.4,"motor":97}
IGUAL    lab 07: 75 de 75 ordenes iguales
IGUAL    lab 07: 4 confirmaciones nuevas vistas en la pagina, demora maxima 440 ms, media 188 ms
MEDIDA   lab 08: una vuelta de vigilancia {"archivos":18,"carpetas":10,"ms":20.3}; la ultima lectura {"referencias":21.6,"historia":18.2,"areas":15.9,"total":61.2,"motor":39.1}
IGUAL    lab 08: 54 de 54 ordenes iguales
IGUAL    lab 08: 4 confirmaciones nuevas vistas en la pagina, demora maxima 212 ms, media 117 ms
MEDIDA   SPEC 024 · un archivo nuevo: la lectura que lo trajo, por partes: {"referencias":48.3,"historia":18.2,"areas":16.4,"total":90.4,"motor":34.3}
IGUAL    SPEC 024 · un archivo nuevo: la pagina lo mostro sola en 246 ms · ["ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · README.md modificado: la lectura que lo trajo, por partes: {"referencias":12.3,"historia":19.4,"areas":18.6,"total":56.1,"motor":23.3}
IGUAL    SPEC 024 · README.md modificado: la pagina lo mostro sola en 106 ms · ["README.md:modificado","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · cocineros.md borrado: la lectura que lo trajo, por partes: {"referencias":11.2,"historia":12.8,"areas":10,"total":39.8,"motor":24.7}
IGUAL    SPEC 024 · cocineros.md borrado: la pagina lo mostro sola en 143 ms · ["README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
MEDIDA   SPEC 024 · una regla nueva en .gitignore: la lectura que lo trajo, por partes: {"referencias":16.2,"historia":19.9,"areas":20.6,"total":64.2,"motor":33.1}
IGUAL    SPEC 024 · una regla nueva en .gitignore: la pagina lo mostro sola en 178 ms · [".gitignore:nuevo","README.md:modificado","cocineros.md:borrado-pendiente","ingredientes.md:modificado","nuevo-sin-git.md:nuevo"]
IGUAL    SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes 5, despues 5
IGUAL    SPEC 024 · al final, la pagina y Git dicen lo mismo
MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: {"archivos":15,"carpetas":8,"ms":23.7}
MEDIDA   SPEC 024 · demoras de los archivos: 246, 106, 143, 178 ms
IGUAL    SPEC 024 · carpeta sin .git: el indicador dice «recetario · en vivo, todavía sin repositorio» (sin-repositorio)
IGUAL    SPEC 024 · carpeta sin .git: el aviso dice «Mirando recetario en modo lectura. Las órdenes se escriben en Git Bash; aquí solo se previsualizan.Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.»
IGUAL    SPEC 024 · el archivo se ve suelto, sin Git: ["notas.txt:suelto"]
IGUAL    SPEC 024 · despues de git init, la pagina dibuja sola en 244 ms
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
