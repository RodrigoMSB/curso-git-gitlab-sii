# Laboratorio 07 · Interrumpir y limpiar la historia

**Sesión 5 · 100 minutos**

---

## Qué vas a hacer

Dos situaciones que en el trabajo aparecen todas las semanas.

Primero, estás a medias en algo y llega una urgencia que hay que atender ahora. Vas a guardar el trabajo incompleto, resolver la urgencia y volver.

Después, tu rama tiene cuatro confirmaciones con mensajes que no sirven y hay que dejarla presentable antes de que alguien la revise.

La segunda parte tiene un concepto que se escapa siempre. Antes de empezarla vas a anotar unos identificadores, y al final vas a comprobar que ninguno sobrevivió.

---

## Preparación

Tu trabajo va en la carpeta del taller, `taller-git`, fuera del clon del curso. Escribe esto en la consola del taller, desde cualquier carpeta.

```
preparar 07
```

La consola arma el escenario, comprueba que quedó bien y queda parada en `lab-07/recetario`, dentro de `taller-git`, que es donde vas a trabajar.

Mira el punto de partida.

```
git branch
git lg
git status
```

Estás en una rama de trabajo con cuatro confirmaciones propias, `main` avanzó por su cuenta, y tienes una receta a medio escribir en el directorio.

### El taller ya está abierto

Todo este laboratorio se escribe en la consola del taller, la página que se abrió con `TALLER.cmd` o con `taller.command`, en la carpeta `taller-git`. El grafo y las tres áreas muestran tu repositorio de verdad mientras trabajas.

Si trabajas sin el programa del taller, el simulador de escenarios abre este laboratorio con la dirección `SIMULADOR.html?lab=07`, sin Git de verdad.

---

## Parte 1 · Guardar el trabajo a medias

**Tiempo sugerido, 45 minutos.**

### 1.1 Mira lo que tienes empezado

```
git status
git diff
```

Hay una receta incompleta. No sirve para confirmar y no la quieres perder.

### 1.2 Llega la urgencia

Te avisan que hay un error en `main` y que lo arregles ahora.

Intenta cambiarte de rama sin hacer nada más.

```
git switch main
```

Git se niega y te explica por qué. Cambiar de rama sobrescribiría tus cambios sin confirmar.

### 1.3 Guarda y limpia

```
git stash push -m "receta de curry a medio escribir"
git status
git diff
ls recetas
```

Tu directorio quedó limpio y la receta desapareció. No se perdió, se guardó aparte.

### 1.4 Ahora sí, atiende la urgencia

```
git switch main
```

Corrige lo que haya que corregir en `platos.md`, cualquier línea sirve para el ejercicio, y confirma.

```
git add platos.md
git commit -m "se corrige el listado de platos"
```

### 1.5 Vuelve a lo tuyo

```
git switch trabajo
git stash list
```

Ahí está tu trabajo, con el mensaje que le pusiste.

```
git stash pop
git status
git diff
```

Volvió tal cual estaba. Y fíjate en algo.

```
git stash list
```

Está vacío. `pop` aplica y saca de la pila en un solo paso.

### 1.6 La pila

Ahora vas a trabajar con más de una entrada, que es donde la cosa se complica de verdad.

Guarda lo que tienes con la forma antigua, que vas a encontrar en toda la documentación vieja.

```
git stash save "curry a medias"
git stash list
```

Hace lo mismo que `push -m`. Está en desuso pero funciona y conviene que la reconozcas.

Ahora ensucia otra cosa y guárdala también.

Agrega una línea a `ingredientes.md`.

```
- leche de coco
```

Y guarda.

```
git stash push -m "ingredientes tailandeses"
git stash list
```

Lee el orden con cuidado. **La última que guardaste quedó arriba, en el índice cero.** Es una pila, no una fila.

### 1.7 Mira sin aplicar

```
git stash show stash@{0}
git stash show stash@{1}
```

Te dice qué archivos trae cada una y cuántas líneas cambian.

Con más detalle.

```
git stash list --stat
```

Esta es la que resuelve el problema real de tener tres entradas y no acordarse de cuál era cuál.

Y para ver el contenido completo.

```
git stash show -p stash@{1}
```

### 1.8 Aplicar una que no es la última

Necesitas el curry, que quedó abajo.

```
git stash apply stash@{1}
git status
git stash list
```

Dos cosas que anotar. Aplicó la que pediste, no la de arriba. Y la pila sigue con las dos entradas, porque `apply` no saca nada.

Esa es la diferencia con `pop`. `apply` deja la entrada por si la necesitas de nuevo o por si la aplicas en otra rama.

### 1.9 Limpia la que ya usaste

**ATENCIÓN. La orden siguiente elimina esa entrada de la pila. El contenido no está en ninguna confirmación, así que se pierde de forma permanente. Git te muestra el identificador al borrarla y con eso se puede rescatar por un tiempo, pero no cuentes con eso.**

```
git stash drop stash@{1}
git stash list
```

Quedó una sola.

### 1.10 Cuando el directorio estorba

Esta es la parte que sorprende, y lo que sorprende no es lo que casi todos esperan.

Te queda una entrada en la pila, la de los ingredientes tailandeses. Ensucia a mano ese mismo archivo, con otra cosa.

Agrega a `ingredientes.md` una línea distinta.

```
- leche condensada
```

Y ahora intenta recuperar.

```
git stash pop
```

**No choca. Se niega.** La diferencia importa y es la que casi nadie tiene clara.

Git no intentó combinar tu línea con la de la entrada. Vio que `ingredientes.md` tiene trabajo sin confirmar, vio que la entrada también lo toca, y **se detuvo antes de tocar nada**: `Your local changes to the following files would be overwritten by merge`. No hay marcadores de conflicto por ninguna parte, porque nunca llegó a mezclar.

Mira las dos cosas que quedaron.

```
git status
git stash list
```

Tu archivo está intacto, con tu línea y sin marcadores. Y **la entrada sigue en la pila**: Git no saca nada cuando no pudo aplicar. Esa es la red de seguridad.

Para salir tienes dos puertas y las dos son buenas. Si lo que acabas de escribir sirve, lo guardas también con `git stash push -m "..."` y decides después cuál de las dos entradas aplicas. Si era una prueba, lo descartas.

Aquí era una prueba.

```
git restore ingredientes.md
git status
```

El directorio quedó limpio otra vez. Y ahora sí.

```
git stash pop
git status
git stash list
```

Entró sin reclamar y la pila quedó vacía. **Cuando `pop` sí aplica, saca; cuando no puede, no saca nada.** Esa es la regla entera.

Quédate con la distinción, porque los dos verbos se parecen y hacen cosas distintas. `git restore <archivo>` descarta lo que tienes en el disco. `git stash drop` descarta una entrada de la pila. Ninguna de las dos pregunta.

### 1.11 Vaciar la pila

Para cuando la pila se llenó de cosas viejas que ya no sirven.

**ATENCIÓN. La orden siguiente elimina todas las entradas de la pila de una vez, sin preguntar y sin listar qué se lleva. Nada de eso está en una confirmación.**

```
git stash list
git stash clear
git stash list
```

Vacía. Como ya no quedaba nada, no perdiste nada.

### 1.12 Confirma lo que quedó

```
git status
git add .
git commit -m "se agrega el curry y sus ingredientes"
```

---

## Parte 2 · Reorganizar la historia

**Tiempo sugerido, 30 minutos.**

### 2.1 Anota antes de empezar

Esto es obligatorio para el ejercicio.

```
git log --oneline trabajo -6 > ~/antes-del-rebase.txt
cat ~/antes-del-rebase.txt
```

Ahí están los identificadores de tus confirmaciones. Al final del laboratorio vas a comparar.

### 2.2 Mira la situación

```
git lg
git log --oneline main..trabajo
git log --oneline trabajo..main
```

Tu rama se separó y `main` avanzó por su cuenta. Podrías fusionar, como en el laboratorio 05, y quedaría una confirmación de unión.

Pero a veces se prefiere que la historia quede recta, como si hubieras empezado a trabajar después de que `main` avanzara. Eso es lo que hace el rebase.

### 2.3 Rebase simple

```
git switch trabajo
git rebase main
git lg
```

El grafo quedó recto. Tus confirmaciones ahora salen de la punta de `main`.

### 2.4 El concepto que se escapa

```
git log --oneline trabajo -6
cat ~/antes-del-rebase.txt
```

Compara las dos listas.

Los mensajes son los mismos. **Los identificadores son todos distintos.**

Eso significa que tus confirmaciones no se movieron. Se crearon copias nuevas sobre la nueva base, y las originales quedaron donde estaban, sin nadie apuntándolas.

Compruébalo.

```
git reflog -15
```

Ahí están las viejas, en la bitácora. Siguen existiendo, huérfanas.

### 2.5 Por qué importa

De esto sale la única regla que hay que memorizar sobre el rebase.

**No reorganices historia que ya compartiste.**

Si otra persona descargó tus confirmaciones originales y tú las reemplazas por copias, esa persona queda con una historia que ya no existe en ninguna parte, y arreglarlo es un dolor de cabeza para los dos.

Mientras el trabajo sea solo tuyo, el rebase es limpio y conveniente. Cuando ya salió de tu máquina, se fusiona.

---

## Parte 3 · Rebase interactivo

**Tiempo sugerido, 25 minutos.**

El rebase interactivo abre Visual Studio Code con la lista de confirmaciones, y ahí se eligen las acciones línea por línea. La consola del taller espera mientras la pestaña está abierta, y sigue cuando la cierras.

Tus cuatro confirmaciones tienen mensajes que no sirven. Vas a arreglar eso.

### 3.1 Mira el desastre

```
git log --oneline -6
```

Mensajes del tipo "wip", "arreglo", "más cosas". Nadie que revise esto va a entender qué hiciste.

### 3.2 Abre el rebase interactivo

```
git rebase -i main
```

Con `main` la lista trae exactamente las confirmaciones propias de tu rama, sean cuantas sean.

Git abre el editor con una lista. Cada línea es una confirmación con una acción delante.

Lee las instrucciones que vienen abajo en comentarios. Ahí están todas las acciones posibles.

Las tres que vas a usar hoy.

`pick` deja la confirmación como está.
`reword` la deja igual pero te deja cambiar el mensaje.
`squash` la funde con la anterior.

**Ojo con el orden.** La lista va de la más antigua arriba a la más reciente abajo. Es al revés de como las muestra `git log`.

### 3.3 Cambia un mensaje

Cambia la primera línea a `reword`. Las demás déjalas con `pick`.

Guarda y cierra.

Git se detiene y te abre el editor con el mensaje de esa confirmación. Escribe uno decente, algo que explique qué hace.

Guarda y cierra otra vez.

```
git log --oneline -6
```

### 3.4 Une las del medio

```
git rebase -i main
```

Ahora deja la primera y la última con `pick`, y cambia a `squash` todas las del medio.

Guarda y cierra.

Git te abre un editor con los mensajes juntos. Borra "cambios", "mas cambios" y "arreglos" y deja solo el que escribiste en el `reword`: si no, quedan dentro del mensaje nuevo.

Guarda y cierra.

```
git log --oneline -6
git lg
```

Cinco confirmaciones quedaron en dos: la que reescribiste y "se agrega el curry y sus ingredientes".

### 3.5 Comprueba

```
git log --oneline trabajo
cat ~/antes-del-rebase.txt
```

Ningún identificador de la lista original sobrevivió. Ninguno.

```
git reflog -20
```

Y todos siguen ahí, huérfanos, recuperables por un tiempo.

---

## Comprobación

```
git stash list
```

Vacía.

```
git log --oneline main..trabajo
```

Dos confirmaciones con mensajes decentes.

```
git lg
```

La historia recta, sin confirmaciones de unión.

```
comm -12 <(git log --format="%h" trabajo | sort) <(cut -d" " -f1 ~/antes-del-rebase.txt | sort)
```

No debe devolver nada. Si devuelve algo, alguna confirmación original sobrevivió y el rebase no alcanzó a tocarla.

```
git status
```

Directorio limpio.

Y que el verificador lo confirme. Escríbelo en la consola, desde cualquier carpeta.

```
verificar 07
```

Imprime una línea por criterio. Si alguno falla, dice qué esperaba y qué encontró.

---

## Si algo salió mal

**El rebase se detuvo con un conflicto.** Es normal. Resuelve como en el laboratorio 05, y en vez de confirmar usa esto.

```
git add <archivo>
git rebase --continue
```

**Quieres salir del rebase y dejar todo como estaba.**

```
git rebase --abort
```

Deja la rama exactamente como antes de empezar. Es tu salida de emergencia.

**Te perdiste dentro del rebase interactivo.** `git status` te dice en qué paso vas y qué opciones tienes.

**Hiciste `squash` de más y juntaste todo en una.** Deshaz con el registro de referencias.

```
git reflog
git reset --hard <identificador anterior al rebase>
```

**Borraste una entrada del guardado temporal que necesitabas.** Git imprimió el identificador al borrarla. Si lo tienes.

```
git stash apply <identificador>
```

Si no lo tienes, se puede buscar entre los objetos sueltos, pero es una operación de rescate que se sale del taller. Consulta.

**Perdiste el rumbo del todo.** Escribe `preparar 07 --forzar` en la consola. Borra todo tu trabajo en este laboratorio, sin vuelta atrás, y deja el escenario como al principio.

---

## Lo que te llevas

El guardado temporal es una pila. La última entra arriba y `pop` saca de arriba. Con más de una entrada, `list --stat` y `show` son la única forma de saber cuál es cuál.

`pop` aplica y saca. `apply` solo aplica y deja la entrada. Cuando `pop` choca, no saca nada.

El rebase no mueve confirmaciones, las copia. Los identificadores cambian todos y los originales quedan huérfanos. De ahí sale la única regla que importa, no reorganices historia que ya compartiste.

`--abort` existe para el rebase igual que para la fusión, y deja todo como estaba.
