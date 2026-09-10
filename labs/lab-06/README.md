# Laboratorio 06 · Fusionar y resolver

**Sesión 4 · 95 minutos**

---

## Qué vas a hacer

Vas a fusionar tres ramas y las tres se van a comportar distinto. Una va a avanzar sin crear nada, otra va a crear una confirmación de unión, y la tercera va a chocar.

El objetivo no es aprender la orden, que es siempre la misma. Es reconocer cuál de los tres casos tienes delante antes de escribirla, y saber qué hacer cuando choca.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-06/preparar.sh
cd ../taller-git-trabajo/lab-06/recetario
```

Mira con qué te encontraste.

```
git branch
git lg
```

Tres ramas de trabajo separadas de `main` en puntos distintos. Estúdialas un minuto antes de seguir, porque la diferencia entre ellas es lo que decide qué va a pasar en cada fusión.

---

## Parte 1 · La fusión que no crea nada

**Tiempo sugerido, 25 minutos.**

### 1.1 Mira la situación

```
git switch main
git log --oneline main
git log --oneline tailandesa
```

`main` no avanzó desde que `tailandesa` se separó. Todo lo que tiene `main` lo tiene también `tailandesa`, más lo suyo propio.

Cuando pasa eso, no hay nada que combinar. Basta con mover el nombre hacia adelante.

### 1.2 Comprueba antes de fusionar

```
git merge-base main tailandesa
git rev-parse main
```

Las dos órdenes devuelven lo mismo. El punto donde las ramas se separaron es la punta actual de `main`, o sea `main` está contenida entera dentro de `tailandesa`.

Ese es el diagnóstico. Cuando esos dos identificadores coinciden, la fusión va a ser por avance rápido.

### 1.3 Fusiona

```
git merge tailandesa
git lg
git log --oneline
```

Lee la salida. Git dice `Fast-forward` y no abrió ningún editor.

Y mira el grafo. No apareció ninguna confirmación nueva. El nombre `main` simplemente se corrió hasta donde estaba `tailandesa`.

### 1.4 Comprueba

```
git log --oneline main
git log --oneline tailandesa
```

Idénticos. Las dos ramas apuntan a la misma confirmación.

Limpia la rama, que ya cumplió.

```
git branch -d tailandesa
git branch
```

Git no reclamó, porque no había nada que perder.

---

## Parte 2 · La fusión que sí crea algo

**Tiempo sugerido, 30 minutos.**

### 2.1 Mira la situación

```
git lg
git merge-base main azteca
git rev-parse main
```

Ahora los identificadores **no** coinciden. `main` avanzó por su cuenta después de que `azteca` se separó.

Las dos ramas tienen trabajo que la otra no tiene. No hay forma de resolver esto moviendo un nombre, hay que combinar de verdad.

### 2.2 Mira qué trae cada una

```
git log --oneline main..azteca
git log --oneline azteca..main
```

Los dos puntos significan lo que tiene la segunda y no tiene la primera. Es la forma rápida de saber qué vas a recibir y qué vas a aportar antes de fusionar.

### 2.3 Fusiona

```
git merge azteca
```

Git abre el editor con un mensaje ya escrito. Acéptalo tal cual, no lo cambies. Guarda y cierra.

Si configuraste Visual Studio Code en el laboratorio 01, el mensaje se abre en una pestaña. Se acepta cerrando la pestaña.

```
git lg
git log --oneline -3
```

### 2.4 Mira lo que se creó

La confirmación de arriba es distinta de todas las que has visto.

```
git cat-file -p HEAD
```

Tiene **dos padres**. Todas las anteriores tenían uno. Esa es la marca de una confirmación de unión.

Ahí está la diferencia con el avance rápido. En el primer caso el grafo siguió recto. En este se abrió y se volvió a cerrar, y esa forma queda registrada para siempre en la historia.

```
git branch -d azteca
```

---

## Parte 3 · La fusión que choca

**Tiempo sugerido, 40 minutos.**

### 3.1 Mira por qué va a chocar

```
git log --oneline main..andina
git diff main andina -- platos.md
```

Las dos ramas tocaron la misma línea del mismo archivo, y la dejaron distinta. Git no tiene forma de saber cuál de las dos versiones quieres.

### 3.2 Fusiona y observa el choque

```
git merge andina
```

Lee el mensaje. Git dice qué archivo chocó y te avisa que la fusión quedó a medias.

```
git status
```

Presta atención a la sección nueva que aparece, los archivos sin fusionar. Ese estado no lo habías visto antes.

### 3.3 Mira el conflicto

```
cat platos.md
```

Ahí están los marcadores. Se leen así.

Entre `<<<<<<< HEAD` y `=======` está **tu** versión, la de la rama donde estás parado.

Entre `=======` y `>>>>>>> andina` está la versión que viene de la otra rama.

Los marcadores son texto corriente que Git escribió en tu archivo. No son mágicos y hay que borrarlos a mano.

### 3.4 Practica el aborto primero

Antes de resolverlo, aprende a salir. Es lo que más vas a necesitar los primeros meses.

```
git merge --abort
git status
cat platos.md
git lg
```

Todo volvió a como estaba. El archivo quedó limpio, sin marcadores, y la fusión no ocurrió.

Esa orden es tu salida de emergencia cuando el conflicto es más grande de lo que esperabas y prefieres consultar antes de seguir.

### 3.5 Ahora sí, resuelve

```
git merge andina
git status
```

Abre `platos.md` en tu editor y déjalo con las dos versiones combinadas, o sea con los platos de las dos ramas y sin ningún marcador.

Borra las tres líneas de marcadores, `<<<<<<< HEAD`, `=======` y `>>>>>>> andina`. Deja el contenido que quieres conservar.

Comprueba que no quedó ninguno.

```
grep -n "<<<<<<<\|=======\|>>>>>>>" platos.md
```

Si no devuelve nada, está limpio. Si devuelve líneas, todavía quedan marcadores.

### 3.6 Marca el conflicto como resuelto

```
git add platos.md
git status
```

Lee el cambio. Ya no aparece como archivo sin fusionar. `git add` es lo que le dice a Git que ese conflicto está resuelto.

```
git commit
```

Git abre el editor con el mensaje de la fusión. Acéptalo.

```
git lg
cat .git/MERGE_HEAD 2>/dev/null || echo "la fusion termino"
```

### 3.7 Comprueba el resultado

```
cat platos.md
git log --oneline -1
git cat-file -p HEAD
```

Dos padres otra vez. Es una confirmación de unión normal, la única diferencia fue que tuviste que armar el contenido tú.

```
git branch -d andina
```

---

## Comprobación

```
git branch
```

Solo debe quedar `main`.

```
git log --oneline
```

Debe haber dos confirmaciones de unión en la historia.

```
git lg
```

El grafo debe mostrar una rama que entró sin dejar marca, la del avance rápido, y dos que se abrieron y se cerraron.

```
grep -rn "<<<<<<<" .
```

No debe devolver nada. Si devuelve algo, quedó un marcador dentro de un archivo.

```
git status
```

Directorio limpio.

---

## Si algo salió mal

**Confirmaste con los marcadores adentro.** Pasa más de lo que crees y es la razón del `grep` del paso 3.5. Arréglalo con lo que aprendiste en el laboratorio 02.

```
git restore --staged platos.md
```

Edita el archivo, sácale los marcadores, y después.

```
git add platos.md
git commit --amend --no-edit
```

**Estás en medio de una fusión y no sabes en qué punto vas.** `git status` siempre te lo dice, y siempre te ofrece la salida.

**Quieres salir de la fusión sin resolver.** `git merge --abort`. No pierde nada de lo que había antes de empezar.

**El editor se abrió y no sabes cerrarlo.** Si es Visual Studio Code, cierra la pestaña. Si se abrió otro editor dentro de la consola, tienes un problema de configuración y conviene volver al punto 1.2 del laboratorio 01.

---

## Lo que te llevas

Hay tres resultados posibles y siempre se escribe la misma orden. Lo que decide cuál te toca es la forma del grafo, no lo que tú quieras.

Cuando una rama está contenida entera en la otra, Git mueve el nombre y no crea nada. Cuando las dos avanzaron por su lado, crea una confirmación con dos padres. Cuando además tocaron la misma línea, se detiene y te pide que decidas tú.

Los marcadores de conflicto son texto que Git escribió en tu archivo. Hay que borrarlos a mano y conviene comprobar que no quedó ninguno antes de confirmar.

`git merge --abort` deja todo como estaba. Úsala sin culpa cada vez que el conflicto sea más grande de lo que esperabas.
