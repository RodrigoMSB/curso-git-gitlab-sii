# Laboratorio 07 · Retroceder, revertir y etiquetar

**Sesión 4 · 70 minutos**

---

## Qué vas a hacer

Vas a deshacer la misma confirmación de cuatro maneras distintas y a registrar qué pierde cada una.

Después vas a recuperar algo que creías perdido, y vas a cerrar marcando una versión del recetario.

De todo el taller, este es el laboratorio donde más importa leer antes de escribir. Una de las órdenes destruye trabajo sin preguntar.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-07/preparar.sh
cd ../taller-git-trabajo/lab-07/recetario
```

Mira el punto de partida.

```
git log --oneline
git lg
```

Siete confirmaciones. Una de ellas metió un error que ya está publicado y que vas a tener que resolver sin reescribir la historia.

Antes de empezar, guarda una foto del estado actual en un papel o en un archivo aparte.

```
git log --oneline > ~/historial-original.txt
cat ~/historial-original.txt
```

Lo vas a necesitar para comparar.

---

## Parte 1 · Los tres modos de retroceso

**Tiempo sugerido, 30 minutos.**

Los tres mueven el nombre de la rama hacia atrás. Lo que cambia es qué hacen con tus archivos.

### 1.1 Modo suave

```
git log --oneline -3
git reset --soft HEAD~1
git log --oneline -3
git status
```

Anota lo que ves. La confirmación desapareció del historial, pero sus cambios están enteros en el área de preparación.

Es como si la confirmación nunca se hubiera hecho pero el trabajo siguiera listo para confirmarse. Sirve cuando quieres rehacer la confirmación con otro mensaje o partirla en dos.

Deshaz el retroceso.

```
git commit -c ORIG_HEAD
```

La opción `-c ORIG_HEAD` reusa el mensaje y los datos de la confirmación que acabas de deshacer, y te abre el editor para que lo revises. Acéptalo.

```
git log --oneline -3
```

### 1.2 Modo mixto

```
git reset --mixed HEAD~1
git log --oneline -3
git status
```

Compara con lo anterior. La confirmación desapareció igual, pero los cambios ya no están preparados, están solo en tu directorio de trabajo.

Este es el modo por omisión. Escribir `git reset HEAD~1` a secas hace exactamente esto.

Recupera.

```
git add .
git commit -c ORIG_HEAD
git log --oneline -3
```

### 1.3 Modo duro

Este es distinto y por eso va aparte.

**ATENCIÓN. La orden siguiente descarta tus cambios sin confirmar de forma permanente. Cualquier trabajo en el directorio o en el área de preparación que no esté en una confirmación se pierde y no hay manera de recuperarlo, porque Git nunca lo guardó. Las confirmaciones sí se pueden recuperar con el registro de referencias, los archivos sin confirmar no.**

Antes de ejecutarla, comprueba que no tienes nada pendiente.

```
git status
```

Si dice que el directorio está limpio, puedes seguir.

```
git reset --hard HEAD~1
git log --oneline -3
git status
ls
```

La confirmación desapareció y sus archivos también. Tu directorio quedó como estaba antes de esa confirmación.

### 1.4 Anota la comparación

Completa esta tabla con lo que observaste. La respuesta está en lo que hiciste, no la busques.

| Modo | Mueve la rama | Área de preparación | Directorio de trabajo |
|---|---|---|---|
| `--soft` | sí | | |
| `--mixed` | sí | | |
| `--hard` | sí | | |

---

## Parte 2 · El rescate

**Tiempo sugerido, 15 minutos.**

Acabas de perder una confirmación con el modo duro. Vas a recuperarla.

### 2.1 El registro de referencias

```
git reflog
```

Lee la salida completa. Es todo lo que hiciste en este repositorio, en orden, con el identificador de cada punto por el que pasaste.

Esto no es el historial. El historial son las confirmaciones alcanzables desde una rama. El registro de referencias es la bitácora de tus movimientos, e incluye los puntos que abandonaste.

### 2.2 Encuentra lo perdido

Busca la entrada anterior al `reset --hard`. Vas a reconocerla porque el registro dice qué orden causó cada movimiento.

```
git reflog -10
```

Copia el identificador de la confirmación que perdiste.

### 2.3 Recupérala

```
git reset --hard <identificador>
git log --oneline -3
ls
```

Volvió completa, con sus archivos.

Compara con la foto que guardaste al principio.

```
diff <(git log --oneline) ~/historial-original.txt && echo "identicos"
```

Si dice idénticos, recuperaste exactamente el estado original.

### 2.4 Lo que hay que entender

Una confirmación no se destruye cuando la abandonas. Queda sin nadie apuntándola, y sigue ahí hasta que el recolector de basura de Git pasa a limpiarla, lo que demora semanas.

Por eso el modo duro es peligroso con los archivos sin confirmar y no lo es con las confirmaciones. Lo que Git guardó alguna vez, se recupera. Lo que nunca guardó, no.

---

## Parte 3 · Revertir

**Tiempo sugerido, 15 minutos.**

Ahora el problema de verdad. Hay una confirmación con un error, y ya fue publicada.

### 3.1 Encuentra el error

```
git log --oneline
git log -S "sal marina en polvo" --oneline
```

Esa confirmación metió algo que no corresponde. Míralo.

```
git show <identificador>
```

### 3.2 Por qué no sirve el retroceso

Si usaras `reset` para sacarla, tendrías que mover el nombre de la rama hacia atrás, y eso borraría también las confirmaciones que vinieron después.

Y hay algo peor. Esta confirmación ya la tienen otras personas. Cambiar la historia que otros ya descargaron es la fuente de casi todos los desastres serios con Git, y lo vas a ver en detalle en la sesión 5.

### 3.3 Revierte

```
git revert <identificador>
```

Git abre el editor con un mensaje ya escrito. Acéptalo.

```
git log --oneline -3
git lg
```

### 3.4 Mira la diferencia

No desapareció nada. **Apareció** una confirmación nueva que deshace los efectos de la otra.

```
git show HEAD
```

Lee el contenido. Es el cambio original al revés. Lo que aquella confirmación agregó, esta lo quita.

Las dos conviven en la historia. Cualquiera que mire el proyecto puede ver que hubo un error y que se corrigió, y cuándo.

### 3.5 Cuándo usar cada uno

Retroceder reescribe la historia y sirve mientras el trabajo sea solo tuyo y no lo hayas compartido.

Revertir agrega historia y es lo único correcto cuando otras personas ya tienen esas confirmaciones.

La pregunta que decide es siempre la misma. ¿Alguien más tiene esto? Si la respuesta es sí, revertir.

---

## Parte 4 · Etiquetar

**Tiempo sugerido, 10 minutos.**

### 4.1 Etiqueta simple

```
git tag v0.9
git tag
git lg
```

Es un nombre apuntando a una confirmación, igual que una rama. La diferencia es que no se mueve cuando confirmas.

### 4.2 Etiqueta anotada

```
git tag -a v1.0 -m "primera version completa del recetario"
git tag
```

Míralas por dentro y compara.

```
git cat-file -t v0.9
git cat-file -t v1.0
```

La simple es un puntero directo a la confirmación. La anotada es un objeto propio, con autor, fecha y mensaje.

```
git show v1.0
```

### 4.3 Cuál usar

La anotada, prácticamente siempre. Deja constancia de quién marcó la versión y por qué. La simple sirve para marcas temporales de trabajo personal.

### 4.4 Eliminar una mal puesta

```
git tag -d v0.9
git tag
```

Sin drama, porque las etiquetas todavía no salieron de tu máquina. Cuando ya están publicadas, borrarlas es otra historia y se ve en la sesión 6.

---

## Comprobación

```
git log --oneline
```

Debe tener una confirmación más que el original, la de la reversión.

```
git tag
```

Solo `v1.0`.

```
git show v1.0
```

Debe mostrar el mensaje que escribiste.

```
git log -S "sal marina en polvo" --oneline
```

Debe devolver dos confirmaciones. La que lo agregó y la que lo quitó. Las dos siguen en la historia, que es exactamente el punto.

```
git status
```

Directorio limpio.

---

## Si algo salió mal

**Hiciste `reset --hard` y perdiste trabajo sin confirmar.** No hay rescate. Git nunca guardó eso. Es la razón de la advertencia.

**Hiciste `reset --hard` y perdiste confirmaciones.** Sí hay rescate. `git reflog`, busca el identificador, y `git reset --hard` hacia él.

**El registro de referencias está tan largo que no encuentras nada.** Acótalo con `git reflog -20` y busca por la orden que causó cada movimiento, que aparece al final de cada línea.

**Reverteiste la confirmación equivocada.** Revierte la reversión. Es una confirmación como cualquier otra.

```
git revert HEAD
```

**Quedaste perdido del todo.** Vuelve a ejecutar `preparar.sh` y repite desde la parte que te falló.

---

## Lo que te llevas

Los tres modos de retroceso mueven la rama hacia atrás. El suave conserva el trabajo preparado, el mixto lo deja en el directorio, y el duro lo borra.

Lo que Git guardó alguna vez se puede recuperar aunque lo abandones. Lo que nunca guardó, no. Por eso el modo duro es peligroso con archivos sin confirmar y no con confirmaciones.

El registro de referencias es tu red de seguridad y guarda todo lo que hiciste, no solo lo que quedó en la historia.

Retroceder sirve cuando el trabajo es solo tuyo. Revertir es lo correcto cuando alguien más ya lo tiene. La pregunta que decide es si esto ya salió de tu máquina.
