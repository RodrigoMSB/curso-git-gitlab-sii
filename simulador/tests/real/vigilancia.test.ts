/**
 * La marca que decide si releer el repositorio (SPEC 020, 2.7).
 *
 * Cambia con cada cosa que el guion hace, y no cambia si no se hizo nada.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { marcaDelRepositorio } from '../../src/real/vigilancia';
import { adaptadorDeDisco } from './disco';

let dir = '';
const git = (...args: string[]): void => {
  execFileSync('git', ['-c', 'user.name=P', '-c', 'user.email=p@sii.cl', ...args], { cwd: dir, stdio: 'ignore' });
};
const marca = (): Promise<string | null> => marcaDelRepositorio(adaptadorDeDisco(dir));

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'vigilancia-'));
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'a.md'), 'a\n');
  git('add', '.');
  git('commit', '-qm', 'uno');
  // Corre en paralelo con los archivos que arman repositorios pesados: diez segundos no alcanzan siempre.
}, 60_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('la marca del repositorio', () => {
  it('no cambia si no se hizo nada', async () => {
    expect(await marca()).toBe(await marca());
  });

  const casos: [string, () => void][] = [
    ['una confirmacion', () => git('commit', '-q', '--allow-empty', '-m', 'dos')],
    ['una rama nueva, que no toca HEAD ni el registro', () => git('branch', 'otra')],
    ['una etiqueta', () => git('tag', 'v1')],
    ['un archivo editado sin Git', () => appendFileSync(join(dir, 'a.md'), 'b\n')],
    ['un archivo nuevo sin Git', () => writeFileSync(join(dir, 'nuevo.md'), 'n\n')],
    ['preparar', () => git('add', '.')],
    ['el guardado temporal', () => git('stash', '-q')],
    ['empaquetar las referencias', () => git('pack-refs', '--all')],
  ];
  for (const [nombre, hacer] of casos) {
    it(`cambia con ${nombre}`, async () => {
      const antes = await marca();
      hacer();
      expect(await marca()).not.toBe(antes);
    });
  }

  it('es null mientras Git escribe el indice', async () => {
    writeFileSync(join(dir, '.git', 'index.lock'), '');
    expect(await marca()).toBeNull();
    rmSync(join(dir, '.git', 'index.lock'));
    expect(await marca()).not.toBeNull();
  });
});
