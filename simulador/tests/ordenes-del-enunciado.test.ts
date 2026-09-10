/**
 * Extraccion de las ordenes desde el enunciado (seccion 2 del SPEC 008).
 *
 * Las pruebas de punta a punta ejecutan lo que el enunciado dice, y no una
 * lista escrita aparte. Lo que se comprueba aqui es que la extraccion y la
 * clasificacion hagan lo que prometen, sin necesidad de levantar el navegador.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ejecutar } from '../src/core/motor';
import { EQUIVALENTES, OPCIONES } from '../src/core/contrato';
import { escenarioPorId } from '../src/escenarios';
import {
  bloquesDe,
  motivoDeclarado,
  ordenesDe,
  ordenesEnProsa,
  resolverMarcadores,
  resumen,
  type OrdenDelEnunciado,
} from '../cypress/soporte/ordenes';

const MOTOR = fileURLToPath(new URL('../src/core', import.meta.url));

const LABS = fileURLToPath(new URL('../../labs', import.meta.url));
const enunciado = (numero: string): string =>
  readFileSync(`${LABS}/lab-${numero}/README.md`, 'utf8');

describe('los bloques salen del enunciado, en orden', () => {
  it('toma solo lo que va entre cercas', () => {
    const bloques = bloquesDe('texto\n```\nuno\n```\nmas texto\n```\ndos\n```\n');
    expect(bloques.map((bloque) => bloque.contenido)).toEqual(['uno', 'dos']);
  });

  it('anota la linea de cada bloque, para poder ubicar un fallo', () => {
    const bloques = bloquesDe('a\nb\n```\nuno\n```\n');
    expect(bloques[0]?.linea).toBe(4);
  });

  it('deja fuera lo que no es una orden', () => {
    // Los enunciados muestran el contenido de los archivos en bloques iguales.
    const ordenes = ordenesDe('```\n# Platos\n\n- cazuela\n- curanto\n```\n');
    expect(ordenes).toEqual([]);
  });
});

describe('la clasificacion no salta nada en silencio', () => {
  it('cada orden saltada lleva su motivo', () => {
    for (const numero of ['01', '02', '03']) {
      for (const orden of ordenesDe(enunciado(numero))) {
        if (orden.clase === 'comparada') continue;
        expect(orden.motivo, `${numero}: ${orden.texto}`).to.not.equal('');
      }
    }
  });

  it('lo que lleva un marcador de posicion no se ejecuta a ciegas', () => {
    const ordenes = ordenesDe('```\ngit show <identificador>\n```\n');
    expect(ordenes[0]?.clase).toBe('omitida');
    expect(ordenes[0]?.motivo).toContain('marcador de posicion');
  });

  it('lo que el motor no conoce se marca para correrse solo en Git', () => {
    // El verbo se consulta contra la tabla de ordenes del propio motor: el dia
    // que aprenda una orden nueva, la prueba la recoge sola.
    const ordenes = ordenesDe('```\ngit bisect start\ngit status\n```\n');
    expect(ordenes[0]?.clase).toBe('declarada');
    expect(ordenes[0]?.motivo).toContain('git bisect');
    expect(ordenes[1]?.clase).toBe('comparada');
  });

  it('mirar dentro de la carpeta oculta se corre solo en Git', () => {
    const ordenes = ordenesDe('```\ncat .git/HEAD\n```\n');
    expect(ordenes[0]?.clase).toBe('declarada');
    expect(ordenes[0]?.motivo).toContain('carpeta oculta');
  });
});

describe('los marcadores que si se pueden resolver salen del escenario', () => {
  it('el archivo a descartar y el archivo a sacar de la preparacion', () => {
    // No se escriben a mano: se leen de la declaracion del escenario, que es
    // la unica fuente de la forma del laboratorio (SPEC 007).
    const ordenes = resolverMarcadores(ordenesDe(enunciado('02')), '02');
    const textos = ordenes.map((orden) => orden.texto);
    expect(textos).toContain('git restore ingredientes.md');
    expect(textos).toContain('git restore --staged cocineros.md');
    expect(textos).not.toContain('git restore <archivo>');
  });

  it('resolverlos convierte dos pasos centrales en comparados', () => {
    const antes = resumen(ordenesDe(enunciado('02')));
    const despues = resumen(resolverMarcadores(ordenesDe(enunciado('02')), '02'));
    expect(despues.comparadas).toBe(antes.comparadas + 2);
    expect(despues.omitidas).toBe(antes.omitidas - 2);
  });

  it('los que nombran un identificador se quedan sin resolver', () => {
    // Los identificadores del simulador y los de Git no coinciden por diseño:
    // no hay un unico valor que sirva en los dos lados.
    const ordenes = resolverMarcadores(ordenesDe(enunciado('03')), '03');
    expect(ordenes.filter((orden) => orden.texto.includes('<')).length).toBeGreaterThan(0);
  });
});

describe('7.5 · ninguna orden del guion se acepta y se ignora', () => {
  // La garantia central del SPEC 010. Para cada orden del guion, el motor
  // tiene que hacer una de tres cosas: ejecutarla entera, decir que no la
  // implementa, o decir que la orden no existe. La cuarta, aceptarla y
  // descartarla en silencio, es la que este spec viene a eliminar.
  const LABORATORIOS = ['01', '02', '03', '04', '05', '06'];

  function guionDe(numero: string): readonly OrdenDelEnunciado[] {
    const texto = enunciado(numero);
    return [...resolverMarcadores(ordenesDe(texto), numero), ...ordenesEnProsa(texto)];
  }

  it('cada orden del guion cae en una de las tres respuestas, con motivo escrito', () => {
    for (const numero of LABORATORIOS) {
      for (const orden of guionDe(numero)) {
        if (orden.clase === 'comparada') {
          expect(orden.motivo, `lab-${numero}: ${orden.texto}`).toBe('');
          continue;
        }
        expect(orden.motivo, `lab-${numero}: ${orden.texto}`).not.toBe('');
      }
    }
  });

  it('lo declarado como no soportado el motor lo dice, y no lo ejecuta', () => {
    for (const numero of LABORATORIOS) {
      const estado = escenarioPorId(`lab-${numero}`);
      for (const orden of guionDe(numero)) {
        if (orden.clase !== 'declarada') continue;
        const resultado = ejecutar(estado, orden.texto);
        const dicho = resultado.salida.some((linea) => linea.tipo === 'limite');
        const inexistente = resultado.salida.some(
          (linea) =>
            linea.texto.includes('is not a git command') ||
            linea.texto.includes('command not found'),
        );
        expect(dicho || inexistente, `lab-${numero}: ${orden.texto}`).toBe(true);
        expect(resultado.estado, `lab-${numero}: ${orden.texto}`).toBe(estado);
      }
    }
  });

  it('toda opcion que el contrato reconoce la lee alguien, o esta declarada como equivalente', () => {
    // Una opcion listada como reconocida que ningun manejador consulta es,
    // literalmente, una opcion aceptada y descartada. Esto lo detecta sin
    // depender de que alguien se acuerde de mirarlo.
    const fuentes = readdirSync(MOTOR, { recursive: true, encoding: 'utf8' })
      .filter((nombre) => nombre.endsWith('.ts'))
      .map((nombre) => readFileSync(join(MOTOR, nombre), 'utf8'))
      .join('\n');

    for (const [verbo, opciones] of Object.entries(OPCIONES)) {
      for (const opcion of opciones) {
        if (opcion === '--' || Object.hasOwn(EQUIVALENTES, opcion)) continue;
        expect(fuentes.includes(`'${opcion}'`), `${verbo} ${opcion}`).toBe(true);
      }
    }
  });

  it('el guion no usa ninguna opcion que el contrato no nombre', () => {
    // Al reves que la anterior: lo que el enunciado escribe tiene que estar
    // decidido, sea implementado o declarado. Nada a medio camino.
    for (const numero of LABORATORIOS) {
      for (const orden of guionDe(numero)) {
        if (orden.clase !== 'comparada') continue;
        expect(motivoDeclarado(orden.texto), `lab-${numero}: ${orden.texto}`).toBeNull();
      }
    }
  });
});

describe('lo que queda declarado, y por que', () => {
  it('las excepciones del punto 7.3 son las de los marcadores', () => {
    // Los pasos donde el participante copia un identificador de una salida
    // anterior. No se automatizan porque los identificadores del simulador y
    // los de Git no coinciden por diseño.
    const conMarcador: string[] = [];
    for (const numero of ['01', '02', '03', '04', '05', '06']) {
      const texto = enunciado(numero);
      for (const orden of resolverMarcadores(ordenesDe(texto), numero)) {
        if (orden.clase === 'omitida' && orden.motivo.includes('marcador')) {
          conMarcador.push(`${numero}: ${orden.texto}`);
        }
      }
    }
    expect(conMarcador).toHaveLength(7);
  });

  it('lo demas que se declara es por contenido, por la carpeta oculta o por el disco', () => {
    const familias = new Set<string>();
    for (const numero of ['01', '02', '03', '04', '05', '06']) {
      const texto = enunciado(numero);
      for (const orden of [...resolverMarcadores(ordenesDe(texto), numero), ...ordenesEnProsa(texto)]) {
        if (orden.clase !== 'declarada') continue;
        familias.add(orden.motivo);
      }
    }
    // Cada motivo distinto es una decision tomada y escrita en el contrato.
    for (const motivo of familias) expect(motivo.length).toBeGreaterThan(10);
    expect(familias.size).toBeLessThanOrEqual(10);
  });
});
