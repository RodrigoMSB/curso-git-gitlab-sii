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
import { bloquesDe, ordenesDe, resolverMarcadores, resumen } from '../cypress/soporte/ordenes';

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
    expect(ordenes[0]?.clase).toBe('solo-git');
    expect(ordenes[0]?.motivo).toContain('git bisect');
    expect(ordenes[1]?.clase).toBe('comparada');
  });

  it('mirar dentro de la carpeta oculta se corre solo en Git', () => {
    const ordenes = ordenesDe('```\ncat .git/HEAD\n```\n');
    expect(ordenes[0]?.clase).toBe('solo-git');
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

describe('cuanto de cada laboratorio queda comparado', () => {
  it('el laboratorio 02 se compara en poco mas de la mitad, y se sabe por que', () => {
    // Dos cosas bajan la cifra, y las dos con razon. La Parte 1 enseña a
    // filtrar el historial por autor y por fecha, y el motor no implementa
    // esos filtros (seccion 28 de docs/arquitectura.md). La Parte 4, que llego
    // con el SPEC 009 desde el antiguo laboratorio 03, mira por dentro la
    // carpeta oculta, que el simulador no modela a proposito.
    const ordenes = resolverMarcadores(ordenesDe(enunciado('02')), '02');
    const cuenta = resumen(ordenes);
    expect(cuenta.comparadas / cuenta.total).toBeGreaterThan(0.55);

    const soloGit = ordenes.filter((orden) => orden.clase === 'solo-git');
    const porFiltro = soloGit.filter((orden) => orden.texto.startsWith('git log'));
    const porLaCarpetaOculta = soloGit.filter((orden) =>
      (orden.motivo ?? '').includes('carpeta oculta'),
    );
    expect(porFiltro.length).toBeGreaterThanOrEqual(4);
    expect(porLaCarpetaOculta.length).toBeGreaterThanOrEqual(10);
    // Entre las dos explican casi todo lo que queda sin comparar.
    expect(porFiltro.length + porLaCarpetaOculta.length).toBeGreaterThan(soloGit.length * 0.7);
  });

  it('el laboratorio 03 se compara en dos tercios: es de mover y borrar archivos', () => {
    // Ordenar el recetario es trabajo de arbol y de indice, que el motor si
    // modela. Lo que queda fuera es sobre todo `ls` y `cat`, que no son Git.
    const cuenta = resumen(resolverMarcadores(ordenesDe(enunciado('03')), '03'));
    expect(cuenta.comparadas / cuenta.total).toBeGreaterThan(0.6);
    expect(cuenta.comparadas).toBeGreaterThan(cuenta.soloGit);
  });
});
