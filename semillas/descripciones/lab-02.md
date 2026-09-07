# Semilla del laboratorio 02 · Historial y correccion del ultimo mensaje

**Paquete:** `lab-02.bundle` · **Preparacion:** si · **Verificador:** si

## Que deja

Historia lineal de cinco confirmaciones sobre `main`, repartidas entre el 2 y
el 16 de marzo de 2026 y firmadas por tres personas distintas. El directorio
de trabajo queda sucio: `platos.md` modificado sin preparar y `notas.tmp`
preparado.

## Por que

El laboratorio recorre el historial, lo filtra por autor y por fecha, compara
cambios y corrige el ultimo mensaje. Con todo confirmado por la misma persona
y en el mismo segundo, el filtrado no tendria nada que filtrar y el ejercicio
se caeria. La suciedad del directorio de trabajo es la que da material a
`git status`, `git diff` y `git restore --staged`.

## Que esta plantado a proposito

- **El mensaje de la ultima confirmacion esta mal escrito**: «Agrega la lsita
  de cocinerps». Es lo que el participante corrige con `git commit --amend`.
  No corregirlo aqui: sin el error, el ejercicio se queda sin objeto.
- **`notas.tmp` esta preparado**, y no deberia estarlo. Es el error que el
  participante deshace con `git restore --staged notas.tmp`.
- **Los autores y las fechas estan repartidos** a mano para que el filtrado
  devuelva resultados distintos segun el criterio.
