# Laboratorios

Enunciados de los ejercicios guiados de cada sesion del taller.

Cada laboratorio es una carpeta autocontenida. No clona nada, no corre ninguna
preparacion previa y no depende de `semillas/`, que quedo sin uso en este
esquema.

Dentro de cada carpeta hay dos archivos.

- `README.md`, el enunciado que lee el participante.
- `verificar.sh`, que comprueba si el laboratorio quedo bien hecho.

## Donde trabaja el participante

**Fuera de este clon, en una carpeta hermana.** El participante clona el curso,
asi que estas carpetas viven dentro de un repositorio Git, y trabajar aqui
adentro haria que sus ordenes alcanzaran la configuracion y la historia del
repositorio del curso.

```
GIT-GITLAB/
├── curso-git-gitlab-sii/        este clon: enunciados y verificadores
└── taller-git-trabajo/          el trabajo del participante
    └── lab-01/
        └── recetario/
```

La razon esta en la seccion 17 de [`docs/arquitectura.md`](../docs/arquitectura.md),
con los cinco efectos que provoca trabajar dentro del clon. Es la regla que
heredan los quince laboratorios: **el trabajo del participante nunca vive dentro
del clon del curso.**

Al terminar el taller se borra `taller-git-trabajo` de una vez y no queda nada
suelto.

## Correr el verificador

Se corre sin argumentos desde la carpeta del laboratorio y no recibe la ruta de
nada, la deduce de su propia ubicacion.

```
cd labs/lab-01
./verificar.sh
```

Imprime una linea por criterio y un resumen. Cuando un criterio falla dice que
esperaba y que encontro, y el codigo de salida queda distinto de cero.

Por ahora esta armado el laboratorio 01. Los otros catorce se agregan en specs
posteriores.
