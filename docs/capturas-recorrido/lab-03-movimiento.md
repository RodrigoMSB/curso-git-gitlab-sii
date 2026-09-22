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
| 016 | `mv platos.md listado-de-platos.md` | puntero, areas, tiempo |
| 017 | `git status` | puntero, tiempo |
| 018 | `git add .` | puntero, areas, tiempo |
| 019 | `git status` | tiempo |
| 020 | `git restore --staged listado-de-platos.md` | puntero, areas, tiempo |
| 021 | `git status` | puntero, tiempo |
| 022 | `mv listado-de-platos.md platos.md` | puntero, areas, tiempo |
| 023 | `git status` | puntero, tiempo |
| 024 | `git restore --staged platos.md` | puntero, areas, tiempo |
| 025 | `git status` | tiempo |
| 026 | `git rm recetas/postres/mote-con-huesillo.md` | areas, tiempo |
| 027 | `git status` | tiempo |
| 028 | `git commit -m "se retira la receta que no corresponde al recetario"` | nodos, ramas, puntero, areas, tiempo |
| 029 | `git log --oneline -- recetas/mote-con-huesillo.md` | tiempo |
| 030 | `ls` | puntero, tiempo |
| 031 | `cat credenciales.txt` | puntero, tiempo |
| 032 | `git log --oneline -- credenciales.txt` | puntero, tiempo |
| 033 | `echo "*.tmp" > .gitignore` | puntero, areas, tiempo |
| 034 | `echo "*.bak" >> .gitignore` | tiempo |
| 035 | `echo "credenciales.txt" >> .gitignore` | tiempo |
| 036 | `git status` | puntero, tiempo |
| 037 | `git ls-files` | tiempo |
| 038 | `git rm --cached notas.tmp` | puntero, areas, tiempo |
| 039 | `git rm --cached respaldo.bak` | puntero, areas, tiempo |
| 040 | `git status` | tiempo |
| 041 | `ls` | puntero, tiempo |
| 042 | `git rm credenciales.txt` | puntero, areas, tiempo |
| 043 | `ls` | puntero, tiempo |
| 044 | `git status` | puntero, tiempo |
| 045 | `git add .gitignore` | puntero, areas, tiempo |
| 046 | `git status` | puntero, tiempo |
| 047 | `git commit -m "se sacan del seguimiento los archivos que no corresponden"` | nodos, ramas, puntero, areas, tiempo |
| 048 | `git ls-files` | tiempo |
| 049 | `git status` | puntero, tiempo |
| 050 | `git log --oneline -- credenciales.txt` | tiempo |
| 051 | `echo "prueba" > temporal.tmp` | puntero, tiempo |
| 052 | `git status` | puntero, tiempo |
| 053 | `rm temporal.tmp` | puntero, tiempo |
| 054 | `echo "esta si va" > importante.tmp` | tiempo |
| 055 | `git status` | tiempo |
| 056 | `git add -f importante.tmp` | areas, tiempo |
| 057 | `git status` | puntero, tiempo |
| 058 | `git restore --staged importante.tmp` | puntero, areas, tiempo |
| 059 | `rm importante.tmp` | puntero, tiempo |
| 061 | `git ls-files` | tiempo |
| 062 | `ls` | puntero, tiempo |
| 063 | `ls recetas/principales recetas/postres` | puntero, tiempo |
| 064 | `git status` | puntero, tiempo |
| 065 | `git checkout HEAD~1 -- notas.tmp` | puntero, areas, tiempo |
