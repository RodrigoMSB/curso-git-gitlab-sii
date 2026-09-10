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
| `@biomejs/biome` | 2.5.12 | Linter, agregado despues del SPEC 002 |

La combinacion se instalo y se verifico antes de escribir el motor: Vite 8
pide Node 20.19 o superior, Vitest 5 acepta Vite 8 y `vite-plugin-singlefile`
declara compatibilidad con Vite 5 a 8. No hubo advertencias de dependencias.

TypeScript esta en 7.0.2, que es la version estable publicada bajo la etiqueta
`latest`. Se activaron `strict`, `noUncheckedIndexedAccess` y
`exactOptionalPropertyTypes`, y ademas `noUnusedLocals`, `noUnusedParameters`,
`noImplicitOverride` y `verbatimModuleSyntax`. No hay ningun `any` en el motor.
Para respetar `exactOptionalPropertyTypes` sin poblar el modelo de propiedades
opcionales, las ausencias se declaran como `| null` en vez de `?`.

### El linter es Biome, y no typescript-eslint

Durante los dos specs el proyecto no tuvo linter. La razon era concreta:
TypeScript 7 es el puerto nativo y salio sin API programatica estable, de la
que typescript-eslint depende para construir su arbol con tipos. Instalarlo
habria obligado a arrastrar una segunda copia de TypeScript 5 solo para el
linter, con el riesgo de que el linter y el compilador discrepen sobre el mismo
codigo.

Biome no tiene ese problema: es un binario propio, analiza el codigo por su
cuenta y no llama a TypeScript. Se agrego con `preset: recommended`, y con el
formateador apagado a proposito: el proyecto ya tiene `.editorconfig` y
reformatear todo el arbol habria enterrado el historial de los dos specs bajo
un cambio de estilo.

Lo que el linter no puede hacer es razonar sobre tipos, y ahi estan sus cuatro
desacuerdos con este codigo. Los cuatro quedaron anotados en el lugar donde
ocurren, con la razon escrita, en vez de apagar la regla para todo el proyecto:

- `formato.ts` tiene un `switch` exhaustivo sobre la union de estados de
  archivo. El linter pide un `default`; agregarlo convertiria en silencioso lo
  que hoy es un error de compilacion cuando se agregue un estado nuevo.
- La consola usa `renglones` como disparador de un efecto que no lo lee.
  Quitarlo, como propone la regla, congela el desplazamiento automatico.
- El clic sobre la consola solo devuelve el foco al campo. Con teclado ese
  campo ya se alcanza con tabulacion, de modo que el manejador de teclas que
  pide la regla no daria acceso a nada nuevo.
- Los nodos del grafo llevan `role="button"` porque viven dentro del SVG,
  donde `<button>` no existe.

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

**7.11 Las zonas miden lo que su contenido pide.** La primera version anclaba
el armazon a la altura de la ventana y repartia ese alto entre las zonas. El
resultado se vio recien en las capturas: en el escenario E1 la consola era una
caja negra de mil pixeles vacios y el grafo un recuadro con una sola frase.

Ahora la altura de la ventana es un minimo y no un reparto. La consola y el
grafo miden su contenido y crecen desde arriba, con un tope de `100dvh` menos
veinte unidades, que es lo que ocupan la barra, la franja de areas y la linea
de tiempo juntas; pasado ese tope se desplazan por dentro y las cuatro zonas
siguen cabiendo en la ventana.

La franja de areas y la linea de tiempo fluyen a continuacion del grafo, con la
misma separacion que hay entre el resto de las zonas. Lo que sobra queda al
final de la pagina. Un primer intento las anclo al borde inferior para que no
se deslizaran mientras el grafo crecia, y eso puso el hueco justo al medio: en
E1 y E2 quedaban casi mil pixeles entre el grafo y las areas, y la pantalla se
leia partida en dos.

Lo que mantiene quietas a las areas es el alto minimo del grafo, no el anclaje.
El grafo reserva veintiseis unidades, que dan para unas siete confirmaciones:
mientras la clase avanza dentro de esa reserva, el dibujo crece hacia adentro
del panel y nada de lo que esta debajo se mueve. La reserva es ademas la unica
altura que la pantalla impone, y se nota solo en el panel del grafo, que es
donde se espera que aparezca contenido.

**7.13 Las listas de archivos se desplazan por filas enteras.** El tope de las
listas de la zona D es un multiplo exacto del alto de fila, y ambas medidas se
escalan con la interfaz. Asi el corte del desplazamiento siempre cae entre dos
lineas: nunca se ve media linea asomando, que es lo que ocurria cuando el tope
era una medida suelta. La lista pasa a ser parada de tabulacion solo cuando de
verdad se desplaza, para no agregar paradas que no llevan a ninguna parte.

**7.14 La ayuda de la consola aparece cuando sirve.** Las dos lineas que
explican la tabulacion y la previsualizacion se muestran solo con el campo
enfocado y todavia vacio, y desaparecen al escribir. Permanentes se leen las
primeras veces y despues son ruido, sobre todo proyectadas.

**7.15 El grupo de huerfanas va rotulado.** El gris atenuado las distingue,
pero no dice que son. Un rotulo discreto, `sin referencia`, se dibuja a la
derecha del grupo y a la altura de su centro, para que se lea como del conjunto
y no de una confirmacion en particular. Ese costado siempre esta libre: una
huerfana, por definicion, no tiene ninguna etiqueta apuntandola. La posicion la
calcula el modulo de disposicion, no el componente, como todo lo demas del
dibujo.

**7.16 La interfaz va acentuada aunque los specs vinieran sin tildes.** Los
dos specs se escribieron sin acentos y la interfaz los copio. Se corrigio todo
lo que el participante lee: rotulos, avisos, titulos de escenario y textos de
ayuda. Los specs quedan como estan, porque son el encargo y no la entrega, y
los nombres del codigo tampoco se tocan: `onPrevisualizacion` sigue sin tilde.
La salida de las ordenes tampoco cambia, porque va en el idioma de Git
(decision 4.2). Una prueba fija los textos acentuados uno por uno.

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

---

# SPEC 003 · Repositorios semilla

## 9. Forma de las semillas

Los escenarios del SPEC 001 son estados en memoria del simulador. Estos son
repositorios Git de verdad, que el participante clona en Git Bash y rompe. La
carpeta se ordena por funcion y no por laboratorio:

```
semillas/
├── preparar.sh    clona, prepara y verifica: la unica orden del enunciado
├── generar.sh     rehace los paquetes y anota el manifiesto
├── comprobar.sh   revisa que los paquetes esten al dia, y el determinismo
├── lib/           entorno determinista, contenido del recetario, verificacion
├── generadores/   un guion por semilla
├── paquetes/      los paquetes versionados, mas su manifiesto
├── preparacion/   lo que no viaja en un paquete
├── verificadores/ comprueban el estado inicial recien preparado
└── descripciones/ para el relator
```

El generador construye el repositorio con ordenes de Git reales y lo deja en un
paquete. `preparar.sh` clona ese paquete, corre el guion de preparacion si lo
hay y termina llamando al verificador, de modo que una semilla mal armada se
detiene antes de que el participante escriba nada.

## 10. Decisiones no especificadas del SPEC 003

**10.1 Son diez semillas y once paquetes.** El cuadro de la seccion 7 del
SPEC 003 marca con «si» diez laboratorios —02, 03, 04, 05, 06, 07, 08, 09, 10
y 13— mientras que la frase siguiente decia «nueve semillas y diez paquetes».
Se siguio el cuadro, que es la parte especifica.

El product owner confirmo despues que la frase era el error y el cuadro lo
correcto: **el laboratorio 10 lleva semilla**, porque parte del recetario
terminado y listo para publicar. Diez semillas y once paquetes es lo
definitivo y no hay nada que sacar. Queda escrito aqui para que la
contradiccion del spec no reabra la pregunta.

**10.2 Las fechas se llevan como epoca y desplazamientos, sin llamar a
`date`.** BSD y GNU no aceptan los mismos argumentos, y una diferencia ahi
cambiaria las fechas y con ellas los identificadores, que es justo lo que
prohibe R7. La biblioteca guarda un instante base —lunes 2 de marzo de 2026 a
las 09:14, hora de Chile— y avanza sumando segundos y dias. Git acepta la forma
`@1772453640 -0300` en `GIT_AUTHOR_DATE`, de modo que nunca hace falta
formatear una fecha.

**10.3 El piso es Bash 3.2.** Es el que trae macOS. Git Bash sobre Windows trae
uno mas nuevo, pero lo contrario no es cierto, asi que los guiones se escriben
sin arreglos asociativos, sin `mapfile` y sin las expansiones de Bash 4. Es la
lectura estricta de R8: un solo lenguaje quiere decir tambien una sola version.

**10.4 La funcion de huella es `git hash-object`.** El manifiesto y las
comprobaciones necesitan resumir archivos, y `sha256sum` no existe en macOS
mientras que `shasum` no existe en todas las instalaciones de Git Bash. Git
esta garantizado en las dos, por definicion del proyecto.

**10.5 El paquete lleva `HEAD` y eso obliga a filtrar al clonar.** Un paquete
creado con `--all HEAD` deja, al clonarse, una referencia `refs/remotes/origin`
a secas ademas de las ramas. Recorrer las ramas de seguimiento por su nombre
abreviado creaba una rama local llamada `origin` en todas las semillas.
`preparar.sh` recorre el nombre completo de cada referencia y descarta la que
no sea una rama.

**10.6 Al preparar se crean las ramas locales y se quita el remoto.** Al clonar
un paquete, las ramas que no son la principal quedan solo como ramas de
seguimiento y `git branch` no las muestra, que no es lo que el enunciado
supone. Se crean como locales. Despues se quita el remoto, porque apunta a un
archivo `.bundle` y en los laboratorios que no hablan de remotos solo genera
preguntas. El laboratorio 09 lo vuelve a poner en su guion de preparacion,
porque ahi el remoto es la materia del ejercicio.

**10.7 Los guiones de preparacion viven en `semillas/preparacion/`.** El punto
5.3 los pide «junto al paquete». Se los dejo en una carpeta hermana en vez de
mezclarlos con los binarios: `paquetes/` se regenera entero y conviene que solo
contenga lo generado.

**10.8 La identidad queda puesta al preparar.** `preparar.sh` configura
`user.name` y `user.email` en el repositorio clonado con los mismos valores del
simulador. Sin eso, la primera confirmacion de cada laboratorio fallaria en las
maquinas donde nadie configuro Git, y esa configuracion es materia del
laboratorio 01, que no lleva semilla.

**10.9 Los verificadores corren dentro de la suite de Vitest.** El punto 6.3
pide que corran en la suite del proyecto, y la suite del proyecto es la del
simulador. `simulador/tests/semillas.test.ts` ejecuta los mismos guiones de
Bash que corre el relator: no hay una segunda implementacion en TypeScript que
pueda quedar desincronizada. Cuesta unos treinta segundos, que es casi todo el
tiempo de la suite.

**10.10 El manifiesto guarda dos huellas por paquete.** Una del generador junto
con las bibliotecas que usa, y otra de las referencias que el paquete
transporta. La primera detecta que alguien cambio un generador y no regenero;
la segunda, que el paquete en disco no es el que el manifiesto declara. No se
compara el paquete byte a byte porque el empaquetado no es reproducible al
byte: lo que R7 exige, y lo que los enunciados citan, son los identificadores.

**10.11 Reemplazar un directorio existente exige `--rehacer`.** La semilla se
prepara sobre el trabajo del participante y borrarlo sin preguntar es
irreversible. La orden falla y dice como insistir.

**10.12 El error del laboratorio 07 se trata como publicado sin traer un
remoto.** El enunciado necesita que la confirmacion con el error se considere
ya publicada, para que revertir sea preferible a retroceder. Darle un remoto de
verdad habria adelantado material del laboratorio 09. La descripcion de la
semilla lo dice, y el enunciado lo declara.

## 11. Los criterios del SPEC 003

**CA1**, **CA3** a **CA10** quedan cubiertos por pruebas de la suite. El peso
del arbol de semillas es de 232 KB, de los cuales 52 KB son los once paquetes:
tres ordenes de magnitud por debajo del limite de veinte megabytes que fija
CA10, y una prueba lo vigila.

### CA2 · PENDIENTE DE CIERRE

**Estado: abierto.** Falta correrlo en Windows. Todo lo demas del SPEC 003
esta cerrado.

Lo que si esta comprobado: dos ejecuciones del mismo generador producen los
mismos identificadores, de forma automatizada, sobre **macOS 15 con Git 2.50.1
y Bash 3.2**. Lo que falta es la otra mitad del criterio, que pide dos sistemas
operativos distintos. No se hizo porque el trabajo se desarrollo en una sola
maquina.

Lo que depende del codigo ya esta puesto: el repositorio generado fija
`core.autocrlf` y `core.eol`, de modo que los finales de linea no cambien el
contenido confirmado, que es la causa habitual de que los identificadores
difieran entre Windows y el resto.

#### Como cerrarlo

En una maquina con Windows y Git Bash, sobre una copia limpia de este
repositorio, correr **exactamente esto** desde la raiz del curso:

```bash
bash semillas/comprobar.sh --determinismo
```

Tarda alrededor de un minuto y no necesita red ni `npm install`. Imprime una
linea por semilla, con esta forma:

```
  ok lab-02  e59c2113da7f9a09408c667af0dd348835d933cf
```

Comparar esas diez huellas contra la **tabla de huellas de referencia** que
esta mas abajo, en esta misma seccion. Entonces:

- **Si las diez coinciden**, CA2 queda verificado. Reemplazar el encabezado de
  esta seccion por `### CA2 · cerrado`, anotar la fecha, la version de Windows,
  la de Git y la de Bash, y borrar este instructivo.
- **Si alguna difiere**, CA2 queda incumplido y hay un problema real: los
  enunciados no podran citar identificadores. Anotar aqui cuales difirieron y
  con que valores. El primer sospechoso son los finales de linea; el segundo,
  la version de Git, que en Windows suele ir por detras.

No hace falta preguntar nada para hacer esto: la orden es la de arriba y la
tabla es la de abajo.

#### Tabla de huellas de referencia

Obtenidas en macOS 15, Git 2.50.1, Bash 3.2. Una prueba de la suite las
compara contra lo que el repositorio produce hoy, de modo que la tabla no pueda
quedar vieja en silencio.

| Semilla | Huella de los identificadores |
|---|---|
| lab-02 | `e59c2113da7f9a09408c667af0dd348835d933cf` |
| lab-03 | `f3fdcb5478be9b591dcdf78c89456cfd922eba29` |
| lab-04 | `6036e8e000d0aaa07aa0ded5e0c13dc668364967` |
| lab-05 | `260858672ff2ed3b4a0bd295ddc57a9162541e3d` |
| lab-06 | `294ccda267262533a2df2f9053d1196e8f12d707` |
| lab-07 | `d8aac40cd2659d938ce6e4f6dd7ffd9e21b3242f` |
| lab-08 | `4c9f997fc58e6578d0a0ef29e778994060182917` |
| lab-09 | `4220b08096018acbaf8e626508565e2f883ea019` |
| lab-10 | `40d34ce3dc930596f70ef080e83cc0837028b50d` |
| lab-13 | `939d68b1532d88a0a734de0963aa54250f45a17a` |

La huella resume la lista ordenada de todos los identificadores de la semilla.
Una sola confirmacion que cambie la cambia entera.

---

# SPEC 004 · Laboratorio 01 armado

## 12. Forma de los laboratorios

El SPEC 004 cambia de raiz como se arma un laboratorio. Hasta el SPEC 003 la
idea era que cada ejercicio partiera de un repositorio semilla preparado por un
script. Ya no: **cada laboratorio es una carpeta autocontenida bajo `labs/`**,
el participante entra en ella y trabaja ahi.

```
labs/lab-01/
├── README.md        el enunciado que lee el participante
└── verificar.sh     comprueba si el laboratorio quedo bien
```

`semillas/` queda en el repositorio, intacto y sin uso. Ningun laboratorio lo
invoca. El laboratorio 01 no trae archivos de trabajo porque el ejercicio
consiste justamente en crear el repositorio desde cero.

El enunciado lo escribio el product owner y llego ya redactado. El SPEC 004
autoriza **un solo cambio**: que el repositorio se cree dentro de la carpeta del
laboratorio en vez del directorio personal. Todo lo demas se copio tal cual.

## 13. Decisiones no especificadas del SPEC 004

### El cambio autorizado es una sola linea

El enunciado hacia `cd ~` antes de `mkdir recetario`. Quedo `cd labs/lab-01`.
Una linea dentro del mismo bloque de ordenes, y el archivo es byte a byte
identico al entregado en todo lo demas:

```
84c84
< cd ~
---
> cd labs/lab-01
```

Se descarto agregar prosa que explicara el cambio, aunque era tentador. El
punto 2.2 del spec prohibe editar, reescribir y cambiar el tono, y una linea de
ordenes que ya dice a donde ir no necesita que nadie la glose. La seccion «Si
algo salio mal» sigue diciendo «borra la carpeta `recetario`», que es correcto
sin importar donde este.

### El verificador no menciona al verificador

El enunciado no dice en ninguna parte que exista `verificar.sh`. Agregarlo
habria sido editar el enunciado, que es justo lo prohibido. La forma de correrlo
esta documentada en `labs/README.md`, que no es el enunciado y si se podia
tocar.

### El verificador no usa la biblioteca de `semillas/`

Los verificadores del SPEC 003 comparten `semillas/lib/verificar.sh`. Este no la
usa, y no es por descuido: el criterio CA6 exige que nada en `labs/lab-01/`
invoque nada de `semillas/`. Un laboratorio autocontenido que dependiera de una
biblioteca de la carpeta vecina dejaria de serlo.

La duplicacion es menor y ademas los dos verificadores tienen publicos
distintos. El de las semillas le habla al relator, calla cuando todo esta bien
y solo grita ante una semilla mal armada. Este le habla al participante, que
necesita ver los cinco criterios y su marca aunque esten todos aprobados.

### La ruta sale de la ubicacion del script, no del directorio actual

El spec pide que se corra sin argumentos desde la carpeta del laboratorio. El
script resuelve `recetario` contra su propio `dirname`, asi que funciona igual
desde la carpeta del laboratorio, desde la raiz del curso o desde cualquier
otra parte. Un participante que lo corra desde donde no corresponde recibe el
resultado de su laboratorio y no un error de ruta, que no le enseña nada.

### Que existe el repositorio se comprueba comparando la cima, no preguntando

Esta es la decision que mas costo y la unica que nacio de un error encontrado
al probar.

La comprobacion natural es preguntarle a Git si responde dentro de `recetario`.
Esta mal. `labs/lab-01/recetario` vive **dentro** del repositorio del curso, y
Git, cuando no encuentra un `.git` propio, sigue subiendo por el arbol de
directorios hasta dar con el de mas arriba. Un participante que creara la
carpeta y olvidara el `git init` obtenia esto:

```
  ✓ existe el repositorio en labs/lab-01/recetario
  ✗ cantidad de confirmaciones
      esperaba: 4
      encontro: 28
```

Veintiocho son las confirmaciones del repositorio del curso. El verificador
estaba midiendo el laboratorio contra la historia del taller, y el criterio mas
basico de los cinco daba aprobado sin que hubiera repositorio alguno.

La version que quedo compara `git rev-parse --show-toplevel` contra la ruta
esperada. Si la cima del repositorio no es `recetario` mismo, el criterio falla
y dice «falta el git init», que es lo que efectivamente paso.

Esto dejo de ser una nota del laboratorio 01: es la **regla 1 de la seccion
15**, que rige para todo verificador de laboratorio.

### Los cinco criterios se imprimen siempre

Sin repositorio, tres de los cinco criterios no se pueden medir. Aun asi se
imprime una linea por cada uno, con `no se pudo comprobar, no hay repositorio`
en lugar del valor encontrado, y todos cuentan como fallidos. El spec pide una
linea por criterio; una lista que se corta en la primera falla le esconde al
participante cuanto le falta.

El criterio de los alias es la excepcion util: vive en la configuracion, no en
el repositorio, asi que se evalua igual y puede aprobar aunque no exista la
carpeta.

### Los alias se comprueban por existencia y valen locales

El spec pide que `s` y `lg` «esten configurados». Se comprueba que esten
definidos, no que digan exactamente lo que sugiere el enunciado. Un participante
que ya tenia sus propios alias, o que los escribio distinto, hizo el ejercicio
igual; el laboratorio enseña que un alias es un atajo, no una cadena concreta
que haya que copiar.

La pregunta se hace desde dentro del repositorio, de modo que valen tanto los
globales, que es lo que el enunciado pide, como los locales, que tambien
resuelven el ejercicio.

### Bash 3.2

Por la misma razon del SPEC 003: se escribe para el Bash viejo de macOS. Git
Bash sobre Windows trae uno mas nuevo y acepta lo que funciona en el viejo,
pero no al reves. Sin arreglos asociativos y sin `mapfile`. El script pasa
`bash -n` con el 3.2 del sistema y `shellcheck` sin observaciones.

Se uso `set -u` y no `set -eu`. Con `set -e`, un `git` que responde con codigo
distinto de cero, que aqui es un resultado esperado y no un accidente, cortaba
el verificador a la mitad de la lista.

### La exclusion se anota aunque ya estuviera cubierta

`.gitignore` ya traia `recetario/` sin anclar, que por ser un patron sin barra
inicial coincide en cualquier nivel y por lo tanto ya cubria
`labs/lab-01/recetario`. Se agrego igual `labs/*/recetario/`, explicita y con su
comentario. La regla vieja existe para el destino por omision de
`semillas/preparar.sh`; el dia que alguien la ancle a la raiz, que es un cambio
razonable, se llevaria por delante y en silencio el trabajo de toda la clase.

## 14. Los criterios del SPEC 004

| Criterio | Estado |
|---|---|
| CA1 · existe `labs/lab-01/` con enunciado y verificador | cumplido |
| CA2 · el enunciado es identico salvo el cambio de ruta | cumplido, una linea de diferencia |
| CA3 · el verificador aprueba el laboratorio bien hecho | cumplido |
| CA4 · falla ante cada criterio roto por separado | cumplido, nueve casos probados |
| CA5 · las exclusiones cubren el trabajo del participante | cumplido |
| CA6 · nada de `labs/lab-01/` invoca `semillas/` | cumplido |

Sobre CA4, se rompio cada uno de los cinco criterios por separado y se
comprobaron el mensaje y el codigo de salida. Los nueve casos son los cinco del
spec mas cuatro variantes que valia la pena mirar: la carpeta creada sin
`git init`, que es la que descubrio el error de la seccion 13; el historial con
tres confirmaciones ademas del de cinco; y los alias faltando de a uno en vez de
los dos.

Sobre CA6, la unica aparicion de la palabra «semilla» dentro de `labs/lab-01/`
esta en el subtitulo del propio enunciado, «sin repositorio semilla», que
declara que no hay semilla en vez de invocar una. No hay ninguna referencia a
`semillas/`, `preparar.sh`, `generar.sh` ni `comprobar.sh`.

El estado inicial del laboratorio se armo siguiendo el enunciado paso a paso,
sin atajos, y sobre ese resultado se corrieron las comprobaciones. La
configuracion global de la maquina no se toco en ningun momento: las pruebas
usan un archivo de configuracion aparte via `GIT_CONFIG_GLOBAL`.

Todo eso quedo despues fijado en la suite del proyecto, en
`simulador/tests/laboratorios.test.ts`, que arma el laboratorio siguiendo el
enunciado, corre el verificador en Bash y rompe cada criterio por separado. Son
diecisiete pruebas y corren con `npm test` junto con las del simulador y las
semillas.

Automatizarlo valio la pena de inmediato: la prueba de que el verificador da el
mismo resultado desde cualquier carpeta descubrio la regla 2 de la seccion 15,
un error que las comprobaciones a mano no habian tocado porque la ruta del
repositorio del curso no pasa por ningun enlace simbolico.

## 15. Principios de los verificadores de laboratorio

Estas reglas rigen para **todo** verificador de laboratorio, no solo el del 01.
Los que faltan se escriben contra esta seccion. Ninguna nacio de precaucion
abstracta: las dos primeras salieron de errores encontrados al probar el
laboratorio 01, la septima de uno encontrado en el 02 y la octava de una
comprobacion que el 03 habria aprobado sin que nadie hiciera nada.

### Regla 1 · la cima del repositorio se compara, no se pregunta

**Un verificador nunca da por existente un repositorio solo porque Git responde
dentro de la carpeta.** Compara `git rev-parse --show-toplevel` contra la ruta
que espera, y si no coincide, el criterio falla.

El motivo es estructural y afecta a todos los laboratorios por igual: la carpeta
del participante vive dentro del repositorio del curso, y Git, cuando no
encuentra un `.git` propio, sigue subiendo por el arbol de directorios hasta dar
con el de mas arriba. Un verificador que solo pregunta «¿responde Git aqui?»
recibe que si, y a continuacion mide el laboratorio contra la historia del
taller. El criterio mas basico de todos aprueba sin que exista repositorio
alguno.

Ningun otro criterio salva la situacion, porque todos los demas leen ese mismo
repositorio equivocado.

### Regla 2 · las rutas se comparan en forma fisica

**El lado del verificador se construye con `pwd -P`, no con `pwd`.**

`git rev-parse --show-toplevel` devuelve siempre la ruta fisica, con los enlaces
simbolicos ya resueltos. `pwd` a secas devuelve la logica. En macOS `/tmp` y
`/var` son enlaces a `/private/tmp` y `/private/var`, asi que un laboratorio que
viviera bajo cualquiera de ellos comparaba `/var/...` contra `/private/var/...`
y no aprobaba nunca, hiciera el participante lo que hiciera.

Encontro este error la prueba de que el verificador da el mismo resultado desde
la carpeta del laboratorio y desde cualquier otra parte. Con la ruta relativa
las dos formas coincidian por casualidad; con la absoluta, no.

### Regla 3 · la ruta sale del script, no del directorio actual

El verificador resuelve la carpeta de trabajo contra su propio `dirname`. Se
corre sin argumentos y funciona desde donde sea. Un participante que lo corra
desde donde no corresponde recibe el resultado de su laboratorio, no un error de
ruta, que no le enseña nada.

### Regla 4 · se imprimen todos los criterios, siempre

Aunque falte el repositorio y la mitad no se pueda medir. Los que no se pueden
medir dicen `no se pudo comprobar, no hay repositorio` y cuentan como fallidos.
Una lista que se corta en la primera falla le esconde al participante cuanto le
falta.

### Regla 5 · el verificador no toca nada

No arregla, no crea, no borra, no configura. Solo mira y dice. El participante
tiene que poder correrlo cuantas veces quiera sin que cambie su ejercicio.

### Regla 6 · las pruebas rompen cada criterio por separado

Un verificador que nunca se vio fallar no prueba nada. Cada criterio se rompe
solo, y se exige el mensaje especifico y el codigo de salida distinto de cero.
Las pruebas viven en `simulador/tests/laboratorios.test.ts` y corren el
verificador en Bash tal como lo corre el participante: no hay una segunda
implementacion de los criterios en TypeScript.

Esas pruebas arman el laboratorio **dentro de un repositorio de mentira que hace
de curso**, porque esa es la situacion real del taller y es la unica forma de
que la regla 1 quede fijada contra una regresion.

### Regla 7 · en Bash 3.2, toda variable pegada a un caracter no ASCII va con llaves

**Se escribe `"«${MENSAJE}»"`, nunca `"«$MENSAJE»"`.**

Bash 3.2 toma los bytes de `»` como parte del nombre de la variable y muere con
`unbound variable`. Las comillas angulares son de varios bytes y ese Bash no las
separa del identificador. El sintoma es desconcertante, porque el error nombra
una variable que nadie escribio:

```
verificar.sh: line 134: MENSAJE_MALO�: unbound variable
```

Los mensajes de los verificadores citan contenido entre comillas angulares todo
el tiempo, asi que esto va a aparecer en los trece laboratorios que faltan. El
verificador del laboratorio 01 se salvo por casualidad: ahi las comillas
angulares solo rodean texto literal, sin variables al lado.

La regla vale para cualquier caracter no ASCII pegado a una expansion, no solo
para `»`.

### Regla 8 · cuando el estado final se parece al inicial, el criterio es el rastro

Un verificador tiene que separar al participante que hizo el laboratorio del que
no lo abrio nunca. En los laboratorios donde se modifica el proyecto eso sale
solo. **En los de solo mirar, no.**

El laboratorio 03 abre la carpeta `.git` y lee lo que hay: al terminar, HEAD
apunta a `main`, la unica rama es `main` y el directorio esta limpio. Los tres
criterios que el enunciado lista en su Comprobacion **ya se cumplian antes de
empezar**. Un verificador que solo los mirara aprobaria a quien no hizo nada.

Lo que separa los dos estados es la huella que deja el trabajo, aunque el
trabajo no haya dejado archivos. En el 03 esta en el registro de referencias:
crear una rama, cambiarse a ella y volver deja dos lineas en `.git/logs/HEAD`
que sobreviven al borrado de la rama, porque el registro de HEAD es aparte del
de cada rama.

Antes de dar por bueno un verificador, hay que correrlo contra el escenario
recien preparado. Si aprueba, falta un criterio.

## 16. El segundo efecto del repositorio anidado · RESUELTO

> **Decision tomada por el product owner: opcion A.** El trabajo del
> participante vive fuera del clon del curso. Lo que sigue es el hallazgo tal
> como se investigo; la regla que salio de el esta en la seccion 17.

La seccion 15 resuelve el problema **del verificador**. Queda otro, del lado del
participante, que el SPEC 004 no previo y que hay que resolver antes de
replicar la forma a los catorce laboratorios que faltan.

El planteo es simple: si el laboratorio vive en `labs/lab-01/`, el participante
trabaja **dentro del repositorio del curso**, y sus ordenes de Git alcanzan la
configuracion y el estado del repositorio de arriba.

Lo que sigue esta comprobado sobre un repositorio de curso de mentira, no
razonado. La decision es del product owner; aqui quedan los hechos.

### Muerde, y en tres lugares

**Primero, `git config` sin `--global`.** La Parte 1 del enunciado ocurre
*antes* de que exista `recetario`, asi que el participante esta parado en el
repositorio del curso. Si escribe `git config user.name "..."` sin `--global`,
que es un error corriente, la orden **funciona** y escribe en el `.git/config`
del curso.

Fuera de un repositorio, la misma orden falla fuerte y a tiempo:

```
$ git config user.name "Participante Taller"
fatal: not in a git directory
```

Dentro del repositorio del curso no dice nada. Ese es el fondo del asunto: el
anidamiento **convierte un error que Git atrapaba en el acto en uno silencioso**.

Y no es un error inocente. La seccion 1.4 del enunciado le explica al
participante que sin `--global` la configuracion vale solo para el repositorio
donde esta parado. El enunciado esta invitando, con toda razon pedagogica, al
experimento que ensucia el repositorio del curso.

Las consecuencias llegan despues y en otra parte, que es lo peor que le puede
pasar a un error en clase:

- Los alias quedan en el curso y **no llegan a `recetario`**. El `git lg` que
  manda usar la Parte 3.4 responde `git: 'lg' is not a git command`.
- Las confirmaciones del participante se firman con la identidad que hubiera
  en la configuracion global, no con la que el acaba de escribir. En una
  maquina sin identidad global, Git se niega a confirmar.
- El verificador falla el criterio 5 y el participante no tiene como saber por
  que, porque el si escribio los alias y los vio aceptados.

**Segundo, `git status` desde la carpeta equivocada.** Un participante que se
salte el `cd recetario` y corra lo que pide la Parte 2.3 recibe el estado del
repositorio del curso. El enunciado le prometio «no hay confirmaciones todavia»
y ve otra cosa.

Es mas grave de lo que parece, porque el enunciado despues manda `git add .`
(Parte 3.3), y en el lugar equivocado eso prepara el repositorio del curso
entero.

**Tercero, y es el peor, la seccion «Si algo salio mal».** Esa seccion indica
`git reset --soft HEAD~1`. Corrida en el repositorio del curso, comprobado:

```
--- historia del curso ANTES ---     --- historia del curso DESPUES ---
e6c301c tercera del curso            d1ed43f segunda del curso
d1ed43f segunda del curso            a9f591b el repositorio del curso
a9f591b el repositorio del curso
```

Se llevo por delante una confirmacion del curso y dejo todo preparado. Es una
orden de recuperacion, o sea la que corre justo quien ya esta perdido y menos
va a notar en que carpeta esta.

### Un cuarto efecto, este en el verificador

Cuando `recetario` no existe, el criterio 5 pregunta por los alias parado en
`labs/lab-01`, que esta dentro del curso. Si el participante los escribio sin
`--global`, el verificador los encuentra **en el config del curso** y da el
criterio por aprobado.

El veredicto general no miente, porque el criterio 1 ya fallo y el codigo de
salida es distinto de cero. Pero la linea del criterio 5 si miente.

El arreglo es de una linea: cuando no hay repositorio, preguntar por los alias
solo en el config global, que es el unico lugar donde pueden estar
legitimamente.

**Quedo aplicado, aunque bajo la opcion A el problema desaparezca solo.** Un
verificador que miente en una linea es un verificador que miente, y los catorce
que vienen heredan la forma. Hay una prueba que lo fija: escribe los alias en el
config del clon y exige que el criterio 5 siga diciendo que faltan.

### Las opciones

**Opcion A · el laboratorio vive fuera del repositorio del curso.** El
participante copia la carpeta del laboratorio a un lugar suyo, o la recibe
suelta, y trabaja ahi. Desaparecen los cuatro efectos de golpe, sin trucos:
sin un `.git` por encima, Git vuelve a fallar fuerte y a tiempo ante cada uno
de los errores de arriba.

Comprobado: `verificar.sh` **funciona sin un solo cambio** fuera del
repositorio del curso, porque resuelve la ruta contra su propia ubicacion
(regla 3). El unico ajuste seria cosmetico, la etiqueta
`labs/lab-01/recetario` que sale en los mensajes.

El costo es que `labs/` deja de ser el lugar donde se trabaja y pasa a ser el
lugar donde se guarda el original, y hay que decir en alguna parte como se
copia. Tambien conviene saber si el participante recibe el material como
repositorio clonado o como carpeta suelta: si es lo segundo, el problema nunca
existio y la opcion A es solo escribirlo.

**Opcion B · se mantiene el anidamiento y se pone un techo.**
`GIT_CEILING_DIRECTORIES` le prohibe a Git subir mas alla de una carpeta.
Comprobado: restituye el `fatal: not in a git directory` y deja el repositorio
del participante funcionando entero.

Pero es una variable de entorno que hay que tener puesta en cada terminal, con
una ruta absoluta distinta en cada maquina. Sostenerla pide un script
envoltorio o pedirle al participante que la exporte, y eso contradice que el
laboratorio sea autocontenido y sin preparacion previa. Ademas introduce en la
sesion 1 un concepto que el taller no enseña.

**Opcion C · se deja como esta y se advierte en el enunciado.** Se descarta:
el punto 2.2 del SPEC 004 prohibe editar el enunciado, y una advertencia no
impide nada. El participante que se equivoca de carpeta es precisamente el que
no esta leyendo.

**Recomendacion: la opcion A.** Es la unica que elimina la causa en vez de
taparla, no cuesta ningun cambio en el verificador y devuelve a Git su mejor
propiedad para quien esta aprendiendo, que es negarse a tiempo y decir por que.

### La decision

El product owner eligio la **opcion A**, y confirmo el dato que faltaba: **el
participante clona el repositorio del curso**, asi que hay un `.git` por encima
y los cinco efectos son reales, no hipoteticos.

La regla que salio de aqui, y la unica que hay que leer para escribir los
catorce laboratorios que faltan, es la seccion 17.

## 17. REGLA · el trabajo del participante nunca vive dentro del clon

Esta es la regla de estructura de todos los laboratorios, los quince. Va aparte
de las seis reglas de la seccion 15 porque aquellas gobiernan como se escribe un
verificador y esta gobierna donde ocurre el ejercicio.

### La regla

**El participante clona el repositorio del curso. Su trabajo va fuera de ese
clon, en una carpeta hermana.**

```
<donde el participante clono>/
├── curso-git-gitlab-sii/        el clon: enunciados y verificadores
└── taller-git-trabajo/          el trabajo del participante
    ├── lab-01/
    │   └── recetario/
    ├── lab-02/
    └── ...
```

Hermana del clon y no dentro del directorio personal: el trabajo del taller
completo queda en una sola carpeta que se borra de una vez al terminar, sin ir a
buscar restos a `~`.

Cada laboratorio se lleva su propia subcarpeta bajo `taller-git-trabajo`, de
modo que los quince conviven sin pisarse y el participante puede volver a
cualquiera.

### Por que, con los cinco efectos

Trabajar dentro del clon no es incomodo, es **peligroso**, y de una forma
particularmente mala para quien esta aprendiendo: convierte errores que Git
atrapaba en el acto en errores silenciosos que se cobran despues y en otra
parte.

La causa es una sola. Git, cuando no encuentra un `.git` propio, sigue subiendo
por el arbol de directorios hasta dar con el de mas arriba. Dentro del clon
siempre hay uno.

Los cinco efectos, todos comprobados sobre un clon de mentira:

1. **`git config` sin `--global` escribe en el clon del curso.** Fuera de un
   repositorio la misma orden responde `fatal: not in a git directory` y el
   participante se entera al instante. Dentro del clon funciona y no dice nada.
   La Parte 1 del laboratorio 01 ocurre antes de que exista el repositorio del
   participante, asi que este caso no es rebuscado: es el camino por defecto.
   Peor, la seccion 1.4 del enunciado explica que hace `--global`, o sea invita,
   con toda razon pedagogica, al experimento que ensucia el clon.

2. **Los alias quedan en el clon y no llegan al repositorio del participante.**
   El `git lg` que manda usar el enunciado responde
   `git: 'lg' is not a git command`, y el criterio 5 falla sin que el
   participante pueda entender por que: el escribio los alias y los vio
   aceptados.

3. **Las confirmaciones se firman con la identidad equivocada**, la que hubiera
   en el config global, no la que el participante acaba de escribir. En una
   maquina sin identidad global, Git directamente se niega a confirmar.

4. **`git status` y `git add .` desde la carpeta equivocada operan sobre el
   clon.** El enunciado promete «no hay confirmaciones todavia» y el
   participante ve el estado del curso; y `git add .`, que el enunciado manda en
   la Parte 3.3, prepara el clon entero.

5. **`git reset --soft HEAD~1` destruye una confirmacion del curso.** Es la
   orden de la seccion «Si algo salio mal», o sea la que corre justo quien ya
   esta perdido y menos va a mirar en que carpeta esta. Comprobado: se llevo una
   confirmacion por delante y dejo todo preparado.

El sexto efecto era del verificador y esta contado en la seccion 16: sin
repositorio, el criterio 5 leia los alias del clon y daba por aprobado un
ejercicio que nadie habia hecho.

### Lo que se descarto

**Poner un techo con `GIT_CEILING_DIRECTORIES`** funciona, esta comprobado:
restituye el `fatal: not in a git directory` y deja el repositorio del
participante entero. Pero es una variable de entorno con una ruta absoluta
distinta en cada maquina, que hay que tener puesta en cada terminal. Sostenerla
pide un script envoltorio o pedirle al participante que la exporte, y eso
contradice que el laboratorio sea autocontenido y sin preparacion previa.
Ademas mete en la sesion 1 un concepto que el taller no enseña.

**Advertir en el enunciado** no impide nada. El participante que se equivoca de
carpeta es precisamente el que no esta leyendo.

### Que cambio al aplicarla

- El enunciado del laboratorio 01 manda crear el recetario en
  `taller-git-trabajo/lab-01`, partiendo desde la raiz del clon. Sigue siendo el
  unico cambio autorizado sobre el original que entrego el product owner, ahora
  con otro destino.
- `verificar.sh` deduce el clon de su propia ubicacion, sube al padre y busca el
  trabajo en la carpeta hermana. Sigue corriendose sin argumentos desde
  `labs/lab-01`, que es lo unico que el participante tiene que saber.
- La exclusion `labs/*/recetario/` se saco del `.gitignore`, porque ya no hay
  nada del participante dentro del clon que excluir. Se dejo `recetario/`, que
  por ser un patron sin anclar sigue haciendo de red por si alguien se salta el
  enunciado.
- Las pruebas montan la disposicion real, con un clon de verdad y el trabajo
  afuera, y **siguen vigilando el anidamiento** aunque ya no deberia ocurrir: si
  alguna vez el trabajo volviera a quedar bajo un repositorio, la regla 1 de la
  seccion 15 tiene que seguir atrapandolo. Se comprobo que esas pruebas fallan
  contra la version vieja del verificador; una prueba que nunca se vio fallar no
  prueba nada.

---

# SPEC 005 · Laboratorio 02 armado

## 18. Forma de los laboratorios con escenario

El laboratorio 01 parte sin repositorio, porque crearlo es el ejercicio. Del 02
en adelante cada laboratorio parte de un escenario armado, con historia previa,
autores, fechas y errores plantados.

**Cada laboratorio arma su propio escenario con un script local.** No se usa
`semillas/`, no se clona ningun paquete y no hay infraestructura compartida
entre laboratorios. Un laboratorio es una carpeta con todo lo que necesita
adentro.

```
labs/lab-02/
├── README.md        enunciado que lee el participante
├── preparar.sh      arma el escenario inicial
└── verificar.sh     comprueba si el laboratorio quedo bien
```

El trabajo del participante sigue viviendo fuera del clon, en
`taller-git-trabajo/lab-02/recetario`, por la regla de la seccion 17. Los dos
scripts deducen esa ruta de su propia ubicacion y se corren sin argumentos.

### El escenario es determinista

`preparar.sh` construye el repositorio desde cero con ordenes de Git reales, y
produce **los mismos identificadores de confirmacion en cualquier maquina y en
cualquier momento**. Eso permite que un enunciado cite una confirmacion y que el
verificador compare contra un estado conocido.

Las tres tecnicas son las del SPEC 003, ahora sin biblioteca compartida:

- Las fechas van como epoca y no como texto. `date` no acepta los mismos
  argumentos en BSD y en GNU, y de ahi salen historias distintas segun la
  maquina.
- Autor y confirmador se fijan en cada confirmacion, con el mismo instante. Si
  el confirmador tomara la hora del reloj, el identificador cambiaria en cada
  ejecucion.
- `core.autocrlf` y `core.eol` se fijan en el repositorio generado. Sobre
  Windows, el final de linea cambiaria el contenido confirmado y con el los
  identificadores.

Hay dos pruebas que lo fijan: una corre la preparacion dos veces y compara, y
otra la corre en dos carpetas distintas y con configuraciones globales
distintas, que es lo que se parece a dos maquinas.

## 19. Decisiones no especificadas del SPEC 005

### El verificador tiene dos modos, y por eso puede rechazar un laboratorio sin hacer

Este es el punto delicado del SPEC 005. El punto 3.4 pide que la preparacion
llame al verificador para comprobar que el escenario quedo bien; el punto 6.3
pide que el verificador **rechace** el escenario recien preparado. Son dos
comprobaciones opuestas sobre el mismo repositorio.

Se resolvio con un solo archivo y dos modos:

- `./verificar.sh` comprueba el **estado final**: si el participante hizo el
  laboratorio. Es el que corre el participante y el unico que el enunciado
  menciona.
- `./verificar.sh --escenario` comprueba el **estado inicial**: si la
  preparacion dejo el escenario como corresponde. Lo usa `preparar.sh` y nadie
  mas.

Un solo archivo evita que las dos descripciones del mismo escenario se separen
con el tiempo. El modo `--escenario` comprueba ademas lo que el enunciado
necesita para funcionar y el modo final no mira: los tres autores, que Juana
Perez firme alguna confirmacion, que las fechas se repartan en varios meses de
2024, que la historia sea lineal y que `curanto` este en el contenido.

Lo que separa un laboratorio hecho de uno sin empezar **no es la cantidad de
confirmaciones**, porque en los dos estados hay cinco. Son dos cosas: el mensaje
mal escrito ya no esta en la historia, y el area de preparacion quedo vacia. Un
verificador que solo contara aprobaria un laboratorio sin tocar, y hay una
prueba dedicada a que eso no vuelva a ser posible.

### El repositorio se comprueba como un criterio mas

El SPEC 005 lista cinco criterios en el punto 6.2 y el verificador imprime seis.
El que sobra es que exista el repositorio, que la regla 1 de la seccion 15 exige
comprobar comparando la cima. Se imprime como criterio propio, igual que en el
laboratorio 01, para que el participante que todavia no preparo el laboratorio
lea que le falta eso y no cinco fallas sueltas.

### El borrado se avisa, se pregunta y se marca

`preparar.sh` destruye el repositorio del participante cuando rehace el
escenario. Antes avisa con un bloque de ATENCION que dice exactamente que se
pierde, pregunta y solo sigue si la respuesta es `si`. Con `--forzar` no
pregunta, que es lo que usan las pruebas.

Si no hay terminal y no se paso `--forzar`, **se detiene en vez de borrar**. Un
script de preparacion que arrasa con el trabajo de la clase porque nadie pudo
contestarle es peor que uno que no corre.

### La palabra `curanto` vive en `platos.md` y no se mueve

El enunciado la busca con `git log -S`. Entra en la segunda confirmacion y
ninguna parte del ejercicio la toca: los dos archivos que el participante
manipula son `ingredientes.md` y `cocineros.md`. Asi el criterio no depende de
que el participante haga bien o mal los pasos anteriores, solo de que no haya
destruido la historia.

### En Bash 3.2, `«$VARIABLE»` no es lo que parece

Escribir `"«$MENSAJE_MALO»"` hacia que Bash 3.2 tomara los bytes de `»` como
parte del nombre de la variable y muriera con `unbound variable`.

Dejo de ser una nota del laboratorio 02: es la **regla 7 de la seccion 15**, que
rige para todo verificador de laboratorio.

## 20. Los criterios del SPEC 005

| Criterio | Estado |
|---|---|
| CA1 · `labs/lab-02/` con los tres archivos | cumplido |
| CA2 · escenario de la seccion 4 y dos corridas iguales | cumplido |
| CA3 · avisa y pregunta antes de rehacer | cumplido |
| CA4 · rechaza el escenario sin trabajo hecho | cumplido |
| CA5 · aprueba el hecho y rechaza cada criterio roto | cumplido, seis criterios |
| CA6 · el enunciado difiere solo en los cambios autorizados | cumplido, con una salvedad |
| CA7 · nada invoca `semillas/` | cumplido |
| CA8 · la suite pasa completa | cumplido, 370 pruebas |

### Los cambios autorizados sobre un enunciado del 02 al 13

Los enunciados los escribio el product owner y no se reescriben. Sobre todos los
del 02 al 13 se aplican **los mismos cinco cambios**, y ninguno mas:

1. **La preparacion.** Donde dice `semillas/preparar.sh NN`, va
   `labs/lab-NN/preparar.sh` de ese laboratorio.
2. **La ruta de trabajo.** Pasa a `taller-git-trabajo/lab-NN/recetario`, con la
   frase aclaratoria del punto de partida: «Tu trabajo no va dentro del clon del
   curso, va al lado. Parate en la raiz del clon...».
3. **El rescate.** Donde manda preparar la semilla de nuevo, va volver a
   ejecutar `preparar.sh`.
4. **Lo que el script hace.** «El script clona la semilla» pasa a «El script
   arma el escenario». Todos los enunciados del 02 al 13 traen esa frase y
   dejarla haria que el enunciado dijera algo falso sobre lo que acaba de
   ocurrir. Autorizado por el product owner sobre los que vienen.
5. **El subtitulo.** Donde dice «repositorio semilla lab-NN», se saca esa parte
   y queda solo la sesion y la duracion. Ya no hay semilla que prometer.

### El hallazgo del punto 5.4 · corregido

**El enunciado, seguido en el orden que traia, no alcanzaba su propia seccion de
Comprobacion.** El paso 3.1 hacia `git commit --amend`, que confirma lo que haya
en el area de preparacion, o sea el cambio de `cocineros.md` que el paso 3.3
tenia que sacar. Cuando el participante llegaba a 3.3 ya no quedaba nada, y la
Comprobacion pide que `cocineros.md` aparezca modificado. Ninguna orden fallaba:
el participante se enteraba al final, o no se enteraba.

El product owner autorizo el arreglo. La parte 3 quedo en este orden:

| Ahora | Antes | Que hace |
|---|---|---|
| 3.1 | 3.2 | descartar el cambio que no servia |
| 3.2 | 3.3 | sacar el archivo preparado por error |
| 3.3 | 3.1 | corregir el mensaje con `--amend` |
| 3.4 | 3.4 | retroceder y volver a confirmar |

Se movio el `--amend` al final en vez de mover el otro paso al principio, que
era lo mas obvio. El apartado del archivo preparado por error termina diciendo
«Fijate en la diferencia con el paso anterior», y compara `git restore --staged`
con el `git restore` a secas del apartado de al lado. Llevandolo al principio,
esa frase se quedaba sin paso anterior que mirar.

Quedan tres pruebas: una de guardia, que comprueba que con el `--amend` por
delante el laboratorio no se puede terminar; otra que el orden de hoy aprueba; y
una tercera sobre el texto del enunciado, para que el orden no se pueda revertir
en silencio.

---

# Laboratorio 03 · abrir la caja

## 21. Decisiones del laboratorio que abre la caja

> **Numeracion.** Esto se escribio cuando abrir la carpeta oculta era el
> laboratorio 03. Con el SPEC 009 dejo de ser un laboratorio aparte y quedo
> como la **parte 4 del laboratorio 02**. Todo lo que dice esta seccion sigue
> valiendo, ahora sobre el escenario del 02. La tabla de renumeracion completa
> esta en la seccion 31.

Fue el primero armado replicando la forma de la seccion 18, y el que muestra que
esa forma no es mecanica: el escenario que necesita cada laboratorio sale de lo
que su enunciado hace mirar.

### El escenario no tiene nada sucio, y aun asi hay que cuidarlo

Cuatro confirmaciones, historia lineal, directorio limpio. Ningun error
plantado, porque el laboratorio no arregla nada. Lo que hay que cuidar es otra
cosa: **que la carpeta oculta tenga contenido que valga la pena inspeccionar**.

Eso se traduce en cuatro cosas que el escenario garantiza y el modo
`--escenario` comprueba:

- `.git/refs/heads/main` es un archivo suelto de **41 bytes**. La parte 2.2 del
  enunciado lo mide con `wc -c` y saca de ahi toda su conclusion.
- El arbol de la raiz tiene la carpeta `recetas` **como arbol**. Sin un arbol
  dentro del arbol, la parte 3.5, que entra a una carpeta, no tiene por donde
  entrar.
- Los objetos estan **sueltos**, no empaquetados. La parte 3 los recorre uno por
  uno.
- `.git/config` trae **configuracion local de verdad**. La parte 1.2 lo lee, y
  sin `[user]` adentro no dice nada.

### Se pide el formato de referencias `files` explicitamente

Git 2.45 trajo `reftable`, un segundo formato que guarda las referencias en una
base binaria. Con el, **`.git/refs/heads` no existe**:

```
$ git init --ref-format=reftable ...
$ ls .git/refs/heads
ls: .git/refs/heads/: Not a directory
```

El laboratorio 03 entero se cae ahi. La parte 2.2 no tiene archivo que leer ni
que medir, y la conclusion que sostiene el laboratorio, que una rama son
cuarenta y un bytes de texto, deja de ser cierta.

Por eso `preparar.sh` pide `--ref-format=files` y no deja que lo decida la
maquina del participante. Si la version de Git no conoce esa opcion, cae en el
`init` normal, que en esas versiones solo sabe hacer `files`. El modo
`--escenario` lo comprueba igual, asi que un dia que esto cambie el escenario no
se entrega roto: se detiene antes.

Tambien se fija `gc.auto 0`, para que nada empaquete los objetos por su cuenta,
y `core.logAllRefUpdates true`, porque el registro de referencias es la unica
huella que deja la parte 4 y no puede depender de lo que el participante tenga
configurado.

### El criterio que impide aprobar un laboratorio sin abrir

Es la **regla 8 de la seccion 15**, que nacio aqui. Los tres criterios que el
enunciado lista en su Comprobacion se cumplen solos en el escenario recien
preparado. El cuarto criterio mira el registro de referencias y exige el paso
por la rama `prueba` que pide la parte 4.

Hay dos pruebas dedicadas: una comprueba que el escenario recien preparado da
**4 de 5** y no aprueba, y otra deja escrito que los otros cuatro criterios ya
pasaban antes de empezar, que es la razon de existir del quinto.

### Lo que el enunciado da por sentado y no se cumple

**La parte 1.2 dice que en `.git/config` esta «lo que configuraste sin
`--global` en el laboratorio 01». No es asi.**

En el laboratorio 01 el participante configura todo **con** `--global`: es lo que
manda el enunciado del 01, y su seccion 1.4 solo explica la diferencia entre
global y local, sin hacerle poner nada local. Ademas este repositorio no es el
que el participante creo en el 01, lo arma `preparar.sh`.

Lo que el participante encuentra al hacer `cat .git/config` es la configuracion
del recetario: `user.name = Juana Perez`, los finales de linea y poco mas. La
leccion de fondo de esa seccion sigue en pie, que la configuracion es texto
plano y se puede leer y editar a mano. Lo que no calza es la frase que se la
atribuye al participante.

**No se toco**, porque no esta entre los cambios autorizados. Decide el product
owner.

---

# SPEC 006 · El simulador ejecutable desde el clon

## 22. PRINCIPIO · el repositorio del curso es autosuficiente

Esta regla gobierna el proyecto completo y todo lo que venga despues la hereda.

**Un participante que clona este repositorio obtiene todo lo necesario para las
treinta y dos horas del taller: sin instalar nada, sin permisos de
administrador y sin acceso a la red mas alla del clon inicial.**

La razon no es comodidad. La red institucional del SII tiene proxy con filtrado
y las maquinas tienen permisos restringidos. **Cualquier paso que dependa de
instalar algo es un punto donde el taller se cae en clase**, y se cae delante de
treinta personas que no pueden hacer nada al respecto.

Lo que la regla implica en concreto:

- El simulador se abre con doble clic desde el clon. No se construye.
- Los laboratorios se preparan y se verifican con Bash y Git, que el
  participante ya tiene porque son la materia del taller.
- Nada descarga nada. Ningun script sale a la red.
- Node, `npm`, las pruebas y la construccion son **herramientas de desarrollo**.
  No hay que eliminarlas; hay que asegurarse de que el participante nunca las
  necesite.

Al agregar cualquier pieza al repositorio, la pregunta es siempre la misma:
¿funciona en una maquina del SII recien clonada, sin instalar nada? Si la
respuesta es no, la pieza no esta terminada.

### El artefacto construido va versionado, y es a proposito

`simulador/dist/index.html` esta confirmado en el repositorio. Va contra la
costumbre de no versionar resultados de construccion, y aqui corresponde: es la
unica forma de cumplir el principio de arriba.

Queda escrito aqui, y tambien en los dos archivos de exclusiones, para que nadie
lo saque mas adelante creyendo que es un descuido. **Si se saca, el taller deja
de funcionar en las maquinas del SII.**

### Que impide que el artefacto se desincronice

Ese es el riesgo real de la decision anterior: un artefacto versionado a mano se
queda viejo y nadie lo nota hasta la sala de clases.

Lo cuida `simulador/dist/manifiesto.txt`, con la misma idea que el SPEC 003 uso
para los paquetes de semilla contra sus generadores. Anota dos huellas:

- **`fuentes`**, sobre todo lo que determina el contenido del artefacto: `src/`,
  `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` y
  `package-lock.json`. Las pruebas quedan fuera a proposito, porque cambiarlas
  no cambia lo que se construye y exigir una reconstruccion por cada prueba
  nueva convertiria la comprobacion en ruido.
- **`artefacto`**, sobre el `dist/index.html` que quedo.

`npm run build` las escribe. La suite las recalcula en cada corrida, y
`npm run comprobar` hace lo mismo suelto. Si alguien toca el simulador y no
reconstruye, las pruebas fallan y dicen exactamente que orden correr.

Hay cuatro pruebas que ven fallar la comprobacion de verdad, alterando archivos
en el disco y restaurandolos despues: codigo cambiado sin reconstruir, artefacto
editado a mano, copia de la raiz atrasada y manifiesto sin huellas.

### Por donde entra el participante

`SIMULADOR.html`, en la raiz del clon, **copia exacta** de
`simulador/dist/index.html`. La escribe `npm run build`.

Se eligio una copia y no una pagina de redireccion por dos razones.

La primera es que **la copia no cuesta almacenamiento**. Git guarda el contenido
por su huella, y dos rutas con bytes identicos comparten el mismo objeto: lo que
se agrega es una entrada en el arbol, no un segundo archivo de 260 KB.

```
  hash del original: 03c621932000372125288b6b2817cb4e65ba7901
  hash de la copia:  03c621932000372125288b6b2817cb4e65ba7901
```

La segunda es que una redireccion `<meta http-equiv="refresh">` sobre `file://`
depende de que el navegador la respete, y eso no se pudo comprobar en las
maquinas del SII. Con una copia no hay nada que respetar: el doble clic abre el
simulador, sin paginas intermedias y sin un clic de mas.

Que las dos rutas no se separen tambien lo cuida el manifiesto: hay un criterio
que compara sus huellas.

### El peso

Medido sobre un clon de verdad, con `--no-local` para que no use enlaces duros
y el paquete sea el que viajaria por la red:

| | |
|---|---|
| El artefacto en disco | 256 KB |
| Lo que aporta comprimido, que es como lo guarda Git | 79 KB |
| El paquete completo que baja un clon | 2,9 MB |
| El clon en disco, con el arbol de trabajo | 5,7 MB |

Las dos rutas del artefacto comparten objeto, asi que la copia de la raiz no
agrega nada al paquete.

Cada reconstruccion si agrega una version nueva a la historia, unos 79 KB. Cien
reconstrucciones son ocho megabytes: el repositorio sigue clonandose en
segundos. No hay motivo para preocuparse por el peso.

---

# SPEC 007 · Un escenario de simulador por laboratorio

## 23. El escenario se declara una vez y lo usan los dos lados

Antes el simulador traia cuatro escenarios llamados E1 a E4, pensados por
sesion, que no correspondian a ningun laboratorio. El participante abria el
simulador durante un laboratorio y veia **un repositorio distinto** del que
tenia en su terminal: otras confirmaciones, otras ramas, otros identificadores.

**Un laboratorio tiene un escenario, y ese escenario se declara una sola vez**,
en `simulador/src/escenarios/laboratorios.ts`. De esa declaracion salen dos
cosas:

- El estado inicial que carga el simulador.
- El repositorio que `preparar.sh` arma en el disco del participante.

### Como se conectan los dos lados

El SPEC 007 ofrecia dos caminos: generar `preparar.sh` desde la declaracion, o
escribirlo a mano y comparar. **Se eligio comparar**, y no por comodidad.

Generar los scripts obligaba a meter el contenido de los archivos en la
declaracion, a emitir Bash desde TypeScript en tiempo de construccion y a
versionar esos `.sh` generados con su propio problema de sincronia, que es
exactamente el que el SPEC 006 acaba de resolver para el artefacto. Ademas
habria que reproducir en el generador todo lo que los scripts ya hacen bien: el
aviso antes de borrar, la confirmacion interactiva, `--forzar`, la comprobacion
del escenario antes de entregarlo.

Los scripts se escriben a mano, y `tests/escenarios-contra-disco.test.ts` corre
`preparar.sh` de verdad y compara su resultado contra la declaracion:

| Se compara | No se compara |
|---|---|
| Los mensajes, en orden | **Los identificadores** |
| El autor de cada confirmacion | |
| La fecha de cada confirmacion | |
| Los archivos que cada una registro | |
| Las ramas y a que confirmacion apuntan | |
| El puntero de posicion | |
| Las etiquetas | |
| El estado de cada archivo del directorio | |

Los identificadores no coinciden y no tienen por que: el simulador genera los
suyos con una huella FNV sobre una semilla textual, porque no versiona
contenido. Lo que tiene que coincidir es la forma.

Seis pruebas mas alteran la declaracion a proposito y exigen que la comparacion
lo note: un mensaje cambiado, una confirmacion de mas, un autor distinto, una
fecha distinta, un archivo con otro estado y una rama que apunta a otro lado.

### Donde vive el contenido de los archivos

**En `preparar.sh`, no en la declaracion.**

El simulador no modela contenido (restriccion R4 del SPEC 001): un archivo es un
nombre y un estado declarado. Meter los bytes en la declaracion los cargaria en
el artefacto que el participante abre, para no mostrarlos nunca.

La declaracion es duena de **la forma**; el script es dueno de **los bytes**; la
prueba obliga a que la forma calce. El contenido no entra en la comparacion
porque el simulador no tiene con que compararlo.

### Que se le agrego al formato declarativo

El formato ya existia y se extendio en vez de armar uno nuevo:

- **Autor, correo y epoca por confirmacion.** Antes todas las confirmaciones de
  un escenario las firmaba el participante con una fecha derivada de un
  contador. Los laboratorios necesitan historias escritas por varias personas en
  fechas concretas, que es lo que el laboratorio 02 hace filtrar.
- **`epoca` en segundos**, la misma unidad que `preparar.sh` le pasa a Git. Una
  sola unidad es lo que permite comparar las fechas de los dos lados.
- **`iniciado`**, para que el laboratorio 01 arranque sin repositorio.
- **`guardados`**, entradas del guardado temporal, que el estado ya soportaba y
  la declaracion no podia expresar.
- **`sinReflejar`**, la lista de lo que un escenario no puede mostrar con el
  motor de hoy.

### El selector y la preseleccion

El selector ofrece los diez laboratorios con escenario, con su numero y su
nombre: `Lab 02 · Leer la historia y volver atras`.

Al abrir el simulador se puede pedir un laboratorio en la direccion del archivo,
con `?lab=06` o con `#lab-06`, y ambos aceptan `6`, `06` o `lab-06`. Sin
parametro se abre el laboratorio 01. El participante puede cambiar de escenario
con el selector igual que antes.

**Funciona desde el sistema de archivos.** La parte de consulta y el fragmento
viajan en la propia direccion `file://` y no exigen ninguna lectura externa, que
es lo que un navegador bloquea (restriccion R2 del SPEC 001). Comprobado sobre
el artefacto construido, abierto en Chrome por `file://`: sin parametro dibuja
cero nodos, que es el laboratorio 01 sin repositorio, y con `?lab=06` dibuja
siete, que son las confirmaciones de ese escenario.

Elegir escenario es una decision de dominio, asi que vive en la capa de vista y
no en los componentes. La prueba de arquitectura del SPEC 002 lo atrapo cuando
se habia puesto en `Aplicacion.tsx`.

## 24. Que laboratorios llevan escenario, y que no se puede mostrar

> **Numeracion.** Los numeros de esta seccion son los del SPEC 009, que dejo el
> taller en catorce laboratorios. La tabla de equivalencia con la numeracion
> anterior esta en la seccion 31.

Llevan escenario **los laboratorios 01 al 07 y el 09**, que son los que ocurren
en disco y tienen grafo que mirar. No llevan el 10, 11, 13 y 14, porque ocurren
en la plataforma, ni el 12, que es integracion continua. Tampoco el 08, por la
razon que se explica mas abajo.

De los ocho, **tienen `preparar.sh` en el repositorio los del 02 al 06**, que
son los laboratorios armados hasta hoy. Los demas estan declarados y a la
espera: cuando cada laboratorio se arme, su script entra solo a la comparacion y
tiene que calzar con lo declarado. Una prueba enumera cuales faltan, de modo que
la lista no pueda quedar vieja en silencio.

Los escenarios del 03 en adelante se derivaron primero de los verificadores de
las semillas del SPEC 003 y despues se rehicieron contra los enunciados, que es
la unica fuente que manda (seccion 29).

### El laboratorio 08 · no lleva escenario

**Decision del product owner: el laboratorio que enseña remotos queda fuera del
simulador.** Es de terminal pura. Era el 09 y con el SPEC 009 es el 08.

Se intento darle escenario y el resultado dejaba a la vista el problema: se
mostraba la historia local de cuatro confirmaciones y un remoto declarado, o
sea todo menos lo que el laboratorio viene a enseñar. Un escenario que no
muestra la materia del laboratorio confunde mas de lo que ayuda.

Esto es lo que el motor de hoy no puede mostrar:

- **Las ramas de seguimiento remoto**, como `origin/main`. El estado guarda los
  remotos como nombre y direccion, y no tiene donde poner sus ramas. El
  enunciado compara `main` con `origin/main` y eso no se puede dibujar.
- **El segundo remoto y las ordenes de red.** No hay `fetch`, `pull`, `push` ni
  `clone` en el motor: la carta de ordenes del SPEC 001 no las incluye.
- **El submodulo de condimentos.** El motor no modela submodulos, ni el archivo
  `.gitmodules`, ni un repositorio dentro de otro.
- **El gancho de pre-confirmacion.** El motor no ejecuta ganchos.

**No se invento soporte nuevo**, como el SPEC 007 pidio. Si alguna vez se quiere
que ese laboratorio se pueda seguir en el simulador, lo que hace falta es al
menos ramas de seguimiento remoto y las ordenes de red, y eso es un spec propio.

Los escenarios quedan entonces en **ocho**: los laboratorios 01 al 07 y el 09.

### El laboratorio 01 · la unica licencia

En el disco, el participante crea los archivos del recetario uno a uno a medida
que avanza. En el simulador aparecen los seis desde el principio, sin
seguimiento, para que haya algo que preparar y confirmar sin tener que teclear
seis ordenes de creacion primero.

Es la unica libertad que se toma un escenario respecto del disco, esta anotada
en su `sinReflejar`, y no afecta a la comparacion porque el laboratorio 01 no
tiene `preparar.sh`: su repositorio lo crea el participante.

---

# SPEC 008 · Pruebas de punta a punta, simulador contra Git real

## 25. Cada laboratorio recorrido dos veces en paralelo

Hasta aqui el simulador estaba probado contra su propio modelo. Nadie habia
comprobado que la pantalla real respondiera, ni que lo que muestra coincida con
lo que Git hace de verdad.

Ahora cada laboratorio se recorre dos veces: una en el simulador, escribiendo
en su consola como lo haria el participante, y otra en un repositorio de Git
real. **Si el simulador le enseña al participante algo distinto de lo que va a
ver en su terminal, la prueba falla.**

Se corre con una sola orden:

```bash
cd simulador
npm run e2e
```

Lo que se prueba es **el artefacto construido y versionado**, servido por un
servidor de una sola pieza que vive en la configuracion de Cypress. Cypress y
ese servidor son herramientas de desarrollo: el participante no los necesita
nunca y la regla de la seccion 22 sigue intacta.

### Las ordenes salen del enunciado

Este es el punto que decide si la prueba sirve. Las ordenes se extraen de los
bloques del `README.md` de cada laboratorio, en orden, y **no hay ninguna lista
escrita aparte**. Una lista aparte se desincroniza del enunciado la primera vez
que alguien corrige un paso, y desde ahi la prueba valida un laboratorio que ya
no existe.

Cada linea se clasifica en tres:

| Clase | Simulador | Git real | Cuando |
|---|---|---|---|
| `comparada` | si | si | el caso corriente |
| `solo-git` | no | **si** | el motor no la implementa |
| `omitida` | no | no | no es ejecutable tal como esta escrita |

Las `solo-git` **se siguen ejecutando en Git**, para que el repositorio no se
desalinee de ahi en adelante. Ninguna se salta en silencio: cada una lleva su
motivo y la prueba informa cuantas fueron.

### Al motor se le pregunta que sabe hacer

Que una orden este soportada no se decide con una lista a mano: se consulta la
tabla de ordenes del propio motor, `ORDENES_GIT` y `ORDENES_INTERPRETE`. El dia
que el motor aprenda una orden nueva, la prueba la recoge sola y deja de
saltarla.

La lista a mano queda reducida a los casos donde el verbo si existe pero esa
forma concreta no, como `git config --list` o `cat .git/HEAD`.

### Los marcadores de posicion

El enunciado escribe `git restore <archivo>` a proposito, para que el
participante mire su estado y decida. Saltarse esos dos pasos habria dejado sin
probar el centro del laboratorio 02.

Se resuelven, y el valor **no se escribe a mano**: sale de la declaracion del
escenario, que ya es la unica fuente de la forma del laboratorio (seccion 23).
Si el escenario cambia de archivo, la sustitucion cambia con el.

Los marcadores que nombran un identificador de confirmacion se quedan sin
resolver: los del simulador y los de Git no coinciden por diseño, asi que no
hay un unico valor que sirva en los dos lados. Todos ellos son ordenes de solo
mirar, de modo que no desalinean nada.

**No hizo falta modificar ningun enunciado.**

### Que se compara y que no

| Tiene que coincidir | No tiene que coincidir |
|---|---|
| La cantidad de confirmaciones y sus mensajes | **Los identificadores** |
| Las ramas y a que confirmacion apunta cada una | Las fechas exactas |
| Donde esta parado el puntero de posicion | El contenido de los archivos |
| Las etiquetas | |
| El estado de cada archivo | |
| Las entradas del guardado temporal | |

El estado del simulador **se lee del documento**, no del modelo: lo que se
compara es lo que el participante ve. Para eso la pantalla lleva atributos
`data-` que dicen lo que esta dibujando: cada confirmacion con su mensaje, cada
arista con sus extremos, cada etiqueta con su forma y la confirmacion de la que
cuelga, cada archivo con su estado.

Cuando algo no calza, el mensaje dice la orden, la linea del enunciado donde
esta y lo que mostro cada lado:

```
historia tras «git commit --amend -m "se corrige la receta del pastel de
choclo"» (enunciado, linea 225)
- 'se docuemnta la reseta del pastel de choclo se corrige la receta...'   (simulador)
+ 'se corrige la receta del pastel de choclo'                             (Git)
```

### Lo que no se puede automatizar

Hay pasos de los enunciados que no son ordenes, y quedan fuera por naturaleza:

- **Escribir el contenido de un archivo a mano.** El laboratorio 01 hace crear
  seis archivos con el editor. En el simulador se generan con `echo`, que marca
  el archivo pero no escribe contenido; en el disco haria falta un editor.
- **Seguir la cadena de objetos.** El laboratorio 03 pide copiar un
  identificador de una salida y pegarlo en la siguiente orden. Los dos lados dan
  identificadores distintos, asi que no hay un valor unico que pegar.
- **Responder con tus palabras.** La parte 4.4 del laboratorio 03 pide escribir
  que es una rama. No hay nada que ejecutar.
- **Resolver un conflicto en el editor**, elegir acciones en un rebase
  interactivo y todo lo que ocurre en la plataforma, que son los laboratorios 11
  en adelante.

En esos tramos una prueba manual sigue siendo necesaria.

## 26. La cobertura, con numeros

Medida sobre los dos laboratorios que hoy tienen `preparar.sh` y por lo tanto se
recorren de verdad:

| Laboratorio | Ordenes | Comparadas | Solo en Git | Omitidas | Cobertura |
|---|---|---|---|---|---|
| lab-02 | 40 | 35 | 3 | 2 | **88 %** |
| lab-03 | 33 | 9 | 19 | 5 | **27 %** |

Esas son cifras de corridas de verdad. Las de cualquier laboratorio sin
`preparar.sh` son estimaciones, y se dicen como tales.

El 27 por ciento del laboratorio 03 no es una falla de la prueba: **es lo que
ese laboratorio enseña**. Abre la carpeta `.git` y lee lo que hay dentro, y el
simulador no modela esa carpeta a proposito (restriccion R4 del SPEC 001). Las
diecinueve ordenes que se corren solo en Git son `cat .git/...`, `ls .git/...`,
`wc -c` y `git cat-file`. Lo que si se compara es lo que cambia el grafo: crear
la rama, cambiarse a ella, volver y borrarla.

Para los laboratorios que todavia no tienen `preparar.sh`, la clasificacion da
una estimacion que **no esta verificada**, porque no hay repositorio contra el
cual correrla. Cuando cada laboratorio se arme, su recorrido entra solo y la
cifra se vuelve real.

### El laboratorio 09 · la cifra que no hay que creerse

La clasificacion le da **73 por ciento**, y esa cifra **es optimista y esta sin
verificar**. Queda anotada aqui para que nadie la use como si fuera cobertura.

Es optimista porque cuenta `git remote` entre lo soportado, ocho veces, solo
porque el motor tiene una orden con ese nombre. Lo que el motor hace con ella es
guardar un nombre y una direccion: no trae nada, no publica nada y no crea
ninguna rama de seguimiento. Lo que el laboratorio 09 realmente enseña, que es
trabajar contra dos remotos, incorporar un submodulo y colgar un gancho, cae
entero del lado de lo no soportado.

Y esta sin verificar porque **no hay `preparar.sh` del laboratorio 09**, asi que
el recorrido comparado nunca se corrio. Una cifra de cobertura que no salio de
una corrida no es una cifra de cobertura.

El laboratorio 09 quedo ademas **fuera del simulador** (seccion 24). Es de
terminal pura.

## 27. El hallazgo · el espacio que se recortaba

Este es el error que encontro el SPEC 008, y la leccion que lo justifica entero.

`git status --porcelain` describe cada archivo con **dos columnas**: la primera
dice que hay en el area de preparacion y la segunda que hay en el directorio de
trabajo. Cuando el cambio no esta preparado, la primera columna **es un
espacio**:

```
M  cocineros.md      preparado
 M ingredientes.md   modificado, sin preparar
```

El lector de estado hacia `.trim()` sobre la salida completa. `trim()` recorta
tambien el comienzo, asi que **la primera linea perdia su espacio inicial** si
empezaba con uno. Con eso ` M ingredientes.md` pasaba a ser `M ingredientes.md`,
y el codigo que lee las columnas por posicion se equivocaba dos veces a la vez:

- `slice(0, 2)` devolvia `M ` en vez de ` M`: el archivo se leia como
  **preparado** cuando estaba **modificado sin preparar**. El estado exactamente
  al reves.
- `slice(3)` devolvia `ngredientes.md` en vez de `ingredientes.md`: **el nombre
  perdia su primera letra**.

El sintoma es desconcertante, porque el error habla de un archivo que no existe:

```
- [ 'cocineros.md:modificado' ]     lo que mostraba el simulador
+ [ 'ocineros.md:preparado'  ]      lo que se creyo leer de Git
```

### Por que la comparacion del SPEC 007 pasaba por casualidad

El mismo error estaba en `tests/escenarios-contra-disco.test.ts` desde que se
escribio, y sus veintiseis pruebas pasaban.

Pasaban porque en el escenario del laboratorio 02 la salida de `--porcelain`
empieza con `M  cocineros.md`, que **no lleva espacio delante**: ahi el archivo
preparado se ordena antes que el modificado, y `trim()` no tenia nada que
recortar. La segunda linea, ` M ingredientes.md`, conservaba su espacio porque
`trim()` solo toca los extremos de la cadena completa, no de cada linea.

Es decir: la comparacion era correcta **para el orden en que Git devolvio esos
dos archivos**, y habria empezado a fallar el dia que un escenario tuviera un
archivo modificado sin preparar antes que uno preparado, o solo archivos
modificados. Un error latente esperando un escenario distinto.

### La leccion

**Una prueba que compara dos representaciones del mismo hecho no vale mas que su
lector.** El SPEC 007 comparaba el escenario declarado contra el repositorio del
disco y daba verde, pero uno de los dos lados estaba mal leido; lo que
comparaba, sin saberlo, era un error contra si mismo en el unico caso en que ese
error no se notaba.

Lo que lo descubrio fue recorrer el laboratorio **orden por orden**, en vez de
mirar solo el estado inicial. En el estado inicial el orden de los dos archivos
escondia el problema; a mitad del recorrido, cuando el participante descarta el
cambio de `ingredientes.md`, queda un unico archivo modificado sin preparar y el
espacio recortado sale a la luz de inmediato.

Ese es el argumento del SPEC 008 completo: probar el estado final, o el inicial,
deja pasar errores que solo aparecen en los estados intermedios.

Quedo un ayudante `gitCrudo` aparte del `git` de siempre, con el motivo escrito
al lado, para que nadie vuelva a recortar esa salida.

## 28. Diferencias conocidas entre el motor y Git

El recorrido comparado del SPEC 008 encontro una sola diferencia real, y **se
deja sin arreglar a proposito**.

### `git commit --allow-empty`

El motor ignora la opcion y responde `nothing to commit, working tree clean`.
Git crea la confirmacion vacia.

No se arregla porque **no aparece en ningun enunciado del taller** ni en la
carta de ordenes de la seccion 7 del SPEC 001. Aparecio al escribir las pruebas
de la interfaz, donde hacia falta una confirmacion cualquiera; esas pruebas
usan ahora un cambio de verdad, que ademas se parece mas a lo que hace un
participante.

Queda anotado aqui para que, si algun dia un enunciado la usa, se sepa que hay
que implementarla antes.

### Los filtros de `git log` · el hallazgo que la comparacion de estado no veia

**El motor acepta `--author`, `--since` y `--until`, y los ignora.** No falla, no
avisa: muestra la historia entera.

Medido sobre el escenario del laboratorio 02, que tiene cinco confirmaciones de
tres autores repartidas en cinco meses:

| Orden | Git | Simulador |
|---|---|---|
| `git log --oneline` | 5 | 5 |
| `git log --author=Juana --oneline` | 2 | **5** |
| `git log --author=ZZZZ --oneline` | 0 | **5** |
| `git log --since=2024-08-01 --oneline` | 1 | **5** |
| `git log --until=2024-02-01 --oneline` | 1 | **5** |

Hay tres huecos mas en la misma orden:

- `git log --format="%an"` acepta el formato y lo ignora: muestra siempre la
  forma larga.
- `git log --oneline -- platos.md` falla con
  `fatal: ambiguous argument 'platos.md'`: no hay filtrado por archivo.
- `git log -S "curanto"` falla igual: el motor no versiona contenido, asi que no
  tiene donde buscar.

**Esto es exactamente lo que la Parte 1 del laboratorio 02 enseña**, punto por
punto: filtrar por autor, por fecha, por archivo y por contenido. Un participante
que practique esa parte en el simulador ve que el filtro no hace nada y concluye
que escribio mal la orden.

#### Por que la comparacion de estado no lo veia

Ninguna de esas ordenes **cambia el estado**. La comparacion del SPEC 008 miraba
la historia, las ramas, el puntero y los archivos despues de cada orden, y
despues de un `git log` todo eso esta igual en los dos lados. La prueba pasaba
en verde mientras el simulador enseñaba otra cosa.

Lo que lo destapo fue agregar una comprobacion mas: **que la orden falle en los
dos lados o funcione en los dos**. Con ella salieron a la luz `-S` y el filtrado
por archivo, que si fallan; y al mirarlos de cerca aparecieron los tres que no
fallan y tambien mienten.

La leccion se parece a la de la seccion 27: una comparacion no vale mas que las
cosas que decide mirar. Comparar el estado no alcanza para una orden cuya unica
salida es lo que imprime.

#### Que se hizo

Las seis formas quedan declaradas como no soportadas, cada una con su motivo, y
por lo tanto **se cuentan como saltadas** en el informe de cobertura. La
cobertura del laboratorio 02 baja al contarlas, y esa cifra mas baja es la
verdadera.

**No se arreglaron.** Implementar los filtros de `git log` es trabajo de motor y
no de este spec. Queda anotado que, mientras no se haga, la Parte 1 del
laboratorio 02 hay que practicarla en la terminal y no en el simulador.

### Los otros tres huecos, que aparecieron al armar el 05, el 06 y el 07

La misma comprobacion de paridad los encontro apenas los cuatro laboratorios
nuevos entraron al recorrido:

| Orden | Enunciado que la enseña | Que hace el motor |
|---|---|---|
| `git switch --detach HEAD~2` | 05, el estado desconectado | `fatal: invalid reference: 'HEAD~2'` |
| `git log --oneline main..azteca` | 06, ver que trae cada rama | `fatal: ambiguous argument` |
| `git log --oneline > archivo` | 07, guardar una foto del historial | `fatal: ambiguous argument '>'` |
| `git commit -c ORIG_HEAD` | 07, rehacer una confirmacion con el mismo mensaje | `Aborting commit due to empty commit message` |

El primero es el mas raro de los tres: **`git checkout HEAD~2` si funciona y deja
la posicion desconectada**, con su aviso y todo. Es la misma referencia relativa
y el mismo destino; lo que falla es resolverla desde `git switch`. Un
participante que siga el laboratorio 05 al pie de la letra se topa con eso.

El tercero no es de Git sino del interprete: el analizador entiende la
redireccion de `echo` sobre un archivo, que es como el simulador genera trabajo
pendiente, y no la de una orden de Git.

Los cuatro quedan declarados y **sin arreglar**, por la misma razon que los
filtros de `git log`: son trabajo de motor. Suman **diez formas conocidas** en
las que el simulador no acompaña al enunciado, todas anotadas y contadas.

Fuera de esto, en las ordenes comparadas de los laboratorios 02 y 03 el motor se
comporta como Git.

---

# Laboratorios 04 al 07 · sesiones 3 y 4 completas

## 29. Los cuatro laboratorios, y lo que las semillas no decian

> **Numeracion.** Escrita antes del SPEC 009: los numeros de esta seccion son
> los antiguos. Hoy el 04 es el 03, el 05 es el 04, el 06 es el 05 y el 07 es el
> 06. La tabla completa esta en la seccion 31.

Con el 04, el 05, el 06 y el 07 quedan cerradas las sesiones 1 a la 4: siete
laboratorios armados con la forma de la seccion 18, cada uno con su enunciado,
su preparacion, su verificador, su escenario en el simulador y su recorrido
comparado contra Git real.

Al armarlos aparecio algo que conviene dejar escrito.

### Las semillas del SPEC 003 no calzaban con los enunciados

Los escenarios del 04 al 10 se habian derivado en el SPEC 007 de los
verificadores de las semillas, que eran la descripcion mas precisa que existia
del estado inicial de cada laboratorio. **Al leer los enunciados de verdad, tres
de ellos no calzaban.**

| Laboratorio | Lo que decia la semilla | Lo que pide el enunciado |
|---|---|---|
| 04 | recetas de cazuela y charquican | **leche asada y mote con huesillo**, que son las que el enunciado separa en la carpeta de postres |
| 06 | dos ramas, `mexicana` y `peruana` | **tres ramas**, `tailandesa`, `azteca` y `andina`, una por cada caso de fusion |
| 07 | el error era una unidad de compra mal puesta | el error es **«sal marina en polvo»**, que es lo que el enunciado hace buscar por contenido |

El caso del 06 es el mas serio. El enunciado dice, en su primera linea, que se
van a fusionar **tres** ramas y que las tres se comportan distinto: una avanza
sin crear nada, otra crea una confirmacion de union y la tercera choca. La
semilla solo traia dos, y le faltaba justamente la del medio, que es la que
enseña que una union no siempre es un conflicto.

Con dos ramas el laboratorio se podia hacer, pero enseñaba dos de los tres casos
y su Comprobacion, que pide **dos confirmaciones de union**, era imposible de
cumplir.

**El enunciado manda.** Los tres escenarios se rehicieron contra el enunciado, y
la comparacion de la seccion 23 los ata a sus `preparar.sh`. Los enunciados no
se tocaron mas alla de los cinco cambios autorizados.

### El laboratorio 06 · las tres fusiones

La topologia esta calculada para que cada rama caiga en un caso distinto, y el
modo `--escenario` del verificador comprueba las tres condiciones antes de
entregar el laboratorio:

```
c1 ── c2 ── c3 ── c4 (main)
             │      └── t1 (tailandesa)
             ├── a1 (azteca)
             └── n1 (andina)
```

- **tailandesa** cuelga de `c4`, la punta de `main`, que no vuelve a moverse.
  `main` esta contenida entera en ella, asi que su fusion es un avance rapido y
  no crea nada.
- **azteca** nace en `c3` y toca `recetas/guacamole.md`, que `main` no toco.
  Divergen, asi que hay union; no comparten archivo, asi que no choca.
- **andina** nace en `c3` y cambia la misma linea de `platos.md` que cambio
  `c4`. Divergen y comparten linea, asi que choca.

Que `azteca` **no** toque `platos.md` es tan importante como que `andina` si lo
toque: si lo tocara, el laboratorio tendria dos conflictos y ningun caso de
union limpia. El verificador lo comprueba explicitamente.

## 30. La cobertura de los siete laboratorios

> **Numeracion.** Cifras de la corrida del SPEC 008, con la numeracion antigua y
> con el enunciado que cada laboratorio tenia entonces. La medicion vigente,
> renumerada, esta en la seccion 31.

Medida en la corrida, no estimada. «Comparadas» son las ordenes que se
ejecutaron en los dos lados y cuyo resultado se comparo; el resto se corrio solo
en Git o no se corrio.

| Laboratorio | Ordenes | Comparadas | Cobertura | Donde se corta |
|---|---|---|---|---|
| 02 · leer la historia | 40 | 26 | 65 % | no se corta |
| 03 · abrir la caja | 33 | 9 | 27 % | no se corta |
| 04 · ordenar el recetario | 57 | 5 | 9 % | `git mv` |
| 05 · tres cocinas | 66 | 9 | 14 % | `git switch -c mexicana HEAD~3` |
| 06 · fusionar y resolver | 53 | 34 | 64 % | no se corta |
| 07 · retroceder y revertir | 51 | 6 | 12 % | `git commit -c ORIG_HEAD` |

### Que significa «se corta»

Una orden que el motor no implementa y que **cambia el repositorio real** hace
avanzar solo a un lado. Desde ahi comparar no dice nada: el simulador se quedo
atras por una razon conocida, no por un error. El recorrido sigue ejecutandose
en Git para que el laboratorio llegue al final, pero se deja de comparar y se
informa donde fue.

Que una orden corte **no se decide con una lista**. Se decide midiendo: se toma
el estado del repositorio antes y despues, y si cambio, se corta. Por eso
`git lg` sobre un alias que no existe no corta nada, aunque el motor tampoco lo
implemente: falla en los dos lados y no mueve nada.

### Por que el 04 y el 05 se cortan tan temprano

**El 04 se corta en la octava orden** porque su Parte 1 entera es mover y borrar
archivos con `git mv` y `git rm`, que el motor no implementa. Son las ordenes
que el laboratorio viene a enseñar.

**El 05 se corta en `git switch -c mexicana HEAD~3`**, que es su punto 1.2: abrir
una rama desde una confirmacion anterior. El motor resuelve `HEAD~3` en
`git checkout` y no en `git switch`, que es el hueco de la seccion 28.

**El 07 se corta en `git commit -c ORIG_HEAD`**, en su punto 1.1: rehacer una
confirmacion conservando el mensaje de la anterior.

En los dos casos la cifra baja dice algo cierto y util: **esos laboratorios hay
que practicarlos en la terminal**, porque el simulador no acompaña la parte que
enseñan. No es una falla de la prueba, es la prueba haciendo su trabajo.

### Los que si se recorren enteros

El **02** y el **06** son los que mejor quedan cubiertos, con dos tercios de sus
ordenes comparadas y sin corte. En el 06 eso incluye las tres fusiones, el
conflicto, el aborto y la resolucion: el laboratorio de la sesion 4 se puede
seguir entero en el simulador y lo que muestra coincide con la terminal.

El **03** tiene 27 por ciento y esta bien asi: mira dentro de la carpeta oculta,
que el simulador no modela a proposito.

---

# SPEC 009 · Correccion de alcance de los laboratorios

## 31. La renumeracion, y por que el antiguo 03 no era un laboratorio

El taller pasa de **quince a catorce laboratorios**. El antiguo 03, «Abrir la
caja», deja de existir como laboratorio propio y su contenido util queda como
**parte 4 del laboratorio 02**, con veinte minutos asignados.

### La tabla

| Antes | Ahora | Titulo |
|---|---|---|
| 01 | 01 | El recetario nace |
| 02 | 02 | Leer la historia y abrir la caja |
| 03 | — | absorbido en la parte 4 del 02 |
| 04 | 03 | Ordenar el recetario |
| 05 | 04 | Tres cocinas en paralelo |
| 06 | 05 | Fusionar y resolver |
| 07 | 06 | Retroceder, revertir y etiquetar |
| 08 | 07 | Interrumpir y limpiar la historia |
| 09 | 08 | Conectar y publicar |
| 10 | 09 | Etiquetas, versiones y limpieza |
| 11 al 15 | 10 al 14 | los de la plataforma y la tuberia |

### Que sobrevivio del antiguo 03 y que no

Sobrevive lo que se puede mirar en dos minutos y deja una idea: `cat .git/HEAD`,
que una rama son cuarenta y un bytes de texto, el recorrido de crear una rama,
cambiarse a ella, volver y borrarla, y ver que el directorio de trabajo no
cambia por eso.

No sobrevive lo que exigia mas tiempo del que el tema merece: recorrer los
objetos con `cat-file`, medir el arbol, comparar contra una confirmacion
anterior y buscar por contenido con `git log -S`.

### Lo que la desaparicion se llevo por delante

El antiguo 03 tenia escenario propio en el simulador, una tanda de pruebas y una
fila en las tablas de cobertura. Al borrarlo:

- **Su escenario desaparecio.** `ESCENARIOS` pasa de nueve a ocho declaraciones.
- **Las pruebas que lo cubrian se rehicieron**, no se borraron: las que seguian
  diciendo algo cierto se mudaron al 02, que es quien hoy tiene ese contenido.
  El verificador del 02 gano dos criterios, «solo existe la rama main» y «HEAD
  apunta a main», que son los que comprueban la parte 4.
- **Las pruebas de interfaz apuntaban a su escenario justamente por ser corto**,
  cuatro confirmaciones limpias. El escenario que hoy lleva el numero 03 tiene
  cinco y los conteos habia que corregirlos. Es el unico lugar donde el numero
  del laboratorio estaba metido en una cifra y no en un texto.

### El criterio para renumerar sin dejar referencias viejas

No se reviso a ojo. La palabra `laboratorio` y la forma `lab-NN` se buscaron en
todo el repositorio y cada aparicion se clasifico en una de tres:

1. **Referencia viva**, que se corrige.
2. **Registro historico** de un spec anterior, que se conserva y se marca con
   una nota de numeracion que remite a esta tabla.
3. **Codigo muerto**, que se deja quieto: `semillas/` no se toca desde el SPEC
   004 y conserva la numeracion vieja. Nada en `labs/` la invoca y hay una
   prueba que lo fija.

Ademas quedo una prueba que no depende de que alguien vuelva a mirar: recorre
los enunciados armados y exige que el titulo diga su propio numero, que cada uno
prepare y trabaje sobre su propia carpeta y no sobre la de otro, y que ninguna
mencion apunte a un laboratorio mayor que catorce.

### La cobertura despues del cambio

Medida en la corrida, con la numeracion nueva.

| Laboratorio | Ordenes | Comparadas | Cobertura | Donde se corta |
|---|---|---|---|---|
| 02 · leer la historia y abrir la caja | 53 | 31 | 58 % | no se corta |
| 03 · ordenar el recetario | 57 | 5 | 9 % | `git mv` |
| 04 · tres cocinas en paralelo | 66 | 9 | 14 % | `git switch -c mexicana HEAD~3` |
| 05 · fusionar y resolver | 45 | 35 | 78 % | no se corta |
| 06 · retroceder, revertir y etiquetar | 51 | 6 | 12 % | `git commit -c ORIG_HEAD` |

El 02 sube de 40 a 53 ordenes y baja de 65 a 58 por ciento: la parte 4 que
heredo son trece ordenes que miran dentro de la carpeta oculta, y esas se corren
solo en Git a proposito. **La cifra baja porque el laboratorio crecio por el
lado que el simulador no modela**, no porque algo se haya roto.

El 05, que antes era el 06, sube de 64 a 78 por ciento: es el mismo laboratorio
y el mismo recorrido, con el enunciado reescrito por el product owner, que quedo
mas corto y con menos ordenes fuera del alcance del motor.

---

# SPEC 010 · El motor acoplado al guion

## 32. El contrato · que se compromete el motor a ejecutar

Hasta el SPEC 010 el simulador intentaba ser un Git de proposito general. Esa
ambicion tenia dos consecuencias malas: **su completitud no se podia demostrar**,
porque el universo de Git no tiene borde, y aparecieron once diferencias con Git,
seis de ellas silenciosas.

Desde el SPEC 010 el motor esta acoplado al guion. **Lo que se compromete a
ejecutar son las ordenes que aparecen en los enunciados de los laboratorios**,
incluidas las que se nombran en prosa dentro de las secciones de rescate. Con
ese acotamiento, «completo» deja de ser una opinion y pasa a ser una cifra.

### La regla que gobierna todo

**La pantalla nunca acepta una orden y la ignora.** Solo hay tres respuestas:

1. La ejecuta correctamente.
2. Dice que no la implementa y que en la terminal si funciona.
3. Dice que la orden no existe, con el mismo texto que Git.

La cuarta, aceptar y descartar en silencio, es la que este spec elimina. Era el
caso de `--author`, `--since` y `--format`: el motor los recibia, mostraba la
historia entera y el participante no tenia como notarlo.

### Donde vive

En `src/core/contrato.ts`, y en ningun otro sitio. Lleva dos listas:

- `SIN_SOPORTE`, las formas que el motor declara no implementar, cada una con
  el motivo que se le muestra al participante.
- `OPCIONES`, las opciones que cada suborden entiende.

El despachador las consulta **antes** de entregarle la orden a su manejador. Una
opcion que no este en ninguna de las dos no llega al manejador: se responde que
no esta implementada, con su nombre.

### La distincion que hacia falta: reconocida sin codigo

`--decorate` en `git log` no se lee en ninguna parte, y sin embargo no es una
opcion ignorada: el simulador decora siempre, igual que Git cuando escribe a un
terminal. Aceptarla y decorar no es descartarla, es coincidir.

Para que esa diferencia no sea una excusa, hay una tercera lista,
`EQUIVALENTES`, donde cada una de esas opciones lleva escrito por que no
necesita codigo. **Una prueba exige que toda opcion declarada en `OPCIONES` o
aparezca en el codigo del motor o este en `EQUIVALENTES`.** Una opcion listada
como reconocida que ningun manejador consulta es, literalmente, una opcion
aceptada y descartada, y eso lo detecta la suite sin depender de que alguien se
acuerde de mirarlo.

### El extractor dejo de tener su propia lista

El arnes de las pruebas de punta a punta mantenia su propia copia de lo no
soportado. Tener dos listas ya habia cobrado su precio: la copia decia que
`git config --list` no estaba implementado cuando si lo estaba, y por eso esa
orden se salto durante todo el SPEC 008. Ahora el extractor pregunta al
contrato.

## 33. Un solo lugar donde vive el tiempo

Las confirmaciones guardan su instante en segundos desde la epoca, ademas del
texto ya formateado. Sin esa cifra no hay manera de filtrar por fecha ni de
darle forma con `--date`, y era el cambio de tipo que tocaba mas superficie.

Se hizo temprano y a proposito, y salio barato porque `fecha` quedo **derivada**
de `epoca` dentro de la fabrica de confirmaciones: quien crea una confirmacion
declara el instante y nunca el texto, de modo que las dos no pueden divergir.

## 34. Lo que el modelo tuvo que aprender

Tres cosas que el motor no representaba y que el guion necesita.

### Las bajas del seguimiento

Un archivo retirado con `git rm` no desaparece de la historia, pero **deja de
estar versionado**. Antes «estar versionado» se deducia mirando si el nombre
aparecia en alguna confirmacion, y con esa regla un archivo retirado seguia
figurando para siempre. Es exactamente lo contrario de lo que el laboratorio 03
viene a enseñar.

Ahora cada confirmacion registra tambien lo que saco del seguimiento, y el
conjunto de archivos versionados se calcula recorriendo la historia: cada
confirmacion suma lo que registro y resta lo que retiro.

El estado lleva ademas dos listas cortas: los borrados con la baja ya preparada
y los que desaparecieron del directorio sin que nadie lo preparara. Son las dos
secciones en que Git los muestra.

### La procedencia de un renombrado

`git status` dice `renamed:` cuando reconoce que un archivo cambio de sitio. Git
lo deduce comparando contenido, y el motor no tiene contenido que comparar.

La salida no fue inventar una similitud, sino **anotar la procedencia**: cuando
`git mv` o el `mv` del interprete mueven un archivo, el destino recuerda de
donde vino. Eso no es contenido, es haber visto ocurrir el movimiento. Con eso
el simulador puede decir `renamed:` sin fingir que mide parecidos, y un archivo
nuevo que no viene de ninguna parte nunca se confunde con un renombrado.

### ORIG_HEAD

`git reset` guarda en `ORIG_HEAD` donde estaba la posicion antes del salto. Es
la red de seguridad que el laboratorio 06 enseña a usar, y sin ella
`git commit -c ORIG_HEAD` no tiene a que referirse.

## 34b. El area de preparacion guarda rutas, no renombrados

El recorrido comparado del laboratorio 03 dejo a la vista un error del
enunciado, y de paso una propiedad de Git que conviene tener escrita.

`git status` muestra un renombrado como un solo hecho, `renamed: viejo -> nuevo`,
pero **en el area de preparacion hay dos anotaciones separadas**: la baja de la
ruta vieja y el alta de la nueva. Git las junta al mostrarlas porque deduce que
son la misma cosa; no estan juntas.

La consecuencia practica es la que el enunciado no contaba. Sacar de la
preparacion el nombre nuevo no saca la baja del viejo:

```
$ git restore --staged listado-de-platos.md
$ git status --short
D  platos.md
?? listado-de-platos.md
```

Y devolver el archivo a su nombre en el disco tampoco la saca, porque lo que
esta anotado es la ruta y no el archivo:

```
$ mv listado-de-platos.md platos.md
$ git status --short
D  platos.md
?? platos.md
```

El paso 1.5 del laboratorio 03 terminaba ahi y decia «directorio limpio otra
vez». No lo estaba, y el propio verificador del laboratorio lo rechazaba con
**6 de 7 criterios**. Falta un `git restore --staged platos.md`, que el
enunciado ahora hace y explica.

El motor reproduce las tres situaciones, comprobadas contra Git una por una.

## 35. Lo que no se implementa, y por que

Todo lo de esta lista cae por la misma razon de fondo: **el motor modela nodos y
punteros, no contenido de archivos**. Es la restriccion R4 del SPEC 001 y el
punto 5.2 del SPEC 010 la confirma.

| Forma | Que necesitaria |
|---|---|
| `git log -S` | buscar dentro de las confirmaciones |
| `git log --stat`, `git show --stat` | contar lineas cambiadas |
| `git cat-file -p` | el contenido de un objeto |
| `cat <archivo del proyecto>` | el contenido del archivo |
| `diff` | el contenido de los dos archivos |

Y tres familias que no son de contenido sino de alcance:

| Forma | Por que |
|---|---|
| `cat`, `ls`, `wc` sobre `.git` | el tramo de la carpeta oculta se hace en la terminal a proposito (punto 3.3) |
| `cd`, `mkdir` fuera del repositorio, redireccion a `~` | el simulador es un repositorio, no el disco del participante |
| `git --version` | no es una instalacion de Git, es un modelo de como funciona |

Cada una responde con el mismo formato: que no hace, y que en la terminal si
funciona. La consola las pinta **distinto de un reclamo de Git**, porque un
reclamo de Git es una falla del participante y esto es un limite de la
herramienta.
