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

> **Agotada por el SPEC 012.** El motor modela el contenido y `git diff` muestra
> el texto de verdad, con el formato de Git. `cat` tambien. Queda como registro
> de lo que se decidio entonces, no como descripcion del estado actual: el
> detalle esta en la seccion 46.

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

> **Corregida por el SPEC 012.** Los identificadores ahora se derivan **del
> contenido**, como en Git, y el arbol enumera el proyecto entero y no solo lo
> que la confirmacion toco. Con la derivacion vieja, el panel de estructuras
> internas enseñaba algo falso: un archivo que no cambio salia con un
> identificador distinto en cada confirmacion.

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

### Regla 1 · la carpeta tiene que ser la raiz de su propio repositorio

**Un verificador nunca da por existente un repositorio solo porque Git responde
dentro de la carpeta.** Comprueba que `git rev-parse --git-dir`, parado en la
carpeta, responda `.git`: eso solo pasa si la carpeta es la raiz de su propio
repositorio. Si no, el criterio falla.

Hasta el SPEC 021 esto se hacia comparando `git rev-parse --show-toplevel`
contra la ruta esperada. En Windows no coincidia nunca: Git Bash escribe
`/c/Users/...` y Git para Windows `C:/Users/...`. Ver la seccion 67.

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

> **Invertida por el SPEC 012.** Hoy el contenido vive **en la declaracion**, y
> `preparar.sh` escribe los mismos bytes a mano con una prueba que los compara.
> Lo que sigue es el razonamiento de entonces, que era correcto mientras el
> motor no modelara contenido. La razon del cambio esta en la seccion 46.

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

> **El submodulo salio del laboratorio** (seccion 58.1, desajuste 5) y el
> titulo paso a ser «Dos remotos y un gancho» (seccion 59). Lo que sigue
> faltando para darle escenario son las ramas de seguimiento remoto, las
> ordenes de red y los ganchos.

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

> **Era falso, y se corrigió en la sección 64.** `git branch peruana
> <identificador>` crea una rama, y `git reset --hard <identificador>` mueve
> una. Hoy cada lado resuelve el identificador con su propia salida y ninguna
> orden del guion se salta.

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
  tiene donde buscar. **Implementado por el SPEC 012**, junto con el filtrado
  por archivo de la linea anterior.

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
| 06 | dos ramas, `mexicana` y `peruana` | **tres ramas**, `tailandesa`, `azteca` y `andina`, una por cada caso de fusion (hoy son cuatro: seccion 55) |
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
| 09 | 08 | Dos remotos y un gancho |
| 10 | 09 | Conectar y publicar |
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

> **Media lista se implemento en el SPEC 012.** Todo lo del primer cuadro, que
> caia por no modelar contenido, hoy funciona. La lista vigente y completa esta
> en la seccion 48.

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

---

# SPEC 011 · El grafo no se movía

## 36. El defecto, y por qué no estaba en el dibujo

El product owner abrió el simulador construido, recorrió el laboratorio 02
escribiendo órdenes en la consola y el grafo no se movió nunca.

No se movió porque **no había nada que dibujar**. El simulador abierto con doble
clic arranca en el escenario del laboratorio 01, donde todavía no hay
repositorio, y **ningún enunciado de los seis decía que había que llevarlo al
escenario del laboratorio que se está haciendo**. Comprobado sobre `file://`,
con Chrome y las cincuenta órdenes del enunciado: las cincuenta respondieron
`fatal: not a git repository`, el panel del grafo mostró «Todavía no hay
confirmaciones» de la primera a la última, y en ningún momento existió un solo
nodo en el documento.

El dibujo estaba bien. Lo que faltaba era el camino del participante hasta el
escenario correcto.

### Por qué las pruebas no lo vieron

Por la misma razón de siempre, y esta es la cuarta vez.

El arnés escribía la dirección a mano: `cy.visit('/SIMULADOR.html?lab=NN')`, con
el número interpolado en el propio archivo de pruebas. O sea **le daba resuelto
al recorrido lo único que el participante tiene que acertar por su cuenta**. Una
prueba que suple lo que el usuario tiene que hacer solo no puede ver al usuario
equivocarse.

Es exactamente la forma del hallazgo de la sección 32, donde el extractor
mantenía su propia copia de lo no soportado, y de la sección 27, donde el lector
del estado de Git tenía su propio error. El patrón, dicho una vez:

> **El arnés guarda una copia de algo que debería salir del guion, y la copia es
> correcta. La prueba pasa comprobando la copia contra sí misma.**

### Qué cambió

**La dirección sale del enunciado.** `direccionDelSimulador` la busca en el
`README.md` del laboratorio y el recorrido visita esa. Si el enunciado no nombra
`SIMULADOR.html?lab=NN`, con el número de su propio laboratorio, la prueba falla
con ese mensaje. No hay categoría intermedia: es un defecto del enunciado.

**Los seis enunciados lo dicen.** Del 02 al 06, dentro de la Preparación, con
las dos formas de llegar: el selector de la barra o la dirección. El 01 lo dice
al revés, que abierto con doble clic ya cae donde corresponde y que en los demás
habrá que moverlo.

**Los cinco `preparar.sh` lo dicen también.** Es el último texto que el
participante ve antes de empezar a escribir, y la sección 17 ya dejó dicho que
advertir en el enunciado no alcanza: quien se equivoca es precisamente quien no
está leyendo.

## 37. Las pruebas miran lo que el navegador pinta

Hasta aquí el recorrido leía el estado de los atributos `data-` del documento.
Es mejor que leer el modelo, pero **un atributo está igual de presente si el
dibujo mide cero, si quedó fuera del panel, si está escondido o si el panel no
llegó a dibujarse**. El defecto de este spec tenía todos los atributos en su
sitio: no había ninguno, porque no había confirmaciones, y los dos lados
coincidían en que no las había.

`cypress/soporte/dibujo.ts` mide con `getBoundingClientRect` y
`getComputedStyle`, que es lo que el navegador resolvió después de aplicar la
hoja de estilos y la disposición. Con eso el recorrido afirma tres cosas más
después de cada orden:

- El SVG del grafo existe y está dibujado.
- Cada confirmación pintada mide más de cero, no está oculta y cae dentro del
  panel del grafo.
- **Si lo que Git cambió es de lo que el grafo dibuja, el dibujo cambió.** Se
  afirma en una sola dirección a propósito: el dibujo tiene motivos legítimos
  para moverse sin que la historia, las ramas, la posición ni las etiquetas
  cambien.

La huella del dibujo se mide **dentro del SVG y no en la pantalla**. Medida en
coordenadas de pantalla, el grafo entero se corre unos píxeles cada vez que la
página cambia de alto y aparece o desaparece la barra de desplazamiento; eso es
cierto y no es que el grafo se haya movido.

## 38. Las capturas del recorrido

`npm run e2e` guarda ahora **una imagen de la pantalla completa después de cada
orden**, en los cinco laboratorios que se recorren. Son unas doscientas ochenta.

```
docs/capturas-recorrido/
├── lab-02/paso-003-git-status.png     una por orden, con su número y su orden
├── lab-02-movimiento.md               qué se movió después de cada orden
├── ...
└── defecto/                           las que documentan un defecto, versionadas
```

El nombre lleva el laboratorio, el número de paso y la orden, de modo que la
secuencia se sigue ordenando los archivos y sin abrir ningún índice. Se captura
la página entera y no el panel del grafo: si el problema fuera de disposición, o
de que el dibujo quedara fuera de la vista, recortar el panel lo escondería.

La carpeta está fuera del seguimiento. Lo único versionado es `defecto/`, con su
propio `README.md`.

### El informe de movimiento

Trescientas imágenes se revisan, pero lo que se afirma sobre ellas conviene
tenerlo medido y no recordado. Cada laboratorio deja un `lab-NN-movimiento.md`
que dice, paso por paso, cuáles de las siete piezas de la pantalla cambiaron
respecto de la orden anterior: nodos, etiquetas de rama, puntero de posición,
previsualización, áreas, guardado temporal y línea de tiempo.

Lo que dicen los cinco informes, ya arreglado el defecto:

| Pieza | Qué se ve en el recorrido |
|---|---|
| Línea de tiempo | Se mueve en las ciento noventa órdenes, sin excepción |
| Áreas | Se mueven con cada cambio de archivo, y solo ahí |
| Nodos | Veintiocho movimientos, todos sobre órdenes que crean o descartan confirmaciones |
| Ramas y puntero | Se mueven con los nodos, y además solos al cambiar de rama o crear una |
| Previsualización | Solo en el laboratorio 05, cuatro veces, que es la unión comprometida por la fusión con conflicto (punto 7.3) |
| Guardado temporal | **Nunca.** Ningún laboratorio del 01 al 06 usa `git stash` |

La última fila es un hueco conocido y no un defecto: el panel de guardado
temporal no lo ejercita ningún recorrido, porque el laboratorio que lo enseña es
el 07 y todavía no tiene `preparar.sh`.

## 39. Los otros cuatro defectos que aparecieron al mirar

El punto 4.3 del spec pide arreglarlos todos y reportarlos por separado.

### 39.1 El recorrido del laboratorio 04 no creaba ni una confirmación

El enunciado dice «Crea `recetas/pad-thai.md`» y muestra el contenido en un
bloque. El extractor descartaba ese bloque entero por no ser órdenes, y con él
descartaba **el archivo**. Sin archivo, el `git add` siguiente fallaba y el
`git commit` no encontraba nada que confirmar. En los dos lados. Los dos
coincidían en no haber hecho nada, la comparación daba verde, y el informe
declaraba el guion entero cubierto.

Sesenta y cinco órdenes del laboratorio que enseña a ramificar y confirmar, sin
una sola confirmación creada.

Ahora el extractor convierte esos pasos en órdenes, `mkdir -p` y `echo`, y el
recorrido crea las cinco confirmaciones del laboratorio 04 y el `.gitignore` del
03. El contenido no se copia: ninguno de los dos lados lo compara y el motor no
versiona contenido. Escribir el nombre del archivo dentro tampoco sirve, porque
un `.gitignore` que se nombra a sí mismo se ignora y Git deja de mostrarlo.

### 39.2 El directorio de trabajo no seguía al árbol

Descubierto por lo anterior. Al cambiar de rama o de confirmación, Git reemplaza
el directorio de trabajo por el árbol del destino. El simulador arrastraba
`estado.archivos` entera, de modo que sobre la rama `mexicana`, abierta tres
confirmaciones atrás, seguían figurando recetas que ahí todavía no existían.

El enunciado del laboratorio 04 dice, en ese punto exacto: «Los archivos
cambiaron. Estás parado tres confirmaciones atrás, así que ves el proyecto como
estaba en ese momento.» No los veía.

La comparación no lo detectaba por dos razones sumadas: solo mira los archivos
con algo pendiente, y esos estaban limpios; y de `ls` compara que no falle, no
lo que imprime, que es la misma lección de la sección 28.

`sincronizarDirectorio` deja el directorio como el destino lo tiene, y el
trabajo pendiente viaja con el participante. Se llama solo donde el árbol de
verdad cambia: `switch`, `checkout` y `reset --hard`. Los otros dos modos de
`reset` mueven la posición y dejan el directorio como estaba, así que ahí no
interviene.

En `reset --hard` estaba el mismo hueco, buscado a propósito después de
encontrar el primero: un archivo que la confirmación deshecha había estrenado se
quedaba en la lista, limpio, como si siguiera versionado. En Git desaparece del
disco.

### 39.3 Lo no seguido no se agrupaba por carpeta

Git no abre una carpeta cuyo contenido está entero sin seguir: muestra la
carpeta, con la barra al final, y no entra.

```
$ mkdir recetas && echo x > recetas/tacos.md
$ git status --short
?? recetas/
```

El simulador listaba `recetas/tacos.md`. `sinSeguimientoAgrupado` lo agrupa
ahora, en las dos formas de `git status` y en el panel de áreas.

### 39.4 El archivo de exclusiones se aceptaba en silencio

La parte 3 del laboratorio 03 está armada sobre que `.gitignore` filtra: el
participante escribe `echo "prueba" > temporal.tmp`, el enunciado le dice «no
aparece» y el simulador se lo mostraba.

**Esto no se arregla, y no se puede.** El motor no versiona contenido
(restricción R4 del SPEC 001), así que no tiene cómo leer las reglas del
archivo. Lo que sí era un defecto es que ocurriera en silencio, que es la cuarta
respuesta que la sección 32 eliminó.

> **Se arregló en el SPEC 012, y sí se podía.** El «no se puede» era cierto bajo
> R4 y R4 dejó de tener razón de ser cuando el SPEC 010 acotó el motor al guion.
> Esa es la revisión que faltó hacer entonces y que la sección 47 registra. El
> archivo de exclusiones filtra de verdad y el aviso se fue con su motivo.

Ahora, al crear un `.gitignore`, la consola dice que no aplica las reglas, por
qué, y que en la terminal sí funciona. El enunciado del laboratorio 03 manda
hacer esa parte en la terminal.

Implementar el filtrado de verdad pide modelar el contenido de un archivo, que
contradice R4. **Es decisión del product owner**, no de este spec.

## 40. La cobertura del motor estaba roja desde el SPEC 010

Medida sobre el árbol tal como llegó, sin ningún cambio de este spec:

```
Lines 83.09%   Statements 80.64%   Functions 82.49%   Branches 71.70%
```

Los umbrales del proyecto son 90, 90, 90 y 80. O sea `npm test` fallaba antes de
empezar. La causa: el SPEC 010 agregó dos archivos de motor, `ordenes/archivos.ts`
y `ordenes/inspeccion.ts`, trescientas sesenta y cinco líneas entre los dos, y
los dejó cubiertos **solo por el recorrido de Cypress**. Estaban al cuatro por
ciento.

Un motor probado solo por un arnés que tarda cinco minutos es un motor cuya
suite rápida ya no dice la verdad sobre lo que está probado. `git mv`, `git rm`,
`git ls-files`, `git show`, `git rev-parse`, `git merge-base`, `git cat-file -t`
y el `mv` y el `rm` del intérprete tienen ahora sus pruebas de unidad.

```
Lines 93.87%   Statements 90.61%   Functions 90.51%   Branches 81.94%
```

## 41. Lo que hace probable un quinto hallazgo

El spec lo pregunta y la respuesta es que sí, y se puede nombrar dónde.

**Primero, lo que la comparación decide no mirar.** Hoy compara historia, ramas,
posición, etiquetas, archivos pendientes y guardados. Todo lo demás pasa sin que
nadie lo lea: la salida de `ls`, la de `cat`, la de `git log` y la de `git show`
solo se miran para saber si empiezan con `fatal:`. El hallazgo 39.2 vivió
justamente ahí, y la sección 28 ya había dicho lo mismo de `git log`. **Mientras
la comparación mire el estado y no lo impreso, va a seguir habiendo órdenes que
enseñan algo distinto sin que nadie se entere.**

**Segundo, los archivos limpios.** `pendientesDe` descarta todo lo que está en
orden, y por eso un directorio de trabajo entero equivocado pasó inadvertido.
Comparar también lo limpio es barato y cierra ese hueco.

**Tercero, lo que el recorrido no toca.** El guardado temporal no lo ejercita
ningún laboratorio, el modo relator no aparece en ningún recorrido, y los
laboratorios 07 en adelante no tienen `preparar.sh`. De esas tres zonas no hay
nada que afirmar hoy.

**Cuarto, y es el de fondo: el arnés todavía tiene cosas escritas a mano.** La
dirección era una y ya no lo es. Quedan la lista de piezas que se comparan, los
marcadores de posición que se resuelven desde la declaración del escenario, y la
configuración de Git que el arnés escribe por el participante en
`prepararLaboratorio`, alias incluidos. Esa última es la misma forma exacta del
defecto de este spec: **el arnés hace por el participante algo que el
participante tiene que hacer en el laboratorio 01**. Si un día el laboratorio 01
deja de configurar los alias, los cinco recorridos van a seguir en verde.

---

# SPEC 011 · cierre

## 42. El arnés dejó de hacer cosas por el participante

Era el cuarto punto de la sección 41, el de fondo, y se cerró antes de que
ocurriera.

`prepararLaboratorio` escribía la identidad y los dos alias del taller en el
archivo de configuración de las pruebas. O sea **hacía por el participante lo
que el participante tiene que hacer en el laboratorio 01**, y con eso se volvía
ciego a que dejara de hacerlo: si el laboratorio 01 quitara
`git config --global alias.lg`, los cinco recorridos habrían seguido en verde
mientras el participante se topaba con `git: 'lg' is not a git command` en la
primera orden del laboratorio 02.

Ahora la configuración sale del enunciado del laboratorio 01, y se deja puesta
corriendo sus propias órdenes `git config --global`. Si el enunciado no
configura nada, el recorrido se detiene ahí con ese mensaje.

Los alias se dejaron de leer de `ALIAS_DEL_TALLER` en el extractor: la tabla
llega desde el enunciado, así que un alias que el laboratorio 01 deje de
configurar deja de expandirse y el recorrido lo nota en los dos lados. Tres
pruebas nuevas lo fijan, en `tests/ordenes-del-enunciado.test.ts`:

- el enunciado deja puesta una identidad, sin la cual Git no confirma;
- los alias que el simulador declara son los que el enunciado configura;
- todo alias que algún enunciado usa lo configura el laboratorio 01.

`cypress/soporte/enunciado.ts` es el lector del enunciado, aparte de
`ordenes.ts` porque lo usan los dos lados: el arnés dentro del navegador y la
configuración de Cypress dentro de Node, que no puede arrastrar el motor entero
para leer un archivo de texto.

## 43. La comparación mira el directorio de trabajo entero

Era el segundo punto de la sección 41. `pendientesDe` descartaba todo lo que
estuviera en orden, y por eso un directorio de trabajo entero equivocado pasó
inadvertido.

La pantalla no dibuja los archivos limpios en ninguna parte: la zona D lista
solo lo que tiene algo pendiente. La única ventana al directorio completo es
`ls`, así que el recorrido lo escribe como sonda y lee lo que la consola
imprime. **La sonda no queda en el guion**: después de leerla se retrocede un
paso en la línea de tiempo y la orden siguiente la reemplaza, igual que en Git
una confirmación hecha desde un punto anterior corta lo que había delante. El
recorrido, las capturas y la línea de tiempo siguen siendo los del enunciado.

Encontró un defecto en la primera corrida: **la fusión movía el puntero y no
actualizaba el directorio de trabajo**. Después de `git merge tailandesa`, que
es un avance rápido, Git tiene `recetas/` en la carpeta y el simulador no. Es la
misma familia de la sección 39.2, en un tercer lugar: `sincronizarDirectorio` se
llama ahora también en las dos ramas de `git merge`.

Y destapó una prueba que pasaba sin probar nada: `--abort devuelve los archivos
al estado previo` usaba una fusión que **no choca**, así que no había nada que
abortar y la igualdad se cumplía sola. Ahora usa `andina`, que choca sobre
`platos.md`.

## 44. Las capturas se comparan entre sí

Revisar doscientas ochenta imágenes a ojo no es revisarlas. El arnés anota la
huella de cada captura al guardarla y deja un `lab-NN-capturas.md` que cruza dos
cosas: si la imagen cambió respecto de la del paso anterior, y qué piezas midió
el arnés que se movieron.

La fila que hay que buscar es `SIN PINTAR`: el arnés midió que algo se movió y
la imagen quedó idéntica. Eso es un cambio que el participante no ve. El informe
lo cuenta al final; hoy es cero en los cinco laboratorios.

## 45. El laboratorio 03 queda en el 77 por ciento

La pregunta del product owner: cuánto del laboratorio 03 queda cubierto ahora
que el tramo de las exclusiones se hace en la terminal.

De sus **64 órdenes**, **12 salen a la terminal**, 3 están declaradas como no
soportadas y 1 lleva marcador de posición. Quedan **49 en pantalla, el 77 por
ciento**.

Las 12 son la sección 2.2 desde que se crea el `.gitignore`, y la parte 3
entera. El primer aviso que se escribió era más ancho y se llevaba también
`git rm --cached`, que es el centro del laboratorio y que el simulador hace
perfectamente: eso habría sacado del simulador lo único que el SPEC 010
implementó para este laboratorio. El aviso quedó acotado a lo que de verdad
depende de que las exclusiones filtren.

**El laboratorio 03 no sale del simulador.** Con 77 por ciento está por encima
del resto del taller, y lo que enseña de verdad, la diferencia entre ignorar y
sacar del seguimiento, ocurre entero en pantalla.

> **Con el SPEC 012 quedó en 95 por ciento.** De los doce tramos que salían a la
> terminal volvió todo menos uno, el `cat .git/info/exclude` de su punto 3.3,
> que sigue fuera porque mira dentro de la carpeta oculta. Las cifras nuevas
> están en la sección 49.

La cifra es medida y no narrada: el enunciado marca sus tramos de terminal con
la frase en negrita, `tramosDeTerminal` los lee, y el informe de cobertura de
cada corrida trae la columna `enPantalla`.

---

# SPEC 012 · Contenido de archivos, acotado al guion

## 46. El contenido de los archivos, y dónde vive

Hasta el SPEC 011 el motor modelaba nombres y estados, y nada de lo que los
archivos tenían escrito. Desde el SPEC 012 modela **el texto**, como texto
plano. No modela binarios, permisos, enlaces simbólicos ni marcas de tiempo:
nada de eso aparece en el guion.

### La fuente única es la declaración

El SPEC 007 dejó el contenido en `preparar.sh` por una razón concreta: *meter
los bytes en la declaración los cargaría en el artefacto que el participante
abre, para no mostrarlos nunca*. Esa razón se fue con la restricción que la
sostenía, y el reparto se invirtió.

**El texto vive en `simulador/src/escenarios/laboratorios.ts`.** Cada
confirmación declarada lleva un `contenido` con una entrada por cada archivo que
registra, ni una más ni una menos, y el constructor rechaza el escenario que no
cumpla eso: un archivo registrado sin texto es una confirmación que dice haber
cambiado algo sin decir qué.

`preparar.sh` sigue escribiendo los bytes a mano, como escribe a mano todo lo
demás, y **`tests/escenarios-contra-disco.test.ts` compara los dos lados
carácter por carácter**, árbol por árbol y archivo por archivo del directorio de
trabajo. Es el mismo trato que el SPEC 007 eligió para la forma, extendido al
contenido: la declaración manda y la prueba impide que el disco se separe.

Se descartaron los otros dos caminos, y no por comodidad:

- **Generar `preparar.sh` desde la declaración** es lo que el SPEC 007 descartó
  con razones que siguen vigentes: `.sh` generados y versionados, con el
  problema de sincronía que el SPEC 006 acababa de resolver para el artefacto.
- **Que la declaración lea los bytes de `preparar.sh`** obliga a que la
  construcción de TypeScript analice sintaxis de Bash, y deja sin contenido a
  los laboratorios 01, 07 y 09, que tienen escenario y no tienen script.

La prueba **se vio fallar en las dos direcciones**, que es lo que el criterio
CA1 pide. Cambiando una línea en `labs/lab-04/preparar.sh` la suite se detiene
en dos pruebas de ese laboratorio, nombrando el archivo; y hay dos pruebas
escritas que alteran la declaración sin tocar el script y exigen que la
comparación lo note. La segunda de esas dos comprueba además que la forma sigue
calzando, de modo que se sepa que lo que falló fue el contenido y no otra cosa.

**Los finales de línea se normalizan al entrar**, a `\n` y con salto final. Es
el mismo criterio que el SPEC 003 aplicó a los identificadores fijando
`core.autocrlf false` y `core.eol lf` en el repositorio generado, y es lo que
hace que la comparación no dependa del sistema donde se corra.

### Las tres versiones de un archivo

Git tiene tres y la diferencia entre ellas es lo que el taller enseña. El
modelo las reparte así:

| Versión | Dónde vive |
|---|---|
| La confirmación | `Confirmacion.arbol`, una foto completa del proyecto |
| El área de preparación | **Se deduce**: lo preparado tiene lo del directorio; lo demás, lo de HEAD |
| El directorio de trabajo | `Archivo.contenido` |

**El árbol es una foto y no un parche**, igual que en Git. No cuesta lo que
parece: se arma copiando el del padre y reemplazando lo que cambió, de modo que
los textos que no cambiaron son la misma cadena compartida.

**Un archivo limpio no guarda copia del texto**: su `contenido` es `null`, que
quiere decir «lo mismo que la confirmación actual». No es una ausencia, es una
referencia. Guardar una copia la dejaría vieja al cambiar de rama, que es
exactamente el defecto que la sección 39 corrigió para los nombres y que habría
vuelto a aparecer con los bytes.

**Deducir el índice tiene un límite, y está declarado.** Un archivo preparado y
vuelto a modificar después aparece sólo como preparado; Git lo mostraría en las
dos secciones a la vez. Es un límite que el modelo ya tenía antes de este spec,
porque el estado de un archivo es un único valor de una enumeración, y el guion
no lo ejercita.

## 47. La revisión que faltó hacer hace dos specs

El SPEC 010 acotó el motor al guion y **nadie volvió a mirar las decisiones que
se habían tomado bajo el alcance anterior**. Esta sección es esa revisión.

### Las que se tomaron por ser un Git de propósito general

| Decisión | Estado |
|---|---|
| **R4 · no se modela contenido** (SPEC 001) | **Sin razón de ser.** El SPEC 012 la levanta. Nació cuando modelar contenido era modelar un sistema de archivos entero; con el guion como contrato son cinco archivos de diez líneas escritos por nosotros |
| **4.5 · `git diff` muestra la forma** | Caída con R4 |
| **9.2 · los objetos internos no resumen contenido** | Caída con R4, y además enseñaba algo falso |
| **23 · el contenido vive en `preparar.sh`** | Invertida, sección 46 |
| **35 · lo que no se implementa** | Su primer cuadro tenía cinco formas, las cinco por no modelar contenido. Cuatro cayeron; la quinta, el `diff` del sistema, se queda **por otra razón**: necesita la carpeta personal y la sustitución de procesos del intérprete. El segundo cuadro, el de alcance, sigue entero |
| **39.4 · «esto no se arregla, y no se puede»** | El «no se puede» era cierto bajo R4 y dejó de serlo dos specs antes de que alguien lo mirara |
| **`wc -c`, descartado por no tener consumidor** | Implementado. El consumidor no era la orden del guion, que mira dentro de `.git`: era **no mentir**. Sin manejador, el simulador respondía `bash: wc: command not found`, que es falso |

### La afirmación que hay que reformular, y que no se reformuló

**«El simulador es una simulación, no una implementación de Git.»** Sigue siendo
cierta y conviene que lo siga siendo. Lo que cambió es el argumento con que se
sostenía.

Antes se sostenía con *«no hay archivos reales ni contenido versionado: hay
nodos, punteros y estados de archivo declarados»*. Eso ya no es verdad, y
dejarlo escrito sería mentirle al participante que va a ver el texto de sus
archivos en la pantalla. El `README.md` se corrigió en esa frase, y **sólo en
esa frase**: decir en qué sigue siendo una simulación es una decisión del
arquitecto y queda anotada aquí como pendiente.

Lo que hoy la hace una simulación, y no una implementación, es otra cosa: los
identificadores se generan con una huella propia y no con SHA-1 sobre el objeto;
no hay carpeta `.git` que abrir; no hay red, ni submódulos, ni ganchos; y el
contrato del SPEC 010 se compromete con el guion y no con Git. Ninguna de esas
cuatro depende de si hay contenido.

### La pregunta del punto 7.4 · qué otra decisión descansa sobre un supuesto caído

Recorridas las cuarenta y cinco secciones anteriores, **hay una**, y no es de
contenido.

**La decisión 4.7: «el orden del historial es el de creación», tomada porque no
había reloj real.** El SPEC 010 le puso reloj: desde entonces cada confirmación
guarda su instante en segundos desde la época, y los escenarios declaran fechas
concretas de 2024 escritas por tres autores distintos. El supuesto que sostenía
4.7 —«al no haber reloj real»— dejó de cumplirse hace dos specs y nadie lo miró.

> **Cambiada por el product owner**, junto con el desfase de hora de más abajo.
> El detalle de los dos cambios está en la sección 53.

### Y un defecto que apareció al mirar, que no es una decisión

**La fecha se escribía en UTC y se rotulaba `-0300`.** `fechaDeInstante`
formateaba con `getUTCHours` y pegaba el desplazamiento de Chile al final. El
participante veía `Tue Jul  2 13:25:00 2024 -0300` donde su terminal dice
`Tue Jul 2 10:25:00 2024 -0300`: tres horas de diferencia y un espacio de más en
el día. El laboratorio 02 pone las dos salidas una al lado de la otra.

> **Corregido por el product owner.** Sección 53.

## 48. Lo que queda declarado como no soportado

La lista completa y vigente, después de que el contenido se llevara la mitad de
la anterior. **Ninguna de las cinco que quedan es por contenido.**

| Forma | Por qué |
|---|---|
| `cat`, `ls`, `wc` sobre `.git` | El tramo de la carpeta oculta se hace en la terminal **a propósito**. Es la sección 6.1 del SPEC 012 y la razón es pedagógica, no técnica: ese tramo termina diciéndole al participante que nada de esto es magia, que es texto en archivos y que lo acaba de leer con sus propios ojos. Un `.git` fabricado enseña exactamente lo contrario |
| `cd` | El simulador es este repositorio, no el disco del participante |
| `mkdir` fuera del repositorio, redirección a `~` o a `/` | Lo mismo |
| `diff` del sistema | El laboratorio 06 la usa sobre un archivo de la carpeta personal y con sustitución de procesos. `git diff` sí funciona |
| `git --version` | No es una instalación de Git, es un modelo de cómo funciona |

Y lo que sigue fuera del simulador entero: **el laboratorio 08**, con sus dos
remotos y su gancho (sección 24).

### Lo que el archivo de exclusiones cubre, y lo que no

Se cubre lo que el guion usa: comodín sobre la extensión (`*.tmp`), nombre
literal, carpeta con barra al final, ruta anclada con barra adelante,
comentarios y líneas en blanco.

**No se cubre el resto de la sintaxis de Git**: negaciones con `!`, comodines
dobles `**`, clases de caracteres `[abc]`, el comodín de un carácter `?` y el
escape con `\`. Un patrón que use algo de eso **no se aplica en silencio**:
`git status` lo nombra, con el mensaje de límite y no con uno de error, y dice
que en la terminal sí funciona. Se dice ahí y no al escribir el archivo porque
ese es el momento en que el participante espera que el filtrado haya ocurrido.
Aceptar una regla y no aplicarla es justo la cuarta respuesta que el SPEC 010
eliminó.

Tampoco se leen los `.gitignore` de las subcarpetas ni `.git/info/exclude`, que
vive dentro de la carpeta oculta.

### Lo que `grep` cubre, y lo que no

Texto literal, la alternancia `\|` de las expresiones regulares básicas, `-n` y
`-r`. Es lo que el laboratorio 05 escribe. **No se cubre el resto de la sintaxis
de expresiones regulares**, ni `-i`, ni `-v`, ni `-c`: una opción que no esté en
la lista se responde como no implementada, con su nombre, en vez de ejecutarse a
medias.

## 49. La comparación de diferencias y los conflictos

### El algoritmo no es el de Git, y el resultado sí

Git usa Myers con heurísticas de histograma y de anclaje. `diferencias.ts` usa
la subsecuencia común más larga, que en una tabla de dos dimensiones es corta y
se revisa de un vistazo. **Los archivos del guion tienen diez líneas**: el coste
cuadrático no es un problema y la claridad sí es una ventaja.

Lo que coincide es lo que el participante ve. Comprobado contra Git sobre los
escenarios, `git diff` y `git diff --staged` del laboratorio 02 salen
**idénticos línea por línea**, cabecera de trozo incluida, con una sola
diferencia: la línea `index`, cuyas huellas son las del simulador y no las de
Git. Se escribe igual, porque la forma de la salida importa y que los
identificadores no coincidan ya está declarado desde el SPEC 007.

Donde los dos algoritmos podrían separarse es **al repartir un empate**: cuando
hay dos formas igual de cortas de explicar el mismo cambio, Myers y la
subsecuencia común más larga pueden elegir distinta y las mismas líneas salen
agrupadas de otra manera. Con archivos de diez líneas y cambios de una o dos el
caso no aparece. Queda anotado porque es la única puerta por la que este módulo
podría separarse de Git.

### Los marcadores de conflicto llevan el texto, y sólo el tramo que choca

El punto 5.5 pide que los marcadores lleven el contenido real. La primera
versión envolvía **el archivo entero** entre marcadores, y estaba mal: Git marca
sólo el tramo que choca y deja fuera lo que las dos ramas dejaron igual. La
diferencia importa para el laboratorio 05, donde el participante tiene que leer
las dos versiones, elegir y borrar tres líneas. Con el archivo entero adentro no
hay nada que elegir: hay que rehacerlo todo.

`fusionarTresVias` alinea cada rama contra la base común y decide por tramo: si
sólo una lo tocó, se toma el suyo; si las dos escribieron lo mismo, se toma una
vez; si las dos lo cambiaron distinto, van los marcadores. El resultado del
laboratorio 05 es **idéntico al de Git**, comprobado sobre el repositorio que
`preparar.sh` deja en el disco.

**Esto no cambia qué archivos entran en conflicto**, que es lo que el punto 5.4
pide no tocar. La detección sigue siendo por archivo, en `ordenMerge`: si las
dos ramas tocaron el mismo archivo, hay conflicto.

### La detección por línea, como trabajo posterior

> **Hecha después, a pedido del product owner.** La sección 54 la describe, y
> corrige de paso una afirmación equivocada de lo que sigue.

Queda anotada, con la mejora que traería y con una consecuencia que sólo se vio
al implementar los marcadores.

El laboratorio 05 enseña las tres formas de fusión, y una de ellas es la fusión
automática de dos ramas que tocaron el mismo archivo sin chocar. **Hoy eso no se
puede mostrar**: el simulador declararía conflicto donde Git fusiona solo.

Y ahora hay un segundo motivo, más fino. Desde que los marcadores los escribe
una fusión de tres vías, existe un caso posible que antes no existía: dos ramas
que tocan el mismo archivo en líneas distintas quedan declaradas en conflicto
—porque la detección es por archivo— y su contenido sale **fusionado y sin
marcadores**, porque la fusión de tres vías no encontró nada que chocara. El
participante vería `both modified:` en un archivo limpio. No ocurre en el guion,
y es exactamente el desajuste que la detección por línea eliminaría.

## 50. Las cifras

### La cobertura de cada laboratorio

Medida en la corrida comparada, no estimada. Es la columna `enPantalla` del
informe que deja cada corrida de Cypress.

| Laboratorio | Antes | Después |
|---|---|---|
| 02 · leer la historia y abrir la caja | 70 % | **70 %** |
| 03 · ordenar el recetario | 77 % | **95 %** |
| 04 · tres cocinas en paralelo | 91 % | **92 %** |
| 05 · fusionar y resolver | 87 % | **96 %** |
| 06 · retroceder, revertir y etiquetar | 82 % | **88 %** |

El **02 no se mueve, y está bien**: lo que lo baja es abrir la carpeta oculta,
que se deja fuera a propósito. De sus quince órdenes declaradas, catorce son
`cat .git/...` y `ls .git/...`.

El **03 es la razón del spec** y es el que más sube. De los doce tramos que
salían a la terminal volvió todo menos uno.

El **05** sube porque `cat platos.md` pasó a mostrar los marcadores de
conflicto, que es el paso 3.3 del enunciado, y porque `git show --stat`
funciona. El **06**, porque `git log -S` encuentra el ingrediente que sobra.

El **04** sube un punto por una razón distinta y vale la pena decirla: no
implementó nada nuevo, sino que **el recorrido creció**. El arnés escribe ahora
el contenido de los archivos línea por línea, líneas en blanco incluidas, así
que ese laboratorio pasó de 80 órdenes recorridas a 85. Las cinco nuevas se
comparan en los dos lados.

### El artefacto

| | Bytes |
|---|---|
| Antes | 290 739 |
| Después | 306 219 |
| Creció | **15 480, un 5,3 %** |

Sigue siendo un archivo único, se abre con doble clic y no pide nada a la red.
El contenido incrustado son los ocho escenarios completos.

### El arnés escribe el contenido de verdad

El extractor del recorrido escribía `echo "contenido de ejemplo" > ruta` a
propósito, porque copiar el contenido real habría encendido efectos que el motor
no modelaba —«como que un `.gitignore` con `*.tmp` filtre en Git y no en el
simulador», decía el comentario—. Ahora filtra en los dos, así que copia el
texto del enunciado línea por línea. Sin ese cambio, el recorrido del
laboratorio 03 habría pasado en verde sin ejercitar lo único que este spec vino
a desbloquear.

Y eso destapó un defecto del contrato que el participante tenía delante desde
siempre. Está en la sección 51.

## 51. Lo que apareció al implementar

Ninguna salió de revisar: salieron de escribir el contenido y mirar qué se
rompía. Es la misma lección de la sección 27 y de la 28.

### El contenido tiene que seguir a las órdenes que mueven la posición

Modelar el texto no es agregar un campo: es que **cada orden que mueve la
historia sepa qué texto deja**. Cinco no lo sabían, y las cinco se arreglaron
al escribir su prueba.

- **`git revert` devolvía el archivo a su texto actual**, o sea a ninguno. Ahora
  lo devuelve al que tenía *antes* de la confirmación revertida, y si esa
  confirmación había **creado** el archivo, revertirla lo retira, como en Git.
  Esa es la razón de que el laboratorio 06 pueda mostrar el ingrediente que
  sobra desapareciendo.
- **El rebase copiaba el mensaje y no el texto.** Cada copia lleva ahora el
  texto que su original dejó, apoyado sobre el árbol de la base nueva, que es
  lo que hace que la rama reordenada conserve lo que main traía por su cuenta.
- **`git stash` guardaba el estado y no el trabajo.** Devolvía un archivo
  marcado como modificado sin ninguna modificación dentro.
- **`git reset --soft` y `--mixed` resolvían el texto contra la confirmación
  nueva**, de modo que el directorio aparecía ya retrocedido y `git diff` no
  decía nada. Git no toca el directorio: ahora el texto se fija antes de mover
  la posición.
- **La fusión sin conflicto registraba vacíos los archivos que la otra rama
  traía.** No están en nuestro directorio de trabajo ni en nuestra
  confirmación, así que el área de preparación no tenía de dónde sacarlos. El
  árbol de la unión se arma ahora tomando el texto de la rama que cambió cada
  archivo. Lo destapó escribir la prueba de `git show --stat` sobre una unión,
  que devolvía `recetas/guacamole.md | 0`.

### El enunciado del laboratorio 03 explicaba mal su propio paso 2.3

Decía, después de `git rm --cached notas.tmp`:

> «En el estado aparecen como borrados y además como archivos sin seguimiento,
> **porque el archivo de exclusiones todavía no está confirmado**.»

Es falso, y se pudo comprobar recién ahora. **Git aplica `.gitignore` desde que
está escrito en el directorio**, sin esperar a que se confirme: en cuanto los
dos archivos salen del área de preparación, las reglas `*.tmp` y `*.bak`
empiezan a taparlos y no reaparecen como archivos sin seguimiento. Comprobado
contra Git sobre un repositorio hecho para la ocasión.

El párrafo se escribió cuando el simulador no filtraba y nadie tenía con qué
contrastarlo. Ahora el simulador y Git dicen lo mismo, y los dos contradecían al
enunciado. Se corrigió, con el precedente de la sección 34b: cuando la
comparación demuestra que un paso está mal explicado, el enunciado se arregla.

### `git status` no ordenaba las bajas por ruta

Git ordena las rutas dentro de cada sección de `git status`; el simulador las
llevaba en el orden en que ocurrieron. Antes casi no se notaba, porque cada
archivo retirado aparecía dos veces —como baja y como archivo sin seguimiento—
y las dos listas se leían mezcladas. Con las exclusiones tapando la segunda
mitad, el paso 2.5 del laboratorio 03 deja **tres bajas seguidas**, y ahí la
diferencia con la terminal se lee de inmediato.

Se ordena al escribir y no en el modelo: la zona de áreas necesita el orden en
que ocurrieron para no reordenarse al cambiar de rama.

Queda sin comprobar si el orden de lo modificado y lo no seguido coincide con
el de Git en todos los casos del guion. El recorrido comparado no lo mira,
porque compara estado y no texto.

### Y una más, de fidelidad

Encontrada al comparar contra Git la salida de la unión: **`git show` sobre una
unión no lleva parche y sí lleva resumen.** Git imprime la cabecera y nada más, porque una unión tiene dos
padres y «el cambio» no es uno solo; con `--stat` sí resume. El punto 2.3 del
laboratorio 05 hace exactamente `git show --stat HEAD` sobre una unión.

### El contrato leía `- lomo saltado` como una opción

`echo "- lomo saltado" >> platos.md` respondía que el simulador no implementa la
opción «- lomo saltado». El argumento empieza con guion y `opcionesNoReconocidas`
lo tomaba por una opción.

**La mitad de las líneas de cualquier lista del recetario empieza con guion**,
así que el participante se topaba con esto al escribir. Lo destapó hacer que el
arnés copiara el contenido de verdad de los enunciados; con la línea neutra que
escribía antes, no aparecía.

Se arregló con dos reglas: `echo` no tiene opciones, todo lo que va detrás es
texto; y **una opción nunca lleva espacios**, que además cubre el mensaje de un
`git commit -m "- se quita la cazuela"`.

### `grep`, que no estaba en el encargo y entró igual

No está en la lista de la sección 3 del spec. Entró por la regla que gobierna el
contrato: **la pantalla nunca dice que una orden no existe cuando existe**. El
simulador respondía `bash: grep: command not found`, que es la tercera respuesta
del SPEC 010 usada donde no corresponde.

Hasta ahora no se notaba, porque el paso del enunciado que la usa era
inalcanzable. El laboratorio 05 la escribe dos veces, en su punto 3.5 y en su
Comprobación, para asegurarse de que no quedaron marcadores de conflicto dentro
de un archivo, y **ese paso se volvió alcanzable con este spec**, en cuanto
`cat platos.md` pasó a mostrar los marcadores.

Se cubre lo que el guion usa: texto literal, la alternancia `\|` de las
expresiones regulares básicas, `-n` y `-r`. No se cubre el resto de la sintaxis
de expresiones regulares, y lo que no se reconozca se responde como no
implementado, con su nombre.

De paso apareció que `tieneOpcion` compara palabras enteras y no separa las
opciones cortas agrupadas: `grep -rn` es una palabra y son dos opciones. Se
agregó `letrasCortas` para las órdenes del intérprete, donde el enunciado las
escribe pegadas.

### La fecha se escribía en UTC y se rotulaba `-0300`

Está en la sección 47, con el resto de la revisión, y se corrigió después. El
detalle está en la sección 53.

### Diferencias con Git, actualizadas

La lista de lo no soportado queda en **cinco familias**, todas de alcance y
ninguna de contenido (sección 48). De las que la sección 35 atribuía a no
modelar contenido no queda ninguna. Sobre lo implementado en este spec, las
diferencias con Git que quedan son tres, y las tres están declaradas:

| Diferencia | Estado |
|---|---|
| La línea `index` del parche lleva huellas del simulador, no de Git | Declarada desde el SPEC 007: los identificadores no coinciden por diseño |
| `git add` sobre un archivo tapado no imprime la segunda línea de consejo de Git, la que enseña a apagar el aviso | Nombra `git config set`, que no está en el contrato |
| ~~La detección de conflictos es por archivo y los marcadores por línea~~ | **Cerrada**: la detección pasó a ser por línea, sección 54 |

Y una que **no se tocó y ahora sería barata**, porque es anterior a este spec y
más ancha que él: el resumen que `git commit` imprime dice ` 1 file changed`
donde Git dice ` 1 file changed, 3 insertions(+)` y agrega la línea
`create mode`. Es la salida más vista del taller entero. `git merge` sí las
lleva desde este spec, porque ahí el resumen se rehízo para contar líneas de
verdad; `git commit` sigue con el suyo, que cuenta archivos. Queda anotado.

### Lo que se comprobó contra Git, orden por orden

Sobre el repositorio que `preparar.sh` deja en el disco, no razonado:

| Orden | Resultado |
|---|---|
| `git diff` y `git diff --staged` del laboratorio 02 | Idénticos salvo la línea `index` |
| `git show --stat` de una confirmación normal y de una unión | Idénticos |
| `git show` de una unión, sin opciones | Idénticos: ninguno de los dos imprime parche |
| `git merge` por avance rápido y con unión | Idénticos, con sus `create mode` |
| Los marcadores de conflicto del laboratorio 05 | Idénticos, carácter por carácter |
| El tramo de exclusiones del laboratorio 03 entero | Idénticos, incluido el reclamo de `git add` |
| Dónde imprime Git `create mode` y dónde no | Comprobado en las cinco órdenes que resumen |
| La fecha larga y la corta de los laboratorios 02 y 05 | Idénticas, sección 53 |
| El orden de `git log --all` con las ocho fechas del laboratorio 07 | Idéntico, sección 53 |
| Una fusión del mismo archivo en líneas distintas | Idéntica: los dos fusionan solos, sección 54 |
| Una fusión con un archivo limpio y otro en conflicto | Idéntica, incluido el orden de los avisos |

## 52. Qué laboratorio podría entrar al simulador, y cuál no

La pregunta del punto 10 del spec. La respuesta corta es **ninguno, y no es una
mala noticia**: los que están fuera lo están por razones que el contenido no
toca.

| Fuera | Por qué, y si el contenido cambia algo |
|---|---|
| **08** · dos remotos y un gancho | Necesita ramas de seguimiento remoto, órdenes de red y ganchos. **El contenido no aporta nada.** Sigue siendo un spec propio, el mismo que la sección 24 describe |
| **10, 11, 13, 14** · plataforma | Ocurren en GitLab. No hay repositorio local que reflejar |
| **12** · integración continua | Lo mismo |
| El tramo de la carpeta oculta del **02** | Se deja fuera **a propósito**, y la razón es pedagógica: ese tramo termina diciéndole al participante que lo que acaba de leer es texto en archivos de verdad. Un `.git` fabricado enseña lo contrario. Es la sección 6.1 del spec y no cambió |

Lo que el contenido sí abrió no es un laboratorio nuevo, es **una parte de uno
que estaba a ciegas**. La Parte 3 del laboratorio 05, resolver el conflicto, se
puede seguir entera en la pantalla por primera vez: leer los marcadores con
`cat`, rehacer el archivo con `echo`, comprobar con `grep` que no quedó ninguno,
marcar resuelto con `git add` y cerrar con `git commit`. Antes el participante
llegaba a `git merge`, veía el conflicto declarado y de ahí en adelante tenía
que irse a la terminal.

### Lo que sí conviene hacer después, y ahora sale barato

**La detección de conflictos por línea** (punto 5.6). El punto 5.4 pidió no
tocarla en este spec y fue la decisión correcta: mezclar el cambio del modelo de
contenido con el de la fusión habría juntado dos riesgos.

Pero ahora está a un paso. `fusionarTresVias` ya calcula si dos ramas chocan de
verdad, y devuelve ese dato en su campo `choco`. La detección por archivo de
`ordenMerge` podría preguntárselo en vez de comparar listas de nombres. Y de
paso desaparece el desajuste de la sección 49, el archivo declarado en conflicto
que sale sin marcadores.

> **Corrección.** Este párrafo decía además que «el laboratorio 05 podría
> mostrar su tercer caso de fusión, el de dos ramas que tocaron el mismo archivo
> sin chocar». Es falso, y salió de repetir la frase del punto 5.3 del SPEC 012
> sin contrastarla contra el enunciado. Los tres casos del laboratorio 05 son
> avance rápido con `tailandesa`, confirmación de unión con `azteca` —que toca
> **otro archivo**, `recetas/guacamole.md`— y conflicto con `andina`. El
> segundo ya funcionaba. La sección 54 lo explica.

---

# SPEC 012 · cierre

## 53. El reloj: la zona y el orden

Los dos los pidió el product owner después del informe, y los dos son la misma
cosa vista de dos maneras: el motor había aprendido a llevar la hora en el
SPEC 010 y nadie había vuelto a mirar lo que hacía con ella.

### La hora se escribe en el desplazamiento que declara

Git guarda **el instante y el desplazamiento**, y muestra la hora en el
desplazamiento guardado. `preparar.sh` le pasa `@1719915900 -0300`, así que el
disco dice `Tue Jul 2 10:25:00 2024 -0300`.

El simulador rotulaba `-0300` y escribía la hora de UTC, tres horas más
adelante. Ahora corre el instante al desplazamiento y **después** lo lee con los
métodos UTC, que es la única forma de que el resultado no dependa de la zona de
la máquina donde corre el motor: es código puro (restricción R3) y tiene que dar
lo mismo en Santiago que en cualquier otra parte. Una prueba exige que el módulo
no llame a `getHours`, `toLocaleString` ni `getTimezoneOffset`.

**El desplazamiento es fijo a propósito**, igual que en el disco. Chile tiene
horario de verano; aplicarlo movería las fechas de los escenarios según el mes y
rompería la comparación contra el repositorio que el participante tiene delante.

De paso se fue el relleno del día: Git escribe `Jul 2`, no `Jul  2`.

**Lo que este defecto enseña no es el defecto.** Es que la fecha de las
confirmaciones **no tenía ninguna prueba que la fijara**. Ni una. Por eso pudo
quedarse mal desde el SPEC 010 sin que nada se pusiera rojo, y por eso el
arreglo llegó con cuatro pruebas que la clavan contra la salida de Git.

### El historial se ordena por fecha

Es la decisión 4.7, que decía «al no haber reloj real, el historial se ordena
por el orden en que las confirmaciones entraron al modelo». El SPEC 010 le puso
reloj y la razón caducó ahí.

`historia` ordena ahora por instante, de la más reciente a la más antigua, que
es lo que hace `git log`. Ante un empate se conserva el orden de creación
invertido: no hay nada mejor con qué desempatar, y así el cambio no altera lo
que ya estaba bien.

**Y sí mordía, al revés de lo que decía el informe.** En una sola rama los dos
órdenes coinciden y no se nota. Donde se nota es en `git log --all` sobre un
escenario cuyas ramas se cruzan en el tiempo, y el **laboratorio 07 es
exactamente eso**: declara primero las cuatro confirmaciones de `main` y después
las cuatro de la rama de trabajo, que ocurrieron entre medio.

| Orden | Resultado |
|---|---|
| Git, comprobado | cocineros, pastel, arreglos, mas cambios, cambios, wip, platos, README |
| El simulador, antes | arreglos, mas cambios, cambios, wip, cocineros, pastel, platos, README |
| El simulador, ahora | el de Git |

Comprobado contra Git sobre un repositorio construido con **las ocho fechas
exactas del laboratorio 07**, no sobre un caso parecido. El `git lg` de ese
enunciado mostraba las dos ramas en dos bloques donde Git las intercala.

El orden por fecha no rompe la relación entre padres e hijos porque en los ocho
escenarios ninguna confirmación es anterior a su padre, y hay una prueba que
recorre los ocho y lo exige: el día que un escenario declare una fecha al revés,
lo dice.

`--date-order` estaba declarada en `EQUIVALENTES` con el motivo «la historia ya
se recorre por fecha». Era falso cuando se escribió y ahora es verdad.

## 54. La detección de conflictos, por línea

El punto 5.4 del SPEC 012 pidió no tocar la detección mientras se introducía el
modelo de contenido, para no juntar dos riesgos. Hecho eso, el product owner
pidió el cambio.

### Qué cambió

`ordenMerge` declaraba conflicto cuando las dos ramas habían tocado el mismo
archivo. Ahora esos archivos son **candidatos**: se pasan por
`fusionarTresVias`, que ya existía para escribir los marcadores, y sólo son
conflicto los que devuelven `choco`. Los demás quedan fusionados y preparados,
como los deja Git.

El árbol de la unión se arma con la misma función, de modo que **lo que el
participante ve en el directorio y lo que queda en la confirmación son el mismo
texto**, sin dos caminos que puedan separarse.

La salida se ajustó a la de Git, comprobada con un archivo de cada clase: una
línea `Auto-merging` por cada archivo que hubo que fusionar, **en orden de
ruta**, y el `CONFLICT` pegado justo debajo del que chocó. Antes se imprimían
todos los `Auto-merging` juntos y después todos los `CONFLICT`, y sólo para los
archivos en conflicto.

### Qué se gana, y qué no

Comprobado contra Git sobre repositorios con la misma forma, dos ramas que tocan
`platos.md` —una sumando un fondo arriba y la otra una entrada al final— ahora
se fusionan solas en los dos lados, con la misma salida y el mismo archivo
resultante. Antes el simulador declaraba conflicto.

**Lo que no se gana es el tercer caso del laboratorio 05**, y aquí hay que
corregir lo que este documento decía. Sus tres casos son:

| Parte | Rama | Qué enseña |
|---|---|---|
| 1 | `tailandesa` | avance rápido |
| 2 | `azteca` | confirmación de unión, tocando **otro archivo** |
| 3 | `andina` | conflicto sobre `platos.md` |

El segundo caso **ya funcionaba**: `azteca` toca `recetas/guacamole.md`, que
`main` no toca, así que nunca fue candidato a conflicto. La frase del punto 5.3
del spec —«una de ellas es la fusión automática de dos ramas que tocaron el
mismo archivo sin chocar»— describe algo que el enunciado no hace, y este
documento la repitió sin contrastarla.

Lo que el cambio sí hace es quitar una mentira que estaba latente: **cualquier
participante que tanteara** abriendo una rama y tocando un archivo que `main`
también tocó recibía un conflicto donde Git no lo da. No está en el guion, y el
guion no es el límite de lo que el participante escribe.

Y desaparece el desajuste de la sección 49: ya no puede haber un archivo
declarado `both modified:` cuyo contenido salga fusionado y sin marcadores,
porque las dos cosas las decide ahora la misma función.

**Mostrar el tercer caso en el laboratorio 05 pide cambiar el escenario**, para
que una rama toque `platos.md` en otra región, con su `preparar.sh` y su
enunciado. No se hizo: cambia el laboratorio, no el motor.

> **Se hizo después, a pedido del product owner.** El laboratorio 05 tiene
> ahora cuatro casos de fusión y la rama `criolla`. Sección 55.

### El `echo` de la línea en blanco

Apareció al construir el caso de prueba. `echo "" >> archivo` escribía **nada**
donde bash escribe una línea vacía: el texto se normalizaba antes de pegarle el
salto, y el vacío normalizado es el vacío.

Importa más de lo que parece. Los archivos del recetario separan sus secciones
con una línea en blanco, y `echo` es la única forma de escribir dentro del
simulador: un participante que rehiciera `platos.md` obtenía un archivo sin
ninguna separación. El arnés del recorrido las saltaba por la misma razón, así
que los dos lados coincidían en un archivo que no era el que el enunciado
muestra; ahora las escribe y coinciden en el que sí.

## 55. El cuarto caso de fusión del laboratorio 05

La sección 54 cerró la detección por línea y dejó anotado que mostrar el caso
en el enunciado pedía cambiar el escenario. El product owner lo pidió.

### La rama nueva es el gemelo de `andina`

`criolla` nace **del mismo punto** que `andina`, cambia **el mismo archivo**
—`platos.md`— y agrega **una receta**, igual que ella. La única diferencia es
qué línea de `platos.md` toca: `andina` reemplaza la de la cazuela, que es justo
la que `main` cambió después; `criolla` agrega una entrada al final, a cuatro
líneas de distancia, con `## Entradas` y la empanada entre medio.

El paralelo es deliberado y es lo que convierte la predicción en un ejercicio y
no en una adivinanza: **el participante no puede decidir mirando qué archivos
toca cada rama, porque son los mismos.** Tiene que mirar las líneas.

Los cuatro casos, y qué enseña cada uno:

| Parte | Rama | Resultado | Lo que desarma |
|---|---|---|---|
| 1 | `tailandesa` | avance rápido | que fusionar siempre crea algo |
| 2 | `azteca` | unión, otro archivo | que haya que resolver algo a mano |
| 3 | `criolla` | unión, **mismo archivo**, automática | **que tocar el mismo archivo sea conflicto seguro** |
| 4 | `andina` | conflicto | — |

El tercero es el que el product owner señaló como el que importa, y tiene razón
en por qué: es la creencia que hace que la gente evite ramas por miedo a
conflictos que no van a ocurrir.

### La predicción va antes de la orden

El punto 3.1 hace mirar `git show criolla` y `git show andina`. Las dos ramas
son una sola confirmación sobre la base común, así que **el parche de cada una
es exactamente lo que cambió respecto de la base**, que es lo que decide la
fusión. No hace falta ningún `merge-base` ni sustitución de órdenes.

El 3.2 pide contestar por escrito cuál va a chocar y por qué la otra no, antes
de ejecutar. El 3.3 fusiona `criolla` y la salida contradice a quien predijo
conflicto. La sorpresa es el ejercicio.

### El verificador comprueba las dos mitades de la premisa

Un escenario donde `criolla` **no** tocara `platos.md` sería el mismo caso que
`azteca` y la Parte 3 se quedaría sin ejercicio, en silencio. Así que el
verificador exige las dos cosas:

- que `criolla` cambie `platos.md` desde la base común, como `main`;
- y que los dos cambios **no se pisen**, fusionando los tres textos de verdad
  con `git merge-file`, que devuelve cero cuando no queda ningún conflicto.

Se usa `merge-file` y no `merge-tree --write-tree` porque la segunda pide Git
2.38 y el proyecto se compromete con 2.28 (punto de `preparar.sh`).

En el estado final el verificador espera ahora **tres** confirmaciones de unión
en vez de dos, y las cuatro ramas de trabajo borradas.

### `git diff` entre revisiones, que estaba mintiendo

El paso 3.1 del enunciado viejo ya decía `git diff main andina -- platos.md`, y
el simulador **la aceptaba y no imprimía nada**. Es la cuarta respuesta que el
SPEC 010 eliminó, en el paso donde el participante tiene que entender por qué
dos ramas van a chocar, y llevaba ahí desde que el laboratorio existe.

Ahora compara dos árboles, o uno contra el directorio de trabajo cuando se
nombra una sola referencia, y limita a las rutas que van detrás del `--`.
Comprobado contra Git: idéntico salvo la línea `index`, como el resto de los
parches.

De paso, `antesDelSeparador` y `trasElSeparador` dejaron de estar duplicadas en
`git log` y pasaron al analizador, que es de donde son.

### El tiempo

El laboratorio suma **70 minutos**, los mismos que antes y los mismos que el
encabezado declara. La parte nueva se pagó recortando las dos primeras:

| Parte | Antes | Ahora | Por qué |
|---|---|---|---|
| 1 · avance rápido | 20 | **10** | Son nueve órdenes y ninguna sorpresa: el caso más simple estaba sobrepresupuestado |
| 2 · unión con otro archivo | 20 | **15** | Lo único lento es aceptar el mensaje en el editor |
| 3 · mismo archivo, sin chocar | — | **15** | Nueva: mirar, predecir, fusionar y leer el resultado |
| 4 · conflicto | 30 | **30** | Intacta. Es la más cara y la que no conviene apretar: lleva el aborto, la resolución a mano y el editor |

El 4.1 quedó además más corto que el 3.1 viejo: ya no tiene que descubrir por
qué va a chocar, sino confirmar la predicción comparándola con la fusión limpia
que el participante acaba de ver.

### La cobertura

El laboratorio pasó de **47 órdenes recorridas a 56** y se queda en **96 por
ciento en pantalla**: las nueve nuevas se comparan todas en los dos lados. La
única que sigue fuera es el `cd` de la Preparación, que es de alcance.

Sube porque `git diff` entre revisiones dejó de mentir: antes esa orden del
paso 3.1 contaba como comparada —no fallaba en ninguno de los dos lados— y lo
que devolvía era nada.

---

# Laboratorios 07 y 08 armados

## 56. Los dos últimos de la sesión 5

Se copiaron desde el material del arquitecto —`LAB-08` y `LAB-09` de la
numeración vieja— con los mismos cambios que se le hicieron a los del 02 al 06,
comprobados diffeando los originales contra los ya copiados en vez de confiar en
la memoria:

1. El número del título y el encabezado sin `· repositorio semilla lab-NN`.
2. La ruta: `labs/lab-NN/preparar.sh` y `cd ../taller-git-trabajo/lab-NN/recetario`.
3. La sección que dice a qué escenario llevar el simulador. **En el 08 no**:
   ahí va en su lugar el aviso de que ese laboratorio entero se hace en la
   terminal.
4. Las referencias cruzadas a otros laboratorios, renumeradas según la tabla de
   la sección 31. Es lo que se hizo en el 04, comprobado en su diff.
5. «Prepara la semilla otra vez» pasa a «Vuelve a ejecutar `preparar.sh`».

**El 07 entra a la comparación contra el disco.** Su `preparar.sh` se escribió
contra la declaración del escenario y la suite lo comparó árbol por árbol y
archivo por archivo: pasó a la primera. Los escenarios sin `preparar.sh` quedan
en uno solo, el del laboratorio 09.

**El 08 no lleva escenario ni recorrido comparado**, por el acuerdo de la
sección 24. Su `preparar.sh` arma dos repositorios —el recetario con su remoto y
el de condimentos— y los deja empaquetados al lado, sin invocar nada de
`semillas/`, que sigue sin uso.

## 57. Los desajustes entre enunciado y escenario

Ninguno se corrigió: se reportan, y decide el arquitecto. Van de mayor a menor.

### 57.1 · El 07 nombra `trabajo` y el escenario nombra `tailandesa`

**Bloqueante.** El enunciado escribe `git switch trabajo`,
`git log --oneline main..trabajo` y seis usos más. El escenario declarado —y por
lo tanto el `preparar.sh` que sale de él— crea la rama `tailandesa`.

El origen es anterior a este trabajo: la descripción de la semilla del SPEC 003
ya decía `tailandesa`, y la declaración del simulador la siguió. El enunciado
nunca dijo eso.

Mientras no se resuelva, **el laboratorio 07 no se puede hacer**: el
participante se estrella en el punto 1.5. Por eso tampoco se agregó al recorrido
comparado, que fallaría entero.

El verificador acepta las dos, la que exista, y lo dice en su comentario.

### 57.2 · El 07 guarda temporalmente algo que `git stash` no guarda

**Bloqueante, y comprobado contra Git.** El escenario deja
`recetas/curry-massaman.md` **sin seguimiento**. Con eso:

| Paso del enunciado | Lo que dice | Lo que hace Git |
|---|---|---|
| 1.2 `git switch main` | «Git se niega y te explica por qué» | Cambia de rama sin reclamar: un archivo sin seguimiento que no choca no impide nada |
| 1.3 `git stash push -m ...` | «Tu directorio quedó limpio y la receta desapareció» | `No local changes to save`. La pila queda vacía y la receta sigue ahí |

`git stash` sin `-u` no toca lo que no está en seguimiento. Como la única
suciedad del escenario es un archivo nuevo, **la Parte 1 entera —45 minutos, del
1.3 al 1.12— se queda sin materia**.

Las dos salidas posibles son del arquitecto: que la receta sea un archivo
**seguido y modificado**, o que el enunciado use `git stash push -u`. La
descripción de la semilla dice «sin seguimiento», así que el desajuste está
entre esa descripción y el enunciado, no en la declaración del simulador.

### 57.3 · El 07 hace `rebase -i` y el motor lo acepta sin hacer nada

**`-i` y `--interactive` están declaradas en `OPCIONES` de `rebase` y no las lee
nadie**: aparecen únicamente dentro de `contrato.ts`. Es una opción aceptada y
descartada, que es lo único que el contrato del SPEC 010 no admite.

En la práctica, `git rebase -i HEAD~4` responde
`Current branch tailandesa is up to date.` y no hace nada, donde Git reescribe
las cuatro confirmaciones. **La Parte 3 entera —25 minutos, `reword` y
`squash`— no ocurre en el simulador.**

La prueba que debería haberlo detectado no lo hace porque busca el texto de la
opción en todo `src/core`, y `contrato.ts` está dentro: una opción declarada y
nunca leída se encuentra a sí misma. El agujero es de la prueba, no del
contrato.

### 57.4 · El 08 apunta los dos remotos al mismo paquete

**Bloqueante.** El enunciado agrega `upstream` como «el proyecto original» y
espera que traiga cosas que `main` no tiene. La semilla hace que `origin` y
`upstream` sean **el mismo paquete**, así que:

- 1.4 «Aparecieron ramas nuevas, las de `upstream`» — aparecen, pero son las
  mismas.
- 1.5 `git log --oneline main..upstream/main` — vacío.
- 1.6 `git merge upstream/main` — `Already up to date.`, donde el enunciado dice
  «Ahora sí vas a mover tu rama».

Comprobado contra Git con los paquetes de la semilla y con los que arma el
`preparar.sh` nuevo. Qué debe traer `upstream` de más es una decisión del
arquitecto, así que el `preparar.sh` reproduce la semilla tal cual y no lo
inventa.

### 57.5 · El submódulo del 08 no funciona en ningún Git actual

**Bloqueante, y no es culpa del enunciado.** `git submodule add <ruta local>`
responde:

```
fatal: transport 'file' not allowed
```

Git bloquea el transporte `file` para submódulos **desde la versión 2.38.1**, de
octubre de 2022, por la CVE-2022-39253. Comprobado con Git 2.54.

Afecta a la Parte 2 entera, 25 minutos, y afectaría igual al enunciado original
con las rutas de `semillas/paquetes/`. Se arregla con
`git -c protocol.file.allow=always submodule add ...` o poniendo esa
configuración en el repositorio desde `preparar.sh`; las dos cambian lo que el
participante escribe o lo que el escenario trae, así que ninguna se tomó.

### 57.6 · Diferencias del simulador en el tramo de guardado temporal

Ese tramo nunca se había recorrido comparado, y aparecieron seis. Ninguna
bloquea, todas se ven.

| Forma | Git | El simulador |
|---|---|---|
| `git stash pop` que choca | Se niega, conserva la entrada y lo dice: «The stash entry is kept in case you need it again» | **Aplica y borra la entrada**. El punto 1.10, que es «la parte que sorprende», no ocurre |
| `git stash drop` | Imprime el identificador **de la entrada** | Imprime el de la confirmación sobre la que se guardó: dos entradas distintas informan el mismo |
| `git stash show` | ` 1 file changed, 1 insertion(+)` | ` 1 file changed`, sin contar líneas |
| `git stash list --stat` | Una línea en blanco entre cada entrada y su resumen | Sin la línea en blanco |
| `git stash show -p` | El parche | Declarada no implementada. Está en el punto 1.7 del enunciado |
| `git switch` a la rama en que ya estás | `Already on 'x'` | `Switched to branch 'x'` |

Y una que no es del simulador: **el punto 1.10 tampoco hace lo que dice en Git**.
El enunciado espera marcadores de conflicto al recuperar sobre un archivo
modificado a mano; Git se niega antes, con
`error: Your local changes to the following files would be overwritten by merge`.
Para que salgan marcadores hace falta otra situación.

### 57.7 · El rebase del 07, en lo que se ve

`git rebase main` sí funciona y deja la historia recta con identificadores
nuevos, que es lo que la Parte 2 viene a enseñar. Dos diferencias menores:

- Git imprime `Rebasing (1/4)`…`(4/4)`; el simulador solo la línea final.
- El registro de referencias de Git anota `rebase (start)`, cuatro
  `rebase (pick)` y `rebase (finish)`; el simulador anota un `checkout` y el
  `rebase (finish)`. **Las confirmaciones originales sí quedan en la bitácora**,
  que es lo que el punto 2.4 hace comprobar, así que ese paso se sostiene.

### 57.8 · La tabla de renumeración tenía dos títulos corridos

La tabla de la sección 31 decía:

| Antes | Ahora | Título que decía | Título que es |
|---|---|---|---|
| 09 | 08 | Conectar y publicar | **Dos remotos y un gancho** (el de entonces nombraba también el submódulo; sección 59) |
| 10 | 09 | Etiquetas, versiones y limpieza | **Conectar y publicar** |

El material del arquitecto tiene `LAB-09-dos-remotos-un-submodulo-y-un-gancho` y
`LAB-10-conectar-y-publicar`, y no tiene ningún «Etiquetas, versiones y
limpieza». Los números de la tabla eran correctos; los dos títulos, no. La
declaración del simulador para el 09 dice «Conectar y publicar», que es lo
correcto.

**Corregido en la sección 31.**

### 57.9 · Dos formas distintas de escribir la Preparación

Los enunciados 03, 04 y 06 decían `labs/lab-NN/preparar.sh` desde la raíz del
clon, y explicaban dónde pararse. El 02 y el 05 decían `./preparar.sh` con un
`cd ../../../`. Los dos funcionan; eran dos formas para lo mismo. El 07 y el 08
siguieron la de los tres, que es la que explica dónde está parado el
participante.

**Unificado: los siete enunciados que se preparan usan hoy la forma de los
tres.** Una prueba de `laboratorios.test.ts` la exige para todos y rechaza la
forma vieja, de modo que la divergencia no puede volver sin que la suite lo
diga.

---

## 58. La resolución de los nueve desajustes, y las dieciséis opciones que salieron del contrato

La sección 57 dejó nueve desajustes reportados y sin tocar, que es lo que el
propietario pidió. Los nueve están resueltos. Cuatro de ellos no eran defectos
del simulador ni de los escenarios: eran decisiones que el propietario cambió
al mirarlas. Esta sección anota qué se hizo con cada uno y, sobre todo, el
tercero, que resultó el más caro porque destapó un agujero en la prueba que
vigila el contrato.

### 58.1 · Qué se hizo con cada uno

| # | Desajuste | Resolución | Quién cedió |
|---|---|---|---|
| 1 | La rama del 07 se llama `trabajo` en el enunciado y `tailandesa` en el escenario | Se renombró en el escenario y en `preparar.sh`. El enunciado no se tocó | el escenario |
| 2 | El 07 guarda con `git stash` una receta que el escenario deja sin seguimiento | La receta pasa a estar versionada y modificada encima | el escenario |
| 3 | El 07 hace `rebase -i` y el motor lo aceptaba sin hacer nada | Se arregló la prueba del contrato, se declaró `rebase -i` como no soportada y la parte 3 del 07 se hace en la terminal | el simulador |
| 4 | Los dos remotos del 08 apuntaban al mismo paquete | `upstream.bundle` va dos confirmaciones por delante de `recetario.bundle` | el escenario |
| 5 | El submódulo del 08 no funciona en ningún Git posterior a octubre de 2022 | La parte del submódulo sale del enunciado y queda explicado en dos párrafos que se leen y no se ejecutan | el enunciado |
| 6 | Seis diferencias del simulador en el tramo de guardado temporal | Las seis implementadas | el simulador |
| 7 | El rebase del 07 se ve distinto en el registro de referencias | Anotado, sin cambio: lo que el punto 2.4 hace comprobar se sostiene | nadie |
| 8 | Dos títulos corridos en la tabla de renumeración | Corregidos en la sección 31 | la documentación |
| 9 | Dos formas de escribir la Preparación | Unificadas en la de los tres, con una prueba que la exige | los enunciados |

### 58.2 · El agujero de la prueba del contrato

La prueba «toda opción que el contrato reconoce la lee alguien» leía **todo**
`src/core`, y `contrato.ts` vive en `src/core`. Una opción declarada allí y
leída por nadie se encontraba a sí misma en la declaración y aprobaba. La
prueba comprobaba que el contrato estuviera escrito, no que alguien lo
obedeciera.

Excluirlo destapó además un ruido propio de la prueba: las opciones de una
sola letra se leen en el código con `has('u')` y no con la cadena `'-u'`, así
que aparecían como no leídas sin serlo. La prueba acepta hoy las dos formas.

Descontado ese ruido, quedaron al descubierto **dieciséis opciones** declaradas
y leídas por nadie:

| Orden | Opción | Qué pasaba | Resolución |
|---|---|---|---|
| `config` | `--local` | el ámbito por omisión | declarada equivalente |
| `config` | `--get` | la forma explícita de consultar | declarada equivalente |
| `config` | `--unset` | no borraba nada | **implementada** |
| `restore` | `--source` | restauraba desde la confirmación actual, no desde la que se le pedía | sale del contrato |
| `commit` | `--allow-empty` | respondía «nothing to commit»; Git crea la confirmación | sale del contrato |
| `merge` | `--continue` | se ignoraba | **implementada** |
| `merge` | `--no-ff` | se ignoraba: avanzaba rápido igual | **implementada** |
| `merge` | `--ff-only` | se ignoraba: fusionaba igual | **implementada** |
| `reset` | `--mixed` | es el modo por omisión | declarada equivalente |
| `revert` | `--continue` | la reversión del motor nunca choca | sale del contrato |
| `revert` | `--no-commit` | aplicaba y confirmaba igual, que es lo contrario | sale del contrato |
| `stash` | `-u` | no guardaba lo que no estaba en seguimiento | sale del contrato |
| `stash` | `--include-untracked` | lo mismo | sale del contrato |
| `rebase` | `--continue` | el rebase del motor no se detiene nunca | sale del contrato |
| `rebase` | `-i` | aceptaba y no hacía nada | **sin soporte, con motivo** |
| `rebase` | `--interactive` | lo mismo | **sin soporte, con motivo** |

«Sale del contrato» significa que la opción pasa a responder que no está
soportada, con su motivo. Es la segunda de las tres respuestas que el SPEC 010
permite, y es honesta: la orden existe en Git, el simulador no la hace, y lo
dice.

`rebase -i` no salió por la puerta de las opciones sino por la de
`SIN_SOPORTE`, y el motivo lo explica: **no es una orden que falte, es un modo
de trabajo que la pantalla no tiene.** El rebase interactivo abre un editor con
la lista de confirmaciones y se eligen las acciones línea por línea. Esa
interacción no cabe en una terminal simulada de una sola línea, y fingirla
enseñaría algo falso.

### 58.3 · Dos hallazgos que aparecieron al arreglar lo anterior

**`git switch` a la rama en la que ya se está.** Decía
`Switched to branch 'main'` y anotaba en la bitácora un movimiento que no
ocurrió. Git dice `Already on 'main'` y no anota nada. El participante del 07
se cambia a la rama donde ya está más de una vez y veía una mudanza inventada.
Corregido, con la distinción que Git hace: estando desconectado sobre la misma
confirmación, volver a la rama **sí** es un movimiento y sí se anota.

**`--detach` se aceptaba y no se obedecía.** `git checkout --detach main`
dejaba la posición en la rama. La prueba del contrato no lo veía porque
`'--detach'` sí aparece en el código, en la rama de `git switch`: la prueba
busca la cadena en todo el archivo y no por subcomando. Es la misma clase de
agujero que 58.2, un escalón más abajo. Corregido: `--detach` deja la posición
en la confirmación aunque el nombre sea el de una rama.

**Queda anotada la limitación de la prueba**: comprueba que la opción se lea en
alguna parte, no que la lea el subcomando que la declara. Cerrarla del todo
pide leer el código por función, que es otro trabajo.

> **Cerrada en la sección 59**, y lo que destapó fueron cuarenta y una
> opciones más.

### 58.4 · Dos cosas que no se cambiaron, y por qué

**El título del laboratorio 08 sigue prometiendo un submódulo.** Lo nombra
entre los dos remotos y el gancho, y el laboratorio ya no lo practica. El
título es el del material del arquitecto y es el que la sección 31 fija, así
que no se toca sin que él lo diga. El enunciado explica en su primer párrafo
que la parte del submódulo se lee y no se ejecuta.

> **Cambiado por el product owner**: hoy es «Dos remotos y un gancho».
> Sección 59.

**El `git status` largo del simulador imprime una línea en blanco después de
`On branch X` que Git no imprime.** Es una diferencia de una línea, no cambia
nada de lo que el participante aprende, y tocarla mueve la comparación contra
disco de varios escenarios. Queda anotada para cuando haya otra razón para
entrar ahí.

---

## 59. El contrato leído por función, y las cuarenta y una opciones que aparecieron

Dos encargos del product owner.

### 59.1 · El laboratorio 08 se llama «Dos remotos y un gancho»

El submódulo salió del ejercicio en la sección 58.1 y el título lo seguía
prometiendo. Cambió en el enunciado, en el encabezado del verificador, en la
tabla de la sección 31 y en toda mención viva: los dos `README.md`, los
comentarios de `escenarios/`, las pruebas y las secciones 48 y 52. Las
secciones 24 y 58.4 llevan una nota en vez de reescribirse, porque son
registro. `labs/README.md` mostraba además un `condimentos.bundle` que
`preparar.sh` ya no arma; hoy muestra `upstream.bundle`, que es el que arma.

La sección «Sobre los submódulos» del enunciado se quedó: se lee y no se
ejecuta, y el primer párrafo lo dice.

### 59.2 · La prueba lee el código por función

`tests/codigo-por-funcion.ts` parte `src/core` en declaraciones de primer
nivel, sin comentarios, y sigue quién nombra a quién resolviendo las
importaciones. Para cada orden, la prueba toma su manejador de la tabla del
despachador y junta el texto de todo lo que alcanza, **sin entrar en
`contrato.ts` ni en el manejador de otra orden**. La opción tiene que estar
ahí. TypeScript 7 no tiene API programática (sección 1), así que no hay árbol
de sintaxis: alcanza con que el motor declare todo en la columna cero, que lo
cumple entero.

Cierra cuatro formas del mismo agujero, y la prueba las arma a propósito para
verse fallar con cada una:

1. **La opción leída en otro subcomando.** Es el caso de `checkout --detach`.
   Quitándole la lectura a `git checkout`, la prueba falla con
   `git checkout --detach`; la versión anterior pasaba.
2. **La opción citada en un comentario.** Hoy ninguna, pero citar no es leer.
3. **La equivalencia de una orden que eximía a otra.** `EQUIVALENTES` iba
   por opción sola, así que el motivo de `-q` en `git init` eximía a
   `git commit`. Ahora la clave es la orden y la opción juntas, y una prueba
   exige que cada equivalencia nombre una opción que el contrato declara.
4. **El nombre repetido en los dos lados.** `rm` y `mv` existen en Git y en el
   intérprete, y compartían tabla: `rm --cached`, que en bash no existe, pasaba
   por la opción de `git rm`. El intérprete tiene ahora su tabla,
   `OPCIONES_INTERPRETE`.

**Sigue siendo una cota por arriba.** Dice que el código que la orden puede
ejecutar lee la opción, no que la lea con los argumentos de esa orden: eso es
flujo de datos. Si un manejador llama a una función compartida que lee
`--detach` sólo cuando la llama otro, esta prueba no lo ve. Hoy no hay ningún
caso así, y cerrarlo del todo ya no es leer por función sino ejecutar.

### 59.3 · Lo que apareció

**Cuarenta y una opciones** que el contrato aceptaba y el manejador de su orden
no leía, o leía otro. Se comprobó cada una en el motor, con la opción y sin
ella, antes de decidir. Van por familia:

| Familia | Opciones | Qué pasaba |
|---|---|---|
| `-q` / `--quiet` | `git init`, `commit`, `rm`, `branch`, `switch`, `checkout` y `rm` del intérprete | Declaradas equivalentes porque «no hay ruido que callar». `git commit -q` imprime el resumen igual, `git switch -q` imprime `Switched to…` y `git rm -q` imprime `rm '…'`. Git calla las tres |
| `git commit -a` / `--all` | 2 | **Confirmaba sólo lo preparado.** En el escenario del 02, `git commit -a` deja fuera `ingredientes.md`, que Git incluye |
| `git commit -am` | la agrupación | El contrato aceptaba las cortas agrupadas letra por letra en toda orden, y `git commit` lee palabras enteras: `-am` llegaba sin `-a` ni `-m` y respondía `Aborting commit due to empty commit message` |
| `git branch -v` / `--verbose`, `-a` / `--all` | 4 | `-v` se declaraba equivalente, «la salida ya es la detallada», y no lo es: en Git lleva identificador y mensaje, y el simulador lista sólo nombres. `-a` no la leía nadie |
| `git mv -v` / `mv -v` | 4 | Lo mismo: Git dice `Renaming a to b`, el `mv` de macOS `a -> b`; el simulador no dice nada |
| `git mv -f` / `mv -f` y `--force` | 4 | Una equivalente y la otra no leída, para lo mismo |
| `git merge --message` | 1 | **Tomaba el mensaje por la rama a fusionar**: `merge: hola - not something we can merge`. `-m` sí funciona |
| `git tag -l` / `--list`, `-n` | 3 | `git tag -l "v1*"` **no devolvía nada**; `-n` no mostraba el mensaje de cada etiqueta |
| `git reflog -n`, `--all` | 2 | `git reflog -n 1` **no devolvía nada**, porque tomaba el `1` por una rama; `-10` mostraba el registro entero; `--all` mostraba sólo `HEAD` |
| `git show --oneline` | 1 | Mostraba la cabecera larga, como si no estuviera |
| `git cat-file -s` | 1 | Respondía con un uso inventado, `usage: git cat-file (-t \| -p)` |
| `ls -l` | 1 | Listaba en formato corto |
| `rm` del intérprete: `--cached`, `-r`, `-f`, `--force` | 4 | Venían de la tabla de `git rm`. `--cached` no existe en bash |

Y dos que **no** eran opciones descartadas pero la prueba señaló igual, porque
la lectura no estaba donde debía:

- **`git rebase --abort`** respondía bien por casualidad: el manejador no la
  leía, veía que no había base y decía `No rebase in progress?`.
  **`git rebase --abort main` rebasaba sobre `main`.** El laboratorio 07 la
  nombra, así que se implementó: se lee primero y responde lo de Git.
- **`ls -a`** se leía como palabra entera, así que `ls -aR` escondía `.git`.
  Se lee por su letra, como `-R`.

### 59.4 · Qué se hizo con cada una

La regla fue la misma para todas, y no hubo que decidir caso por caso:

- **La que el guion usa, se implementa.** Dos: `git rebase --abort` y el
  número de `git reflog`, que los laboratorios 06 y 07 escriben como `-10`,
  `-15` y `-20`. Ésta la saqué primero del contrato por error, y lo que lo
  destapó está en 59.6.
- **La que coincide con Git sin código, pasa a equivalente con su orden.**
  Tres: `git rev-parse --short`, porque los identificadores del simulador ya
  son cortos, y `git ls-files --cached` y `-c`, que son el modo por omisión.
- **Todas las demás salen del contrato** y responden que no están
  implementadas y que en la terminal sí funcionan. Es la segunda de las tres
  respuestas y la única honesta sin escribir código nuevo. Ninguna aparece en
  un enunciado que el simulador recorra: el único uso es `git branch -a` del
  laboratorio 08, que va entero en la terminal.
- **`git rebase --continue`**, que ya había salido de las opciones en la
  sección 58, pasa a `SIN_SOPORTE` con su motivo. El rescate del 07 la nombra,
  y «no implementa la opción» no le decía al participante por qué: el rebase
  del simulador nunca se detiene, el que se detiene es el de la terminal.
- **La agrupación de cortas** queda sólo para `ls`, `grep` y `wc`, que son las
  que las leen por su letra (`AGRUPABLES`). Una prueba exige que cada corta de
  esas tres se lea con `has('x')`, y otra que `git commit -am` se responda como
  límite.

Las que más convendría implementar, si el product owner quiere, son
`git commit -a` y `-q`, que el participante escribe por costumbre aunque el
guion no las use. Implementarlas es devolverlas a la tabla con su lectura; la
prueba impide volver a ponerlas sin ella.

### 59.5 · Lo que la prueba no ve, y apareció igual

**`git add -a`** lo acepta el simulador como `--all`. En Git no existe:
`error: unknown switch 'a'`. No es una opción descartada sino una inventada,
así que la prueba del contrato la da por buena. Sacarla del contrato haría que
el simulador dijera «en la terminal sí funciona», que es falso.

> **Arreglada en 59.7** sin tocar el contrato: la opción sigue declarada para
> que llegue al manejador, y el manejador responde el error de Git.

### 59.6 · La prueba del guion se aprobaba sola, y le faltaba un laboratorio

Al sacar `-n` de `git reflog` la suite quedó en verde. Lo que avisó fue el
informe de movimiento del laboratorio 06, que perdió una fila: `git reflog -10`
había dejado de ejecutarse en el simulador y nadie lo dijo.

**Es otra vez el patrón de las secciones 11 y 32.** La prueba «el guion no usa
ninguna opción que el contrato no nombre» mira sólo las órdenes comparadas, y
quien decide si una orden es comparada o declarada es el mismo contrato. Sacar
una opción de la tabla convierte en declarada la orden que la usa, y la prueba
sigue en verde mirando una orden menos.

Una prueba nueva lo cierra: **ninguna orden del guion puede quedar fuera por
una opción**. Lo único que puede dejarla fuera es una forma de `SIN_SOPORTE`,
que lleva su motivo escrito. Se vio fallar con `git reflog -10` antes de
arreglarlo, y con `git rebase --continue`, que es lo que la llevó a su forma
propia.

Y la lista de laboratorios que esas pruebas recorren **terminaba en el 06**.
El 07 está armado y con escenario desde la sección 56, y ninguna de las
pruebas del guion miraba sus órdenes. Entró, y pasó entero salvo el
`--continue` de arriba.

### 59.7 · El cierre del SPEC 014

El SPEC 014 llegó después de los dos commits de arriba y pide lo mismo: el
título del 08 y el agujero de la prueba. Se revisó criterio por criterio sobre
lo ya hecho, y faltaban tres cosas.

**La comprobación contra Git de verdad** (punto 2.6). Los comportamientos de
59.3 se habían comprobado en el motor, con la opción y sin ella, pero lo que
Git hace se había escrito de memoria. Se corrió cada uno en Git 2.54 sobre un
repositorio hecho para la ocasión. Todo lo afirmado se sostuvo, salvo dos:

| Orden | Lo que se había escrito | Lo que hace Git 2.54 | Ahora |
|---|---|---|---|
| `git rebase --abort main` | que respondía «no hay rebase en curso» | **el uso de la orden**, código 129: no acepta nada detrás de `--abort` | responde el uso |
| `git rebase --abort` | `fatal: No rebase in progress?` | `fatal: no rebase in progress`, en minúsculas y sin pregunta | el texto de Git |

Y `git add -a`, que 59.5 dejó anotado, **dice ahora lo que Git**:
`error: unknown switch 'a'`. No se agregó nada al contrato (punto 4.1 del
spec): `-a` ya estaba declarada, y el manejador pasó de obedecer una opción
inventada a rechazarla con el texto de Git, que es la tercera respuesta.

`git rebase` sin argumentos sigue diciendo `No rebase in progress?`, que es el
texto de un Git más viejo; el 2.54 dice otra cosa. No es una opción, así que
queda fuera de este spec y anotado aquí.

**El título viejo en dos registros** (CA1). Las secciones 57.8 y 58.4 lo
citaban textual. El criterio pide que no aparezca en ninguna parte, y se
reescribieron nombrándolo sin citarlo. Una búsqueda en todo el repositorio no
lo encuentra.

**La cobertura, antes y después** (CA5). Se midió con la misma función que usa
el recorrido de Cypress, sobre el commit anterior a la sección 59 y sobre el
de hoy:

| Laboratorio | Órdenes | Comparadas | En pantalla, antes | En pantalla, después |
|---|---|---|---|---|
| 02 | 52 | 37 | 71 % | 71 % |
| 03 | 66 | 63 | 95 % | 95 % |
| 04 | 85 | 78 | 92 % | 92 % |
| 05 | 55 | 54 | 98 % | 98 % |
| 06 | 51 | 45 | 88 % | 88 % |
| 07 | 77 | 70 | 82 % | 82 % |

Idéntica. Las cuarenta y una opciones que salieron no aparecen en ningún
guion recorrido, que era la condición para sacarlas. El 07 no tiene recorrido
de Cypress todavía; su cifra es la de la clasificación.

---

# SPEC 015 · Las opciones que el participante escribe por costumbre

## 60. Tres decisiones del product owner, y un barrido

### 60.1 · `git commit -a` se implementa

Prepara lo que tiene seguimiento y cambió o desapareció, haya pasado o no por el
área de preparación, y confirma. **Lo que no tiene seguimiento se queda
afuera**, y esa es la lección del punto 1.3.

Se comprobó sobre el repositorio que arma `labs/lab-02/preparar.sh`, corrido
en una copia del clon dentro del directorio temporal para no tocar el
`taller-git-trabajo` de la máquina. Sobre el escenario recién preparado
(`cocineros.md` preparado, `ingredientes.md` modificado) se borró `platos.md`,
se creó `nuevo.md` y se escribió `git commit -am "algo"`, en Git 2.54 y en el
simulador:

| | Git 2.54 | Simulador |
|---|---|---|
| La confirmación | 3 archivos: los dos modificados y la baja de `platos.md` | los mismos 3 |
| `git status --short` después | `?? nuevo.md` | `?? nuevo.md` |
| El resumen | ` 3 files changed, 3 insertions(+), 7 deletions(-)` y `delete mode` | ` 3 files changed` |

La última fila es la diferencia de `git commit` que la sección 51 ya dejó
anotada: su resumen cuenta archivos y no líneas. No es de este spec.

**La forma pegada, `-am`, se separa como la separa Git**: `desagrupar` en el
analizador, y sólo para `git commit` (`AGRUPABLES_GIT`). La letra que lleva
valor se come el resto de la palabra, así que `-amhola` es `-a -m hola`. El
despachador separa antes de revisar el contrato y antes de llamar al
manejador, de modo que el manejador sigue leyendo palabras enteras y la prueba
por función sigue sirviendo.

Si la confirmación no ocurre —sin mensaje, por ejemplo— el estado vuelve sin
nada preparado, igual que en Git.

### 60.2 · `-q` no se implementa, y dice por qué

En los dieciséis subcomandos del motor que la aceptan en Git 2.54, comprobado
uno por uno, responde el mismo motivo, `CALLAR`: el simulador siempre muestra
lo que ocurrió, porque eso es lo que viene a enseñar. En `git revert` sólo
`--quiet`, porque `-q` no existe ahí.

### 60.3 · Las opciones que no existen

El punto 3.3 del spec: una opción que existe y no implementamos, y una que no
existe, son dos respuestas distintas. Se barrió **el contrato entero**, no sólo
las cuarenta y una, corriendo cada opción en Git 2.54 y cada opción del
intérprete en las coreutils de GNU, que son las de Git Bash.

Van en `INEXISTENTES`, con el texto copiado de la corrida, y responden como
error del participante, no como límite de la herramienta:

| Orden | De dónde salió | Qué hacía antes | Qué responde ahora |
|---|---|---|---|
| `rm --cached` | de las 41 | **borraba el archivo** | `rm: unrecognized option '--cached'` |
| `rm -q` | de las 41 | **borraba el archivo** | `rm: invalid option -- 'q'` |
| `rm --quiet` | de las 41 | borraba el archivo | `rm: unrecognized option '--quiet'` |
| `git restore --cached` | del resto del contrato | **la tomaba por `--staged`** | `error: unknown option 'cached'` |
| `-q` y `--quiet` en `config`, `status`, `add`, `mv`, `tag`, `remote`, `merge-base`, `cat-file`, `ls-files` | del barrido de `-q` | «no implementa» | `error: unknown switch 'q'` / `unknown option 'quiet'` |
| `git revert -q` | ídem | «no implementa» | el uso de `git revert`, que es lo que Git imprime |

Cada una lleva además la primera línea del uso, que Git imprime completo.

El barrido dio tres falsos positivos, descartados: `--format` sin valor es un
error de uso y no una opción inexistente; `--stat` e `--index` de `git stash`
existen en `stash list`, `stash show` y `stash pop`, que es donde se usan.

Una prueba nueva exige que ninguna opción esté a la vez entre las aceptadas y
entre las inexistentes. En su primera corrida atrapó `git restore --cached`,
que seguía declarada como aceptada.

**Lo que no cubre.** Una opción que no está en ninguna tabla —`git status
--nada`, por ejemplo— sigue respondiendo «no implementa». Separar todas las
inexistentes pide la lista completa de opciones de cada subcomando de Git, que
son cientos. El barrido de este spec cubre lo que el contrato declara y la
familia de `-q`.

### 60.4 · `git rebase` sin base

Decía `fatal: No rebase in progress?`, de un Git más viejo. Ahora responde lo
que Git 2.54 responde sin rama de seguimiento, copiado de una corrida y con sus
dos variantes: parado en una rama nombra la rama en el consejo de
`--set-upstream-to`; desconectado dice `You are not currently on a branch.` y
no da ese consejo.

### 60.5 · Las cuarenta y una, y las cuatro que se quedaron

Qué hacía cada una antes está medido en el código de antes de la sección 59,
no recordado.

| # | Opción | Qué hacía antes | Estado |
|---|---|---|---|
| 1 | `git init -q` | imprimía `Initialized empty Git repository` | no implementada (`CALLAR`) |
| 2 | `git init --quiet` | lo mismo | no implementada (`CALLAR`) |
| 3 | `git rm -q` | imprimía `rm 'archivo'` | no implementada (`CALLAR`) |
| 4 | `git rm --quiet` | lo mismo | no implementada (`CALLAR`) |
| 5 | `git commit -q` | imprimía el resumen | no implementada (`CALLAR`) |
| 6 | `git commit --quiet` | lo mismo | no implementada (`CALLAR`) |
| 7 | `git branch -q` | imprimía igual | no implementada (`CALLAR`) |
| 8 | `git branch --quiet` | lo mismo | no implementada (`CALLAR`) |
| 9 | `git switch -q` | imprimía `Switched to branch` | no implementada (`CALLAR`) |
| 10 | `git switch --quiet` | lo mismo | no implementada (`CALLAR`) |
| 11 | `git checkout -q` | imprimía `Switched to branch` | no implementada (`CALLAR`) |
| 12 | `git checkout --quiet` | lo mismo | no implementada (`CALLAR`) |
| 13 | `rm -q` (intérprete) | borraba; en bash no existe | **error de bash** |
| 14 | `rm --quiet` (intérprete) | borraba; en bash no existe | **error de bash** |
| 15 | `rm --cached` (intérprete) | **borraba el archivo**; en bash no existe | **error de bash** |
| 16 | `rm -r` (intérprete) | se ignoraba: `rm -r recetas` decía `No such file or directory` | no implementada |
| 17 | `rm -f` (intérprete) | se ignoraba: sobre un archivo que no existe daba error, y en bash calla | no implementada |
| 18 | `rm --force` (intérprete) | lo mismo | no implementada |
| 19 | `git commit -a` | **confirmaba sólo lo preparado** | **implementada** |
| 20 | `git commit --all` | lo mismo | **implementada** |
| 21 | `git show --oneline` | mostraba la cabecera larga | no implementada |
| 22 | `git branch -a` | listaba sólo las locales; sin ramas remotas coincide con Git | no implementada |
| 23 | `git branch --all` | lo mismo | no implementada |
| 24 | `git branch -v` | listaba sólo nombres; Git agrega identificador y mensaje | no implementada |
| 25 | `git branch --verbose` | lo mismo | no implementada |
| 26 | `git mv -f` | se negaba igual que sin ella: `destination exists` | no implementada |
| 27 | `git mv --force` | lo mismo | no implementada |
| 28 | `git mv -v` | no imprimía nada; Git dice `Renaming a to b` | no implementada |
| 29 | `git mv --verbose` | lo mismo | no implementada |
| 30 | `mv -f` (intérprete) | lo mismo que sin ella, **que es lo que hace bash** | no implementada · *candidata a equivalente* |
| 31 | `mv --force` (intérprete) | lo mismo | no implementada · *candidata a equivalente* |
| 32 | `mv -v` (intérprete) | no imprimía nada; bash dice `renamed 'a' -> 'b'` | no implementada |
| 33 | `mv --verbose` (intérprete) | lo mismo | no implementada |
| 34 | `git merge --message` | **tomaba el mensaje por la rama**: `not something we can merge` | no implementada |
| 35 | `git tag -l` | con patrón, no devolvía nada | no implementada |
| 36 | `git tag --list` | lo mismo | no implementada |
| 37 | `git tag -n` | listaba sólo nombres, sin el mensaje | no implementada |
| 38 | `git reflog --all` | mostraba sólo `HEAD` | no implementada |
| 39 | `git reflog -n` | `-n 1` no devolvía nada; `-2` mostraba todo | **implementada** (el guion la usa, 59.6) |
| 40 | `git cat-file -s` | respondía un uso inventado | no implementada |
| 41 | `ls -l` | listaba en formato corto | no implementada |

Y las cuatro que la prueba por función señaló y **no salieron** del contrato:

| Opción | Qué hacía antes | Estado |
|---|---|---|
| `git rebase --abort` | acertaba por casualidad; `--abort main` rebasaba | **implementada** (el guion la usa) |
| `git rev-parse --short` | igual que sin ella | equivalente: los identificadores ya son cortos |
| `git ls-files --cached` | igual que sin ella | equivalente: es el modo por omisión |
| `git ls-files -c` | lo mismo | equivalente |

Las filas 30 y 31 son las que el punto 5.2 del spec buscaba: `mv -f` se sacó
del contrato cuando **ya coincidía con bash**, que sobrescribe con o sin ella.
Devolverla como equivalente es decisión del product owner (punto 7.1).

### 60.6 · Otra que apareció y no se tocó

`git checkout --detach` **sin nombre** responde `fatal: you must specify a
branch name`. Git desconecta la posición en la confirmación actual. Apareció
al probar el caso desconectado de 60.4; es una diferencia de comportamiento y
no una opción, y queda anotada para que el product owner decida.

### 60.7 · La cobertura

Sin cambios, medida en la corrida de Cypress: 02 en 71 %, 03 en 95 %, 04 en
92 %, 05 en 98 % y 06 en 88 %, las mismas cifras de 59.7. Ninguna orden de los
guiones usa `-q`, `commit -a` ni una opción inexistente.

---

# SPEC 013 · Rediseño visual del simulador

## 61. El aspecto, sin tocar la lógica

Llegó después del 014 y el 015, que ya lo anunciaban como «el spec siguiente
de aspecto». El motor, el contrato, los escenarios y los verificadores no se
tocaron; lo único que cambió en `src/grafico` es presentación: medidas, forma
de las aristas y dónde van las etiquetas.

### 61.1 · Dos cosas que el spec describía distinto de como estaban

- **Los colores.** El punto 1.4 dice «gris para la rama principal, verde para
  las derivadas, coral para el puntero». La pantalla usa **azul, violeta y
  ámbar** desde el SPEC 002. Como el mismo punto pide no cambiar significados,
  se conservaron los tonos que el participante ya aprendió y se deja anotado.
  Si el arquitecto quiere los otros, es un cambio de paleta de una línea por
  tema.
- **Los identificadores** ya iban a la izquierda del nodo y alineados a la
  derecha (punto 2.4); el radio era nueve y no siete u ocho, y las aristas
  medían dos y no uno y medio.

### 61.2 · Lo que cambió, en cifras

| | Antes | Después |
|---|---|---|
| Radio de los nodos | 9 | **11** |
| Aristas | 2, gris | **3**, del color de su rama; 2,5 las previsualizadas; puntas redondas |
| Curva entre carriles | repartida en todo el tramo | **solo en la junta**: encima del punto de donde sale la rama, debajo de la unión que la cierra |
| Etiquetas de rama y puntero | 20 de alto, esquina 3, sin relleno | **24 y 22 de alto, píldora**, rellenas del color del panel |
| Letra del grafo | 11 | 12 |
| Filas · carriles | 58 · 48 | 62 · 54 |
| Nombre del repositorio | 15, semibold | **21**, semibold, con la rama en píldora al lado |
| Rótulo de área · sus datos | 12 negrita · 11 | **11 versalitas tenue · 13** |
| Relleno de paneles · separación entre zonas | 12 · 12 | 16 a 20 · 16 |
| Consola: interlineado · separación entre órdenes | 1,63 · 8 | 1,8 · 16 |
| Línea de tiempo | panel con título y botones | una línea: paso, segmentos, orden, botones |

Las cuatro áreas son un flujo: pegadas, redondeadas sólo hacia afuera y con
una marca de dirección en cada junta. Bajo 1 280 píxeles pasan a dos por dos,
con la marca en las dos juntas horizontales.

### 61.3 · El tema claro

`:root[data-tema='claro']` redefine cada color del oscuro —una prueba lo
exige, variable por variable— con tonos más oscuros para que el significado se
sostenga sobre blanco. La consola lleva la clase `terminal`, que reafirma sus
tonos oscuros en los dos temas. El interruptor va junto al de modo relator y,
como todo lo demás de la interfaz, no se guarda (decisión 7.12).

### 61.4 · El movimiento, medido

`herramientas/capturas-rediseno.mjs movimiento` lee lo que el navegador pinta
sesenta milisegundos después de la orden, con la previsualización apagada para
que el cambio lo produzca la orden y no la escritura:

| | Normal | Movimiento reducido |
|---|---|---|
| `git switch azteca`, posición del puntero | 830 → **871** → 938 | 830 → 938 → 938 |
| `git commit`, nodos creciendo | **1** | 0 |
| `git reset --hard HEAD~1`, opacidad de la huérfana | 1 → **0,87** → 0,65 | 1 → 0,65 → 0,65 |
| Al cargar | nada se mueve | nada se mueve |

La cifra del medio es la que prueba la transición: en modo normal está a mitad
de camino, en reducido ya es la final. Las duraciones van de 220 a 280 ms, y
una prueba exige que todas estén entre 150 y 300.

Dos decisiones de detalle. Al cambiar de escenario el grafo entero es nuevo y
eso no es una acción del participante, así que no crece nada y el puntero no
viaja desde el escenario anterior. Y las confirmaciones previsualizadas no
crecen: aparecen y desaparecen al escribir, y animarlas en cada tecla sería
movimiento que no muestra nada.

### 61.5 · Lo que apareció al mirar

**La etiqueta de versión tapaba el identificador.** Las dos iban en el mismo
espacio a la izquierda del nodo. Antes del rediseño se enciman y no se leía
ninguna; con las píldoras rellenas, la etiqueta lo tapaba entero. Lo destapó
el informe de movimiento del laboratorio 06, que después de `git tag v0.9`
dejó de marcar movimiento en los nodos. Es posición de presentación y se
corrigió aquí, con una prueba que se vio fallar: la etiqueta va a la izquierda
del identificador.

**Las líneas gruesas atravesaban los nombres de las ramas vecinas.** Una
etiqueta a la derecha de su nodo cae sobre el carril siguiente. Con la línea
fina y gris de antes casi no se notaba; con tres píxeles de color se leía
«ta|landesa». Las píldoras van rellenas del color del panel, y los
identificadores llevan un contorno del mismo color por debajo de la letra.

**Ningún defecto de comportamiento.** El único que está pendiente es el de la
sección 60.6, anterior a este spec.

### 61.6 · Las pruebas

- **Una sola se ajustó por una medida**: el alto de fila de las listas pasó de
  18 a 22 píxeles, porque los datos subieron de 11 a 13.
- **Los recorridos de punta a punta no necesitaron ningún ajuste.** Pasan los
  48, con la misma cobertura: 02 en 71 %, 03 en 95 %, 04 en 92 %, 05 en 98 %
  y 06 en 88 %.
- **Once pruebas nuevas.** Nueve se vieron fallar contra el código de antes:
  el radio, las dos curvas en la junta, el color de cada arista, el trazo del
  puntero que viaja con él, la etiqueta de versión, el tema claro completo, la
  consola oscura y las duraciones. Las otras dos son guardas que ya se
  cumplían —«en el mismo carril, una recta» y «ni degradados ni sombras»— y se
  las vio fallar rompiendo a propósito lo que vigilan.

### 61.7 · Las capturas

`herramientas/capturas-rediseno.mjs capturar` recorre los ocho escenarios con
escenario, en modo normal y relator, en los dos temas, más huérfanas tras el
rebase del 07 y la fusión previsualizada del 05: cuarenta capturas. De cada
una mide la letra más chica que el navegador pintó y el desborde horizontal a
1 280, 1 600 y 1 920 píxeles. En las cuarenta: **11 píxeles en normal y 14,3
en relator, y ningún desborde.** El modo relator no quedó apretado en ningún
laboratorio.

`comparar` cruza cada una con la de antes contando píxeles en Chrome. En el
tema oscuro cambió entre el 4,6 y el 8,5 % de la pantalla; en el claro, contra
el oscuro de antes, entre el 90 y el 95 %. Las capturas quedan fuera del
repositorio, como las del recorrido; las seis de `docs/capturas` se
regeneraron con el diseño nuevo.

### 61.8 · El artefacto

Sigue siendo un archivo único y autocontenido. Pasó de 314 154 a **320 194
bytes**: 6 040 más, un 1,9 %.

---

# SPEC 016 · El grafo tiene que caber

## 62. La altura, que era el defecto real

### 62.1 · Por qué desaparecía `main`

Tras el rebase del laboratorio 07, en modo relator, el grafo se cortaba en
`f747227` y `main` quedaba fuera. Eran dos causas sumadas:

- **El SPEC 013 agrandó el grafo y nadie ajustó qué pasa cuando no cabe.** Ese
  dibujo mide 759 unidades de alto, 987 píxeles en modo relator, y el panel
  ofrece 680 a mil píxeles de ventana.
- **El panel nunca se desplazó.** El dibujo llevaba `max-h-full overflow-auto`
  dentro de una sección de alto automático: el porcentaje no tenía contra qué
  resolverse, el dibujo crecía entero y la sección, con `overflow-hidden`, lo
  cortaba sin barra. Lo que quedaba abajo desaparecía sin que nada lo dijera,
  y así desde el SPEC 002. Una prueba de código fuente afirmaba lo contrario:
  comprobaba que la clase estuviera escrita, no que el panel se desplazara.

### 62.2 · El mecanismo: apretar el espacio entre filas

De los tres caminos del punto 2.2, el de recuperar espacio, aplicado a lo
único que sobra en un grafo alto: **la separación entre filas**. Los nodos,
las líneas y la letra no cambian (punto 6.3).

- La interfaz mide el alto que el panel puede alcanzar —su tope de la hoja de
  estilos menos su relleno— y se lo pasa al cálculo de posiciones, en
  unidades del dibujo.
- Si el grafo no cabe, la separación baja de 62 hasta lo que haga falta, con
  un mínimo de 34: el diámetro de un nodo más doce. En el caso del defecto
  queda en 38; en modo normal, en 51.
- Con las filas por debajo de 60, el puntero ya no cabe colgado bajo su rama
  —chocaría con la etiqueta de la fila siguiente— y pasa al costado, unido a
  ella por un trazo.
- Si ni con el mínimo caben todas las etiquetas, el panel lo dice sobre el
  dibujo: «Más abajo: main. Desplaza el grafo para verlas.» Y ahora sí se
  desplaza.

Se descartó escalar el grafo entero: achica los nodos, que es justo lo que el
SPEC 013 vino a arreglar, y la letra del grafo bajaría de los catorce píxeles
que el modo relator exige.

### 62.3 · La prueba, que la primera vez se aprobó sola

`cypress/e2e/visibilidad.cy.ts` recorre los ocho escenarios en los dos modos y
los dos temas, más el 07 tras el rebase, y exige que cada etiqueta de rama y
el puntero estén enteros dentro de lo que se ve.

**La primera versión pasó 36 de 36 con el defecto presente.** Es la sexta vez
del patrón. Medía contra la caja con `overflow-auto`, que es la que no
recorta, por la misma causa de 62.1; y podía medir antes de que el grafo se
dibujara, con una lista vacía que también es «ninguna fuera». La corregida
interseca todos los antepasados que recortan, más la ventana, y reintenta
sobre las etiquetas ya dibujadas. Contra el build del SPEC 013 falla en los
dos casos del defecto —07 tras el rebase, relator, oscuro y claro— y pasa en
los otros 34. Con el arreglo pasa en los 36.

Las pruebas de unidad del mecanismo se vieron fallar contra el código
anterior. Una, «si cabe, no toca nada», pasaba también con la guarda quitada:
con el tope igual al alto, apretar o no da lo mismo. Ahora prueba además con
holgura, donde un cálculo sin guarda estiraría las filas, y se la vio fallar.

### 62.4 · La marca de dirección

Pasó de un triángulo de borde tenue a **una flecha**: un círculo de 34 píxeles
sobre cada junta, con borde de dos, y dentro una flecha de trazo tres del
color del texto. En el tema oscuro, texto claro sobre el panel; en el claro,
texto oscuro sobre blanco. El relleno lateral de las áreas subió a 32 para
que el círculo no toque el texto de al lado.

### 62.5 · El ancho, que queda para el spec siguiente

La medición mostró que el grafo no está corto de ancho: a 1600 píxeles el
panel mide 905 y el dibujo usa entre 396 y 580. La consola sí: la salida más
larga del guion que imprime Git, el `renamed:` de 90 caracteres del
laboratorio 03, pide 702 píxeles en modo normal y 913 en relator, y la consola
tiene 605, así que **hoy ya se parte**. Los criterios CA3 y CA4 se
contradecían a 1600 píxeles.

El product owner eligió dar a la consola su medida y los dejó sin efecto: el
spec siguiente trae un redimensionador entre consola y grafo, con un reparto
de partida del 46 por ciento. **En este spec no se tocó ningún ancho.**

### 62.6 · Las cifras

| | |
|---|---|
| Etiquetas a la vista, 8 escenarios × 2 modos × 2 temas + el 07 tras el rebase | 36 de 36 |
| Letra mínima pintada en las 40 capturas | 11 píxeles en normal, 14,3 en relator |
| Desborde horizontal a 1280, 1600 y 1920 | ninguno |
| Recorridos de punta a punta | los mismos 5, la misma cobertura: 71, 95, 92, 98 y 88 % |
| Artefacto | 321 913 bytes, 1 719 más que en el SPEC 013 |

---

# SPEC 017 · La disposición de la pantalla

## 63. La pantalla, repartida de nuevo

El SPEC 013 cambió medidas y nunca tocó el reparto. Este spec reparte, con un
mockup aprobado por el product owner como guía. La lógica no se tocó.

### 63.1 · La consola, de arriba abajo

Ocupa la columna izquierda entera, con el contenido anclado al fondo: un
relleno que crece se come el espacio sobrante arriba y se reduce a nada cuando
el historial llena la caja. Después de cada orden baja sola al final, como ya
lo hacía. Sigue oscura en los dos temas.

**La pantalla mide exactamente la ventana en escritorio**, y la consola y el
grafo se quedan con lo que las demás zonas no usan. Tuvo que ser un alto y no
un mínimo. Con un mínimo apareció un bucle: el grafo sin apretar del primer
dibujo estiraba la página, la medición veía un panel alto y ya no apretaba
nada, y en modo relator la línea de tiempo quedaba debajo de la ventana. Bajo
1 280 píxeles la pantalla se apila y crece con su contenido.

### 63.2 · El tirador

Una barrita entre la consola y el grafo, con rol de separador. Se arrastra con
el ratón y con el dedo —son eventos de puntero, que cubren los dos— y se mueve
con el teclado: flechas de dos en dos por ciento, Inicio al mínimo y Fin al
máximo. Límites, 24 y 72 por ciento. El reparto elegido vive en la aplicación
y no se toca al cambiar de escenario.

**El reparto de partida** va en `ch` de la propia letra de la consola:
`clamp(24%, calc(91ch + 42px), 72%)`. Así sigue a la escala del modo relator
sin calcular nada. Son 91 caracteres y no 90: con 90 justos la línea medía
704,41 píxeles contra un hueco de 704,39, y el navegador la partía por dos
centésimas.

Medido con la salida más larga del guion, el `renamed:` de 90 caracteres del
laboratorio 03:

| Ventana | Normal | Relator |
|---|---|---|
| 1 280 | entera, consola al 61 % | **se parte**: la consola ya está en el 72 % |
| 1 600 | entera, 49 % | entera, 62 % |
| 1 920 | entera, 40 % | entera, 52 % |

En modo relator deja de partirse desde **1 381 píxeles** de ventana. Es el
caso que el punto 3.2 anticipaba y se deja así.

### 63.3 · El grafo aguanta los dos extremos

Con la consola al 72 %, el grafo del laboratorio 05 en modo relator a 1 600
píxeles tiene unas 300 unidades de ancho y mide 446. Se resolvió como el alto
del SPEC 016, sin achicar nodos, líneas ni letra:

1. **Se aprieta la separación entre carriles**, de 54 hasta un mínimo de 32.
2. **Si todavía no cabe, se dejan de dibujar los identificadores**, que son lo
   único prescindible: las ramas y el puntero se quedan siempre.
3. **Si ni así cabe**, el aviso sobre el dibujo nombra lo que quedó fuera, y el
   panel se desplaza.

La interfaz mide el hueco del panel del grafo con un observador de tamaño y se
lo pasa al cálculo en unidades del dibujo, alto y ancho.

### 63.4 · Las áreas, la barra y la letra

- **El repositorio remoto salió.** Quedan tres áreas de un tercio. Ningún
  texto de la interfaz ni de los enunciados lo prometía; el README sí, y se
  corrigió.
- **Las marcas de dirección** son círculos ámbar de 26 píxeles sobre la línea
  divisoria, con la flecha adentro y un anillo del color del panel. Es un
  contorno sólido, no una sombra.
- **La barra** va en tres bloques: el repositorio a la izquierda, los controles
  al medio —que se parten en dos filas si no caben— y el tema al extremo
  derecho, arriba. Es un botón redondo con luna en el oscuro y sol en el claro.
  Los dos interruptores que quedan van juntos en una pieza con fondo propio,
  cada uno con una luz que se enciende en ámbar; perdieron el «: sí» y el
  «: no», como en el mockup, y `aria-pressed` le dice el estado a quien no ve
  la luz. El selector de escenario pasó de 12 a 15 píxeles.
- **Las dos pilas tipográficas** quedan declaradas con las familias de macOS,
  Windows y Linux. La consola y todo lo que imita a Git van en monoespaciada;
  las líneas de ayuda de la consola, que son de la interfaz, volvieron a la de
  texto.

Dos cosas del mockup no se copiaron, por el punto 9.2: la sombra del
interruptor encendido y el degradado de la flecha del selector.

### 63.5 · Las pruebas

**CA8.** `visibilidad.cy.ts` recorre ahora los tres repartos —partida, mínimo
y máximo— en los ocho escenarios, dos modos y dos temas, más el 07 tras el
rebase: 108 casos. Se la vio fallar apagando el ajuste de ancho. El primer
intento de apagarlo no compiló, y Cypress corrió contra el build anterior, que
sí ajustaba: pasó 108 de 108 sin probar nada. Con un sabotaje que compila,
fallan 6, todos con la consola al máximo: el 05 en los dos modos y el 07 tras
el rebase en relator, en los dos temas. Con el ajuste, pasan los 108.

**`disposicion.cy.ts`**, nuevo, con doce pruebas: la consola de alto entero y
anclada abajo, el prompt a la vista tras cada orden, el tirador con ratón, con
dedo y con teclado, sus límites, el reparto que sobrevive al cambio de
escenario, la línea de 90 caracteres entera con el de partida, tres áreas, el
botón de tema y las luces. Contra el build anterior fallan once. La que pasa,
«la consola baja sola al final», es una guarda de algo que ya existía.

Dos de esas pruebas destaparon defectos míos antes de publicar:

- **Arrastrar no hacía nada.** El primer movimiento podía llegar antes de que
  React redibujara, y consultaba un estado que todavía decía «no
  arrastrando». Ahora se sigue en una referencia.
- **El teclado sumaba desde un valor viejo.** Partía del reparto medido, que
  llega después del redibujado, y dos flechas seguidas sumaban una sola vez.

Y una que se aprobaba sola: «lo escrito queda abajo, pegado al prompt» pasaba
también con la consola vieja, que medía lo que su contenido. Ahora exige
además el espacio sobrante arriba.

El `trigger` de Cypress no sirvió para arrastrar: fabrica un evento genérico.
Se despachan `PointerEvent` de verdad, con una pausa entre pulsar y mover como
la de una mano; sin ella, dentro de Cypress el movimiento se perdía. Con un
ratón y un dedo reales, conducidos por el protocolo de Chrome, el tirador
funcionaba desde el principio: 40 y 60 por ciento.

**De unidad**, tres pruebas de la disposición del SPEC 002 se reemplazaron por
las de este spec, con el motivo escrito, y se agregaron las del ajuste de
ancho, los límites del tirador, el ancho de partida, las pilas tipográficas y
la ausencia del remoto. Todas se vieron fallar, las guardas rompiendo lo que
vigilan.

### 63.6 · Las cifras

| | |
|---|---|
| Pruebas de unidad | 714 |
| Pruebas de punta a punta | 168: los 48 de antes, 108 de visibilidad y 12 de disposición |
| Recorridos | los mismos 5, la misma cobertura: 71, 95, 92, 98 y 88 % |
| Capturas | 56: ocho escenarios, huérfanas y previsualización en dos modos y dos temas, más los repartos extremos |
| Letra mínima pintada | 11 píxeles en normal y 14,3 en relator, en las 56 |
| Desborde horizontal a 1 280, 1 600 y 1 920 | ninguno |
| Artefacto | 326 215 bytes, 4 302 más que en el SPEC 016 |

### 63.7 · El recorrido medía el deslizamiento, no el dibujo

Al regenerar las capturas, los informes de movimiento de los cinco
laboratorios cambiaron, y siempre en la misma pieza: el puntero, marcado como
movido tras órdenes que no cambian nada, como `git lg`. En Chrome solo, paso a
paso, el puntero estaba quieto. Dos corridas idénticas de Cypress daban
informes distintos, entre 4 y 36 líneas, y en una de ellas un
`git switch main` real no figuraba como movimiento del puntero.

La causa es del SPEC 013: el puntero se desliza en 260 milisegundos y el
arnés lo medía en un momento variable de ese deslizamiento. Los recorridos
pasaban igual, porque sus afirmaciones esperan al estado final; lo que se
volvía ruido era el informe. El recorrido corre ahora con movimiento reducido,
que la pantalla respeta, y mide el dibujo ya quieto.

La herramienta de capturas encendía a veces el modo relator antes de que la
pantalla terminara de montarse, y una captura de «relator» medía en realidad
el modo normal: la letra mínima salió de 11 píxeles en una. Ahora reintenta
hasta confirmarlo en el documento, y se rehicieron las 56.

### 63.8 · Un hallazgo que no es de disposición, y no se tocó

Con los informes ya deterministas, un cambio de rama del laboratorio 04 no
movía el puntero: el paso 031, `git switch peruana`. Falla en los dos lados
con `fatal: invalid reference: 'peruana'`, y por eso el recorrido pasa.

La orden anterior del enunciado es `git branch peruana <identificador>`. Lleva
un marcador de posición, el arnés no la ejecuta en ningún lado, y **desde ahí
el recorrido del 04 sigue sin la rama `peruana`**: las confirmaciones de la
cocina peruana caen en `mexicana`, en el simulador y en Git por igual. Los dos
lados se equivocan igual y la comparación da verde.

La sección 25 dice que los marcadores de identificador quedan sólo en órdenes
«de solo mirar», que «no desalinean nada». Esta crea una rama. Es la séptima
vez del patrón: una prueba que pasa sin comprobar lo que dice comprobar.

**No se arregló**, por el punto 9.1 del spec: no es disposición. Lo que haría
falta es que el arnés resuelva ese marcador —el identificador sale del
`git log` del paso anterior en cada lado, y cada lado usa el suyo— o que
distinga las órdenes con marcador que modifican el repositorio y se niegue a
seguir comparando después de ellas. Queda para el arquitecto.

> **Resuelto en la sección 64**, con el primero de los dos caminos.

---

# El recorrido deja de saltarse órdenes

## 64. Cada lado copia su identificador

Pedido del product owner tras la sección 63.8: que el arnés resuelva el
identificador en cada lado, con el de Git para Git y el del simulador para el
simulador, ejecute la orden, y que la prueba falle si una orden del guion se
salta.

### 64.1 · Cómo se resuelve

El enunciado dice en prosa qué confirmación copiar —«Elige la segunda
confirmación de esa lista»—, y el arnés no interpreta prosa. Cada una quedó
traducida en `ELECCIONES`, en `cypress/soporte/ordenes.ts`: de qué orden
anterior se copia y cómo se elige la línea. Lo que no se escribe a mano es el
identificador: durante el recorrido se guarda lo que cada lado imprimió, y cada
lado lo toma de lo suyo.

| Laboratorio | Orden | De dónde |
|---|---|---|
| 03 | `git show <…que-la-agrego>` | la más antigua de `git log --oneline -- credenciales.txt` |
| 04 | `git branch peruana <identificador>` | la segunda de `git log --oneline main` |
| 04 | `git switch --detach <identificador>` | la tercera de `git log --oneline main` |
| 04 | `git branch rescate <identificador>` | la advertencia de `git switch main` |
| 06 | `git reset --hard <identificador>` | `HEAD@{1}` de `git reflog -10` |
| 06 | `git show` y `git revert <identificador>` | la de `git log -S "sal marina en polvo"` |

Del lado de Git, la salida lleva ahora también lo que Git escribe por el canal
de errores cuando la orden funciona: la advertencia de `git switch` va por ahí,
y se perdía.

### 64.2 · La prueba que falla si una orden se salta

Dos lugares. Una prueba por laboratorio, «ninguna orden del guion se salta»,
lista las omitidas y exige que no haya ninguna. Y el recorrido, en lugar de
pasar de largo, falla en la orden omitida nombrándola. Si una elección no
encuentra en la salida lo que el enunciado dice que hay, también falla, con la
salida a la vista.

Se vio fallar quitando la regla del rescate: las dos del laboratorio 04 fallan
nombrando `git branch rescate <identificador>`, y las de unidad también. De
unidad hay además una que exige que la orden de la que se copia haya corrido
antes en el mismo guion, y que ninguna elección escrita sobre.

### 64.3 · Lo que el salto escondía

Al dejar de saltar, el recorrido falló en dos lugares. Eran defectos del
simulador, y se corrigieron con el texto de Git 2.54 copiado de una corrida:

- **El simulador no avisaba al dejar confirmaciones sueltas.** Al salir de una
  posición desconectada, Git lista lo que queda sin referencia y da el
  identificador para rescatarlo. El punto 3.5 del laboratorio 04 hace copiarlo
  de ahí, y en el simulador no había de dónde. Ahora avisa igual, en singular o
  plural, y sin nada suelto dice `Previous HEAD position was …`.
- **Revertir una reversión.** Git la llama `Reapply "X"` desde la versión 2.43;
  el simulador decía `Revert "Revert "X""`. Lo destapó el laboratorio 06: con
  su `git revert <identificador>` ejecutado de verdad, el `git revert HEAD`
  siguiente revierte una reversión.

Y uno que **no se tocó**, porque el guion no pasa por él: `git revert` no
deshace los borrados de la confirmación que revierte. Reaplicar una reversión
que había retirado un archivo dice `0 files changed` y no lo devuelve.

### 64.4 · La cobertura

Ninguna orden queda ya con marcador sin resolver, y las que antes se omitían
ahora se comparan:

| Laboratorio | Antes | Ahora |
|---|---|---|
| 02 | 71 % | 71 % |
| 03 | 95 % | **97 %** |
| 04 | 92 % | **95 %** |
| 05 | 98 % | 98 % |
| 06 | 88 % | **94 %** |

---

# SPEC 019 · Un git revert que deshace todo

## 65. Revertir es una fusión de tres vías

### 65.1 · Qué hacía antes y qué hace ahora

`git revert` vive ahora en su propio módulo, `ordenes/revertir.ts`. Revierte
como Git: una fusión de tres vías donde la base es la confirmación que se
revierte, lo nuestro es la posición actual y lo de ellos es su padre. Cada
texto se copió de una corrida de Git 2.54.

| Caso | Antes | Ahora |
|---|---|---|
| La confirmación **borró** un archivo | no volvía; el resumen decía ` 0 files changed` | vuelve con su contenido de antes, ` 1 file changed, 1 insertion(+)` y ` create mode` |
| La confirmación **agregó** un archivo | se iba, con el resumen de archivos | se va, con líneas y ` delete mode` |
| La confirmación **modificó** un archivo | volvía **entero** a su versión previa y se llevaba los cambios posteriores | se deshace sólo lo que ella cambió, línea por línea, y dice `Auto-merging` |
| Deshacer **choca** con un cambio posterior | nunca chocaba: pisaba | conflicto con el texto de Git, marcadores `HEAD` / `parent of <id> (<mensaje>)`, y la posición no se mueve |
| Lo agregado se modificó después | se borraba igual | conflicto de modificado y borrado; queda la versión de `HEAD` |
| Lo modificado se borró después | reaparecía sin aviso | conflicto al revés; queda la versión del padre |
| Lo borrado volvió distinto | se pisaba | conflicto de agregado en los dos lados |
| Revertir una reversión | el archivo borrado no volvía a irse, el agregado no volvía | devuelve lo original, con `Reapply` |
| Cambios sin confirmar en un archivo que toca | los pisaba | se niega: `would be overwritten by merge` |
| Cambios preparados | los confirmaba dentro de la reversión | se niega: `your local changes would be overwritten by revert` |
| El resumen | ` N files changed`, sin líneas | el de Git: ` Date:`, líneas, `create mode` y `delete mode` |

Con conflicto, la reversión queda **en curso**, como la fusión: un estado
propio, `reversion`, con lo necesario para abortarla. Se cierra con
`git revert --continue` —que volvió al contrato— o con `git commit`, y
`git revert --abort` deja todo como estaba. Revertir otra vez sin resolver se
niega, como en Git.

### 65.2 · Cómo se vieron fallar

- **`revert.test.ts`**: catorce pruebas con los textos copiados de Git. Contra
  el motor anterior fallaron las catorce, cada una por el comportamiento que
  describe: se comprobó que la falla era de `git revert` y no de cómo se
  armaba el repositorio de la prueba.
- **`revert-contra-git.test.ts`**: catorce más, que corren **las mismas
  órdenes en un repositorio real y en el simulador** y comparan la salida de
  cada `git revert` y el texto de cada archivo al final, normalizando sólo
  identificadores y fecha. Pasaron a la primera, y por eso se comprobó aparte
  que Git de verdad producía la salida del conflicto y no una vacía, y que
  contra el motor anterior fallaban las catorce. Vuelven a correr Git en cada
  corrida de la suite: si una versión de Git cambia algo, se nota ahí.
- **Dos pruebas viejas** revertían sobre el escenario del laboratorio 02, que
  trae un archivo preparado y otro modificado. Git se niega a revertir así, y
  ahora el simulador también: se movieron al mismo escenario con los cambios
  guardados en la pila, que deja la misma punta y el directorio limpio.

### 65.3 · Lo que se tocó fuera de `git revert`, y por qué

Dos líneas, las dos del flujo de la reversión:

- **El estado** lleva `reversion`, como lleva `fusion`.
- **`git commit`** cierra una reversión en curso, como en Git. Sin eso, un
  participante que resuelve y confirma dejaba una reversión colgada.

### 65.4 · Lo que apareció y no se tocó

Por el punto 3.1, todo en `git status`, que no es `git revert`:

- **No dice que hay una reversión en curso.** Git agrega `You are currently
  reverting commit <id>.` y tres líneas de ayuda.
- **`both modified:a.md` va sin separación.** Git escribe
  `both modified:   a.md`. **Pasa también en los conflictos de fusión**, así
  que el laboratorio 05 lo muestra así desde siempre; el recorrido no lo vio
  porque compara estado y no texto.
- **Los conflictos de modificado y borrado dicen `both modified`**, donde Git
  dice `deleted by them` o `deleted by us`.
- **Los archivos sin seguimiento no salen ordenados** como los ordena Git.
- **`git commit` con archivos sin resolver durante una fusión** no lista los
  archivos con `U`, que Git pone antes del error. Durante una reversión sí.

### 65.5 · Las cifras

| | |
|---|---|
| Pruebas de unidad | 746, veintiocho nuevas |
| Pruebas de punta a punta | 173 |
| Cobertura de los recorridos | igual: 71, 97, 95, 98 y 94 %; el guion no pasa por los casos nuevos |
| Artefacto | 331 434 bytes, 4 747 más |


## 67. Los laboratorios se preparan bien en Windows

SPEC 021. (La sección 66 es la de la prueba de concepto, en su propia rama.)

### 67.1 · El defecto

Los ocho `verificar.sh` (laboratorios 01 a 08) comprobaban la regla 1
comparando `git rev-parse --show-toplevel` con la ruta que arma Bash con
`pwd -P`. En Git Bash de Windows esa ruta es `/c/Users/…` y la de Git es
`C:/Users/…`: nunca coincidían. `preparar.sh` llama a `verificar.sh
--escenario` al final, así que terminaba en error en todos los laboratorios,
con el repositorio bien armado. Ningún otro script compara rutas: los demás
usos de `pwd` solo ubican carpetas, y `semillas/lib/verificar.sh` mira si
existe `.git`.

### 67.2 · El arreglo, y por qué así

Se le pregunta todo a Git: `git -C recetario rev-parse --git-dir` responde
`.git` solo si `recetario` es la raíz de su propio repositorio; dentro de otro
responde la ruta del `.git` de más arriba, y fuera de todo repositorio falla.
Es una sola llamada, no depende de cómo escribe rutas ningún programa, y
funciona igual en Bash 3.2 y en Git Bash. Se descartaron traducir la ruta con
`cygpath` (no existe en macOS) y comparar con `pwd -W` (tampoco).

### 67.3 · La prueba

`simulador/tests/scripts-de-laboratorio.test.ts`, que corre GitHub Actions en
Windows con Git Bash y en Mac en cada cambio (`laboratorios-en-windows-y-mac`).
El código se baja como lo baja el participante, sin tocar `core.autocrlf`.

- Por laboratorio: clon del curso que es un repositorio de verdad,
  `preparar.sh`, el laboratorio hecho siguiendo su enunciado hasta antes de
  «Si algo salió mal», y `verificar.sh`.
- Lo que el enunciado pide hacer a mano (editar, resolver un conflicto, elegir
  acciones en `rebase -i`) va declarado, anclado a la frase del enunciado que
  lo pide: si la frase desaparece, la prueba falla.
- Anidamiento: un recetario sin `.git` propio dentro de otro repositorio se
  reclama, en los ocho laboratorios.

Con el código de antes, Windows fallaba 15 de 16 y Mac pasaba; saboteando la
comprobación para que siempre apruebe, fallan las 8 de anidamiento.

### 67.4 · Encontrado en el camino, sin tocar

**El laboratorio 07 no se puede aprobar siguiendo el enunciado**, en ningún
sistema. Al llegar a la parte 3 la rama tiene cinco confirmaciones propias (la
del punto 1.12 se suma a las cuatro de la semilla) y `git rebase -i HEAD~4`
deja `wip` fuera de la lista. Siguiendo el enunciado quedan tres
confirmaciones con `wip` y `cambios`; la comprobación del enunciado y el
verificador esperan dos, con mensajes decentes. La prueba lo anota como
diferencia conocida exacta.

**El soporte que extrae las órdenes del enunciado** no ve el `chmod +x` del
laboratorio 08, ni las «agrega una línea al final de…» del 01, y toma como
órdenes dos líneas de dentro del gancho del 08. No afecta al recorrido del
simulador, que no pasa por el 01, el 07 ni el 08.

## 68. Cuatro defectos del motor

SPEC 022. Salieron al comparar la previsualización con Git sobre repositorios
reales (sección 66, en la rama de la prueba de concepto). Pruebas en
`simulador/tests/defectos-del-motor.test.ts`, contra Git de verdad.

### 68.1 · Lo que hacía cada caso y lo que hace ahora

| Caso | Antes | Ahora |
|---|---|---|
| `git switch`/`git checkout` con trabajo que la otra rama tiene distinto | cambiaba igual y el trabajo quedaba encima de la otra rama | se niega con el texto de Git: una lista con lo preparado, otra con lo del directorio, un solo `Aborting` |
| El mismo cambio sin choque | cambiaba sin decir nada | cambia y lista lo que se lleva (`M`, `A`, `D`) antes de decir de dónde salió, como Git |
| `git add .` con una baja y un alta de contenido idéntico | `D` y `A` (salvo que el alta viniera de un `mv` del simulador) | `R  viejo -> nuevo`; al confirmar, un archivo, `0 insertions(+), 0 deletions(-)` y `rename viejo => nuevo (100%)` |
| Escribir dentro de `.git` (`echo … > .git/hooks/commit-msg`) | aparecía una carpeta `.git/` sin seguimiento | forma declarada: el simulador no lo implementa y en la terminal sí; además lo no seguido nunca lista rutas bajo `.git/` |
| `git fetch` y otras 141 órdenes de Git | `git: 'fetch' is not a git command` | el simulador no la implementa, y en la terminal sí funciona |

El renombrado se detecta solo con contenido idéntico, que es el caso del
laboratorio 03. Git también empareja archivos que se parecen en más de la
mitad; eso no se modela.

La lista de órdenes de Git (`ORDENES_DE_GIT`, en el contrato) sale de
`git --list-cmds=main,nohelpers`. Una prueba recorre las del Git de la
máquina y exige que ninguna responda que no existe. Las 142 que la recibían:
todas las de esa lista que el motor no tiene, de `am` a `upload-pack`,
entre ellas `fetch`, `pull`, `push`, `clone`, `cherry-pick`,
`bisect`, `blame`, `clean`, `grep`, `shortlog`, `submodule` y
`worktree`.

### 68.2 · Lo que se tocó fuera de los cuatro casos

- **`repoConRamaDesdeMain()`**, el ayudante de las pruebas, cambiaba de rama
  sobre el escenario del 07 con el curry modificado: dependía del defecto. Ahora
  descarta el cambio antes. Lo mismo dos pruebas de la vista y de `checkout`.
- La prueba «sin nada suelto» ahora espera las líneas `M` que Git imprime.

### 68.3 · Encontrado y sin tocar

- **El resumen de `git commit` no cuenta líneas**: dice `1 file changed`
  donde Git dice `1 file changed, 1 insertion(+)` y, en un archivo nuevo,
  `create mode 100644 a.md`.
- **`cat a.md > c.md`** responde `cat: >: No such file or directory`: el
  intérprete toma `>` como un archivo.
- **`git branch --show-current` y `-q` en `switch` y `commit`** siguen
  declaradas como no implementadas; son de uso común en guiones de terceros.

### 68.4 · Las cifras

| | Antes | Después |
|---|---|---|
| Pruebas de unidad | 762 | 943 |
| Pruebas de punta a punta | 173 | 173 |
| Cobertura de unidad (líneas, ramas, funciones, sentencias) | 91,76 · 82,93 · 92,72 · 94,47 | 92,22 · 83,55 · 93,90 · 94,92 |
| Cobertura de los recorridos (02 a 06) | 71, 97, 95, 98, 94 % | 71, 97, 95, 98, 94 % |
| Artefacto | 331434 bytes | 335577 bytes |

## 69. El laboratorio 07 se puede aprobar, y dos detalles

SPEC 023.

### 69.1 · El laboratorio 07

Al llegar al rebase interactivo la rama tiene cinco confirmaciones propias
(`wip`, `cambios`, `mas cambios`, `arreglos` y la del punto 1.12), y
`git rebase -i HEAD~4` dejaba `wip` afuera. Cambió el enunciado, no el
verificador:

- **3.2 y 3.4:** `git rebase -i main`. La lista trae exactamente las
  confirmaciones propias de la rama, sean cuantas sean. `main` es la base
  correcta en ese punto: el 2.3 hace `git rebase main`.
- **3.3:** `reword` en la primera línea, el resto con `pick`.
- **3.4:** `pick` en la primera y la última, `squash` en las del medio; en el
  editor del squash queda solo el mensaje del `reword`.
- Resultado: dos confirmaciones, la reescrita y «se agrega el curry y sus
  ingredientes».

La diferencia conocida que la prueba del SPEC 021 anotaba para el 07 se quitó:
el laboratorio se aprueba siguiendo el enunciado, en Windows y en Mac.

**El verificador no mira el cuerpo de los mensajes.** Revisa el asunto
(`git log --format=%s`), y en un squash el asunto es el del `reword`: si el
participante no borra «cambios», «mas cambios» y «arreglos», quedan en el
cuerpo y el verificador igual aprueba. El enunciado pide borrarlos, sin decir
que el verificador los encuentra.

Ningún otro enunciado cuenta varias confirmaciones hacia atrás al reescribir
historia: solo `git reset` a `HEAD~1` en el 01, 02, 06 y 08.

### 69.2 · El resumen de `git commit`

Imprime lo que Git: archivos, inserciones y eliminaciones con la regla de
`print_stat_summary` (las inserciones se nombran si hay alguna o si no hay
eliminaciones, y al revés), y las líneas `create mode`, `delete mode` y
`rename`, ordenadas por ruta. `--amend` agrega la línea ` Date:` con la
fecha original; cerrar una fusión imprime solo la primera línea. La regla de
inserciones y eliminaciones se corrigió en la función compartida, así que vale
también para `git merge`, `git revert` y `--stat`.

### 69.3 · `cat` con redirección

`cat a.md > c.md` y `cat a.md >> c.md` escriben como en bash, con la misma
función que ya usaba `echo`.

### 69.4 · Las cifras

| | Antes | Después |
|---|---|---|
| Pruebas de unidad | 943 | 954 |
| Pruebas de punta a punta | 173 | 173 |
| Cobertura de unidad (líneas, ramas, funciones, sentencias) | 92,22 · 83,55 · 93,90 · 94,92 | 92,11 · 83,30 · 93,81 · 94,83 |
| Cobertura de los recorridos (02 a 06) | 71, 97, 95, 98, 94 % | 71, 97, 95, 98, 94 % |
| Artefacto | 335 577 bytes | 336286 bytes |

---

# SPEC 026 · El taller con Git real dentro de la página

## 71. El modo taller

SPEC 026, en la rama `taller-java`. La numeración salta la 70, que en la rama
`poc/repositorio-real` es la del modo conectado.

`SIMULADOR.html` tiene un tercer modo. Servida por un programa local, con su
clave en la dirección, la consola de la página ejecuta cada orden con Git de
verdad en la carpeta del participante, y el grafo y las tres áreas se dibujan
con lo que Git dice. Abierta con doble clic sigue en el modo de escenarios, sin
un cambio.

### 71.1 · Lo que se decidió

- **Una rama que convive con otra.** Otra persona trabaja en paralelo en
  `taller-python`. Todo lo de este spec lleva nombres propios, `taller-java/`,
  `TALLER-JAVA.cmd`, `taller-java.command`, `taller-java.sh`,
  `comprobar-java.cmd` y `comprobar-java.sh`, y se trabajó en un worktree
  aparte para no tocar la copia de trabajo de la otra rama.
- **Java 21 puro.** El servidor HTTP es el de `jdk.httpserver`, el JSON es una
  clase de doscientas líneas y no hay ninguna dependencia en tiempo de
  ejecución. JUnit solo en las pruebas.
- **El runtime viaja en el clon.** `taller-java/jre/windows-x64` y
  `taller-java/jre/macos-aarch64`, recortados con jlink desde Eclipse Temurin
  21.0.12.1+1 a `java.base` y `jdk.httpserver`, que es lo que `jdeps` dice que
  el programa usa. 31 MB cada uno en disco, unos 17 MB comprimidos. Los genera
  `taller-java/fuente/generar-runtimes.sh`, con las versiones y las sumas
  SHA-256 fijas, los dos desde una sola máquina.
- **La orden viaja en una variable de entorno, y el envoltorio por la entrada
  de bash.** En una sola línea, porque bash lee la línea entera antes de
  ejecutarla, y en ella se cierra la entrada antes de la orden. Así no hay
  comillas que pelear con Windows, y los errores dicen `bash: line 1:` como
  con `bash -c`, en vez de nombrar un archivo interno del taller.
- **El límite de la carpeta es un `cd` que no sale.** El envoltorio define una
  función `cd` que rechaza salir de la carpeta que contiene al clon, antes de
  que corra lo que sigue en la misma línea: `cd ../.. && rm ...` se detiene en
  el `cd`. Después de cada orden se revisa además la carpeta en que quedó bash,
  para el `builtin cd` y los `pushd`.
- **Leer no escribe.** La lectura pasa `--no-optional-locks`: si reescribiera
  el índice, la huella cambiaría con cada lectura y se leería de nuevo sin que
  nadie tocara nada.
- **La lectura lanza Git directo, no un bash.** El punto 3.6 pedía todas las
  lecturas en un solo bash, para lanzar menos procesos. En Windows resultó al
  revés: bash, un fork emulado por cada `$(...)` y un tubo sumaban más procesos
  que las preguntas mismas, y la lectura tardaba cerca de un segundo. Ahora son
  entre cuatro y seis procesos de Git y ninguno más: la rama y HEAD salen de
  `git status --branch`, y el registro y el guardado temporal solo se
  preguntan si sus archivos existen. Se cumple la intención del punto y no su
  letra.
- **El idioma lo pone Git Bash.** El programa fijaba `LANG=C.UTF-8` en Windows,
  y con eso `ls` ordenaba las mayúsculas primero, distinto de la ventana de Git
  Bash, que toma el idioma de Windows.
- **Las huérfanas las decide la página, como siempre.** El programa manda las
  confirmaciones alcanzables desde las referencias y las del registro de HEAD,
  y la página las pinta con el mismo cálculo de posiciones del modo de
  escenarios, que atenúa lo que ninguna referencia alcanza.
- **La consola usa el git de la Terminal del participante.** El programa
  encuentra Git en el orden del punto 3.3 para leer el estado, pero no
  antepone su carpeta al PATH de la consola si el PATH ya tiene un `git`. En un
  Mac con Homebrew, anteponer `/usr/bin` dejaba en la consola un git distinto
  del de la Terminal, y cambiaba además qué otras herramientas encontraba.
- **Una lectura por segundo, por la huella.** El límite del punto 3.7 se aplica
  a las lecturas que dispara la huella. La que sigue a una orden no cuenta: si
  contara, un archivo guardado justo después de una orden tardaba segundo y
  medio en verse.
- **Cada orden guarda su indicador.** En el modo de escenarios la consola
  dibuja todas las órdenes anteriores con el indicador de ahora. En el modo
  taller un `cd` cambia la carpeta de verdad, y las órdenes viejas habrían
  aparecido escritas en la carpeta nueva.
- **El foco del campo no pisa el indicador.** El anillo de foco global sale
  dos píxeles hacia arriba y tapaba la línea del indicador. En el modo taller
  el foco es un borde a la izquierda del bloque de entrada. El modo de
  escenarios tiene el mismo roce y no se tocó.

### 71.2 · Lo que el recorrido encontró

El recorrido de punta a punta compara, después de cada orden, lo que la página
pinta con lo que Git dice preguntado aparte, y lo que la consola mostró con lo
que imprimió un gemelo que corre la misma orden con bash directo. Encontró
siete defectos que ninguna prueba de unidad había visto.

1. Un `cd` fallido mostraba `…/taller-git-trabajo/.taller/orden.sh: line 21:`.
2. Un error de sintaxis salía firmado `bash: eval: line 1:`.
3. En un Mac con Homebrew la consola usaba otro git que la Terminal.
4. Un archivo guardado justo después de una orden tardaba 1,5 s en verse.
5. En Windows, la lectura del estado lanzaba once procesos de Git dentro de un
   bash y tardaba cerca de un segundo.
6. En Windows, `ls` ordenaba distinto de Git Bash, por el `LANG` fijado.
7. Una pregunta por el estado que salió antes de terminar una orden podía
   volver después y pisar el estado nuevo con el viejo durante medio segundo.
   La página ahora solo acepta una versión más nueva que la que tiene.

Y en el programa, antes del recorrido, las pruebas de unidad y las primeras
corridas en Windows encontraron que la comprobación del primer día cortaba su
propia respuesta al navegador, que el arrancador de Mac no encontraba
`sysctl` con un PATH mínimo y tomaba un M1 por un Intel, y que `lineas()`
recortaba los tabuladores finales y perdía todas las ramas.

### 71.3 · Por qué el prototipo en Python no arrancó en Mac

`HTTPServer.server_bind` llama a `socket.getfqdn()`, que resuelve el nombre de
`127.0.0.1` al revés. En el ejecutor `macos-latest` de GitHub eso tardó 35,1
segundos, medido en la integración continua, y la prueba del prototipo
esperaba veinte. El programa Java no resuelve ningún nombre, y los arrancadores
tampoco.

### 71.4 · Lo que no se pudo probar

El antivirus corporativo, la lista de programas permitidos, el proxy y la
política de ejecución de los equipos del SII. La comprobación del primer día
los cubre en sus filas 5 y 6, con qué hacer si fallan.

### 71.5 · Pendiente

- `git push` y `git pull` contra un servidor con clave van en Git Bash.
- Las órdenes que piden teclado, como `git add -p`, van en Git Bash. La
  consola lo dice.
- Los enunciados piden pararse en la raíz del clon, y la consola parte en
  `taller-git-trabajo` (punto 2.4). El participante escribe primero
  `cd ../curso-git-gitlab-sii`, y al empezar cada laboratorio vuelve con otro
  `cd`. El recorrido escribe esos `cd` como pasos del arnés.
- El doble clic en `taller-java.command` desde Finder no se probó en la
  integración continua, que no tiene Finder.

### 71.6 · Las cifras

Recorrido de los ocho laboratorios, 470 órdenes y pasos de editor por
plataforma, con tres marcadores de posición del laboratorio 07 omitidos porque
el participante los reemplaza a mano.

| Plataforma | Página igual a Git | Procesos en 60 s de reposo | Cambio de afuera visible, mediana |
|---|---|---|---|
| Mac M1 del product owner, Chrome | 469 de 469 | 0 | 517 ms |
| macOS en GitHub, Chrome | 469 de 469 | 0 | 664 ms |
| Windows en GitHub, Chrome | 469 de 469 | 0 | 997 ms |
| Windows en GitHub, Chrome, Git fuera del PATH | 469 de 469 | 0 | 1067 ms |
| Windows en GitHub, Edge | 460 de 469 | 0 | 631 ms |

Las nueve de Edge son el laboratorio 08 y no son del programa: son el
`preparar.sh` del punto 71.2 que no es determinista en Windows. El recorrido
ahora lo anota y deja al gemelo partir de la misma preparación.

Las cifras de Windows son de la corrida `36224554725`, anterior a la espera de
la lectura en curso (sección 71.1), que baja la demora en Windows y no alcanzó
a medirse allí: desde las 07:36 del 26 de septiembre GitHub Actions no inicia
trabajos en esta cuenta, por un problema de pago. Por lo mismo quedaron sin
verificar en Windows el cierre de la franja con el programa muerto y la corrida
como un usuario de Windows con espacio y tilde, cuya primera versión quedó
colgada y se canceló.

| | |
|---|---|
| Pruebas de unidad de Java | 61, y 24 mutaciones que las hacen fallar |
| Pruebas del modelo del modo taller | 18, y 9 mutaciones |
| Suite del simulador | 972 |
| Mutaciones del recorrido de punta a punta | 4 de 4 atrapadas |
| `taller-java/taller.jar` | 77 552 bytes |
| Runtimes | 31 MB cada uno en disco, 17,4 y 18,7 MB comprimidos |

---

# SPEC 027 · Ajustes del modo taller después de la prueba en vivo

## 72. Lo que se ajustó

SPEC 027, en la rama `taller-java`.

### 72.1 · La disposición

En el modo taller la consola y el grafo van lado a lado desde 900 píxeles, y no
desde 1280. La consola y el tirador recibieron una opción de corte, y el modo de
escenarios conserva el suyo. El ancho de partida de la consola quedó con tope
en 60 %: con el tope de 72 del modo de escenarios, a 900 píxeles el grafo se
quedaba con un cuarto de la pantalla.

### 72.2 · El área del repositorio

Lista los archivos de HEAD, que el programa lee con `git ls-tree` en la misma
lectura del estado, y debajo las confirmaciones y las ramas. Sobre treinta
archivos, los primeros y una línea con cuántos más. Todos los contadores de la
página pasan por una sola función, `contar`, que dice «1 confirmación» y
«1 cambio sin confirmar». Se corrigieron también los del modo de escenarios.

### 72.3 · La consola

- **Dos órdenes en una línea.** La lista de órdenes conocidas vive en
  `simulador/src/vista/ordenesConocidas.ts`. Si una línea empieza con una de
  ellas y más adelante aparece otra suelta, fuera de comillas y sin `;`, `&&`,
  `||` ni `|` entre medio, la consola lo pregunta con la voz del programa y la
  orden corre igual. La segunda palabra de `git` no cuenta, porque `git diff` es
  una sola orden, y en `git stash`, `git remote` y las demás que llevan una
  suborden propia tampoco la tercera.
- **La salida larga.** Si la salida de una orden no cabe, la consola queda
  mostrando su principio, con el eco arriba, y una marca que dice que sigue más
  abajo. Un clic en la marca baja hasta el final.
- **La primera orden.** La causa de que la salida de `git init` quedara fuera de
  la vista era otra. Al aparecer el repositorio, la barra de arriba gana una
  línea con la carpeta, la consola se achica, y lo que estaba pegado al final
  quedaba debajo. La consola ahora vuelve a bajar cuando cambia de alto. El
  recorrido lo encontró en el paso 11 del laboratorio 01, al comprobar después
  de cada orden que su eco se vea.

### 72.4 · `preparar` y `verificar`

Órdenes propias de la consola, que atiende el programa. Corren
`labs/lab-NN/preparar.sh` y `labs/lab-NN/verificar.sh` desde la raíz del clon.
`preparar` deja la consola en `taller-git-trabajo/lab-NN/recetario` si el script
termina bien. Aceptan `2` y `02`, y sin número usan el laboratorio donde está la
consola. Sobre un laboratorio ya preparado, `preparar` no corre nada, avisa que
se borra el trabajo sin vuelta atrás y pide `preparar NN --forzar`. El programa
nunca pasa `--forzar` por su cuenta. Su eco va en el color del programa, y
`ayuda` las lista junto con `clear`. Los scripts no se tocaron.

### 72.5 · Los enunciados

Los ocho cambiaron en su preparación, en su sección del simulador y en su
comprobación. El 01 cambió además en «Antes de empezar», en la parte 1 y en la
parte 2; el 02, 06 y 07 en «Si algo salió mal»; el 03 y el 07 en el pasaje que
mandaba a la terminal; el 08 en el suyo. Cada sección «Abre el simulador» pasó
a ser «El taller ya está abierto», y conserva una frase con la dirección del
simulador de escenarios, que sigue siendo el respaldo sin el programa y que el
arnés de Cypress necesita para saber qué escenario abrir.

El extractor del guion reconoce `preparar`, `verificar` y `code`. Para el
simulador de escenarios quedan omitidas, porque allí el escenario ya viene
preparado, y el recorrido del modo taller las ejecuta en la consola.

**Una contradicción del spec.** El punto 4.6 dice que los scripts no se tocan y
el 5.4 pide que el verificador del 01 compruebe que la rama se llame `main`.
Se agregó ese criterio al verificador del 01, el sexto, y ningún otro script
cambió.

### 72.6 · Lo que el recorrido encontró además

- **El extractor nunca sacó `chmod`.** En el laboratorio 08 el gancho quedaba
  sin permiso de ejecución en la copia y en el gemelo por igual, y la
  comparación decía «igual» mientras `verificar 08` daba 4 de 5. El recorrido
  ahora anota el resultado de cada verificador.
- **El recorrido no hacía el paso a mano del laboratorio 01**, agregar una línea
  a tres archivos, que el arnés en disco sí hacía. Ahora lo hace por fuera, como
  el editor, y `verificar 01` da 6 de 6.
- **`git stash clear` se avisaba como dos órdenes**, porque `clear` también es
  orden de la consola.

### 72.7 · Las cifras

En el Mac del product owner, con Chrome.

| Laboratorio | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 |
|---|---|---|---|---|---|---|---|---|
| Iguales a Git | 44/44 | 53/53 | 65/65 | 71/71 | 57/57 | 52/52 | 75/75 | 46/46 |
| Verificador | 6/6 | 7/7 | 7/7 | 5/5 | 5/5 | 7/7 | 8/8 | 5/5 |

| | |
|---|---|
| Procesos en 60 s de reposo | 0 |
| Cambio de afuera visible, mediana | 518 ms |
| Pruebas de Java | 68, y 31 mutaciones atrapadas |
| Pruebas del modelo del modo taller | 28, y 17 mutaciones atrapadas |
| Suite del simulador | 982 |
| Mutaciones del recorrido | 7 de 7 atrapadas |

## 73. El taller con Git real dentro de la página

SPEC 026, en la rama `taller-python`, creada desde `main`. (La sección 70 es
la del modo conectado, en la rama `poc/repositorio-real`, que se descartó.)

Se numeró 71 en esa rama, a la par con la 71 de `taller-java`, y pasó a 73 al
juntar las dos ramas en `taller` (sección 74). Describe el taller de Python
antes de la fusión: su página, `AplicacionTaller`, salió, y su programa se
rehízo para hablar la interfaz de la página de Java.

### 73.1 · Cómo se arma

- **`TALLER.cmd` y `taller.command`**, en la raíz del clon, buscan un Python
  3.9 o superior (`py`, `python`, `python3`) y arrancan `taller/taller.py`.
  Si no hay, lo dicen y esperan una tecla.
- **`taller/taller.py`**, un solo archivo, solo biblioteca estándar. Es uno
  solo para que Python no deje `__pycache__` en el clon. Escucha en
  `127.0.0.1`, en un puerto que elige el sistema, sirve `SIMULADOR.html` y
  abre el navegador con `http://127.0.0.1:<puerto>/?clave=<clave>`.
- **La página decide el modo por su dirección.** Servida por el programa, con
  clave, es el modo taller; abierta con doble clic, el simulador de siempre.
  El modo taller reutiliza la consola, el tirador, el grafo, las áreas, los
  paneles, el modo relator y los temas. No usa el motor ni el lector de
  `.git`: el estado lo trae el programa preguntándole a Git.
- **Sin previsualización** en este modo, sin selector de escenario, sin línea
  de tiempo y sin líneas de ayuda bajo el campo.

### 73.2 · El programa

- **Seguridad.** Clave aleatoria por arranque, comparada en tiempo constante;
  403 sin ella, con otra, con un `Origin` que no sea el propio, o con un
  `Host` que no sea `127.0.0.1:<puerto>` (el cambio de nombre de un dominio a
  127.0.0.1). Ninguna cabecera CORS; la consulta previa recibe 403.
- **Git Bash de verdad.** En Windows, el `bash.exe` de Git para Windows,
  buscado desde donde está `git`, nunca el de `System32` (WSL). Se lanza como
  shell de inicio de sesión con `CHERE_INVOKING=1`, para que no se vaya a la
  carpeta del usuario. La carpeta se lee al final de cada orden con
  `pwd -W` y `/c/Users/...` se convierte a `C:/Users/...`.
- **La consola parte en `taller-git-trabajo`**, hermana del clon, que se crea
  si no existe. Recuerda la carpeta entre órdenes.
- **Sin paginador y sin preguntas:** `GIT_PAGER=cat`, `TERM=dumb`,
  `GIT_TERMINAL_PROMPT=0`, y la entrada estándar vacía.
- **El editor.** Git recibe siempre `taller/editor.sh`, que en el momento de
  abrirlo pregunta a Git cuál es el configurado (así ve también un
  `-c core.editor=...` dentro de la orden). Si es uno de ventana y está
  instalado, como `code --wait`, lo abre y espera. Si es de terminal (vi,
  nano...), si no hay ninguno o si no está instalado, termina de inmediato
  con un mensaje que dice qué configurar.
- **Órdenes que piden teclado** (`git add -p`, `-i`, `--patch`,
  `checkout -p`, `clean -i`, vi, nano, less...) no se ejecutan: se dice que
  se hagan en Git Bash.
- **Límite de tiempo:** 20 minutos por defecto (`TALLER_LIMITE`, en
  segundos). Al pasarlo se detiene la orden y todo lo que abrió.
- **Una orden a la vez:** la segunda recibe 409, y la página no deja escribir
  mientras corre una.
- **El estado** se calcula con órdenes de porcelana (`log`, `for-each-ref`,
  `status --porcelain -z`, `stash list`, `log -g`) con
  `GIT_OPTIONAL_LOCKS=0`, para no reescribir el índice al mirar. Antes se
  saca una huella con el tamaño y la fecha de lo que cambia (HEAD, índice,
  referencias, registro y directorio de trabajo): si no cambió, la página
  recibe «igual» y Git no se llama. La página pregunta cada medio segundo.
- **Rastros:** solo `taller-git-trabajo` y `taller-git-trabajo/.taller-sesion.json`,
  con el puerto y la clave. Un segundo doble clic lo lee, ve que el taller
  sigue abierto y abre la misma dirección, sin arrancar otro.
- **Mac:** el `bash` y el `git` de Apple son binarios universales, y en esta
  máquina a veces arrancaban como x86_64 bajo Rosetta, y el `git` de Apple
  fallaba («unable to load libxcrun»). El programa los lanza con
  `/usr/bin/arch -<arquitectura de Python>`. No se encontró la causa.

### 73.3 · La página

- Cada orden queda con el prompt con que se escribió (en Git Bash cambia con
  `cd`), y el programa guarda las órdenes de la sesión para dibujarlas igual
  al volver a entrar.
- La salida de error va en rojo solo si la orden falló; `git status` se pinta
  como en Git Bash.
- `clear` limpia la consola en la página.
- **El prompt tapado.** El contorno del foco del campo se dibuja cuatro
  píxeles por fuera y pisaba la última línea del prompt, también en el modo
  de escenarios. La fila del campo lleva ahora aire arriba.

### 73.4 · Pruebas

- `tests/taller/programa.test.ts` (32): arranque como el alumno, seguridad,
  carpeta, paginador, tildes, una orden a la vez, editor, interactivas,
  límite de tiempo, huella, segundo doble clic y rastros. Se vieron fallar
  con el prototipo y, para cada defensa, quitándola del programa.
- `tests/taller/vista.test.ts` (14): la pantalla desde el estado de Git.
- `tests/navegador/taller.navegador.ts`: el recorrido de los ocho
  laboratorios en la consola de la página, comparando después de cada orden
  grafo (vivas y huérfanas), ramas, remotas, etiquetas, HEAD y áreas contra
  Git corrido aparte. Además, en cada orden, la pantalla: prompt a la vista y
  sin tapar (contando el contorno del foco), la carpeta en el prompt y en la
  barra, letra legible y sin líneas de ayuda. Y 2.7 (archivo editado por
  fuera), 2.8 (recargar), 4.2 (`clear` e historial) y 2.9 (cerrar el taller).
  Corre en GitHub Actions (`taller.yml`).

### 73.5 · Lo que el enunciado da por hecho

**Los enunciados del 02 al 08 empiezan con `labs/lab-NN/preparar.sh`, que
supone la terminal parada en el clon.** La consola del taller parte en
`taller-git-trabajo` (punto 2.4), así que el alumno tiene que escribir antes
`cd ../curso-git-gitlab-sii`. El recorrido lo hace. El 01 funciona igual
desde `taller-git-trabajo`: su `cd ..` lleva a la misma carpeta de arriba.

### 73.6 · Resultados

GitHub Actions, ejecución 36218607145
(https://github.com/RodrigoMSB/curso-git-gitlab-sii/actions/runs/36218607145).
El taller arrancó con `TALLER.cmd` en Windows y con `taller.command` en Mac,
con el Python y el Git de cada máquina.

| | Windows + Edge | Windows + Chrome | Mac + Chrome |
|---|---|---|---|
| Programa (32) y vista (14) | 46 | 46 | 46 |
| Órdenes con la página igual a Git, labs 01 a 08 | 513 de 513 | 513 de 513 | 513 de 513 |
| Pantalla bien en cada orden | sí | sí | sí |
| Orden escrita hasta la página al día, mediana | 0,8 a 1,0 s | 0,8 a 1,0 s | 0,35 s |
| Archivo editado por fuera, visto | 670 ms | 414 ms | 502 ms |

Por laboratorio: 01: 68, 02: 53, 03: 67, 04: 86, 05: 56, 06: 52, 07: 76,
08: 55. Del 07 se saltan dos órdenes de la sección de rescate con marcadores
que el participante reemplaza a mano.

En Windows cada orden tarda cerca de un segundo: Git Bash arranca como shell
de inicio de sesión en cada una.

Dos defectos que solo aparecieron en Windows: el navegador de mentira de la
prueba (un `.cmd`) no se lanzaba, y **una orden detenida por el límite de
tiempo seguía corriendo** hasta terminar sola, porque `taskkill /T` no alcanza
a los procesos que abre Git Bash. Ahora cada orden corre dentro de un objeto
de trabajo de Windows y se termina entera.

## 74. Un solo taller, con dos motores

SPEC 028, en la rama `taller`, creada desde `main` y con `taller-java` y
`taller-python` fusionadas. Las cuatro ramas de antes (`main`,
`poc/repositorio-real`, `taller-java`, `taller-python`) no se tocaron.

### 74.1 · La fusión

Doce archivos en conflicto: `.gitattributes`, `SIMULADOR.html`,
`docs/arquitectura.md`, `simulador/dist/index.html`,
`simulador/dist/manifiesto.txt`, `simulador/package.json`,
`simulador/package-lock.json`, `src/main.tsx`, `src/ui/Consola.tsx`,
`src/vista/consola.ts`, `src/vista/index.ts` y
`tests/arquitectura-vista.test.ts`. En todo lo de la página manda
`taller-java`, también en lo que Git mezcló sin conflicto; la página de
`taller-python` (`AplicacionTaller`, su barra, sus medidas y sus pruebas) sale
en un commit aparte. `docs/arquitectura.md` conserva las dos secciones 71: la
de Python pasó a 73. `.gitattributes` se reescribió para la estructura nueva.

### 74.2 · La estructura

```
taller-git/
  TALLER.cmd  taller.command  taller.sh     arrancan el taller
  comprobar.cmd  comprobar.sh                 la comprobacion del primer dia
  preparar  verificar                         scripts de bash, sin logica
  .taller/                                    lo que guarda el motor
  lab-01/recetario ... lab-08/recetario       el trabajo del participante
  curso/                                      el clon
    INSTALAR.cmd  instalar.command
    taller/
      INTERFAZ.md  arrancar.sh  arrancar.cmd  laboratorio.sh  comprobar.sh
      probar-instalacion.sh  probar-lab-08.sh  mutaciones-instalacion.py
      raiz/            los siete envoltorios que copia INSTALAR
      java/            taller.jar, jre/ y fuente/
      python/          taller.py
```

- **Los envoltorios de la raíz son una línea** que llama a lo que vive en el
  clon, así que `git pull` los actualiza sin reinstalar. INSTALAR solo copia
  y se niega si la carpeta no es `taller-git/curso`.
- **`preparar` y `verificar` son scripts de bash**, no órdenes de la consola.
  La consola pone la raíz del taller en el `PATH`, y así se llaman igual en la
  consola y en Git Bash. Corren el script del laboratorio con `TALLER_RAIZ`
  apuntando a `taller-git`. Los scripts de los laboratorios solo cambiaron la
  carpeta de trabajo: `${TALLER_RAIZ:-$(dirname "$CLON")}/lab-NN`.
- **Cómo `preparar` mueve la consola.** Un script no puede cambiar la carpeta
  de quien lo llama. El envoltorio de la consola exporta `TALLER_CD_DESPUES`,
  un archivo; `laboratorio.sh` escribe ahí la carpeta del laboratorio y el
  envoltorio va a ella al salir, con el mismo `cd` que no sale del taller. En
  Git Bash la variable no existe y `preparar` dice a qué carpeta ir.
- **Sin `--forzar` y sin terminal**, preparar un laboratorio ya preparado no
  pregunta: avisa y pide `preparar NN --forzar`.

### 74.3 · La cascada

`arrancar.sh` (y `arrancar.cmd`, que solo busca el bash de Git para Windows y
lo llama con `--login`) prueba en orden:

1. El motor de Java, con el runtime del clon, o un Java 21 del sistema.
2. Si en treinta segundos no responde a `/api/diagnostico` con su clave, lo
   cierra con todo lo que abrió y prueba el de Python, con un Python 3.9 o
   superior del equipo (`py -3`, `python3`, `python`). Treinta porque en un
   equipo corporativo el antivirus revisa el runtime la primera vez que
   arranca (al principio eran cinco, y en el Mac de la integración continua
   Java no alcanzó a responder y la cascada pasó a Python). Si responde antes,
   se sigue en ese momento. Mientras espera, la ventana dice «El taller está
   arrancando. La primera vez puede tardar hasta medio minuto.». Python
   conserva sus cinco segundos. `TALLER_ESPERA_JAVA` y `TALLER_ESPERA` los
   cambian.
3. Si tampoco, abre `SIMULADOR.html` en el modo de escenarios, con un aviso
   que empieza con ATENCIÓN y pide avisar al relator, y sale con 3.

El motor escribe su dirección en `taller-git/.taller/direccion`, el
arrancador anota el motor que quedó en `.taller/motor` y abre el navegador él.
La barra de la página dice «motor Java» o «motor Python».

### 74.4 · La interfaz

`taller/INTERFAZ.md` es el contrato. El motor de Python se rehízo para
hablarla: el mismo envoltorio de bash, línea por línea; las mismas lecturas
de Git; la misma huella sin procesos; la misma guardia. La prueba
`simulador/taller-java/interfaz.test.ts` arranca los dos con la misma
identidad y las mismas fechas de Git, les manda 87 peticiones (la guardia, los
errores de la API, el 409, y órdenes que pasan por fusión con conflicto,
rebase a medias, guardados, etiquetas, huérfanas, posición desconectada, un
repositorio desnudo, los cuatro avisos, el límite de tiempo y `preparar`) y
compara las respuestas paso a paso.

Diferencias que encontró y se arreglaron:

- **Python no leía cuerpos por partes** (`Transfer-Encoding: chunked`) y
  respondía «falta la orden». El navegador manda `Content-Length` y no se
  notaba; ahora los lee como Java.
- **Java no ponía** `Cache-Control`, `X-Content-Type-Options` ni
  `Referrer-Policy` **en el 403 y el 405**, que INTERFAZ.md pide en toda
  respuesta. Ahora los pone la guardia antes que nada.
- **Java mandaba `Content-Type` en el 204**, sin cuerpo. Ya no.

### 74.5 · Lo que se arregló de paso

- **El laboratorio 08 con `core.autocrlf` en true.** El proyecto original se
  clonaba del paquete con la configuración global; `configurar` fijaba
  `autocrlf` en false después, con los archivos ya escritos con CRLF. En Mac
  el identificador quedaba siempre distinto del de un equipo con false, y en
  Windows cambiaba de una preparación a otra según el segundo del reloj. El
  clon lleva ahora `-c core.autocrlf=false --config core.autocrlf=false`.
  `taller/probar-lab-08.sh` prepara una vez con false y cinco con true y
  compara las referencias de los tres lugares.
- **`taller/java/fuente/target/` entró al repositorio** en el commit de la
  estructura, porque la regla que lo ignoraba no existía (en `taller-java`
  nunca se había agregado por casualidad). Salió, y quedó la regla.
- **La prueba del reposo dependía de la hora.** El arnés compara la página
  con Git corriendo `git status` en la carpeta del participante, y ese
  `git status` refrescaba `.git/index`. El motor veía el cambio, con razón, y
  hacía una lectura: seis procesos que caían o no dentro del minuto de reposo.
  Corriendo solo los laboratorios 01 a 03 cayeron adentro. El arnés lee ahora
  con `GIT_OPTIONAL_LOCKS=0`, como los motores.
- **El simulador de respaldo** decía `/taller-git-trabajo/lab-NN/recetario`
  en su indicador. Ahora dice `/taller-git/lab-NN/recetario`, como los
  enunciados, y `mkdir -p lab-01/recetario` recibe la explicación de que el
  simulador no crea carpetas fuera del recetario.
- **Las capturas del recorrido** se ignoraban solo en la copia local. Ahora
  `.gitignore` lo dice, y cada motor deja las suyas en
  `simulador/capturas-taller-java/<motor>/`, con su zip.

### 74.6 · Pruebas, y cómo se vio fallar cada una

| Prueba | Qué hace | Cómo se vio fallar |
|---|---|---|
| `recorrido.test.ts`, `TALLER_MOTOR=java` y `python` | los ocho laboratorios en la página, contra Git y contra un gemelo en bash; `preparar NN` y `verificar NN` escritos en la consola | `mutaciones-recorrido.py`: 12 de 12, entre ellas el motor de Python sin la raíz en el `PATH`, la barra que dice Java con Python, `preparar` que no mueve la consola y la cascada que no llega a Python |
| `interfaz.test.ts` | los dos motores, 87 pasos | las tres diferencias reales de 74.4, y `mutaciones-interfaz.py`: 6 de 6 |
| `probar-instalacion.sh`, `MOTOR=java`, `python`, `respaldo` | de cero: taller-git, el clon como curso, INSTALAR, TALLER, el lab 01, `preparar 02`, la comprobación | `mutaciones-instalacion.py`: 7 de 7 |
| `probar-lab-08.sh` | seis preparaciones del 08 | con el arreglo quitado, en Mac: `2818cdd` contra `e0bc1cf` |
| `probar-cierre.ps1`, Windows, `java` y `python`, `ventana` y `motor`, Java con el custodio apagado y encendido | lo que queda vivo al cerrar, y que el segundo arranque lo cierre y recree `lab-01` (sección 74.8) | antes de cada arreglo, en la integración continua: `Device or resource busy` en el segundo arranque |
| `sin-powershell`, Windows | el motor de Java con el custodio encendido y PowerShell bloqueado, inexistente o colgado | sin el arreglo, sin aviso en la ventana, y colgado, 24 s por `preparar 02` |
| `RastroTest` | cerrar al arrancar lo anotado, sin tocar un proceso ajeno | sin terminar, y sin comparar la hora de inicio |
| `modo-taller.test.ts` | el modelo de la página, con la barra del motor | `mutaciones-modelo.py`: 20 de 20 |
| pruebas de Java | incluida la nueva de `PATH` y `TALLER_CD_DESPUES` | `mutaciones.py` |

### 74.7 · Lo que encontró GitHub Actions

La facturación volvió el mismo día y el flujo corrió. La primera ejecución
(36276663855) pasó los ocho recorridos, las siete instalaciones, la interfaz
y el laboratorio 08 en Windows y en Mac, y destapó cinco cosas:

- **La consola se despegaba del final**, una vez, con `git init` en el
  laboratorio 01 con Python en Mac. La consola baja sola y el evento de ese
  desplazamiento llega un cuadro después; si entretanto la barra crece y la
  consola se achica, la distancia al final pasa de 24 píxeles y se tomaba
  como que el participante subió. Ahora la consola recuerda dónde se dejó y no
  toma su propio movimiento por uno ajeno. Una prueba nueva del recorrido lo
  provoca a propósito, con dos achiques seguidos, y sin el arreglo falla.
- **El usuario con tilde**, dos veces en el arnés: Git Bash monta la carpeta
  temporal del usuario en `/tmp`, y la ruta que deja `preparar` y la que
  imprimen los scripts venían como `/tmp/...`. El arnés las traduce con
  `cygpath`.
- **La rama inicial en la prueba del laboratorio 01.** En el Mac del
  desarrollo la pone en main el gitconfig de las herramientas de Apple; en
  el de GitHub nacía master. La prueba fija `init.defaultBranch`, como el
  enunciado.
- **Órdenes de Git que el simulador no conocía:** `format-rev` y `url-parse`
  de Git 2.55, e `instaweb`, `archimport`, `cvsimport`, `cvsexportcommit`,
  `cvsserver`, `credential-netrc` y `jump` del Git de Homebrew. Respondía
  que no son órdenes de Git.
- **La suite del simulador** no se había corrido nunca en Windows. Allí
  fallan pruebas que dependen de permisos de ejecución y de finales de línea;
  en la integración continua corre en Linux.

### 74.8 · Lo que queda vivo al cerrar el taller

Pedido después del EBUSY de la limpieza de la prueba de la interfaz, y
revisado tres veces. Esta es la versión final y lo que se midió en el
camino.

**El problema.** Los dos motores lanzan cada orden en una consola propia y
oculta (Java siempre con `CREATE_NO_WINDOW`, Python a propósito). Al cerrar la
ventana de `TALLER.cmd`, o si el motor muere de golpe, lo que la orden tenía
corriendo sigue vivo: el bash de la orden, `git.exe`, `sh.exe`, `sleep.exe` y
su `conhost.exe`, parados en `taller-git/lab-01/recetario`. El siguiente
arranque fallaba al borrar la carpeta: `rm: cannot remove
'lab-01/recetario': Device or resource busy`.

**La prueba, `taller/probar-cierre.ps1`**, solo Windows. Arma `taller-git`
como el participante, arranca `TALLER.cmd`, le manda una orden que deja vivos
un bash, un git y un sleep en `lab-01/recetario`, y cierra de dos maneras:

- **La ventana.** La consola es una pseudoconsola (`CreatePseudoConsole`, la
  de Windows Terminal), y se cierra con `ClosePseudoConsole`, que manda
  `CTRL_CLOSE_EVENT` de verdad a cada proceso unido a ella, como la X. Nada se
  mata de golpe, y todo lo que la consola muestra queda en un archivo. Una
  versión anterior de la prueba, en una ventana clásica que en la máquina de
  la integración continua no atiende `WM_CLOSE`, terminaba de golpe los
  procesos de la consola (`GetConsoleProcessList` y `Stop-Process -Force`):
  eso no se parece a la X, y ahí ningún gancho puede correr. Se cambió.
- **El motor, de golpe**, con `Stop-Process -Force` (TerminateProcess). La
  ventana queda, a propósito, en el `pause` de `arrancar.cmd`.

Después cuenta lo que quedó vivo del árbol que colgaba de `TALLER.cmd`, y
arranca de nuevo enseguida para borrar y recrear `lab-01` desde la consola.

**Python** ata sus órdenes a su propia vida con un objeto de trabajo de
Windows marcado con `KILL_ON_JOB_CLOSE`, creado con `ctypes`. El motor entra
en él al arrancar, antes de lanzar nada, y todo lo que lanza nace dentro;
cuando el motor termina, de cualquier forma, Windows termina el trabajo
entero. No deja nada vivo.

**Java** no llega a esa API sin código nativo. Se probaron tres caminos:

1. **El custodio**, `Custodio.java`: un ayudante de PowerShell que crea el
   mismo objeto de trabajo y mete en él al motor. Funciona, pero usa
   `Add-Type`, que **compila C# en el momento** en cada arranque, con el
   compilador de .NET, y deja una DLL temporal en `%TEMP%`. Eso puede disparar
   alertas del EDR en los equipos del SII. **Queda apagado** y se enciende con
   `TALLER_CUSTODIO=1`. Encendido y sin PowerShell (bloqueado, inexistente o
   colgado), el motor lo espera una sola vez, hasta diez segundos desde el
   arranque, sigue sin él y la ventana dice una vez «Aviso: no se pudo
   preparar el cierre ordenado con PowerShell. Al cerrar esta ventana pueden
   quedar procesos abiertos.». El trabajo `sin-powershell` de la integración
   continua lo prueba de las tres maneras; sin ese arreglo, colgado, cada orden
   esperaba veinte segundos (`preparar 02` en 24 s).
2. **Un gancho de cierre** en Java puro, `ProcessHandle.descendants()` en un
   `shutdown hook`. **No corrió en ningún caso medido**: su línea no apareció y
   no terminó nada, ni al cerrar la consola ni, como era de esperar, con el
   motor muerto de golpe. Para descartar al arrancador, cuya trampa también
   actúa al cerrarse la consola, el caso de diagnóstico `-Directo` lanzó
   `java -jar` solo en la pseudoconsola, sin `TALLER.cmd` ni `arrancar.sh`: la
   máquina virtual murió, el gancho tampoco corrió, y quedaron bash, git, sh,
   sleep y conhost. La explicación probable es que la máquina virtual
   convierte `CTRL_CLOSE_EVENT` en SIGTERM y devuelve el control enseguida, y
   para ese evento Windows termina el proceso en cuanto vuelve, antes de que
   los ganchos hagan su trabajo. **Salió.**
3. **Cerrar al arrancar**, `Rastro.java`, lo que quedó. Cada orden que el
   motor lanza queda anotada en `taller-git/.taller/procesos`, con su número y
   su hora de inicio, y lo mismo sus descendientes, mirados cada medio
   segundo mientras la orden corre, con `ProcessHandle` y sin lanzar nada. Al
   terminar la orden se quita lo que ya no vive. Al arrancar, antes de
   atender, el motor termina lo que siga vivo con el mismo número **y** la
   misma hora de inicio, y lo que eso haya lanzado después, y vacía el
   archivo; dice en la ventana cuántos cerró. La hora de inicio es la que
   impide terminar un proceso ajeno que reusó el número. Las pruebas de unidad
   (`RastroTest`) se vieron fallar sin terminar y sin comparar la hora.

**Resultados**, ejecución 36292708455 de la integración continua:

| motor | custodio | cierre | vivos tras cerrar | al arrancar de nuevo | segundo arranque recrea `lab-01` |
|---|---|---|---|---|---|
| Java | apagado | ventana | 7: bash, conhost, git, sh, sleep | cerró 7 | sí |
| Java | apagado | motor de golpe | 7: bash, conhost, git, sh, sleep | cerró 7 | sí |
| Java | encendido | ventana | 0 | nada que cerrar | sí |
| Java | encendido | motor de golpe | 0 | nada que cerrar | sí |
| Python | — | ventana | 0 | — | sí |
| Python | — | motor de golpe | 0 | — | sí |

**Consecuencias.**

- Con el custodio apagado, que es lo que usa el participante, lo que una
  orden tenía corriendo al cerrar el taller **sigue vivo hasta el arranque
  siguiente**, y mientras tanto la carpeta del laboratorio no se puede borrar
  desde fuera. El arranque siguiente lo cierra antes de atender.
- Con el custodio encendido, y con Python, un Visual Studio Code abierto con
  `code` desde la consola se cierra junto con el taller: el objeto de trabajo
  no deja salir a nadie. Hacía falta, porque Git Bash lanza `git.exe`
  pidiendo salir del trabajo, y con permiso salía y sobrevivía.
- Dos intentos del custodio que la prueba descartó antes: sumar cada orden
  al trabajo después de lanzarla (el `bash.exe` de Git para Windows es un
  lanzador que abre enseguida el bash de verdad, y ese nacía fuera) y
  permitir salir del trabajo (git salía).
- Cada motor escribe el archivo de su dirección al final, después de
  imprimir, porque el arrancador y las pruebas lo toman como la señal de
  listo.

**El arranque, medido** en la integración continua de Windows, desde el
doble clic hasta «Motor del taller»:

| motor | primer arranque, runtime recién llegado | arranque normal |
|---|---|---|
| Java | 1,6 s | 1,3 a 1,6 s |
| Python | 4,4 s | 2,3 s |

En esas máquinas la protección en tiempo real de Defender está apagada, así
que el primer arranque no paga lo que paga en un equipo corporativo con
antivirus; ese número queda por medir en un equipo del SII. Por eso la
cascada espera a Java hasta treinta segundos (sección 74.3).

**Los «3 skipped» de la prueba de la interfaz**, vistos dos veces en el Mac
del desarrollo y nunca en la integración continua. vitest da las tres
pruebas por saltadas cuando falla su `beforeAll`, y ahí solo falla si un
motor no deja su dirección en treinta segundos o no arranca. Es compatible con
un motor que no respondió a tiempo, pero no está probado: no se reprodujo ni
con todos los núcleos ocupados, y el mensaje de error de esas dos veces se
perdió. Ahora el error dice cuánto se esperó.

### 74.9 · Resultados, en este Mac con Chrome

| | motor Java | motor Python |
|---|---|---|
| 01 | 44 de 44 | 44 de 44 |
| 02 | 53 de 53 | 53 de 53 |
| 03 | 65 de 65 | 65 de 65 |
| 04 | 71 de 71 | 71 de 71 |
| 05 | 57 de 57 | 57 de 57 |
| 06 | 52 de 52 | 52 de 52 |
| 07 | 75 de 75 | 75 de 75 |
| 08 | 46 de 46 | 46 de 46 |
| procesos en un minuto de reposo | 0 | 0 |
| archivo editado por fuera, visto (mediana) | 517 ms | 671 ms |
| interfaz, pasos iguales | 87 de 87 | 87 de 87 |

Órdenes con la página igual a Git, con `preparar` y `verificar` escritos en
la consola. Las capturas de los laboratorios 01 y 02 y de las pruebas de
pantalla quedan en `simulador/capturas-taller-java/<motor>/`, con un zip por
motor, fuera del repositorio.

El clon pesa unos 33 MB de descarga y 101 MB en disco, de los que 62 MB son
los dos runtimes de Java.

### 74.10 · Lo que falta

- **El primer arranque con un antivirus de verdad.** En la integración
  continua Defender no revisa en tiempo real; hay que medirlo en un equipo del
  SII.
- **El cierre con la X en un escritorio.** La prueba usa una pseudoconsola,
  que manda el mismo `CTRL_CLOSE_EVENT`, pero no una ventana clásica cerrada
  con el ratón.
- **Los «3 skipped»** de la prueba de la interfaz, sin causa probada.
- **La suite del simulador en Windows y en Mac.** Corre en Linux. Que pase en
  Windows pide revisar las pruebas que miran permisos de ejecución y
  finales de línea, que se escribieron para el Mac del desarrollo.
- **Mac con Intel** no tiene runtime de Java en el clon: usa un Java 21 del
  sistema si hay, y si no, Python.
