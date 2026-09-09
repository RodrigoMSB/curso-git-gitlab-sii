# Laboratorio 01 · El recetario nace

**Sesión 1 · 90 minutos · sin repositorio semilla**

---

## Qué vas a hacer

Vas a dejar Git configurado a tu nombre, crear tu primer repositorio y levantar el recetario COMIDA CHILENA, que es el proyecto que te va a acompañar durante todo el taller.

Al terminar tendrás cuatro confirmaciones en tu historial y un archivo modificado que dejaste fuera de la última de forma deliberada. Ese último punto es el objetivo real del laboratorio, aunque ahora parezca un detalle.

---

## Antes de empezar

Abre Git Bash y confirma que Git responde.

```
git --version
```

Si no responde, avisa antes de seguir. Todo lo que viene depende de eso.

---

## Parte 1 · Configuración

**Tiempo sugerido, 20 minutos.**

### 1.1 Tu identidad

Cada confirmación queda firmada con un nombre y un correo. Configura los tuyos, con el correo que uses en el trabajo.

```
git config --global user.name "Tu Nombre"
git config --global user.email "tu.correo@institucion.cl"
```

Revisa cómo quedó.

```
git config --global --list
```

Nadie valida ese correo. Git lo escribe tal cual en cada confirmación. Si lo escribes mal, todas tus confirmaciones quedan firmadas mal.

### 1.2 El editor

Git abre un editor cuando necesita que escribas un mensaje largo. Si no le dices cuál, abre uno que probablemente no sepas cerrar.

```
git config --global core.editor "code --wait"
```

La opción `--wait` importa. Sin ella Git no espera a que termines de escribir y se sigue de largo con un mensaje vacío.

### 1.3 Dos alias

Un alias es un atajo. Estos dos los vas a usar cientos de veces durante el taller.

```
git config --global alias.s "status -s"
git config --global alias.lg "log --oneline --graph --all --decorate"
```

Todavía no los pruebes, no tienes repositorio. En un minuto más.

### 1.4 Global frente a local

Todo lo anterior lleva `--global`, o sea vale para cualquier repositorio de tu equipo. Sin esa opción la configuración vale solo para el repositorio donde estás parado.

Eso sirve cuando trabajas con un correo institucional en unos proyectos y uno personal en otros. Lo vas a usar de verdad en la sesión 6.

---

## Parte 2 · El repositorio nace

**Tiempo sugerido, 15 minutos.**

### 2.1 Crear la carpeta y el repositorio

Tu recetario no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
cd ..
mkdir -p taller-git-trabajo/lab-01
cd taller-git-trabajo/lab-01
mkdir recetario
cd recetario
git init
```

Fíjate en lo que respondió Git. Te dice que creó un repositorio vacío y en qué rama estás parado.

### 2.2 Mira lo que apareció

```
ls -a
```

Ahí está `.git`. Esa carpeta oculta **es** el repositorio. Todo lo demás que crees de aquí en adelante es solo tu directorio de trabajo.

No entres todavía. La vas a abrir en el laboratorio 03, cuando tengas confirmaciones propias que valga la pena inspeccionar.

### 2.3 El primer estado

```
git status
```

Léelo completo. Te dice en qué rama estás, que no hay confirmaciones todavía, y que no hay nada que confirmar. Esa última frase va a cambiar en treinta segundos.

---

## Parte 3 · Las tres primeras confirmaciones

**Tiempo sugerido, 30 minutos.**

### 3.1 El archivo de presentación

Crea `README.md` con este contenido.

```
# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
```

Ahora mira el estado.

```
git status
```

Aparece bajo archivos sin seguimiento. Git lo ve pero no lo está siguiendo todavía. Prepáralo y confirma.

```
git add README.md
git status
git commit -m "se inicia el recetario"
```

Ese `git status` del medio no es adorno. Es la única vez que vas a ver el archivo preparado y sin confirmar, y conviene que veas cómo se muestra.

### 3.2 Los platos

Crea `platos.md`.

```
# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
```

Prepara y confirma.

```
git add platos.md
git commit -m "se agregan los platos chilenos"
```

### 3.3 Ingredientes, cocineros y las primeras recetas

Crea `ingredientes.md`.

```
# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
```

Crea `cocineros.md`.

```
# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
```

Crea la carpeta de recetas.

```
mkdir recetas
```

Dentro, `recetas/pastel-de-choclo.md`.

```
# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
```

Y `recetas/empanadas.md`.

```
# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
```

Ahora prepara todo de una vez y confirma.

```
git add .
git commit -m "se agregan ingredientes, cocineros y las primeras recetas"
```

### 3.4 Revisa lo que llevas

```
git log
git log --oneline
git lg
```

Las tres muestran lo mismo con distinto nivel de detalle. La tercera es tu alias.

---

## Parte 4 · La confirmación que no lleva todo

**Tiempo sugerido, 25 minutos.**

Esta parte es el objetivo del laboratorio. Lee antes de escribir.

Hasta aquí preparaste y confirmaste todo junto, así que preparar parece un trámite intermedio sin sentido. Ahora vas a ver para qué sirve de verdad.

### 4.1 Modifica tres archivos

Agrega una línea al final de `platos.md`.

```
- sopaipillas
```

Agrega una línea al final de `ingredientes.md`.

```
- zapallo
```

Y agrega una línea al final de `cocineros.md`, pero **déjala a medias a propósito**, como si te hubieran interrumpido.

```
- Pedro
```

### 4.2 Mira el estado

```
git status
git s
```

Los tres archivos aparecen modificados. Compara las dos salidas, la larga y la de tu alias.

### 4.3 Prepara solo dos

Los platos y los ingredientes están listos. La línea de cocineros no, quedó a medias y no quieres que entre al historial así.

```
git add platos.md ingredientes.md
git status
```

Léelo con calma. Ahora hay dos grupos separados, los cambios preparados y los cambios sin preparar. Ese es el momento del laboratorio.

### 4.4 Confirma

```
git commit -m "se agregan sopaipillas y zapallo"
git status
```

La confirmación se llevó solo lo que preparaste. El cambio en `cocineros.md` sigue ahí, en tu directorio de trabajo, esperando.

Eso es lo que hace el área de preparación. Te deja armar una confirmación distinta de lo que tienes en disco.

---

## Comprobación

Antes de cerrar, verifica que tu repositorio quedó así.

```
git log --oneline
```

Deben aparecer cuatro confirmaciones, la más reciente arriba.

```
git status
```

Debe aparecer `cocineros.md` como modificado y sin preparar, y nada en el área de preparación.

```
git config --global --get alias.lg
```

Debe devolver tu alias.

Si las tres cosas están, terminaste.

---

## Si algo salió mal

**Confirmaste con el mensaje equivocado.** No lo arregles todavía, se resuelve en el laboratorio 02. Anótalo y sigue.

**Confirmaste `cocineros.md` sin querer.** Deshaz solo la confirmación y conserva los archivos.

```
git reset --soft HEAD~1
git restore --staged cocineros.md
git commit -m "se agregan sopaipillas y zapallo"
```

**Te perdiste y quieres empezar de nuevo.** Borra la carpeta `recetario` y vuelve a la parte 2. La configuración global no se pierde, esa ya quedó hecha.

---

## Lo que te llevas

Un repositorio no es una carpeta compartida. Es una carpeta oculta que guarda la historia completa de tu proyecto en tu propia máquina.

Preparar y confirmar son dos pasos distintos, y esa separación existe para que puedas decidir qué entra a cada confirmación. No es un trámite.

Nada de lo que hiciste hoy salió de tu equipo. No hay servidor, no hay red, no hay nadie más viendo esto.
