/**
 * Cuatro defectos del motor, contra Git de verdad (SPEC 022).
 *
 * Aparecieron al comparar la previsualizacion con Git sobre repositorios
 * reales (SPEC 020). Las mismas ordenes corren en un repositorio real y en el
 * simulador, y se compara lo que imprime cada una. Solo se normalizan los
 * identificadores, que el simulador genera con su propia huella.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ORDENES_DE_GIT } from '../src/core/contrato';
import { estadoVacio, establecerArchivo, sinSeguimientoAgrupado } from '../src/core/estado';
import { ejecutar } from '../src/core/motor';
import type { EstadoRepositorio } from '../src/core/tipos';
import { escenarioPorId } from '../src/escenarios';

const carpetas: string[] = [];
afterAll(() => {
  for (const carpeta of carpetas) rmSync(carpeta, { recursive: true, force: true });
});

function normalizar(salida: string): string {
  return salida
    .replace(/\r/g, '')
    // La linea en blanco que el simulador deja tras «On branch» es una
    // diferencia conocida de `git status`, que el product owner decidio dejar
    // como esta; el SPEC 022 no toca `git status` (punto 3.2).
    .replace(/^(On branch \S+)\n\n/, '$1\n')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<id>')
    .trimEnd();
}

function enGit(ordenes: readonly string[]): string[] {
  const carpeta = mkdtempSync(join(tmpdir(), 'defectos-'));
  carpetas.push(carpeta);
  const configuracion = join(carpeta, '.gitconfig-prueba');
  writeFileSync(configuracion, '[user]\n\tname = Participante\n\temail = p@sii.cl\n[init]\n\tdefaultBranch = main\n');
  const repo = join(carpeta, 'r');
  const entorno = { ...process.env, GIT_CONFIG_GLOBAL: configuracion, GIT_CONFIG_NOSYSTEM: '1', LANG: 'C', LC_ALL: 'C' };
  spawnSync('git', ['init', '-q', repo], { env: entorno });
  return ordenes.map((orden) => {
    const corrida = spawnSync('bash', ['-c', orden], { cwd: repo, env: entorno, encoding: 'utf8' });
    return `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  });
}

function enSimulador(ordenes: readonly string[]): string[] {
  let estado: EstadoRepositorio = ejecutar(estadoVacio(), 'git init').estado;
  return ordenes.map((orden) => {
    const resultado = ejecutar(estado, orden);
    estado = resultado.estado;
    return resultado.salida.map((linea) => linea.texto).join('\n');
  });
}

/** Corre todo en los dos lados y compara la salida de las ordenes marcadas con `?`. */
function comparar(ordenes: readonly string[]): void {
  const limpias = ordenes.map((orden) => orden.replace(/^\? /, ''));
  const git = enGit(limpias);
  const simulador = enSimulador(limpias);
  ordenes.forEach((orden, indice) => {
    if (!orden.startsWith('? ')) return;
    expect(normalizar(simulador[indice] ?? ''), `salida de «${limpias[indice]}»`).toBe(normalizar(git[indice] ?? ''));
  });
}

const PARTIDA = [
  'echo "uno" > a.md',
  'echo "x" > b.md',
  'git add a.md b.md',
  'git commit -m "base"',
  'git branch otra',
  'git switch otra',
  'echo "de otra" >> a.md',
  'git commit -a -m "otra cambia a"',
  'git switch main',
];

describe('1.1 · cambiar de rama con trabajo que se pisaria', () => {
  it('con un cambio sin preparar que choca, git switch se niega como Git', () =>
    comparar([...PARTIDA, 'echo "local" >> a.md', '? git switch otra', '? git branch', '? git status -s']));

  it('lo mismo con git checkout', () =>
    comparar([...PARTIDA, 'echo "local" >> a.md', '? git checkout otra', '? git branch', '? git status -s']));

  it('con el cambio preparado tambien se niega', () =>
    comparar([...PARTIDA, 'echo "local" >> a.md', 'git add a.md', '? git switch otra', '? git status -s']));

  it('con un archivo preparado y otro sin preparar que chocan, dos listas y un solo Aborting', () =>
    comparar([
      ...PARTIDA,
      'git switch otra',
      'echo "de otra" >> b.md',
      'git commit -a -m "otra cambia b"',
      'git switch main',
      'echo "local" >> a.md',
      'git add a.md',
      'echo "local" >> b.md',
      '? git switch otra',
      '? git checkout otra',
    ]));

  it('se lleva el cambio al separarse y al volver, y lo lista antes de decir de donde salio', () =>
    comparar([...PARTIDA, 'echo "local" >> b.md', '? git switch --detach otra', '? git switch main']));

  it('si el cambio no choca, cambia y se lleva el cambio, como Git', () =>
    comparar([...PARTIDA, 'echo "local" >> b.md', '? git switch otra', '? git branch', '? git status -s', '? cat b.md']));
});

describe('1.2 · el renombrado con git add . se detecta por el contenido', () => {
  // El `mv` del simulador ya anotaba de donde venia el archivo. Lo que faltaba
  // es el caso en que el archivo nuevo no llega por un `mv` del simulador:
  // Git no sabe de `mv`, compara el contenido. Se cubre el contenido
  // identico; el parecido de mas de la mitad que Git tambien acepta, no.
  const BASE = ['echo "uno" > a.md', 'echo "x" > b.md', 'git add a.md b.md', 'git commit -m "base"'];

  it('con mv, como ya lo hacia', () =>
    comparar([...BASE, 'mv a.md c.md', 'git add .', '? git status', '? git status -s', '? git commit -m "renombra"']));

  it('copiado a mano y borrado el original, con git add .', () =>
    comparar([...BASE, 'echo "uno" > c.md', 'rm a.md', 'git add .', '? git status', '? git status -s', '? git commit -m "renombra"']));

  it('el caso del laboratorio 03, con git add -A', () =>
    comparar([
      'echo "# Platos" > platos.md',
      'git add platos.md',
      'git commit -m "base"',
      'echo "# Platos" > listado-de-platos.md',
      'rm platos.md',
      'git add -A',
      '? git status -s',
    ]));

  it('con contenido distinto no hay renombrado', () =>
    comparar([...BASE, 'echo "otra cosa" > c.md', 'rm a.md', 'git add .', '? git status -s']));
});

describe('1.3 · lo que se escribe dentro de .git no es del directorio de trabajo', () => {
  it('un gancho escrito con echo no aparece como carpeta sin seguimiento', () =>
    comparar([
      'echo "uno" > a.md',
      'git add a.md',
      'git commit -m "base"',
      'echo "#!/bin/sh" > .git/hooks/commit-msg',
      'echo "exit 0" >> .git/hooks/commit-msg',
      '? git status',
      '? git status -s',
    ]));
});

describe('1.3 · las dos piezas por separado', () => {
  it('escribir dentro de .git se declara: el simulador no lo implementa y en la terminal si', () => {
    const estado = escenarioPorId('lab-02');
    for (const orden of ['echo "#!/bin/sh" > .git/hooks/commit-msg', 'mkdir -p .git/hooks', 'chmod +x .git/hooks/commit-msg']) {
      const salida = ejecutar(estado, orden).salida;
      expect(salida.map((linea) => linea.tipo), orden).toEqual(['limite', 'limite']);
      expect(salida[0]?.texto, orden).toMatch(/dentro de la carpeta \.git/);
    }
    // `.gitignore` no es la carpeta.
    expect(ejecutar(estado, 'echo "*.tmp" > .gitignore').salida.some((linea) => linea.tipo === 'limite')).toBe(false);
  });

  it('aunque algo llegara a anotarse dentro de .git, no aparece como no seguido', () => {
    const estado = establecerArchivo(escenarioPorId('lab-02'), '.git/hooks/commit-msg', 'sin-seguimiento');
    expect(sinSeguimientoAgrupado(estado).filter((entrada) => entrada.startsWith('.git'))).toEqual([]);
  });
});

describe('1.4 · ninguna orden de Git responde que no es una orden de Git (CA2)', () => {
  const ordenesDeGit = execFileSync('git', ['--list-cmds=main,nohelpers']).toString().trim().split('\n');
  const estado = escenarioPorId('lab-02');

  it('Git conoce todas estas ordenes', () => {
    expect(ordenesDeGit.length).toBeGreaterThan(100);
    expect(ordenesDeGit).toContain('fetch');
  });

  it.each(ordenesDeGit)('git %s', (orden) => {
    const salida = ejecutar(estado, `git ${orden}`).salida.map((linea) => linea.texto).join('\n');
    expect(salida).not.toMatch(/is not a git command/);
  });

  it('git fetch dice que el simulador no la implementa y que en la terminal si', () => {
    const salida = ejecutar(estado, 'git fetch origin').salida;
    expect(salida.map((linea) => linea.tipo)).toEqual(['limite', 'limite']);
    expect(salida.map((linea) => linea.texto).join('\n')).toMatch(/el simulador no implementa .*git fetch/);
  });

  it('la lista del simulador tiene cada orden que trae el Git de esta maquina', () => {
    expect(ordenesDeGit.filter((orden) => !ORDENES_DE_GIT.has(orden))).toEqual([]);
  });

  it('una orden que no existe sigue respondiendo como Git', () => {
    const salida = ejecutar(estado, 'git fetchx').salida.map((linea) => linea.texto);
    expect(salida[0]).toBe("git: 'fetchx' is not a git command. See 'git --help'.");
  });
});
