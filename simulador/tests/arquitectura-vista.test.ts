/**
 * Reglas de arquitectura de la capa visual.
 *
 * El criterio CA7 del SPEC 002 pide que ningun componente importe logica de
 * dominio ni calcule relaciones entre confirmaciones, y lo declara verificable
 * por inspeccion de las importaciones. Eso se comprueba aqui de forma
 * automatica, para que la regla no dependa de que alguien se acuerde.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const RAIZ = fileURLToPath(new URL('../src', import.meta.url));

function archivosDe(carpeta: string): readonly string[] {
  return readdirSync(carpeta).flatMap((entrada) => {
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) return archivosDe(ruta);
    return /\.(ts|tsx)$/.test(entrada) ? [ruta] : [];
  });
}

function importacionesDe(ruta: string): readonly string[] {
  const contenido = readFileSync(ruta, 'utf8');
  return [...contenido.matchAll(/from\s+'([^']+)'/g)].map(([, especificador = '']) =>
    especificador,
  );
}

/** Modulos del motor: la vista no puede alcanzarlos. */
const PROHIBIDOS = [
  '../core',
  '../../core',
  '../escenarios',
  '../../escenarios',
  '../grafico/disposicion',
  '../../grafico/disposicion',
];

describe('CA7 · la vista no importa logica de dominio', () => {
  const componentes = archivosDe(join(RAIZ, 'ui'));

  it('hay componentes que revisar', () => {
    expect(componentes.length).toBeGreaterThan(4);
  });

  it('ningun archivo de src/ui importa el motor, los escenarios ni el calculo de posiciones', () => {
    const infracciones: string[] = [];

    for (const archivo of componentes) {
      for (const especificador of importacionesDe(archivo)) {
        const prohibido = PROHIBIDOS.some(
          (raiz) => especificador === raiz || especificador.startsWith(`${raiz}/`),
        );
        if (prohibido) infracciones.push(`${archivo.replace(RAIZ, 'src')} -> ${especificador}`);
      }
    }

    expect(infracciones).toEqual([]);
  });

  it('src/ui solo se apoya en react, en sus propios archivos y en la capa de vista', () => {
    const permitidos = /^(react(-dom)?(\/.*)?|\.\/[^']+|\.\.\/vista|\.\.\/grafico\/tipos)$/;
    const fuera: string[] = [];

    for (const archivo of componentes) {
      for (const especificador of importacionesDe(archivo)) {
        if (!permitidos.test(especificador)) {
          fuera.push(`${archivo.replace(RAIZ, 'src')} -> ${especificador}`);
        }
      }
    }

    expect(fuera).toEqual([]);
  });

  it('el calculo de posiciones no depende de React ni del documento', () => {
    for (const archivo of archivosDe(join(RAIZ, 'grafico'))) {
      const contenido = readFileSync(archivo, 'utf8');
      expect(contenido).not.toMatch(/from\s+'react/);
      expect(contenido).not.toMatch(/\bdocument\.|\bwindow\./);
    }
  });

  it('5.3 el grafo se dibuja sin biblioteca de grafos', () => {
    const dependencias = JSON.parse(
      readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
    ) as { dependencies: Record<string, string> };

    expect(Object.keys(dependencias.dependencies)).toEqual(['react', 'react-dom']);
    expect(readFileSync(join(RAIZ, 'ui', 'Grafo.tsx'), 'utf8')).toContain('<svg');
  });
});

describe('CA10 · movimiento reducido', () => {
  const estilos = readFileSync(join(RAIZ, 'ui', 'estilos.css'), 'utf8');

  it('la hoja de estilos anula animaciones y transiciones cuando el sistema lo pide', () => {
    expect(estilos).toContain('@media (prefers-reduced-motion: reduce)');

    const bloque = estilos.slice(estilos.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(bloque).toContain('animation-duration: 0.001ms !important');
    expect(bloque).toContain('transition-duration: 0.001ms !important');
  });

  it('la interfaz ademas consulta la preferencia para no montar las animaciones', () => {
    const gancho = readFileSync(join(RAIZ, 'ui', 'useMovimientoReducido.ts'), 'utf8');
    expect(gancho).toContain('(prefers-reduced-motion: reduce)');
    expect(readFileSync(join(RAIZ, 'ui', 'Aplicacion.tsx'), 'utf8')).toContain(
      'animar={!movimientoReducido}',
    );
  });
});

describe('R5 · ninguna fuente tipografica externa', () => {
  it('las familias son las del sistema y no hay descargas de fuentes', () => {
    const estilos = readFileSync(join(RAIZ, 'ui', 'estilos.css'), 'utf8');
    expect(estilos).not.toMatch(/@font-face|fonts\.googleapis|fonts\.gstatic|\.woff/);
    expect(estilos).toContain('system-ui');
    expect(estilos).toContain('ui-monospace');
  });
});
