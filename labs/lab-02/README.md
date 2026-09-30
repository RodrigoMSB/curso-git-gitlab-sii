# Laboratorio 02 · Leer la historia y deshacer

**Sesión 2 · 95 minutos**

---

## Qué vas a hacer

Dos cosas que en el trabajo van juntas.

Primero leer un historial que no escribiste tú y ver qué cambió. Después arreglar lo que encuentres mal, sin perder lo que sí sirve.

El repositorio con el que vas a trabajar no es el tuyo. Tiene cinco confirmaciones hechas por tres personas distintas y trae problemas plantados a propósito.

Todo lo que está antes de la comprobación es obligatorio y se hace en orden. Cada paso deja el repositorio listo para el siguiente. La sección del final, **Para ir más allá**, es opcional.

---

## Preparación

Tu trabajo va en la carpeta del taller, `taller-git`, fuera del clon del curso. Escribe esto en la consola del taller, desde cualquier carpeta.

```
preparar 02
```

La consola arma el escenario, comprueba que quedó bien y queda parada en `lab-02/recetario`, dentro de `taller-git`, que es donde vas a trabajar.

Mira dónde estás parado.

```
git lg
git status
```

Cinco confirmaciones. Un archivo modificado sin preparar y otro preparado. Toma nota de cuáles son, los vas a necesitar en la parte 3.

### El taller ya está abierto

Todo este laboratorio se escribe en la consola del taller, la página que se abrió con `TALLER.cmd` o con `taller.command`, en la carpeta `taller-git`. El grafo y las tres áreas muestran tu repositorio de verdad mientras trabajas.

Si trabajas sin el programa del taller, el simulador de escenarios abre este laboratorio con la dirección `SIMULADOR.html?lab=02`, sin Git de verdad.

---

## Parte 1 · Leer la historia

**Tiempo sugerido, 20 minutos.**

### 1.1 Las tres formas de mirar

```
git log
git log --oneline
git log -p
```

La primera trae todo, autor, fecha y mensaje completo. La segunda es una línea por confirmación. La tercera agrega, debajo de cada confirmación, las líneas que cambió.

Usa la primera cuando investigas, la segunda cuando solo quieres ubicarte y la tercera cuando necesitas saber qué se tocó.

---

## Parte 2 · Ver lo que cambió

**Tiempo sugerido, 20 minutos.**

### 2.1 Lo que no está preparado

```
git diff
```

Muestra la diferencia entre tu directorio de trabajo y lo último preparado. Las líneas con menos salen, las líneas con más entran.

### 2.2 Lo que sí está preparado

```
git diff --staged
```

Muestra lo que se llevaría una confirmación hecha ahora mismo.

Estas dos órdenes muestran cosas distintas y ese es todo el punto. La primera te dice qué te falta preparar. La segunda te dice qué estás a punto de confirmar.

### 2.3 Lo mismo en Visual Studio Code

Abre la carpeta del recetario en Visual Studio Code.

```
code .
```

En la barra de la izquierda, entra a la vista de control de código fuente, el ícono con tres puntos unidos por líneas. Arriba aparecen los cambios preparados y abajo los que no lo están, los mismos dos archivos que viste con `git status`. Haz clic en cada uno y Visual Studio Code te muestra, lado a lado, lo mismo que te mostraron `git diff` y `git diff --staged`.

Mira y no toques nada todavía. Los cambios se arreglan en la parte 3, desde la consola.

---

## Parte 3 · Deshacer

**Tiempo sugerido, 30 minutos.**

Acá están los tres problemas plantados. Resuélvelos en orden.

### 3.1 El cambio que no querías

Hay un archivo modificado en tu directorio de trabajo con un cambio que no sirve. Míralo primero.

```
git diff
```

Confirma que efectivamente no lo quieres, porque lo que viene no tiene vuelta atrás.

**ATENCIÓN. La orden siguiente descarta el cambio de forma permanente. Ese contenido no está en ninguna confirmación, así que no hay manera de recuperarlo. Asegúrate de haber mirado el diff antes de ejecutarla.**

```
git restore <archivo>
git status
```

El archivo volvió al estado de la última confirmación. El cambio se perdió.

### 3.2 El archivo preparado por error

Hay un archivo en el área de preparación que no debería estar ahí.

```
git status
git diff --staged
```

Sácalo de la preparación sin perder el cambio.

```
git restore --staged <archivo>
git status
```

Ahora aparece como modificado y sin preparar. El contenido sigue intacto, solo dejó de estar en la fila para la próxima confirmación.

Fíjate en la diferencia con el paso anterior. La misma orden con `--staged` y sin `--staged` hace cosas muy distintas. Una devuelve el archivo desde el área de preparación al directorio de trabajo. La otra descarta el trabajo.

### 3.3 El mensaje mal escrito

Mira el mensaje de la última confirmación.

```
git log -1
```

Está mal escrito. Arréglalo con un mensaje que siga la convención del taller, el archivo, dos puntos y lo que se hizo.

```
git commit --amend -m "recetas/pastel-de-choclo.md: se documenta la receta"
```

Ahora compara.

```
git log -1
git lg
```

El mensaje cambió. Pero fíjate en algo más, **el identificador también cambió**. No corregiste la confirmación, la reemplazaste por una nueva.

`--amend` sirve para arreglar lo último que hiciste, siempre que todavía no lo hayas compartido con nadie.

### 3.4 Lo mismo en dos pasos

Ahora vas a deshacer la última confirmación conservando sus archivos, y a hacerla de nuevo.

```
git reset --soft HEAD~1
git status
```

Lee lo que pasó. La confirmación desapareció del historial, pero sus cambios están todos en el área de preparación, listos para volver a confirmarse.

Vuelve a confirmarlos con el mismo mensaje.

```
git commit -m "recetas/pastel-de-choclo.md: se documenta la receta"
git lg
```

Llegaste al mismo lugar que con `--amend`, pero en dos pasos y viendo el intermedio. Por eso, para corregir la última confirmación, es mejor `--amend`. Hace lo mismo en una sola orden y no te deja a medio camino.

---

## Comprobación

```
git log --oneline
git status
```

Cinco confirmaciones, la última con el mensaje corregido. Nada en el área de preparación. El archivo del punto 3.2 aparece como modificado.

Y que el verificador lo confirme. Escríbelo en la consola, desde cualquier carpeta.

```
verificar 02
```

Imprime una línea por criterio. Si alguno falla, dice qué esperaba y qué encontró.

---

## Para ir más allá

Esta sección es opcional. El verificador no la revisa y ningún laboratorio siguiente la necesita.

### A. Limitar y filtrar la historia

```
git log -3
git log --oneline -3
```

Sirve más de lo que parece. En un repositorio real con miles de confirmaciones, `git log` sin límite te tira encima la historia completa.

Mira quiénes trabajaron acá.

```
git log --format="%an"
```

Ahora filtra por uno de ellos. El filtro es por coincidencia parcial, no necesitas el nombre completo.

```
git log --author="Juana" --oneline
```

Qué le pasó a un archivo en particular.

```
git log --oneline -- platos.md
```

Los dos guiones separan las opciones de los nombres de archivo. Sin ellos, si existiera una rama llamada igual que el archivo, Git no sabría a cuál te refieres.

Y un formato a tu medida.

```
git log --format="%h %an %ad %s" --date=short
```

Cada símbolo es un dato. El identificador corto, el autor, la fecha y el mensaje. Si un formato lo vas a repetir, conviértelo en alias como hiciste en el laboratorio anterior.

### B. La confirmación reemplazada sigue ahí

En el punto 3.3 el identificador cambió. La confirmación original, la del mensaje mal escrito, no se borró. Quedó sin nadie apuntándola. Su identificador corto era `de04dc1`.

```
git show de04dc1
```

Ahí está, con su mensaje mal escrito y sus cambios. Git la guarda un tiempo aunque ninguna rama la alcance, y en el laboratorio 06 vas a ver cómo se rescata algo así.

### C. Abrir la caja

Vas a mirar de qué está hecho todo esto. Cuando termines vas a saber que una rama son cuarenta y un bytes de texto en un archivo, y eso hace que el resto del taller deje de ser magia.

```
ls -a
ls .git
```

Hay bastante. Estos son los tres que importan. **HEAD**, un archivo que dice dónde estás parado. **refs**, donde viven las ramas y las etiquetas. **config**, la configuración de este repositorio en particular.

```
cat .git/HEAD
```

Una línea. Dice que apuntas a una rama, y cuál. No dice a qué confirmación, dice a qué **rama**. Esa distinción es la que hace que cambiar de rama sea instantáneo.

```
ls .git/refs/heads
cat .git/refs/heads/main
wc -c .git/refs/heads/main
```

Un identificador de confirmación y un salto de línea. Cuarenta y un bytes, cuarenta caracteres del identificador y el salto de línea. **Eso es una rama.** No es una copia del proyecto, no es una carpeta, no es un espacio de trabajo.

```
git log --oneline -1
```

El identificador corto que muestra Git son los primeros caracteres del que acabas de leer en el archivo.

Crea una rama y mira qué pasó.

```
ls .git/refs/heads
git branch prueba
ls .git/refs/heads
cat .git/refs/heads/prueba
cat .git/refs/heads/main
```

Apareció un archivo nuevo con el mismo identificador adentro. Eso es todo lo que hizo crear una rama. Ningún archivo de tu proyecto se tocó.

```
cat .git/HEAD
git switch prueba
cat .git/HEAD
```

Cambió una línea en un archivo. Las dos ramas siguen apuntando a lo mismo, tu proyecto no cambió, y lo único distinto es dónde dice que estás parado.

Vuelve y limpia.

```
git switch main
git branch -d prueba
ls .git/refs/heads
```

El archivo desapareció. Eso es borrar una rama.

Escribe en una línea, con tus palabras, qué es una rama. Si tu respuesta usa las palabras copia, carpeta o espacio de trabajo, vuelve a mirar `.git/refs/heads/main`.

---

## Si algo salió mal

**Borraste algo con `git restore` que sí necesitabas.** No hay rescate. Ese contenido nunca estuvo en una confirmación. Escribe `preparar 02 --forzar` en la consola, que borra todo tu trabajo en este laboratorio, sin vuelta atrás, y repite desde la parte 3.

**Hiciste `reset` de más y perdiste confirmaciones.** Sí hay rescate y se ve completo en el laboratorio 06. Por ahora prepara el escenario de nuevo.

**Editaste un archivo dentro de `.git` a mano.** Prepara el escenario otra vez. Editar ahí a mano es la única forma real de dañar un repositorio.

**El historial te quedó irreconocible.** Escribe `preparar 02 --forzar` en la consola. Borra todo tu trabajo en este laboratorio, sin vuelta atrás, y deja el escenario como al principio. El escenario siempre entrega el mismo estado inicial.

---

## Lo que te llevas

`git log`, `git log --oneline` y `git log -p` son tres formas de leer la misma historia, de la más completa a la que muestra los cambios.

`git diff` te dice qué te falta preparar y `git diff --staged` qué estás a punto de confirmar.

`git restore` con `--staged` y sin `--staged` son operaciones distintas. Una es reversible y la otra no.

Corregir la última confirmación no la corrige, la reemplaza por otra con identificador distinto. `--amend` lo hace en una orden y `git reset --soft` seguido de `git commit` lo hace en dos. Para eso, mejor `--amend`.
