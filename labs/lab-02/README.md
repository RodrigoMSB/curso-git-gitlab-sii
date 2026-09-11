# Laboratorio 02 · Leer la historia y abrir la caja

**Sesión 2 · 95 minutos**

---

## Qué vas a hacer

Tres cosas que en el trabajo van juntas.

Primero aprender a encontrar algo en un historial que no escribiste tú. Después arreglar lo que encuentres mal. Y al final abrir la carpeta oculta para ver de qué está hecho todo esto.

El repositorio con el que vas a trabajar no es el tuyo. Tiene cinco confirmaciones hechas por tres personas distintas y trae problemas plantados a propósito.

---

## Preparación

Desde la carpeta del laboratorio.

```
./preparar.sh
cd ../../../taller-git-trabajo/lab-02/recetario
```

El script arma el escenario y verifica que quedó bien antes de devolverte el control.

Confirma dónde estás parado.

```
git log --oneline
git status
```

Cinco confirmaciones. Un archivo modificado sin preparar y otro preparado. Toma nota de cuáles son, los vas a necesitar en la parte 3.

### Abre el simulador en el escenario de este laboratorio

El simulador **no adivina en qué laboratorio estás**. Abierto con doble clic parte siempre en el escenario del laboratorio 01, donde todavía no hay repositorio: ahí las órdenes de este laboratorio responden `fatal: not a git repository` y el grafo no dibuja nada, por mucho que escribas.

Llévalo al escenario de este laboratorio, que es **Lab 02 · Leer la historia y abrir la caja**, de cualquiera de estas dos formas.

- En la barra de arriba del simulador, abre el selector que dice **escenario** y elige `Lab 02`.
- O abre el archivo con la dirección `SIMULADOR.html?lab=02`, pegándola en la barra de direcciones del navegador.

Comprueba que quedaste donde corresponde antes de seguir: la barra de arriba tiene que decir `Lab 02`, y el grafo tiene que mostrar las mismas confirmaciones que acabas de ver en tu terminal.

---

## Parte 1 · Leer la historia

**Tiempo sugerido, 30 minutos.**

### 1.1 Las tres formas de mirar

```
git log
git log --oneline
git lg
```

La primera trae todo, autor, fecha y mensaje completo. La segunda es una línea por confirmación. La tercera es tu alias, que además dibuja el grafo.

Usa la primera cuando investigas y la segunda cuando solo quieres ubicarte.

### 1.2 Limitar la cantidad

```
git log -3
git log --oneline -3
```

Sirve más de lo que parece. En un repositorio real con miles de confirmaciones, `git log` sin límite te tira encima la historia completa.

Cuando la salida ocupe más de una pantalla, Git te la muestra por partes. Se avanza con la barra espaciadora y se sale con la tecla `q`. Esa `q` es la que nadie te dice y la que te deja pegado la primera vez.

### 1.3 Filtrar por autor

Mira quiénes trabajaron acá.

```
git log --format="%an"
```

Ahora filtra por uno de ellos, reemplazando el nombre por uno de los que apareció.

```
git log --author="Juana" --oneline
```

El filtro es por coincidencia parcial, no necesitas el nombre completo.

### 1.4 Filtrar por archivo

Qué le pasó a un archivo en particular.

```
git log --oneline -- platos.md
```

Los dos guiones separan las opciones de los nombres de archivo. Sin ellos, si existiera una rama llamada igual que el archivo, Git no sabría a cuál te refieres.

### 1.5 Formato a tu medida

```
git log --format="%h %an %ad %s" --date=short
```

Cada símbolo es un dato. El identificador corto, el autor, la fecha y el mensaje. Hay muchos más, pero con estos cuatro resuelves casi todo.

Si un formato lo vas a repetir, conviértelo en alias como hiciste en el laboratorio anterior.

---

## Parte 2 · Ver lo que cambió

**Tiempo sugerido, 15 minutos.**

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

---

## Parte 3 · Volver atrás

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

Está mal escrito. Arréglalo.

```
git commit --amend -m "se corrige la receta del pastel de choclo"
```

Ahora compara.

```
git log -1
git lg
```

El mensaje cambió. Pero fíjate en algo más, **el identificador también cambió**. No corregiste la confirmación, la reemplazaste por una nueva. La original quedó ahí, sin nadie apuntándola.

Eso importa y lo vas a ver de nuevo en la sesión 5. Por ahora quédate con la regla. `--amend` sirve para arreglar lo último que hiciste, siempre que todavía no lo hayas compartido con nadie.

### 3.4 Retroceder una confirmación

Ahora vas a deshacer una confirmación completa conservando los archivos.

```
git log --oneline
git reset --soft HEAD~1
git status
git log --oneline
```

Lee lo que pasó. La confirmación desapareció del historial, pero sus cambios están todos en el área de preparación, listos para volver a confirmarse.

Vuelve a confirmarlos con un mensaje mejor.

```
git commit -m "se documenta la receta del pastel de choclo"
```

Esto es lo mismo que hizo `--amend`, pero en dos pasos y viendo el intermedio. Los tres modos de retroceso se ven completos en el laboratorio 06.

---

## Parte 4 · Abrir la caja

**Tiempo sugerido, 20 minutos.**

Ahora que tienes confirmaciones propias que inspeccionar, vas a mirar de qué está hecho todo esto.

No es curiosidad. Cuando termines vas a saber que una rama son cuarenta y un bytes de texto en un archivo, y eso hace que el resto del taller deje de ser magia.

### 4.1 Qué hay adentro

```
ls -a
ls .git
```

Hay bastante. La mayoría no te interesa hoy. Estos son los tres que importan.

**HEAD**, un archivo que dice dónde estás parado.
**refs**, donde viven las ramas y las etiquetas.
**config**, la configuración de este repositorio en particular.

### 4.2 El archivo que dice dónde estás

```
cat .git/HEAD
```

Una línea. Dice que apuntas a una rama, y cuál.

No dice a qué confirmación. Dice a qué **rama**. Esa distinción es la que hace que cambiar de rama sea instantáneo.

### 4.3 La rama por dentro

```
ls .git/refs/heads
cat .git/refs/heads/main
```

Un identificador de confirmación y un salto de línea. Nada más.

Mide el archivo.

```
wc -c .git/refs/heads/main
```

Cuarenta y un bytes. Cuarenta caracteres del identificador y el salto de línea.

**Eso es una rama.** No es una copia del proyecto, no es una carpeta, no es un espacio de trabajo. Es un archivo de texto con un identificador adentro.

### 4.4 Compruébalo

```
git log --oneline -1
```

El identificador corto que muestra Git son los primeros caracteres del que acabas de leer en el archivo.

### 4.5 Crea una rama y mira qué pasó

```
ls .git/refs/heads
git branch prueba
ls .git/refs/heads
cat .git/refs/heads/prueba
cat .git/refs/heads/main
```

Apareció un archivo nuevo con el mismo identificador adentro. Eso es todo lo que hizo crear una rama. Ningún archivo de tu proyecto se tocó.

### 4.6 Cambia de rama y mira qué se movió

```
cat .git/HEAD
git switch prueba
cat .git/HEAD
```

Cambió una línea en un archivo. Las dos ramas siguen apuntando a lo mismo, tu proyecto no cambió, y lo único distinto es dónde dice que estás parado.

### 4.7 Vuelve y limpia

```
git switch main
git branch -d prueba
ls .git/refs/heads
```

El archivo desapareció. Eso es borrar una rama.

### 4.8 La pregunta

Escribe en una línea, con tus palabras, qué es una rama.

Si tu respuesta usa las palabras copia, carpeta o espacio de trabajo, vuelve al punto 4.3.

---

## Comprobación

```
git log --oneline
```

Cinco confirmaciones, ninguna con el mensaje mal escrito original.

```
git status
```

Nada en el área de preparación. El archivo del punto 3.2 aparece como modificado.

```
ls .git/refs/heads
```

Solo `main`.

```
cat .git/HEAD
```

Debe apuntar a `main`.

---

## Si algo salió mal

**Borraste algo con `git restore` que sí necesitabas.** No hay rescate. Ese contenido nunca estuvo en una confirmación. Vuelve a ejecutar `preparar.sh` y repite desde la parte 3.

**Hiciste `reset` de más y perdiste confirmaciones.** Sí hay rescate y se ve completo en el laboratorio 06. Por ahora prepara el escenario de nuevo.

**Editaste un archivo dentro de `.git` a mano.** Prepara el escenario otra vez. Editar ahí a mano es la única forma real de dañar un repositorio.

**El historial te quedó irreconocible.** Vuelve a ejecutar `preparar.sh`. El escenario siempre entrega el mismo estado inicial.

---

## Lo que te llevas

Encontrar algo en un historial ajeno es una habilidad aparte, y se resuelve con dos filtros. Por autor y por archivo.

Corregir la última confirmación no la corrige. La reemplaza por otra con identificador distinto. Mientras nadie más la haya visto, da lo mismo. Cuando ya la compartiste, deja de dar lo mismo.

`git restore` con `--staged` y sin `--staged` son operaciones distintas. Una es reversible y la otra no.

Y una rama es un archivo de texto con un identificador adentro. Crear una rama no mueve nada. Cambiar de rama modifica una línea. Nada de esto es magia, es texto en archivos y lo acabas de leer con tus propios ojos.
