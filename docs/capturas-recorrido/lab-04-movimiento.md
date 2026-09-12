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
| 011 | `echo "" >> recetas/pad-thai.md` | tiempo |
| 012 | `echo "Fideos de arroz, tamarindo, mani, huevo y salsa de pescado." >> recetas/pad-thai.md` | tiempo |
| 013 | `git add recetas/pad-thai.md` | areas, tiempo |
| 014 | `git commit -m "se abre la cocina tailandesa"` | nodos, ramas, puntero, areas, tiempo |
| 015 | `git lg` | tiempo |
| 016 | `git switch main` | ramas, puntero, areas, tiempo |
| 017 | `git log --oneline` | tiempo |
| 018 | `git switch -c mexicana HEAD~3` | ramas, puntero, areas, tiempo |
| 019 | `git lg` | tiempo |
| 020 | `ls` | tiempo |
| 021 | `ls recetas` | tiempo |
| 022 | `mkdir -p recetas` | tiempo |
| 023 | `mkdir -p recetas` | tiempo |
| 024 | `echo "# Tacos" > recetas/tacos.md` | areas, tiempo |
| 025 | `echo "" >> recetas/tacos.md` | tiempo |
| 026 | `echo "Tortilla de maiz, carne, cebolla, cilantro y limon." >> recetas/tacos.md` | tiempo |
| 027 | `git add recetas/tacos.md` | areas, tiempo |
| 028 | `git commit -m "se abre la cocina mexicana"` | nodos, ramas, puntero, areas, tiempo |
| 029 | `git lg` | tiempo |
| 030 | `git log --oneline main` | tiempo |
| 031 | `git switch peruana` | tiempo |
| 032 | `git lg` | tiempo |
| 033 | `mkdir -p recetas` | tiempo |
| 034 | `echo "# Ceviche" > recetas/ceviche.md` | areas, tiempo |
| 035 | `echo "" >> recetas/ceviche.md` | tiempo |
| 036 | `echo "Pescado blanco, limon, cebolla morada, aji y camote." >> recetas/ceviche.md` | tiempo |
| 037 | `git add recetas/ceviche.md` | areas, tiempo |
| 038 | `git commit -m "se abre la cocina peruana"` | nodos, ramas, puntero, areas, tiempo |
| 039 | `git lg` | tiempo |
| 040 | `git branch` | tiempo |
| 041 | `git branch -m peruana andina` | tiempo |
| 042 | `git branch` | tiempo |
| 043 | `git lg` | tiempo |
| 045 | `git branch -m mexicana azteca` | ramas, areas, tiempo |
| 046 | `git branch` | tiempo |
| 047 | `git branch temporal` | ramas, areas, tiempo |
| 048 | `git branch` | tiempo |
| 049 | `git branch -d temporal` | ramas, areas, tiempo |
| 050 | `git branch` | tiempo |
| 051 | `git switch main` | ramas, puntero, areas, tiempo |
| 052 | `git branch -d azteca` | tiempo |
| 053 | `git log --oneline main` | tiempo |
| 054 | `git status` | tiempo |
| 055 | `git branch` | tiempo |
| 057 | `mkdir -p recetas` | tiempo |
| 058 | `echo "# Humita" > recetas/humita.md` | areas, tiempo |
| 059 | `echo "" >> recetas/humita.md` | tiempo |
| 060 | `echo "Choclo molido, albahaca, cebolla, cocida en las mismas hojas." >> recetas/humita.md` | tiempo |
| 061 | `git add recetas/humita.md` | areas, tiempo |
| 062 | `git commit -m "se agrega la humita"` | nodos, ramas, puntero, areas, tiempo |
| 063 | `git log --oneline -2` | tiempo |
| 064 | `git lg` | tiempo |
| 065 | `git switch main` | tiempo |
| 066 | `git lg` | tiempo |
| 067 | `git lg` | tiempo |
| 068 | `git reflog` | tiempo |
| 069 | `git switch --detach HEAD~2` | ramas, puntero, areas, tiempo |
| 070 | `mkdir -p recetas` | tiempo |
| 071 | `echo "# Sopaipillas" > recetas/sopaipillas.md` | areas, tiempo |
| 072 | `echo "" >> recetas/sopaipillas.md` | tiempo |
| 073 | `echo "Harina, zapallo, manteca. Fritas y con pebre." >> recetas/sopaipillas.md` | tiempo |
| 074 | `git add recetas/sopaipillas.md` | areas, tiempo |
| 075 | `git commit -m "se agregan las sopaipillas"` | nodos, ramas, puntero, areas, tiempo |
| 076 | `git switch -c fritangas` | ramas, puntero, areas, tiempo |
| 077 | `git lg` | tiempo |
| 078 | `git switch main` | ramas, puntero, areas, tiempo |
| 079 | `git branch` | tiempo |
| 080 | `git lg` | tiempo |
| 082 | `git status` | tiempo |
