# Arquitectura del simulador

Documento vivo. Registra las versiones elegidas, la solucion de empaquetado y
las decisiones que el SPEC 001 no cubria. Cada spec posterior agrega su propio
apartado en vez de reescribir los anteriores.

---

## 1. Versiones elegidas

Consultadas en el registro de paquetes el 6 de septiembre de 2026, no fijadas
de memoria, tal como pide el punto 5.1 del SPEC 001. Todas quedan clavadas a
una version exacta, sin `^` ni `~`: el taller se dicta en una red con proxy y
el resultado tiene que ser el mismo en cualquier equipo y en cualquier fecha.

| Paquete | Version | Para que |
|---|---|---|
| `react` / `react-dom` | 19.2.8 | Capa visual |
| `typescript` | 7.0.2 | Lenguaje, en modo estricto |
| `vite` | 8.2.2 | Construccion y desarrollo |
| `vitest` | 5.0.0 | Pruebas |
| `@vitest/coverage-v8` | 5.0.0 | Cobertura |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | Estilos |
| `@vitejs/plugin-react` | 6.1.1 | Soporte de React en Vite |
| `vite-plugin-singlefile` | 2.3.3 | Empaquetado en un archivo |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.7 | Tipos de React |
| `@types/node` | 26.4.1 | Tipos del entorno que usa `vite.config.ts` |

La combinacion se instalo y se verifico antes de escribir el motor: Vite 8
pide Node 20.19 o superior, Vitest 5 acepta Vite 8 y `vite-plugin-singlefile`
declara compatibilidad con Vite 5 a 8. No hubo advertencias de dependencias.

TypeScript esta en 7.0.2, que es la version estable publicada bajo la etiqueta
`latest`. Se activaron `strict`, `noUncheckedIndexedAccess` y
`exactOptionalPropertyTypes`, y ademas `noUnusedLocals`, `noUnusedParameters`,
`noImplicitOverride` y `verbatimModuleSyntax`. No hay ningun `any` en el motor.
Para respetar `exactOptionalPropertyTypes` sin poblar el modelo de propiedades
opcionales, las ausencias se declaran como `| null` en vez de `?`.

## 2. Empaquetado en un archivo unico

`npm run build` produce **un solo archivo**, `simulador/dist/index.html`, con el
codigo y los estilos incrustados. Se abre con doble clic desde el sistema de
archivos y no pide nada a la red.

La base es `vite-plugin-singlefile`, la opcion que el propio spec sugiere. Se
configuro con `assetsInlineLimit` alto, `cssCodeSplit: false` e
`inlineDynamicImports`, de modo que el resultado sale en una sola pieza.

Sobre eso se agrego un complemento propio, `archivo-unico-verificado`, en
`simulador/vite.config.ts`. Hace dos cosas al cerrar la construccion.

**Convierte el script incrustado en un script clasico y lo baja al final del
cuerpo.** `vite-plugin-singlefile` deja el codigo dentro de un
`<script type="module">` en la cabecera. Un script de modulo depende de como el
navegador trata los modulos servidos desde `file://`, que es justamente el modo
en que el participante va a abrir el archivo. Como el paquete sale en una sola
pieza y sin ninguna sintaxis de modulos, la conversion a script clasico es
segura y elimina esa dependencia. El traslado al final del cuerpo es necesario
porque un script clasico se ejecuta apenas el analizador lo encuentra, y en la
cabecera correria antes de que exista el elemento donde se monta la aplicacion.

**Verifica que el resultado sea autocontenido.** Revisa que no quede ningun
script externo, que el paquete no conserve sintaxis de modulos y que el
documento, dejando fuera el codigo, no apunte a ningun recurso que no sea un
`data:`. Si algo de eso falla, la construccion se detiene con un error. Se
prefirio una comprobacion automatica antes que una revision manual: un archivo
que se ve bien en el equipo de desarrollo y falla en la sala de clases es el
peor resultado posible para este proyecto.

Verificacion hecha sobre el resultado: el documento contiene una sola etiqueta
`<script>`, sin `src`; las unicas direcciones que aparecen dentro del codigo son
espacios de nombres de XML y enlaces de documentacion dentro de mensajes de
error, ninguno de los cuales se solicita en tiempo de ejecucion.

## 3. Forma del motor

El motor vive en `simulador/src/core` y no importa React, no toca el documento
y no lee el reloj ni el entorno (restriccion R3).

```
core/
  tipos.ts             modelo de dominio
  identificadores.ts   huella FNV-1a y fechas deterministas
  grafo.ts             recorridos: antepasados, base comun, huerfanas
  estado.ts            construccion y transformacion del estado
  referencias.ts       HEAD, ramas, etiquetas, ~ y ^
  analizador.ts        analisis de la linea escrita
  formato.ts           salidas de status, log y diff
  confirmaciones.ts    fabrica de nodos del grafo
  salida.ts            lineas de consola y resultado de una orden
  ordenes/             un archivo por familia de ordenes
  motor.ts             ejecutar y previsualizar
  index.ts             superficie publica
```

La capa visual solo debe importar desde `core/index.ts`. Mientras esa
superficie no cambie, la interfaz se puede reemplazar sin tocar la logica.

**La previsualizacion no duplica logica.** `previsualizar` llama a `ejecutar`.
Como el estado es inmutable y las ordenes son funciones puras, ejecutar sobre
un estado no lo altera: basta comparar el estado de entrada con el de salida
para saber que confirmaciones serian nuevas y si el puntero se movio.

**Los identificadores son deterministas.** Se calculan con una huella FNV-1a
sobre el mensaje, los padres, los archivos y un contador que el estado lleva.
El contador garantiza que dos confirmaciones distintas nunca compartan
identificador, que es lo que el rebase necesita, y el determinismo hace que las
pruebas no dependan del reloj. Las fechas se derivan del mismo contador por la
misma razon.

## 4. Decisiones no especificadas

Apartado que pide la seccion 13 del SPEC 001. Ninguna de estas decisiones
contradice las restricciones de la seccion 2.

**4.1 Dos estados de archivo mas.** La seccion 6 enumera `limpio`, `modificado`
y `preparado`. Se agregaron `sin-seguimiento`, porque el escenario E1 pide
archivos presentes y sin seguimiento, y `en-conflicto`, porque el escenario E4
pide que la fusion produzca conflicto. Sin ellos los dos escenarios no se
pueden expresar.

**4.2 Las salidas van en el idioma de Git, no traducidas.** El simulador
existe para preparar al participante para la consola real, donde Git responde
`Switched to branch 'main'`. Traducir las salidas lo dejaria peor parado frente
a la herramienta que va a usar despues del taller. Por la misma razon una orden
inexistente responde `bash: gti: command not found`, con el formato de Git Bash,
que es el interprete que trae la instalacion de Git en Windows.

**4.3 La fusion con conflicto reserva de antemano el identificador de la
union.** Cuando la fusion choca, el motor guarda el conflicto en curso junto con
un identificador reservado para la confirmacion de union, y usa ese mismo
identificador cuando el participante resuelve y confirma. Asi la
previsualizacion puede anunciar la union que la fusion va a producir, que es lo
que el criterio CA7 exige sobre E4, y lo que anuncia coincide con lo que
finalmente aparece en el grafo. La interfaz del SPEC 002 puede dibujar ese nodo
en trazo discontinuo mientras el conflicto sigue abierto.

**4.4 Resolver el conflicto se hace con `git add` y `git commit`.** El cuadro de
la seccion 7 solo exige `merge` y `merge --abort`, pero una fusion que choca y
no se puede cerrar dejaria el escenario E4 sin salida. Preparar los archivos en
conflicto los marca como resueltos y la confirmacion siguiente crea la union.

**4.5 `git diff` muestra la forma, no el contenido.** No hay contenido que
comparar (restriccion R4). En vez de inventar lineas que el participante podria
tomar por reales, se emite el encabezado del diff y un cuerpo que declara que el
detalle es simulado. `cat` sigue el mismo criterio.

**4.6 `--graph` esta simplificado.** Se marca cada confirmacion con `*` y se
abre `|\` bajo las de union, sin dibujar los carriles cruzados. El dibujo del
grafo es tarea de la capa visual del SPEC 002, que recibe el carril de cada
confirmacion y no necesita el arte ASCII.

**4.7 El orden del historial es el de creacion.** Al no haber reloj real, el
historial se ordena por el orden en que las confirmaciones entraron al modelo.
Coincide con el orden cronologico inverso que muestra Git.

**4.8 El carril de dibujo no vive en la rama.** El SPEC 001 insiste en que una
rama es un nombre y un identificador, nada mas. Para no contradecirlo, la
asignacion de carriles se guarda aparte, en `EstadoRepositorio.carriles`.

**4.9 El registro de referencias guarda `HEAD` y cada rama.** `git reflog` sin
argumentos muestra el de `HEAD`, como Git. Se puede consultar el de una rama
pasando su nombre, que es lo que hace util el registro para recuperar
confirmaciones huerfanas.

**4.10 El archivo de exclusiones no se modela en el motor.** El escenario E3
trae archivos temporales y un archivo con una credencial, sin exclusiones. El
participante puede crear `.gitignore` con `echo`, y el archivo aparece como uno
mas. Que las exclusiones filtren de verdad lo que `git status` muestra queda
para cuando un spec lo pida.

**4.11 Opciones implementadas de mas.** Ademas de las exigidas se aceptan
`git config --list`, `git branch <nombre> <referencia>`, `git log <referencia>`,
`git remote remove`, `git reset <archivo>` y las referencias `stash@{n}`.
Salieron gratis del diseno y evitan que el participante choque con un reclamo
del simulador al escribir algo que en Git funciona.

**4.12 El andamiaje visual es deliberadamente pobre.** `src/ui` contiene una
sola pantalla de comprobacion: una consola, un selector de escenario y un
listado del estado. Existe para verificar que el motor funciona dentro del
archivo autocontenido. La consola, el grafo dibujado y el diseno son materia del
SPEC 002.

## 5. Nada se aparto del spec

No hubo ningun punto del SPEC 001 que se dejara sin implementar ni que se
resolviera en contra de lo indicado. Las diecinueve ordenes del cuadro de la
seccion 7 estan, con las opciones que ese cuadro exige, y los siete
comportamientos de la seccion 8 tienen una prueba cada uno.
