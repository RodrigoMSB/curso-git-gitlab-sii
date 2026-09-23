/**
 * Referencias e historia del repositorio real contra Git (SPEC 020, 1.5 y 2.2).
 *
 * Cada repositorio se lee con el lector y se compara con lo que dicen
 * `git for-each-ref`, `git log` y `git stash list`.
 */

import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Almacen } from '../../src/real/almacen';
import { leerHistoria } from '../../src/real/historia';
import { LectorDeReferencias, leerSuperficiales } from '../../src/real/referencias';
import { adaptadorDeDisco } from './disco';
import { armarRepos, DE_LA_SONDA, DE_LOS_BORDES, git, lineas } from './repos';

let repos: ReturnType<typeof armarRepos>;
beforeAll(() => {
  repos = armarRepos();
}, 180_000);
afterAll(() => rmSync(repos.raiz, { recursive: true, force: true }));

async function leer(dir: string) {
  const fs = adaptadorDeDisco(dir);
  const almacen = new Almacen(fs, ['.git']);
  const referencias = await new LectorDeReferencias(fs, ['.git']).leer(almacen);
  const historia = await leerHistoria(almacen, referencias, await leerSuperficiales(fs, ['.git']));
  return { referencias, historia };
}

function mapaDeGit(dir: string, carpeta: string): Map<string, string> {
  const salida = git(dir, 'for-each-ref', '--format=%(refname:strip=2) %(objectname) %(symref)', `refs/${carpeta}`);
  return new Map(
    lineas(salida)
      .map((l) => l.split(' '))
      .filter(([nombre, , symref]) => symref === '' || !nombre?.endsWith('/HEAD'))
      .map(([nombre, sha]) => [nombre ?? '', sha ?? '']),
  );
}

describe('cada repositorio, como lo ve Git', () => {
  for (const nombre of [...DE_LA_SONDA, ...DE_LOS_BORDES]) {
    it(nombre, async () => {
      const dir = repos.ruta(nombre);
      const { referencias, historia } = await leer(dir);

      expect(referencias.ramas).toEqual(mapaDeGit(dir, 'heads'));
      expect(referencias.remotas).toEqual(mapaDeGit(dir, 'remotes'));
      const etiquetas = mapaDeGit(dir, 'tags');
      expect(new Map([...referencias.etiquetas].map(([n, e]) => [n, e.objeto]))).toEqual(etiquetas);
      for (const [n, e] of referencias.etiquetas) expect(e.confirmacion, n).toBe(git(dir, 'rev-parse', `${n}^{commit}`).trim());

      const simbolica = (() => {
        try {
          return git(dir, 'symbolic-ref', '-q', '--short', 'HEAD').trim();
        } catch {
          return null;
        }
      })();
      expect(referencias.cabeza.rama).toBe(simbolica);
      expect(referencias.cabeza.sha).toBe(git(dir, 'rev-parse', 'HEAD').trim());

      // Identificador, padres y asunto de cada confirmacion alcanzable.
      const deGit = lineas(git(dir, 'log', '--branches', '--tags', '--remotes', 'HEAD', '--format=%H|%P|%s'));
      const leidas = [...historia.confirmaciones.values()]
        .filter((c) => !historia.huerfanas.has(c.sha))
        .map((c) => `${c.sha}|${c.padres.join(' ')}|${c.asunto}`);
      expect(leidas.sort()).toEqual(deGit.sort());

      // Las huerfanas: lo que el registro de HEAD recuerda y nada alcanza.
      const recordadas = lineas(git(dir, 'log', '-g', '--format=%H', 'HEAD'));
      const huerfanas =
        recordadas.length === 0
          ? []
          : lineas(git(dir, 'rev-list', ...new Set(recordadas), '--not', '--branches', '--tags', '--remotes', 'HEAD'));
      expect([...historia.huerfanas].sort()).toEqual([...new Set(huerfanas)].sort());

      expect(referencias.guardados.map((g) => `${g.sha} ${g.mensaje}`)).toEqual(
        lineas(git(dir, 'stash', 'list', '--format=%H %gs')),
      );
      expect(referencias.rotas).toEqual([]);
    });
  }
});

describe('lo que el lector original hacia mal', () => {
  it('el mensaje en ISO-8859-1 se lee en su codificacion', async () => {
    const { historia } = await leer(repos.ruta('latin'));
    expect([...historia.confirmaciones.values()].map((c) => c.asunto)).toEqual(['se agrega ñandú']);
  });

  it('un ciclo de referencias simbolicas se informa, no cuelga la pagina', async () => {
    const dir = join(repos.raiz, 'bordes', 'ciclo');
    const { referencias } = await leer(dir);
    expect(referencias.ramas).toEqual(new Map([['main', git(dir, 'rev-parse', 'main').trim()]]));
    expect(referencias.rotas).toHaveLength(2);
    expect(referencias.rotas[0]).toMatch(/refs\/heads\/x/);
  });

  it('se siguen los mismos saltos simbolicos que sigue Git', async () => {
    // Con el limite quitado, la cadena de s5 a s7 se resolveria; en ciclo, la pagina se colgaba.
    const dir = join(repos.raiz, 'bordes', 'saltos');
    const { referencias } = await leer(dir);
    expect(referencias.ramas).toEqual(mapaDeGit(dir, 'heads'));
    expect([...referencias.ramas.keys()]).toEqual(['main', 's1', 's2', 's3', 's4']);
    expect(referencias.rotas).toHaveLength(3);
  });

  it('el candado de una rama no es una rama', async () => {
    const { referencias } = await leer(repos.ruta('candado'));
    expect([...referencias.ramas.keys()]).toEqual(['main']);
  });

  it('el borde de un clon superficial no tiene padres', async () => {
    const dir = repos.ruta('superficial');
    const { historia } = await leer(dir);
    expect(historia.confirmaciones.size).toBe(2);
    expect([...historia.confirmaciones.values()].filter((c) => c.padres.length === 0)).toHaveLength(1);
  });
});
