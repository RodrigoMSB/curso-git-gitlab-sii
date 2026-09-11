# Laboratorio 04 · que se movio despues de cada orden

Piezas: nodos, ramas, puntero, previsualizacion, areas, guardado, tiempo.

| paso | orden | se movio |
|---|---|---|
| 002 | `git log --oneline` | (primer paso) |
| 003 | `git lg` | tiempo |
| 004 | `git branch` | tiempo |
| 005 | `git branch tailandesa` | ramas, areas, tiempo |
| 006 | `git branch` | tiempo |
| 007 | `git lg` | tiempo |
| 008 | `git switch tailandesa` | ramas, puntero, areas, tiempo |
| 009 | `mkdir -p recetas` | tiempo |
| 010 | `echo "contenido de ejemplo" > recetas/pad-thai.md` | areas, tiempo |
| 011 | `git add recetas/pad-thai.md` | areas, tiempo |
| 012 | `git commit -m "se abre la cocina tailandesa"` | nodos, ramas, puntero, areas, tiempo |
| 013 | `git lg` | tiempo |
| 014 | `git switch main` | ramas, puntero, areas, tiempo |
| 015 | `git log --oneline` | tiempo |
| 016 | `git switch -c mexicana HEAD~3` | ramas, puntero, areas, tiempo |
| 017 | `git lg` | tiempo |
| 018 | `ls` | tiempo |
| 019 | `ls recetas` | tiempo |
| 020 | `mkdir -p recetas` | tiempo |
| 021 | `mkdir -p recetas` | tiempo |
| 022 | `echo "contenido de ejemplo" > recetas/tacos.md` | areas, tiempo |
| 023 | `git add recetas/tacos.md` | areas, tiempo |
| 024 | `git commit -m "se abre la cocina mexicana"` | nodos, ramas, puntero, areas, tiempo |
| 025 | `git lg` | tiempo |
| 026 | `git log --oneline main` | tiempo |
| 027 | `git switch peruana` | tiempo |
| 028 | `git lg` | tiempo |
| 029 | `mkdir -p recetas` | tiempo |
| 030 | `echo "contenido de ejemplo" > recetas/ceviche.md` | areas, tiempo |
| 031 | `git add recetas/ceviche.md` | areas, tiempo |
| 032 | `git commit -m "se abre la cocina peruana"` | nodos, ramas, puntero, areas, tiempo |
| 033 | `git lg` | tiempo |
| 034 | `git branch` | tiempo |
| 035 | `git branch -m peruana andina` | tiempo |
| 036 | `git branch` | tiempo |
| 037 | `git lg` | tiempo |
| 039 | `git branch -m mexicana azteca` | ramas, areas, tiempo |
| 040 | `git branch` | tiempo |
| 041 | `git branch temporal` | ramas, areas, tiempo |
| 042 | `git branch` | tiempo |
| 043 | `git branch -d temporal` | ramas, areas, tiempo |
| 044 | `git branch` | tiempo |
| 045 | `git switch main` | ramas, puntero, areas, tiempo |
| 046 | `git branch -d azteca` | tiempo |
| 047 | `git log --oneline main` | tiempo |
| 048 | `git status` | tiempo |
| 049 | `git branch` | tiempo |
| 051 | `mkdir -p recetas` | tiempo |
| 052 | `echo "contenido de ejemplo" > recetas/humita.md` | areas, tiempo |
| 053 | `git add recetas/humita.md` | areas, tiempo |
| 054 | `git commit -m "se agrega la humita"` | nodos, ramas, puntero, areas, tiempo |
| 055 | `git log --oneline -2` | tiempo |
| 056 | `git lg` | tiempo |
| 057 | `git switch main` | tiempo |
| 058 | `git lg` | tiempo |
| 059 | `git lg` | tiempo |
| 060 | `git reflog` | tiempo |
| 061 | `git switch --detach HEAD~2` | ramas, puntero, areas, tiempo |
| 062 | `mkdir -p recetas` | tiempo |
| 063 | `echo "contenido de ejemplo" > recetas/sopaipillas.md` | areas, tiempo |
| 064 | `git add recetas/sopaipillas.md` | areas, tiempo |
| 065 | `git commit -m "se agregan las sopaipillas"` | nodos, ramas, puntero, areas, tiempo |
| 066 | `git switch -c fritangas` | ramas, puntero, areas, tiempo |
| 067 | `git lg` | tiempo |
| 068 | `git switch main` | ramas, puntero, areas, tiempo |
| 069 | `git branch` | tiempo |
| 070 | `git lg` | tiempo |
| 072 | `git status` | tiempo |
