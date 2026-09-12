# Laboratorios

Enunciados de los ejercicios guiados de cada sesion del taller.

Cada laboratorio es una carpeta autocontenida. No clona nada, no corre ninguna
preparacion previa y no depende de `semillas/`, que quedo sin uso en este
esquema.

Dentro de cada carpeta hay dos o tres archivos.

- `README.md`, el enunciado que lee el participante.
- `verificar.sh`, que comprueba si el laboratorio quedo bien hecho.
- `preparar.sh`, que arma el escenario inicial, en los laboratorios que parten
  de una historia previa. El 01 no lo lleva, porque ahi crear el repositorio es
  el ejercicio.

## Donde trabaja el participante

**Fuera de este clon, en una carpeta hermana.** El participante clona el curso,
asi que estas carpetas viven dentro de un repositorio Git, y trabajar aqui
adentro haria que sus ordenes alcanzaran la configuracion y la historia del
repositorio del curso.

```
GIT-GITLAB/
├── curso-git-gitlab-sii/        este clon: enunciados y verificadores
└── taller-git-trabajo/          el trabajo del participante
    ├── lab-01/
    │   └── recetario/
    ├── lab-02/
    │   └── recetario/
    ├── ...
    └── lab-08/
        ├── recetario/
        ├── recetario.bundle      el remoto del laboratorio 08
        └── condimentos.bundle    su submodulo
```

La razon esta en la seccion 17 de [`docs/arquitectura.md`](../docs/arquitectura.md),
con los cinco efectos que provoca trabajar dentro del clon. Es la regla que
heredan los catorce laboratorios: **el trabajo del participante nunca vive dentro
del clon del curso.**

Al terminar el taller se borra `taller-git-trabajo` de una vez y no queda nada
suelto.

## El simulador no adivina en que laboratorio estas

Abierto con doble clic, `SIMULADOR.html` parte siempre en el escenario del
laboratorio 01, donde todavia no hay repositorio. Si haces cualquier otro
laboratorio sin cambiar de escenario, todas tus ordenes responden
`fatal: not a git repository` y el grafo no dibuja nada.

Cada enunciado, en su Preparacion, dice a que escenario llevarlo y como: con el
selector que dice **escenario** en la barra de arriba, o abriendo el archivo con
una direccion como `SIMULADOR.html?lab=04`. El `preparar.sh` lo repite al
terminar.

**El laboratorio 08 es la excepcion y va entero en la terminal.** Lo que enseña
son dos remotos, un submodulo y un gancho, y el motor no modela ninguna de las
tres cosas: no tiene ramas de seguimiento remoto, ni ordenes de red, ni
repositorios dentro de otros, ni ejecuta ganchos. Su enunciado lo dice en la
Preparacion y no lleva escenario.

## Correr el verificador

Se corre sin argumentos desde la carpeta del laboratorio y no recibe la ruta de
nada, la deduce de su propia ubicacion.

```
cd labs/lab-01
./verificar.sh
```

Imprime una linea por criterio y un resumen. Cuando un criterio falla dice que
esperaba y que encontro, y el codigo de salida queda distinto de cero.

En los laboratorios que traen `preparar.sh`, se corre antes que nada y deja el
escenario listo. Rehacerlo borra el trabajo que hubiera en ese laboratorio, asi
que avisa y pregunta antes.

```
labs/lab-02/preparar.sh
```

El escenario es determinista: entrega siempre la misma historia, con los mismos
identificadores de confirmacion, en cualquier maquina.

Por ahora estan armados los laboratorios 01 al 06, que cubren las sesiones 1 a
la 4 completas. Los otros ocho se agregan en specs posteriores.

La numeracion cambio con el SPEC 009: los laboratorios pasaron de quince a
catorce. El antiguo 03, que abria la carpeta oculta, ya no es un laboratorio
aparte y su contenido vive en la parte 4 del 02. Del antiguo 04 en adelante,
cada uno bajo un numero.
