# Laboratorio 04 · Ordenar el recetario

**Sesión 3 · 75 minutos**

---

## Qué vas a hacer

El recetario que te toca está desordenado y tiene tres archivos que nunca debieron entrar. Uno de ellos es un archivo de credenciales.

Vas a reorganizar la carpeta de recetas, comparar dos formas de renombrar un archivo, y sacar del repositorio lo que no corresponde.

El punto central es el último y es más sutil de lo que parece. Ignorar un archivo y sacarlo del seguimiento son cosas distintas, y si confundes una con otra dejas una credencial dentro de la historia del proyecto.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-04/preparar.sh
cd ../taller-git-trabajo/lab-04/recetario
```

Mira con qué te encontraste.

```
git log --oneline
ls
ls recetas
git status
```

Toma nota de los tres archivos que sobran. Están confirmados en la historia, no son basura suelta en tu directorio.

---

## Parte 1 · Mover y borrar con Git

**Tiempo sugerido, 25 minutos.**

### 1.1 La carpeta desordenada

```
ls recetas
```

Hay recetas mezcladas sin ningún orden. Vas a separarlas por tipo de plato.

```
mkdir recetas/principales
mkdir recetas/postres
```

### 1.2 Mover con Git

```
git mv recetas/pastel-de-choclo.md recetas/principales/
git mv recetas/empanadas.md recetas/principales/
git status
```

Lee la salida. Git dice `renamed` y muestra la ruta vieja y la nueva. Reconoció que es el mismo archivo que cambió de lugar.

Mueve el resto.

```
git mv recetas/leche-asada.md recetas/postres/
git mv recetas/mote-con-huesillo.md recetas/postres/
git status
```

### 1.3 Confirma el orden

```
git commit -m "se ordenan las recetas por tipo de plato"
```

### 1.4 Ahora hazlo por fuera

Ese fue el camino cómodo. Ahora mira qué pasa cuando renombras sin decirle nada a Git.

```
mv platos.md listado-de-platos.md
git status
```

Lee esto con cuidado. Git no dice `renamed`. Dice que borraste un archivo y que apareció otro sin seguimiento. Para Git son dos hechos separados, no un renombrado.

### 1.5 Que Git se dé cuenta

```
git add .
git status
```

Ahora sí dice `renamed`. Git lo dedujo al comparar el contenido, porque los dos archivos son idénticos y concluyó que es el mismo que cambió de nombre.

O sea, `git mv` no hace nada especial. Es un atajo que hace el `mv` y el `add` de una vez. La detección del renombrado ocurre igual.

Déjalo como estaba.

```
git restore --staged listado-de-platos.md
mv listado-de-platos.md platos.md
git status
```

Directorio limpio otra vez.

### 1.6 Borrar con Git

Hay una receta que no va.

```
git rm recetas/postres/mote-con-huesillo.md
git status
git commit -m "se retira la receta que no corresponde al recetario"
```

El archivo desapareció de tu carpeta y del seguimiento. Pero sigue en la historia, en las confirmaciones anteriores. Comprúebalo.

```
git log --oneline -- recetas/mote-con-huesillo.md
```

Nada se borra de verdad en Git. Solo deja de estar en el estado actual.

---

## Parte 2 · Lo que nunca debió entrar

**Tiempo sugerido, 35 minutos.**

Esta es la parte importante.

### 2.1 Mira el problema

```
ls
cat credenciales.txt
```

Ahí hay una credencial. Y no está suelta en tu carpeta, está confirmada.

```
git log --oneline -- credenciales.txt
```

Alguien la agregó y confirmó. Lo mismo pasa con `notas.tmp` y `respaldo.bak`.

### 2.2 El error que casi todos cometen

La reacción natural es crear el archivo de exclusiones y listo. Prueba a ver qué pasa.

Crea `.gitignore` con este contenido.

```
*.tmp
*.bak
credenciales.txt
```

Y mira el estado.

```
git status
```

`.gitignore` aparece como archivo nuevo. Los tres archivos problemáticos no aparecen por ninguna parte.

Parecería resuelto. No lo está.

```
git ls-files
```

Ahí siguen los tres. **El archivo de exclusiones no toca lo que ya está en seguimiento.** Solo evita que Git te moleste con archivos que nunca entraron.

Si te quedas acá, la credencial sigue en el repositorio y se va a publicar completa cuando envíes esto a la plataforma en la sesión 6.

### 2.3 Sacar del seguimiento sin borrar

Necesitas que Git deje de seguir esos archivos, pero sin borrarlos de tu disco, porque `notas.tmp` y `respaldo.bak` a lo mejor los sigues usando.

```
git rm --cached notas.tmp
git rm --cached respaldo.bak
git status
ls
```

Lee las dos cosas. En el estado aparecen como borrados y además como archivos sin seguimiento, porque el archivo de exclusiones todavía no está confirmado. Y en tu carpeta siguen ahí, intactos.

La opción `--cached` es la diferencia. Sin ella, `git rm` borra el archivo del disco también.

### 2.4 La credencial es distinta

Con `credenciales.txt` no basta con sacarlo del seguimiento. El archivo tiene una clave adentro y no lo quieres ni en tu disco.

**ATENCIÓN. La orden siguiente borra el archivo de tu disco además de sacarlo del repositorio. El contenido se pierde de tu carpeta. Sigue estando en la historia del repositorio, así que se puede recuperar de ahí, pero no vas a tener el archivo delante.**

```
git rm credenciales.txt
ls
git status
```

### 2.5 Confirma la limpieza

```
git add .gitignore
git status
git commit -m "se sacan del seguimiento los archivos que no corresponden"
```

Comprueba.

```
git ls-files
git status
```

Los tres desaparecieron del seguimiento. El directorio está limpio. `notas.tmp` y `respaldo.bak` siguen en tu carpeta pero Git ya no los menciona.

### 2.6 El problema que queda

Busca la credencial en la historia.

```
git log --oneline -- credenciales.txt
git show <identificador-de-la-confirmacion-que-la-agrego>
```

Ahí está. Completa y legible.

Sacar un archivo del seguimiento no lo borra del pasado. Cualquiera que clone este repositorio puede recuperar esa credencial recorriendo la historia.

**Esto no se arregla en este laboratorio.** Limpiar el pasado de un repositorio es una operación pesada que reescribe todas las confirmaciones, y solo tiene sentido si el repositorio nunca se publicó. Cuando la credencial ya salió de tu máquina, la única respuesta correcta es rotarla.

Quédate con la regla. La credencial que entró a un repositorio compartido está comprometida, aunque después la borres.

---

## Parte 3 · Prevenir

**Tiempo sugerido, 15 minutos.**

### 3.1 Comprueba que las exclusiones funcionan

```
echo "prueba" > temporal.tmp
git status
```

No aparece. La regla `*.tmp` lo está tapando.

```
rm temporal.tmp
```

### 3.2 Forzar cuando de verdad lo necesitas

A veces un archivo cae bajo una regla de exclusión pero sí lo quieres versionar.

```
echo "esta si va" > importante.tmp
git status
git add -f importante.tmp
git status
```

La opción `-f` pasa por encima de la exclusión. Úsala poco y a conciencia.

Déjalo fuera.

```
git restore --staged importante.tmp
rm importante.tmp
```

### 3.3 Por qué el archivo de exclusiones se confirma

`.gitignore` va dentro del repositorio y viaja con él. Así todo el equipo comparte las mismas reglas y nadie sube por accidente lo que los demás están ignorando.

Si tienes exclusiones que son solo tuyas, van en `.git/info/exclude`, que es local y no se comparte.

```
cat .git/info/exclude
```

---

## Comprobación

```
git ls-files
```

No deben aparecer `notas.tmp`, `respaldo.bak` ni `credenciales.txt`. Sí debe aparecer `.gitignore`.

```
ls
```

`notas.tmp` y `respaldo.bak` siguen en tu carpeta. `credenciales.txt` no.

```
ls recetas/principales recetas/postres
```

Las recetas ordenadas por tipo.

```
git status
```

Directorio limpio.

---

## Si algo salió mal

**Borraste `notas.tmp` del disco sin querer.** Usaste `git rm` sin `--cached`. Recupéralo desde la historia.

```
git checkout HEAD~1 -- notas.tmp
```

**El archivo de exclusiones no está tapando nada.** Revisa que se llame exactamente `.gitignore`, con el punto adelante. Un archivo llamado `gitignore` no hace nada.

**Sigues viendo los archivos en `git status` después de confirmar.** Te faltó el `git rm --cached`. Vuelve al punto 2.3.

---

## Lo que te llevas

Ignorar y sacar del seguimiento son operaciones distintas. El archivo de exclusiones solo actúa sobre lo que nunca entró. Lo que ya está en seguimiento sale con `git rm --cached`.

`git mv` es un atajo, no una operación especial. Git detecta el renombrado comparando contenido, con o sin esa orden.

Nada se borra de la historia. Un archivo eliminado hoy sigue completo en las confirmaciones donde estaba, y una credencial que entró una vez queda comprometida aunque la saques después.
