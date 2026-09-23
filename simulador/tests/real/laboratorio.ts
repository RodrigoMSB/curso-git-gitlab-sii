/**
 * Un laboratorio del taller preparado en Git real, como lo prepara el
 * participante, para recorrer su guion desde las pruebas del lector.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configuracionDelTaller } from '../../cypress/soporte/enunciado';
import { aliasDelTaller, type OrdenDelEnunciado, ordenesDe, resolverMarcadores } from '../../cypress/soporte/ordenes';

export const CLON = join(__dirname, '..', '..', '..');
export const LABORATORIOS = ['02', '03', '04', '05', '06', '07', '08'];

export function enunciado(numero: string): string {
  return readFileSync(join(CLON, 'labs', `lab-${numero}`, 'README.md'), 'utf8');
}

export function entorno(configGlobal: string): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: configGlobal, GIT_CONFIG_SYSTEM: '/dev/null' };
}

export interface LaboratorioPreparado {
  readonly raiz: string;
  readonly recetario: string;
  readonly configGlobal: string;
}

/** Lo mismo que hace el arnes de Cypress: un clon de mentira con el laboratorio y su `preparar.sh` corrido. */
export function preparar(numero: string): LaboratorioPreparado {
  const raiz = mkdtempSync(join(tmpdir(), 'lector-lab-'));
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
  return { raiz, recetario: join(raiz, 'taller-git-trabajo', `lab-${numero}`, 'recetario'), configGlobal };
}

/**
 * Las ordenes del guion que se recorren, y las que se saltan con su motivo.
 *
 * La seccion de rescate trae ordenes para quien se perdio, con marcadores que
 * dependen de su estado (`git add <archivo>` tras un rebase detenido). En los
 * laboratorios con escenario el soporte las resuelve; en el 07 no hay
 * escenario de donde sacar el archivo, y esa orden se salta. Cualquier otra
 * orden omitida es un error.
 */
export function guion(numero: string): { ordenes: readonly OrdenDelEnunciado[]; saltadas: readonly string[] } {
  const alias = aliasDelTaller(enunciado('01'));
  const todas = resolverMarcadores(ordenesDe(enunciado(numero), alias), numero, alias);
  const rescate = enunciado(numero)
    .split('\n')
    .findIndex((linea) => /^##\s+Si algo sali/.test(linea));
  const ordenes: OrdenDelEnunciado[] = [];
  const saltadas: string[] = [];
  for (const orden of todas) {
    if (orden.clase === 'omitida' && rescate >= 0 && orden.linea > rescate) {
      saltadas.push(`linea ${orden.linea} «${orden.texto}»: seccion de rescate, ${orden.motivo}`);
    } else if (orden.clase === 'omitida') {
      throw new Error(`«${orden.texto}» (linea ${orden.linea}) se saltaria: ${orden.motivo}`);
    } else ordenes.push(orden);
  }
  return { ordenes, saltadas };
}

/**
 * El reloj del confirmador, que avanza un minuto por orden.
 *
 * El recorrido corre decenas de ordenes por segundo, y Git anota la fecha en
 * segundos: `git commit --amend --no-edit` o `git commit -c ORIG_HEAD` dentro
 * del mismo segundo que la confirmacion original fabrican **el mismo objeto**,
 * con el mismo identificador, y parece que no hicieron nada. En clase entre
 * orden y orden pasan segundos; aqui se simula eso.
 */
let reloj = 1_800_000_000;

/** Corre una orden del guion en la terminal del laboratorio: lo que imprimio y si fallo. */
export function correr(lab: LaboratorioPreparado, orden: string): { salida: string; fallo: boolean } {
  reloj += 60;
  const corrida = spawnSync('bash', ['-c', orden], {
    cwd: lab.recetario,
    encoding: 'utf8',
    env: { ...entorno(lab.configGlobal), GIT_COMMITTER_DATE: `@${reloj} -0300` },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  const salida = `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  return { salida, fallo: corrida.status !== 0 || salida.split('\n').some((l) => /^(fatal|error):/.test(l)) };
}
