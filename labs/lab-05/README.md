# Laboratorio 05 · Fusionar y resolver

**Sesión 4 · 70 minutos**

*Antes se llamaba laboratorio 06. Ver la tabla de renumeración.*

---

## Qué vas a hacer

Vas a fusionar cuatro ramas y las cuatro se van a comportar distinto. Una va a avanzar sin crear nada. Otra va a crear una confirmación de unión. La tercera va a tocar **el mismo archivo** que `main` y se va a fusionar sola. Y la cuarta va a chocar.

La tercera es la que importa, porque casi todo el mundo cree que tocar el mismo archivo es conflicto seguro. No lo es, y vas a verlo.

Siempre vas a escribir la misma orden. Lo que decide qué ocurre es la forma que tiene el grafo, no lo que tú quieras.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado, en `taller-git-trabajo`. Escribe esto en la consola del taller, desde cualquier carpeta.

```
preparar 05
```

La consola arma el escenario, comprueba que quedó bien y queda parada en `taller-git-trabajo/lab-05/recetario`, que es donde vas a trabajar.

Mira con qué te encontraste.

```
git branch
git lg
```

Cuatro ramas de trabajo separadas de `main` en puntos distintos. Estúdialas un minuto antes de seguir.

### El taller ya está abierto

Todo este laboratorio se escribe en la consola del taller, la página que se abrió con `TALLER-JAVA.cmd` o con `taller-java.command`. El grafo y las tres áreas muestran tu repositorio de verdad mientras trabajas.

Si trabajas sin el programa del taller, el simulador de escenarios abre este laboratorio con la dirección `SIMULADOR.html?lab=05`, sin Git de verdad.

---

## Parte 1 · La fusión que no crea nada

**Tiempo sugerido, 10 minutos.**

### 1.1 Mira la situación

```
git switch main
git log --oneline main
git log --oneline tailandesa
```

`main` no avanzó desde que `tailandesa` se separó. Todo lo que tiene `main` lo tiene también `tailandesa`, más lo suyo propio.

Cuando pasa eso, no hay nada que combinar. Basta con mover el nombre hacia adelante.

### 1.2 Fusiona

```
git merge tailandesa
git lg
git log --oneline
```

Lee la salida. Git dice `Fast-forward` y no abrió ningún editor.

Y mira el grafo. No apareció ninguna confirmación nueva. El nombre `main` simplemente se corrió hasta donde estaba `tailandesa`.

### 1.3 Comprueba

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

**Tiempo sugerido, 15 minutos.**

### 2.1 Mira la situación

```
git lg
```

Ahora es distinto. `main` avanzó por su cuenta después de que `azteca` se separó.

Las dos ramas tienen trabajo que la otra no tiene. No hay forma de resolver esto moviendo un nombre, hay que combinar de verdad.

### 2.2 Fusiona

```
git merge azteca
```

Git abre el editor con un mensaje ya escrito. Acéptalo tal cual, no lo cambies. Guarda y cierra.

Si configuraste Visual Studio Code en el laboratorio 01, el mensaje se abre en una pestaña. Se acepta cerrando la pestaña.

```
git lg
git log --oneline -3
```

### 2.3 Mira lo que se creó

La confirmación de arriba es distinta de todas las que has visto. Tiene dos padres, mientras que todas las anteriores tenían uno.

```
git log --oneline -1
git show --stat HEAD
```

Ahí está la diferencia con el avance rápido. En el primer caso el grafo siguió recto. En este se abrió y se volvió a cerrar, y esa forma queda registrada para siempre en la historia.

```
git branch -d azteca
```

---

## Parte 3 · La fusión que parece que va a chocar

**Tiempo sugerido, 15 minutos.**

Quedan dos ramas, `criolla` y `andina`, y las dos tocaron `platos.md`. El mismo archivo.

Casi todo el mundo da por hecho que eso es un conflicto. Una de las dos va a chocar y la otra no, y **vas a decidir cuál antes de ejecutar nada**.

### 3.1 Mira qué tocó cada rama

Las dos nacieron del mismo punto de `main`, así que lo que cada una cambió respecto de ese punto es exactamente su confirmación.

```
git show criolla
git show andina
```

Lee los dos parches con cuidado. No mires *qué archivos* toca cada una, que en eso son iguales: mira **qué línea**.

Y mira lo que tiene `main` ahora.

```
cat platos.md
```

### 3.2 Predice

Contesta antes de seguir, en voz alta o por escrito.

- ¿Cuál de las dos ramas va a chocar con `main`?
- ¿Por qué la otra no?

No sigas hasta haber contestado. La respuesta importa menos que el hecho de haberla dado: si te equivocas, el paso siguiente te enseña algo que no se te va a olvidar.

### 3.3 Fusiona criolla

```
git merge criolla
```

Lee la salida con atención. Git dice `Auto-merging platos.md`, o sea que tuvo que fusionar ese archivo de verdad, y **no** dice `CONFLICT`. Lo resolvió él solo.

```
cat platos.md
```

Ahí está el resultado: la cazuela con chuchoca que puso `main` y las sopaipillas que puso `criolla`. Las dos cosas, en el mismo archivo, sin que nadie decidiera nada.

**Lo que decide no es el archivo, son las líneas.** `main` cambió la línea de la cazuela, entre los fondos. `criolla` agregó una línea al final, entre las entradas. Están a cuatro líneas de distancia y Git no necesita preguntar nada.

```
git lg
git log --oneline -1
```

Es una confirmación de unión, igual que la de `azteca`. La diferencia con esa es que aquí Git sí tuvo trabajo que hacer dentro de un archivo.

```
git branch -d criolla
```

Quédate con esto, porque es lo que casi nadie espera: **dos ramas pueden tocar el mismo archivo y fusionarse solas.** Tocar el mismo archivo no es chocar.

---

## Parte 4 · La fusión que choca

**Tiempo sugerido, 30 minutos.**

Queda `andina`, la que predijiste que iba a chocar.

### 4.1 Confirma por qué va a chocar

```
git diff main andina -- platos.md
```

Compáralo con el de `criolla`, que acabas de fusionar sin problema. Ahí la línea que cambiaba cada rama era distinta. Aquí es **la misma**, y las dos la dejaron diciendo otra cosa: Git no tiene forma de saber cuál de las dos versiones quieres.

### 4.2 Fusiona y observa el choque

```
git merge andina
```

Lee el mensaje. Git dice qué archivo chocó y te avisa que la fusión quedó a medias.

```
git status
```

Presta atención a la sección nueva que aparece, los archivos sin fusionar. Ese estado no lo habías visto antes.

### 4.3 Mira el conflicto

```
cat platos.md
```

Ahí están los marcadores. Se leen así.

Entre `<<<<<<< HEAD` y `=======` está **tu** versión, la de la rama donde estás parado.

Entre `=======` y `>>>>>>> andina` está la versión que viene de la otra rama.

Los marcadores son texto corriente que Git escribió en tu archivo. No son mágicos y hay que borrarlos a mano.

### 4.4 Practica el aborto primero

Antes de resolverlo, aprende a salir. Es lo que más vas a necesitar los primeros meses.

```
git merge --abort
git status
cat platos.md
git lg
```

Todo volvió a como estaba. El archivo quedó limpio, sin marcadores, y la fusión no ocurrió.

Esa orden es tu salida de emergencia cuando el conflicto es más grande de lo que esperabas y prefieres consultar antes de seguir.

### 4.5 Ahora sí, resuelve

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

### 4.6 Marca el conflicto como resuelto

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
```

### 4.7 Comprueba el resultado

```
cat platos.md
git log --oneline -1
```

Es una confirmación de unión normal, la única diferencia fue que tuviste que armar el contenido tú.

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

Debe haber tres confirmaciones de unión en la historia.

```
git lg
```

El grafo debe mostrar una rama que entró sin dejar marca, la del avance rápido, y tres que se abrieron y se cerraron.

```
cat platos.md
```

La cazuela con chuchoca que traía `main`, el lomo saltado de `andina` y las sopaipillas de `criolla`, todo junto, y ninguna línea de marcadores.

```
grep -rn "<<<<<<<" .
```

No debe devolver nada. Si devuelve algo, quedó un marcador dentro de un archivo.

```
git status
```

Directorio limpio.

Y que el verificador lo confirme. Escríbelo en la consola, desde cualquier carpeta.

```
verificar 05
```

Imprime una línea por criterio. Si alguno falla, dice qué esperaba y qué encontró.

---

## Si algo salió mal

**Confirmaste con los marcadores adentro.** Pasa más de lo que crees y es la razón del `grep` del paso 4.5. Arréglalo con lo que aprendiste en el laboratorio 02.

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

Hay cuatro resultados posibles y siempre se escribe la misma orden. Lo que decide cuál te toca es la forma del grafo, no lo que tú quieras.

Cuando una rama está contenida entera en la otra, Git mueve el nombre y no crea nada. Cuando las dos avanzaron por su lado, crea una confirmación con dos padres. Cuando además tocaron el mismo archivo, **lo fusiona él solo si los cambios están en líneas distintas**. Y sólo cuando tocaron la misma línea se detiene y te pide que decidas tú.

**Tocar el mismo archivo no es chocar.** Es la creencia que más trabajo cuesta sacarse, y la que hace que la gente evite ramas por miedo a conflictos que no van a ocurrir.

Los marcadores de conflicto son texto que Git escribió en tu archivo. Hay que borrarlos a mano y conviene comprobar que no quedó ninguno antes de confirmar.

`git merge --abort` deja todo como estaba. Úsala sin culpa cada vez que el conflicto sea más grande de lo que esperabas.
