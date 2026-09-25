/**
 * El modo real en un navegador de verdad (SPEC 020, CA1 a CA3 y CA5).
 *
 * Lo que se prueba es `SIMULADOR.html`, el archivo que el participante abre
 * con doble clic, y no el codigo en modo de desarrollo.
 *
 * ## Como llega la carpeta
 *
 * El dialogo para elegir una carpeta no se puede apretar desde un programa
 * (punto 5.2). Se hace lo mismo que la sonda del arquitecto: el repositorio se
 * copia al almacenamiento privado del navegador (OPFS) y `showDirectoryPicker`
 * se reemplaza por una funcion que devuelve esa copia. Todo lo demas —leer,
 * vigilar, dibujar— es el camino de siempre. Despues de cada orden de Git se
 * copia a la OPFS lo que cambio en el disco y se borra lo que desaparecio.
 *
 * Esa copia la hace **otra pestaña** del mismo navegador, «el disco», que
 * comparte la OPFS con la pagina (SPEC 024, 2.4). A la pagina que se prueba
 * no se le toca nada: tiene que enterarse sola, con su vigilancia, como se
 * enteraria de un `echo` hecho en Git Bash.
 *
 * La OPFS no existe en una pagina abierta como `file://`, asi que para esto la
 * pagina se sirve por `http://localhost`. Abierta como archivo se comprueba
 * aparte que el navegador ofrezca elegir carpetas y que el boton este.
 *
 * Deja sus resultados en `docs/poc-repositorio-real/navegador-<sistema>-<canal>.md`.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ordenPara } from '../../cypress/soporte/ordenes';
import { AVISOS_DE_PREPARAR, CLON, correr, guion, LABORATORIOS, preparar } from '../real/laboratorio';
import { lineas, porcelana } from '../real/repos';

const CANAL = process.env.CANAL ?? 'chrome';
/** `PAGINA` permite correr las pruebas contra otra version, para verlas fallar antes (SPEC 024, CA6). */
const PAGINA = process.env.PAGINA ?? join(CLON, 'SIMULADOR.html');
const PUERTO = 5741;
const informe: string[] = [];
const fallas: string[] = [];
const montados: string[] = [];
let navegador: Browser;
let servidor: Server;

function anotar(texto: string): void {
  informe.push(texto);
}

function comprobar(bien: boolean, texto: string): void {
  anotar(`${bien ? 'IGUAL   ' : 'DISTINTO'} ${texto}`);
  if (!bien) fallas.push(texto);
}

// --- La carpeta, copiada a la OPFS -------------------------------------------

/** Cada archivo y carpeta del repositorio, con la huella de su contenido. */
type Foto = Map<string, string>;

function fotografiar(dir: string): Foto {
  const foto: Foto = new Map();
  const recorrer = (carpeta: string): void => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const completa = join(carpeta, entrada.name);
      const ruta = relative(dir, completa).split(sep).join('/');
      if (entrada.isDirectory()) {
        foto.set(`${ruta}/`, 'carpeta');
        recorrer(completa);
      } else {
        foto.set(ruta, createHash('sha1').update(readFileSync(completa)).digest('hex'));
      }
    }
  };
  recorrer(dir);
  return foto;
}

/** Copia a la OPFS, desde la pestaña del disco, lo que cambio desde la foto anterior, y borra lo que ya no esta. */
async function sincronizar(disco: Page, nombre: string, dir: string, antes: Foto | null): Promise<Foto> {
  const ahora = fotografiar(dir);
  const escribir = [...ahora]
    .filter(([ruta, huella]) => antes?.get(ruta) !== huella)
    .map(([ruta]) =>
      ruta.endsWith('/')
        ? { ruta: ruta.slice(0, -1).split('/'), carpeta: true, b64: '' }
        : { ruta: ruta.split('/'), carpeta: false, b64: readFileSync(join(dir, ...ruta.split('/'))).toString('base64') },
    );
  const borrar =
    antes === null
      ? []
      : [...antes.keys()]
          .filter((ruta) => !ahora.has(ruta))
          .map((ruta) => ruta.replace(/\/$/, '').split('/'))
          .sort((a, b) => b.length - a.length);
  await disco.evaluate(
    async ({ nombre, escribir, borrar }) => {
      const raiz = await (await navigator.storage.getDirectory()).getDirectoryHandle(nombre, { create: true });
      const carpeta = async (partes: readonly string[]): Promise<FileSystemDirectoryHandle> => {
        let actual = raiz;
        for (const parte of partes) actual = await actual.getDirectoryHandle(parte, { create: true });
        return actual;
      };
      for (const ruta of borrar) {
        try {
          await (await carpeta(ruta.slice(0, -1))).removeEntry(ruta.at(-1) ?? '', { recursive: true });
        } catch {
          // Ya se borro con su carpeta.
        }
      }
      for (const { ruta, carpeta: esCarpeta, b64 } of escribir) {
        if (esCarpeta) {
          await carpeta(ruta);
          continue;
        }
        const archivo = await (await carpeta(ruta.slice(0, -1))).getFileHandle(ruta.at(-1) ?? '', { create: true });
        const escritor = await archivo.createWritable();
        await escritor.write(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
        await escritor.close();
      }
    },
    { nombre, escribir, borrar },
  );
  return ahora;
}

interface Conectada {
  readonly contexto: BrowserContext;
  readonly pagina: Page;
  /** La otra pestaña, que hace de disco: lo que cambia en la carpeta lo cambia ella. */
  readonly disco: Page;
  readonly foto: Foto;
  readonly ms: number;
  readonly errores: string[];
}

/** Un navegador limpio con la pagina abierta y la pestaña del disco al lado. */
async function abrirContexto(opciones: { sinAlmacenamiento?: boolean; perfilNormal?: boolean } = {}): Promise<{
  contexto: BrowserContext;
  pagina: Page;
  disco: Page;
  errores: string[];
}> {
  // `newContext` es un perfil de incognito. Recordar la carpeta necesita un
  // perfil normal, como el del alumno: en incognito, leer el manejador
  // guardado cierra la pestaña (ver src/real/recordar.ts).
  const ventana = { viewport: { width: 1600, height: 1000 } };
  const contexto = opciones.perfilNormal
    ? await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'perfil-')), {
        ...(CANAL === 'chromium' ? {} : { channel: CANAL }),
        ...ventana,
      })
    : await navegador.newContext(ventana);
  const pagina = await contexto.newPage();
  const errores: string[] = [];
  pagina.on('pageerror', (error) => errores.push(error.message));
  if (opciones.sinAlmacenamiento) {
    // El navegador sin IndexedDB, como una ventana que lo tiene bloqueado (SPEC 024, 4.2).
    await pagina.addInitScript(() => Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }));
  }
  await pagina.goto(`http://localhost:${PUERTO}/`);
  const disco = await contexto.newPage();
  await disco.goto(`http://localhost:${PUERTO}/disco`);
  return { contexto, pagina, disco, errores };
}

/** Lo unico que no es el camino de siempre: el dialogo, que no se puede apretar (punto 5.2 del SPEC 020). */
async function entregarCarpeta(pagina: Page, nombre: string): Promise<void> {
  await pagina.evaluate((nombre) => {
    const ventana = window as { eleccionesDeCarpeta?: number };
    ventana.eleccionesDeCarpeta = 0;
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => {
        ventana.eleccionesDeCarpeta = (ventana.eleccionesDeCarpeta ?? 0) + 1;
        return (await navigator.storage.getDirectory()).getDirectoryHandle(nombre);
      },
    });
  }, nombre);
}

async function esperarConexion(pagina: Page): Promise<void> {
  await pagina.waitForSelector('[data-prueba="avisos-repositorio"]', { timeout: 20_000 });
  await pagina.waitForFunction(() => document.documentElement.dataset.vueltas !== undefined, null, { timeout: 20_000 });
}

/** Abre la pagina, le copia el repositorio y aprieta «conectar a mi repositorio». */
async function conectar(nombre: string, dir: string, opciones: { perfilNormal?: boolean } = {}): Promise<Conectada> {
  const { contexto, pagina, disco, errores } = await abrirContexto(opciones);
  const foto = await sincronizar(disco, nombre, dir, null);
  await entregarCarpeta(pagina, nombre);
  const inicio = Date.now();
  await pagina.click('[data-prueba="conectar-repositorio"]');
  await esperarConexion(pagina);
  if (errores.length > 0) throw new Error(`errores en la pagina: ${errores.join('; ')}`);
  return { contexto, pagina, disco, foto, ms: Date.now() - inicio, errores };
}

/** Espera dos vueltas completas del sondeo: la segunda empezo con todo ya copiado. */
async function esperarVueltas(pagina: Page): Promise<void> {
  const ahora = Number(await pagina.evaluate(() => document.documentElement.dataset.vueltas ?? '0'));
  await pagina.waitForFunction(
    (desde) => Number(document.documentElement.dataset.vueltas ?? '0') >= desde + 2,
    ahora,
    { timeout: 20_000, polling: 25 },
  );
}

// --- Lo que la pagina muestra sola (SPEC 024) ---------------------------------

async function areaDe(pagina: Page, clave: string): Promise<string[]> {
  return pagina.$$eval(`section[data-columna="${clave}"] li[data-archivo]`, (lis) =>
    lis.map((li) => `${(li as HTMLElement).dataset.archivo}:${(li as HTMLElement).dataset.tono}`).sort(),
  );
}

/**
 * Espera a que un area muestre exactamente lo esperado y dice cuanto tardo,
 * en milisegundos, o infinito si en cinco segundos no lo mostro. Solo mira:
 * no le avisa nada a la pagina.
 */
async function esperarArea(pagina: Page, clave: string, esperado: readonly string[]): Promise<number> {
  const inicio = Date.now();
  try {
    await pagina.waitForFunction(
      ({ clave, esperado }) => {
        const hay = [...document.querySelectorAll<HTMLLIElement>(`section[data-columna="${clave}"] li[data-archivo]`)]
          .map((li) => `${li.dataset.archivo}:${li.dataset.tono}`)
          .sort();
        return JSON.stringify(hay) === JSON.stringify(esperado);
      },
      { clave, esperado: [...esperado].sort() },
      { timeout: 5_000, polling: 10 },
    );
    return Date.now() - inicio;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

async function estadoDelIndicador(pagina: Page): Promise<{ estado: string; texto: string }> {
  return pagina.evaluate(() => {
    const indicador = document.querySelector<HTMLElement>('[data-prueba="indicador-conexion"]');
    return { estado: indicador?.dataset.estado ?? 'sin indicador', texto: indicador?.textContent?.trim() ?? '' };
  });
}

async function esperarIndicador(pagina: Page, estado: string): Promise<{ estado: string; texto: string }> {
  await pagina
    .waitForFunction(
      (estado) => document.querySelector<HTMLElement>('[data-prueba="indicador-conexion"]')?.dataset.estado === estado,
      estado,
      { timeout: 5_000, polling: 20 },
    )
    .catch(() => null);
  return estadoDelIndicador(pagina);
}

async function esperarUnMomento(pagina: Page): Promise<void> {
  await pagina.waitForTimeout(1_000);
}

/** El modo de escenarios sigue entero: una orden en la consola cambia el escenario. */
async function escenarioFunciona(pagina: Page): Promise<boolean> {
  const antes = await pagina.$$eval('section[aria-label="Consola"] [data-color]', (r) => r.length);
  await pagina.fill('[data-prueba="entrada-consola"]', 'git status');
  await pagina.press('[data-prueba="entrada-consola"]', 'Enter');
  await pagina.waitForTimeout(200);
  const despues = await pagina.$$eval('section[aria-label="Consola"] [data-color]', (r) => r.length);
  return despues > antes + 1;
}

/** Lo que imprime una orden, o vacio si falla (por ejemplo `git rev-parse HEAD` antes de la primera confirmacion). */
function spawnSyncTexto(orden: string, args: string[], cwd: string): string {
  try {
    return execFileSync(orden, args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}

// --- Lo que se compara ---------------------------------------------------------

interface Vista {
  readonly vivas: readonly string[];
  readonly ramas: readonly string[];
  readonly remotas: readonly string[];
  readonly etiquetas: readonly string[];
  readonly trabajo: readonly string[];
  readonly preparacion: readonly string[];
  readonly posicion: string;
}

async function loQueMuestra(pagina: Page): Promise<Vista> {
  return pagina.evaluate(() => {
    const nodos = [...document.querySelectorAll<SVGGElement>('g[data-confirmacion]')];
    const etiquetas = [...document.querySelectorAll<SVGGElement>('g[data-etiqueta]')];
    const de = (forma: string): string[] =>
      etiquetas
        .filter((e) => e.dataset.forma === forma)
        .map((e) => `${e.dataset.etiqueta} ${e.dataset.en}`)
        .sort();
    const area = (clave: string): string[] =>
      [...document.querySelectorAll<HTMLLIElement>(`section[data-columna="${clave}"] li[data-archivo]`)]
        .map((li) => `${li.dataset.archivo}:${li.dataset.tono}`)
        .sort();
    const puntero = etiquetas.find((e) => e.dataset.forma === 'puntero');
    const actual = etiquetas.find((e) => e.dataset.forma === 'rama' && e.dataset.actual === 'si');
    // Antes de la primera confirmacion el grafo no tiene donde poner la rama: la dice la barra.
    const barra = document.querySelector('[data-prueba="rama-actual"]')?.textContent?.trim() ?? '';
    return {
      vivas: nodos
        .filter((n) => n.dataset.huerfana === 'no' && n.dataset.previsualizada === 'no')
        .map((n) => n.dataset.confirmacion ?? '')
        .sort(),
      ramas: de('rama'),
      remotas: de('remota'),
      etiquetas: de('version'),
      trabajo: area('trabajo'),
      preparacion: area('preparacion'),
      posicion:
        nodos.length === 0
          ? `rama ${barra}`
          : actual === undefined
            ? `separada ${puntero?.dataset.en ?? ''}`
            : `rama ${actual.dataset.etiqueta}`,
    };
  });
}

function loQueDiceGit(dir: string): Vista {
  const g = (...args: string[]): string =>
    execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } }).toString();
  const corto = (sha: string): string => sha.slice(0, 7);
  const refs = (carpeta: string): string[] =>
    lineas(g('for-each-ref', '--format=%(refname:strip=2) %(objectname) %(symref)', `refs/${carpeta}`))
      .map((l) => l.split(' '))
      .filter(([nombre, , symref]) => symref === '' || !nombre?.endsWith('/HEAD'))
      .map(([nombre, sha]) => `${nombre} ${corto(sha ?? '')}`)
      .sort();
  const etiquetas = lineas(g('for-each-ref', '--format=%(refname:strip=2)', 'refs/tags'))
    .map((nombre) => `${nombre} ${corto(g('rev-parse', `${nombre}^{commit}`).trim())}`)
    .sort();
  const trabajo: string[] = [];
  const preparacion: string[] = [];
  for (const linea of porcelana(dir)) {
    const x = linea[0] ?? ' ';
    const y = linea[1] ?? ' ';
    const resto = linea.slice(3);
    const ruta = resto.includes(' -> ') ? (resto.split(' -> ')[1] ?? '') : resto;
    if (x === '?') trabajo.push(`${ruta}:nuevo`);
    else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) trabajo.push(`${ruta}:conflicto`);
    else {
      if (x === 'D') preparacion.push(`${ruta}:borrado-preparado`);
      else if (x === 'R') preparacion.push(`${resto}:preparado`);
      else if (x !== ' ') preparacion.push(`${ruta}:preparado`);
      if (y === 'M') trabajo.push(`${ruta}:modificado`);
      else if (y === 'D') trabajo.push(`${ruta}:borrado-pendiente`);
      else if (y === 'A') trabajo.push(`${ruta}:nuevo`);
    }
  }
  let rama = '';
  try {
    rama = g('symbolic-ref', '-q', '--short', 'HEAD').trim();
  } catch {
    rama = '';
  }
  // Antes de la primera confirmacion HEAD no apunta a nada, y `git log HEAD` falla.
  const hayCabeza = spawnSyncTexto('git', ['rev-parse', '-q', '--verify', 'HEAD'], dir) !== '';
  const vivas = lineas(g('log', '--branches', '--tags', '--remotes', ...(hayCabeza ? ['HEAD'] : []), '--format=%H')).map(corto);
  return {
    // El grafo dibuja hasta cuarenta confirmaciones.
    vivas: vivas.length > 40 ? [`${vivas.length} confirmaciones`] : vivas.sort(),
    ramas: refs('heads'),
    remotas: refs('remotes'),
    etiquetas,
    trabajo: trabajo.sort(),
    preparacion: preparacion.sort(),
    posicion: rama === '' ? `separada ${corto(g('rev-parse', 'HEAD').trim())}` : `rama ${rama}`,
  };
}

function diferencias(pagina: Vista, git: Vista): string[] {
  const vistas = { ...pagina, vivas: git.vivas[0]?.endsWith('confirmaciones') ? git.vivas : pagina.vivas };
  return (Object.keys(git) as (keyof Vista)[])
    .filter((clave) => JSON.stringify(vistas[clave]) !== JSON.stringify(git[clave]))
    .map((clave) => `${clave}: pagina ${JSON.stringify(vistas[clave])}, git ${JSON.stringify(git[clave])}`);
}

// --- Las pruebas ---------------------------------------------------------------

beforeAll(async () => {
  navegador = await chromium.launch(CANAL === 'chromium' ? {} : { channel: CANAL });
  servidor = createServer((pedido, respuesta) => {
    respuesta.setHeader('content-type', 'text/html; charset=utf-8');
    // La pestaña del disco: una pagina vacia del mismo origen, que comparte la OPFS.
    if (pedido.url === '/disco') respuesta.end('<!doctype html><title>disco</title>');
    else respuesta.end(readFileSync(PAGINA));
  }).listen(PUERTO);
  anotar(`# El modo real en ${CANAL} sobre ${process.platform}`);
  anotar('');
  anotar(`- Sistema: ${process.platform} · Git: ${execFileSync('git', ['--version']).toString().trim()} · Navegador: ${CANAL} ${navegador.version()}`);
  anotar(`- Huella SHA-256 de SIMULADOR.html: ${createHash('sha256').update(readFileSync(PAGINA)).digest('hex')}`);
  anotar('- La carpeta se entrega por programa: se copia a la OPFS y se reemplaza showDirectoryPicker (punto 5.2).');
  anotar('');
  anotar('```');
});

afterAll(async () => {
  anotar('```');
  anotar('');
  for (const aviso of AVISOS_DE_PREPARAR) anotar(`- preparar.sh fallo con el repositorio armado: ${aviso}`);
  anotar('');
  anotar(fallas.length === 0 ? 'RESULTADO: todo igual' : `RESULTADO: ${fallas.length} diferencia(s)`);
  await navegador?.close();
  servidor?.close();
  for (const raiz of montados) rmSync(raiz, { recursive: true, force: true });
  const destino = join(CLON, 'docs', 'poc-repositorio-real');
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, `navegador-${process.platform}-${CANAL}.md`), `${informe.join('\n')}\n`);
});

describe(`el modo real en ${CANAL}`, () => {
  it('abierta con doble clic, la pagina ofrece conectar la carpeta, y sin la API lo dice en una linea (2.1, CA5)', async () => {
    const pagina = await navegador.newPage();
    await pagina.goto(pathToFileURL(PAGINA).href);
    const datos = await pagina.evaluate(() => ({
      seguro: isSecureContext,
      selector: typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
      boton: document.querySelector('[data-prueba="conectar-repositorio"]')?.textContent ?? '',
    }));
    comprobar(datos.seguro && datos.selector, `file:// · contexto seguro ${datos.seguro} · permite elegir carpetas ${datos.selector}`);
    comprobar(datos.boton.includes('conectar a mi repositorio'), `file:// · el boton dice «${datos.boton}»`);
    await pagina.evaluate(() => Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined }));
    await pagina.click('[data-prueba="conectar-repositorio"]');
    const aviso = (await pagina.textContent('[data-prueba="aviso-conexion"]')) ?? '';
    comprobar(/no deja abrir una carpeta/.test(aviso), `sin la API · la pagina dice «${aviso}»`);
    await pagina.close();
  });

  it('cada repositorio de prueba se dibuja como lo ve Git (CA1)', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'navegador-real-'));
    montados.push(raiz);
    execFileSync('bash', [join(CLON, 'simulador', 'tests', 'real', 'armar-sonda.sh')], { cwd: raiz, stdio: 'ignore' });
    execFileSync('bash', [join(CLON, 'simulador', 'tests', 'real', 'armar-bordes.sh'), join(raiz, 'bordes')], { stdio: 'ignore' });
    const repos = [
      ...['lineal', 'ramas', 'empaquetado', 'deltas', 'desde-bundle', 'desconectada', 'empates'].map((n) => join(raiz, 'pruebas', n)),
      ...['estados', 'conflicto', 'completo', 'clonado', 'latin', 'indice4'].map((n) => join(raiz, 'bordes', n)),
    ];
    for (const dir of repos) {
      const nombre = dir.split(sep).at(-1) ?? '';
      const { contexto, pagina, ms } = await conectar(nombre, dir);
      await esperarVueltas(pagina);
      const distintas = diferencias(await loQueMuestra(pagina), loQueDiceGit(dir));
      comprobar(distintas.length === 0, `${nombre.padEnd(14)} conectado y dibujado en ${ms} ms${distintas.length === 0 ? '' : ` · ${distintas.join(' · ')}`}`);
      await contexto.close();
    }
  });

  it.each(LABORATORIOS)(
    'laboratorio %s: despues de cada orden del guion hecha en Git, la pagina muestra lo mismo que Git (CA2, CA3)',
    async (numero) => {
      const { ordenes } = guion(numero);
      const lab = preparar(numero);
      montados.push(lab.raiz);
      const conexion = await conectar('recetario', lab.recetario);
      const { pagina, disco } = conexion;
      let foto = conexion.foto;
      await esperarVueltas(pagina);
      const salidas = new Map<string, string>();
      let iguales = 0;
      const demoras: number[] = [];
      const distintas: string[] = [];
      for (const orden of ordenes) {
        const eleccion = orden.eleccion;
        const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
        const cabezaAntes = execFileSync('git', ['rev-parse', '-q', '--verify', 'HEAD'], { cwd: lab.recetario }).toString().trim();
        const { salida } = correr(lab, ordenPara(orden, identificador));
        salidas.set(orden.texto, salida);
        foto = await sincronizar(disco, 'recetario', lab.recetario, foto);
        const copiado = Date.now();
        const cabeza = execFileSync('git', ['rev-parse', '-q', '--verify', 'HEAD'], { cwd: lab.recetario }).toString().trim();
        if (cabeza !== cabezaAntes) {
          // CA3: la confirmacion nueva aparece, con el mismo identificador, en menos de un segundo.
          await pagina.waitForFunction(
            (id) => document.querySelector(`g[data-confirmacion="${id}"][data-previsualizada="no"]`) !== null,
            cabeza.slice(0, 7),
            { timeout: 10_000, polling: 20 },
          );
          demoras.push(Date.now() - copiado);
        }
        await esperarVueltas(pagina);
        const d = diferencias(await loQueMuestra(pagina), loQueDiceGit(lab.recetario));
        if (d.length === 0) iguales += 1;
        else distintas.push(`linea ${orden.linea} «${orden.texto}»: ${d.join(' · ')}`);
      }
      const vigilancia = await pagina.evaluate(() => document.documentElement.dataset.vigilancia ?? 'sin medir');
      const lectura = await pagina.getAttribute('[data-prueba="tiempo-lectura"]', 'title');
      anotar(`MEDIDA   lab ${numero}: una vuelta de vigilancia ${vigilancia}; la ultima lectura ${lectura}`);
      await conexion.contexto.close();
      const maxima = demoras.length === 0 ? 0 : Math.max(...demoras);
      comprobar(
        distintas.length === 0,
        `lab ${numero}: ${iguales} de ${ordenes.length} ordenes iguales${distintas.length === 0 ? '' : `\n    ${distintas.join('\n    ')}`}`,
      );
      comprobar(
        maxima < 1000,
        `lab ${numero}: ${demoras.length} confirmaciones nuevas vistas en la pagina, demora maxima ${maxima} ms, media ${
          demoras.length === 0 ? 0 : Math.round(demoras.reduce((a, b) => a + b, 0) / demoras.length)
        } ms`,
      );
    },
  );

  // --- SPEC 024: el modo conectado, listo para clase ---------------------------

  it('SPEC 024, 2.4 y CA2: un archivo nuevo, modificado o borrado sin tocar Git aparece solo, en menos de un segundo; lo ignorado no', async () => {
    const lab = preparar('02');
    montados.push(lab.raiz);
    const dir = lab.recetario;
    const c = await conectar('recetario', dir);
    let foto = c.foto;
    await esperarVueltas(c.pagina);
    const seguidos = lineas(execFileSync('git', ['ls-files'], { cwd: dir }).toString()).filter((r) => !r.includes('/'));
    const [modificar, borrar] = seguidos.filter((r) => r !== '.gitignore');
    if (modificar === undefined || borrar === undefined) throw new Error('el laboratorio 02 no tiene dos archivos seguidos en la raiz');
    const casos: [string, () => void][] = [
      ['un archivo nuevo', () => writeFileSync(join(dir, 'nuevo-sin-git.md'), 'hola\n')],
      [`${modificar} modificado`, () => appendFileSync(join(dir, modificar), 'una linea mas, sin Git\n')],
      [`${borrar} borrado`, () => rmSync(join(dir, borrar))],
      ['una regla nueva en .gitignore', () => appendFileSync(join(dir, '.gitignore'), '*.tmp\n')],
    ];
    const demoras: number[] = [];
    for (const [nombre, hacer] of casos) {
      hacer();
      const esperado = loQueDiceGit(dir).trabajo;
      foto = await sincronizar(c.disco, 'recetario', dir, foto);
      const ms = await esperarArea(c.pagina, 'trabajo', esperado);
      demoras.push(ms);
      const lectura = await c.pagina.getAttribute('[data-prueba="tiempo-lectura"]', 'title');
      anotar(`MEDIDA   SPEC 024 · ${nombre}: la lectura que lo trajo, por partes: ${lectura}`);
      comprobar(ms < 1000, `SPEC 024 · ${nombre}: la pagina lo mostro sola en ${ms === Number.POSITIVE_INFINITY ? 'mas de 5000' : ms} ms · ${JSON.stringify(esperado)}`);
    }

    // Lo ignorado no aparece, y ni siquiera hace releer: el vigia respeta el .gitignore.
    await esperarVueltas(c.pagina);
    const lecturas = await c.pagina.getAttribute('[data-prueba="avisos-repositorio"]', 'data-lecturas');
    writeFileSync(join(dir, 'borrador.tmp'), 'nadie lo sigue\n');
    mkdirSync(join(dir, 'construido.tmp'));
    writeFileSync(join(dir, 'construido.tmp', 'salida.txt'), 'x\n');
    foto = await sincronizar(c.disco, 'recetario', dir, foto);
    await esperarVueltas(c.pagina);
    await esperarVueltas(c.pagina);
    const despues = await c.pagina.getAttribute('[data-prueba="avisos-repositorio"]', 'data-lecturas');
    comprobar(
      lecturas !== null && despues === lecturas,
      `SPEC 024 · un archivo y una carpeta ignorados no hacen releer: lecturas antes ${lecturas}, despues ${despues}`,
    );
    const distintas = diferencias(await loQueMuestra(c.pagina), loQueDiceGit(dir));
    comprobar(distintas.length === 0, `SPEC 024 · al final, la pagina y Git dicen lo mismo${distintas.length === 0 ? '' : ` · ${distintas.join(' · ')}`}`);
    const costo = await c.pagina.evaluate(() => document.documentElement.dataset.vigilancia ?? 'sin medir');
    anotar(`MEDIDA   SPEC 024 · costo de una vuelta de vigilancia en el laboratorio 02: ${costo}`);
    anotar(`MEDIDA   SPEC 024 · demoras de los archivos: ${demoras.join(', ')} ms`);
    await c.contexto.close();
  });

  it('SPEC 024, 3.1 y 3.2: una carpeta sin repositorio se acepta, muestra sus archivos sueltos y empieza a dibujar sola con git init', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'sin-repositorio-'));
    montados.push(raiz);
    const dir = join(raiz, 'recetario');
    mkdirSync(dir);
    writeFileSync(join(dir, 'notas.txt'), 'antes de git init\n');
    const c = await conectar('recetario', dir);
    const indicador = await estadoDelIndicador(c.pagina);
    comprobar(indicador.estado === 'sin-repositorio', `SPEC 024 · carpeta sin .git: el indicador dice «${indicador.texto}» (${indicador.estado})`);
    const aviso = (await c.pagina.textContent('[data-prueba="avisos-repositorio"]')) ?? '';
    comprobar(/todavía no es un repositorio/.test(aviso), `SPEC 024 · carpeta sin .git: el aviso dice «${aviso.trim()}»`);
    const sueltos = await areaDe(c.pagina, 'trabajo');
    comprobar(JSON.stringify(sueltos) === JSON.stringify(['notas.txt:suelto']), `SPEC 024 · el archivo se ve suelto, sin Git: ${JSON.stringify(sueltos)}`);

    execFileSync('git', ['init', '-q'], { cwd: dir });
    await sincronizar(c.disco, 'recetario', dir, c.foto);
    const ms = await esperarArea(c.pagina, 'trabajo', ['notas.txt:nuevo']);
    comprobar(ms < 1000, `SPEC 024 · despues de git init, la pagina dibuja sola en ${ms === Number.POSITIVE_INFINITY ? 'mas de 5000' : ms} ms`);
    const ahora = await estadoDelIndicador(c.pagina);
    comprobar(ahora.estado === 'en-vivo', `SPEC 024 · despues de git init el indicador dice «${ahora.texto}»`);
    await c.contexto.close();
  });

  it('SPEC 024, CA3: el laboratorio 01 completo, desde la carpeta vacia, sin elegir la carpeta dos veces', async () => {
    const raiz = mkdtempSync(join(tmpdir(), 'lab-01-'));
    montados.push(raiz);
    const recetario = join(raiz, 'taller-git-trabajo', 'lab-01', 'recetario');
    mkdirSync(recetario, { recursive: true });
    const configGlobal = join(raiz, 'gitconfig-de-mentira');
    writeFileSync(configGlobal, '');
    const lab = { raiz, recetario, configGlobal };
    const { ordenes } = guion('01');
    const inicio = ordenes.findIndex((o) => o.texto === 'git init');
    // Llegar a la carpeta ya esta hecho: la carpeta existe y esta vacia.
    const llegar = (texto: string, k: number): boolean => k < inicio && /^(cd |mkdir )/.test(texto);

    const c = await conectar('recetario', recetario);
    const { pagina, disco } = c;
    let foto = c.foto;
    const antes = await estadoDelIndicador(pagina);
    comprobar(antes.estado === 'sin-repositorio', `lab 01 · antes de git init el indicador dice «${antes.texto}»`);

    const salidas = new Map<string, string>();
    let iguales = 0;
    let recorridas = 0;
    const distintas: string[] = [];
    for (const [k, orden] of ordenes.entries()) {
      if (llegar(orden.texto, k)) continue;
      recorridas += 1;
      const eleccion = orden.eleccion;
      const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
      const cabeza = (): string => spawnSyncTexto('git', ['rev-parse', '-q', '--verify', 'HEAD'], recetario);
      const cabezaAntes = cabeza();
      const { salida } = correr(lab, ordenPara(orden, identificador));
      salidas.set(orden.texto, salida);
      foto = await sincronizar(disco, 'recetario', recetario, foto);
      const cabezaDespues = cabeza();
      if (cabezaDespues !== '' && cabezaDespues !== cabezaAntes) {
        await pagina.waitForFunction(
          (id) => document.querySelector(`g[data-confirmacion="${id}"][data-previsualizada="no"]`) !== null,
          cabezaDespues.slice(0, 7),
          { timeout: 10_000, polling: 20 },
        );
      }
      await esperarVueltas(pagina);
      if (k < inicio) {
        const indicador = await estadoDelIndicador(pagina);
        if (indicador.estado === 'sin-repositorio') iguales += 1;
        else distintas.push(`linea ${orden.linea} «${orden.texto}»: sin repositorio, el indicador dice ${indicador.estado}`);
        continue;
      }
      const d = diferencias(await loQueMuestra(pagina), loQueDiceGit(recetario));
      if (d.length === 0) iguales += 1;
      else distintas.push(`linea ${orden.linea} «${orden.texto}»: ${d.join(' · ')}`);
    }
    const elecciones = await pagina.evaluate(() => (window as { eleccionesDeCarpeta?: number }).eleccionesDeCarpeta ?? 0);
    comprobar(
      distintas.length === 0,
      `lab 01 · desde la carpeta vacia: ${iguales} de ${recorridas} ordenes iguales${distintas.length === 0 ? '' : `\n    ${distintas.join('\n    ')}`}`,
    );
    comprobar(elecciones === 1, `lab 01 · la carpeta se eligio ${elecciones} vez/veces`);
    await c.contexto.close();
  });

  it('SPEC 024, 1.4: si una politica bloquea el acceso a carpetas, el boton lo dice en una linea y los escenarios siguen', async () => {
    for (const falla of ['SecurityError', 'NotAllowedError']) {
      const { contexto, pagina, errores } = await abrirContexto();
      await pagina.evaluate((falla) => {
        Object.defineProperty(window, 'showDirectoryPicker', {
          configurable: true,
          value: async () => {
            throw new DOMException('Access to the file system is blocked by policy', falla);
          },
        });
      }, falla);
      await pagina.click('[data-prueba="conectar-repositorio"]');
      await pagina.waitForSelector('[data-prueba="aviso-conexion"]', { timeout: 5_000 }).catch(() => null);
      const aviso = ((await pagina.textContent('[data-prueba="aviso-conexion"]').catch(() => null)) ?? '').trim();
      comprobar(
        /no permite que el navegador abra carpetas/.test(aviso) && /escenarios siguen funcionando/.test(aviso),
        `SPEC 024 · ${falla}: el boton dice «${aviso}»`,
      );
      comprobar(await escenarioFunciona(pagina), `SPEC 024 · ${falla}: el escenario sigue ejecutando ordenes`);
      comprobar(errores.length === 0, `SPEC 024 · ${falla}: sin errores en la pagina ${JSON.stringify(errores)}`);
      await contexto.close();
    }
  });

  it('SPEC 024, 4.1 y CA4: al recargar, la carpeta se reconecta con un clic', async () => {
    const lab = preparar('02');
    montados.push(lab.raiz);
    const c = await conectar('recetario', lab.recetario, { perfilNormal: true });
    await esperarVueltas(c.pagina);
    await c.pagina.reload();
    // Despues de recargar no hay reemplazo del dialogo: si la pagina lo abriera, la prueba se colgaria.
    const boton = await c.pagina.waitForSelector('[data-prueba="reconectar-repositorio"]', { timeout: 5_000 }).catch(() => null);
    const texto = ((await boton?.textContent()) ?? '').trim();
    comprobar(boton !== null && texto.includes('recetario'), `SPEC 024 · al recargar se ofrece «${texto}»`);
    if (boton !== null) {
      await boton.click();
      await esperarConexion(c.pagina);
      await esperarVueltas(c.pagina);
      const indicador = await estadoDelIndicador(c.pagina);
      const distintas = diferencias(await loQueMuestra(c.pagina), loQueDiceGit(lab.recetario));
      comprobar(
        indicador.estado === 'en-vivo' && distintas.length === 0,
        `SPEC 024 · un clic y queda conectada: «${indicador.texto}»${distintas.length === 0 ? '' : ` · ${distintas.join(' · ')}`}`,
      );
    }
    await c.contexto.close();
  });

  it('SPEC 024, 4: en incognito, recargar no lee el manejador guardado, y el navegador sigue vivo', async () => {
    // En un perfil de incognito, leer de IndexedDB un manejador de la OPFS
    // cierra el navegador entero (ver src/real/recordar.ts). Recargar no puede
    // hacerlo: al cargar se lee solo el nombre.
    const lab = preparar('02');
    montados.push(lab.raiz);
    const c = await conectar('recetario', lab.recetario);
    await esperarVueltas(c.pagina);
    let caido = false;
    navegador.once('disconnected', () => {
      caido = true;
    });
    await c.pagina.reload({ timeout: 5_000 }).catch(() => null);
    const boton = await c.pagina.waitForSelector('[data-prueba="reconectar-repositorio"]', { timeout: 5_000 }).catch(() => null);
    const texto = caido ? '' : ((await boton?.textContent()) ?? '').trim();
    comprobar(
      !caido && texto.includes('recetario'),
      `SPEC 024 · incognito: al recargar el navegador ${caido ? 'se cayo' : 'sigue vivo'} y ofrece «${texto}»`,
    );
    if (!caido) await c.contexto.close();
  });

  it('SPEC 024, 4.2: sin almacenamiento, la pagina funciona igual y solo pide la carpeta de nuevo', async () => {
    const lab = preparar('02');
    montados.push(lab.raiz);
    const { contexto, pagina, disco, errores } = await abrirContexto({ sinAlmacenamiento: true });
    await sincronizar(disco, 'recetario', lab.recetario, null);
    await entregarCarpeta(pagina, 'recetario');
    await pagina.click('[data-prueba="conectar-repositorio"]');
    await esperarConexion(pagina);
    await esperarVueltas(pagina);
    const distintas = diferencias(await loQueMuestra(pagina), loQueDiceGit(lab.recetario));
    comprobar(distintas.length === 0, `SPEC 024 · sin IndexedDB, conectada y dibujada igual que Git${distintas.length === 0 ? '' : ` · ${distintas.join(' · ')}`}`);
    await pagina.reload();
    await pagina.waitForSelector('[data-prueba="conectar-repositorio"]');
    await esperarUnMomento(pagina);
    const reconectar = await pagina.$('[data-prueba="reconectar-repositorio"]');
    const boton = ((await pagina.textContent('[data-prueba="conectar-repositorio"]')) ?? '').trim();
    comprobar(
      reconectar === null && boton.includes('conectar a mi repositorio') && errores.length === 0,
      `SPEC 024 · sin IndexedDB, al recargar se pide la carpeta de nuevo: «${boton}», errores ${JSON.stringify(errores)}`,
    );
    await contexto.close();
  });

  it('SPEC 024, 5.1: la barra dice a que carpeta mira y que lee en vivo, y avisa si la carpeta o el permiso se pierden', async () => {
    const lab = preparar('02');
    montados.push(lab.raiz);
    const c = await conectar('recetario', lab.recetario);
    await esperarVueltas(c.pagina);
    const vivo = await estadoDelIndicador(c.pagina);
    comprobar(
      vivo.estado === 'en-vivo' && vivo.texto.includes('recetario') && /en vivo/.test(vivo.texto),
      `SPEC 024 · conectada: el indicador dice «${vivo.texto}»`,
    );

    // El permiso retirado: el navegador contesta que ya no lo concede.
    await c.pagina.evaluate(() => {
      const prototipo = FileSystemHandle.prototype as unknown as { queryPermission: unknown; original?: unknown };
      prototipo.original = prototipo.queryPermission;
      prototipo.queryPermission = async () => 'prompt';
    });
    const sinPermiso = await esperarIndicador(c.pagina, 'sin-permiso');
    const reconectar = await c.pagina.$('[data-prueba="reconectar-repositorio"]');
    comprobar(
      sinPermiso.estado === 'sin-permiso' && reconectar !== null,
      `SPEC 024 · sin permiso: el indicador dice «${sinPermiso.texto}» y se ofrece reconectar`,
    );
    await c.pagina.evaluate(() => {
      const prototipo = FileSystemHandle.prototype as unknown as { queryPermission: unknown; original?: unknown };
      prototipo.queryPermission = prototipo.original;
    });
    await reconectar?.click();
    const devuelto = await esperarIndicador(c.pagina, 'en-vivo');
    comprobar(devuelto.estado === 'en-vivo', `SPEC 024 · con un clic vuelve: «${devuelto.texto}»`);

    // La carpeta borrada.
    await c.disco.evaluate(async () => (await navigator.storage.getDirectory()).removeEntry('recetario', { recursive: true }));
    const perdida = await esperarIndicador(c.pagina, 'perdida');
    comprobar(
      perdida.estado === 'perdida' && /ya no existe/.test(perdida.texto),
      `SPEC 024 · carpeta borrada: el indicador dice «${perdida.texto}»`,
    );
    const nodos = await c.pagina.$$eval('g[data-confirmacion]', (n) => n.length);
    comprobar(nodos === 0, `SPEC 024 · carpeta borrada: no queda el dibujo viejo (${nodos} confirmaciones dibujadas)`);
    await c.contexto.close();
  });

  it('SPEC 024, 5.2 y 5.3: la consola dice que previsualiza, y el modo relator y los temas funcionan conectada', async () => {
    const lab = preparar('02');
    montados.push(lab.raiz);
    const c = await conectar('recetario', lab.recetario);
    await esperarVueltas(c.pagina);
    const consola = (await c.pagina.textContent('section[aria-label="Consola"]')) ?? '';
    comprobar(
      /previsualiza/.test(consola) && /no ejecuta/.test(consola) && /Git Bash/.test(consola),
      'SPEC 024 · la consola conectada dice, antes de escribir nada, que previsualiza y no ejecuta',
    );
    const antes = await loQueMuestra(c.pagina);
    await c.pagina.click('button:has-text("modo relator")');
    await c.pagina.click('button[aria-label="Cambiar tema"]');
    await esperarVueltas(c.pagina);
    const tema = await c.pagina.evaluate(() => document.documentElement.dataset.tema);
    const indicador = await estadoDelIndicador(c.pagina);
    const despues = await loQueMuestra(c.pagina);
    comprobar(
      tema === 'claro' && indicador.estado === 'en-vivo' && JSON.stringify(antes) === JSON.stringify(despues),
      `SPEC 024 · modo relator y tema claro conectada: tema ${tema}, indicador «${indicador.texto}», dibujo ${JSON.stringify(antes) === JSON.stringify(despues) ? 'igual' : 'distinto'}`,
    );
    await c.pagina.fill('[data-prueba="entrada-consola"]', 'git status');
    await c.pagina.press('[data-prueba="entrada-consola"]', 'Enter');
    const respuesta = (await c.pagina.textContent('section[aria-label="Consola"]')) ?? '';
    comprobar(/no se ejecuta aquí/.test(respuesta), 'SPEC 024 · Enter en modo relator conectada dice que la orden no se ejecuta aqui');
    await c.contexto.close();
  });

  it('sin diferencias', () => {
    expect(fallas).toEqual([]);
  });
});
