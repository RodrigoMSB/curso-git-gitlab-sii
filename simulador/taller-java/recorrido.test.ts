/**
 * El recorrido del modo taller, de punta a punta (seccion 7 del SPEC 026).
 *
 * Arranca el programa como lo arranca el participante, con taller-java.sh,
 * abre la pagina en un navegador de verdad y escribe en su consola todas las
 * ordenes de los enunciados de los laboratorios 01 al 08, sacadas del README de
 * cada uno con el extractor que ya usa Cypress.
 *
 * Cada orden se compara en dos frentes.
 *
 * 1. **La pantalla contra Git.** Despues de cada orden se le pregunta a Git,
 *    con ordenes propias y sin nada del programa, como quedo la carpeta, y se
 *    compara con lo que la pagina pinta: confirmaciones, huerfanas, ramas,
 *    etiquetas, rama actual, las areas y la carpeta del indicador.
 * 2. **La consola contra Git.** Un gemelo corre la misma orden con bash
 *    directo, en una copia paralela, y lo que la consola mostro tiene que ser
 *    lo que Git imprimio ahi. Las fechas van fijas en los dos lados, asi que
 *    los identificadores coinciden.
 *
 * Los pasos donde el enunciado manda crear o editar un archivo se hacen
 * escribiendo el archivo por fuera, como lo haria Visual Studio Code, y se
 * mide cuanto tarda la pagina en mostrarlo.
 *
 *   TALLER_NAVEGADOR   chrome o msedge (por omision chrome)
 *   TALLER_LABS        01,02,... (por omision los ocho)
 *   TALLER_MOTOR       java o python. Con python el jar se sabotea y la cascada llega a Python.
 *   TALLER_CAPTURAS    carpeta de salida (por omision simulador/capturas-taller-java/<motor>)
 */

import { type ChildProcess, spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aliasDelTaller,
  ordenesDe,
  ordenPara,
  resolverMarcadores,
  type OrdenDelEnunciado,
} from '../cypress/soporte/ordenes';
import { correrEnBash, estadoSegunGit, herramientas, WINDOWS, type EstadoSegunGit } from './git';
import { escribir, leerPantalla, quieta, salidaDeLaUltimaOrden, type EstadoEnPantalla } from './pagina';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(AQUI, '..', '..');
const CANAL = process.env.TALLER_NAVEGADOR ?? 'chrome';
const NUMEROS = (process.env.TALLER_LABS ?? '01,02,03,04,05,06,07,08').split(',');
/** El motor que se prueba. Con python, el jar del motor de Java se sabotea y la cascada tiene que llegar al de Python. */
const MOTOR = process.env.TALLER_MOTOR === 'python' ? 'python' : 'java';
const SALIDA = process.env.TALLER_CAPTURAS ?? join(REPO, 'simulador', 'capturas-taller-java', MOTOR);
const CON_CAPTURAS = new Set(['01', '02']);
const CLON = 'curso';
/**
 * La instalacion desde cero del SPEC 032, 3.4: el curso se clona de esta
 * direccion, sin `-b`, que es la rama principal, y no del arbol local. Con
 * `TALLER_ARRANQUE=doble-clic` se instala con INSTALAR.cmd y se arranca con
 * TALLER.cmd, como el participante en Windows.
 */
const CLONAR_DESDE = process.env.TALLER_CLONAR_DESDE ?? '';
const DOBLE_CLIC = process.env.TALLER_ARRANQUE === 'doble-clic' && WINDOWS;

// --- Los pasos del guion ------------------------------------------------------

type Paso =
  | { readonly tipo: 'orden'; readonly orden: OrdenDelEnunciado; readonly arnes?: string; readonly plan?: readonly string[] }
  | { readonly tipo: 'archivo'; readonly ruta: string; readonly contenido: string; readonly linea: number }
  | { readonly tipo: 'resolver'; readonly ruta: string; readonly linea: number }
  | { readonly tipo: 'anexar'; readonly lineas: Readonly<Record<string, string>>; readonly linea: number }
  | { readonly tipo: 'omitida'; readonly texto: string; readonly motivo: string };

/**
 * Lo que el enunciado le pide hacer en el editor al participante, para las
 * ordenes que lo abren. Va por laboratorio, orden y vez que aparece.
 */
const MENSAJE_REWORD = 'se prueba la receta del curry antes de servirla';
const PLANES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  // git commit sin -m, con el mensaje escrito en la pestaña (SPEC 031, 3.8).
  '01 git commit': [['mensaje platos.md: se agregan los platos chilenos']],
  '07 git rebase -i main': [
    ['reword-primera', `mensaje ${MENSAJE_REWORD}`],
    ['squash-del-medio', `mensaje ${MENSAJE_REWORD}`],
  ],
};

/** Las ediciones en prosa, con la frase del enunciado que las pide. Son las mismas del arnes en disco. */
const ANEXOS: Readonly<Record<string, readonly { readonly ancla: string; readonly lineas: Readonly<Record<string, string>> }[]>> = {
  '01': [
    { ancla: 'Agrega esta línea al final de `platos.md` y guarda', lineas: { 'platos.md': '- sopaipillas' } },
    {
      ancla: 'Y agrega una línea al final de `cocineros.md`',
      lineas: { 'platos.md': '- porotos granados', 'ingredientes.md': '- zapallo', 'cocineros.md': '- Pedro' },
    },
  ],
};

const orden = (texto: string, linea = 0): OrdenDelEnunciado => ({ texto, clase: 'comparada', motivo: '', linea, terminal: false });

function pasosDe(numero: string, enunciado: string, alias: Readonly<Record<string, string>>): Paso[] {
  const lineas = enunciado.split('\n');
  // Ediciones que el enunciado pide en prosa, sin bloque de codigo: se hacen
  // por fuera, como en el editor, antes de la primera orden que sigue.
  const anexos = [...(ANEXOS[numero] ?? [])].map((a) => ({ ...a, linea: lineas.findIndex((l) => l.includes(a.ancla)) + 1 }));
  for (const a of anexos) if (a.linea === 0) throw new Error(`el enunciado ${numero} ya no dice «${a.ancla}»`);
  const creaciones = new Set<number>();
  const resoluciones = new Map<number, string>();
  lineas.forEach((l, i) => {
    if (/Crea(?: el archivo)? `[\w./-]+`/.test(l)) creaciones.add(i + 1);
    const abre = l.match(/Abre `([^`]+)` en tu editor/);
    if (abre?.[1] !== undefined) resoluciones.set(i + 1, abre[1]);
  });

  const pasos: Paso[] = [];
  const archivos = new Map<string, { ruta: string; filas: string[]; linea: number }>();
  const vistas = new Map<string, number>();
  const pendientes = [...resoluciones.entries()].sort((a, b) => a[0] - b[0]);

  const guion = resolverMarcadores(ordenesDe(enunciado, alias), numero, alias);
  for (const o of guion) {
    while (anexos.length > 0 && (anexos[0]?.linea ?? 0) < o.linea) {
      const a = anexos.shift();
      if (a !== undefined) pasos.push({ tipo: 'anexar', lineas: a.lineas, linea: a.linea });
    }
    while (pendientes.length > 0 && (pendientes[0]?.[0] ?? 0) < o.linea) {
      const [linea, ruta] = pendientes.shift() ?? [0, ''];
      pasos.push({ tipo: 'resolver', ruta, linea });
    }
    if (creaciones.has(o.linea)) {
      if (o.texto.startsWith('mkdir -p ')) continue;
      const m = o.texto.match(/^echo "(.*)" (>>?) (\S+)$/);
      if (m === null) throw new Error(`creacion que no se entiende: ${o.texto}`);
      const clave = `${o.linea}:${m[3]}`;
      let archivo = archivos.get(clave);
      if (archivo === undefined) {
        archivo = { ruta: m[3] ?? '', filas: [], linea: o.linea };
        archivos.set(clave, archivo);
        pasos.push({ tipo: 'archivo', ruta: archivo.ruta, contenido: '', linea: o.linea });
      }
      archivo.filas.push(m[1] ?? '');
      continue;
    }
    // Las ordenes propias de la consola del taller y code son del guion: el
    // participante las escribe en la consola como cualquier otra.
    if (/^(preparar|verificar|code)(\s|$)/.test(o.texto)) {
      pasos.push({ tipo: 'orden', orden: { ...o, clase: 'comparada' } });
      continue;
    }
    // Un marcador con espacios, como <identificador anterior al rebase>, se le
    // escapa al extractor, que solo reconoce los de una palabra.
    if (o.eleccion === undefined && /<[a-záéíóúñ][^<>()]*[a-z]>/.test(o.texto)) {
      pasos.push({ tipo: 'omitida', texto: o.texto, motivo: 'lleva un marcador de posicion que el participante reemplaza a mano' });
      continue;
    }
    if (o.clase === 'omitida' && o.eleccion === undefined) {
      pasos.push({ tipo: 'omitida', texto: o.texto, motivo: o.motivo });
      continue;
    }
    const clave = `${numero} ${o.texto}`;
    const vez = vistas.get(clave) ?? 0;
    vistas.set(clave, vez + 1);
    pasos.push({ tipo: 'orden', orden: o, plan: PLANES[clave]?.[vez] });
  }
  for (const [linea, ruta] of pendientes) pasos.push({ tipo: 'resolver', ruta, linea });

  // El contenido de cada archivo creado, ya juntado.
  return pasos.map((p) => {
    if (p.tipo !== 'archivo') return p;
    const archivo = archivos.get(`${p.linea}:${p.ruta}`);
    return { ...p, contenido: `${(archivo?.filas ?? []).join('\n')}\n` };
  });
}

// --- La copia del participante y su gemelo --------------------------------------

interface Lado {
  readonly limite: string;
  readonly casa: string;
  readonly plan: string;
  readonly entorno: NodeJS.ProcessEnv;
  /** La carpeta de la consola, relativa al limite, con barras normales. */
  carpeta: string;
  /** La ultima salida de cada orden, para elegir identificadores. */
  readonly salidas: Map<string, string>;
}

const FECHA = '@1772370000 -0300';

function prepararLado(raiz: string, nombre: string, bin: string): Lado {
  // La carpeta unica del SPEC 028: taller-git, con el clon adentro en curso/.
  const limite = join(raiz, 'Ana Núñez', nombre, 'taller-git');
  const casa = join(raiz, `José Pérez ${nombre}`);
  mkdirSync(limite, { recursive: true });
  mkdirSync(casa, { recursive: true });
  const plan = join(casa, 'plan-del-editor.txt');
  const entorno: NodeJS.ProcessEnv = { ...process.env };
  for (const v of ['GIT_EDITOR', 'GIT_ASKPASS', 'EDITOR', 'VISUAL', 'GIT_DIR', 'GIT_WORK_TREE', 'SSH_ASKPASS', 'JAVA_HOME']) delete entorno[v];
  Object.assign(entorno, {
    HOME: casa,
    USERPROFILE: casa,
    XDG_CONFIG_HOME: join(casa, '.config'),
    PATH: `${bin}${WINDOWS ? ';' : ':'}${process.env.PATH ?? process.env.Path ?? ''}`,
    GIT_AUTHOR_DATE: FECHA,
    GIT_COMMITTER_DATE: FECHA,
    TALLER_SIN_NAVEGADOR: '1',
    TALLER_EDITOR_PLAN: plan,
    GIT_TERMINAL_PROMPT: '0',
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    TERM: 'dumb',
  });
  if (WINDOWS) delete entorno.Path;
  // Git para Windows instalado para usarse solo desde Git Bash: el PATH de
  // Windows no tiene git, y el programa tiene que encontrarlo igual (3.3).
  if (process.env.TALLER_SIN_GIT_EN_PATH === '1') {
    entorno.PATH = (entorno.PATH ?? '')
      .split(';')
      .filter((c) => !/\\Git\\(cmd|bin|mingw64|usr)/i.test(c))
      .join(';');
  }
  return { limite, casa, plan, entorno, carpeta: '', salidas: new Map() };
}

/**
 * Copia un archivo o una carpeta entera, conservando los permisos.
 *
 * No usa `cpSync`: en Windows, con una tilde en la ruta de destino, fallaba
 * con «The operation completed successfully».
 */
function copiar(origen: string, destino: string): void {
  if (statSync(origen).isDirectory()) {
    mkdirSync(destino, { recursive: true });
    for (const nombre of readdirSync(origen)) copiar(join(origen, nombre), join(destino, nombre));
    return;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, readFileSync(origen));
  chmodSync(destino, statSync(origen).mode);
}

/** Instala el taller como el participante: clona en taller-git/curso y corre instalar.command. */
function instalar(limite: string): void {
  const destino = join(limite, CLON);
  if (CLONAR_DESDE !== '') {
    execFileSync(herramientas().git, ['clone', '-q', CLONAR_DESDE, destino], { stdio: 'ignore' });
    const esperado = process.env.TALLER_CONFIRMACION_ESPERADA ?? '';
    const cabeza = execFileSync(herramientas().git, ['-C', destino, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const rama = execFileSync(herramientas().git, ['-C', destino, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
    const ramaEsperada = process.env.TALLER_RAMA_ESPERADA ?? 'main';
    if (rama !== ramaEsperada || (esperado !== '' && cabeza !== esperado)) {
      throw new Error(`el clon sin -b quedo en ${rama} ${cabeza}, y se esperaba ${ramaEsperada} ${esperado}`);
    }
    if (DOBLE_CLIC) {
      const instalado = execFileSync('cmd.exe', ['/d', '/c', 'INSTALAR.cmd'], { cwd: destino, encoding: 'utf8', input: '\r\n' });
      if (!existsSync(join(limite, 'TALLER.cmd'))) throw new Error(`INSTALAR.cmd no dejo TALLER.cmd:\n${instalado}`);
      return;
    }
  } else {
    execFileSync(herramientas().git, ['clone', '-q', REPO, destino], { stdio: 'ignore' });
  }
  // Lo que todavia no esta confirmado en la rama viaja igual: el recorrido
  // prueba el arbol de trabajo, no el ultimo commit. En la integracion
  // continua el arbol es el commit y no hace falta.
  if (process.env.CI !== 'true' && CLONAR_DESDE === '') {
    for (const ruta of ['SIMULADOR.html', 'taller', 'labs', 'INSTALAR.cmd', 'instalar.command']) {
      copiar(join(REPO, ruta), join(destino, ruta));
    }
  }
  if (!existsSync(join(destino, 'taller', 'java', 'jre')) && existsSync(join(REPO, 'taller', 'java', 'jre'))) {
    copiar(join(REPO, 'taller', 'java', 'jre'), join(destino, 'taller', 'java', 'jre'));
  }
  const instalado = execFileSync(herramientas().bash, [join(destino, 'instalar.command').replaceAll('\\', '/')], {
    encoding: 'utf8',
  });
  if (!existsSync(join(limite, 'taller.sh'))) throw new Error(`instalar.command no dejo los envoltorios:\n${instalado}`);
}

/** El `code` falso que el laboratorio 01 deja como editor. */
function editorFalso(bin: string): void {
  mkdirSync(bin, { recursive: true });
  const script = join(AQUI, 'editor-falso.mjs').replaceAll('\\', '/');
  const code = join(bin, 'code');
  writeFileSync(code, `#!/usr/bin/env bash\nexec node "${script}" "$@"\n`);
  chmodSync(code, 0o755);
}

// --- Comparar ----------------------------------------------------------------------

/** Las formas en que una ruta aparece escrita: nativa, con barras, como la escribe Git Bash, y resuelta. */
const deGitBash = new Map<string, string>();

function formas(ruta: string): string[] {
  const conBarras = ruta.replaceAll('\\', '/');
  const msys = conBarras.replace(/^([A-Za-z]):/, (_, u: string) => `/${u.toLowerCase()}`);
  const todas = [ruta, conBarras, msys, conBarras.replace(/^\/private/, '')];
  if (WINDOWS) {
    // Como la escribe Git Bash, que monta la temporal del usuario en /tmp: con
    // el usuario con tilde la carpeta del taller sale como /tmp/... .
    if (!deGitBash.has(ruta)) {
      deGitBash.set(ruta, execFileSync(herramientas().bash, ['-c', 'cygpath -u "$1"', '_', ruta], { encoding: 'utf8' }).trim());
    }
    todas.push(deGitBash.get(ruta) ?? msys);
  }
  return [...new Set(todas)].sort((a, b) => b.length - a.length);
}

function normalizar(texto: string, lado: Lado): string {
  let t = texto.replaceAll('\r\n', '\n');
  for (const f of formas(lado.limite)) t = t.replaceAll(f, '<LIMITE>');
  for (const f of formas(lado.casa)) t = t.replaceAll(f, '<CASA>');
  return t
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}

function diferencias(pantalla: EstadoEnPantalla, git: EstadoSegunGit, carpeta: string): string[] {
  const d: string[] = [];
  if (pantalla.plurales.length > 0) d.push(`contadores mal escritos: ${pantalla.plurales.join(' · ')}`);
  const mismo = (nombre: string, a: unknown, b: unknown): void => {
    if (JSON.stringify(a) !== JSON.stringify(b)) d.push(`${nombre}: pagina ${JSON.stringify(a)}, Git ${JSON.stringify(b)}`);
  };
  mismo('repositorio', pantalla.repositorio, git.repositorio);
  if (!pantalla.carpeta.endsWith(carpeta)) d.push(`carpeta: el indicador dice «${pantalla.carpeta}» y la consola esta en «${carpeta}»`);
  if (!git.repositorio) {
    if (pantalla.barraConRama || pantalla.barraConCambios) d.push('la barra muestra rama o contador sin repositorio');
    return d;
  }
  if (!pantalla.barraConRama && (git.rama !== null || git.head !== null)) d.push('la barra no muestra la rama');
  mismo('rama', pantalla.rama, git.rama);
  if (git.rama === null) mismo('HEAD', pantalla.head, git.head);
  if (pantalla.ocultas === 0) {
    mismo('confirmaciones', pantalla.confirmaciones, git.confirmaciones);
    mismo('huerfanas', pantalla.huerfanas, git.huerfanas);
  }
  const vivas = git.confirmaciones.length - git.huerfanas.length;
  mismo('confirmaciones en el repositorio local', pantalla.confirmacionesEnArea, vivas === 0 ? null : vivas);
  mismo('archivos del repositorio', pantalla.arbol, git.arbol.slice(0, 30));
  mismo('archivos del repositorio que no se listan', pantalla.arbolResto, Math.max(0, git.arbol.length - 30));
  mismo('ramas', pantalla.ramas, git.ramas);
  mismo('etiquetas', pantalla.etiquetas, git.etiquetas);
  mismo('directorio de trabajo', pantalla.trabajo, git.trabajo);
  mismo('area de preparacion', pantalla.preparacion, git.preparacion);
  return d;
}

// --- Capturas ------------------------------------------------------------------------

async function componer(
  compositor: Page,
  captura: Buffer,
  titulo: string,
  derecha: string,
  igual: boolean,
  archivo: string,
): Promise<void> {
  const escapar = (t: string): string => t.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  await compositor.setContent(`<!doctype html><meta charset="utf-8">
<style>
body{margin:0;background:#0d1117;color:#e6edf3;font:14px ui-monospace,Menlo,Consolas,monospace}
header{padding:10px 16px;font:600 16px system-ui,sans-serif;border-bottom:1px solid #30363d;display:flex;gap:16px}
header b{color:${igual ? '#3fb950' : '#f85149'}}
main{display:flex}
img{width:1280px;height:800px;border-right:1px solid #30363d}
pre{margin:0;padding:12px 16px;white-space:pre-wrap;width:620px;height:776px;overflow:hidden}
</style>
<header><span>${escapar(titulo)}</span><b>${igual ? 'igual a Git' : 'DISTINTA de Git'}</b></header>
<main><img src="data:image/jpeg;base64,${captura.toString('base64')}"><pre>${escapar(derecha)}</pre></main>`);
  await compositor.screenshot({ path: archivo, type: 'jpeg', quality: 85, fullPage: true });
}

// --- El recorrido ---------------------------------------------------------------------

interface Resultado {
  readonly lab: string;
  readonly paso: number;
  readonly texto: string;
  readonly tipo: string;
  readonly igual: boolean;
  readonly diferencias: readonly string[];
  readonly ms?: number;
  readonly programa?: readonly string[];
}

const resultados: Resultado[] = [];
let programa: ChildProcess | undefined;
let navegador: Browser | undefined;
let pagina: Page;
let compositor: Page;
let A: Lado;
let B: Lado;
let direccion = '';
let registroPrograma = '';

/** En Windows, bash no reemplaza su proceso por java: hay que matar el arbol entero. */
function cerrarPrograma(): void {
  if (programa?.pid === undefined) return;
  if (WINDOWS) {
    try {
      execFileSync('taskkill', ['/T', '/F', '/PID', String(programa.pid)], { stdio: 'ignore' });
    } catch {
      // Ya estaba cerrado.
    }
    // bash de Git para Windows no reemplaza su proceso al hacer exec de un
    // programa de Windows, y java puede quedar fuera del arbol. Se cierra el
    // java que corre el taller.jar de este clon, y ningun otro.
    const clon = join(A.limite, CLON).replaceAll("'", "''");
    try {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(java|python|py)' -and $_.CommandLine -like '*${clon}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
        ],
        { stdio: 'ignore' },
      );
    } catch {
      // Nada que cerrar.
    }
  } else {
    programa.kill();
  }
}

async function diagnostico(): Promise<{ procesos: number; version: number }> {
  const base = direccion.replace(/\/\?clave=.*/, '');
  const clave = direccion.replace(/.*clave=/, '');
  const r = await fetch(`${base}/api/diagnostico`, { headers: { 'X-Taller-Clave': clave } });
  return (await r.json()) as { procesos: number; version: number };
}

/**
 * La misma orden, en el gemelo. Las ordenes propias de la consola no existen en
 * bash: el gemelo hace lo que hace la consola, correr el script del laboratorio
 * desde la raiz de su clon.
 */
function gemeloDe(texto: string): ReturnType<typeof correrEnBash> {
  // Como la consola: la raiz del taller en el PATH, para preparar y verificar,
  // y un archivo donde preparar deja la carpeta a la que hay que ir.
  const cd = join(B.casa, 'cd-despues');
  rmSync(cd, { force: true });
  const r = correrEnBash(texto, absoluta(B), {
    ...B.entorno,
    PATH: `${B.limite}${WINDOWS ? ';' : ':'}${B.entorno.PATH ?? ''}`,
    TALLER_CD_DESPUES: cd,
  });
  if (existsSync(cd)) {
    // En Windows la ruta es de Git Bash, y puede ser /c/... o /tmp/..., que
    // Git Bash monta en la carpeta temporal del usuario: la traduce cygpath.
    const escrita = readFileSync(cd, 'utf8').trim();
    const destino = WINDOWS
      ? execFileSync(herramientas().bash, ['-c', 'cygpath -m "$1"', '_', escrita], { encoding: 'utf8' }).trim()
      : escrita;
    const relativa = posix.normalize(
      relative(realpathSync.native(B.limite), realpathSync.native(destino)).replaceAll('\\', '/'),
    );
    B.carpeta = relativa === '.' ? '' : relativa;
    A.carpeta = B.carpeta;
  }
  return r;
}

/**
 * Espera a que la pagina muestre lo que Git dice, para los cambios hechos por
 * fuera. A Git se le pregunta una vez; despues solo se mira la pagina, para
 * que la medida sea la demora de la pagina y no la del arnes.
 */
async function esperarAlDibujo(carpeta: string): Promise<{ ms: number; dif: string[] }> {
  const inicio = Date.now();
  const git = estadoSegunGit(carpeta, A.entorno);
  const desde = Date.now();
  let dif: string[] = [];
  while (Date.now() - desde < 5000) {
    dif = diferencias(await leerPantalla(pagina), git, A.carpeta);
    if (dif.length === 0) return { ms: Date.now() - inicio, dif };
    await pagina.waitForTimeout(20);
  }
  return { ms: Date.now() - inicio, dif };
}

const absoluta = (lado: Lado): string => join(lado.limite, ...lado.carpeta.split('/'));

function moverse(lado: Lado, texto: string): void {
  const m = texto.match(/^cd\s+(\S+)$/);
  if (m?.[1] === undefined) return;
  lado.carpeta = posix.normalize(posix.join(lado.carpeta, m[1])).replace(/^\.$/, '');
}

beforeAll(async () => {
  // native: en Windows resuelve tambien los nombres cortos, RUNNER~1.
  const raiz = realpathSync.native(mkdtempSync(join(tmpdir(), 'recorrido-')));
  const bin = join(raiz, 'bin');
  editorFalso(bin);
  A = prepararLado(raiz, 'SII', bin);
  B = prepararLado(raiz, 'SII gemelo', bin);
  instalar(A.limite);
  instalar(B.limite);
  if (MOTOR === 'python') {
    // Java saboteado: la cascada del arrancador tiene que llegar a Python.
    writeFileSync(join(A.limite, CLON, 'taller', 'java', 'taller.jar'), 'no es un jar');
  }
  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });

  // En Windows, como TALLER.cmd: bash --login, que arma su propio PATH aunque
  // el del sistema no tenga Git, y se queda en la carpeta de la que parte.
  const taller = join(A.limite, 'taller.sh').replaceAll('\\', '/');
  programa = DOBLE_CLIC
    ? // El doble clic en TALLER.cmd. El navegador lo abre la prueba, y la direccion queda en .taller/direccion.
      spawn('cmd.exe', ['/d', '/c', 'TALLER.cmd'], { cwd: A.limite, env: { ...A.entorno, TALLER_SIN_NAVEGADOR: '1' } })
    : spawn(herramientas().bash, WINDOWS ? ['--login', taller] : [taller], {
        cwd: A.limite,
        env: WINDOWS ? { ...A.entorno, CHERE_INVOKING: '1' } : A.entorno,
      });
  programa.stdout?.on('data', (d) => (registroPrograma += d));
  programa.stderr?.on('data', (d) => (registroPrograma += d));
  const inicio = Date.now();
  const anotada = join(A.limite, '.taller', 'direccion');
  const leida = (): string =>
    DOBLE_CLIC
      ? existsSync(anotada)
        ? (readFileSync(anotada, 'utf8').split(/\r?\n/)[0] ?? '').trim()
        : ''
      : (registroPrograma.match(/Dirección: (http\S+)/)?.[1] ?? '');
  while (!/^http\S+clave=/.test(leida())) {
    if (Date.now() - inicio > 90_000) throw new Error(`el programa no arranco:\n${registroPrograma}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  direccion = leida();

  navegador = await chromium.launch({ channel: CANAL });
  pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  compositor = await navegador.newPage({ viewport: { width: 1920, height: 850 } });
  await pagina.goto(direccion);
  await pagina.locator('[data-prueba="entrada-consola"]').waitFor({ state: 'visible' });
  // La barra dice el motor que quedo corriendo (SPEC 028, 3.3).
  const motor = await pagina.locator('[data-prueba="barra-motor"]').textContent();
  if (motor !== `motor ${MOTOR === 'java' ? 'Java' : 'Python'}`) {
    throw new Error(`la barra dice «${motor}» y se esperaba el motor ${MOTOR}:\n${registroPrograma}`);
  }
}, 180_000);

afterAll(async () => {
  mkdirSync(SALIDA, { recursive: true });
  const lineas = ['# Recorrido del modo taller', '', `Navegador ${CANAL}, ${process.platform}.`, ''];
  for (const n of NUMEROS) {
    const del = resultados.filter((r) => r.lab === n && r.tipo === 'orden');
    const iguales = del.filter((r) => r.igual).length;
    lineas.push(`## Laboratorio ${n}, ${iguales} de ${del.length} ordenes con la pagina igual a Git`, '');
    for (const r of resultados.filter((x) => x.lab === n)) {
      const marca = r.tipo === 'omitida' ? 'OMITIDA' : r.igual ? 'igual  ' : 'DISTINTA';
      lineas.push(`- ${marca} ${String(r.paso).padStart(3, '0')} \`${r.texto}\`${r.ms === undefined ? '' : ` ${r.ms} ms`}`);
      for (const d of r.diferencias) lineas.push(`    - ${d}`);
      for (const p of r.programa ?? []) lineas.push(`    - el programa dijo «${p}»`);
    }
    lineas.push('');
  }
  writeFileSync(join(SALIDA, `resultado-${process.platform}-${CANAL}-${MOTOR}.md`), lineas.join('\n'));

  // El indice de las capturas y un zip con todas, para revisarlas una por una.
  const indice = ['# Capturas del modo taller', '', 'A la izquierda la pagina, a la derecha lo que Git imprimio corrido aparte.', ''];
  for (const r of resultados.filter((x) => CON_CAPTURAS.has(x.lab) && x.tipo === 'orden' && !x.texto.startsWith('(editor)'))) {
    const nombre = `lab-${r.lab}-${String(r.paso).padStart(3, '0')}-${MOTOR}.jpg`;
    if (existsSync(join(SALIDA, nombre))) indice.push(`- [${nombre}](${nombre}) ${r.igual ? 'igual' : 'DISTINTA'} \`${r.texto}\``);
  }
  writeFileSync(join(SALIDA, 'indice.md'), indice.join('\n'));
  // En Windows, el tar del sistema, que arma zip. El de Git Bash, si esta
  // antes en el PATH, no sabe y toma «D:» por un equipo remoto: el zip no se
  // armaba en ninguna maquina de Windows salvo la del usuario con tilde, y el
  // error se tragaba (SPEC 029). Ahora, si no se arma, falla.
  const zip = join(SALIDA, `capturas-${process.platform}-${CANAL}-${MOTOR}.zip`);
  const capturas = readdirSync(SALIDA).filter((f) => f.endsWith('.jpg'));
  if (WINDOWS) {
    const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    execFileSync(tar, ['-a', '-c', '-f', zip, '-C', SALIDA, 'indice.md', ...capturas]);
  } else {
    execFileSync('zip', ['-q', '-j', zip, join(SALIDA, 'indice.md'), ...capturas.map((f) => join(SALIDA, f))]);
  }
  if (!existsSync(zip)) throw new Error(`no se armo el zip de capturas ${zip}`);
  await navegador?.close();
  cerrarPrograma();
}, 60_000);

describe('el modo taller, laboratorio por laboratorio', () => {
  const alias = aliasDelTaller(readFileSync(join(REPO, 'labs', 'lab-01', 'README.md'), 'utf8').replaceAll('\r\n', '\n'));

  for (const numero of NUMEROS) {
    it(`laboratorio ${numero}`, async () => {
      // En Windows el clon llega con CRLF, por el core.autocrlf de Git para Windows.
      const enunciado = readFileSync(join(REPO, 'labs', `lab-${numero}`, 'README.md'), 'utf8').replaceAll('\r\n', '\n');
      // Desde el SPEC 027 el enunciado no pide ir al clon: preparar deja la
      // consola en el laboratorio, y el 01 empieza en la raiz, taller-git.
      const pasos: Paso[] = pasosDe(numero, enunciado, alias);
      let paso = 0;
      for (const p of pasos) {
        paso++;
        if (p.tipo === 'omitida') {
          resultados.push({ lab: numero, paso, texto: p.texto, tipo: 'omitida', igual: false, diferencias: [p.motivo] });
          continue;
        }
        if (p.tipo === 'anexar') {
          for (const lado of [A, B]) {
            for (const [archivo, linea] of Object.entries(p.lineas)) {
              const ruta = join(absoluta(lado), archivo);
              writeFileSync(ruta, `${readFileSync(ruta, 'utf8')}${linea}\n`);
            }
          }
          const { ms, dif } = await esperarAlDibujo(absoluta(A));
          resultados.push({ lab: numero, paso, texto: `(editor) agrega una línea a ${Object.keys(p.lineas).join(', ')}`, tipo: 'orden', igual: dif.length === 0, diferencias: dif, ms });
          continue;
        }
        if (p.tipo === 'archivo' || p.tipo === 'resolver') {
          for (const lado of [A, B]) {
            const ruta = join(absoluta(lado), ...p.ruta.split('/'));
            mkdirSync(dirname(ruta), { recursive: true });
            const contenido =
              p.tipo === 'archivo'
                ? p.contenido
                : readFileSync(ruta, 'utf8')
                    .split('\n')
                    .filter((l) => !/^(<<<<<<<|=======|>>>>>>>)/.test(l))
                    .join('\n');
            writeFileSync(ruta, contenido);
          }
          const { ms, dif } = await esperarAlDibujo(absoluta(A));
          const texto = p.tipo === 'archivo' ? `(editor) crea ${p.ruta}` : `(editor) resuelve ${p.ruta}`;
          resultados.push({ lab: numero, paso, texto, tipo: 'orden', igual: dif.length === 0, diferencias: dif, ms });
          continue;
        }

        const de = p.orden.eleccion?.de;
        const textoA = ordenPara(p.orden, p.orden.eleccion === undefined ? null : p.orden.eleccion.elegir(A.salidas.get(de ?? '') ?? ''));
        const textoB = ordenPara(p.orden, p.orden.eleccion === undefined ? null : p.orden.eleccion.elegir(B.salidas.get(de ?? '') ?? ''));
        for (const lado of [A, B]) writeFileSync(lado.plan, (p.plan ?? []).join('\n'));

        const ms = await escribir(pagina, textoA);
        const consola = await salidaDeLaUltimaOrden(pagina);
        // clear lo resuelve la consola sin mandarlo, y deja la pantalla vacia.
        // En Bash, fuera de una terminal, falla: el gemelo no lo corre.
        const gemelo = textoB === 'clear' ? { codigo: 0, salida: '', error: '' } : gemeloDe(textoB);
        // La consola sigue al cd solo si funciono: lo dice el gemelo.
        if (gemelo.codigo === 0) {
          moverse(A, textoA);
          moverse(B, textoB);
        }
        const salidaB = [gemelo.salida, gemelo.error].filter((t) => t !== '').join('');
        // preparar.sh tiene que dar la misma historia en cualquier maquina. Si
        // las dos preparaciones no coinciden se anota, y el gemelo sigue desde
        // una copia exacta de la del participante: lo que se compara despues
        // es el programa, no el script.
        const preparado = gemelo.codigo === 0 ? textoA.match(/^preparar\s+0?(\d+)/)?.[1]?.padStart(2, '0') : undefined;
        let avisoPreparacion: string | null = null;
        if (preparado !== undefined) {
          const carpetaA = join(A.limite, `lab-${preparado}`);
          const carpetaB = join(B.limite, `lab-${preparado}`);
          const huella = (carpeta: string): string =>
            readdirSync(carpeta)
              .filter((n) => existsSync(join(carpeta, n, '.git')))
              .map((n) => `${n} ${estadoSegunGit(join(carpeta, n), A.entorno).confirmaciones.join(',')}`)
              .join('\n');
          if (huella(carpetaA) !== huella(carpetaB)) {
            avisoPreparacion = `preparar.sh dio historias distintas en la copia y en el gemelo:\n${huella(carpetaA)}\n---\n${huella(carpetaB)}`;
          }
          rmSync(carpetaB, { recursive: true, force: true });
          copiar(carpetaA, carpetaB);
          // Los remotos de la copia apuntan a la carpeta del participante: en
          // el gemelo tienen que apuntar a la suya.
          for (const nombre of readdirSync(carpetaB).filter((n) => existsSync(join(carpetaB, n, '.git')))) {
            const repo = join(carpetaB, nombre);
            let urls = '';
            try {
              urls = execFileSync(herramientas().git, ['config', '--get-regexp', '^remote\\..*\\.url$'], {
                cwd: repo,
                encoding: 'utf8',
              });
            } catch {
              // Sin remotos, git config termina con 1.
            }
            for (const linea of urls.split('\n').filter(Boolean)) {
              const [clave = '', ...resto] = linea.split(' ');
              const url = resto.join(' ');
              // Una sola pasada: la ruta del gemelo contiene a la de la copia como
              // prefijo, y reemplazar forma por forma la volvia a tocar.
              const patron = new RegExp(formas(A.limite).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
              const nueva = url.replace(patron, B.limite.replaceAll('\\', '/'));
              if (nueva !== url) execFileSync(herramientas().git, ['config', clave, nueva], { cwd: repo });
            }
          }
        }
        A.salidas.set(p.orden.texto, consola.git);
        B.salidas.set(p.orden.texto, salidaB);

        const pantalla = await leerPantalla(pagina);
        const git = estadoSegunGit(absoluta(A), A.entorno);
        const dif = diferencias(pantalla, git, A.carpeta);
        // La consola deja ver el eco de la orden, cabiendo o no la salida
        // (puntos 3.2 y 3.3 del SPEC 027).
        if (!pantalla.ecoVisible) dif.push('el eco de la orden quedó fuera de la vista de la consola');
        if (consola.programa.some((p) => p.includes('¿Eran'))) dif.push('la consola avisó dos órdenes en una orden del guion');
        if (textoA === 'clear' && (consola.git !== '' || consola.programa.length > 0)) dif.push('clear no dejó la consola vacía');
        // SPEC 031, 4.3 · un alias pegado en la consola queda igual que escrito
        // en Git Bash, con sus comillas, y es el del enunciado.
        const configurado = textoA.match(/^git config --global (alias\.\w+) "(.*)"$/);
        if (configurado !== null) {
          const clave = configurado[1] ?? '';
          const leer = (lado: Lado): string => {
            try {
              return execFileSync(herramientas().git, ['config', '--global', '--get', clave], { env: lado.entorno, encoding: 'utf8' }).trim();
            } catch {
              return '(sin valor)';
            }
          };
          const enPagina = leer(A);
          const enBash = leer(B);
          if (enPagina !== enBash || enPagina !== configurado[2]) {
            dif.push(`${clave}: en la consola «${enPagina}», en Bash «${enBash}», en el enunciado «${configurado[2]}»`);
          }
        }
        const enConsola = normalizar(consola.git, A);
        const enGit = normalizar(salidaB, B);
        if (enConsola !== enGit) dif.push(`consola:\n--- pagina\n${enConsola}\n--- Git\n${enGit}`);
        // El resultado de cada verificador queda en el informe.
        const criterios = consola.git.match(/(\d+) de (\d+) criterios aprobados/);
        // En la instalacion desde cero (SPEC 032, 3.4) el verificador tiene que aprobar entero.
        if (CLONAR_DESDE !== '' && /^verificar \d+$/.test(textoA) && (criterios === null || criterios[1] !== criterios[2])) {
          dif.push(`el verificador no aprobo: ${criterios === null ? 'sin resultado' : `${criterios[1]} de ${criterios[2]}`}`);
        }
        const texto =
          (p.arnes === undefined ? textoA : `${textoA}   (arnés: ${p.arnes})`) +
          (criterios === null ? '' : `   → verificador ${criterios[1]} de ${criterios[2]}`);
        resultados.push({
          lab: numero,
          paso,
          texto,
          tipo: 'orden',
          igual: dif.length === 0,
          diferencias: avisoPreparacion === null ? dif : [...dif, `(aviso, no cuenta como diferencia) ${avisoPreparacion}`],
          ms,
          programa: consola.programa,
        });

        if (CON_CAPTURAS.has(numero)) {
          const captura = await pagina.screenshot({ type: 'jpeg', quality: 85 });
          const derecha = [
            `$ ${textoB}`,
            enGit,
            '',
            '── Git, corrido aparte ──',
            `rama     ${git.rama ?? '(desconectada)'}  HEAD ${git.head ?? '-'}`,
            `ramas    ${git.ramas.join(' ')}`,
            `huerfanas ${git.huerfanas.join(' ') || '-'}`,
            `trabajo  ${git.trabajo.join(' ') || '-'}`,
            `prep.    ${git.preparacion.join(' ') || '-'}`,
            ...(dif.length > 0 ? ['', '── diferencias ──', ...dif] : []),
          ].join('\n');
          await componer(
            compositor,
            captura,
            `Laboratorio ${numero} · paso ${paso} · ${textoA}`,
            derecha,
            dif.length === 0,
            join(SALIDA, `lab-${numero}-${String(paso).padStart(3, '0')}-${MOTOR}.jpg`),
          );
        }
      }
      const distintas = resultados.filter((r) => r.lab === numero && r.tipo === 'orden' && !r.igual);
      expect(distintas.map((r) => `${r.paso} ${r.texto}\n${r.diferencias.join('\n')}`)).toEqual([]);
    }, 60 * 60_000);
  }

  it('en reposo no lanza ningun proceso, y un cambio de afuera se ve en menos de un segundo', async () => {
    const antes = await diagnostico();
    await pagina.waitForTimeout(60_000);
    const despues = await diagnostico();
    const carpeta = absoluta(A);
    // Cinco archivos escritos por fuera, como los guardaria un editor, cada
    // uno despues de un rato quieto.
    const demoras: number[] = [];
    let dif: string[] = [];
    for (let i = 1; i <= 5; i++) {
      await pagina.waitForTimeout(1500);
      writeFileSync(join(carpeta, `nota-del-editor-${i}.md`), 'escrito por fuera\n');
      const medida = await esperarAlDibujo(carpeta);
      demoras.push(medida.ms);
      dif = [...dif, ...medida.dif];
    }
    const ordenadas = [...demoras].sort((a, b) => a - b);
    const mediana = ordenadas[2] ?? 0;
    resultados.push({
      lab: 'reposo',
      paso: 1,
      texto: `procesos en un minuto de reposo ${despues.procesos - antes.procesos}, cambio de afuera visible en ${demoras.join(', ')} ms`,
      tipo: 'medida',
      igual: true,
      diferencias: [],
    });
    writeFileSync(
      join(SALIDA, `reposo-${process.platform}-${CANAL}-${MOTOR}.txt`),
      `procesos en 60 s de reposo ${despues.procesos - antes.procesos}\ncambio de afuera visible en ${demoras.join(', ')} ms, mediana ${mediana} ms\n`,
    );
    expect(despues.procesos - antes.procesos).toBe(0);
    expect(dif).toEqual([]);
    expect(mediana).toBeLessThan(1000);
  }, 180_000);

  it('la pantalla: el indicador se ve entero y sin tapar en cualquier ancho, despues de cien ordenes', async () => {
    const total = resultados.filter((r) => r.tipo === 'orden').length;
    expect(total).toBeGreaterThan(100);
    for (const ancho of [900, 1024, 1280, 1440]) {
      await pagina.setViewportSize({ width: ancho, height: 900 });
      await pagina.waitForTimeout(300);
      const medida = await pagina.evaluate(() => {
        const bloque = document.querySelector('[aria-busy]');
        const indicador = bloque?.querySelector('[data-prueba="indicador"]')?.getBoundingClientRect();
        const campo = document.querySelector('[data-prueba="entrada-consola"]')?.getBoundingClientRect();
        const ultima = [...document.querySelectorAll('section[aria-label="Consola"] pre')].at(-1)?.getBoundingClientRect();
        const letra = parseFloat(getComputedStyle(document.querySelector('section[aria-label="Consola"] pre') ?? document.body).fontSize);
        return { indicador, campo, ultima, letra, alto: innerHeight };
      });
      expect(medida.indicador?.height ?? 0).toBeGreaterThan(0);
      // El campo empieza debajo del indicador: no lo pisa.
      expect(medida.campo?.top ?? 0).toBeGreaterThanOrEqual((medida.indicador?.bottom ?? 0) - 0.5);
      expect(medida.letra).toBeGreaterThanOrEqual(11);
      // Desde novecientos pixeles, la consola y el grafo lado a lado (SPEC 027, 1.2).
      const lado = await pagina.evaluate(() => {
        const c = document.querySelector('section[aria-label="Consola"]')?.getBoundingClientRect();
        const g = document.querySelector('section[aria-label="Grafo de confirmaciones"]')?.getBoundingClientRect();
        return { consolaDerecha: c?.right ?? 0, grafoIzquierda: g?.left ?? 0, grafoAncho: g?.width ?? 0, arriba: Math.abs((c?.top ?? 0) - (g?.top ?? 1)) };
      });
      expect(lado.consolaDerecha, `a ${ancho} px`).toBeLessThanOrEqual(lado.grafoIzquierda);
      expect(lado.arriba, `a ${ancho} px`).toBeLessThan(2);
      expect(lado.grafoAncho, `a ${ancho} px el grafo quedo muy angosto`).toBeGreaterThan(ancho * 0.3);
      await pagina.screenshot({ path: join(SALIDA, `ancho-${ancho}.jpg`), type: 'jpeg', quality: 80 });
    }
    // Bajo novecientos se apilan, la consola arriba.
    await pagina.setViewportSize({ width: 880, height: 900 });
    await pagina.waitForTimeout(300);
    const apilado = await pagina.evaluate(() => {
      const c = document.querySelector('section[aria-label="Consola"]')?.getBoundingClientRect();
      const g = document.querySelector('section[aria-label="Grafo de confirmaciones"]')?.getBoundingClientRect();
      return (g?.top ?? 0) >= (c?.bottom ?? 1);
    });
    expect(apilado).toBe(true);
    await pagina.screenshot({ path: join(SALIDA, 'ancho-880.jpg'), type: 'jpeg', quality: 80 });
    await pagina.setViewportSize({ width: 1440, height: 900 });
  }, 60_000);

  it('la consola avisa dos ordenes pegadas, y muestra una salida larga desde su principio', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', '.') || '.'}`);
    A.carpeta = '';
    await escribir(pagina, 'mkdir -p prueba-dos cd prueba-dos');
    const pegadas = await salidaDeLaUltimaOrden(pagina);
    expect(pegadas.programa.join(' ')).toContain('¿Eran dos órdenes?');
    // La orden corrio igual: bash creo las tres carpetas.
    expect(existsSync(join(A.limite, 'cd'))).toBe(true);
    await pagina.screenshot({ path: join(SALIDA, 'dos-ordenes.jpg'), type: 'jpeg', quality: 80 });
    await escribir(pagina, 'rm -rf prueba-dos ./cd');

    // preparar imprime mas de una pantalla: se ve su principio y la marca.
    await escribir(pagina, 'preparar 03 --forzar');
    const larga = await leerPantalla(pagina);
    expect(larga.ecoVisible).toBe(true);
    expect(larga.masAbajo).toBe(true);
    await pagina.screenshot({ path: join(SALIDA, 'salida-larga.jpg'), type: 'jpeg', quality: 80 });
    await pagina.locator('[data-prueba="mas-abajo"]').click();
    await pagina.waitForTimeout(200);
    expect((await leerPantalla(pagina)).masAbajo).toBe(false);
    A.carpeta = 'lab-03/recetario';

    // ayuda, y el eco de las ordenes propias en otro color.
    await escribir(pagina, 'ayuda');
    const ayuda = await salidaDeLaUltimaOrden(pagina);
    expect(ayuda.programa.join('\n')).toContain('preparar 02 --forzar');
    expect(await pagina.locator('[data-propia="si"]').count()).toBeGreaterThan(0);
  }, 120_000);

  it('la consola sigue pegada al final si se achica justo despues de bajar sola', async () => {
    // Lo que paso en la integracion continua con git init: la consola baja
    // sola, y antes de que llegue el evento de ese desplazamiento la barra
    // crece y la consola se achica. Aqui se provoca a proposito: un primer
    // achique, la consola vuelve a bajar, y un segundo achique antes del
    // cuadro siguiente.
    await escribir(pagina, 'echo pegada al final');
    const eco = await pagina.evaluate(async () => {
      const ecos = [...document.querySelectorAll<HTMLElement>('section[aria-label="Consola"] [data-color="orden"]')];
      let caja = ecos.at(-1)?.parentElement ?? null;
      while (caja !== null && !['auto', 'scroll'].includes(getComputedStyle(caja).overflowY)) caja = caja.parentElement;
      if (caja === null) return 'sin caja';
      if (caja.scrollHeight <= caja.clientHeight + 200) return 'la consola no desborda';
      const alto = caja.clientHeight;
      const cuadro = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()));
      // El observador de la pagina se creo antes, asi que corre antes que
      // este: cuando este corre, la consola ya volvio a bajar sola.
      await new Promise<void>((listo) => {
        const observador = new ResizeObserver(() => {
          observador.disconnect();
          setTimeout(() => {
            caja.style.maxHeight = `${alto - 160}px`;
            listo();
          }, 0);
        });
        caja.style.maxHeight = `${alto - 80}px`;
        observador.observe(caja);
      });
      for (let i = 0; i < 4; i++) await cuadro();
      const ultimo = ecos.at(-1)?.getBoundingClientRect();
      const visible = caja.getBoundingClientRect();
      const dentro = ultimo !== undefined && ultimo.top >= visible.top - 1 && ultimo.bottom <= visible.bottom + 1;
      caja.style.maxHeight = '';
      return dentro ? 'visible' : `fuera: eco ${ultimo?.top}-${ultimo?.bottom}, consola ${visible.top}-${visible.bottom}`;
    });
    expect(eco).toBe('visible');
  }, 60_000);

  // --- SPEC 029 · el grafo y la pila de guardado ---------------------------------

  /** Lo que el grafo dibuja ahora, leido de la pagina. */
  const grafoEnPantalla = () =>
    pagina.evaluate(() => {
      const caja = document.querySelector<HTMLElement>('[data-prueba="grafo-desplazable"]');
      const svg = caja?.querySelector('svg');
      const nodos = [...document.querySelectorAll('[data-confirmacion]')].map((n) => n.getAttribute('data-confirmacion'));
      const mensajes = [...document.querySelectorAll<SVGTextElement>('[data-prueba="mensaje"]')].map((m) => ({
        de: m.getAttribute('data-de'),
        texto: [...m.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(''),
        cortado: m.getAttribute('data-cortado') === 'si',
        titulo: m.querySelector('title')?.textContent ?? null,
      }));
      const head = document.querySelector('[data-forma="puntero"]')?.getBoundingClientRect();
      const marco = caja?.getBoundingClientRect();
      return {
        nodos,
        mensajes,
        zoom: Number(svg?.getAttribute('data-zoom') ?? '0'),
        anchoSvg: svg?.getBoundingClientRect().width ?? 0,
        desborda: { alto: (caja?.scrollHeight ?? 0) > (caja?.clientHeight ?? 0), ancho: (caja?.scrollWidth ?? 0) > (caja?.clientWidth ?? 0) },
        headVisible:
          head !== undefined && marco !== undefined &&
          head.top >= marco.top - 1 && head.bottom <= marco.bottom + 1 && head.left >= marco.left - 1 && head.right <= marco.right + 1,
        paginaAncha: document.documentElement.scrollWidth > innerWidth + 1,
        escalaPagina: window.visualViewport?.scale ?? 1,
      };
    });

  const hastaQue = async (condicion: () => Promise<boolean>, que: string): Promise<void> => {
    const limite = Date.now() + 10_000;
    while (!(await condicion())) {
      if (Date.now() > limite) throw new Error(`no paso: ${que}`);
      await pagina.waitForTimeout(150);
    }
  };

  it('SPEC 029 · 1.1 el grafo lleva el mensaje de cada confirmacion, y el cortado muestra el completo', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', '.') || '.'}`);
    A.carpeta = '';
    // El laboratorio 02 recien preparado: el mensaje mal escrito se lee en el dibujo.
    await escribir(pagina, 'preparar 02 --forzar');
    A.carpeta = 'lab-02/recetario';
    await quieta(pagina);
    const lab02 = await grafoEnPantalla();
    expect(lab02.mensajes.length).toBe(lab02.nodos.length);
    const segunGit = execFileSync(herramientas().git, ['log', '--all', '--format=%s'], { cwd: absoluta(A), encoding: 'utf8' })
      .trim()
      .split('\n');
    expect(lab02.mensajes.map((m) => m.texto).sort()).toEqual([...segunGit].sort());
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-lab-02.jpg'), type: 'jpeg', quality: 85 });

    // Un mensaje que no cabe se corta, y el completo va en el titulo, que el
    // navegador muestra al pasar el puntero.
    const largo = 'Este mensaje de confirmación es largo a propósito, para ver que el grafo lo corta con puntos suspensivos y lo muestra entero al pasar el puntero';
    await escribir(pagina, `git commit --allow-empty -q -m "${largo}"`);
    await hastaQue(async () => (await grafoEnPantalla()).mensajes.some((m) => m.cortado), 'aparece el mensaje cortado');
    const cortado = (await grafoEnPantalla()).mensajes.find((m) => m.cortado);
    expect(cortado?.texto.endsWith('…')).toBe(true);
    expect(cortado?.titulo).toBe(largo);
    await pagina.locator(`[data-prueba="mensaje"][data-cortado="si"]`).first().hover();
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-mensaje-cortado.jpg'), type: 'jpeg', quality: 85 });
  }, 120_000);

  it('SPEC 029 · 1.2 con mas de treinta confirmaciones y cinco ramas, el panel se desplaza, no corta nada y queda mostrando HEAD', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', '.') || '.'}`);
    A.carpeta = '';
    await escribir(pagina, 'rm -rf prueba-grafo && mkdir prueba-grafo && cd prueba-grafo && git init -q -b main');
    A.carpeta = 'prueba-grafo';
    await escribir(pagina, 'for i in $(seq 1 32); do echo $i >> a.txt; git add a.txt; git commit -q -m "confirmación número $i"; done');
    await escribir(pagina, 'for r in andina azteca criolla tailandesa; do git switch -q -c $r HEAD~3; echo $r > $r.txt; git add $r.txt; git commit -q -m "la rama $r"; done; git switch -q main');
    const total = Number(execFileSync(herramientas().git, ['rev-list', '--all', '--count'], { cwd: absoluta(A), encoding: 'utf8' }).trim());
    expect(total).toBeGreaterThan(30);
    await hastaQue(async () => (await grafoEnPantalla()).nodos.length === total, 'se dibujan todas');
    const ramas = await pagina.locator('[data-forma="rama"]').count();
    expect(ramas).toBe(5);
    const antes = await grafoEnPantalla();
    expect(antes.mensajes.length).toBe(total);
    expect(antes.desborda.alto).toBe(true);
    expect(antes.paginaAncha).toBe(false);
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-desplazamiento.jpg'), type: 'jpeg', quality: 85 });
    // Se baja hasta el fondo, y un cambio del repositorio vuelve a mostrar HEAD.
    await pagina.locator('[data-prueba="grafo-desplazable"]').evaluate((caja) => {
      caja.scrollTop = caja.scrollHeight;
      caja.scrollLeft = caja.scrollWidth;
    });
    expect((await grafoEnPantalla()).headVisible).toBe(false);
    await escribir(pagina, 'git switch -q andina');
    await hastaQue(async () => (await grafoEnPantalla()).headVisible, 'HEAD a la vista despues del cambio');
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-head-a-la-vista.jpg'), type: 'jpeg', quality: 85 });
  }, 180_000);

  it('SPEC 029 · 1.3 agrandar, achicar y volver, con los botones y con Ctrl y la rueda, recordado al recargar', async () => {
    const boton = (cual: string) => pagina.locator(`[data-prueba="zoom-${cual}"]`);
    await boton('normal').click({ force: true }).catch(() => undefined);
    const normal = await grafoEnPantalla();
    expect(normal.zoom).toBe(1);
    await boton('mas').click();
    await boton('mas').click();
    const grande = await grafoEnPantalla();
    expect(grande.zoom).toBeGreaterThan(1);
    expect(grande.anchoSvg).toBeGreaterThan(normal.anchoSvg * 1.15);
    // Agrandado, el dibujo tambien se desplaza a lo ancho, y la pagina no.
    expect(grande.desborda.ancho).toBe(true);
    expect(grande.paginaAncha).toBe(false);
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-agrandado.jpg'), type: 'jpeg', quality: 85 });
    // Se recuerda al recargar.
    await pagina.reload();
    await pagina.locator('[data-prueba="entrada-consola"]').waitFor({ state: 'visible' });
    await hastaQue(async () => (await grafoEnPantalla()).nodos.length > 0, 'el grafo vuelve');
    expect((await grafoEnPantalla()).zoom).toBe(grande.zoom);
    await boton('normal').click();
    expect((await grafoEnPantalla()).zoom).toBe(1);
    await boton('menos').click();
    const chico = await grafoEnPantalla();
    expect(chico.zoom).toBeLessThan(1);
    expect(chico.anchoSvg).toBeLessThan(normal.anchoSvg);
    await pagina.locator('section[aria-label="Grafo de confirmaciones"]').screenshot({ path: join(SALIDA, 'grafo-achicado.jpg'), type: 'jpeg', quality: 85 });
    await boton('normal').click();
    // Ctrl y la rueda sobre el panel: el grafo, no la pagina.
    await pagina.locator('[data-prueba="grafo-desplazable"]').hover();
    await pagina.keyboard.down('Control');
    await pagina.mouse.wheel(0, -120);
    await pagina.keyboard.up('Control');
    await hastaQue(async () => (await grafoEnPantalla()).zoom > 1, 'Ctrl y la rueda agrandan el grafo');
    const conRueda = await grafoEnPantalla();
    expect(conRueda.escalaPagina).toBe(1);
    await pagina.keyboard.down('Control');
    await pagina.mouse.wheel(0, 120);
    await pagina.keyboard.up('Control');
    await hastaQue(async () => (await grafoEnPantalla()).zoom === 1, 'Ctrl y la rueda achican el grafo');
    // Al cambiar de repositorio el tamaño se mantiene.
    await boton('mas').click();
    const elegido = (await grafoEnPantalla()).zoom;
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', 'lab-02/recetario')}`);
    A.carpeta = 'lab-02/recetario';
    await hastaQue(async () => (await grafoEnPantalla()).nodos.length > 0 && (await grafoEnPantalla()).nodos.length < 10, 'el grafo del laboratorio 02');
    expect((await grafoEnPantalla()).zoom).toBe(elegido);
    await boton('normal').click();
  }, 180_000);

  it('SPEC 029 · 2.1 la pila de guardado se ve siempre, vacia y con dos entradas', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', 'prueba-grafo')}`);
    A.carpeta = 'prueba-grafo';
    await escribir(pagina, 'git stash clear');
    await pagina.locator('[data-prueba="pila-vacia"]').waitFor({ state: 'visible', timeout: 10_000 });
    expect(await pagina.locator('[data-prueba="pila"]').isVisible()).toBe(true);
    await pagina.locator('[data-prueba="pila"]').screenshot({ path: join(SALIDA, 'pila-vacia.jpg'), type: 'jpeg', quality: 85 });
    await escribir(pagina, 'echo uno >> a.txt && git stash push -q -m "primera a medias"');
    await escribir(pagina, 'echo dos >> a.txt && git stash push -q -m "segunda a medias"');
    await hastaQue(async () => (await pagina.locator('[data-guardado]').count()) === 2, 'dos entradas en la pila');
    expect(await pagina.locator('[data-prueba="pila-vacia"]').count()).toBe(0);
    const textos = await pagina.locator('[data-guardado]').allTextContents();
    expect(textos.join(' ')).toContain('segunda a medias');
    expect(textos.join(' ')).toContain('primera a medias');
    await pagina.locator('[data-prueba="pila"]').screenshot({ path: join(SALIDA, 'pila-con-dos.jpg'), type: 'jpeg', quality: 85 });
    // En el modo relator tambien, que es el que se proyecta en clase.
    const relator = pagina.getByRole('button', { name: 'modo relator' });
    await relator.click();
    await pagina.waitForTimeout(300);
    expect(await pagina.locator('[data-prueba="pila"]').isVisible()).toBe(true);
    expect(await pagina.locator('[data-guardado]').count()).toBe(2);
    await pagina.screenshot({ path: join(SALIDA, 'pila-modo-relator.jpg'), type: 'jpeg', quality: 80 });
    await relator.click();
    // Fuera de un repositorio tambien esta, vacia.
    await escribir(pagina, 'cd ..');
    A.carpeta = '';
    await pagina.locator('[data-prueba="pila-vacia"]').waitFor({ state: 'visible', timeout: 10_000 });
  }, 120_000);

  it('SPEC 029 · 1.4 y 2.1 en el modo de escenarios, lo mismo', async () => {
    if (navegador === undefined) throw new Error("sin navegador");
    const escenarios = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await escenarios.goto(`${pathToFileURL(join(REPO, 'SIMULADOR.html')).href}?lab=02`);
      await escenarios.locator('[data-prueba="mensaje"]').first().waitFor({ state: 'visible' });
      const vista = await escenarios.evaluate(() => ({
        nodos: document.querySelectorAll('[data-confirmacion]').length,
        mensajes: [...document.querySelectorAll('[data-prueba="mensaje"]')].map((m) => m.textContent ?? ''),
        vacia: document.querySelector('[data-prueba="pila-vacia"]') !== null,
        botones: document.querySelectorAll('[data-prueba^="zoom-"]').length,
      }));
      expect(vista.mensajes.length).toBe(vista.nodos);
      expect(vista.mensajes.join('\n')).toContain('se docuemnta la reseta del pastel de choclo');
      expect(vista.vacia).toBe(true);
      expect(vista.botones).toBe(3);
      await escenarios.locator('[data-prueba="zoom-mas"]').click();
      expect(Number(await escenarios.locator('[data-prueba="grafo-desplazable"] svg').getAttribute('data-zoom'))).toBeGreaterThan(1);
      await escenarios.screenshot({ path: join(SALIDA, 'escenarios-lab-02.jpg'), type: 'jpeg', quality: 80 });
    } finally {
      await escenarios.close();
    }
  }, 60_000);

  it('sin repositorio la barra no dice rama, y si el programa se cierra lo dice una franja', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', '.') || '.'}`);
    A.carpeta = '';
    const pantalla = await leerPantalla(pagina);
    expect(pantalla.barraSinRepositorio).toBe(true);
    expect(pantalla.barraConRama).toBe(false);
    expect(pantalla.barraConCambios).toBe(false);
    cerrarPrograma();
    // En Windows una conexion rechazada en 127.0.0.1 tarda unos dos segundos en fallar.
    await pagina.locator('[data-prueba="franja-caida"]').waitFor({ state: 'visible', timeout: 10_000 });
    // Un taller cerrado vuelve con otra clave: esta pestaña no se reconecta, y
    // la franja manda a cerrarla y seguir en la nueva (SPEC 029).
    const franja = (await pagina.locator('[data-prueba="franja-caida"]').textContent()) ?? '';
    expect(franja).toContain('ciérrala');
    expect(franja).toContain('pestaña nueva');
    expect(franja).not.toContain('cinco segundos');
    await pagina.screenshot({ path: join(SALIDA, 'franja.jpg'), type: 'jpeg', quality: 80 });
    expect(await pagina.locator('[data-prueba="entrada-consola"]').isVisible()).toBe(false);
  }, 60_000);
});
