# Laboratorio 05 · que se movio despues de cada orden

Piezas: nodos, ramas, puntero, previsualizacion, areas, guardado, tiempo.

| paso | orden | se movio |
|---|---|---|
| 002 | `git branch` | (primer paso) |
| 003 | `git lg` | puntero, tiempo |
| 004 | `git switch main` | puntero, tiempo |
| 005 | `git log --oneline main` | puntero, tiempo |
| 006 | `git log --oneline tailandesa` | puntero, tiempo |
| 007 | `git merge tailandesa` | nodos, ramas, puntero, tiempo |
| 008 | `git lg` | tiempo |
| 009 | `git log --oneline` | puntero, tiempo |
| 010 | `git log --oneline main` | tiempo |
| 011 | `git log --oneline tailandesa` | puntero, tiempo |
| 012 | `git branch -d tailandesa` | ramas, puntero, areas, tiempo |
| 013 | `git branch` | puntero, tiempo |
| 014 | `git lg` | puntero, tiempo |
| 015 | `git merge azteca` | nodos, ramas, puntero, areas, tiempo |
| 016 | `git lg` | tiempo |
| 017 | `git log --oneline -3` | puntero, tiempo |
| 018 | `git log --oneline -1` | puntero, tiempo |
| 019 | `git show --stat HEAD` | tiempo |
| 020 | `git branch -d azteca` | nodos, ramas, puntero, areas, tiempo |
| 021 | `git show criolla` | puntero, tiempo |
| 022 | `git show andina` | puntero, tiempo |
| 023 | `cat platos.md` | puntero, tiempo |
| 024 | `git merge criolla` | nodos, ramas, puntero, areas, tiempo |
| 025 | `cat platos.md` | puntero, tiempo |
| 026 | `git lg` | puntero, tiempo |
| 027 | `git log --oneline -1` | tiempo |
| 028 | `git branch -d criolla` | nodos, ramas, areas, tiempo |
| 029 | `git diff main andina -- platos.md` | puntero, tiempo |
| 030 | `git merge andina` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 031 | `git status` | puntero, tiempo |
| 032 | `cat platos.md` | puntero, tiempo |
| 033 | `git merge --abort` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 034 | `git status` | puntero, tiempo |
| 035 | `cat platos.md` | puntero, tiempo |
| 036 | `git lg` | puntero, tiempo |
| 037 | `git merge andina` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 038 | `git status` | tiempo |
| 039 | `grep -n "<<<<<<<\\|=======\\|>>>>>>>" platos.md` | puntero, tiempo |
| 040 | `git add platos.md` | puntero, areas, tiempo |
| 041 | `git status` | puntero, tiempo |
| 042 | `git commit` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 043 | `git lg` | tiempo |
| 044 | `cat platos.md` | tiempo |
| 045 | `git log --oneline -1` | tiempo |
| 046 | `git branch -d andina` | ramas, areas, tiempo |
| 047 | `git branch` | tiempo |
| 048 | `git log --oneline` | tiempo |
| 049 | `git lg` | tiempo |
| 050 | `cat platos.md` | tiempo |
| 051 | `grep -rn "<<<<<<<" .` | tiempo |
| 052 | `git status` | tiempo |
| 053 | `git restore --staged platos.md` | tiempo |
| 054 | `git add platos.md` | tiempo |
| 055 | `git commit --amend --no-edit` | nodos, ramas, puntero, areas, tiempo |
