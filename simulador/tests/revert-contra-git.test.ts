/**
 * `git revert` contra Git de verdad (SPEC 019, CA1 a CA3).
 *
 * Las mismas ordenes corren en un repositorio real y en el simulador, y se
 * compara lo que imprime cada `git revert` y el texto de cada archivo al
 * final. Lo unico que se normaliza es lo que no coincide por diseño: los
 * identificadores, que el simulador genera con su propia huella, y la fecha.
 *
 * Las pruebas de `revert.test.ts` fijan los textos copiados de una corrida;
 * estas vuelven a correr Git cada vez, de modo que si una version de Git
 * cambia algo, se nota aqui.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { archivoPorNombre, estadoVacio, idActual } from '../src/core/estado';
import { textoEnConfirmacion } from '../src/core/contenido';
import type { EstadoRepositorio } from '../src/core/tipos';

const carpetas: string[] = [];
afterAll(() => {
  for (const carpeta of carpetas) rmSync(carpeta, { recursive: true, force: true });
});

/** Lo que no coincide por diseño: identificadores y fecha. */
function normalizar(salida: string): string {
  return salida
    .replace(/\r/g, '')
    .replace(/^ Date: .*$/gm, ' Date: <fecha>')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<id>')
    .trimEnd();
}

/** Corre las ordenes en un repositorio real y devuelve la salida de cada una y los archivos. */
function enGit(ordenes: readonly string[]): { salidas: string[]; archivos: Record<string, string> } {
  const carpeta = mkdtempSync(join(tmpdir(), 'revert-'));
  carpetas.push(carpeta);
  const configuracion = join(carpeta, '.gitconfig-prueba');
  writeFileSync(configuracion, '[user]\n\tname = Participante\n\temail = p@sii.cl\n[init]\n\tdefaultBranch = main\n');
  const repo = join(carpeta, 'r');
  const entorno = { ...process.env, GIT_CONFIG_GLOBAL: configuracion, GIT_CONFIG_NOSYSTEM: '1', LANG: 'C', LC_ALL: 'C' };
  spawnSync('git', ['init', '-q', repo], { env: entorno });
  const salidas = ordenes.map((orden) => {
    const corrida = spawnSync('bash', ['-c', orden], { cwd: repo, env: entorno, encoding: 'utf8' });
    return `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  });
  const archivos: Record<string, string> = {};
  for (const nombre of readdirSync(repo)) {
    if (nombre === '.git' || statSync(join(repo, nombre)).isDirectory()) continue;
    archivos[nombre] = readFileSync(join(repo, nombre), 'utf8');
  }
  return { salidas, archivos };
}

/** Lo mismo en el simulador, partiendo de un repositorio recien creado y vacio. */
function enSimulador(ordenes: readonly string[]): { salidas: string[]; archivos: Record<string, string> } {
  let estado: EstadoRepositorio = ejecutar(estadoVacio(), 'git init').estado;
  const salidas = ordenes.map((orden) => {
    const resultado = ejecutar(estado, orden);
    estado = resultado.estado;
    return resultado.salida.map((linea) => linea.texto).join('\n');
  });
  const archivos: Record<string, string> = {};
  for (const archivo of estado.archivos) {
    if (archivoPorNombre(estado, archivo.nombre) === undefined) continue;
    archivos[archivo.nombre] = archivo.contenido ?? textoEnConfirmacion(estado, idActual(estado), archivo.nombre) ?? '';
  }
  return { salidas, archivos };
}

/** Las ordenes de partida: `a.md` con cinco lineas y `b.md` con una, confirmados. */
const PARTIDA = [
  'echo "uno" > a.md',
  'echo "dos" >> a.md',
  'echo "tres" >> a.md',
  'echo "cuatro" >> a.md',
  'echo "cinco" >> a.md',
  'echo "x" > b.md',
  'git add a.md b.md',
  'git commit -m "base"',
];

const escribirA = (lineas: readonly string[]): string[] =>
  lineas.map((linea, indice) => `echo "${linea}" ${indice === 0 ? '>' : '>>'} a.md`);

/** Corre el caso en los dos lados y compara cada `git revert` y los archivos del final. */
function comparar(ordenes: readonly string[]): void {
  const todas = [...PARTIDA, ...ordenes];
  const git = enGit(todas);
  const simulador = enSimulador(todas);
  todas.forEach((orden, indice) => {
    if (!orden.startsWith('git revert') && !orden.startsWith('git commit -m "resuelvo"')) return;
    expect(normalizar(simulador.salidas[indice] ?? ''), `salida de «${orden}»`).toBe(
      normalizar(git.salidas[indice] ?? ''),
    );
  });
  expect(
    Object.fromEntries(Object.entries(simulador.archivos).map(([nombre, texto]) => [nombre, normalizar(texto)])),
    'archivos al final',
  ).toEqual(Object.fromEntries(Object.entries(git.archivos).map(([nombre, texto]) => [nombre, normalizar(texto)])));
}

describe('CA1 · los tres casos, contra Git', () => {
  it('lo borrado vuelve', () => comparar(['git rm b.md', 'git commit -m "quita b"', 'git revert --no-edit HEAD']));

  it('lo agregado se va', () =>
    comparar(['echo "nuevo" > c.md', 'git add c.md', 'git commit -m "agrega c"', 'git revert --no-edit HEAD']));

  it('lo modificado se deshace linea por linea, conservando lo posterior', () =>
    comparar([
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'CINCO']),
      'git commit -a -m "cambia cinco"',
      'git revert --no-edit HEAD~1',
    ]));
});

describe('CA2 · la reversion de una reversion, contra Git', () => {
  it('el borrado vuelve a irse', () =>
    comparar(['git rm b.md', 'git commit -m "quita b"', 'git revert --no-edit HEAD', 'git revert --no-edit HEAD']));

  it('lo agregado vuelve', () =>
    comparar([
      'echo "nuevo" > c.md',
      'git add c.md',
      'git commit -m "agrega c"',
      'git revert --no-edit HEAD',
      'git revert --no-edit HEAD',
    ]));
});

describe('CA3 · los conflictos, contra Git', () => {
  const chocando = [
    ...escribirA(['uno', 'dos', 'TRES', 'cuatro', 'cinco']),
    'git commit -a -m "cambia tres"',
    ...escribirA(['uno', 'dos', 'TRES!', 'cuatro', 'cinco']),
    'git commit -a -m "retoca tres"',
    'git revert --no-edit HEAD~1',
  ];

  it('por contenido, con los marcadores', () => comparar(chocando));

  it('y --abort deja todo como estaba', () => comparar([...chocando, 'git revert --abort']));

  it('y --continue se niega sin resolver', () => comparar([...chocando, 'git revert --continue']));

  it('y resuelto, --continue confirma', () =>
    comparar([...chocando, ...escribirA(['uno', 'dos', 'tres', 'cuatro', 'cinco']), 'git add a.md', 'git revert --continue']));

  it('y resuelto, git commit tambien', () =>
    comparar([...chocando, ...escribirA(['uno', 'dos', 'tres', 'cuatro', 'cinco']), 'git add a.md', 'git commit -m "resuelvo"']));

  it('por modificado y borrado', () =>
    comparar([
      'echo "nuevo" > d.md',
      'git add d.md',
      'git commit -m "agrega d"',
      'echo "mas" >> d.md',
      'git commit -a -m "amplia d"',
      'git revert --no-edit HEAD~1',
    ]));

  it('por borrado y modificado', () =>
    comparar([
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      'git rm a.md',
      'git commit -m "quita a"',
      'git revert --no-edit HEAD~1',
    ]));

  it('por agregado en los dos lados', () =>
    comparar([
      'git rm b.md',
      'git commit -m "quita b"',
      'echo "otro" > b.md',
      'git add b.md',
      'git commit -m "vuelve b distinto"',
      'git revert --no-edit HEAD~1',
    ]));

  it('con cambios sin confirmar o preparados, se niega', () => {
    comparar([...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']), 'git commit -a -m "cambia dos"', 'echo "extra" >> a.md', 'git revert --no-edit HEAD']);
    comparar([...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']), 'git commit -a -m "cambia dos"', 'echo "y" >> b.md', 'git add b.md', 'git revert --no-edit HEAD']);
  });
});
