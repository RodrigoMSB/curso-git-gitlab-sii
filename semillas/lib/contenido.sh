#!/usr/bin/env bash
# Contenido del recetario COMIDA CHILENA (punto 4.5 del SPEC 003).
#
# El contenido es real y en español: el participante pasa cuatro sesiones
# mirando estos archivos, y un texto de relleno vuelve el ejercicio abstracto
# justo cuando conviene que se parezca a un repositorio de trabajo.
#
# Cada funcion escribe un archivo por la salida estandar. Las que reciben un
# argumento tienen variantes, porque la historia de una semilla necesita que
# el mismo archivo cambie entre una confirmacion y la siguiente.

contenido_readme() {
  cat <<'FIN'
# Recetario COMIDA CHILENA

Recetario de cocina chilena del casino institucional. Cada receta indica
porciones, tiempo de preparacion e ingredientes con cantidades.

## Como esta organizado

- `platos.md`: el listado de platos disponibles.
- `ingredientes.md`: los ingredientes base y su unidad de compra.
- `cocineros.md`: quien esta a cargo de cada preparacion.
- `recetas/`: una receta por archivo.

## Como se agrega una receta

1. Crear el archivo en `recetas/` con el nombre del plato en minusculas.
2. Agregar el plato a `platos.md`.
3. Revisar que los ingredientes nuevos esten en `ingredientes.md`.
FIN
}

contenido_platos() {
  case "${1:-base}" in
    inicial)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
FIN
      ;;
    base)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
      ;;
    con-tailandesa)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican
- Pad thai

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
      ;;
    con-peruana)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Lomo saltado
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
FIN
      ;;
    con-mexicana)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican

## Entradas

- Empanadas de pino
- Ensalada chilena
- Guacamole
FIN
      ;;
    completo)
      cat <<'FIN'
# Platos

## Fondos

- Pastel de choclo
- Cazuela de vacuno
- Charquican
- Porotos granados

## Entradas

- Empanadas de pino
- Ensalada chilena
- Sopaipillas

## Postres

- Leche asada
- Mote con huesillo
FIN
      ;;
    *)
      echo "contenido_platos: variante desconocida ${1}" >&2
      return 1
      ;;
  esac
}

contenido_ingredientes() {
  case "${1:-base}" in
    inicial)
      cat <<'FIN'
# Ingredientes

| Ingrediente | Unidad de compra |
|---|---|
| Choclo | Bolsa de 1 kg |
| Carne de vacuno | Kilo |
| Cebolla | Malla de 2 kg |
FIN
      ;;
    base)
      cat <<'FIN'
# Ingredientes

| Ingrediente | Unidad de compra |
|---|---|
| Choclo | Bolsa de 1 kg |
| Carne de vacuno | Kilo |
| Cebolla | Malla de 2 kg |
| Zapallo camote | Kilo |
| Papas | Saco de 5 kg |
| Aji de color | Frasco de 100 g |
| Aceitunas | Frasco de 500 g |
FIN
      ;;
    completo)
      cat <<'FIN'
# Ingredientes

| Ingrediente | Unidad de compra |
|---|---|
| Choclo | Bolsa de 1 kg |
| Carne de vacuno | Kilo |
| Cebolla | Malla de 2 kg |
| Zapallo camote | Kilo |
| Papas | Saco de 5 kg |
| Aji de color | Frasco de 100 g |
| Aceitunas | Frasco de 500 g |
| Porotos granados | Kilo |
| Huesillos | Bolsa de 500 g |
| Mote | Bolsa de 500 g |
FIN
      ;;
  esac
}

contenido_cocineros() {
  case "${1:-base}" in
    base)
      cat <<'FIN'
# Cocineros

| Preparacion | A cargo |
|---|---|
| Fondos | Marta Quiroga |
| Entradas | Ignacio Pereira |
FIN
      ;;
    completo)
      cat <<'FIN'
# Cocineros

| Preparacion | A cargo |
|---|---|
| Fondos | Marta Quiroga |
| Entradas | Ignacio Pereira |
| Postres | Carolina Nunez |
| Compras | Hernan Sepulveda |
FIN
      ;;
  esac
}

receta_pastel_de_choclo() {
  cat <<'FIN'
# Pastel de choclo

Porciones: 12
Tiempo: 90 minutos

## Ingredientes

- 3 kg de choclo molido
- 1 kg de carne de vacuno molida
- 2 cebollas grandes
- 12 aceitunas
- 2 huevos duros
- Albahaca, comino, aji de color

## Preparacion

1. Sofreir la cebolla picada en cuadros pequenos hasta que quede transparente.
2. Agregar la carne, el comino y el aji de color. Cocinar 10 minutos.
3. Moler el choclo con la albahaca y cocinar a fuego bajo hasta que espese.
4. Armar en fuentes: pino, aceituna, huevo y encima la pasta de choclo.
5. Espolvorear azucar y gratinar 20 minutos.
FIN
}

receta_empanadas() {
  cat <<'FIN'
# Empanadas de pino

Porciones: 24 unidades
Tiempo: 120 minutos

## Ingredientes

- 1 kg de harina
- 200 g de manteca
- 1 kg de carne de vacuno picada a cuchillo
- 3 cebollas grandes
- 24 aceitunas
- 3 huevos duros
- Pasas, comino, aji de color

## Preparacion

1. Preparar el pino la vispera: la cebolla debe reposar con la carne.
2. Amasar la harina con la manteca y agua tibia con sal.
3. Cortar discos de 20 cm y rellenar con pino, aceituna, huevo y pasas.
4. Cerrar con agua y hacer el doblez de tres pliegues.
5. Hornear a 220 grados por 25 minutos.
FIN
}

receta_cazuela() {
  cat <<'FIN'
# Cazuela de vacuno

Porciones: 10
Tiempo: 75 minutos

## Ingredientes

- 2 kg de asado de tira
- 10 papas medianas
- 1 zapallo camote
- 10 trozos de choclo
- Porotos verdes, arroz, cilantro

## Preparacion

1. Cocer la carne en agua con sal por 40 minutos y espumar el caldo.
2. Agregar las papas, el zapallo y el choclo. Cocinar 20 minutos mas.
3. Sumar los porotos verdes y el arroz. Cocinar 10 minutos.
4. Servir cada plato con un trozo de carne y cilantro picado encima.
FIN
}

receta_charquican() {
  cat <<'FIN'
# Charquican

Porciones: 8
Tiempo: 60 minutos

## Ingredientes

- 1 kg de carne de vacuno en cubos
- 1 kg de zapallo camote
- 8 papas
- 2 cebollas
- Porotos verdes, choclo, oregano

## Preparacion

1. Sofreir la cebolla y la carne con oregano y aji de color.
2. Agregar el zapallo y las papas en cubos con caldo hasta cubrir.
3. Cocinar hasta que las verduras se deshagan y el guiso espese.
4. Servir con un huevo frito encima.
FIN
}

receta_pad_thai() {
  cat <<'FIN'
# Pad thai

Porciones: 6
Tiempo: 40 minutos

## Ingredientes

- 400 g de fideos de arroz
- 300 g de camarones
- 2 huevos
- Brotes de soya, mani, cebollin
- Salsa de tamarindo, salsa de pescado, azucar rubia

## Preparacion

1. Remojar los fideos en agua caliente por 20 minutos.
2. Saltear los camarones a fuego fuerte y reservar.
3. Revolver los huevos en el mismo wok y agregar los fideos escurridos.
4. Sumar la salsa, los brotes y los camarones. Servir con mani molido.
FIN
}

receta_lomo_saltado() {
  cat <<'FIN'
# Lomo saltado

Porciones: 6
Tiempo: 35 minutos

## Ingredientes

- 800 g de lomo de vacuno en tiras
- 2 cebollas moradas
- 3 tomates
- Aji amarillo, sillao, vinagre tinto
- Papas fritas y arroz para acompanar

## Preparacion

1. Sellar la carne en el wok bien caliente, por tandas.
2. Agregar la cebolla y el tomate en gajos gruesos.
3. Sumar el sillao, el vinagre y el aji amarillo. Saltear un minuto.
4. Servir sobre las papas fritas, con arroz al lado.
FIN
}

receta_guacamole() {
  cat <<'FIN'
# Guacamole

Porciones: 8
Tiempo: 15 minutos

## Ingredientes

- 4 paltas maduras
- 1 cebolla morada pequena
- 2 tomates
- Cilantro, limon de pica, sal

## Preparacion

1. Moler la palta con un tenedor, sin dejarla como pure.
2. Agregar la cebolla y el tomate en cuadros pequenos.
3. Sazonar con limon, sal y cilantro picado.
FIN
}

receta_sopaipillas() {
  cat <<'FIN'
# Sopaipillas

Porciones: 30 unidades
Tiempo: 60 minutos

## Ingredientes

- 500 g de harina
- 300 g de zapallo cocido
- 100 g de manteca
- Sal, polvos de hornear

## Preparacion

1. Moler el zapallo caliente y mezclarlo con la manteca derretida.
2. Agregar la harina con sal y los polvos hasta formar una masa suave.
3. Uslerear, cortar discos y pinchar el centro.
4. Freir en aceite bien caliente hasta que doren por ambos lados.
FIN
}
