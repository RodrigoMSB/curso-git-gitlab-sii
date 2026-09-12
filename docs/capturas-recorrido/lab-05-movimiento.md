# Laboratorio 05 · que se movio despues de cada orden

Piezas: nodos, ramas, puntero, previsualizacion, areas, guardado, tiempo.

| paso | orden | se movio |
|---|---|---|
| 002 | `git branch` | (primer paso) |
| 003 | `git lg` | tiempo |
| 004 | `git switch main` | tiempo |
| 005 | `git log --oneline main` | tiempo |
| 006 | `git log --oneline tailandesa` | tiempo |
| 007 | `git merge tailandesa` | nodos, ramas, puntero, tiempo |
| 008 | `git lg` | tiempo |
| 009 | `git log --oneline` | tiempo |
| 010 | `git log --oneline main` | tiempo |
| 011 | `git log --oneline tailandesa` | tiempo |
| 012 | `git branch -d tailandesa` | ramas, areas, tiempo |
| 013 | `git branch` | tiempo |
| 014 | `git lg` | tiempo |
| 015 | `git merge azteca` | nodos, ramas, puntero, areas, tiempo |
| 016 | `git lg` | tiempo |
| 017 | `git log --oneline -3` | tiempo |
| 018 | `git log --oneline -1` | tiempo |
| 019 | `git show --stat HEAD` | tiempo |
| 020 | `git branch -d azteca` | nodos, ramas, areas, tiempo |
| 021 | `git diff main andina -- platos.md` | tiempo |
| 022 | `git merge andina` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 023 | `git status` | tiempo |
| 024 | `cat platos.md` | tiempo |
| 025 | `git merge --abort` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 026 | `git status` | tiempo |
| 027 | `cat platos.md` | tiempo |
| 028 | `git lg` | tiempo |
| 029 | `git merge andina` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 030 | `git status` | tiempo |
| 031 | `grep -n "<<<<<<<\\|=======\\|>>>>>>>" platos.md` | tiempo |
| 032 | `git add platos.md` | areas, tiempo |
| 033 | `git status` | tiempo |
| 034 | `git commit` | nodos, ramas, puntero, previsualizacion, areas, tiempo |
| 035 | `git lg` | tiempo |
| 036 | `cat platos.md` | tiempo |
| 037 | `git log --oneline -1` | tiempo |
| 038 | `git branch -d andina` | ramas, areas, tiempo |
| 039 | `git branch` | tiempo |
| 040 | `git log --oneline` | tiempo |
| 041 | `git lg` | tiempo |
| 042 | `grep -rn "<<<<<<<" .` | tiempo |
| 043 | `git status` | tiempo |
| 044 | `git restore --staged platos.md` | tiempo |
| 045 | `git add platos.md` | tiempo |
| 046 | `git commit --amend --no-edit` | nodos, ramas, puntero, areas, tiempo |
