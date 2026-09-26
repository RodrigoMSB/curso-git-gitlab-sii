# Laboratorio 04 · Tres cocinas en paralelo

**Sesión 3 · 85 minutos**

---

## Qué vas a hacer

Vas a abrir tres cocinas en el recetario, cada una arrancando desde un punto distinto de la historia. Después vas a renombrar una, eliminar otra, y perderte a propósito en el estado desconectado para aprender a salir de ahí.

Antes de mirar el resultado vas a dibujar en un papel cómo crees que quedó el grafo. Esa parte no es opcional. Es la que te dice si entendiste o si solo copiaste órdenes.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado, en `taller-git-trabajo`. Escribe esto en la consola del taller, desde cualquier carpeta.

```
preparar 04
```

La consola arma el escenario, comprueba que quedó bien y queda parada en `taller-git-trabajo/lab-04/recetario`, que es donde vas a trabajar.

Mira el punto de partida.

```
git log --oneline
git lg
git branch
```

Seis confirmaciones en una sola línea recta y una sola rama. De aquí en adelante deja de ser recta.

### El taller ya está abierto

Todo este laboratorio se escribe en la consola del taller, la página que se abrió con `TALLER-JAVA.cmd` o con `taller-java.command`. El grafo y las tres áreas muestran tu repositorio de verdad mientras trabajas.

Si trabajas sin el programa del taller, el simulador de escenarios abre este laboratorio con la dirección `SIMULADOR.html?lab=04`, sin Git de verdad.

---

## Parte 1 · Tres ramas desde tres puntos

**Tiempo sugerido, 35 minutos.**

### 1.1 La primera, desde donde estás

```
git branch tailandesa
git branch
git lg
```

Lee el grafo. Hay dos nombres apuntando a la misma confirmación. No pasó nada más.

Cámbiate a ella y confirma algo.

```
git switch tailandesa
```

Crea `recetas/pad-thai.md`.

```
# Pad thai

Fideos de arroz, tamarindo, mani, huevo y salsa de pescado.
```

Y confirma.

```
git add recetas/pad-thai.md
git commit -m "se abre la cocina tailandesa"
git lg
```

Ahora los dos nombres apuntan a confirmaciones distintas.

### 1.2 La segunda, desde una confirmación anterior

Esta no nace de donde estás parado, nace de tres confirmaciones atrás.

```
git switch main
git log --oneline
git switch -c mexicana HEAD~3
git lg
```

La orden `switch -c` con una referencia hace dos cosas de una vez, crea la rama en ese punto y te cambia a ella.

Fíjate en tu directorio de trabajo.

```
ls
ls recetas
```

Los archivos cambiaron. Estás parado tres confirmaciones atrás, así que ves el proyecto como estaba en ese momento.

Confirma algo acá.

```
mkdir -p recetas
```

Crea `recetas/tacos.md`.

```
# Tacos

Tortilla de maiz, carne, cebolla, cilantro y limon.
```

Y confirma.

```
git add recetas/tacos.md
git commit -m "se abre la cocina mexicana"
git lg
```

El grafo ya no es una línea. Se abrió.

### 1.3 La tercera, desde una confirmación específica

Ahora vas a usar un identificador en lugar de una referencia relativa.

```
git log --oneline main
```

Elige la segunda confirmación de esa lista y copia su identificador.

```
git branch peruana <identificador>
git switch peruana
git lg
```

Confirma algo. Crea `recetas/ceviche.md`.

```
# Ceviche

Pescado blanco, limon, cebolla morada, aji y camote.
```

Y confirma.

```
git add recetas/ceviche.md
git commit -m "se abre la cocina peruana"
```

### 1.4 Dibuja antes de mirar

**No ejecutes nada todavía.**

Toma un papel y dibuja cómo crees que quedó el grafo. Marca dónde está cada una de las cuatro ramas y de qué punto sale cada una.

Cuando lo tengas dibujado, y solo entonces.

```
git lg
```

Compara. Si no coincide, no sigas hasta entender dónde te equivocaste. Vuelve sobre los puntos 1.1 a 1.3 y sigue el hilo.

---

## Parte 2 · Renombrar y eliminar

**Tiempo sugerido, 15 minutos.**

### 2.1 Renombrar la rama donde estás

```
git branch
git branch -m peruana andina
git branch
git lg
```

Cambió el nombre. Nada más cambió, la confirmación es la misma.

Si quieres comprobarlo con lo que aprendiste en el laboratorio 02.

```
ls .git/refs/heads
```

Un archivo se renombró. Eso fue todo.

### 2.2 Renombrar una rama donde no estás

```
git branch -m mexicana azteca
git branch
```

Con dos nombres, el primero es la rama a renombrar y el segundo el nombre nuevo. No necesitas estar parado en ella.

### 2.3 Eliminar una rama

Crea una que no sirva y bórrala.

```
git branch temporal
git branch
git branch -d temporal
git branch
```

Sin drama, porque `temporal` no tenía nada que las otras no tuvieran.

### 2.4 Cuando Git se niega

Intenta borrar una que sí tiene trabajo propio.

```
git switch main
git branch -d azteca
```

Git se niega y te explica por qué. Esa rama tiene una confirmación que ninguna otra tiene, y borrarla dejaría ese trabajo sin nadie apuntándolo.

**ATENCIÓN. La opción `-D` en mayúscula fuerza el borrado y no pregunta. La confirmación no se destruye de inmediato, queda huérfana y se puede recuperar con el registro de referencias, que vas a ver en el laboratorio 06. Pero si pasa el tiempo suficiente, el recolector de basura de Git la elimina de verdad.**

No la borres. Déjala como está y sigue.

---

## Parte 3 · Perderse a propósito

**Tiempo sugerido, 25 minutos.**

Acá vas a entrar al estado que más asusta la primera vez.

### 3.1 Entrar

```
git log --oneline main
```

Copia el identificador de la tercera confirmación de la lista y cámbiate a ella directamente, sin nombre de rama.

```
git switch --detach <identificador>
```

Lee el mensaje completo. Git te avisa que estás en estado desconectado y te explica lo que puede pasar. Es largo y da la impresión de ser un error. No lo es.

### 3.2 Mira dónde estás

```
git status
git branch
cat .git/HEAD
```

En `git branch` aparece una entrada rara arriba de todo, que no es un nombre de rama.

Y en `.git/HEAD` ya no hay una referencia a una rama, hay un identificador directo. Eso es exactamente lo que significa estar desconectado. `HEAD` apunta a una confirmación en vez de apuntar a una rama.

### 3.3 Trabaja igual

Puedes confirmar acá sin problema. Crea `recetas/humita.md`.

```
# Humita

Choclo molido, albahaca, cebolla, cocida en las mismas hojas.
```

Y confirma.

```
git add recetas/humita.md
git commit -m "se agrega la humita"
git log --oneline -2
git lg
```

Tu confirmación existe y es tan válida como cualquier otra. El problema es que ningún nombre la apunta. Si te vas de acá ahora, no vas a tener cómo volver a encontrarla.

### 3.4 El error

Cámbiate a otra rama.

```
git switch main
```

Lee la advertencia. Git te avisa que dejas atrás una confirmación y te ofrece el identificador para rescatarla.

```
git lg
```

Tu humita no aparece por ninguna parte.

### 3.5 El rescate

Todavía se puede. Copia el identificador que Git te ofreció en la advertencia.

```
git branch rescate <identificador>
git lg
```

Ahí está de vuelta. Le pusiste un nombre y volvió al grafo.

Si no copiaste el identificador a tiempo, se recupera con el registro de referencias.

```
git reflog
```

Ahí está todo lo que hiciste, incluida esa confirmación.

### 3.6 Cómo se hace bien

La forma correcta es crear la rama **antes** de irte, no después.

```
git switch --detach HEAD~2
```

Crea `recetas/sopaipillas.md`.

```
# Sopaipillas

Harina, zapallo, manteca. Fritas y con pebre.
```

Confirma y esta vez ponle nombre antes de moverte.

```
git add recetas/sopaipillas.md
git commit -m "se agregan las sopaipillas"
git switch -c fritangas
git lg
git switch main
```

Sin advertencia y sin rescate. La rama ya existía cuando te fuiste.

---

## Comprobación

```
git branch
```

Deben aparecer `main`, `tailandesa`, `azteca`, `andina`, `rescate` y `fritangas`. Seis en total, y `main` marcada como la actual.

```
git lg
```

El grafo debe mostrar cinco puntos de separación distintos sobre la línea de `main`.

```
cat .git/HEAD
```

Debe apuntar a `main`, no a un identificador suelto.

```
git status
```

Directorio limpio.

Y que el verificador lo confirme. Escríbelo en la consola, desde cualquier carpeta.

```
verificar 04
```

Imprime una línea por criterio. Si alguno falla, dice qué esperaba y qué encontró.

---

## Si algo salió mal

**Quedaste desconectado y no sabes volver.** `git switch main` te devuelve siempre. Si tenías trabajo sin nombre, revisa la advertencia que Git imprime al salir o usa `git reflog`.

**Perdiste una confirmación y no anotaste el identificador.** Está en `git reflog`. No se pierde hasta que pasan semanas y corre el recolector.

**Creaste una rama en el punto equivocado.** Bórrala con `git branch -d` y créala de nuevo. Como no tiene trabajo propio, Git no va a reclamar.

**El grafo no coincide con tu dibujo.** No sigas hasta entender por qué. Ese es el ejercicio.

---

## Lo que te llevas

Una rama se crea donde tú digas, no solo donde estás parado. Con una referencia relativa o con un identificador puedes abrirla desde cualquier punto de la historia.

Renombrar una rama renombra un archivo. Eliminarla borra ese archivo. Nada más ocurre.

El estado desconectado no es un error ni es peligroso por sí mismo. Significa que `HEAD` apunta a una confirmación en vez de a una rama. Lo único que hay que recordar es ponerle nombre al trabajo antes de irse.

Y cuando se te olvidó, el registro de referencias lo tiene. Eso lo vas a usar en serio en el laboratorio 06.
