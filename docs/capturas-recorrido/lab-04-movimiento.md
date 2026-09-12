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
| 010 | `echo "# Pad thai" > recetas/pad-thai.md` | areas, tiempo |
| 011 | `echo "Fideos de arroz, tamarindo, mani, huevo y salsa de pescado." >> recetas/pad-thai.md` | tiempo |
| 012 | `git add recetas/pad-thai.md` | areas, tiempo |
| 013 | `git commit -m "se abre la cocina tailandesa"` | nodos, ramas, puntero, areas, tiempo |
| 014 | `git lg` | tiempo |
| 015 | `git switch main` | ramas, puntero, areas, tiempo |
| 016 | `git log --oneline` | tiempo |
| 017 | `git switch -c mexicana HEAD~3` | ramas, puntero, areas, tiempo |
| 018 | `git lg` | tiempo |
| 019 | `ls` | tiempo |
| 020 | `ls recetas` | tiempo |
| 021 | `mkdir -p recetas` | tiempo |
| 022 | `mkdir -p recetas` | tiempo |
| 023 | `echo "# Tacos" > recetas/tacos.md` | areas, tiempo |
| 024 | `echo "Tortilla de maiz, carne, cebolla, cilantro y limon." >> recetas/tacos.md` | tiempo |
| 025 | `git add recetas/tacos.md` | areas, tiempo |
| 026 | `git commit -m "se abre la cocina mexicana"` | nodos, ramas, puntero, areas, tiempo |
| 027 | `git lg` | tiempo |
| 028 | `git log --oneline main` | tiempo |
| 029 | `git switch peruana` | tiempo |
| 030 | `git lg` | tiempo |
| 031 | `mkdir -p recetas` | tiempo |
| 032 | `echo "# Ceviche" > recetas/ceviche.md` | areas, tiempo |
| 033 | `echo "Pescado blanco, limon, cebolla morada, aji y camote." >> recetas/ceviche.md` | tiempo |
| 034 | `git add recetas/ceviche.md` | areas, tiempo |
| 035 | `git commit -m "se abre la cocina peruana"` | nodos, ramas, puntero, areas, tiempo |
| 036 | `git lg` | tiempo |
| 037 | `git branch` | tiempo |
| 038 | `git branch -m peruana andina` | tiempo |
| 039 | `git branch` | tiempo |
| 040 | `git lg` | tiempo |
| 042 | `git branch -m mexicana azteca` | ramas, areas, tiempo |
| 043 | `git branch` | tiempo |
| 044 | `git branch temporal` | ramas, areas, tiempo |
| 045 | `git branch` | tiempo |
| 046 | `git branch -d temporal` | ramas, areas, tiempo |
| 047 | `git branch` | tiempo |
| 048 | `git switch main` | ramas, puntero, areas, tiempo |
| 049 | `git branch -d azteca` | tiempo |
| 050 | `git log --oneline main` | tiempo |
| 051 | `git status` | tiempo |
| 052 | `git branch` | tiempo |
| 054 | `mkdir -p recetas` | tiempo |
| 055 | `echo "# Humita" > recetas/humita.md` | areas, tiempo |
| 056 | `echo "Choclo molido, albahaca, cebolla, cocida en las mismas hojas." >> recetas/humita.md` | tiempo |
| 057 | `git add recetas/humita.md` | areas, tiempo |
| 058 | `git commit -m "se agrega la humita"` | nodos, ramas, puntero, areas, tiempo |
| 059 | `git log --oneline -2` | tiempo |
| 060 | `git lg` | tiempo |
| 061 | `git switch main` | tiempo |
| 062 | `git lg` | tiempo |
| 063 | `git lg` | tiempo |
| 064 | `git reflog` | tiempo |
| 065 | `git switch --detach HEAD~2` | ramas, puntero, areas, tiempo |
| 066 | `mkdir -p recetas` | tiempo |
| 067 | `echo "# Sopaipillas" > recetas/sopaipillas.md` | areas, tiempo |
| 068 | `echo "Harina, zapallo, manteca. Fritas y con pebre." >> recetas/sopaipillas.md` | tiempo |
| 069 | `git add recetas/sopaipillas.md` | areas, tiempo |
| 070 | `git commit -m "se agregan las sopaipillas"` | nodos, ramas, puntero, areas, tiempo |
| 071 | `git switch -c fritangas` | ramas, puntero, areas, tiempo |
| 072 | `git lg` | tiempo |
| 073 | `git switch main` | ramas, puntero, areas, tiempo |
| 074 | `git branch` | tiempo |
| 075 | `git lg` | tiempo |
| 077 | `git status` | tiempo |
