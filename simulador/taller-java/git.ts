/**
 * El lado de Git en el recorrido del modo taller (punto 7.2 del SPEC 026).
 *
 * **Aqui no se usa nada del programa.** Ni su lector, ni su envoltorio, ni su
 * forma de leer el estado: el estado se le pregunta a Git con otras ordenes
 * (`status --porcelain=v1` donde el programa usa v2, `rev-list` donde el
 * programa recorre padres), y las ordenes del gemelo corren en un bash
 * lanzado aqui mismo.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const WINDOWS = process.platform === 'win32';

/** El bash y el git de la maquina, los mismos que usaria el participante. */
export function herramientas(): { readonly bash: string; readonly git: string } {
  if (!WINDOWS) return { bash: '/bin/bash', git: 'git' };
  const raiz = ['C:\\Program Files\\Git', 'C:\\Program Files (x86)\\Git'].find((r) => existsSync(join(r, 'bin', 'bash.exe')));
  if (raiz === undefined) throw new Error('no se encontro Git para Windows');
  return { bash: join(raiz, 'bin', 'bash.exe'), git: join(raiz, 'cmd', 'git.exe') };
}

export interface Salida {
  readonly codigo: number;
  readonly salida: string;
  readonly error: string;
}

/**
 * Corre una orden como la correria el participante en Git Bash, parado en
 * `carpeta`. Bash la lee de su entrada, como las lee el programa, y firma sus
 * errores como `bash: line N:`.
 */
export function correrEnBash(orden: string, carpeta: string, entorno: NodeJS.ProcessEnv): Salida {
  const { bash } = herramientas();
  const r = spawnSync(bash, WINDOWS ? ['--login', '-s'] : ['-s'], {
    cwd: carpeta,
    env: { ...entorno, CHERE_INVOKING: '1' },
    input: `${orden}\n`,
    encoding: 'utf8',
    timeout: 120_000,
  });
  const firma = (t: string): string => t.replace(/^.*?bash(?:\.exe)?: (?:eval: )?line (\d+):/gm, 'bash: line $1:');
  return { codigo: r.status ?? -1, salida: r.stdout ?? '', error: firma(r.stderr ?? '') };
}

function git(carpeta: string, entorno: NodeJS.ProcessEnv, ...argumentos: string[]): string | null {
  try {
    return execFileSync(herramientas().git, ['-c', 'core.quotepath=false', ...argumentos], {
      cwd: carpeta,
      env: entorno,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

/** Lo que Git dice del repositorio de una carpeta, en la forma en que se compara con la pagina. */
export interface EstadoSegunGit {
  readonly repositorio: boolean;
  readonly rama: string | null;
  readonly head: string | null;
  readonly confirmaciones: readonly string[];
  readonly huerfanas: readonly string[];
  readonly ramas: readonly string[];
  readonly etiquetas: readonly string[];
  readonly trabajo: readonly string[];
  readonly preparacion: readonly string[];
}

const lineas = (texto: string | null): string[] => (texto ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

export function estadoSegunGit(carpeta: string, entorno: NodeJS.ProcessEnv): EstadoSegunGit {
  const vacio = { rama: null, head: null, confirmaciones: [], huerfanas: [], ramas: [], etiquetas: [], trabajo: [], preparacion: [] };
  const raiz = git(carpeta, entorno, 'rev-parse', '--show-toplevel')?.trim();
  if (raiz === undefined || raiz === '') {
    // Dentro de .git no hay arbol de trabajo, pero si repositorio.
    const dentro = git(carpeta, entorno, 'rev-parse', '--git-dir') !== null;
    if (!dentro) return { repositorio: false, ...vacio };
    return { repositorio: true, ...vacio };
  }
  const e = (...a: string[]): string | null => git(raiz, entorno, ...a);
  const rama = e('symbolic-ref', '-q', '--short', 'HEAD')?.trim() || null;
  const head = e('rev-parse', '-q', '--verify', '--short=7', 'HEAD')?.trim() || null;

  const bases = lineas(e('stash', 'list', '--format=%P')).map((p) => p.split(' ')[0] ?? '');
  const registro = lineas(e('reflog', 'show', '--format=%H', 'HEAD', '--')).filter(
    (id) => e('cat-file', '-t', id)?.trim() === 'commit',
  );
  const puntas = ['--branches', '--remotes', '--tags', ...(head === null ? [] : ['HEAD']), ...bases];
  const todas = lineas(e('rev-list', '--abbrev-commit', '--abbrev=7', ...puntas, ...registro, '--'));
  const vivas = new Set(lineas(e('rev-list', '--abbrev-commit', '--abbrev=7', ...puntas, '--')));

  const ramas = lineas(e('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes')).filter(
    (r) => !r.endsWith('/HEAD') && r !== 'origin' && r !== 'upstream',
  );
  const etiquetas = lineas(e('for-each-ref', '--format=%(refname:short)', 'refs/tags'));

  // porcelain=v1, a proposito distinta de la v2 que lee el programa.
  const trabajo: string[] = [];
  const preparacion: string[] = [];
  const partes = (e('status', '--porcelain=v1', '-z', '--untracked-files=all') ?? '').split('\0');
  for (let i = 0; i < partes.length; i++) {
    const p = partes[i] ?? '';
    if (p.length < 4) continue;
    const x = p[0];
    const y = p[1];
    const ruta = p.slice(3);
    if (x === '?') {
      trabajo.push(ruta);
      continue;
    }
    const conflicto = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D');
    if (conflicto) {
      trabajo.push(ruta);
      continue;
    }
    if (x === 'R' || x === 'C') {
      const origen = partes[++i] ?? '';
      preparacion.push(`${origen} -> ${ruta}`);
    } else if (x !== ' ') {
      preparacion.push(ruta);
    }
    if (y !== ' ') trabajo.push(ruta);
  }

  return {
    repositorio: true,
    rama,
    head,
    confirmaciones: todas.sort(),
    huerfanas: todas.filter((id) => !vivas.has(id)).sort(),
    ramas: ramas.sort(),
    etiquetas: etiquetas.sort(),
    trabajo: trabajo.sort(),
    preparacion: preparacion.sort(),
  };
}
