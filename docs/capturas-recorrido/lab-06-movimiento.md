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
| 025 | `git reset --hard <identificador>` | nodos, ramas, puntero, tiempo |
| 026 | `git log --oneline -3` | tiempo |
| 027 | `ls` | tiempo |
| 029 | `git log --oneline` | tiempo |
| 030 | `git log -S "sal marina en polvo" --oneline` | tiempo |
| 031 | `git show <identificador>` | tiempo |
| 032 | `git revert <identificador>` | nodos, ramas, puntero, areas, tiempo |
| 033 | `git log --oneline -3` | tiempo |
| 034 | `git lg` | tiempo |
| 035 | `git show HEAD` | tiempo |
| 036 | `git tag v0.9` | nodos, ramas, puntero, tiempo |
| 037 | `git tag` | tiempo |
| 038 | `git lg` | tiempo |
| 039 | `git tag -a v1.0 -m "primera version completa del recetario"` | nodos, ramas, puntero, tiempo |
| 040 | `git tag` | tiempo |
| 041 | `git cat-file -t v0.9` | tiempo |
| 042 | `git cat-file -t v1.0` | tiempo |
| 043 | `git show v1.0` | tiempo |
| 044 | `git tag -d v0.9` | nodos, ramas, puntero, tiempo |
| 045 | `git tag` | tiempo |
| 046 | `git log --oneline` | tiempo |
| 047 | `git tag` | tiempo |
| 048 | `git show v1.0` | tiempo |
| 049 | `git log -S "sal marina en polvo" --oneline` | tiempo |
| 050 | `git status` | tiempo |
| 051 | `git revert HEAD` | nodos, ramas, puntero, areas, tiempo |
