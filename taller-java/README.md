# Modo taller

El modo taller es el simulador con Git de verdad. Escribes en la consola de la página, eso corre con Git en tu carpeta de trabajo, y el grafo y las tres áreas se dibujan con lo que Git dice. Todo en una sola ventana.

Para eso hace falta un programa que corre en tu equipo mientras trabajas. Viene dentro del clon del curso, con su propio Java, y no se instala. Al borrar el clon no queda nada.

## Antes del primer día

Clona el curso con `git clone`, no lo bajes como zip. Un zip bajado por el navegador queda marcado como venido de internet, y Windows y macOS no dejan ejecutar lo que viene marcado así.

Clónalo en una carpeta que no se sincronice con la nube. OneDrive, iCloud Drive, Dropbox y Google Drive suben y bajan los archivos de `.git` por su cuenta, corrompen el repositorio y hacen que el dibujo se mueva solo. En Windows sirve `C:\taller`, en Mac una carpeta dentro de tu carpeta personal que no esté en Documentos ni en el Escritorio si los tienes sincronizados con iCloud.

Después corre la comprobación, una sola vez.

- En Windows, doble clic en `comprobar-java.cmd`.
- En Mac, abre Terminal en la carpeta del clon y escribe `./comprobar-java.sh`.
- Si en Windows el doble clic no abre nada, abre Git Bash en la carpeta del clon y escribe `./comprobar-java.sh`.

Tarda menos de un minuto. Abre una página que dice que el navegador llegó, y en la ventana deja una tabla con ocho filas. Si todas dicen bien, el taller va a funcionar en tu equipo. Si alguna dice FALLA, la tabla dice qué hacer y queda guardada en `taller-git-trabajo/.taller/comprobacion.txt` para mostrársela al relator.

## Arrancar el taller

Hay tres caminos y los tres hacen lo mismo.

- En Windows, doble clic en `TALLER-JAVA.cmd`, en la carpeta del clon.
- En Mac, doble clic en `taller-java.command`, en la carpeta del clon.
- Desde Git Bash o desde Terminal, parado en la carpeta del clon.

```
./taller-java.sh
```

Se abre una ventana que dice en tres líneas que el taller está listo, en qué dirección está y que no la cierres. Se abre solo tu navegador con la página.

**No cierres esa ventana mientras trabajas.** Si la cierras, el taller termina y la página lo dice en una franja roja. Vuelve a abrirlo con el mismo doble clic.

Si cierras la pestaña del navegador, vuelve con la dirección que muestra la ventana. La consola sigue en la carpeta donde estaba.

## Trabajar

La consola parte en `taller-git-trabajo`, la carpeta hermana del clon. Los enunciados te piden pararte en la raíz del clon, así que tu primera orden es esta.

```
cd ../curso-git-gitlab-sii
```

Desde ahí sigues el enunciado tal cual, escribiendo todo en la consola de la página. Las órdenes de Git, `cd`, `ls`, `cat`, `echo`, `mkdir`, las redirecciones y los `preparar.sh` de cada laboratorio corren igual que en Git Bash.

La consola no sale de la carpeta que contiene al clon y a `taller-git-trabajo`. Un `cd` más arriba se rechaza y lo dice.

Los archivos los editas en Visual Studio Code, como siempre. Al guardar, el dibujo se actualiza solo en menos de un segundo.

Cuando Git necesita un editor, en `git commit` sin `-m`, en una fusión o en un rebase interactivo, se abre Visual Studio Code si lo configuraste en el laboratorio 01. La consola espera hasta que cierres la pestaña. Si Visual Studio Code no se abre, la consola dice cómo dejarlo disponible, y mientras tanto `git commit -m "mensaje"` no necesita editor.

Las órdenes que hacen preguntas por teclado, como `git add -p`, no se pueden contestar desde la página. La consola lo dice, y se hacen en Git Bash.

`git push` y `git pull` contra un servidor que pide clave se hacen en Git Bash por ahora.

## Si algo no funciona

**El doble clic no abre nada.** La política del equipo puede bloquear los archivos `.cmd`. Abre Git Bash en la carpeta del clon y escribe `./taller-java.sh`.

**La ventana se abre y se cierra.** Ábrelo desde Git Bash con `./taller-java.sh` para ver el mensaje. Si dice que no encontró Git, instala Git para Windows. Si usas un Git portable, define la variable `TALLER_GIT` con su carpeta.

**El navegador no carga la página.** Copia la dirección de la ventana en el navegador. Si tampoco carga, el proxy del equipo probablemente está capturando `127.0.0.1`. Pídele al soporte que excluya `127.0.0.1` del proxy. La comprobación del primer día lo detecta en su fila 5.

**La consola tarda varios segundos en cada orden.** Suele ser el antivirus revisando cada proceso. La comprobación mide cuánto tarda una orden en su fila 6.

**Mac con procesador Intel.** El taller trae Java solo para Mac con chip de Apple y para Windows. En un Mac Intel usa el Java del sistema si es 21 o superior, y si no lo hay lo dice.

## Para el relator

El programa escucha solo en `127.0.0.1`, con una clave nueva en cada arranque, y rechaza toda petición que no la traiga. No escribe nada fuera de `taller-git-trabajo`, donde deja la carpeta `.taller` con la carpeta en que quedó la consola y el resultado de la comprobación. No toca la configuración global de Git. Lo que hace lo cuenta en su ventana, no en archivos.

La ventana muestra cada orden que se escribe. Si un participante tiene un problema, lo que ahí se ve junto con `comprobacion.txt` suele alcanzar para entenderlo.

El programa es `taller.jar`, construido desde `fuente/` con Maven. Los runtimes de `jre/` se generan con `fuente/generar-runtimes.sh`, que fija la versión de Eclipse Temurin y sus sumas. El detalle de las decisiones está en la sección 71 de `docs/arquitectura.md`.
