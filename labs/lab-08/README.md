# Laboratorio 08 · Dos remotos, un submódulo y un gancho

**Sesión 5 · 65 minutos**

---

## Qué vas a hacer

Tres cosas que no tienen mucho que ver entre sí, salvo que las tres son piezas que aparecen en proyectos reales y que casi nadie explica bien.

Vas a trabajar con dos repositorios remotos a la vez, vas a incorporar un repositorio dentro de otro, y vas a escribir un gancho que rechace confirmaciones mal hechas.

Todo ocurre en tu máquina. Todavía no hay plataforma ni red, eso empieza en la sesión 6.

---

## Preparación

**Este laboratorio entero va en tu terminal.** Es el único del taller que no se puede seguir en el simulador, y no es un descuido: lo que enseña son dos remotos, un submódulo y un gancho, y el simulador no modela ninguna de las tres cosas. No tiene ramas de seguimiento remoto, ni órdenes de red, ni repositorios dentro de otros, ni ejecuta ganchos. Un escenario suyo te mostraría la historia local y nada de lo que vienes a aprender.

Tu trabajo no va dentro del clon del curso, va al lado. Párate en la raíz del clon, la carpeta `curso-git-gitlab-sii`, y desde ahí:

```
labs/lab-08/preparar.sh
cd ../taller-git-trabajo/lab-08/recetario
```

La preparación deja dos repositorios. El recetario donde vas a trabajar y uno aparte con condimentos, que vas a incorporar más adelante. Los dos quedan empaquetados al lado del recetario, que es de donde los vas a traer.

```
git log --oneline
git remote -v
```

---

## Parte 1 · Dos remotos

**Tiempo sugerido, 25 minutos.**

### 1.1 Qué es un remoto

Un remoto es un nombre corto para la dirección de otro repositorio. Nada más. No implica internet ni servidor, puede ser una carpeta en tu propio disco, que es justamente lo que vas a usar hoy.

```
git remote -v
```

Ahí está `origin`, que es el nombre que Git le pone por defecto al repositorio del que clonaste.

### 1.2 Mira qué trae

```
git fetch origin
git branch -a
```

Las que empiezan con `remotes/` son ramas de seguimiento. No son tuyas, son una foto de cómo estaba el otro repositorio la última vez que preguntaste.

### 1.3 El segundo remoto

Esta es la situación real. Trabajas sobre una copia de un proyecto de otra persona. Tu copia es `origin`, y el proyecto original se llama por convención `upstream`, que en español sería el repositorio de aguas arriba.

Agrégalo.

```
git remote add upstream ../recetario.bundle
git remote -v
```

Ahora tienes dos.

### 1.4 Traer desde el segundo

```
git fetch upstream
git branch -a
```

Aparecieron ramas nuevas, las de `upstream`.

Fíjate en que `fetch` no tocó nada tuyo. Solo trajo información y la dejó en las ramas de seguimiento. Tu rama de trabajo sigue igual.

```
git log --oneline
git log --oneline upstream/main
```

### 1.5 Ver qué te falta

```
git log --oneline main..upstream/main
```

Eso es lo que el proyecto original tiene y tú no.

### 1.6 Incorporarlo

Ahora sí vas a mover tu rama.

```
git switch main
git merge upstream/main
git log --oneline
```

Es una fusión normal, como las del laboratorio 05. La única diferencia es que la otra rama vino de otro repositorio.

### 1.7 La distinción que importa

`fetch` trae y no toca nada tuyo. Es siempre seguro.

`pull` es `fetch` seguido de una fusión automática. Es cómodo y es la fuente de casi todos los sustos, porque fusiona antes de que tú hayas mirado qué venía.

Compruébalo.

```
git fetch upstream
git status
```

No pasó nada. Esa es la gracia.

La costumbre sana es `fetch`, mirar qué llegó, y recién entonces decidir. En la sesión 6 vas a ver esto de nuevo con la plataforma de por medio.

### 1.8 Quitar un remoto

```
git remote remove upstream
git remote -v
```

---

## Parte 2 · Un submódulo

**Tiempo sugerido, 25 minutos.**

### 2.1 El problema que resuelve

Tienes un repositorio de condimentos que quieres usar dentro del recetario, pero que se mantiene aparte y tiene su propia historia.

Copiar los archivos adentro rompería esa separación. Un submódulo es la alternativa.

### 2.2 Incorpóralo

```
git submodule add "$(cd .. && pwd)/condimentos.bundle" condimentos
git status
ls condimentos
```

Aparecieron dos cosas en el estado. La carpeta `condimentos` y un archivo nuevo llamado `.gitmodules`.

```
cat .gitmodules
```

Ahí está la dirección del otro repositorio y dónde va montado.

### 2.3 Lo que Git guardó en realidad

Confirma y después mira qué quedó.

```
git add .
git commit -m "se incorporan los condimentos como submodulo"
git ls-files -s condimentos
```

Lee esa salida con cuidado. No hay archivos. Hay **un identificador de confirmación**.

Eso es lo único que tu repositorio guarda del submódulo. No su contenido, solo un apuntador a una confirmación específica del otro repositorio.

### 2.4 La sorpresa

Clona tu recetario en limpio, como lo haría otra persona.

```
cd ..
git clone recetario recetario-copia
cd recetario-copia
ls
ls condimentos
```

La carpeta `condimentos` existe pero está **vacía**.

Esta es la sorpresa que se lleva todo el mundo la primera vez. Un clon normal no trae el contenido de los submódulos.

### 2.5 Traerlo

```
git submodule init
git submodule update
ls condimentos
```

Ahora sí.

O en un solo paso desde el principio.

```
cd ..
rm -rf recetario-copia
git clone --recurse-submodules recetario recetario-copia
ls recetario-copia/condimentos
```

### 2.6 El costo

```
cd recetario-copia/condimentos
git log --oneline
git status
```

Estás dentro de otro repositorio, con su propia historia y su propio estado. Y fíjate en algo.

```
git branch
```

Estás en estado desconectado, el mismo del laboratorio 04. Es lo normal en un submódulo, porque el repositorio padre apunta a una confirmación, no a una rama.

Cada vez que quieras actualizar el submódulo tienes que entrar, moverte a una rama, traer los cambios, salir, y confirmar en el padre que ahora apunta a otra confirmación. Son cuatro pasos donde uno esperaría uno.

Por eso los submódulos se usan poco y con criterio. Resuelven un problema real, pero cobran caro en mantenimiento.

```
cd ../..
rm -rf recetario-copia
cd recetario
```

---

## Parte 3 · Un gancho

**Tiempo sugerido, 15 minutos.**

### 3.1 Qué son

Los ganchos son scripts que Git ejecuta solo en ciertos momentos. Están en `.git/hooks`.

```
ls .git/hooks
```

Todos terminan en `.sample` y por eso no corren. Son ejemplos que Git deja ahí.

### 3.2 Escribe uno

Vas a rechazar confirmaciones con mensajes demasiado cortos.

Crea el archivo `.git/hooks/commit-msg` con este contenido.

```
#!/bin/sh

mensaje=$(cat "$1")
largo=${#mensaje}

if [ "$largo" -lt 15 ]; then
  echo "El mensaje es muy corto. Escribe al menos 15 caracteres."
  echo "Escribiste $largo."
  exit 1
fi
```

Y dale permiso de ejecución, sin lo cual no corre.

```
chmod +x .git/hooks/commit-msg
```

### 3.3 Pruébalo fallando

```
echo "prueba" >> platos.md
git add platos.md
git commit -m "arreglo"
```

Rechazado. La confirmación no se hizo.

```
git log --oneline -1
git status
```

Tus cambios siguen preparados, esperando.

### 3.4 Pruébalo pasando

```
git commit -m "se agrega una linea de prueba al listado"
git log --oneline -1
```

Aceptado.

### 3.5 Lo que hay que saber

**Los ganchos no viajan con el repositorio.** Están dentro de `.git`, que no se versiona.

Compruébalo.

```
git status
ls -l .git/hooks/commit-msg
```

El gancho no aparece en el estado porque Git no lo ve como parte del proyecto.

Eso significa que si tu equipo necesita el mismo gancho, cada persona tiene que instalarlo en su máquina. La forma habitual de resolverlo es dejar los ganchos en una carpeta versionada del proyecto y un script que los copie o los enlace.

Y hay algo más importante. Un gancho local se puede saltar.

```
echo "otra prueba" >> platos.md
git add platos.md
git commit -m "corto" --no-verify
git log --oneline -1
```

Pasó igual.

Por eso los ganchos del lado del cliente sirven para ayudar, no para obligar. Lo que de verdad obliga vive del lado del servidor, y eso lo vas a ver en la sesión 8.

Deshaz esa última confirmación.

```
git reset --soft HEAD~1
git restore --staged platos.md
git restore platos.md
```

---

## Comprobación

```
git remote -v
```

Solo `origin`.

```
cat .gitmodules
```

Debe existir y apuntar a los condimentos.

```
git ls-files -s condimentos
```

Debe devolver una línea con un identificador de confirmación.

```
ls -l .git/hooks/commit-msg
```

Debe existir y tener permiso de ejecución.

```
git status
```

Directorio limpio.

---

## Si algo salió mal

**El gancho no se ejecuta.** Casi siempre es el permiso. Revisa con `ls -l .git/hooks/commit-msg` que aparezca la `x`.

**El submódulo quedó vacío después de clonar.** Es lo esperado. `git submodule init` y `git submodule update`.

**Agregaste el remoto con la dirección equivocada.** Quítalo y agrégalo de nuevo.

```
git remote remove upstream
```

**Te quedó una carpeta `recetario-copia` dando vueltas.** Bórrala, era solo para el ejercicio.

```
rm -rf ../recetario-copia
```

---

## Lo que te llevas

Un remoto es un nombre corto para la dirección de otro repositorio, y puede ser una carpeta local. Puedes tener varios a la vez.

`fetch` trae información y no toca tu trabajo. `pull` trae y fusiona de una vez. La costumbre sana es traer, mirar y después decidir.

Un submódulo guarda un identificador de confirmación, no archivos. Por eso un clon normal lo deja vacío y hay que inicializarlo.

Los ganchos del lado del cliente no viajan con el repositorio y se pueden saltar con `--no-verify`. Sirven para ayudar al que quiere hacer las cosas bien, no para impedir que alguien las haga mal.
