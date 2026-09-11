# Laboratorio 03 · que se movio despues de cada orden

Piezas: nodos, ramas, puntero, previsualizacion, areas, guardado, tiempo.

| paso | orden | se movio |
|---|---|---|
| 002 | `git log --oneline` | (primer paso) |
| 003 | `ls` | tiempo |
| 004 | `ls recetas` | tiempo |
| 005 | `git status` | tiempo |
| 006 | `ls recetas` | tiempo |
| 007 | `mkdir recetas/principales` | tiempo |
| 008 | `mkdir recetas/postres` | tiempo |
| 009 | `git mv recetas/pastel-de-choclo.md recetas/principales/` | areas, tiempo |
| 010 | `git mv recetas/empanadas.md recetas/principales/` | areas, tiempo |
| 011 | `git status` | tiempo |
| 012 | `git mv recetas/leche-asada.md recetas/postres/` | areas, tiempo |
| 013 | `git mv recetas/mote-con-huesillo.md recetas/postres/` | areas, tiempo |
| 014 | `git status` | tiempo |
| 015 | `git commit -m "se ordenan las recetas por tipo de plato"` | nodos, ramas, puntero, areas, tiempo |
| 016 | `mv platos.md listado-de-platos.md` | areas, tiempo |
| 017 | `git status` | tiempo |
| 018 | `git add .` | areas, tiempo |
| 019 | `git status` | tiempo |
| 020 | `git restore --staged listado-de-platos.md` | areas, tiempo |
| 021 | `git status` | tiempo |
| 022 | `mv listado-de-platos.md platos.md` | areas, tiempo |
| 023 | `git status` | tiempo |
| 024 | `git restore --staged platos.md` | areas, tiempo |
| 025 | `git status` | tiempo |
| 026 | `git rm recetas/postres/mote-con-huesillo.md` | areas, tiempo |
| 027 | `git status` | tiempo |
| 028 | `git commit -m "se retira la receta que no corresponde al recetario"` | nodos, ramas, puntero, areas, tiempo |
| 029 | `git log --oneline -- recetas/mote-con-huesillo.md` | tiempo |
| 030 | `ls` | tiempo |
| 032 | `git log --oneline -- credenciales.txt` | tiempo |
| 033 | `echo "contenido de ejemplo" > .gitignore` | areas, tiempo |
| 034 | `git status` | tiempo |
| 035 | `git ls-files` | tiempo |
| 036 | `git rm --cached notas.tmp` | areas, tiempo |
| 037 | `git rm --cached respaldo.bak` | areas, tiempo |
| 038 | `git status` | tiempo |
| 039 | `ls` | tiempo |
| 040 | `git rm credenciales.txt` | areas, tiempo |
| 041 | `ls` | tiempo |
| 042 | `git status` | tiempo |
| 043 | `git add .gitignore` | areas, tiempo |
| 044 | `git status` | tiempo |
| 045 | `git commit -m "se sacan del seguimiento los archivos que no corresponden"` | nodos, ramas, puntero, areas, tiempo |
| 046 | `git ls-files` | tiempo |
| 047 | `git status` | tiempo |
| 048 | `git log --oneline -- credenciales.txt` | tiempo |
| 049 | `echo "prueba" > temporal.tmp` | areas, tiempo |
| 050 | `git status` | tiempo |
| 051 | `rm temporal.tmp` | areas, tiempo |
| 052 | `echo "esta si va" > importante.tmp` | areas, tiempo |
| 053 | `git status` | tiempo |
| 054 | `git add -f importante.tmp` | areas, tiempo |
| 055 | `git status` | tiempo |
| 056 | `git restore --staged importante.tmp` | areas, tiempo |
| 057 | `rm importante.tmp` | areas, tiempo |
| 059 | `git ls-files` | tiempo |
| 060 | `ls` | tiempo |
| 061 | `ls recetas/principales recetas/postres` | tiempo |
| 062 | `git status` | tiempo |
| 063 | `git checkout HEAD~1 -- notas.tmp` | areas, tiempo |
