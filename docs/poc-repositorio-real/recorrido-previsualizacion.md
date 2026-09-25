# La previsualizacion sobre el repositorio real, contra Git

Generado por `simulador/tests/real/previsualizacion.test.ts` (SPEC 020, CA4).
Por cada orden del guion, el motor previsualiza sobre el estado leido del
repositorio; despues la orden se ejecuta en Git y se compara.

- **grafo**: confirmaciones nuevas, ramas, etiquetas y posicion, que es lo
  que la pantalla dibuja en trazo discontinuo.
- **areas**: lo que el motor dice que quedaria en `git status`. La pantalla
  no lo anticipa; se mide para saber cuanto sabe el motor del estado real.
- **no la sabe**: el motor responde que no la implementa, o da error donde
  Git no.

| laboratorio | ordenes | grafo igual | grafo distinto | areas iguales | areas distintas | no la sabe |
|---|---|---|---|---|---|---|
| 02 | 52 | 37 | 0 | 37 | 0 | 15 |
| 03 | 66 | 64 | 0 | 64 | 0 | 2 |
| 04 | 85 | 81 | 0 | 81 | 0 | 4 |
| 05 | 55 | 54 | 0 | 54 | 0 | 1 |
| 06 | 51 | 47 | 0 | 47 | 0 | 4 |
| 07 | 75 | 67 | 0 | 67 | 0 | 8 |
| 08 | 54 | 30 | 0 | 30 | 0 | 24 |

## Diferencias conocidas

- 06:39:error: cat de un archivo que la orden anterior escribio fuera del repositorio, cosa que el motor declara no hacer.
- 07:287:error: cat de un archivo escrito fuera del repositorio, como el anterior.
- 07:318:error: cat de un archivo escrito fuera del repositorio, como el anterior.
- 07:422:error: cat de un archivo escrito fuera del repositorio, como el anterior.
- 08:86:error: upstream/main es una rama remota, que el motor no modela.
- 08:92:error: upstream/main, como el anterior.
- 08:103:error: upstream/main, como el anterior.

## Todas las diferencias

- 02, linea 23 `cd ../taller-git-trabajo/lab-02/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 02, linea 244 `ls .git`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 256 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 266 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 267 `cat .git/refs/heads/main`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 275 `wc -c .git/refs/heads/main`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 293 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 295 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 296 `cat .git/refs/heads/prueba`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 297 `cat .git/refs/heads/main`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 305 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 307 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 317 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 345 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 02, linea 351 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 03, linea 23 `cd ../taller-git-trabajo/lab-03/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 03, linea 322 `cat .git/info/exclude`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 04, linea 21 `cd ../taller-git-trabajo/lab-04/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 04, linea 196 `ls .git/refs/heads`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 04, linea 265 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 04, linea 373 `cat .git/HEAD`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 05, linea 25 `cd ../taller-git-trabajo/lab-05/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 06, linea 23 `cd ../taller-git-trabajo/lab-06/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 06, linea 38 `git log --oneline > ~/historial-original.txt`: el motor no la sabe — el simulador no implementa escribir fuera del repositorio. El simulador solo modela el recetario: un archivo guardado en tu carpeta personal no tendria donde ap
- 06, linea 39 `cat ~/historial-original.txt`: el motor no la sabe — cat: ~/historial-original.txt: No such file or directory
- 06, linea 182 `diff <(git log --oneline) ~/historial-original.txt && echo "identicos"`: el motor no la sabe — el simulador no implementa comparar dos archivos del disco con la orden del sistema. El simulador modela el recetario, no tu carpeta personal ni la sustitucion 
- 07, linea 25 `cd ../taller-git-trabajo/lab-07/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 07, linea 286 `git log --oneline trabajo -6 > ~/antes-del-rebase.txt`: el motor no la sabe — el simulador no implementa escribir fuera del repositorio. El simulador solo modela el recetario: un archivo guardado en tu carpeta personal no tendria donde ap
- 07, linea 287 `cat ~/antes-del-rebase.txt`: el motor no la sabe — cat: ~/antes-del-rebase.txt: No such file or directory
- 07, linea 318 `cat ~/antes-del-rebase.txt`: el motor no la sabe — cat: ~/antes-del-rebase.txt: No such file or directory
- 07, linea 366 `git rebase -i main`: el motor no la sabe — el simulador no implementa el rebase interactivo. Abre un editor con la lista de confirmaciones y se eligen las acciones linea por linea: no es una orden que fa
- 07, linea 400 `git rebase -i main`: el motor no la sabe — el simulador no implementa el rebase interactivo. Abre un editor con la lista de confirmaciones y se eligen las acciones linea por linea: no es una orden que fa
- 07, linea 422 `cat ~/antes-del-rebase.txt`: el motor no la sabe — cat: ~/antes-del-rebase.txt: No such file or directory
- 07, linea 475 `git rebase --continue`: el motor no la sabe — el simulador no implementa continuar un rebase detenido. El rebase del simulador nunca se detiene a medias, asi que no hay nada que continuar: el que se detiene
- 08, linea 25 `cd ../taller-git-trabajo/lab-08/recetario`: el motor no la sabe — el simulador no implementa moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir. / 
- 08, linea 54 `git fetch origin`: el motor no la sabe — el simulador no implementa git fetch. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 55 `git branch -a`: el motor no la sabe — el simulador no implementa la opcion «-a» de git branch. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 76 `git fetch upstream`: el motor no la sabe — el simulador no implementa git fetch. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 77 `git branch -a`: el motor no la sabe — el simulador no implementa la opcion «-a» de git branch. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 86 `git log --oneline upstream/main`: el motor no la sabe — fatal: ambiguous argument 'upstream/main': unknown revision
- 08, linea 92 `git log --oneline main..upstream/main`: el motor no la sabe — fatal: ambiguous argument 'upstream/main': unknown revision
- 08, linea 103 `git merge upstream/main`: el motor no la sabe — merge: upstream/main - not something we can merge
- 08, linea 118 `git fetch upstream`: el motor no la sabe — el simulador no implementa git fetch. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 152 `ls .git/hooks`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 08, linea 161 `mkdir -p .git/hooks`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "#!/bin/sh" > .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "mensaje=$(cat "$1")" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "largo=${#mensaje}" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "if [ "$largo" -lt 15 ]; then" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "  echo "El mensaje es muy corto. Escribe al menos 15 caracteres."" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "  echo "Escribiste $largo."" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "  exit 1" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 161 `echo "fi" >> .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa escribir o cambiar algo dentro de la carpeta .git. El simulador no la modela, y lo que se escribe ahi no es parte del directorio de t
- 08, linea 216 `ls -l .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
- 08, linea 228 `git commit -m "corto" --no-verify`: el motor no la sabe — el simulador no implementa la opcion «--no-verify» de git commit. / En tu terminal si funciona: esta orden hazla ahi.
- 08, linea 255 `ls -l .git/hooks/commit-msg`: el motor no la sabe — el simulador no implementa mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de ment
