# Semilla del laboratorio 09 · Remotos y submodulos

**Paquetes:** `lab-09-recetario.bundle` y `lab-09-condimentos.bundle`
**Preparacion:** si · **Verificador:** si

## Que deja

El recetario con cuatro confirmaciones y un remoto `origin` configurado que
apunta al paquete local, con `main` siguiendo a `origin/main`. Aparte, un
segundo repositorio de condimentos, chico, listo para incorporar como
submodulo.

## Por que

Es el unico laboratorio que necesita un remoto de verdad, y la sala no tiene
red hacia un servidor de Git. Un paquete sirve como remoto: se puede traer y
enviar contra el como si fuera un repositorio remoto corriente, y todo ocurre
en disco.

## Que esta plantado a proposito

- **El remoto se conserva.** `preparar.sh` lo quita en todas las demas
  semillas; aqui el script de preparacion vuelve a ponerlo, porque el remoto
  es la materia del ejercicio.
- **No hay `.gitmodules`.** Incorporar el submodulo es el laboratorio.
- **Son dos paquetes.** El de condimentos no se clona: se le pasa su ruta a
  `git submodule add`.
