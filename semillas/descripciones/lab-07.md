# Semilla del laboratorio 07 · Deshacer sin reescribir la historia

**Paquete:** `lab-07.bundle` · **Preparacion:** no · **Verificador:** si

## Que deja

Siete confirmaciones sobre `main`. La cuarta introduce un error evidente en
`ingredientes.md` y quedan tres confirmaciones encima.

## Por que

El laboratorio compara revertir con retroceder. La comparacion solo tiene
sentido si el error quedo sepultado bajo otras confirmaciones y el enunciado
lo trata como ya publicado: retroceder obligaria a reescribir tres
confirmaciones que otras personas ya tienen, y revertir no.

## Que esta plantado a proposito

- **La carne figura como «Saco de 25 kg por porcion»** en `ingredientes.md`,
  puesto por la confirmacion «Corrige la unidad de compra de la carne». El
  error es absurdo a proposito, para que se vea sin explicarlo.
- **Hay tres confirmaciones despues del error.** Esa distancia es la que hace
  cara la reescritura y barata la reversion.
- **El enunciado trata esa historia como publicada**, aunque la semilla no
  traiga remoto: el remoto es materia del laboratorio 09.
