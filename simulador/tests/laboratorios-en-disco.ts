/**
 * Ayudantes para correr los laboratorios de verdad, con Git y Bash.
 *
 * Montan un clon del curso de mentira con el laboratorio dentro y el trabajo
 * del participante en la carpeta hermana, que es la disposicion real
 * (seccion 17 de docs/arquitectura.md). Los comparten las pruebas de los
 * laboratorios y las que comparan el escenario del simulador contra el
 * repositorio que la preparacion deja en el disco.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Corrida {
  readonly codigo: number;
  readonly salida: string;
}

export function carpetaTemporal(): string {
  return mkdtempSync(join(tmpdir(), 'laboratorios-'));
}

/**
 * Un entorno con configuracion global y de sistema propias, para que lo que
 * tenga puesto la maquina no se cuele en lo que se esta probando.
 */
export function entorno(configGlobal: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: configGlobal,
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
}

export function git(carpeta: string, configGlobal: string, ...argumentos: readonly string[]): string {
  return execFileSync('git', ['-C', carpeta, ...argumentos], {
    encoding: 'utf8',
    env: entorno(configGlobal),
  }).trim();
}

/**
 * Como `git`, pero conservando los espacios del comienzo de cada linea.
 *
 * Hace falta para `git status --porcelain`, donde la primera columna es un
 * espacio cuando el cambio no esta preparado: recortarla convierte
 * « M archivo» en «M archivo», y con eso el estado se lee al reves y el nombre
 * pierde su primera letra.
 */
export function gitCrudo(
  carpeta: string,
  configGlobal: string,
  ...argumentos: readonly string[]
): string {
  return execFileSync('git', ['-C', carpeta, ...argumentos], {
    encoding: 'utf8',
    env: entorno(configGlobal),
  }).replace(/\n+$/, '');
}

/** Corre el verificador como lo corre el participante y recoge todo. */
export function verificar(carpetaDelLaboratorio: string, configGlobal: string): Corrida {
  try {
    const salida = execFileSync('bash', ['./verificar.sh'], {
      cwd: carpetaDelLaboratorio,
      encoding: 'utf8',
      env: entorno(configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { codigo: 0, salida };
  } catch (error) {
    const fallo = error as { status?: number; stdout?: string; stderr?: string };
    return { codigo: fallo.status ?? -1, salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}` };
  }
}

export interface Escenario {
  /** <clon>/labs/lab-NN, desde donde se corren los scripts. */
  readonly carpeta: string;
  /** El repositorio del participante, hermano del clon. */
  readonly recetario: string;
  readonly configGlobal: string;
  readonly clon: string;
  /** El padre comun del clon y de la carpeta de trabajo. */
  readonly raiz: string;
}

/**
 * Monta un clon de mentira con el laboratorio pedido dentro, sin preparar nada.
 * Sirve para cualquier laboratorio con escenario: los trece que faltan tienen
 * esta misma forma.
 */
export function montarLab(numero: string): Escenario {
  const origen = fileURLToPath(new URL(`../../labs/lab-${numero}`, import.meta.url));
  const raiz = carpetaTemporal();
  const clon = join(raiz, 'curso-git-gitlab-sii');
  const carpeta = join(clon, 'labs', `lab-${numero}`);
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    cpSync(join(origen, archivo), join(carpeta, archivo));
    execFileSync('chmod', ['+x', join(carpeta, archivo)]);
  }

  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '[user]\n\tname = Otro Cualquiera\n\temail = otro@x.cl\n');

  // El clon es un repositorio de verdad, como en la sala.
  const env = entorno(configGlobal);
  execFileSync('git', ['-C', clon, 'init', '-q'], { env });
  writeFileSync(join(clon, 'README.md'), 'el repositorio del curso\n');
  execFileSync('git', ['-C', clon, 'add', '-A'], { env });
  execFileSync('git', ['-C', clon, 'commit', '-q', '-m', 'el curso'], { env });

  return {
    carpeta,
    recetario: join(raiz, `lab-${numero}`, 'recetario'),
    configGlobal,
    clon,
    raiz,
  };
}

export const montarLab02 = (): Escenario => montarLab('02');

export function preparar(esc: Escenario, ...argumentos: readonly string[]): Corrida {
  try {
    const salida = execFileSync('bash', ['./preparar.sh', ...argumentos], {
      cwd: esc.carpeta,
      encoding: 'utf8',
      env: entorno(esc.configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { codigo: 0, salida };
  } catch (error) {
    const fallo = error as { status?: number; stdout?: string; stderr?: string };
    return { codigo: fallo.status ?? -1, salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}` };
  }
}

