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
Los catorce que faltan se escriben contra esta seccion. Las dos primeras
nacieron de errores reales encontrados al probar el laboratorio 01, no de
precaucion abstracta.

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

## 16. PENDIENTE DE DECISION · el segundo efecto del repositorio anidado

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

Es un arreglo de una linea, independiente de la decision de estructura: cuando
no hay repositorio, preguntar por los alias solo en el config global, que es el
unico lugar donde pueden estar legitimamente. **No esta aplicado**, a la espera
de la decision, porque bajo la opcion A el problema desaparece solo.

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
