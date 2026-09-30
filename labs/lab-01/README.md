# Laboratorio 01 · El recetario nace

**Sesión 1 · 90 minutos · sin repositorio semilla**

---

## Qué vas a hacer

Vas a conocer la consola, dejar Git configurado a tu nombre, crear tu primer repositorio y levantar el recetario COMIDA CHILENA, que es el proyecto que te va a acompañar durante todo el taller.

Al terminar tendrás seis confirmaciones en tu historial, cada una con un mensaje que dice qué archivo tocaste y qué hiciste.

Todo lo que está antes de la comprobación es obligatorio y se hace en orden. Cada paso deja el repositorio listo para el siguiente. La sección del final, **Para ir más allá**, es opcional.

---

## Antes de empezar

Abre el taller con doble clic en `TALLER.cmd`, o en `taller.command` si usas Mac, los dos en la carpeta `taller-git`.

### El taller ya está abierto

Todo este laboratorio se escribe en la consola del taller. El grafo y las tres áreas muestran tu repositorio de verdad mientras trabajas. La consola parte en `taller-git`, la carpeta del taller, donde va todo tu trabajo.

Si trabajas sin el programa del taller, `SIMULADOR.html` abierto con doble clic parte en este laboratorio, en el modo de escenarios y sin Git de verdad.

Los pasos marcados **En Visual Studio Code** no se escriben en la consola. Se hacen en la ventana del editor.

---

## Parte 1 · La consola

**Tiempo sugerido, 10 minutos.**

Mira la línea donde escribes. Antes del cursor aparece la carpeta donde estás parado. Todo lo que escribas se ejecuta ahí.

```
pwd
```

Te dice la ruta completa de esa carpeta.

```
ls
```

Lista lo que hay dentro. Deberías ver la carpeta `curso`, que es el clon del curso, y los programas del taller.

```
cd curso
```

Entraste al clon del curso. Mira la línea donde escribes, la carpeta cambió.

```
cd ..
```

Los dos puntos quieren decir la carpeta de arriba. Volviste a `taller-git`, donde estabas, y la línea donde escribes lo dice.

```
clear
```

Limpia la pantalla. No borra nada, solo despeja la vista.

---

## Parte 2 · Configuración

**Tiempo sugerido, 15 minutos.**

### 2.1 Tu identidad

Cada confirmación queda firmada con un nombre y un correo. Configura los tuyos.

```
git config --global user.name "Tu Nombre"
git config --global user.email "tu.correo@institucion.cl"
```

**Usa el correo del trabajo, nunca uno personal.** Nadie valida ese correo. Git lo escribe tal cual en cada confirmación, y esas confirmaciones terminan en el servidor de la institución.

Confirma que quedó.

```
git config user.name
```

Responde con el nombre que acabas de escribir.

### 2.2 La rama principal

```
git config --global init.defaultBranch main
```

Así la rama principal de cada repositorio nuevo se llama `main`. Se llama igual en todos los equipos, y es el nombre que usan los laboratorios que vienen.

### 2.3 El editor

Git abre un editor cuando necesita que escribas un mensaje. Si no le dices cuál, abre uno que probablemente no sepas cerrar.

```
git config --global core.editor "code --wait"
```

La opción `--wait` importa. Sin ella Git no espera a que termines de escribir y se sigue de largo con un mensaje vacío.

### 2.4 Dos alias

Un alias es un atajo. Estos dos los vas a usar cientos de veces durante el taller.

```
git config --global alias.s "status --short"
```

El segundo es largo. **No lo escribas a mano, cópialo y pégalo en la consola.** Un solo carácter distinto y el alias no funciona.

```
git config --global alias.lg "log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all"
```

Muestra la historia como un árbol, con el autor de cada confirmación y hace cuánto se hizo. Todavía no los pruebes, no tienes repositorio.

---

## Parte 3 · El repositorio

**Tiempo sugerido, 10 minutos.**

Tu recetario va en `taller-git`, que es donde parte la consola del taller, y no dentro del clon del curso, que es `taller-git/curso`. Desde ahí, crea la carpeta del laboratorio y el repositorio.

```
mkdir -p lab-01/recetario
cd lab-01/recetario
git init
```

`mkdir` crea una carpeta. Con `-p` crea también las carpetas intermedias que falten, en este caso `lab-01` y dentro de ella `recetario`.

Fíjate en lo que respondió Git. Te dice que creó un repositorio vacío.

```
git status
```

Te dice en qué rama estás, que no hay confirmaciones todavía, y que no hay nada que confirmar.

Ahora abre esta carpeta en Visual Studio Code.

```
code .
```

El punto quiere decir esta carpeta. Se abre una ventana de Visual Studio Code solo con tu recetario, y ahí vas a crear y editar los archivos del laboratorio.

---

## Parte 4 · Las tres áreas

**Tiempo sugerido, 20 minutos.**

**En Visual Studio Code.** Crea `README.md`. En el explorador de la izquierda aprieta el botón de archivo nuevo, escribe el nombre y aprieta Enter. Pega este contenido y guarda con Ctrl+S, o con Cmd+S en Mac.

```
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
```

Vuelve a la consola.

```
git status
```

Aparece bajo archivos sin seguimiento. Está en tu directorio de trabajo, y Git lo ve pero no lo sigue todavía.

```
git add README.md
git status
```

Ahora aparece como cambio por confirmar. Está en el área de preparación.

Sácalo de ahí, sin borrarlo.

```
git rm --cached README.md
git status
```

Volvió a estar sin seguimiento. El archivo sigue en tu carpeta, solo dejó de estar preparado.

Prepáralo otra vez y confírmalo.

```
git add README.md
git commit -m "README.md: se inicia el recetario"
```

El mensaje sigue la convención del taller. Primero el archivo, dos puntos, y después lo que se hizo.

```
git log
```

Ahí está tu primera confirmación, ya en el repositorio, con tu nombre, tu correo y la fecha. Directorio de trabajo, área de preparación y repositorio. Esas son las tres áreas.

---

## Parte 5 · Visual Studio Code y el editor

**Tiempo sugerido, 15 minutos.**

**En Visual Studio Code.** Crea `platos.md` con este contenido y guárdalo.

```
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
```

Mira la barra de la izquierda. El archivo aparece con una **U**, de sin seguimiento, y el ícono de control de código fuente muestra un número. Visual Studio Code te dice lo mismo que `git status`.

```
git add .
```

El punto quiere decir todo lo que cambió en esta carpeta. Ahora confirma sin `-m`.

```
git commit
```

**En Visual Studio Code.** Se abre una pestaña para escribir el mensaje. En la primera línea escribe `platos.md: se agregan los platos chilenos`, guarda y cierra la pestaña. Solo entonces Git termina la confirmación.

```
git log
```

Dos confirmaciones, la más reciente arriba.

---

## Parte 6 · Uno por uno

**Tiempo sugerido, 15 minutos.**

Cada archivo va en su propia confirmación, con su propio mensaje.

**En Visual Studio Code.** Crea `ingredientes.md`.

```
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
```

```
git add ingredientes.md
git commit -m "ingredientes.md: se agregan los ingredientes"
```

**En Visual Studio Code.** Crea `cocineros.md`.

```
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
```

```
git add cocineros.md
git commit -m "cocineros.md: se agregan los cocineros"
```

Ahora una carpeta con dos recetas.

```
mkdir recetas
```

**En Visual Studio Code.** Crea `recetas/pastel-de-choclo.md`. Selecciona primero la carpeta `recetas` en el explorador y después aprieta el botón de archivo nuevo, para que el archivo quede adentro. El nombre es `pastel-de-choclo.md`.

```
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
```

**En Visual Studio Code.** Crea `recetas/empanadas.md`, también con la carpeta `recetas` seleccionada. El nombre es `empanadas.md`.

```
# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
```

Una carpeta se prepara entera nombrándola. Cuando la confirmación es una carpeta, el mensaje lo dice con la palabra CARPETA.

```
git add recetas/
git commit -m "CARPETA recetas: se agrega carpeta"
```

Mira la historia con tu alias.

```
git lg
```

Cinco confirmaciones, cada una con su autor y hace cuánto se hizo. En la consola del taller se ve sin colores. En Git Bash o en la terminal de tu Mac el mismo alias sale con colores.

---

## Parte 7 · El atajo

**Tiempo sugerido, 5 minutos.**

**En Visual Studio Code.** Agrega esta línea al final de `platos.md` y guarda.

```
- sopaipillas
```

Un archivo que Git ya sigue se puede preparar y confirmar en una sola orden, con `-a`.

```
git commit -am "platos.md: se agregan sopaipillas"
git s
```

Tu alias corto no muestra nada. No queda ningún cambio pendiente.

Cuidado con `-a`. Solo toma archivos que Git ya sigue. Un archivo nuevo necesita su `git add`.

---

## Comprobación

Que el verificador lo confirme. Escríbelo en la consola, desde cualquier carpeta.

```
verificar 01
```

Imprime una línea por criterio. Si alguno falla, dice qué esperaba y qué encontró.

---

## Para ir más allá

Esta sección es opcional. El verificador no la revisa y ningún laboratorio siguiente la necesita.

### A. La confirmación que no lleva todo

Hasta aquí preparaste siempre todo lo que cambiaste. El área de preparación sirve para algo más, armar una confirmación distinta de lo que tienes en disco.

Agrega `- porotos granados` al final de `platos.md` y `- zapallo` al final de `ingredientes.md`.

Y agrega una línea al final de `cocineros.md`, pero **déjala a medias a propósito**, como si te hubieran interrumpido.

```
- Pedro
```

```
git status
git s
```

Los tres archivos aparecen modificados. Compara las dos salidas, la larga y la de tu alias.

Los platos y los ingredientes están listos. La línea de cocineros no, quedó a medias y no quieres que entre al historial así.

```
git add platos.md ingredientes.md
git status
```

Ahora hay dos grupos separados, los cambios preparados y los cambios sin preparar.

```
git commit -m "platos.md e ingredientes.md: se agregan porotos granados y zapallo"
git status
```

La confirmación se llevó solo lo que preparaste. El cambio en `cocineros.md` sigue en tu directorio de trabajo, esperando.

### B. Dónde vive el repositorio

```
ls -a
```

Ahí está `.git`. Esa carpeta oculta **es** el repositorio. Todo lo demás es tu directorio de trabajo. No entres todavía, la vas a abrir en el laboratorio 02.

### C. Global frente a local

Todo lo que configuraste lleva `--global`, o sea vale para cualquier repositorio de tu equipo. Sin esa opción la configuración vale solo para el repositorio donde estás parado.

```
git config user.email "otro.correo@institucion.cl"
git config user.email
git config --global user.email
```

La primera respuesta es la local, que en este repositorio manda sobre la global. La segunda es la global, que sigue intacta.

Sirve cuando trabajas con un correo en unos proyectos y otro en otros. Deshaz la prueba.

```
git config --unset user.email
git config user.email
```

Volvió a responder el correo global.

---

## Si algo salió mal

**Algo no resultó como dice el enunciado.** Avísale al relator antes de seguir.

**Te perdiste y quieres empezar de nuevo.** Borra la carpeta `lab-01/recetario` y vuelve a la parte 3. La configuración global no se pierde, esa ya quedó hecha.

---

## Lo que te llevas

Un repositorio no es una carpeta compartida. Es una carpeta oculta que guarda la historia completa de tu proyecto en tu propia máquina.

Un archivo pasa por tres áreas. El directorio de trabajo, el área de preparación y el repositorio. `git add` lo lleva a la segunda y `git commit` a la tercera.

Cada confirmación lleva un mensaje que dice qué archivo tocaste y qué hiciste.

Nada de lo que hiciste hoy salió de tu equipo. No hay servidor, no hay red, no hay nadie más viendo esto.
