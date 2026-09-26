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
import { REPARTO_DE_PARTIDA } from '../src/ui/Consola';
import { REPARTO_MAXIMO, REPARTO_MINIMO } from '../src/ui/Tirador';
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
    // Veintidos desde el SPEC 013: los datos subieron de once a trece pixeles
    // para pesar mas que su rotulo, y la fila crecio con ellos.
    expect(bloque).toContain('--alto-fila: calc(var(--escala) * 22px)');
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
    // El modo taller no lleva ayuda al pie (punto 4.7 del SPEC 026): la
    // condicion suma `ayuda`, que en el modo de escenarios vale siempre true.
    expect(consola).toContain("const mostrarAyuda = enfocado && entrada === '' && ayuda;");
    expect(consola).toContain('ayuda = true,');
    expect(consola).toContain('{mostrarAyuda && (');
    expect(consola).toContain('onFocus={() => setEnfocado(true)}');
    expect(consola).toContain('onBlur={() => setEnfocado(false)}');
  });
});

/**
 * La disposicion del SPEC 017.
 *
 * Reemplaza la del SPEC 002 (seccion 7.11), donde la consola y el grafo median
 * lo que su contenido pedia y el grafo reservaba un alto para crecer. Con eso
 * la consola quedaba como una caja chica arriba a la izquierda con tres
 * cuartos de vacio debajo, que es lo que el product owner vio.
 */
describe('la disposicion reparte la pantalla (SPEC 017)', () => {
  const aplicacion = readFileSync(join(RAIZ, 'ui', 'Aplicacion.tsx'), 'utf8');
  const consola = readFileSync(join(RAIZ, 'ui', 'Consola.tsx'), 'utf8');
  const grafo = readFileSync(join(RAIZ, 'ui', 'Grafo.tsx'), 'utf8');

  it('en escritorio la pantalla mide la ventana, y no mas', () => {
    // Un alto y no un minimo: con un minimo, el grafo sin apretar del primer
    // dibujo estiraba la pagina y la medicion ya no apretaba nada.
    expect(aplicacion).toContain('min-[1280px]:h-[100dvh]');
  });

  it('la consola ocupa la columna y ancla su contenido abajo', () => {
    expect(consola).toContain('min-[1280px]:basis-[var(--reparto)]');
    expect(consola).toContain('<div className="flex-[1_0_auto]" aria-hidden="true" />');
    expect(consola).toContain('min-h-0 flex-1 flex-col overflow-auto');
  });

  it('el grafo se desplaza por dentro cuando ni apretando cabe', () => {
    expect(grafo).toContain('min-h-0 flex-1 overflow-auto');
  });

  it('el reparto de partida deja entrar noventa caracteres, acotado a los limites del tirador', () => {
    // Noventa y uno: con noventa justos el redondeo partia la linea igual.
    expect(REPARTO_DE_PARTIDA).toBe(`clamp(${REPARTO_MINIMO}%, calc(91ch + 42px), ${REPARTO_MAXIMO}%)`);
    expect([REPARTO_MINIMO, REPARTO_MAXIMO]).toEqual([24, 72]);
  });
});

describe('SPEC 017 · la barra, las areas y la tipografia', () => {
  const estilos = readFileSync(join(RAIZ, 'ui', 'estilos.css'), 'utf8');

  it('6.3 las dos pilas tipograficas estan declaradas, con Windows, macOS y Linux', () => {
    const tema = estilos.slice(estilos.indexOf('@theme {'), estilos.indexOf('}', estilos.indexOf('@theme {')));
    for (const familia of ['system-ui', '-apple-system', "'Segoe UI'", 'Roboto', "'Noto Sans'", "'Liberation Sans'"]) {
      expect(tema, familia).toContain(familia);
    }
    for (const familia of ['ui-monospace', "'SF Mono'", "'Cascadia Mono'", 'Consolas', "'DejaVu Sans Mono'", "'Liberation Mono'"]) {
      expect(tema, familia).toContain(familia);
    }
  });

  it('4.4 ningun texto de la interfaz nombra el panel del remoto', () => {
    for (const archivo of ['Aplicacion.tsx', 'Areas.tsx', 'BarraEstado.tsx', 'Consola.tsx', 'Grafo.tsx', 'LineaTiempo.tsx']) {
      expect(readFileSync(join(RAIZ, 'ui', archivo), 'utf8'), archivo).not.toMatch(/Repositorio remoto|git push/);
    }
    expect(readFileSync(join(RAIZ, 'vista', 'pantalla.ts'), 'utf8')).not.toContain("titulo: 'Repositorio remoto'");
  });

  it('5.1 el tema es un boton con sol y luna, fuera del grupo de interruptores', () => {
    const barra = readFileSync(join(RAIZ, 'ui', 'BarraEstado.tsx'), 'utf8');
    expect(barra).toContain('aria-label="Cambiar tema"');
    expect(barra).toContain('{temaClaro ? <Sol /> : <Luna />}');
    expect(barra).not.toContain('etiqueta="tema claro"');
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
    '· {opcion.titulo}',
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

describe('SPEC 013 · temas y movimiento', () => {
  const estilos = readFileSync(join(RAIZ, 'ui', 'estilos.css'), 'utf8');

  it('7.2 hay un tema claro que redefine la paleta completa', () => {
    const oscuro = estilos.slice(estilos.indexOf(':root {'), estilos.indexOf('}', estilos.indexOf(':root {')));
    const claro = estilos.slice(
      estilos.indexOf(":root[data-tema='claro']"),
      estilos.indexOf('}', estilos.indexOf(":root[data-tema='claro']")),
    );
    const variables = (bloque: string): string[] => [...bloque.matchAll(/(--[\w-]+):/g)].map((m) => m[1] ?? '');
    // Cada color del oscuro tiene su tono en el claro; la escala no es un color.
    const colores = variables(oscuro).filter((nombre) => nombre !== '--escala' && nombre !== '--fondo-consola');
    expect(colores.length).toBeGreaterThan(10);
    for (const nombre of colores) expect(variables(claro), nombre).toContain(nombre);
  });

  it('7.3 la consola se queda oscura en los dos temas', () => {
    expect(readFileSync(join(RAIZ, 'ui', 'Consola.tsx'), 'utf8')).toContain('panel terminal');
    const terminal = estilos.slice(estilos.indexOf('.terminal {'), estilos.indexOf('}', estilos.indexOf('.terminal {')));
    for (const nombre of ['--fondo-consola', '--texto', '--texto-apagado', '--consola-verde', '--consola-rojo']) {
      expect(terminal, nombre).toContain(`${nombre}:`);
    }
    expect(terminal).toContain('color-scheme: dark');
  });

  it('6.5 toda duracion de movimiento esta entre ciento cincuenta y trescientos milisegundos', () => {
    const fuera = estilos.slice(0, estilos.indexOf('@media (prefers-reduced-motion: reduce)'));
    const duraciones = [...fuera.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
    expect(duraciones.length).toBeGreaterThanOrEqual(4);
    for (const duracion of duraciones) {
      expect(duracion).toBeGreaterThanOrEqual(150);
      expect(duracion).toBeLessThanOrEqual(300);
    }
  });

  it('10.2 ni degradados ni sombras', () => {
    const componentes = ['Aplicacion.tsx', 'Areas.tsx', 'BarraEstado.tsx', 'Consola.tsx', 'Grafo.tsx', 'LineaTiempo.tsx']
      .map((archivo) => readFileSync(join(RAIZ, 'ui', archivo), 'utf8'))
      .join('\n');
    expect(`${estilos}\n${componentes}`).not.toMatch(/gradient|box-shadow|drop-shadow|\bshadow-|blur\(/);
  });
});
