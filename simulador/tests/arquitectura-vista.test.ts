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
import { FILAS_VISIBLES } from '../src/vista';

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

describe('las listas de la zona D se desplazan por filas enteras', () => {
  const estilos = readFileSync(join(RAIZ, 'ui', 'estilos.css'), 'utf8');
  const bloque = estilos.slice(estilos.indexOf('.lista-archivos'));

  it('el tope es un multiplo exacto del alto de fila', () => {
    expect(bloque).toContain('max-height: calc(var(--alto-fila) * var(--filas-visibles))');
    expect(bloque).toContain('height: var(--alto-fila)');
    expect(bloque).toContain('overflow-y: auto');
  });

  it('el alto de fila acompana la escala del modo relator', () => {
    expect(bloque).toContain('--alto-fila: calc(var(--escala) * 18px)');
  });

  it('la interfaz usa el mismo numero de filas que la hoja de estilos', () => {
    const areas = readFileSync(join(RAIZ, 'ui', 'Areas.tsx'), 'utf8');
    expect(FILAS_VISIBLES).toBe(6);
    expect(bloque).toContain(`--filas-visibles: ${FILAS_VISIBLES}`);
    expect(areas).toContain("'--filas-visibles': FILAS_VISIBLES");
    // La lista solo es parada de tabulacion cuando de verdad se desplaza (CA8).
    expect(areas).toContain('columna.elementos.length > FILAS_VISIBLES ? 0 : undefined');
  });
});

describe('la ayuda de la consola no es permanente', () => {
  const consola = readFileSync(join(RAIZ, 'ui', 'Consola.tsx'), 'utf8');

  it('las dos lineas dependen de que el campo este enfocado y vacio', () => {
    expect(consola).toContain("const mostrarAyuda = enfocado && entrada === '';");
    expect(consola).toContain('{mostrarAyuda && (');
    expect(consola).toContain('onFocus={() => setEnfocado(true)}');
    expect(consola).toContain('onBlur={() => setEnfocado(false)}');
  });
});

describe('la pantalla se ajusta al contenido', () => {
  const aplicacion = readFileSync(join(RAIZ, 'ui', 'Aplicacion.tsx'), 'utf8');
  const consola = readFileSync(join(RAIZ, 'ui', 'Consola.tsx'), 'utf8');
  const grafo = readFileSync(join(RAIZ, 'ui', 'Grafo.tsx'), 'utf8');

  it('el bloque central no impone su altura a la consola ni al grafo', () => {
    expect(aplicacion).toContain('items-start');
    // La altura fija anterior es justamente lo que se quito: ahora es un
    // minimo, de modo que las zonas no se estiran para rellenar la ventana.
    expect(aplicacion).not.toMatch(/(?<![-\w])h-\[100dvh\]/);
    expect(aplicacion).toContain('min-h-[100dvh]');
    // Lo que sobra queda entre el grafo y las areas, no debajo de todo.
    expect(aplicacion).toContain('mt-auto');
  });

  it('la consola y el grafo crecen hasta un tope y ahi se desplazan por dentro', () => {
    expect(consola).toContain('max-h-[var(--alto-central)]');
    expect(consola).toContain('min-h-0 overflow-auto');
    expect(grafo).toContain('max-h-full overflow-auto');
    expect(aplicacion).toContain('[--alto-central:calc(100dvh-20rem)]');
  });
});

/**
 * Textos que el participante lee en pantalla. Van acentuados aunque los specs
 * vinieran sin tildes: lo que se corrige es la interfaz, no el encargo. Los
 * nombres del codigo siguen sin tilde a proposito, y por eso aqui se afirma
 * sobre el texto exacto y no sobre el archivo entero.
 */
const TEXTOS_ACENTUADOS: Readonly<Record<string, readonly string[]>> = {
  'Consola.tsx': [
    'Previsualización:',
    'confirmación(es) en trazo discontinuo',
    ', el puntero se moverá',
    'Tabulación completa la orden. Con el campo vacío, tabulación sale de la consola.',
    'Previsualización activa: lo que la orden haría',
  ],
  'LineaTiempo.tsx': ['aria-label="Línea de tiempo"', '>Línea de tiempo<'],
  'Grafo.tsx': ['Todavía no hay confirmaciones', 'aparecerá aquí', 'confirmaciones más recientes'],
  'BarraEstado.tsx': [
    'etiqueta="previsualización"',
    'Nada sale de aquí.',
    '· sesión {opcion.sesion} ·',
  ],
  'Areas.tsx': ['titulo="confirmación"', 'titulo="árbol"'],
};

describe('los textos visibles van acentuados', () => {
  for (const [archivo, textos] of Object.entries(TEXTOS_ACENTUADOS)) {
    it(archivo, () => {
      const contenido = readFileSync(join(RAIZ, 'ui', archivo), 'utf8');
      for (const texto of textos) expect(contenido).toContain(texto);
    });
  }

  it('el rotulo de cada confirmacion del grafo tambien', () => {
    const grafo = readFileSync(join(RAIZ, 'ui', 'Grafo.tsx'), 'utf8');
    expect(grafo).toContain('aria-label={`Confirmación ');
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
