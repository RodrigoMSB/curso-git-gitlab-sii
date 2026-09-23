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

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { configuracionDelTaller } from '../../cypress/soporte/enunciado';
import { aliasDelTaller, ordenesDe, ordenPara, resolverMarcadores } from '../../cypress/soporte/ordenes';
import { LectorReal } from '../../src/real/lector';
import { adaptadorDeDisco } from './disco';
import { comoPorcelana, lineas, porcelana } from './repos';

const CLON = join(__dirname, '..', '..', '..');
const LABORATORIOS = ['02', '03', '04', '05', '06', '07', '08'];
const montados: string[] = [];
const informe: string[] = [];
const notas: string[] = [];

function enunciado(numero: string): string {
  return readFileSync(join(CLON, 'labs', `lab-${numero}`, 'README.md'), 'utf8');
}

function entorno(configGlobal: string): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: configGlobal, GIT_CONFIG_SYSTEM: '/dev/null' };
}

/** Lo mismo que hace el arnes de Cypress: un clon de mentira con el laboratorio y su `preparar.sh` corrido. */
function preparar(numero: string): { recetario: string; configGlobal: string } {
  const raiz = mkdtempSync(join(tmpdir(), 'lector-lab-'));
  montados.push(raiz);
  const carpeta = join(raiz, 'curso-git-gitlab-sii', 'labs', `lab-${numero}`);
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    cpSync(join(CLON, 'labs', `lab-${numero}`, archivo), join(carpeta, archivo));
    chmodSync(join(carpeta, archivo), 0o755);
  }
  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '');
  for (const [clave, valor] of configuracionDelTaller(enunciado('01'))) {
    execFileSync('git', ['config', '--global', clave, valor], { env: entorno(configGlobal), stdio: 'ignore' });
  }
  execFileSync('bash', ['./preparar.sh', '--forzar'], { cwd: carpeta, env: entorno(configGlobal), stdio: 'ignore' });
  return { recetario: join(raiz, 'taller-git-trabajo', `lab-${numero}`, 'recetario'), configGlobal };
}

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
    const alias = aliasDelTaller(enunciado('01'));
    const ordenes = resolverMarcadores(ordenesDe(enunciado(numero), alias), numero, alias);
    const { recetario, configGlobal } = preparar(numero);
    const git = (...args: string[]): string =>
      execFileSync('git', ['-c', 'i18n.logOutputEncoding=UTF-8', ...args], { cwd: recetario, env: entorno(configGlobal) }).toString();

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
      ...(inicial.referencias.guardados.length > 0 ? [`refs/stash ${inicial.referencias.guardados[0]}`] : []),
    ];
    expect(leidas.sort()).toEqual(referencias.filter((r) => !/\/HEAD /.test(r)).sort());

    // CA2: el guion, orden por orden.
    const salidas = new Map<string, string>();
    const distintas: string[] = [];
    const tiempos: number[] = [];
    let iguales = 0;
    // La seccion de rescate trae ordenes para quien se perdio, con marcadores
    // que dependen de su estado (`git add <archivo>` tras un rebase detenido).
    // En los laboratorios con escenario el soporte las resuelve; en el 07 no
    // hay escenario de donde sacar el archivo, y esa orden se salta con su
    // motivo en el informe. Cualquier otra omitida hace fallar la prueba.
    const rescate = enunciado(numero)
      .split('\n')
      .findIndex((linea) => /^##\s+Si algo sali/.test(linea));
    const saltadas: string[] = [];
    for (const orden of ordenes) {
      if (orden.clase === 'omitida' && rescate >= 0 && orden.linea > rescate) {
        saltadas.push(`linea ${orden.linea} «${orden.texto}»: seccion de rescate, ${orden.motivo}`);
        continue;
      }
      expect(orden.clase, `«${orden.texto}» (linea ${orden.linea}) se saltaria`).not.toBe('omitida');
      const eleccion = orden.eleccion;
      const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
      const corrida = spawnSync('bash', ['-c', ordenPara(orden, identificador)], {
        cwd: recetario,
        encoding: 'utf8',
        env: entorno(configGlobal),
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      });
      salidas.set(orden.texto, `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`);

      const repositorio = await leer(recetario);
      tiempos.push(repositorio.tiempos.total ?? 0);
      const deLector = comoPorcelana(repositorio.cambios);
      const deGit = porcelana(recetario, configGlobal);
      if (JSON.stringify(deLector) === JSON.stringify(deGit)) iguales += 1;
      else distintas.push(`linea ${orden.linea} «${orden.texto}»: lector ${JSON.stringify(deLector)}, git ${JSON.stringify(deGit)}`);
    }

    const media = tiempos.reduce((a, b) => a + b, 0) / Math.max(1, tiempos.length);
    informe.push(
      `| ${numero} | ${ordenes.length - saltadas.length} | ${iguales} | ${distintas.length} | ${media.toFixed(1)} | ${Math.max(...tiempos).toFixed(1)} |`,
    );
    for (const saltada of saltadas) notas.push(`- Laboratorio ${numero}, ${saltada}.`);
    expect(distintas).toEqual([]);
  }, 300_000);
});
