# Laboratorio 02 · Leer la historia y volver atrás

**Sesión 2 · 95 minutos · repositorio semilla lab-02**

---

## Qué vas a hacer

Dos cosas que en el trabajo van siempre juntas. Primero aprender a encontrar algo en un historial que no escribiste tú, y después arreglar lo que encuentres mal.

El repositorio con el que vas a trabajar no es el tuyo. Tiene cinco confirmaciones hechas por tres personas distintas, en fechas distintas, y trae problemas plantados a propósito. Tu tarea es encontrarlos y repararlos.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-02/preparar.sh
cd ../taller-git-trabajo/lab-02/recetario
```

El script arma el escenario, deja el directorio de trabajo como corresponde y verifica que todo quedó bien antes de devolverte el control. Si algo falla, se detiene y te dice qué encontró.

Confirma dónde estás parado.

```
git log --oneline
git status
```

Cinco confirmaciones. Un archivo modificado sin preparar y otro preparado. Toma nota de cuáles son, los vas a necesitar en la parte 3.

---

## Parte 1 · Leer la historia

**Tiempo sugerido, 40 minutos.**

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

### 1.4 Filtrar por fecha

```
git log --since="2024-01-01" --oneline
git log --until="2024-06-30" --oneline
```

Y las dos juntas para acotar un rango.

```
git log --since="2024-01-01" --until="2024-06-30" --oneline
```

Prueba con fechas que dejen fuera algunas confirmaciones. Si te devuelve todo o nada, ajusta el rango mirando las fechas reales del historial.

### 1.5 Filtrar por archivo

Qué le pasó a un archivo en particular.

```
git log --oneline -- platos.md
```

Los dos guiones separan las opciones de los nombres de archivo. Sin ellos, si existiera una rama llamada igual que el archivo, Git no sabría a cuál te refieres.

### 1.6 Buscar dónde entró una línea

Esta es la que se usa de verdad cuando algo se rompió y nadie sabe cuándo.

```
git log -S "curanto" --oneline
```

Devuelve las confirmaciones donde esa palabra apareció o desapareció del proyecto. No busca en los mensajes, busca en el contenido.

Encuentra la confirmación que la introdujo y míra la completa.

```
git show <identificador>
```

Reemplaza `<identificador>` por el que te devolvió el paso anterior. Con los primeros siete caracteres basta.

### 1.7 Formato a tu medida

```
git log --format="%h %an %ad %s" --date=short
```

Cada símbolo es un dato. El identificador corto, el autor, la fecha y el mensaje. Hay muchos más, pero con estos cuatro resuelves casi todo.

Si un formato lo vas a repetir, conviértelo en alias como hiciste en el laboratorio anterior.

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

### 2.3 Comparar contra una confirmación

```
git diff HEAD~2
```

Diferencia entre lo que tienes ahora y el estado de hace dos confirmaciones.

`HEAD` es donde estás parado. `HEAD~1` es la anterior, `HEAD~2` la anterior a esa, y así.

---

## Parte 3 · Volver atrás

**Tiempo sugerido, 35 minutos.**

Acá están los tres problemas plantados. Resuélvelos en orden.

### 3.1 El mensaje mal escrito

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

### 3.2 El cambio que no querías

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

### 3.3 El archivo preparado por error

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

Esto es lo mismo que hizo `--amend`, pero en dos pasos y viendo el intermedio. Los tres modos de retroceso se ven completos en el laboratorio 07.

---

## Comprobación

```
git log --oneline
```

Cinco confirmaciones, ninguna con el mensaje mal escrito original.

```
git status
```

Nada en el área de preparación. El archivo del punto 3.3 aparece como modificado.

```
git log -S "curanto" --oneline
```

Debe devolver al menos una confirmación. Si devuelve vacío, te equivocaste en algún paso de la parte 3.

---

## Si algo salió mal

**Borraste algo con `git restore` que sí necesitabas.** No hay rescate. Ese contenido nunca estuvo en una confirmación. Vuelve a prepararlo con `labs/lab-02/preparar.sh` y repite desde la parte 3.

**Hiciste `reset` de más y perdiste confirmaciones.** Sí hay rescate y se ve completo en el laboratorio 07. Por ahora vuelve a ejecutar `preparar.sh`.

**El historial te quedó irreconocible.** Borra la carpeta y vuelve a ejecutar `preparar.sh`. La preparación siempre entrega el mismo estado inicial.

---

## Lo que te llevas

Encontrar algo en un historial ajeno es una habilidad aparte, y se resuelve con tres filtros. Por autor, por fecha y por contenido. El de contenido, `-S`, es el que salva el día cuando algo se rompió y nadie sabe cuándo.

Corregir la última confirmación no la corrige. La reemplaza por otra con identificador distinto. Mientras nadie más la haya visto, da lo mismo. Cuando ya la compartiste, deja de dar lo mismo.

`git restore` con `--staged` y sin `--staged` son operaciones distintas. Una es reversible y la otra no.
