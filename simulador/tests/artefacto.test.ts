/**
 * El simulador construido (SPEC 006).
 *
 * `dist/index.html` va versionado en el repositorio a proposito: el
 * participante clona y abre, sin instalar Node ni construir nada. El riesgo de
 * esa decision es que el artefacto se desincronice del codigo y nadie lo note
 * hasta la sala de clases.
 *
 * Estas pruebas son lo que impide que eso pase en silencio.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ARTEFACTO,
  ENTRADA,
  MANIFIESTO,
  comprobar,
  fuentes,
  huellaDe,
  huellaDeLasFuentes,
  leer,
} from '../herramientas/manifiesto.mjs';

const SIMULADOR = fileURLToPath(new URL('..', import.meta.url));

describe('el artefacto construido esta en el repositorio y al dia', () => {
  it('existe dist/index.html y no esta vacio', () => {
    expect(statSync(ARTEFACTO).size).toBeGreaterThan(50_000);
  });

  it('existe SIMULADOR.html en la raiz del clon', () => {
    // Es el punto de entrada del participante: no tiene que buscar dentro de
    // simulador/dist para abrir el simulador.
    expect(statSync(ENTRADA).size).toBeGreaterThan(50_000);
  });

  it('la copia de la raiz es identica al artefacto', () => {
    // Identica de verdad, byte a byte: asi Git guarda un solo objeto para las
    // dos rutas y la copia no pesa nada.
    expect(huellaDe(ENTRADA)).toBe(huellaDe(ARTEFACTO));
  });

  it('el artefacto corresponde al codigo fuente de hoy', () => {
    // Si esta prueba falla, alguien toco el simulador y no reconstruyo.
    const problemas = comprobar();
    expect(problemas).toEqual([]);
  });

  it('el manifiesto anota las dos huellas', () => {
    const anotado = leer();
    expect(anotado?.fuentes).toBe(huellaDeLasFuentes());
    expect(anotado?.artefacto).toBe(huellaDe(ARTEFACTO));
  });
});

describe('el artefacto esta versionado en el repositorio', () => {
  const raiz = fileURLToPath(new URL('../..', import.meta.url));
  const versionados = execFileSync('git', ['-C', raiz, 'ls-files'], { encoding: 'utf8' }).split('\n');

  it('dist/index.html esta confirmado, no ignorado', () => {
    // Es lo que hace que el participante pueda clonar y abrir sin construir.
    // Si alguien restituye la exclusion de dist/ creyendo que es un descuido,
    // esta prueba lo atrapa.
    expect(versionados).toContain('simulador/dist/index.html');
  });

  it('el manifiesto tambien esta confirmado', () => {
    expect(versionados).toContain('simulador/dist/manifiesto.txt');
  });

  it('SIMULADOR.html esta confirmado en la raiz', () => {
    expect(versionados).toContain('SIMULADOR.html');
  });

  it('no se colo nada mas de dist', () => {
    const deDist = versionados.filter((ruta) => ruta.startsWith('simulador/dist/'));
    expect(deDist.sort()).toEqual([
      'simulador/dist/index.html',
      'simulador/dist/manifiesto.txt',
    ]);
  });
});

describe('la comprobacion detecta de verdad un artefacto desactualizado', () => {
  // Una comprobacion que nunca se vio fallar no prueba nada. Cada caso altera
  // algo de verdad en el disco y lo deja como estaba al terminar.
  const respaldos = new Map<string, Buffer>();

  function respaldar(ruta: string): void {
    if (!respaldos.has(ruta)) respaldos.set(ruta, readFileSync(ruta));
  }

  afterEach(() => {
    for (const [ruta, contenido] of respaldos) writeFileSync(ruta, contenido);
    respaldos.clear();
  });

  it('reclama si cambia el codigo fuente y no se reconstruye', () => {
    const fuente = join(SIMULADOR, 'src', 'core', 'motor.ts');
    respaldar(fuente);
    writeFileSync(fuente, `${readFileSync(fuente, 'utf8')}\n// un cambio sin reconstruir\n`);

    const problemas = comprobar();
    expect(problemas.length).toBeGreaterThan(0);
    expect(problemas.join('\n')).toContain('el codigo del simulador cambio');
    expect(problemas.join('\n')).toContain('npm run build');
  });

  it('reclama si alguien edita el artefacto a mano', () => {
    respaldar(ARTEFACTO);
    writeFileSync(ARTEFACTO, `${readFileSync(ARTEFACTO, 'utf8')}<!-- tocado a mano -->`);

    const problemas = comprobar();
    expect(problemas.join('\n')).toContain('no es el que anota el manifiesto');
  });

  it('reclama si la copia de la raiz se queda atras', () => {
    respaldar(ENTRADA);
    writeFileSync(ENTRADA, '<!doctype html><p>una version vieja</p>');

    const problemas = comprobar();
    expect(problemas.join('\n')).toContain('SIMULADOR.html no es igual');
  });

  it('reclama si falta el manifiesto', () => {
    respaldar(MANIFIESTO);
    writeFileSync(MANIFIESTO, '# sin huellas\n');

    const problemas = comprobar();
    expect(problemas.length).toBeGreaterThan(0);
  });
});

describe('la huella cubre lo que determina el artefacto', () => {
  it('incluye el codigo, la entrada y la configuracion de construccion', () => {
    const lista = fuentes();
    expect(lista).toContain('index.html');
    expect(lista).toContain('vite.config.ts');
    expect(lista).toContain('package-lock.json');
    expect(lista.some((ruta) => ruta.startsWith('src/core/'))).toBe(true);
    expect(lista.some((ruta) => ruta.startsWith('src/vista/'))).toBe(true);
  });

  it('deja fuera las pruebas, que no cambian lo que se construye', () => {
    // Si entraran, cada prueba nueva exigiria reconstruir el simulador.
    expect(fuentes().some((ruta) => ruta.startsWith('tests/'))).toBe(false);
  });
});

describe('el artefacto sigue siendo autocontenido', () => {
  const html = readFileSync(ARTEFACTO, 'utf8');

  it('no apunta a ningun recurso externo', () => {
    // La regla de la seccion 22: despues del clon no se depende de la red.
    const armazon = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    const referencias = [...armazon.matchAll(/\b(?:src|href)="([^"]*)"/g)]
      .map(([, direccion = '']) => direccion)
      .filter((direccion) => !direccion.startsWith('data:'));
    expect(referencias).toEqual([]);
  });

  it('no conserva scripts externos ni sintaxis de modulos', () => {
    expect(html).not.toMatch(/<script[^>]*\ssrc=/);
    expect(html).not.toContain('type="module"');
  });
});

describe('el participante no necesita nada instalado', () => {
  it('el artefacto se abre desde el sistema de archivos, sin servidor', () => {
    // Un documento HTML completo, con su cierre: nada que servir ni compilar.
    const html = readFileSync(ARTEFACTO, 'utf8');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('ningun archivo que el participante use pide npm o node', () => {
    // Los scripts de los laboratorios son Bash y Git, que el participante ya
    // tiene. npm y node son herramientas de desarrollo y no deben asomar aqui.
    const raiz = fileURLToPath(new URL('../..', import.meta.url));
    const listado = execFileSync('git', ['-C', raiz, 'ls-files', 'labs'], { encoding: 'utf8' })
      .split('\n')
      .filter((ruta) => ruta.endsWith('.sh'));
    expect(listado.length).toBeGreaterThan(0);
    for (const ruta of listado) {
      const contenido = readFileSync(join(raiz, ruta), 'utf8');
      expect(contenido, ruta).not.toMatch(/\b(npm|npx|node)\b/);
    }
  });
});
