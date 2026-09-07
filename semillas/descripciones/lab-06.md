# Semilla del laboratorio 06 · Fusiones y conflictos

**Paquete:** `lab-06.bundle` · **Preparacion:** no · **Verificador:** si

## Que deja

Cuatro confirmaciones sobre `main` y dos ramas con destinos distintos:

- `mexicana` nace de la punta de `main`, que no volvio a moverse. Su fusion es
  un avance rapido y no crea confirmacion de union.
- `peruana` nace una confirmacion antes y cambia la misma linea de `platos.md`
  que `main` cambio despues. Su fusion choca.

## Por que

Las dos fusiones que el laboratorio necesita mostrar son opuestas, y tenerlas
en la misma semilla permite compararlas sin cambiar de repositorio: la primera
no deja rastro en el grafo, la segunda obliga a resolver a mano.

## Que esta plantado a proposito

- **El choque de `peruana` con `main`.** Ambas tocan la linea de la cazuela en
  `platos.md`: `main` la precisa con chuchoca y `peruana` la reemplaza por
  lomo saltado. Si alguien «arregla» una de las dos, el laboratorio se queda
  sin conflicto.
- **`main` no avanza despues de que nace `mexicana`**, y esa es la unica razon
  por la que su fusion es un avance rapido. Confirmar algo en `main` rompe el
  ejercicio.
