# Semilla del laboratorio 03 · Que hay dentro de la carpeta oculta

**Paquete:** `lab-03.bundle` · **Preparacion:** no · **Verificador:** si

## Que deja

Cuatro confirmaciones sobre `main`, directorio de trabajo limpio, una rama
`borrador` sin confirmaciones propias y una etiqueta anotada `v1.0`.

## Por que

El laboratorio abre `.git` y recorre objetos con `git cat-file`. Lo que hace
falta no es una historia larga sino que haya de cada cosa: confirmaciones,
arboles, elementos, mas de una rama en `refs/heads` y una etiqueta que sea un
objeto y no solo un puntero.

## Que esta plantado a proposito

- **La etiqueta `v1.0` es anotada, no simple.** Es la unica forma de que el
  participante vea un objeto de tipo `tag` con `git cat-file -t`.
- **La rama `borrador` no tiene confirmaciones propias.** Apunta al mismo sitio
  que `main`, para mostrar que una rama es un archivo con un identificador
  adentro y nada mas.
