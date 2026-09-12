# Laboratorio 06 · que se movio despues de cada orden

Piezas: nodos, ramas, puntero, previsualizacion, areas, guardado, tiempo.

| paso | orden | se movio |
|---|---|---|
| 002 | `git log --oneline` | (primer paso) |
| 003 | `git lg` | tiempo |
| 005 | `cat ~/historial-original.txt` | tiempo |
| 006 | `git log --oneline -3` | tiempo |
| 007 | `git reset --soft HEAD~1` | nodos, ramas, puntero, areas, tiempo |
| 008 | `git log --oneline -3` | tiempo |
| 009 | `git status` | tiempo |
| 010 | `git commit -c ORIG_HEAD` | nodos, ramas, puntero, areas, tiempo |
| 011 | `git log --oneline -3` | tiempo |
| 012 | `git reset --mixed HEAD~1` | nodos, ramas, puntero, areas, tiempo |
| 013 | `git log --oneline -3` | tiempo |
| 014 | `git status` | tiempo |
| 015 | `git add .` | areas, tiempo |
| 016 | `git commit -c ORIG_HEAD` | nodos, ramas, puntero, areas, tiempo |
| 017 | `git log --oneline -3` | tiempo |
| 018 | `git status` | tiempo |
| 019 | `git reset --hard HEAD~1` | nodos, ramas, puntero, tiempo |
| 020 | `git log --oneline -3` | tiempo |
| 021 | `git status` | tiempo |
| 022 | `ls` | tiempo |
| 023 | `git reflog` | tiempo |
| 024 | `git reflog -10` | tiempo |
| 025 | `git log --oneline -3` | tiempo |
| 026 | `ls` | tiempo |
| 028 | `git log --oneline` | tiempo |
| 029 | `git log -S "sal marina en polvo" --oneline` | tiempo |
| 030 | `git log --oneline -3` | tiempo |
| 031 | `git lg` | tiempo |
| 032 | `git show HEAD` | tiempo |
| 033 | `git tag v0.9` | nodos, ramas, puntero, tiempo |
| 034 | `git tag` | tiempo |
| 035 | `git lg` | tiempo |
| 036 | `git tag -a v1.0 -m "primera version completa del recetario"` | nodos, ramas, puntero, tiempo |
| 037 | `git tag` | tiempo |
| 038 | `git cat-file -t v0.9` | tiempo |
| 039 | `git cat-file -t v1.0` | tiempo |
| 040 | `git show v1.0` | tiempo |
| 041 | `git tag -d v0.9` | nodos, ramas, puntero, tiempo |
| 042 | `git tag` | tiempo |
| 043 | `git log --oneline` | tiempo |
| 044 | `git tag` | tiempo |
| 045 | `git show v1.0` | tiempo |
| 046 | `git log -S "sal marina en polvo" --oneline` | tiempo |
| 047 | `git status` | tiempo |
| 048 | `git revert HEAD` | nodos, ramas, puntero, areas, tiempo |
