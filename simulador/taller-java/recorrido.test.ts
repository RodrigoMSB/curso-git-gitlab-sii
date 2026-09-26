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
 *   TALLER_CAPTURAS    carpeta de salida (por omision simulador/capturas-taller-java)
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
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  aliasDelTaller,
  bloquesDe,
  ordenesDe,
  ordenPara,
  resolverMarcadores,
  type OrdenDelEnunciado,
} from '../cypress/soporte/ordenes';
import { correrEnBash, estadoSegunGit, herramientas, WINDOWS, type EstadoSegunGit } from './git';
import { escribir, leerPantalla, salidaDeLaUltimaOrden, type EstadoEnPantalla } from './pagina';

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(AQUI, '..', '..');
const CANAL = process.env.TALLER_NAVEGADOR ?? 'chrome';
const NUMEROS = (process.env.TALLER_LABS ?? '01,02,03,04,05,06,07,08').split(',');
const SALIDA = process.env.TALLER_CAPTURAS ?? join(REPO, 'simulador', 'capturas-taller-java');
const CON_CAPTURAS = new Set(['01', '02']);
const CLON = 'curso-git-gitlab-sii';

// --- Los pasos del guion ------------------------------------------------------

type Paso =
  | { readonly tipo: 'orden'; readonly orden: OrdenDelEnunciado; readonly arnes?: string; readonly plan?: readonly string[] }
  | { readonly tipo: 'archivo'; readonly ruta: string; readonly contenido: string; readonly linea: number }
  | { readonly tipo: 'resolver'; readonly ruta: string; readonly linea: number }
  | { readonly tipo: 'omitida'; readonly texto: string; readonly motivo: string };

/**
 * Lo que el enunciado le pide hacer en el editor al participante, para las
 * ordenes que lo abren. Va por laboratorio, orden y vez que aparece.
 */
const MENSAJE_REWORD = 'se prueba la receta del curry antes de servirla';
const PLANES: Readonly<Record<string, readonly (readonly string[])[]>> = {
  '07 git rebase -i main': [
    ['reword-primera', `mensaje ${MENSAJE_REWORD}`],
    ['squash-del-medio', `mensaje ${MENSAJE_REWORD}`],
  ],
};

const orden = (texto: string, linea = 0): OrdenDelEnunciado => ({ texto, clase: 'comparada', motivo: '', linea, terminal: false });

function pasosDe(numero: string, enunciado: string, alias: Readonly<Record<string, string>>): Paso[] {
  const lineas = enunciado.split('\n');
  const creaciones = new Set<number>();
  const resoluciones = new Map<number, string>();
  lineas.forEach((l, i) => {
    if (/Crea(?: el archivo)? `[\w./-]+`/.test(l)) creaciones.add(i + 1);
    const abre = l.match(/Abre `([^`]+)` en tu editor/);
    if (abre?.[1] !== undefined) resoluciones.set(i + 1, abre[1]);
  });

  // `preparar.sh` no entra por el extractor, que lo deja al arnes de Cypress.
  // Aqui el participante lo escribe en la consola, asi que es una orden mas.
  const preparaciones: OrdenDelEnunciado[] = [];
  for (const bloque of bloquesDe(enunciado)) {
    bloque.contenido.split('\n').forEach((cruda, i) => {
      if (/^labs\/lab-\d+\/preparar\.sh$/.test(cruda.trim())) preparaciones.push(orden(cruda.trim(), bloque.linea + i));
    });
  }

  const pasos: Paso[] = [];
  const archivos = new Map<string, { ruta: string; filas: string[]; linea: number }>();
  const vistas = new Map<string, number>();
  const pendientes = [...resoluciones.entries()].sort((a, b) => a[0] - b[0]);

  const guion = [...resolverMarcadores(ordenesDe(enunciado, alias), numero, alias), ...preparaciones].sort((a, b) => a.linea - b.linea);
  for (const o of guion) {
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
    if (/^labs\/lab-\d+\/preparar\.sh$/.test(o.texto)) {
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
  const limite = join(raiz, 'Ana Núñez', nombre);
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
  return { limite, casa, plan, entorno, carpeta: 'taller-git-trabajo', salidas: new Map() };
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

function clonar(destino: string): void {
  execFileSync(herramientas().git, ['clone', '-q', REPO, destino], { stdio: 'ignore' });
  // Lo que todavia no esta confirmado en la rama viaja igual: el recorrido
  // prueba el arbol de trabajo, no el ultimo commit. En la integracion
  // continua el arbol es el commit y no hace falta.
  if (process.env.CI !== 'true') {
    for (const ruta of ['SIMULADOR.html', 'taller-java/taller.jar', 'taller-java/arrancar.sh', 'taller-java.sh', 'labs']) {
      copiar(join(REPO, ruta), join(destino, ruta));
    }
  }
  if (!existsSync(join(destino, 'taller-java', 'jre')) && existsSync(join(REPO, 'taller-java', 'jre'))) {
    copiar(join(REPO, 'taller-java', 'jre'), join(destino, 'taller-java', 'jre'));
  }
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
function formas(ruta: string): string[] {
  const conBarras = ruta.replaceAll('\\', '/');
  const msys = conBarras.replace(/^([A-Za-z]):/, (_, u: string) => `/${u.toLowerCase()}`);
  const todas = [ruta, conBarras, msys, conBarras.replace(/^\/private/, '')];
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
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'recorrido-')));
  const bin = join(raiz, 'bin');
  editorFalso(bin);
  A = prepararLado(raiz, 'SII', bin);
  B = prepararLado(raiz, 'SII gemelo', bin);
  clonar(join(A.limite, CLON));
  clonar(join(B.limite, CLON));
  mkdirSync(join(B.limite, 'taller-git-trabajo'), { recursive: true });
  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });

  programa = spawn(herramientas().bash, [join(A.limite, CLON, 'taller-java.sh').replaceAll('\\', '/')], {
    cwd: join(A.limite, CLON),
    env: A.entorno,
  });
  programa.stdout?.on('data', (d) => (registroPrograma += d));
  programa.stderr?.on('data', (d) => (registroPrograma += d));
  const inicio = Date.now();
  while (!/Dirección: (http\S+)/.test(registroPrograma)) {
    if (Date.now() - inicio > 60_000) throw new Error(`el programa no arranco:\n${registroPrograma}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  direccion = registroPrograma.match(/Dirección: (http\S+)/)?.[1] ?? '';

  navegador = await chromium.launch({ channel: CANAL });
  pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  compositor = await navegador.newPage({ viewport: { width: 1920, height: 850 } });
  await pagina.goto(direccion);
  await pagina.locator('[data-prueba="entrada-consola"]').waitFor({ state: 'visible' });
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
  writeFileSync(join(SALIDA, `resultado-${process.platform}-${CANAL}.md`), lineas.join('\n'));

  // El indice de las capturas y un zip con todas, para revisarlas una por una.
  const indice = ['# Capturas del modo taller', '', 'A la izquierda la pagina, a la derecha lo que Git imprimio corrido aparte.', ''];
  for (const r of resultados.filter((x) => CON_CAPTURAS.has(x.lab) && x.tipo === 'orden' && !x.texto.startsWith('(editor)'))) {
    const nombre = `lab-${r.lab}-${String(r.paso).padStart(3, '0')}.jpg`;
    if (existsSync(join(SALIDA, nombre))) indice.push(`- [${nombre}](${nombre}) ${r.igual ? 'igual' : 'DISTINTA'} \`${r.texto}\``);
  }
  writeFileSync(join(SALIDA, 'indice.md'), indice.join('\n'));
  try {
    const zip = join(SALIDA, `capturas-${process.platform}-${CANAL}.zip`);
    if (WINDOWS) execFileSync('tar.exe', ['-a', '-c', '-f', zip, '-C', SALIDA, 'indice.md', ...readdirSync(SALIDA).filter((f) => f.endsWith('.jpg'))]);
    else execFileSync('zip', ['-q', '-j', zip, join(SALIDA, 'indice.md'), ...readdirSync(SALIDA).filter((f) => f.endsWith('.jpg')).map((f) => join(SALIDA, f))]);
  } catch (error) {
    console.error('no se pudo armar el zip de capturas', error);
  }
  await navegador?.close();
  cerrarPrograma();
}, 60_000);

describe('el modo taller, laboratorio por laboratorio', () => {
  const alias = aliasDelTaller(readFileSync(join(REPO, 'labs', 'lab-01', 'README.md'), 'utf8'));

  for (const numero of NUMEROS) {
    it(`laboratorio ${numero}`, async () => {
      const enunciado = readFileSync(join(REPO, 'labs', `lab-${numero}`, 'README.md'), 'utf8');
      // El enunciado empieza en la raiz del clon. Desde donde haya quedado la
      // consola, el participante vuelve con un cd: el arnes escribe el mismo.
      const hastaElClon = posix.relative(A.carpeta || '.', CLON) || '.';
      const pasos: Paso[] = [
        { tipo: 'orden', orden: orden(`cd ${hastaElClon}`), arnes: 'volver a la raiz del clon' },
        ...pasosDe(numero, enunciado, alias),
      ];
      let paso = 0;
      for (const p of pasos) {
        paso++;
        if (p.tipo === 'omitida') {
          resultados.push({ lab: numero, paso, texto: p.texto, tipo: 'omitida', igual: false, diferencias: [p.motivo] });
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
        const gemelo = correrEnBash(textoB, absoluta(B), B.entorno);
        // La consola sigue al cd solo si funciono: lo dice el gemelo.
        if (gemelo.codigo === 0) {
          moverse(A, textoA);
          moverse(B, textoB);
        }
        const salidaB = [gemelo.salida, gemelo.error].filter((t) => t !== '').join('');
        A.salidas.set(p.orden.texto, consola.git);
        B.salidas.set(p.orden.texto, salidaB);

        const pantalla = await leerPantalla(pagina);
        const git = estadoSegunGit(absoluta(A), A.entorno);
        const dif = diferencias(pantalla, git, A.carpeta);
        const enConsola = normalizar(consola.git, A);
        const enGit = normalizar(salidaB, B);
        if (enConsola !== enGit) dif.push(`consola:\n--- pagina\n${enConsola}\n--- Git\n${enGit}`);
        const texto = p.arnes === undefined ? textoA : `${textoA}   (arnés: ${p.arnes})`;
        resultados.push({ lab: numero, paso, texto, tipo: 'orden', igual: dif.length === 0, diferencias: dif, ms, programa: consola.programa });

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
            join(SALIDA, `lab-${numero}-${String(paso).padStart(3, '0')}.jpg`),
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
      join(SALIDA, `reposo-${process.platform}-${CANAL}.txt`),
      `procesos en 60 s de reposo ${despues.procesos - antes.procesos}\ncambio de afuera visible en ${demoras.join(', ')} ms, mediana ${mediana} ms\n`,
    );
    expect(despues.procesos - antes.procesos).toBe(0);
    expect(dif).toEqual([]);
    expect(mediana).toBeLessThan(1000);
  }, 180_000);

  it('la pantalla: el indicador se ve entero y sin tapar en cualquier ancho, despues de cien ordenes', async () => {
    const total = resultados.filter((r) => r.tipo === 'orden').length;
    expect(total).toBeGreaterThan(100);
    for (const ancho of [1024, 1280, 1440, 1920]) {
      await pagina.setViewportSize({ width: ancho, height: 900 });
      await pagina.waitForTimeout(300);
      const medida = await pagina.evaluate(() => {
        const bloque = document.querySelector('[aria-busy]');
        const indicador = bloque?.querySelector('.t-min')?.getBoundingClientRect();
        const campo = document.querySelector('[data-prueba="entrada-consola"]')?.getBoundingClientRect();
        const ultima = [...document.querySelectorAll('section[aria-label="Consola"] pre')].at(-1)?.getBoundingClientRect();
        const letra = parseFloat(getComputedStyle(document.querySelector('section[aria-label="Consola"] pre') ?? document.body).fontSize);
        return { indicador, campo, ultima, letra, alto: innerHeight };
      });
      expect(medida.indicador?.height ?? 0).toBeGreaterThan(0);
      // El campo empieza debajo del indicador: no lo pisa.
      expect(medida.campo?.top ?? 0).toBeGreaterThanOrEqual((medida.indicador?.bottom ?? 0) - 0.5);
      expect(medida.letra).toBeGreaterThanOrEqual(11);
      await pagina.screenshot({ path: join(SALIDA, `ancho-${ancho}.jpg`), type: 'jpeg', quality: 80 });
    }
    await pagina.setViewportSize({ width: 1440, height: 900 });
  }, 60_000);

  it('sin repositorio la barra no dice rama, y si el programa se cierra lo dice una franja', async () => {
    await escribir(pagina, `cd ${posix.relative(A.carpeta || '.', 'taller-git-trabajo') || '.'}`);
    A.carpeta = 'taller-git-trabajo';
    const pantalla = await leerPantalla(pagina);
    expect(pantalla.barraSinRepositorio).toBe(true);
    expect(pantalla.barraConRama).toBe(false);
    expect(pantalla.barraConCambios).toBe(false);
    cerrarPrograma();
    await pagina.locator('[data-prueba="franja-caida"]').waitFor({ state: 'visible', timeout: 5000 });
    await pagina.screenshot({ path: join(SALIDA, 'franja.jpg'), type: 'jpeg', quality: 80 });
    expect(await pagina.locator('[data-prueba="entrada-consola"]').isVisible()).toBe(false);
  }, 60_000);
});
