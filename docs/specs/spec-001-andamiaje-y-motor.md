# SPEC 001 · Andamiaje del repositorio y motor del simulador

Proyecto Taller Git y GitLab para el SII.
Arquitecto Claude · Product owner Rodrigo Silva Bravo · Desarrollo Claude Code.

Este es el primer spec del proyecto. Cubre la creacion del repositorio, su estructura, el motor del simulador y su cobertura de pruebas. La interfaz visual del simulador es materia del SPEC 002 y no se aborda aqui, salvo el andamiaje minimo que permita verificar que el motor funciona.

---

## 1. Contexto

Se esta construyendo el instrumental de apoyo para un taller de 32 horas sobre Git y GitLab dictado en modalidad remota a funcionarios del Servicio de Impuestos Internos. Los participantes no tienen manejo previo de Git.

La pieza central es un simulador visual que muestra el grafo de confirmaciones reaccionando en vivo a las ordenes que el participante escribe en una consola simulada. El simulador acompana las primeras cuatro sesiones y despues se retira, porque las tecnicas avanzadas se practican en la consola real.

El repositorio ademas alojara los repositorios semilla de cada laboratorio, los enunciados, el material de clase y, en specs posteriores, un entorno autocontenido con interprete y librerias incluidas.

## 2. Restricciones que condicionan el diseno

**R1. El resultado debe abrirse sin servidor.** El participante hace doble clic sobre un archivo y funciona. Nada de levantar un proceso, nada de instalar dependencias, nada de permisos de administrador.

**R2. No puede depender de la red en tiempo de ejecucion.** La red institucional tiene proxy con filtrado. La unica operacion que usa red es la clonacion inicial del repositorio. Ninguna biblioteca se carga desde una red de distribucion de contenido en tiempo de ejecucion, todo va empaquetado.

**R3. El motor no puede depender de la interfaz.** El modelo de confirmaciones, ramas y punteros vive en codigo puro sin React, sin acceso al documento y sin efectos de entorno. Esto permite probarlo de forma automatizada y reemplazar la capa visual sin tocar la logica.

**R4. Es una simulacion, no una implementacion de Git.** No hay archivos reales ni contenido versionado. Hay nodos, punteros y estados de archivo declarados. Es una virtud del diseno, no una limitacion, porque lo que se quiere mostrar es el grafo.

## 3. Ubicacion y creacion del repositorio

El product owner trabajara dentro de una carpeta local llamada `GIT-GITLAB`. El repositorio se crea dentro de esa carpeta.

```
GIT-GITLAB/
└── curso-git-gitlab-sii/          <- repositorio
```

Tareas.

**3.1** Crear el repositorio local en `GIT-GITLAB/curso-git-gitlab-sii` con rama principal llamada `main`.

**3.2** Crear el repositorio remoto en GitHub bajo la cuenta del product owner, privado, con el mismo nombre `curso-git-gitlab-sii`, y enlazarlo como remoto de origen.

**3.3** El repositorio debe quedar con historial limpio y confirmaciones atomicas. Una confirmacion por unidad de trabajo con mensaje descriptivo en espanol. No se acepta una unica confirmacion inicial con todo adentro.

## 4. Estructura de carpetas

```
curso-git-gitlab-sii/
├── README.md
├── .gitignore
├── .editorconfig
├── docs/
│   ├── specs/                  <- este documento y los siguientes
│   └── arquitectura.md
├── simulador/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── core/               <- motor puro, sin React
│   │   ├── escenarios/         <- estados iniciales por sesion
│   │   ├── ui/                 <- capa visual, SPEC 002
│   │   └── main.tsx
│   └── tests/
├── semillas/                   <- repositorios semilla, SPEC 003
├── labs/                       <- enunciados, spec posterior
└── material/                   <- presentaciones y guias
```

Las carpetas `semillas`, `labs` y `material` se crean vacias con un archivo `.gitkeep` y una linea de README que indique su proposito. No se llenan en este spec.

## 5. Tecnologias

**5.1** Antes de escribir el archivo de dependencias, verificar en linea las versiones estables mas recientes de React, TypeScript, Vite, Tailwind y Vitest. No fijar versiones de memoria. Dejar constancia de las versiones elegidas en `docs/arquitectura.md`.

**5.2** El proyecto usa TypeScript en modo estricto. Activar `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. No se admite `any` en el codigo del motor.

**5.3** El empaquetado debe producir un unico archivo HTML autocontenido, con el codigo y los estilos incrustados, sin recursos externos. Evaluar `vite-plugin-singlefile` u otra solucion equivalente que cumpla la restriccion R1. Si se elige otra, justificar en `docs/arquitectura.md`.

**5.4** Pruebas con Vitest. El motor debe quedar cubierto por pruebas antes de que exista interfaz.

## 6. Modelo de dominio

El motor expone un estado inmutable. Cada orden recibe un estado y devuelve un estado nuevo junto con las lineas de salida que la consola debe mostrar. No se muta el estado recibido.

Entidades minimas.

**Confirmacion.** Identificador corto de siete caracteres hexadecimales, mensaje, lista de identificadores padre y carril de dibujo. Dos padres significan confirmacion de union.

**Rama.** Nombre asociado a un identificador de confirmacion. Nada mas. El spec insiste en esto porque es el concepto que el curso necesita transmitir.

**Etiqueta.** Nombre asociado a un identificador de confirmacion, con distincion entre simple y anotada.

**Puntero de posicion.** Apunta a una rama o directamente a una confirmacion. El segundo caso es el estado desconectado.

**Archivo.** Nombre y estado, dentro del conjunto limpio, modificado o preparado. No hay contenido.

**Entrada de guardado temporal.** Mensaje y lista de archivos afectados. Se comporta como pila.

**Registro de referencias.** Historial de las posiciones por las que paso cada rama, para poder recuperar confirmaciones huerfanas.

## 7. Ordenes que debe interpretar el motor

Se implementan en este spec las siguientes, con las opciones indicadas.

| Orden | Opciones exigidas |
|---|---|
| `git init` | sin opciones |
| `git config` | `user.name`, `user.email`, `--global` |
| `git status` | forma larga y `-s` |
| `git add` | archivo puntual, `.`, `-A` |
| `git restore` | archivo puntual, `--staged` |
| `git commit` | `-m`, `--amend` |
| `git log` | `--oneline`, `--graph`, `-n`, `--all` |
| `git diff` | sin opciones y `--staged` |
| `git branch` | listar, crear, `-d`, `-D`, `-m` |
| `git switch` | cambiar, `-c` |
| `git checkout` | cambiar, `-b`, `--` para descartar |
| `git merge` | fusion normal, `--abort` |
| `git tag` | listar, crear simple, `-a` con `-m`, `-d` |
| `git reset` | `--soft`, `--mixed`, `--hard`, con referencia |
| `git revert` | con referencia |
| `git stash` | `push` con `-m`, `save`, `list`, `list --stat`, `show`, `apply`, `apply` con indice, `pop`, `drop`, `clear` |
| `git reflog` | sin opciones |
| `git rebase` | rebase simple sobre una rama |
| `git remote` | `-v`, `add` |

Ademas debe reconocer un pequeno conjunto de ordenes del interprete de mandatos para que la consola resulte creible, al menos `ls`, `pwd`, `clear`, `cat` y `echo` con redireccion de anexion sobre un archivo, que marca ese archivo como modificado.

Cualquier orden no reconocida devuelve un mensaje de error con el mismo formato que entrega un interprete real.

## 8. Comportamientos que el motor debe respetar

Estos puntos son el nucleo pedagogico del simulador. Una implementacion que los incumpla es incorrecta aunque las pruebas basicas pasen.

**8.1 Crear una rama no mueve nada.** Solo agrega un nombre apuntando a la confirmacion actual.

**8.2 Cambiar de rama mueve unicamente el puntero de posicion.** Ninguna confirmacion cambia.

**8.3 La fusion distingue tres casos.** Si la otra rama ya esta contenida en la actual, informa que no hay nada que hacer. Si la actual esta contenida en la otra, avanza el puntero sin crear confirmacion. En cualquier otro caso crea una confirmacion con dos padres.

**8.4 El rebase produce confirmaciones nuevas.** Los identificadores resultantes son distintos de los originales, y los originales permanecen en el modelo como huerfanos hasta que el recolector los elimine. El motor no los borra. Esta es la razon de existir del registro de referencias en el curso.

**8.5 El retroceso destructivo no destruye confirmaciones.** Mueve el puntero de la rama y las confirmaciones quedan huerfanas, recuperables mediante el registro de referencias.

**8.6 El guardado temporal se comporta como pila.** La entrada mas reciente ocupa el indice cero, y extraer saca la de arriba.

**8.7 La reversion no reescribe historia.** Crea una confirmacion nueva que deshace los efectos de otra, y ambas conviven en el grafo.

## 9. Previsualizacion

El motor debe exponer una funcion que, dada una orden y un estado, devuelva el estado resultante sin aplicarlo, junto con la lista de identificadores de las confirmaciones que serian nuevas y la indicacion de si el puntero de posicion se movio.

Esta funcion se apoya en la misma logica de ejecucion, no en una implementacion paralela. Duplicar la logica es motivo de rechazo.

La interfaz usara esto para dibujar en trazo discontinuo lo que va a ocurrir antes de que el participante confirme la ejecucion.

## 10. Escenarios iniciales

Cuatro escenarios, uno por cada una de las primeras cuatro sesiones del taller. Cada uno se define de forma declarativa en `src/escenarios` y produce un estado inicial.

**E1 sesion 1.** Repositorio recien creado, sin confirmaciones, con archivos del recetario presentes en el directorio de trabajo y sin seguimiento.

**E2 sesion 2.** Historia lineal de cuatro confirmaciones en `main`, un archivo modificado y una confirmacion con mensaje mal escrito para practicar la correccion.

**E3 sesion 3.** Historia de cuatro confirmaciones en `main` y una rama `tailandesa` con dos confirmaciones que se separa en la tercera. Archivos temporales y un archivo con una credencial presentes, sin exclusiones definidas.

**E4 sesion 4.** Igual que E3 pero con las dos ramas divergiendo sobre el mismo archivo, de modo que fusionarlas produzca conflicto.

El caso es el recetario COMIDA CHILENA. Archivos `platos.md`, `ingredientes.md`, `cocineros.md`, `README.md` y carpeta `recetas`. Ramas `main`, `tailandesa`, `mexicana` y `peruana`.

## 11. Criterios de aceptacion

**CA1.** El repositorio existe en local y en GitHub, con al menos ocho confirmaciones atomicas y mensajes en espanol.

**CA2.** `npm run build` produce un unico archivo HTML que se abre con doble clic desde el sistema de archivos y funciona sin conexion a la red.

**CA3.** `npm test` pasa con cobertura del motor sobre el noventa por ciento de lineas.

**CA4.** Existe una prueba especifica por cada punto de la seccion 8. Ocho pruebas como minimo, nombradas de forma que se identifique el comportamiento verificado.

**CA5.** Existe una prueba que ejecuta la siguiente secuencia sobre E3 y verifica el estado final. Crear rama `mexicana`, cambiar a ella, modificar `platos.md`, prepararlo, confirmar, volver a `main`, fusionar `mexicana`. El resultado esperado es un avance de puntero sin confirmacion de union.

**CA6.** Existe una prueba que ejecuta un rebase sobre E3 y verifica que ninguno de los identificadores originales de la rama rebasada aparece entre los identificadores de la rama resultante, y que los originales siguen presentes en el modelo.

**CA7.** La previsualizacion de `git merge` sobre E4 devuelve exactamente una confirmacion nueva sin haber alterado el estado de entrada.

**CA8.** El archivo `docs/arquitectura.md` documenta las versiones elegidas, la solucion de empaquetado en un archivo unico y las decisiones que se apartaron de este spec, si las hubo.

**CA9.** El archivo `README.md` explica en espanol como construir, como probar y donde queda el archivo resultante, dirigido a alguien que no participo del desarrollo.

## 12. Fuera del alcance de este spec

La interfaz visual completa, el grafo dibujado, el diseno de la consola, los repositorios semilla, el entorno autocontenido con interprete y librerias, los enunciados de laboratorio y todo lo relativo a GitLab.

## 13. Preguntas abiertas para el arquitecto

Si durante la implementacion aparece una decision que este spec no cubre, resolverla y dejarla anotada en `docs/arquitectura.md` bajo un apartado de decisiones no especificadas. No detener el trabajo para consultar, salvo que la decision contradiga alguna de las restricciones de la seccion 2.
