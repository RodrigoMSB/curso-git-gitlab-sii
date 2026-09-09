# Laboratorios

Enunciados de los ejercicios guiados de cada sesion del taller.

Cada laboratorio es una carpeta autocontenida. El participante entra en ella y
trabaja ahi: no clona nada, no corre ninguna preparacion previa y no depende de
`semillas/`, que quedo sin uso en este esquema.

Dentro de cada carpeta hay dos archivos.

- `README.md`, el enunciado que lee el participante.
- `verificar.sh`, que comprueba si el laboratorio quedo bien hecho.

El verificador se corre sin argumentos desde la carpeta del laboratorio y no
recibe la ruta de nada, la deduce de su propia ubicacion.

```
cd labs/lab-01
./verificar.sh
```

Imprime una linea por criterio y un resumen. Cuando un criterio falla dice que
esperaba y que encontro, y el codigo de salida queda distinto de cero.

Lo que el participante crea mientras trabaja queda excluido del repositorio del
curso, asi que su ejercicio no aparece en `git status` ni se confirma por
descuido.

Por ahora esta armado el laboratorio 01. Los otros catorce se agregan en specs
posteriores.
