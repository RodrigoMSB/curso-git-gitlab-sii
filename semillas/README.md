# Repositorios semilla

Estado inicial de los repositorios con los que empieza cada laboratorio. Son
repositorios Git de verdad, distintos de los escenarios del simulador: estos
se clonan en Git Bash y el participante los rompe.

## Como se usa en clase

```bash
semillas/preparar.sh 06
```

Deja el repositorio del laboratorio 06 en `./recetario`, listo y verificado.
Acepta un directorio distinto y `--rehacer` para reemplazar uno que ya exista:

```bash
semillas/preparar.sh 06 ~/taller/recetario --rehacer
```

Esa es la orden que se repite cuando alguien destruye su repositorio a mitad
de un laboratorio: vuelve a prepararlo y se incorpora al siguiente sin
arrastrar el desastre. No usa la red.

## Que laboratorios llevan semilla

| Lab | Semilla | Lab | Semilla |
|---|---|---|---|
| 01 | no, parte de un directorio vacio | 09 | si, dos paquetes |
| 02 | si | 10 | si |
| 03 | si | 11 | no, sigue del 10 |
| 04 | si | 12 | no, ocurre en la plataforma |
| 05 | si | 13 | si |
| 06 | si | 14 | no, sigue del 13 |
| 07 | si | 15 | no, parte de un repositorio vacio |
| 08 | si | | |

Diez semillas y once paquetes, contando los dos del laboratorio 09.

## Que hay en cada carpeta

```
semillas/
├── preparar.sh       punto de entrada: clona, prepara y verifica
├── generar.sh        rehace los paquetes y anota el manifiesto
├── comprobar.sh      revisa que los paquetes esten al dia
├── lib/              entorno determinista, contenido del recetario y
│                     comprobaciones compartidas
├── generadores/      un guion por semilla: construye el repositorio con
│                     ordenes de Git reales, no copiando archivos
├── paquetes/         los paquetes versionados, mas su manifiesto
├── preparacion/      lo que no viaja en un paquete: archivos sucios, remotos
├── verificadores/    comprueban el estado inicial recien preparado
└── descripciones/    para el relator: que deja cada semilla y que trae
                      plantado a proposito
```

**Antes de tocar una semilla, leer su descripcion.** Varias traen errores
puestos a proposito —un mensaje mal escrito, credenciales confirmadas, una
tabla mal formada— y corregirlos deja al laboratorio sin ejercicio.

## Como se rehace una semilla

```bash
semillas/generar.sh 06     # una
semillas/generar.sh        # todas
semillas/comprobar.sh      # revisa que los paquetes esten al dia
```

Los paquetes se versionan en el repositorio y se rehacen solo cuando cambia su
generador. `comprobar.sh` avisa si alguien cambio un generador y olvido
regenerar: guarda en `paquetes/manifiesto.txt` una huella del generador junto
con las bibliotecas que usa, y otra de las referencias que el paquete
transporta.

`semillas/comprobar.sh --determinismo` corre ademas cada generador dos veces y
compara los identificadores. Sirve para lo mismo entre maquinas distintas: se
corre en cada una y se comparan las huellas que imprime.

**Si tienes una maquina con Windows**, esa es justamente la orden que falta
correr para cerrar el criterio CA2 del SPEC 003. El instructivo completo, con
la tabla de huellas contra la cual comparar, esta en
[`docs/arquitectura.md`](../docs/arquitectura.md), seccion «CA2 · PENDIENTE DE
CIERRE».

## Peso

El arbol completo pesa **232 KB**, de los cuales **52 KB** son los once
paquetes. El criterio CA10 del SPEC 003 pide avisar si pasara de los veinte
megabytes, para que el repositorio del curso siga siendo rapido de clonar:
esta tres ordenes de magnitud por debajo. Una prueba de la suite lo vigila.

## Que hace falta para correrlas

Git 2.28 o superior y Bash. Ambos vienen con Git Bash sobre Windows y de forma
nativa en macOS. Los guiones se escriben para Bash 3.2, que es el que trae
macOS, de modo que corren igual en los dos sistemas.
