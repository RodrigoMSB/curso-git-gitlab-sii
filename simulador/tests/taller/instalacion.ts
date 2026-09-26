/**
 * Un clon del curso en una carpeta temporal, con el taller arrancado como lo
 * arranca el alumno: doble clic en `TALLER.cmd` en Windows, `taller.command`
 * en Mac (SPEC 026).
 *
 * Lo unico que no es el camino del alumno es el navegador: Python abre el que
 * diga la variable `BROWSER`, y aqui es un script que anota la direccion en un
 * archivo. La carpeta del usuario tambien es de mentira, para que la
 * configuracion global de Git de la maquina no entre ni salga.
 */

import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { type IncomingHttpHeaders, request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CLON_REAL = join(__dirname, '..', '..', '..');
export const WINDOWS = process.platform === 'win32';

/**
 * `git` con la arquitectura de este proceso. En Mac, el git de /usr/bin es
 * universal y, en esta maquina, a veces arrancaba como x86_64 bajo Rosetta y
 * fallaba («unable to load libxcrun»). Lo mismo hace el programa del taller.
 */
export function comandoGit(...args: string[]): [string, string[]] {
  if (process.platform === 'darwin' && existsSync('/usr/bin/arch')) {
    return ['/usr/bin/arch', [`-${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`, 'git', ...args]];
  }
  return ['git', args];
}

export interface Taller {
  readonly raiz: string;
  readonly clon: string;
  readonly trabajo: string;
  readonly casa: string;
  readonly direccion: string;
  readonly clave: string;
  readonly puerto: number;
  readonly ventana: () => string;
  readonly env: NodeJS.ProcessEnv;
  cerrar(): void;
}

/** Lo que el alumno clona y el taller usa. */
const DEL_CLON = ['taller', 'labs', 'semillas', 'SIMULADOR.html', 'TALLER.cmd', 'taller.command'];

export function armarClon(raiz: string): string {
  const clon = join(raiz, 'curso-git-gitlab-sii');
  mkdirSync(clon, { recursive: true });
  for (const nombre of DEL_CLON) {
    const origen = join(CLON_REAL, nombre);
    if (existsSync(origen)) cpSync(origen, join(clon, nombre), { recursive: true });
  }
  // Para ver fallar las pruebas con otro programa (SPEC 026, 5.7): `TALLER_ANTES=ruta/a/taller.py`.
  const antes = process.env.TALLER_ANTES;
  if (antes !== undefined && antes !== '') cpSync(antes, join(clon, 'taller', 'taller.py'));
  if (!WINDOWS) {
    chmodSync(join(clon, 'taller.command'), 0o755);
    chmodSync(join(clon, 'taller', 'editor.sh'), 0o755);
  }
  return clon;
}

/** Git con la carpeta de usuario de mentira. */
export function entornoDe(casa: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: casa, USERPROFILE: casa, GIT_CONFIG_NOSYSTEM: '1', ...extra };
  for (const clave of ['EDITOR', 'VISUAL', 'GIT_EDITOR', 'GIT_SEQUENCE_EDITOR', 'TALLER_SIN_NAVEGADOR']) delete env[clave];
  return { ...env, ...extra };
}

function navegadorDeMentira(raiz: string): { comando: string; anotada: string } {
  const anotada = join(raiz, 'navegador-abrio.txt');
  if (WINDOWS) {
    const script = join(raiz, 'navegador.cmd');
    writeFileSync(script, `@echo off\r\necho %~1>>"${anotada}"\r\n`);
    return { comando: script.replace(/\\/g, '/'), anotada };
  }
  const script = join(raiz, 'navegador.sh');
  writeFileSync(script, `#!/bin/sh\necho "$1" >> '${anotada}'\n`);
  chmodSync(script, 0o755);
  return { comando: script, anotada };
}

/** Arranca el lanzador del clon, como el doble clic. */
export function lanzar(clon: string, env: NodeJS.ProcessEnv): ChildProcess {
  return WINDOWS
    ? spawn('cmd.exe', ['/d', '/c', join(clon, 'TALLER.cmd')], { cwd: clon, env, windowsHide: true })
    : spawn(join(clon, 'taller.command'), [], { cwd: clon, env, detached: true });
}

export function detener(proceso: ChildProcess): void {
  if (proceso.pid === undefined || proceso.exitCode !== null) return;
  try {
    if (WINDOWS) execFileSync('taskkill', ['/T', '/F', '/PID', String(proceso.pid)], { stdio: 'ignore' });
    else process.kill(-proceso.pid, 'SIGKILL');
  } catch {
    // Ya termino.
  }
}

async function esperar(condicion: () => boolean, ms: number): Promise<boolean> {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    if (condicion()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return condicion();
}

export async function abrirTaller(opciones: { extra?: NodeJS.ProcessEnv; raiz?: string } = {}): Promise<Taller> {
  const raiz = opciones.raiz ?? mkdtempSync(join(tmpdir(), 'taller-'));
  const clon = existsSync(join(raiz, 'curso-git-gitlab-sii')) ? join(raiz, 'curso-git-gitlab-sii') : armarClon(raiz);
  const casa = join(raiz, 'casa');
  mkdirSync(casa, { recursive: true });
  const navegador = navegadorDeMentira(raiz);
  rmSync(navegador.anotada, { force: true });
  const env = entornoDe(casa, { BROWSER: navegador.comando, ...opciones.extra });
  const proceso = lanzar(clon, env);
  let ventana = '';
  proceso.stdout?.on('data', (d: Buffer) => {
    ventana += d.toString('utf8');
  });
  proceso.stderr?.on('data', (d: Buffer) => {
    ventana += d.toString('utf8');
  });
  const inicio = Date.now();
  const abrio = await esperar(() => existsSync(navegador.anotada) && readFileSync(navegador.anotada, 'utf8').includes('clave='), 120_000);
  if (!abrio) {
    detener(proceso);
    throw new Error(`el taller no abrio el navegador en ${Date.now() - inicio} ms. Ventana:\n${ventana}`);
  }
  const direccion = readFileSync(navegador.anotada, 'utf8').trim().split(/\r?\n/).at(-1) ?? '';
  const url = new URL(direccion);
  return {
    raiz,
    clon,
    trabajo: join(raiz, 'taller-git-trabajo'),
    casa,
    direccion,
    clave: url.searchParams.get('clave') ?? '',
    puerto: Number(url.port),
    ventana: () => ventana,
    env,
    cerrar: () => detener(proceso),
  };
}

/**
 * Una peticion al programa, con la clave y el origen propios salvo que se diga
 * otra cosa. Va con `node:http` y no con `fetch`, que no deja cambiar `Host`.
 */
export function pedir(
  taller: Taller,
  ruta: string,
  opciones: { metodo?: string; cuerpo?: unknown; clave?: string | null; origen?: string | null; host?: string } = {},
): Promise<{ estado: number; cuerpo: string; cabeceras: IncomingHttpHeaders }> {
  const cabeceras: Record<string, string> = { Host: opciones.host ?? `127.0.0.1:${taller.puerto}` };
  const clave = opciones.clave === undefined ? taller.clave : opciones.clave;
  if (clave !== null) cabeceras['X-Taller-Clave'] = clave;
  const origen = opciones.origen === undefined ? `http://127.0.0.1:${taller.puerto}` : opciones.origen;
  if (origen !== null) cabeceras.Origin = origen;
  const cuerpo = opciones.cuerpo === undefined ? undefined : Buffer.from(JSON.stringify(opciones.cuerpo), 'utf8');
  if (cuerpo !== undefined) {
    cabeceras['Content-Type'] = 'application/json';
    cabeceras['Content-Length'] = String(cuerpo.length);
  }
  return new Promise((resolver, rechazar) => {
    const peticion = request(
      { host: '127.0.0.1', port: taller.puerto, path: ruta, method: opciones.metodo ?? (cuerpo === undefined ? 'GET' : 'POST'), headers: cabeceras },
      (respuesta) => {
        const trozos: Buffer[] = [];
        respuesta.on('data', (t: Buffer) => trozos.push(t));
        respuesta.on('end', () =>
          resolver({ estado: respuesta.statusCode ?? 0, cuerpo: Buffer.concat(trozos).toString('utf8'), cabeceras: respuesta.headers }),
        );
      },
    );
    peticion.on('error', rechazar);
    if (cuerpo !== undefined) peticion.write(cuerpo);
    peticion.end();
  });
}

export interface Resultado {
  readonly salida: string;
  readonly error: string;
  readonly codigo: number;
  readonly carpeta: string;
  readonly detenida?: boolean;
}

export async function orden(taller: Taller, texto: string): Promise<Resultado> {
  const { estado, cuerpo } = await pedir(taller, '/api/orden', { cuerpo: { orden: texto } });
  if (estado !== 200) throw new Error(`la orden «${texto}» respondio ${estado}: ${cuerpo}`);
  return JSON.parse(cuerpo) as Resultado;
}
