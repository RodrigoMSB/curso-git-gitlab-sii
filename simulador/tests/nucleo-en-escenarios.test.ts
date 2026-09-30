/**
 * El nucleo de los laboratorios 01 y 02 en el modo de escenarios (SPEC 032, 2).
 *
 * `SIMULADOR.html` abierto con doble clic es el respaldo si el taller no
 * arranca en un equipo. Aqui se recorre el nucleo de cada enunciado, orden por
 * orden, en el motor de escenarios y en Git de verdad, y despues de cada orden
 * se compara lo que el participante ve: la historia desde HEAD, la rama, las
 * areas como las dice `git status --short`, y si la orden fallo.
 *
 * Lo que el enunciado pide hacer fuera de la consola se hace igual en los dos
 * lados: crear y editar archivos, y el mensaje de `git commit` sin `-m`, que
 * del lado de Git lo escribe un editor de prueba. Las ordenes propias de la
 * consola del taller (`preparar`, `verificar`) y `code .` no son del simulador;
 * del lado de Git el laboratorio se prepara antes y se verifica al final.
 *
 * El recorrido de Cypress hace lo mismo sobre la pagina, pero no corre en el
 * CI; este si.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { configuracionDelTaller } from '../cypress/soporte/enunciado';
import { aliasDelTaller, ordenesDe, resolverMarcadores } from '../cypress/soporte/ordenes';
import { idActual, ramaActual } from '../src/core/estado';
import { formatearEstadoCorto } from '../src/core/formato';
import { ejecutar } from '../src/core/motor';
import type { EstadoRepositorio } from '../src/core/tipos';
import { escenarioPorId } from '../src/escenarios';
import { carpetaTemporal, entorno } from './laboratorios-en-disco';

const LABS = fileURLToPath(new URL('../../labs', import.meta.url));
const enunciado = (n: string): string => readFileSync(join(LABS, `lab-${n}`, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
const montados: string[] = [];
afterAll(() => {
  for (const raiz of montados) rmSync(raiz, { recursive: true, force: true });
});

/**
 * Lo que el enunciado pide hacer a mano en el nucleo, anclado a su frase. Se
 * hace en los dos lados justo antes de la primera orden que sigue a la frase.
 */
const A_MANO: Readonly<Record<string, readonly { ancla: string; texto: string }[]>> = {
  '01': [{ ancla: 'Agrega esta línea al final de `platos.md` y guarda', texto: 'echo "- sopaipillas" >> platos.md' }],
};

/**
 * `git commit` sin `-m` (SPEC 031, 1.6). En la consola del taller abre Visual
 * Studio Code; el simulador de escenarios no tiene editor, y responde como Git
 * sin editor: `Aborting commit due to empty commit message`. Del lado de Git
 * el editor de prueba escribe el mensaje del enunciado, y el simulador lo
 * confirma con `-m`, que es lo que el participante tiene que hacer en el modo
 * de escenarios. Es la unica orden del nucleo que el simulador no ejecuta.
 */
const SIN_EDITOR: Readonly<Record<string, string>> = {
  '01': 'platos.md: se agregan los platos chilenos',
};

interface LadoGit {
  carpeta: string;
  readonly raiz: string;
  readonly configGlobal: string;
}

function montar(numero: string): LadoGit {
  const raiz = carpetaTemporal();
  montados.push(raiz);
  // Como lo deja INSTALAR: taller-git con el clon en taller-git/curso.
  const clon = join(raiz, 'curso');
  const carpeta = join(clon, 'labs', `lab-${numero}`);
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    const origen = join(LABS, `lab-${numero}`, archivo);
    if (!existsSync(origen)) continue;
    cpSync(origen, join(carpeta, archivo));
    chmodSync(join(carpeta, archivo), 0o755);
  }
  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '');
  const env = entorno(configGlobal);
  if (numero !== '01') {
    for (const [clave, valor] of configuracionDelTaller(enunciado('01'))) {
      execFileSync('git', ['config', '--global', clave, valor], { env, stdio: 'ignore' });
    }
  }
  execFileSync('git', ['-C', clon, 'init', '-q'], { env, stdio: 'ignore' });
  writeFileSync(join(clon, 'README.md'), 'el repositorio del curso\n');
  execFileSync('git', ['-C', clon, 'add', '-A'], { env, stdio: 'ignore' });
  execFileSync('git', ['-C', clon, '-c', 'user.name=Curso', '-c', 'user.email=curso@sii.cl', 'commit', '-q', '-m', 'el curso'], { env, stdio: 'ignore' });
  if (existsSync(join(carpeta, 'preparar.sh'))) {
    execFileSync('bash', ['./preparar.sh', '--forzar'], { cwd: carpeta, env, stdio: 'ignore' });
    // `preparar NN` en la consola del taller deja al participante en su recetario.
    return { carpeta: join(raiz, `lab-${numero}`, 'recetario'), raiz, configGlobal };
  }
  // La consola del taller parte en taller-git.
  return { carpeta: raiz, raiz, configGlobal };
}

/** Corre una orden en la carpeta actual, como una terminal, y la carpeta sigue. */
function enGit(lado: LadoGit, texto: string, extra: NodeJS.ProcessEnv = {}): { salida: string; fallo: boolean } {
  const donde = join(lado.raiz, 'carpeta-actual');
  const guion = [`cd "${lado.carpeta}" || exit 99`, texto, 'estado=$?', `pwd > "${donde}"`, 'exit $estado'].join('\n');
  const corrida = spawnSync('bash', ['-c', guion], {
    encoding: 'utf8',
    env: { ...entorno(lado.configGlobal), GIT_EDITOR: 'true', ...extra },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  if (existsSync(donde)) lado.carpeta = readFileSync(donde, 'utf8').trim();
  const salida = `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  return { salida, fallo: salida.split('\n').some((l) => /^(fatal|error):/.test(l)) };
}

function gitLeer(lado: LadoGit, ...args: string[]): string | null {
  const r = spawnSync('git', args, { cwd: lado.carpeta, env: entorno(lado.configGlobal), encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

interface Vista {
  readonly repositorio: boolean;
  readonly historia: readonly string[];
  readonly rama: string;
  readonly areas: readonly string[];
}

function vistaDeGit(lado: LadoGit): Vista {
  if (gitLeer(lado, 'rev-parse', '--git-dir') === null) return { repositorio: false, historia: [], rama: '', areas: [] };
  const historia = (gitLeer(lado, 'log', '--format=%s') ?? '').split('\n').filter((l) => l !== '');
  const rama = (gitLeer(lado, 'symbolic-ref', '--short', 'HEAD') ?? '').trim();
  const areas = (gitLeer(lado, 'status', '--porcelain', '--untracked-files=normal') ?? '')
    .split('\n')
    .filter((l) => l !== '')
    .sort();
  return { repositorio: true, historia, rama, areas };
}

function vistaDelSimulador(estado: EstadoRepositorio): Vista {
  if (!estado.iniciado) return { repositorio: false, historia: [], rama: '', areas: [] };
  const porId = new Map(estado.confirmaciones.map((c) => [c.id, c]));
  const historia: string[] = [];
  let actual = idActual(estado);
  while (actual !== null) {
    const confirmacion = porId.get(actual);
    if (confirmacion === undefined) break;
    historia.push(confirmacion.mensaje);
    actual = confirmacion.padres[0] ?? null;
  }
  return { repositorio: true, historia, rama: ramaActual(estado) ?? '', areas: [...formatearEstadoCorto(estado)].sort() };
}

function recorrer(numero: string): { distintas: string[]; recorridas: number; git: LadoGit } {
  const texto = enunciado(numero);
  const lineas = texto.split('\n');
  const fin = lineas.findIndex((l) => /^##\s+Para ir m[aá]s all[aá]/.test(l));
  const alias = aliasDelTaller(enunciado('01'));
  const ordenes = resolverMarcadores(ordenesDe(texto, alias), numero, alias).filter((o) => fin < 0 || o.linea <= fin);
  const aMano = (A_MANO[numero] ?? []).map((paso) => {
    const linea = lineas.findIndex((l) => l.includes(paso.ancla));
    if (linea < 0) throw new Error(`el enunciado del ${numero} ya no dice «${paso.ancla}»`);
    return { ...paso, linea: linea + 1, hecho: false };
  });

  const git = montar(numero);
  let simulador = escenarioPorId(`lab-${numero}`);
  const distintas: string[] = [];
  let recorridas = 0;

  for (const orden of ordenes) {
    for (const paso of aMano) {
      if (!paso.hecho && paso.linea < orden.linea) {
        paso.hecho = true;
        enGit(git, paso.texto);
        simulador = ejecutar(simulador, paso.texto).estado;
      }
    }
    const donde = `lab ${numero}, linea ${orden.linea} «${orden.texto}»`;
    // Las ordenes de la consola del taller y la que abre Visual Studio Code no son del simulador.
    if (orden.clase === 'omitida') continue;
    recorridas += 1;

    if (orden.texto === 'clear') {
      // Fuera de una terminal `clear` falla; en el simulador limpia la consola y nada mas.
      const r = ejecutar(simulador, orden.texto);
      if (r.error) distintas.push(`${donde}: el simulador fallo`);
      continue;
    }

    const conEditor = orden.texto === 'git commit' ? SIN_EDITOR[numero] : undefined;
    const real =
      conEditor === undefined
        ? enGit(git, orden.texto)
        : enGit(git, orden.texto, { GIT_EDITOR: `printf '%s\\n' '${conEditor}' >` });
    const r = ejecutar(simulador, orden.texto);
    simulador = r.estado;

    if (orden.clase === 'declarada') {
      if (!r.salida.some((l) => l.tipo === 'limite')) distintas.push(`${donde}: declarada, y el simulador no dice que no la implementa`);
      continue;
    }
    if (conEditor !== undefined) {
      if (!r.error) distintas.push(`${donde}: sin editor, el simulador tenia que fallar como Git sin editor`);
      simulador = ejecutar(simulador, `git commit -m "${conEditor}"`).estado;
    } else if (r.error !== real.fallo) {
      distintas.push(`${donde}: en Git ${real.fallo ? 'fallo' : 'funciono'} y en el simulador ${r.error ? 'fallo' : 'funciono'} · ${r.salida.map((l) => l.texto).join(' / ').slice(0, 200)}`);
    }

    const g = vistaDeGit(git);
    const s = vistaDelSimulador(simulador);
    for (const clave of Object.keys(g) as (keyof Vista)[]) {
      if (JSON.stringify(g[clave]) !== JSON.stringify(s[clave])) {
        distintas.push(`${donde}: ${clave}, Git ${JSON.stringify(g[clave])}, simulador ${JSON.stringify(s[clave])}`);
      }
    }
  }
  return { distintas, recorridas, git };
}

describe('el nucleo en el modo de escenarios, contra Git (SPEC 032, 2.4)', () => {
  it.each(['01', '02'])('laboratorio %s: cada orden del nucleo deja el simulador igual que Git', { timeout: 180_000 }, (numero) => {
    const { distintas, recorridas, git } = recorrer(numero);
    expect(distintas).toEqual([]);
    expect(recorridas).toBeGreaterThan(20);
    // Y del lado de Git el nucleo quedo hecho: el verificador aprueba.
    const verificado = spawnSync('bash', ['./verificar.sh'], {
      cwd: join(git.raiz, 'curso', 'labs', `lab-${numero}`),
      env: entorno(git.configGlobal),
      encoding: 'utf8',
    });
    expect(verificado.status, verificado.stdout).toBe(0);
  });
});
