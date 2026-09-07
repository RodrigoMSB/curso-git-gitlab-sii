# Semilla del laboratorio 13 · Primera tuberia de integracion

**Paquete:** `lab-13.bundle` · **Preparacion:** no · **Verificador:** si

## Que deja

El recetario con cinco confirmaciones, exclusiones puestas y directorio de
trabajo limpio. No hay archivo de definicion de la tuberia. `platos.md` trae
un error de formato.

## Por que

Conviene que la primera ejecucion de la tuberia falle. Un participante que ve
pasar la revision a la primera no aprende a leer el registro de una ejecucion
fallida, que es la mitad del oficio.

## Que esta plantado a proposito

- **`platos.md` tiene dos errores de formato**: la fila de la cazuela lleva
  tres columnas donde el encabezado declara dos, y en las entradas la ensalada
  chilena usa asterisco donde el resto usa guion. Cualquier revisor de formato
  los marca. **No corregirlos**: sin ellos la primera ejecucion pasa y el
  laboratorio pierde su primera mitad.
- **No hay `.gitlab-ci.yml`.** Escribirlo es el ejercicio.
