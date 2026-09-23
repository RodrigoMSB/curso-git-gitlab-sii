/**
 * El almacen de objetos contra Git (SPEC 020, punto 1.5).
 *
 * Cada objeto de cada repositorio se lee con el almacen y se compara byte a
 * byte con lo que entrega `git cat-file`. Las pruebas del arquitecto solo
 * leian confirmaciones; aqui entran tambien los arboles y los archivos, que
 * son los que viajan en cadenas de deltas.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Almacen, aplicarDelta } from '../../src/real/almacen';
import { inflar } from '../../src/real/zlib';
import { huellaDeArchivo, sha1 } from '../../src/real/sha1';
import { adaptadorDeDisco } from './disco';

let raiz = '';
beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bordes-'));
  execFileSync('bash', [join(__dirname, 'armar-bordes.sh'), raiz], { stdio: 'pipe' });
}, 120_000);
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

/** Todos los objetos del repositorio segun Git: tipo y contenido. */
function objetosDeGit(dir: string): Map<string, { tipo: string; datos: Buffer }> {
  const salida = execFileSync('git', ['cat-file', '--batch-all-objects', '--batch'], { cwd: dir, maxBuffer: 1e9 });
  const objetos = new Map<string, { tipo: string; datos: Buffer }>();
  let i = 0;
  while (i < salida.length) {
    const fin = salida.indexOf(10, i);
    const [sha, tipo, largo] = salida.subarray(i, fin).toString().split(' ');
    const desde = fin + 1;
    const hasta = desde + Number(largo);
    objetos.set(sha ?? '', { tipo: tipo ?? '', datos: salida.subarray(desde, hasta) });
    i = hasta + 1;
  }
  return objetos;
}

describe('cada objeto, identico al de Git', () => {
  for (const nombre of ['grande64', 'cadena', 'refdelta', 'grandes', 'latin', 'superficial']) {
    it(nombre, async () => {
      const dir = join(raiz, nombre);
      const almacen = new Almacen(adaptadorDeDisco(dir), ['.git']);
      const deGit = objetosDeGit(dir);
      expect(deGit.size).toBeGreaterThan(0);
      for (const [sha, esperado] of deGit) {
        const leido = await almacen.objeto(sha);
        expect(leido.tipo, sha).toBe(esperado.tipo);
        expect(Buffer.from(leido.datos).equals(esperado.datos), `${nombre}: ${sha}`).toBe(true);
      }
    });
  }

  it('la cadena de deltas se resuelve una vez por objeto, no una vez por eslabon', async () => {
    // Con la recursion sin memoria del lector original, leer las ciento veinte
    // versiones de `f` descomprimia la cadena entera cada vez.
    const dir = join(raiz, 'cadena');
    const almacen = new Almacen(adaptadorDeDisco(dir), ['.git']);
    for (const sha of objetosDeGit(dir).keys()) await almacen.objeto(sha);
    expect(almacen.estadistica.deltas).toBeLessThanOrEqual(objetosDeGit(dir).size);
  });
});

describe('lo que el lector original no controlaba', () => {
  it('un delta sobre una base de otro largo es un error, no basura', () => {
    // Base declarada de 5 bytes, resultado de 3: copia 3 desde el 0.
    const delta = Uint8Array.from([5, 3, 0x90, 3]);
    expect(aplicarDelta(Uint8Array.from([1, 2, 3, 4, 5]), delta)).toEqual(Uint8Array.from([1, 2, 3]));
    expect(() => aplicarDelta(Uint8Array.from([1, 2, 3]), delta)).toThrow(/base/);
  });

  it('una distancia hacia atras imposible es un error, no basura', () => {
    // Bloque fijo con un par largo/distancia antes de cualquier literal.
    const roto = Uint8Array.from([0x78, 0x9c, 0x03, 0x02, 0x00, 0x00, 0x00, 0x00]);
    expect(() => inflar(roto)).toThrow();
  });

  it('la huella de un archivo es la de Git', () => {
    const contenido = new TextEncoder().encode('hola\n');
    const deGit = execFileSync('git', ['hash-object', '--stdin'], { input: 'hola\n' }).toString().trim();
    expect(huellaDeArchivo(contenido)).toBe(deGit);
    expect(sha1(new Uint8Array(0))).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });
});
