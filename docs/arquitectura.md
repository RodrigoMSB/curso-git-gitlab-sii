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

**4.12 El andamiaje visual fue deliberadamente pobre.** Mientras duro el
SPEC 001, `src/ui` contuvo una sola pantalla de comprobacion: una consola, un
selector de escenario y un listado del estado. Existia para verificar que el
motor funcionaba dentro del archivo autocontenido, y dejaba la consola, el
grafo dibujado y el diseno para el SPEC 002.

Esa decision ya se agoto: el SPEC 002 reemplazo por completo ese andamiaje. Lo
que hoy hay en `src/ui` son las cinco zonas de la pantalla del participante,
descritas en las secciones 6 y 7 de este documento. El parrafo anterior queda
como registro de lo que se decidio entonces, no como descripcion del estado
actual.

## 5. Nada se aparto del SPEC 001

No hubo ningun punto del SPEC 001 que se dejara sin implementar ni que se
resolviera en contra de lo indicado. Las diecinueve ordenes del cuadro de la
seccion 7 estan, con las opciones que ese cuadro exige, y los siete
comportamientos de la seccion 8 tienen una prueba cada uno.

---

# SPEC 002 · Interfaz visual

## 6. Forma de la capa visual

La restriccion R6 prohibe que la interfaz contenga logica de Git. Para que eso
sea comprobable y no una intencion, la vista se parte en tres capas y una
prueba revisa las importaciones.

```
src/grafico/    calculo de posiciones. Logica pura, sin React, con sus pruebas
src/vista/      modelo de vista: traduce el estado del motor a datos planos
src/ui/         componentes. Solo pintan
```

`src/ui` solo puede importar React, sus propios archivos, `src/vista` y los
tipos de `src/grafico`. No puede alcanzar el motor, los escenarios ni el
calculo de posiciones. `tests/arquitectura-vista.test.ts` lo verifica leyendo
los archivos y fallando ante cualquier importacion fuera de esa lista, de modo
que la regla sobrevive a quien no la tenga presente.

El calculo de posiciones reparte los carriles atendiendo primero las puntas de
rama en su orden de creacion. Asi la rama principal se queda en la columna de
la izquierda y el dibujo no cambia segun sobre que rama este parado el
participante, que es lo que permite que al cambiar de rama solo se mueva la
etiqueta de posicion.

## 7. Decisiones no especificadas del SPEC 002

**7.1 Las huerfanas se llevan columnas propias.** El reparto de carriles se
hace en dos pasadas: primero lo que alguna referencia alcanza, y despues lo
huerfano, en columnas a la derecha de todo lo vivo. Sin esa separacion las
copias del rebase caerian en la misma columna que sus originales y el dibujo
sugeriria que las confirmaciones se deslizaron hacia otra base, que es
exactamente lo que el punto 6.4 prohibe insinuar.

**7.2 La union proyectada se arma desde el estado de la fusion.** Cuando la
fusion choca, el motor reserva el identificador de la union y guarda de que
confirmaciones cuelga. El modulo de posiciones lee esos campos para poder
dibujar el nodo. Es lectura del modelo, no una decision sobre la fusion, y se
resolvio asi porque la seccion 9 del SPEC 002 no autoriza otro agregado al
motor.

**7.3 La union comprometida sigue dibujada mientras el conflicto esta
abierto.** Sobre el escenario cuatro la fusion produce conflicto, de modo que
al ejecutarla no nace ninguna confirmacion todavia. Si el nodo discontinuo
desapareciera en ese momento, el criterio CA3 no se cumpliria y, peor, la
pantalla dejaria de mostrar hacia donde va la operacion justo cuando el
participante mas lo necesita. Se mantiene dibujado en trazo discontinuo hasta
que el participante resuelve y confirma, y ahi se solidifica con el mismo
identificador.

**7.4 El color de la consola se deduce del bloque.** El motor entrega la salida
larga de `git status` sin marcar linea por linea, y el punto 4.5 pide verde
para lo preparado y rojo para lo pendiente. El modulo de consola asigna el
color segun el encabezado bajo el que cae cada linea, igual que hace Git al
pintarla. Es presentacion de un formato conocido, no logica de dominio, y vive
fuera de los componentes.

**7.5 La tabulacion cede el paso cuando no hay nada que completar.** El punto
4.4 pide que la tabulacion complete la orden, pero interceptarla siempre deja
el foco encerrado en la consola y rompe el criterio CA8. Se completa solo con
el campo escrito; con el campo vacio, y siempre con mayusculas, la tabulacion
sigue su curso normal y el foco sale. La consola lo dice en pantalla.

**7.6 La consola lee el campo, no el estado.** Al pulsar entrar se toma el
valor del elemento y no el del estado de React. Con escritura rapida la
pulsacion puede llegar antes del redibujado, y el estado todavia no tendria el
ultimo caracter: la orden se ejecutaria incompleta o no se ejecutaria.

**7.7 Las aristas son curvas simples.** Cada arista es una curva entre la
confirmacion y su padre. No hay enrutamiento que esquive columnas intermedias.
Con los escenarios del taller, que no pasan de cuatro ramas, el resultado se
lee bien y el codigo se mantiene revisable.

**7.8 El grafo escala con un marco fijo.** El SVG conserva su sistema de
coordenadas y se agranda cambiando su ancho y su alto. Asi el modo relator
aumenta el dibujo y sus rotulos en la misma proporcion que el resto de la
interfaz, sin recalcular posiciones.

**7.9 La pantalla arranca en el escenario uno y con la previsualizacion
encendida.** Es el orden del taller, y la previsualizacion es la funcion que
conviene que el participante descubra sin buscarla.

**7.10 Debajo de mil doscientos ochenta pixeles las cuatro areas se reparten en
dos filas.** El punto 10.5 pide apilar en vertical en lugar de comprimir. Las
zonas se apilan, y dentro de la franja de areas las cuatro columnas pasan a dos
por dos antes que angostarse hasta ser ilegibles.

**7.11 La franja de areas cede espacio antes que la linea de tiempo.** El
armazon se ancla a la altura de la ventana. Si algo no cabe, se desplaza la
franja de areas; la barra, la consola, el grafo y la linea de tiempo quedan
siempre a la vista, porque la linea de tiempo es un control y no un contenido.

**7.12 Nada se guarda en el navegador.** El punto 7.4 lo pide para la linea de
tiempo y se extendio a toda la interfaz: recargar la pagina devuelve el
escenario inicial. Tampoco se guarda el modo relator ni el interruptor de
previsualizacion.

## 8. Los tres agregados al motor

La seccion 9 del SPEC 002 autoriza tres cambios y ninguno mas.

**9.1** Ya existia. `huerfanas` se expone desde el SPEC 001 y ahora tiene una
prueba dedicada.

**9.2** Se agrego `cadenaDeObjetos` en `src/core/objetos.ts`. Devuelve la
confirmacion, su arbol y un elemento por archivo. Como no hay contenido que
resumir (restriccion R4), los identificadores del arbol y de los elementos se
derivan de forma determinista del identificador de la confirmacion y de los
nombres de archivo.

**9.3** Ya ocurria. El identificador reservado vive dentro del estado de la
fusion, de modo que anularlo al abortar lo libera. Queda cubierto por una
prueba que compara el estado completo antes de fusionar y despues de abortar.

No se hizo ningun otro cambio al motor.
