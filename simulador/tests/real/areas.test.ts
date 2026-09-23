/**
 * Las tres areas del repositorio real contra `git status` (SPEC 020, 2.3 a 2.6,
 * CA6 y CA7).
 *
 * Se lee cada repositorio con el lector y se compara con el estado corto de
 * Git. El lector va primero: `git status` refresca el indice y lo reescribe.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Adaptador } from '../../src/real/adaptador';
import { leerIndice } from '../../src/real/indice';
import { type Lectura, LectorReal } from '../../src/real/lector';
import { adaptadorDeDisco } from './disco';
import { armarRepos, comoPorcelana, DE_LA_SONDA, DE_LAS_AREAS, DE_LOS_BORDES, porcelana } from './repos';

let repos: ReturnType<typeof armarRepos>;
beforeAll(() => {
  repos = armarRepos();
}, 180_000);
afterAll(() => rmSync(repos.raiz, { recursive: true, force: true }));

function ruta(nombre: string): string {
  return DE_LAS_AREAS.includes(nombre) ? join(repos.raiz, 'bordes', nombre) : repos.ruta(nombre);
}

async function leer(dir: string): Promise<Lectura> {
  return new LectorReal(adaptadorDeDisco(dir), { autocrlfPorDefecto: 'false' }).leer();
}

describe('las areas de cada repositorio, como las ve git status', () => {
  for (const nombre of [...DE_LAS_AREAS, ...DE_LA_SONDA, ...DE_LOS_BORDES]) {
    it(nombre, async () => {
      const dir = ruta(nombre);
      const lectura = await leer(dir);
      if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
      expect(comoPorcelana(lectura.repositorio.cambios)).toEqual(porcelana(dir));
    });
  }
});

describe('lo que el repositorio de estados tiene que mostrar', () => {
  it('cada codigo que el taller puede producir esta en el repositorio de prueba', async () => {
    // Si el repositorio de prueba perdiera un caso, la comparacion de arriba
    // seguiria en verde sin probarlo.
    const codigos = new Set(porcelana(ruta('estados')).map((l) => l.slice(0, 2)));
    for (const codigo of ['MM', 'AM', 'AD', ' M', ' D', 'D ', 'R ', 'RM', ' A', '??']) expect(codigos, codigo).toContain(codigo);
    const conflictos = new Set(porcelana(ruta('conflicto')).map((l) => l.slice(0, 2)));
    for (const codigo of ['UU', 'AA', 'UD', 'DU']) expect(conflictos, codigo).toContain(codigo);
  });

  it('el conflicto se informa como fusion en curso', async () => {
    const lectura = await leer(ruta('conflicto'));
    if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
    expect(lectura.repositorio.operacion).toBe('fusion');
    expect(lectura.repositorio.fusionando).toHaveLength(1);
  });

  it('un clon con autocrlf en true, sin tocar, se ve limpio (CA6)', async () => {
    const lectura = await leer(ruta('finales-crlf'));
    if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
    expect(lectura.repositorio.cambios).toEqual([]);
  });

  it('con autocrlf en true, pasar a CRLF un archivo LF no lo modifica', async () => {
    const lectura = await leer(ruta('finales-tocado'));
    if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
    expect(lectura.repositorio.cambios).toEqual([]);
    expect(porcelana(ruta('finales-tocado'))).toEqual([]);
  });
});

describe('la fecha de un archivo solo se cree si es anterior al indice', () => {
  it('un archivo cambiado en el mismo milisegundo en que se escribio el indice se vuelve a mirar', async () => {
    // `b` tiene otro contenido que el del indice. Se le pone el tamaño y la
    // fecha que Git anoto, y al indice una fecha del mismo milisegundo: con
    // precision de nanosegundos Git sabria que el archivo es posterior; con
    // milisegundos no se sabe, y hay que calcular la huella.
    const dir = ruta('estados');
    const disco = adaptadorDeDisco(dir);
    const indice = leerIndice(new Uint8Array(readFileSync(join(dir, '.git', 'index'))));
    const b = indice.entradas.find((e) => e.ruta === 'b');
    if (b === undefined) throw new Error('falta b en el indice');
    const anotado = b.mtimeSegundos * 1000 + Math.floor(b.mtimeNanos / 1e6);
    const adaptador: Adaptador = {
      ...disco,
      async datos(partes) {
        if (partes.join('/') === 'b') return { tamano: b.tamano, modificado: anotado + 0.8 };
        if (partes.join('/') === '.git/index') return { tamano: 1, modificado: anotado + 0.3 };
        return disco.datos(partes);
      },
    };
    const lectura = await new LectorReal(adaptador, { autocrlfPorDefecto: 'false' }).leer();
    if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
    expect(lectura.repositorio.cambios.find((c) => c.ruta === 'b')).toEqual({ x: ' ', y: 'M', ruta: 'b' });
  });
});

describe('lo que no se sabe dibujar se dice, no se dibuja a medias (2.9)', () => {
  const casos: Record<string, RegExp> = {
    partido: /partido/,
    disperso: /disperso/,
    sha256: /SHA256/,
    reftable: /reftable/,
    enlazado: /enlazado/,
  };
  for (const [nombre, motivo] of Object.entries(casos)) {
    it(nombre, async () => {
      const lectura = await leer(join(repos.raiz, 'bordes', nombre));
      expect(lectura.tipo === 'no-soportado' ? lectura.motivo : 'se leyo').toMatch(motivo);
    });
  }

  it('los indices de version 3 y 4 si se leen', async () => {
    for (const [nombre, version] of [
      ['indice3', 3],
      ['indice4', 4],
    ] as const) {
      const lectura = await leer(ruta(nombre));
      if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
      expect(lectura.repositorio.indice.version, nombre).toBe(version);
    }
  });
});

/** Huella de cada archivo del repositorio, con su fecha: lo que la lectura no puede cambiar. */
function fotografia(dir: string): Map<string, string> {
  const foto = new Map<string, string>();
  const recorrer = (carpeta: string): void => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const completa = join(carpeta, entrada.name);
      if (entrada.isDirectory()) recorrer(completa);
      else {
        const datos = statSync(completa);
        foto.set(completa, `${createHash('sha1').update(readFileSync(completa)).digest('hex')} ${datos.mtimeMs} ${datos.mode}`);
      }
    }
  };
  recorrer(dir);
  return foto;
}

describe('la lectura no escribe nada (CA7)', () => {
  for (const nombre of ['estados', 'conflicto', 'clonado']) {
    it(nombre, async () => {
      const dir = ruta(nombre);
      const antes = fotografia(dir);
      await leer(dir);
      await leer(dir);
      expect(fotografia(dir)).toEqual(antes);
    });
  }
});
