/**
 * El resumen de `git commit` y la redireccion con `cat`, contra Git y bash de
 * verdad (SPEC 023).
 */

import { describe, expect, it } from 'vitest';
import { resumenDeConfirmacion } from '../src/core/diferencias';
import { comparar } from './contra-git';

describe('CA2 · el resumen de git commit, como lo imprime Git', () => {
  it('un archivo nuevo', () => comparar(['echo "uno" > a.md', 'echo "dos" >> a.md', 'git add a.md', '? git commit -m "base"']));

  it('uno modificado', () =>
    comparar([
      'echo "uno" > a.md', 'echo "dos" >> a.md',
      'git add a.md',
      'git commit -m "base"',
      'echo "uno" > a.md', 'echo "DOS" >> a.md', 'echo "tres" >> a.md',
      '? git commit -a -m "cambia"',
    ]));

  it('uno borrado y uno nuevo, con las lineas de modo ordenadas por ruta', () =>
    comparar([
      'echo "uno" > a.md', 'echo "dos" >> a.md', 'echo "tres" >> a.md',
      'git add a.md',
      'git commit -m "base"',
      'echo "x" > b.md',
      'git add b.md',
      'git rm a.md',
      '? git commit -m "cambia de archivo"',
    ]));

  it('dos borrados', () =>
    comparar([
      'echo "uno" > a.md',
      'echo "x" > b.md',
      'git add a.md b.md',
      'git commit -m "base"',
      'git rm a.md b.md',
      '? git commit -m "borra todo"',
    ]));

  it('un archivo vacio: cero inserciones y cero eliminaciones', () => {
    // En el simulador no hay como crear un archivo vacio: `echo` siempre
    // escribe una linea. La regla se prueba sobre el resumen mismo, con el
    // texto de una corrida de Git 2.54 (`: > v.md`, `git add`, `git commit`).
    expect(resumenDeConfirmacion([{ ruta: 'v.md', antes: null, despues: '' }])).toEqual([
      ' 1 file changed, 0 insertions(+), 0 deletions(-)',
      ' create mode 100644 v.md',
    ]);
  });

  it('una enmienda dice la fecha original y resume contra el padre', () =>
    comparar([
      'echo "uno" > a.md',
      'git add a.md',
      'git commit -m "base"',
      'echo "x" > b.md',
      'git add b.md',
      'git commit -m "agrega b"',
      'echo "z" > z.md',
      'git add z.md',
      '? git commit --amend -m "agrega b y z"',
    ]));

  it('cerrar una fusion con conflicto imprime solo la primera linea', () =>
    comparar([
      'echo "base" > c.md',
      'git add c.md',
      'git commit -m "base"',
      'git switch -c otra',
      'echo "otra" > c.md',
      'git commit -a -m "otra"',
      'git switch main',
      'echo "main" > c.md',
      'git commit -a -m "main"',
      'git merge otra',
      'echo "resuelto" > c.md',
      'git add c.md',
      '? git commit -m "fusion"',
    ]));
});

describe('CA3 · cat con > y con >>, como bash', () => {
  const BASE = ['echo "uno" > a.md', 'echo "dos" >> a.md', 'echo "tres" > b.md', 'git add a.md b.md', 'git commit -m "base"'];

  it('> crea el archivo con el contenido, sin imprimir nada', () =>
    comparar([...BASE, '? cat a.md > c.md', '? cat c.md', '? git status -s']));

  it('> sobre un archivo que existe lo reemplaza', () => comparar([...BASE, '? cat b.md > a.md', '? cat a.md', '? git status -s']));

  it('>> agrega al final', () => comparar([...BASE, '? cat b.md >> a.md', '? cat a.md', '? git status -s']));

  it('varios archivos a la vez, juntos', () => comparar([...BASE, '? cat a.md b.md > c.md', '? cat c.md']));
});
