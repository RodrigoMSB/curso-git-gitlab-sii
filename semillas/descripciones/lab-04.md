# Semilla del laboratorio 04 · Exclusiones y salida del seguimiento

**Paquete:** `lab-04.bundle` · **Preparacion:** no · **Verificador:** si

## Que deja

Cinco confirmaciones sobre `main` y el directorio de trabajo limpio. En la
historia confirmada estan `notas.tmp`, `respaldo.bak` y `credenciales.txt`.
No hay archivo de exclusiones.

## Por que

El ejercicio distingue dos cosas que se confunden todo el tiempo: ignorar un
archivo, que solo afecta a lo que todavia no esta seguido, y sacarlo del
seguimiento, que es lo que hace falta cuando ya se confirmo. Si los tres
archivos estuvieran solo en el disco, bastaria con escribir `.gitignore` y el
participante se iria con la idea equivocada.

## Que esta plantado a proposito

- **`credenciales.txt` esta confirmado, con una clave adentro.** Es el caso
  incomodo y es el que justifica la conversacion sobre que un secreto
  confirmado no se borra escribiendolo en las exclusiones. La clave es
  inventada y el sistema no existe.
- **`notas.tmp` y `respaldo.bak` tambien estan confirmados.**
- **No hay `.gitignore`.** Escribirlo es parte del laboratorio.
