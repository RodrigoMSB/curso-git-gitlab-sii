# Taller de Git y GitLab para el SII

Instrumental de apoyo del taller de 32 horas sobre Git y GitLab dictado en
modalidad remota a funcionarios del Servicio de Impuestos Internos.

La pieza central es un **simulador visual de Git**: el participante escribe
ordenes en una consola simulada y ve como reacciona el grafo de confirmaciones.
Acompana las primeras cuatro sesiones del taller. De ahi en adelante las
tecnicas avanzadas se practican en la consola real.

El simulador es una **simulacion, no una implementacion de Git**. Modela las
confirmaciones, las ramas, el area de preparacion y el texto de los archivos
del recetario, que es lo que los laboratorios necesitan mostrar. Lo que no
modela es una instalacion de Git: los identificadores se generan con una huella
propia, no hay carpeta `.git` que abrir, no hay red ni submodulos, y lo que se
compromete a ejecutar son las ordenes de los enunciados.

---

## Si vas a participar en el taller, empieza acá

El taller se hace en una página del navegador. Escribes en su consola, eso corre con Git de verdad en tu equipo, y la página dibuja al lado la historia del repositorio y sus tres áreas. Para eso hace falta un programa que corre en tu equipo mientras trabajas. Viene dentro del curso y no se instala. Al borrar la carpeta del taller no queda nada.

Necesitas Git para Windows, con su Git Bash, que en los equipos del SII ya viene instalado. En Mac, las herramientas de línea de comandos de Apple.

### Instalar, en dos pasos

**Primero, crea la carpeta del taller y clona el curso adentro con el nombre `curso`.** Tiene que ser con `git clone`, no bajando un zip. Un zip bajado por el navegador queda marcado como venido de internet, y Windows y macOS no dejan ejecutar lo que viene marcado así.

No la crees dentro de una carpeta sincronizada con OneDrive, iCloud Drive, Dropbox o Google Drive. Esas carpetas suben y bajan los archivos de Git por su cuenta, corrompen el repositorio y hacen que el dibujo se mueva solo. En Windows sirve `C:\taller-git`. En Mac, una carpeta dentro de tu carpeta personal que no esté en Documentos ni en el Escritorio si los sincronizas con iCloud.

En Windows, abre Git Bash y escribe esto.

```
mkdir -p /c/taller-git
cd /c/taller-git
git clone https://github.com/RodrigoMSB/curso-git-gitlab-sii.git curso
```

En Mac, abre Terminal y escribe esto.

```
mkdir -p ~/taller-git
cd ~/taller-git
git clone https://github.com/RodrigoMSB/curso-git-gitlab-sii.git curso
```

**Segundo, haz doble clic en `curso/INSTALAR.cmd` en Windows, o en `curso/instalar.command` en Mac.** Deja en `taller-git` los archivos con que se arranca el taller. Se puede correr las veces que quieras. Si el clon no quedó en `taller-git/curso`, lo dice y no hace nada. Si el doble clic no abre nada, en Git Bash o en Terminal escribe `bash curso/instalar.command` desde `taller-git`.

Queda así.

```
taller-git/             la única carpeta que usas
  TALLER.cmd            doble clic en Windows
  taller.command        doble clic en Mac
  taller.sh             desde Git Bash, ./taller.sh
  preparar              preparar 02 arma el laboratorio 02
  verificar             verificar 02 lo comprueba
  comprobar.cmd         la comprobación del primer día, en Windows
  comprobar.sh          la comprobación del primer día, en Git Bash y Mac
  lab-01/recetario/     tu trabajo, un laboratorio por carpeta
  curso/                el clon del curso, que no necesitas abrir
```

### La comprobación del primer día

Antes de la primera sesión, haz doble clic en `comprobar.cmd`, o en Git Bash o Terminal escribe `./comprobar.sh` desde `taller-git`. Tarda menos de un minuto. Abre una página que dice que el navegador llegó, y en la ventana deja una tabla de ocho filas. Si todas dicen bien, el taller va a funcionar en tu equipo. Si alguna dice FALLA, la tabla dice qué hacer y queda guardada en `taller-git/.taller/comprobacion.txt` para mostrársela al relator.

### Arrancar el taller

Hay tres caminos, y los tres hacen lo mismo.

- En Windows, doble clic en `TALLER.cmd`.
- En Mac, doble clic en `taller.command`.
- Desde Git Bash o Terminal, parado en `taller-git`, escribe `./taller.sh`.

Se abre una ventana que dice que el taller está listo, con qué motor y en qué dirección, y se abre solo el navegador con la página. **No cierres esa ventana mientras trabajas.** Si la cierras, el taller termina y la página lo dice en una franja roja. Vuelve a abrirlo con el mismo doble clic. Si cierras la pestaña del navegador, vuelve con la dirección que muestra la ventana, y la consola sigue en la carpeta donde estaba.

**El motor.** El programa del taller tiene dos versiones que hacen lo mismo, una en Java y otra en Python. El arrancador prueba primero la de Java, que trae su propio Java dentro del curso, y si no arranca prueba la de Python, con el Python de tu equipo. La barra de la página dice cuál quedó, junto a MODO TALLER. Para ti no cambia nada.

**El aviso de respaldo.** Si ninguno de los dos motores arranca, la ventana lo dice y se abre `curso/SIMULADOR.html` en el modo de escenarios, que es el mismo simulador sin Git de verdad. Sirve para seguir la clase, pero avísale al relator y muéstrale la comprobación del primer día.

### Trabajar

La consola parte en `taller-git` y no sale de ahí hacia arriba. Cada laboratorio empieza con `preparar` y el número, desde cualquier carpeta, y la consola queda en la carpeta del laboratorio.

```
preparar 02
```

Y termina con `verificar`, que dice si quedó hecho.

```
verificar 02
```

Aceptan `2` y `02`, y sin número usan el laboratorio donde está la consola. Si el laboratorio ya estaba preparado, `preparar` avisa que prepararlo de nuevo borra tu trabajo, y solo lo hace si escribes `preparar 02 --forzar`. En Git Bash se escriben igual desde `taller-git`, con `./preparar 02`, y como allí un script no puede cambiar tu carpeta, te dice a cuál entrar.

Los archivos los editas en Visual Studio Code. Escribe `code .` en la consola, parado en el recetario, y se abre una ventana aparte solo con tu trabajo. Al guardar, el dibujo se actualiza solo en menos de un segundo.

Las órdenes que hacen preguntas por teclado, como `git add -p`, no se pueden contestar desde la página. La consola lo dice, y se hacen en Git Bash. `git push` y `git pull` contra un servidor que pide clave también van en Git Bash, por ahora.

### Si algo no funciona

**El doble clic no abre nada.** La política del equipo puede bloquear los archivos `.cmd`. Abre Git Bash en `taller-git` y escribe `./taller.sh`.

**La ventana se abre y se cierra.** Ábrelo desde Git Bash con `./taller.sh` para ver el mensaje. Si dice que no encontró Git, instala Git para Windows. Si usas un Git portable, define la variable `TALLER_GIT` con su carpeta.

**El navegador no carga la página.** Copia la dirección de la ventana en el navegador. Si tampoco carga, el proxy del equipo probablemente captura `127.0.0.1`. Pídele al soporte que lo excluya del proxy. La comprobación del primer día lo detecta en su fila 5.

**La consola tarda varios segundos en cada orden.** Suele ser el antivirus revisando cada proceso. La comprobación lo mide en su fila 6.

**Aparece el aviso de respaldo.** Mira en la ventana qué motor no arrancó y por qué, y muéstraselo al relator.

Al terminar el curso borras `taller-git` entero y no queda nada más en tu equipo.

### Para el relator

Los dos motores escuchan solo en `127.0.0.1`, con una clave nueva en cada arranque, y rechazan toda petición que no la traiga. No escriben nada fuera de `taller-git`, donde dejan la carpeta `.taller` con la carpeta en que quedó la consola y el resultado de la comprobación. No tocan la configuración global de Git. Lo que hacen lo cuentan en su ventana, no en archivos. Los dos responden la misma interfaz, descrita en `taller/INTERFAZ.md`, y el detalle de las decisiones está en las secciones 71 a 74 de `docs/arquitectura.md`.

### El simulador sin el taller

`SIMULADOR.html`, abierto con doble clic, es el simulador de escenarios de siempre, sin ningún programa. Cada enunciado dice con qué dirección abre su laboratorio, por ejemplo `SIMULADOR.html?lab=02`.

---

## Que hay en este repositorio

```
curso/
├── SIMULADOR.html      el simulador, listo para doble clic
├── INSTALAR.cmd        deja los arrancadores en taller-git, en Windows
├── instalar.command    lo mismo, en Mac y Git Bash
├── taller/             el programa local del modo taller
│   ├── java/           el motor de Java, con su runtime
│   ├── python/         el motor de Python
│   ├── raiz/           los envoltorios que INSTALAR copia a taller-git
│   └── INTERFAZ.md     lo que los dos motores le responden a la pagina
├── docs/
│   ├── specs/          los encargos, un archivo por etapa del proyecto
│   └── arquitectura.md versiones, empaquetado y decisiones de diseno
├── labs/               los laboratorios, uno por carpeta
├── simulador/          el codigo fuente del simulador
│   ├── src/core/       el motor: confirmaciones, ramas, punteros, ordenes
│   ├── src/escenarios/ los estados iniciales de cada sesion
│   ├── src/grafico/    el calculo de posiciones del grafo
│   ├── src/vista/      el modelo de vista entre el motor y la pantalla
│   ├── src/ui/         los componentes de la pantalla
│   ├── dist/           el simulador construido, versionado a proposito
│   └── tests/          las pruebas
├── semillas/           repositorios semilla, sin uso en el esquema actual
└── material/           presentaciones y guias (pendiente)
```

`SIMULADOR.html` es una copia exacta de `simulador/dist/index.html`. Esta en la
raiz para que el participante no tenga que buscarlo, y Git guarda las dos rutas
como un mismo objeto, asi que la copia no pesa nada.

`semillas/` quedo sin uso: los laboratorios arman su propio punto de partida.
Se conserva porque su contenido puede servir mas adelante.

---

# Para desarrollar el instrumental

Todo lo que sigue es para quien **modifica** el simulador o los laboratorios.
El participante no necesita nada de esto.

## Que hace falta

Solo **Node.js 22.12 o superior** (sirve tambien Node 20.19 o superior). Nada
mas: ni base de datos, ni servidor, ni permisos de administrador.

Para saber que version de Node hay instalada:

```bash
node --version
```

## Como construir el simulador

Desde la raiz del repositorio:

```bash
cd simulador
npm install
npm run build
```

`npm install` se ejecuta una sola vez, la primera. Descarga las dependencias
desde la red; es la unica parte del proceso que la necesita.

### Despues de tocar el simulador hay que reconstruir

El artefacto construido va versionado, asi que **cualquier cambio en el codigo
del simulador obliga a rehacerlo y confirmarlo**:

```bash
cd simulador
npm run build
```

Esa orden hace tres cosas: construye `dist/index.html`, copia el resultado a
`SIMULADOR.html` en la raiz y anota las huellas en `dist/manifiesto.txt`.

Si se te olvida, la suite falla y te dice que correr. Tambien puedes
comprobarlo suelto:

```bash
npm run comprobar
```

### Donde queda el archivo resultante

```
simulador/dist/index.html    el artefacto, versionado en el repositorio
SIMULADOR.html               copia exacta en la raiz, por donde entra el participante
```

Es **un unico archivo**, de alrededor de 260 KB, con el codigo y los estilos
adentro. Para usarlo basta hacer **doble clic** sobre el: se abre en el
navegador y funciona sin conexion a internet y sin levantar ningun servidor.
Se puede copiar a un pendrive, mandarlo por correo o dejarlo en una carpeta
compartida, y sigue funcionando igual.

Los dos van confirmados en el repositorio, contra la costumbre de no versionar
lo que se construye. Es a proposito y la razon esta en la seccion 22 de
[`docs/arquitectura.md`](docs/arquitectura.md): el participante clona y abre, y
no hay ninguna maquina del SII donde haya que instalar Node para eso.

La construccion se detiene con un error si el archivo llegara a quedar
apuntando a algun recurso externo, de modo que si `npm run build` termina bien,
el archivo es autocontenido.

## Como probar

```bash
cd simulador
npm test
```

Ejecuta las pruebas y mide la cobertura del motor, de los escenarios, del
calculo de posiciones y del modelo de vista. La orden falla si la cobertura de
lineas baja del 90 por ciento, que es el minimo que fija el SPEC 001.

Estado actual: 551 pruebas de unidad e integracion, mas 48 de punta a punta
contra el navegador. 94 por ciento de cobertura de lineas. Las de las
semillas y las de los laboratorios ejecutan Git de verdad y se llevan la mayor
parte del minuto que tarda la suite.

## Como probar de punta a punta

Las pruebas de arriba miran el modelo. Estas miran otra cosa: **recorren cada
laboratorio dos veces en paralelo**, una en el simulador escribiendo en su
consola y otra en un repositorio de Git real, y comparan los dos estados
despues de cada orden.

```bash
cd simulador
npm run e2e
```

Construye el artefacto y lo prueba en un navegador de verdad, recorriendo los
cinco laboratorios que tienen preparacion. Toma alrededor de cinco minutos. Con
`npm run e2e:abrir` se abre la ventana de Cypress, que sirve para mirar paso a
paso por que algo no calza.

Lo que se compara no es solo el modelo: se mide con el navegador lo que el grafo
**pinta** despues de cada orden, y si lo que Git cambio es de lo que el grafo
dibuja, el dibujo tiene que haber cambiado. La razon esta en la seccion 37 de
[`docs/arquitectura.md`](docs/arquitectura.md).

De paso guarda una captura de la pantalla completa despues de cada orden, unas
doscientas ochenta, en `docs/capturas-recorrido/`, junto con un informe por
laboratorio de que pieza de la pantalla se movio en cada paso. Esa carpeta no va
al repositorio: se rehace cuando haga falta.

Si el simulador le enseña al participante algo distinto de lo que va a ver en su
terminal, estas pruebas fallan y dicen en que orden ocurrio, que mostro cada
lado y en que linea del enunciado esta esa orden.

Las ordenes salen del enunciado de cada laboratorio, no de una lista escrita
aparte: si alguien corrige un paso del enunciado, la prueba corre el paso
corregido. **La direccion con que se abre el simulador tambien sale del
enunciado**, por la misma razon: mientras el arnes la escribia a mano, ningun
enunciado decia en que escenario abrirlo y nadie se enteraba.

Cypress es herramienta de desarrollo. El participante nunca la necesita.

Otras ordenes utiles:

```bash
npm run comprobar       # dice si el simulador construido quedo viejo
npm run test:observar   # repite las pruebas cada vez que se guarda un archivo
npm run tipos           # revisa los tipos sin construir
npm run lint            # pasa el linter sobre el codigo y las pruebas
npm run capturas        # rehace las capturas de docs/capturas desde el navegador
npm run dev             # levanta el simulador con recarga en caliente
```

`npm run dev` es solo para desarrollar. Lo que se entrega a la sala de clases
es siempre el archivo de `dist`.

## Que se ve en pantalla

Hay capturas de la pantalla real en [`docs/capturas`](docs/capturas), sobre los
escenarios de los laboratorios 01, 02, 05 y 07, incluyendo la previsualizacion de una fusion y el
resultado de un rebase. Se rehacen con `npm run capturas` despues de construir,
de modo que se pueden actualizar cada vez que la vista cambie.

La pantalla tiene cinco zonas:

1. **Barra de estado**, arriba: repositorio, rama actual, cambios sin
   confirmar, selector de escenario, los interruptores de previsualizacion y
   modo relator, y al extremo derecho el boton de tema, con sol y luna.
2. **Consola**, a la izquierda y de arriba abajo: se escribe la orden y se ve
   la respuesta, con el aspecto y los colores de Git Bash. Entre la consola y
   el grafo hay una barrita que se arrastra para repartir el ancho.
3. **Grafo**, a la derecha: las confirmaciones mas recientes arriba y las ramas
   desplegandose hacia la derecha.
4. **Areas**, abajo: directorio de trabajo, area de preparacion y repositorio
   local. El remoto no esta: se enseña en GitLab. Debajo aparecen, solo cuando corresponde, la pila
   de guardado temporal, las diferencias y los objetos internos.
5. **Linea de tiempo**, al pie: un segmento por orden ejecutada. Se puede
   retroceder y toda la pantalla vuelve a como estaba en ese momento.

### Como se usa

| Tecla o gesto | Que hace |
|---|---|
| Flechas arriba y abajo | Recorre las ordenes ya escritas |
| Tabulacion | Completa la orden. Con el campo vacio, saca el foco de la consola |
| Entrar | Ejecuta la orden |
| Escape | Descarta lo escrito y la previsualizacion |
| Clic sobre una confirmacion | Abre sus objetos internos |
| Flechas izquierda y derecha sobre la linea de tiempo | Retrocede y avanza |

Toda la interfaz se maneja con el teclado.

**Previsualizacion.** Con el interruptor encendido, mientras se escribe una
orden que crearia confirmaciones, el grafo las dibuja en trazo discontinuo
antes de ejecutarlas. Entrar ejecuta, Escape descarta.

**Modo relator.** Aumenta el tamano de todo de forma proporcional y esconde los
paneles secundarios, para proyectar por videoconferencia.

Las confirmaciones que quedan sin ninguna rama ni etiqueta apuntandolas no
desaparecen: siguen dibujadas en gris. Es lo que permite mostrar que un
`git reset --hard` o un `git rebase` no destruyen nada, y que `git reflog` las
recupera.

## Los escenarios, uno por laboratorio

El caso es un recetario de comida chilena. **El simulador muestra el mismo
repositorio que el participante tiene en su terminal**: las mismas
confirmaciones, las mismas ramas y el mismo estado de los archivos. Cada
laboratorio tiene su escenario.

| Escenario | Sesion | Con que se encuentra el participante |
|---|---|---|
| Lab 01 | 1 | Sin repositorio todavia, con los archivos del recetario sin seguimiento |
| Lab 02 | 2 | Cinco confirmaciones de tres autores, un cambio sin preparar y otro preparado por error |
| Lab 03 | 3 | Cinco confirmaciones, con tres archivos que nunca debieron entrar al historial |
| Lab 04 | 3 | Seis confirmaciones en `main`, cada una tocando un archivo distinto |
| Lab 05 | 4 | Los cuatro casos de fusion: `tailandesa` avanza rapido, `azteca` une sin chocar, `criolla` toca el mismo archivo que main y se fusiona sola, y `andina` choca sobre la misma linea |
| Lab 06 | 4 | Siete confirmaciones, con un error tres confirmaciones atras |
| Lab 07 | 5 | Rama de trabajo con mensajes que no dicen nada y algo a medias encima |
| Lab 08 | 5 | *sin escenario*: de terminal pura, por los remotos y el gancho |
| Lab 09 | 6 | Ocho confirmaciones, archivo de exclusiones y una version etiquetada |

El laboratorio 08 no lleva escenario: enseña dos remotos y un gancho, y el
motor no implementa ninguna de las dos cosas. Es de terminal pura. Los del
10 en adelante ocurren en la plataforma o en la tuberia de integracion, y no
tienen repositorio local que reflejar.

La numeracion es la del SPEC 009, que dejo el taller en catorce laboratorios: el
antiguo 03, que abria la carpeta oculta, paso a ser la parte 4 del 02, y del
antiguo 04 en adelante cada uno bajo un numero.

Para abrir el simulador directo en un escenario, se le pide en la direccion:

```
SIMULADOR.html?lab=05
```

Sirve tambien `#lab-05`. Sin nada, abre el laboratorio 01. El selector de la
barra permite cambiar de escenario en cualquier momento.

## Como esta hecho por dentro

El motor esta separado de la interfaz a proposito: es codigo puro, sin React y
sin acceso al navegador, lo que permite probarlo de forma automatizada y
cambiar la capa visual sin tocar la logica. El detalle esta en
[`docs/arquitectura.md`](docs/arquitectura.md), junto con las versiones
elegidas y las decisiones de diseno.

Los encargos de cada etapa quedan sin modificar en
[`docs/specs`](docs/specs), para que el historial del repositorio muestre
contra que se implemento cada cambio.
