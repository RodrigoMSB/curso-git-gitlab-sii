# Laboratorio 03 · Abrir la caja

**Sesión 2 · 55 minutos**

---

## Qué vas a hacer

Vas a abrir la carpeta `.git` y mirar qué hay adentro.

No es un ejercicio de curiosidad. Cuando termines vas a saber que una rama son cuarenta y un bytes de texto en un archivo, y esa sola cosa hace que el resto del taller deje de ser magia. El rebase, el estado desconectado y el registro de referencias se explican solos una vez que sabes esto.

Al final tienes que ser capaz de explicar con tus propias palabras qué es una rama. Ese es el objetivo, no la lista de órdenes.

---

## Preparación

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-03/preparar.sh
cd ../taller-git-trabajo/lab-03/recetario
```

Confirma el punto de partida.

```
git log --oneline
git status
```

Cuatro confirmaciones y el directorio limpio. Nada que arreglar hoy, solo mirar.

---

## Parte 1 · El mapa de la carpeta

**Tiempo sugerido, 10 minutos.**

### 1.1 Qué hay adentro

```
ls -a
ls .git
```

Hay bastante. La mayoría no te interesa hoy. Estos son los cuatro que importan.

**HEAD**, un archivo que dice dónde estás parado.
**refs**, donde viven las ramas y las etiquetas.
**objects**, donde vive todo el contenido de tu proyecto.
**config**, la configuración de este repositorio en particular.

### 1.2 La configuración local

```
cat .git/config
```

Ahí está lo que configuraste sin `--global` en el laboratorio 01. Es texto plano y se puede editar a mano, aunque conviene usar `git config`.

---

## Parte 2 · Dónde estás parado

**Tiempo sugerido, 10 minutos.**

### 2.1 El archivo HEAD

```
cat .git/HEAD
```

Una línea. Dice que apuntas a una rama, y cuál.

No dice a qué confirmación. Dice a qué **rama**. Esa distinción es la que hace que cambiar de rama sea instantáneo.

### 2.2 La rama por dentro

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

### 2.3 Compruébalo

```
git log --oneline -1
```

El identificador corto que muestra Git son los primeros caracteres del que acabas de leer en el archivo.

---

## Parte 3 · Los objetos

**Tiempo sugerido, 25 minutos.**

Ahora vas a seguir la cadena completa, desde la rama hasta el contenido de un archivo.

### 3.1 Guarda el identificador

```
git rev-parse HEAD
```

Ese es el identificador completo de la confirmación donde estás. Anótalo o cópialo, lo vas a usar varias veces.

### 3.2 Qué tipo de objeto es

```
git cat-file -t HEAD
```

Responde que es una confirmación. Git guarda cuatro tipos de objeto y este es uno de ellos.

### 3.3 Qué tiene adentro

```
git cat-file -p HEAD
```

Lee la salida con calma. Tiene cuatro cosas.

Un **árbol**, que es el contenido de tu proyecto en ese momento.
Un **padre**, que es la confirmación anterior.
El **autor** y el **confirmador**, con sus fechas.
El **mensaje** que escribiste.

Ahí está la estructura completa de Git. Una confirmación apunta a un contenido y apunta a la anterior. Eso es todo.

### 3.4 El árbol

Copia el identificador del árbol de la salida anterior y míralo.

```
git cat-file -p <identificador-del-arbol>
```

Es una lista de lo que hay en la raíz de tu proyecto. Cada línea tiene el tipo, el identificador y el nombre.

Los archivos aparecen como `blob`. La carpeta `recetas` aparece como `tree`, o sea otro árbol. Los árboles contienen árboles, igual que las carpetas contienen carpetas.

### 3.5 Entra a la carpeta

```
git cat-file -p <identificador-del-arbol-de-recetas>
```

Ahí están las recetas, cada una con su propio identificador.

### 3.6 Llega al contenido

Copia el identificador de uno de los archivos y míralo.

```
git cat-file -p <identificador-del-archivo>
```

Ese es el contenido del archivo tal como quedó en esa confirmación. Llegaste al final de la cadena.

Recorriste esto.

```
rama → confirmación → árbol → árbol → contenido
```

Todo el repositorio es esa cadena repetida.

### 3.7 El padre

Vuelve a mirar la confirmación y copia el identificador del padre.

```
git cat-file -p <identificador-del-padre>
```

Otra confirmación, con su propio árbol y su propio padre. Sigue hacia atrás hasta llegar a una que no tenga padre. Esa es la primera del repositorio.

Ese encadenamiento hacia atrás es la historia. No hay una lista de confirmaciones en ninguna parte, solo cada una apuntando a la anterior.

---

## Parte 4 · Comprobar lo que aprendiste

**Tiempo sugerido, 10 minutos.**

### 4.1 Crea una rama y mira qué pasó

```
ls .git/refs/heads
git branch prueba
ls .git/refs/heads
cat .git/refs/heads/prueba
cat .git/refs/heads/main
```

Apareció un archivo nuevo con el mismo identificador adentro. Eso es todo lo que hizo crear una rama. Ningún archivo de tu proyecto se tocó.

### 4.2 Cambia de rama y mira qué se movió

```
cat .git/HEAD
git switch prueba
cat .git/HEAD
```

Cambió una línea en un archivo. Las dos ramas siguen apuntando a lo mismo, tu proyecto no cambió, y lo único distinto es dónde dice que estás parado.

### 4.3 Vuelve y limpia

```
git switch main
git branch -d prueba
ls .git/refs/heads
```

El archivo desapareció. Eso es borrar una rama.

### 4.4 La pregunta

Escribe en una línea, con tus palabras, qué es una rama.

Si tu respuesta usa las palabras copia, carpeta o espacio de trabajo, vuelve a la parte 2.2.

---

## Comprobación

```
cat .git/HEAD
```

Debe apuntar a `main`.

```
ls .git/refs/heads
```

Debe aparecer solo `main`.

```
git status
```

Directorio limpio. No modificaste nada de tu proyecto en todo el laboratorio, solo miraste.

---

## Si algo salió mal

**Editaste un archivo dentro de `.git` a mano.** Vuelve a ejecutar `preparar.sh`. Editar ahí a mano es la única forma real de dañar un repositorio.

**Te quedaste sin rama después de un `switch`.** Vuelve con `git switch main`.

**No entendiste la cadena de objetos.** No es raro en la primera pasada. Repite la parte 3 con una confirmación distinta, y esta vez anota en un papel cada identificador antes de seguir al siguiente.

---

## Lo que te llevas

Una rama es un archivo de texto con un identificador de confirmación adentro. Crear una rama no mueve nada, solo escribe ese archivo.

Cambiar de rama modifica una línea en `HEAD`. Por eso es instantáneo aunque el proyecto tenga miles de archivos.

Una confirmación apunta a un contenido y a la confirmación anterior. La historia completa es esa cadena hacia atrás, no una lista guardada en alguna parte.

Nada de esto es magia. Es texto en archivos, y lo acabas de leer con tus propios ojos.
