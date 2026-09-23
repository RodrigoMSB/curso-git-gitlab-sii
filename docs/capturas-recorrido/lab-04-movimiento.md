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
| 031 | `git branch peruana <identificador>` | ramas, areas, tiempo |
| 032 | `git switch peruana` | ramas, puntero, areas, tiempo |
| 033 | `git lg` | tiempo |
| 034 | `mkdir -p recetas` | tiempo |
| 035 | `echo "# Ceviche" > recetas/ceviche.md` | areas, tiempo |
| 036 | `echo "" >> recetas/ceviche.md` | tiempo |
| 037 | `echo "Pescado blanco, limon, cebolla morada, aji y camote." >> recetas/ceviche.md` | tiempo |
| 038 | `git add recetas/ceviche.md` | areas, tiempo |
| 039 | `git commit -m "se abre la cocina peruana"` | nodos, ramas, puntero, areas, tiempo |
| 040 | `git lg` | tiempo |
| 041 | `git branch` | tiempo |
| 042 | `git branch -m peruana andina` | ramas, areas, tiempo |
| 043 | `git branch` | tiempo |
| 044 | `git lg` | tiempo |
| 046 | `git branch -m mexicana azteca` | ramas, areas, tiempo |
| 047 | `git branch` | tiempo |
| 048 | `git branch temporal` | ramas, areas, tiempo |
| 049 | `git branch` | tiempo |
| 050 | `git branch -d temporal` | ramas, areas, tiempo |
| 051 | `git branch` | tiempo |
| 052 | `git switch main` | ramas, puntero, areas, tiempo |
| 053 | `git branch -d azteca` | tiempo |
| 054 | `git log --oneline main` | tiempo |
| 055 | `git switch --detach <identificador>` | ramas, puntero, areas, tiempo |
| 056 | `git status` | tiempo |
| 057 | `git branch` | tiempo |
| 059 | `mkdir -p recetas` | tiempo |
| 060 | `echo "# Humita" > recetas/humita.md` | areas, tiempo |
| 061 | `echo "" >> recetas/humita.md` | tiempo |
| 062 | `echo "Choclo molido, albahaca, cebolla, cocida en las mismas hojas." >> recetas/humita.md` | tiempo |
| 063 | `git add recetas/humita.md` | areas, tiempo |
| 064 | `git commit -m "se agrega la humita"` | nodos, ramas, puntero, areas, tiempo |
| 065 | `git log --oneline -2` | tiempo |
| 066 | `git lg` | tiempo |
| 067 | `git switch main` | nodos, ramas, puntero, areas, tiempo |
| 068 | `git lg` | tiempo |
| 069 | `git branch rescate <identificador>` | nodos, ramas, puntero, areas, tiempo |
| 070 | `git lg` | tiempo |
| 071 | `git reflog` | tiempo |
| 072 | `git switch --detach HEAD~2` | ramas, puntero, areas, tiempo |
| 073 | `mkdir -p recetas` | tiempo |
| 074 | `echo "# Sopaipillas" > recetas/sopaipillas.md` | areas, tiempo |
| 075 | `echo "" >> recetas/sopaipillas.md` | tiempo |
| 076 | `echo "Harina, zapallo, manteca. Fritas y con pebre." >> recetas/sopaipillas.md` | nodos, ramas, puntero, tiempo |
| 077 | `git add recetas/sopaipillas.md` | nodos, ramas, puntero, areas, tiempo |
| 078 | `git commit -m "se agregan las sopaipillas"` | nodos, ramas, puntero, areas, tiempo |
| 079 | `git switch -c fritangas` | ramas, puntero, areas, tiempo |
| 080 | `git lg` | tiempo |
| 081 | `git switch main` | ramas, puntero, areas, tiempo |
| 082 | `git branch` | tiempo |
| 083 | `git lg` | tiempo |
| 085 | `git status` | tiempo |
