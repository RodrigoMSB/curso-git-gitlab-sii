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
 * La OPFS no existe en una pagina abierta como `file://`, asi que para esto la
 * pagina se sirve por `http://localhost`. Abierta como archivo se comprueba
 * aparte que el navegador ofrezca elegir carpetas y que el boton este.
 *
 * Deja sus resultados en `docs/poc-repositorio-real/navegador-<sistema>-<canal>.md`.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ordenPara } from '../../cypress/soporte/ordenes';
import { CLON, correr, guion, LABORATORIOS, preparar } from '../real/laboratorio';
import { lineas, porcelana } from '../real/repos';

const CANAL = process.env.CANAL ?? 'chrome';
const PAGINA = join(CLON, 'SIMULADOR.html');
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

/** Copia a la OPFS lo que cambio desde la foto anterior, y borra lo que ya no esta. */
async function sincronizar(pagina: Page, nombre: string, dir: string, antes: Foto | null): Promise<Foto> {
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
  await pagina.evaluate(
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

/** Abre la pagina, le copia el repositorio y aprieta «conectar a mi repositorio». */
async function conectar(nombre: string, dir: string): Promise<{ pagina: Page; foto: Foto; ms: number }> {
  const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });
  const errores: string[] = [];
  pagina.on('pageerror', (error) => errores.push(error.message));
  await pagina.goto(`http://localhost:${PUERTO}/`);
  const foto = await sincronizar(pagina, nombre, dir, null);
  await pagina.evaluate((nombre) => {
    // Lo unico que no es el camino de siempre: el dialogo, que no se puede apretar (punto 5.2).
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => (await navigator.storage.getDirectory()).getDirectoryHandle(nombre),
    });
  }, nombre);
  const inicio = Date.now();
  await pagina.click('[data-prueba="conectar-repositorio"]');
  await pagina.waitForSelector('[data-prueba="avisos-repositorio"]', { timeout: 20_000 });
  await pagina.waitForFunction(() => document.documentElement.dataset.vueltas !== undefined, null, { timeout: 20_000 });
  if (errores.length > 0) throw new Error(`errores en la pagina: ${errores.join('; ')}`);
  return { pagina, foto, ms: Date.now() - inicio };
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
      posicion: actual === undefined ? `separada ${puntero?.dataset.en ?? ''}` : `rama ${actual.dataset.etiqueta}`,
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
  const vivas = lineas(g('log', '--branches', '--tags', '--remotes', 'HEAD', '--format=%H')).map(corto);
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
  servidor = createServer((_pedido, respuesta) => {
    respuesta.setHeader('content-type', 'text/html; charset=utf-8');
    respuesta.end(readFileSync(PAGINA));
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
      const { pagina, ms } = await conectar(nombre, dir);
      await esperarVueltas(pagina);
      const distintas = diferencias(await loQueMuestra(pagina), loQueDiceGit(dir));
      comprobar(distintas.length === 0, `${nombre.padEnd(14)} conectado y dibujado en ${ms} ms${distintas.length === 0 ? '' : ` · ${distintas.join(' · ')}`}`);
      await pagina.close();
    }
  });

  it.each(LABORATORIOS)(
    'laboratorio %s: despues de cada orden del guion hecha en Git, la pagina muestra lo mismo que Git (CA2, CA3)',
    async (numero) => {
      const { ordenes } = guion(numero);
      const lab = preparar(numero);
      montados.push(lab.raiz);
      const conexion = await conectar('recetario', lab.recetario);
      const { pagina } = conexion;
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
        foto = await sincronizar(pagina, 'recetario', lab.recetario, foto);
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
      await pagina.close();
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

  it('sin diferencias', () => {
    expect(fallas).toEqual([]);
  });
});
