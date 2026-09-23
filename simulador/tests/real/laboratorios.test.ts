/**
 * El lector real contra los laboratorios del taller (SPEC 020, CA1 y CA2).
 *
 * Cada laboratorio se prepara con su `preparar.sh`, como lo prepara el
 * participante, y se recorre su guion **en Git**, orden por orden. Despues de
 * cada orden se lee el repositorio con el lector y se comparan las areas con
 * `git status --porcelain`, que es el criterio que manda (CA2). Al comienzo se
 * comparan tambien la historia y las referencias con `git log` y
 * `git for-each-ref` (CA1).
 *
 * Las ordenes salen del enunciado con el mismo soporte que usa el recorrido de
 * Cypress, y los identificadores que el guion deja como marcador se copian de
 * lo que Git imprimio, como los copia el participante.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ordenPara } from '../../cypress/soporte/ordenes';
import { LectorReal } from '../../src/real/lector';
import { adaptadorDeDisco } from './disco';
import { CLON, correr, entorno, guion, LABORATORIOS, preparar } from './laboratorio';
import { comoPorcelana, lineas, porcelana } from './repos';

const montados: string[] = [];
const informe: string[] = [];
const notas: string[] = [];

async function leer(dir: string) {
  const lectura = await new LectorReal(adaptadorDeDisco(dir), { autocrlfPorDefecto: 'false' }).leer();
  if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
  return lectura.repositorio;
}

afterAll(() => {
  for (const raiz of montados.splice(0)) rmSync(raiz, { recursive: true, force: true });
  const destino = join(CLON, 'docs', 'poc-repositorio-real');
  mkdirSync(destino, { recursive: true });
  writeFileSync(
    join(destino, 'recorrido-areas.md'),
    [
      '# Las areas leidas del repositorio real, contra git status',
      '',
      'Generado por `simulador/tests/real/laboratorios.test.ts` (SPEC 020, CA2).',
      'Cada laboratorio se recorre en Git; despues de cada orden se compara lo',
      'que el lector pone en las areas con `git status --porcelain`.',
      '',
      '| laboratorio | ordenes | areas iguales | distintas | lectura media (ms) | lectura maxima (ms) |',
      '|---|---|---|---|---|---|',
      ...informe.sort(),
      '',
      ...(notas.length === 0 ? [] : ['Ordenes que no se ejecutaron:', '', ...notas, '']),
    ].join('\n'),
  );
});

describe.each(LABORATORIOS)('laboratorio %s', (numero) => {
  it('historia, referencias y areas iguales a Git despues de cada orden del guion', async () => {
    const { ordenes, saltadas } = guion(numero);
    const lab = preparar(numero);
    montados.push(lab.raiz);
    const { recetario, configGlobal } = lab;
    const git = (...args: string[]): string =>
      execFileSync('git', ['-c', 'i18n.logOutputEncoding=UTF-8', ...args], {
        cwd: recetario,
        env: entorno(configGlobal),
      }).toString();

    // CA1: el punto de partida, contra `git log --all` y `git for-each-ref`.
    const inicial = await leer(recetario);
    const alcanzables = [...inicial.historia.confirmaciones.values()].filter((c) => !inicial.historia.huerfanas.has(c.sha));
    expect(alcanzables.map((c) => `${c.sha} ${c.padres.join(" ")}`.trimEnd()).sort()).toEqual(
      lineas(git('log', '--branches', '--tags', '--remotes', 'HEAD', '--format=%H %P')).map((l) => l.trimEnd()).sort(),
    );
    const referencias = lineas(git('for-each-ref', '--format=%(refname) %(objectname)'));
    const leidas = [
      ...[...inicial.referencias.ramas].map(([n, s]) => `refs/heads/${n} ${s}`),
      ...[...inicial.referencias.etiquetas].map(([n, e]) => `refs/tags/${n} ${e.objeto}`),
      ...[...inicial.referencias.remotas].map(([n, s]) => `refs/remotes/${n} ${s}`),
      ...(inicial.referencias.guardados.length > 0 ? [`refs/stash ${inicial.referencias.guardados[0]?.sha}`] : []),
    ];
    expect(leidas.sort()).toEqual(referencias.filter((r) => !/\/HEAD /.test(r)).sort());

    // CA2: el guion, orden por orden.
    const salidas = new Map<string, string>();
    const distintas: string[] = [];
    const tiempos: number[] = [];
    let iguales = 0;
    for (const orden of ordenes) {
      const eleccion = orden.eleccion;
      const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
      const { salida } = correr(lab, ordenPara(orden, identificador));
      salidas.set(orden.texto, salida);

      const repositorio = await leer(recetario);
      tiempos.push(repositorio.tiempos.total ?? 0);
      const deLector = comoPorcelana(repositorio.cambios);
      const deGit = porcelana(recetario, configGlobal);
      if (JSON.stringify(deLector) === JSON.stringify(deGit)) iguales += 1;
      else distintas.push(`linea ${orden.linea} «${orden.texto}»: lector ${JSON.stringify(deLector)}, git ${JSON.stringify(deGit)}`);
    }

    const media = tiempos.reduce((a, b) => a + b, 0) / Math.max(1, tiempos.length);
    informe.push(
      `| ${numero} | ${ordenes.length} | ${iguales} | ${distintas.length} | ${media.toFixed(1)} | ${Math.max(...tiempos).toFixed(1)} |`,
    );
    for (const saltada of saltadas) notas.push(`- Laboratorio ${numero}, ${saltada}.`);
    expect(distintas).toEqual([]);
  }, 300_000);
});
