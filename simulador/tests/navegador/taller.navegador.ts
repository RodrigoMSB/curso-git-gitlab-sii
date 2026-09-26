/**
 * El modo taller en un navegador de verdad (SPEC 026, 5.1 a 5.3).
 *
 * El taller se arranca como lo arranca el alumno (`TALLER.cmd` o
 * `taller.command`), la pagina se abre en Chrome o Edge en la direccion que el
 * programa entrega, y se escriben en su consola, tecla por tecla, todas las
 * ordenes de los ocho laboratorios. Despues de cada orden se compara lo que
 * la pagina muestra contra Git corrido aparte, en la misma carpeta: grafo,
 * ramas, etiquetas, HEAD y las tres areas.
 *
 * Tambien se mira la pantalla como la mira el alumno: el prompt a la vista y
 * sin tapar, la barra con la carpeta, sin lineas de ayuda de mas. De los
 * laboratorios 01 y 02 se guarda una captura por orden.
 *
 * Deja sus resultados en `docs/taller/navegador-<sistema>-<canal>.md`.
 */

import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ordenPara } from '../../cypress/soporte/ordenes';
import { LABORATORIOS, guion } from '../taller/guion';
import { abrirTaller, CLON_REAL, comandoGit, pedir, type Taller, WINDOWS } from '../taller/instalacion';

const CANAL = process.env.CANAL ?? 'chrome';
const CAPTURAS = process.env.CAPTURAS ?? join(CLON_REAL, 'revision-026', 'capturas');
const informe: string[] = [];
const fallas: string[] = [];
let navegador: Browser;
let taller: Taller;
let pagina: Page;

function anotar(texto: string): void {
  informe.push(texto);
}

function comprobar(bien: boolean, texto: string): void {
  anotar(`${bien ? 'IGUAL   ' : 'DISTINTO'} ${texto}`);
  if (!bien) fallas.push(texto);
}

// --- Git, aparte ------------------------------------------------------------------

function gitAparte(dir: string, ...args: string[]): string {
  try {
    const [programa, argumentos] = comandoGit('-c', 'core.quotepath=false', ...args);
    return execFileSync(programa, argumentos, {
      cwd: dir,
      env: { ...taller.env, GIT_OPTIONAL_LOCKS: '0' },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

const lineas = (texto: string): string[] => texto.split('\n').filter((l) => l !== '');

interface Vista {
  readonly repositorio: boolean;
  readonly vivas: readonly string[];
  readonly huerfanas: readonly string[];
  readonly ramas: readonly string[];
  readonly remotas: readonly string[];
  readonly etiquetas: readonly string[];
  readonly trabajo: readonly string[];
  readonly preparacion: readonly string[];
  readonly posicion: string;
}

function loQueDiceGit(dir: string): Vista {
  if (gitAparte(dir, 'rev-parse', '--show-toplevel').trim() === '') {
    return { repositorio: false, vivas: [], huerfanas: [], ramas: [], remotas: [], etiquetas: [], trabajo: [], preparacion: [], posicion: '' };
  }
  const corto = (sha: string): string => sha.slice(0, 7);
  const refs = (carpeta: string): string[] =>
    lineas(gitAparte(dir, 'for-each-ref', '--format=%(refname:strip=2) %(objectname) %(symref)', `refs/${carpeta}`))
      .map((l) => l.split(' '))
      .filter(([nombre, , symref]) => (symref ?? '') === '' || !nombre?.endsWith('/HEAD'))
      .map(([nombre, sha]) => `${nombre} ${corto(sha ?? '')}`)
      .sort();
  const etiquetas = lineas(gitAparte(dir, 'for-each-ref', '--format=%(refname:strip=2)', 'refs/tags'))
    .map((nombre) => `${nombre} ${corto(gitAparte(dir, 'rev-parse', `${nombre}^{commit}`).trim())}`)
    .sort();
  const trabajo: string[] = [];
  const preparacion: string[] = [];
  const trozos = gitAparte(dir, 'status', '--porcelain=v1', '-z', '--untracked-files=normal').split('\0');
  for (let k = 0; k < trozos.length; k += 1) {
    const entrada = trozos[k] ?? '';
    if (entrada.length < 4) continue;
    const x = entrada[0] ?? ' ';
    const y = entrada[1] ?? ' ';
    const ruta = entrada.slice(3);
    let origen = '';
    if (x === 'R' || x === 'C') {
      origen = trozos[k + 1] ?? '';
      k += 1;
    }
    if (x === '?') trabajo.push(`${ruta}:nuevo`);
    else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) trabajo.push(`${ruta}:conflicto`);
    else {
      if (x === 'D') preparacion.push(`${ruta}:borrado-preparado`);
      else if (x === 'R' || x === 'C') preparacion.push(`${origen} -> ${ruta}:preparado`);
      else if (x !== ' ') preparacion.push(`${ruta}:preparado`);
      if (y === 'M' || y === 'T') trabajo.push(`${ruta}:modificado`);
      else if (y === 'D') trabajo.push(`${ruta}:borrado-pendiente`);
      else if (y === 'A') trabajo.push(`${ruta}:nuevo`);
    }
  }
  const rama = gitAparte(dir, 'symbolic-ref', '-q', '--short', 'HEAD').trim();
  const cabeza = gitAparte(dir, 'rev-parse', '-q', '--verify', 'HEAD').trim();
  const vivasTodas = lineas(gitAparte(dir, 'log', '--branches', '--tags', '--remotes', ...(cabeza ? ['HEAD'] : []), '--format=%H')).map(corto);
  const reflog = cabeza ? lineas(gitAparte(dir, 'log', '-g', '--format=%H', 'HEAD')).map(corto) : [];
  const vivas = new Set(vivasTodas);
  const huerfanas = [...new Set(reflog)].filter((id) => !vivas.has(id));
  return {
    repositorio: true,
    // El grafo dibuja hasta cuarenta confirmaciones.
    vivas: vivasTodas.length > 40 ? [`${vivasTodas.length} confirmaciones`] : [...vivasTodas].sort(),
    huerfanas: vivasTodas.length > 40 ? [] : huerfanas.sort(),
    ramas: refs('heads'),
    remotas: refs('remotes'),
    etiquetas,
    trabajo: trabajo.sort(),
    preparacion: preparacion.sort(),
    posicion: rama === '' ? `separada ${corto(cabeza)}` : `rama ${rama}`,
  };
}

async function loQueMuestra(p: Page): Promise<Vista> {
  return p.evaluate(() => {
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
    const barra = document.querySelector('[data-prueba="rama-actual"]')?.textContent?.trim() ?? '';
    const noEsRepositorio = /no es un repositorio/.test(document.querySelector('[data-prueba="barra-taller"]')?.textContent ?? '');
    return {
      repositorio: !noEsRepositorio,
      vivas: nodos
        .filter((n) => n.dataset.huerfana === 'no')
        .map((n) => n.dataset.confirmacion ?? '')
        .sort(),
      huerfanas: nodos
        .filter((n) => n.dataset.huerfana === 'si')
        .map((n) => n.dataset.confirmacion ?? '')
        .sort(),
      ramas: de('rama'),
      remotas: de('remota'),
      etiquetas: de('version'),
      trabajo: area('trabajo'),
      preparacion: area('preparacion'),
      posicion: noEsRepositorio
        ? ''
        : nodos.length === 0
          ? `rama ${barra.replace(/\|.*$/, '')}`
          : actual === undefined
            ? `separada ${puntero?.dataset.en ?? ''}`
            : `rama ${actual.dataset.etiqueta}`,
    };
  });
}

function diferencias(p: Vista, g: Vista): string[] {
  const vista = { ...p, vivas: g.vivas[0]?.endsWith('confirmaciones') ? g.vivas : p.vivas, huerfanas: g.vivas[0]?.endsWith('confirmaciones') ? [] : p.huerfanas };
  return (Object.keys(g) as (keyof Vista)[])
    .filter((k) => JSON.stringify(vista[k]) !== JSON.stringify(g[k]))
    .map((k) => `${k}: pagina ${JSON.stringify(vista[k])}, git ${JSON.stringify(g[k])}`);
}

// --- La pagina ----------------------------------------------------------------------

async function estadoDelPrograma(): Promise<{ carpeta: string; huella: string; indicador: string }> {
  return JSON.parse((await pedir(taller, '/api/estado')).cuerpo) as { carpeta: string; huella: string; indicador: string };
}

/** Escribe la orden en la consola de la pagina y espera a que Git termine y la pagina se ponga al dia. */
async function escribir(texto: string): Promise<{ salida: string; ms: number }> {
  const antes = await pagina.$$eval('section[aria-label="Consola"] pre[data-color], section[aria-label="Consola"] [data-color="orden"]', (r) => r.length);
  const campo = pagina.locator('[data-prueba="entrada-consola"]');
  await campo.fill(texto);
  const inicio = Date.now();
  await campo.press('Enter');
  await pagina.waitForFunction(
    () => document.querySelector<HTMLInputElement>('[data-prueba="entrada-consola"]')?.dataset.ocupada === 'no',
    null,
    { timeout: 1_300_000, polling: 50 },
  );
  // Al dia: la huella que la pagina dibujo es la del programa ahora.
  for (let intento = 0; intento < 100; intento += 1) {
    const { huella } = await estadoDelPrograma();
    const dibujada = await pagina.evaluate(() => document.documentElement.dataset.huella ?? '');
    if (dibujada === huella) break;
    await pagina.waitForTimeout(100);
  }
  const ms = Date.now() - inicio;
  const salida = await pagina.$$eval(
    'section[aria-label="Consola"] pre[data-color], section[aria-label="Consola"] [data-color="orden"]',
    (r, desde) =>
      r
        .slice(desde)
        .filter((e) => (e as HTMLElement).dataset.color !== 'orden')
        .map((e) => e.textContent ?? '')
        .join('\n'),
    antes,
  );
  return { salida, ms };
}

/** Lo que el alumno ve: el prompt a la vista, sin tapar, y la barra con la carpeta (5.3, 4.7). */
async function comprobarPantalla(donde: string): Promise<string[]> {
  const { indicador } = await estadoDelPrograma();
  return pagina.evaluate(
    ({ indicador }) => {
      const problemas: string[] = [];
      const consola = document.querySelector('section[aria-label="Consola"]');
      const campo = document.querySelector<HTMLInputElement>('[data-prueba="entrada-consola"]');
      const prompt = campo?.closest('div.shrink-0')?.querySelector('div.t-min');
      if (consola === null || campo === null || prompt === null || prompt === undefined) return ['falta la consola o su prompt'];
      const caja = prompt.getBoundingClientRect();
      const cajaCampo = campo.getBoundingClientRect();
      if (caja.height === 0 || caja.bottom > window.innerHeight || caja.top < 0) problemas.push('el prompt no esta a la vista');
      // El contorno del foco se dibuja fuera del campo: cuenta como parte del recuadro.
      const estilo = getComputedStyle(campo);
      const contorno = document.activeElement === campo ? Number.parseFloat(estilo.outlineWidth) + Number.parseFloat(estilo.outlineOffset) : 0;
      if (caja.bottom > cajaCampo.top - contorno) problemas.push('el recuadro de entrada tapa el prompt');
      const centro = document.elementFromPoint(caja.left + Math.min(caja.width / 2, 40), caja.top + caja.height / 2);
      if (centro === null || !prompt.contains(centro)) problemas.push('otra cosa tapa el prompt');
      if (!(prompt.textContent ?? '').includes(indicador)) problemas.push(`el prompt dice «${prompt.textContent}», la carpeta es ${indicador}`);
      const letra = Number.parseFloat(getComputedStyle(campo).fontSize);
      if (letra < 11) problemas.push(`la letra de la consola mide ${letra}px`);
      if (/Tabulación completa|Previsualización/.test(consola.textContent ?? '')) problemas.push('hay lineas de ayuda en la consola');
      const carpeta = document.querySelector('[data-prueba="carpeta-taller"]')?.textContent ?? '';
      if (carpeta !== indicador) problemas.push(`la barra dice «${carpeta}», la carpeta es ${indicador}`);
      return problemas;
    },
    { indicador },
  ).then((p) => p.map((texto) => `${donde}: ${texto}`));
}

async function capturar(numero: string, paso: number, texto: string): Promise<void> {
  if (numero !== '01' && numero !== '02') return;
  const nombre = texto.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '').replace(/-+/g, '-').slice(0, 60);
  await pagina.screenshot({
    path: join(CAPTURAS, `${process.platform}-${CANAL}`, `lab${numero}-${String(paso).padStart(3, '0')}-${nombre || 'orden'}.jpg`),
    type: 'jpeg',
    quality: 80,
  });
}

// --- Las pruebas --------------------------------------------------------------------------

beforeAll(async () => {
  // VS Code no esta en la maquina de pruebas: un `code` de mentira acepta lo
  // que Git propone y se cierra, como el alumno que guarda y cierra la pestaña.
  const raiz = join(tmpdir(), `taller-navegador-${Date.now()}`);
  const bin = join(raiz, 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'code'), '#!/bin/sh\nsleep 1\nexit 0\n');
  chmodSync(join(bin, 'code'), 0o755);
  const separador = WINDOWS ? ';' : ':';
  taller = await abrirTaller({ raiz, extra: { PATH: `${bin}${separador}${process.env.PATH ?? ''}` } });
  mkdirSync(join(CAPTURAS, `${process.platform}-${CANAL}`), { recursive: true });
  navegador = await chromium.launch(CANAL === 'chromium' ? {} : { channel: CANAL });
  pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });
  pagina.on('pageerror', (e) => fallas.push(`error en la pagina: ${e.message}`));
  await pagina.goto(taller.direccion);
  await pagina.waitForFunction(() => document.documentElement.dataset.huella !== undefined, null, { timeout: 30_000 });
  anotar(`# El modo taller en ${CANAL} sobre ${process.platform}`);
  anotar('');
  anotar(`- Git: ${execFileSync(...comandoGit('--version')).toString().trim()} · Navegador: ${CANAL} ${navegador.version()}`);
  anotar(`- Ventana del taller: ${taller.ventana().trim().replace(/\r?\n/g, ' | ')}`);
  anotar('');
  anotar('```');
}, 300_000);

afterAll(async () => {
  anotar('```');
  anotar('');
  anotar(fallas.length === 0 ? 'RESULTADO: todo igual' : `RESULTADO: ${fallas.length} diferencia(s)`);
  await navegador?.close();
  taller?.cerrar();
  const destino = join(CLON_REAL, 'docs', 'taller');
  mkdirSync(destino, { recursive: true });
  writeFileSync(join(destino, `navegador-${process.platform}-${CANAL}.md`), `${informe.join('\n')}\n`);
  if (taller !== undefined && existsSync(taller.raiz)) rmSync(taller.raiz, { recursive: true, force: true });
});

describe(`el modo taller en ${CANAL}`, () => {
  it('la pagina parte en taller-git-trabajo, dice que no es un repositorio y no dibuja nada (2.4, 2.6)', async () => {
    const vista = await loQueMuestra(pagina);
    const problemas = await comprobarPantalla('al abrir');
    comprobar(!vista.repositorio && vista.vivas.length === 0, `al abrir: no es un repositorio, sin dibujo`);
    comprobar(problemas.length === 0, `al abrir, la pantalla${problemas.length === 0 ? '' : `: ${problemas.join('; ')}`}`);
  });

  // `LABS=01,02` recorre solo esos, para mirar algo rapido; en GitHub Actions van los ocho.
  const elegidos = process.env.LABS === undefined ? LABORATORIOS : LABORATORIOS.filter((n) => process.env.LABS?.split(',').includes(n));
  it.each(elegidos)('laboratorio %s: cada orden escrita en la pagina deja la pagina igual a Git', async (numero) => {
    const { pasos, saltadas } = guion(numero);
    // El enunciado da por hecho que la terminal esta en la carpeta del clon:
    // el alumno llega ahi primero, porque la consola parte en taller-git-trabajo.
    await escribir('cd ../curso-git-gitlab-sii');
    const salidas = new Map<string, string>();
    let iguales = 0;
    const distintas: string[] = [];
    const pantalla: string[] = [];
    const tiempos: number[] = [];
    await capturar(numero, 0, 'estado-inicial');
    for (const [k, paso] of pasos.entries()) {
      const eleccion = paso.orden?.eleccion;
      const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
      const texto = paso.orden === null ? paso.texto : ordenPara(paso.orden, identificador);
      const { salida, ms } = await escribir(texto);
      tiempos.push(ms);
      salidas.set(paso.texto, salida);
      const { carpeta } = await estadoDelPrograma();
      const d = diferencias(await loQueMuestra(pagina), loQueDiceGit(carpeta));
      if (d.length === 0) iguales += 1;
      else distintas.push(`linea ${paso.linea} «${texto}»: ${d.join(' · ')}`);
      pantalla.push(...(await comprobarPantalla(`linea ${paso.linea} «${texto}»`)));
      await capturar(numero, k + 1, texto);
    }
    comprobar(
      distintas.length === 0,
      `lab ${numero}: ${iguales} de ${pasos.length} ordenes con la pagina igual a Git${distintas.length === 0 ? '' : `\n    ${distintas.join('\n    ')}`}`,
    );
    comprobar(pantalla.length === 0, `lab ${numero}: la pantalla${pantalla.length === 0 ? ' bien en cada orden' : `\n    ${pantalla.join('\n    ')}`}`);
    const orden = [...tiempos].sort((a, b) => a - b);
    anotar(`MEDIDA   lab ${numero}: orden escrita hasta pagina al dia, mediana ${orden[Math.floor(orden.length / 2)]} ms, maxima ${orden.at(-1)} ms`);
    for (const s of saltadas) anotar(`SALTADA  lab ${numero}: ${s}`);
    // El laboratorio siguiente parte, como el alumno, desde la carpeta de trabajo.
    await escribir(`cd "${taller.trabajo.replace(/\\/g, '/')}"`);
  });

  it('un archivo editado fuera de la pagina, como en VS Code, aparece solo en menos de un segundo (2.7)', async () => {
    await escribir('cd lab-01/recetario');
    const { carpeta } = await estadoDelPrograma();
    writeFileSync(join(carpeta, 'platos.md'), '# Platos\n\n- editado en VS Code\n');
    const inicio = Date.now();
    const vio = await pagina
      .waitForFunction(
        () => document.querySelector('section[data-columna="trabajo"] li[data-archivo="platos.md"][data-tono="modificado"]') !== null,
        null,
        { timeout: 5_000, polling: 20 },
      )
      .then(() => true)
      .catch(() => false);
    const ms = Date.now() - inicio;
    comprobar(vio && ms < 1000, `2.7 · platos.md editado por fuera: la pagina lo mostro sola en ${vio ? ms : 'mas de 5000'} ms`);
  });

  it('al recargar la pagina, la consola sigue en la misma carpeta y con lo que se escribio (2.8)', async () => {
    const { indicador } = await estadoDelPrograma();
    const ordenesAntes = await pagina.$$eval('section[aria-label="Consola"] [data-color="orden"]', (r) => r.length);
    await pagina.reload();
    await pagina.waitForFunction(() => document.documentElement.dataset.huella !== undefined, null, { timeout: 30_000 });
    await pagina.waitForTimeout(500);
    const ordenesDespues = await pagina.$$eval('section[aria-label="Consola"] [data-color="orden"]', (r) => r.length);
    const problemas = await comprobarPantalla('al recargar');
    comprobar(
      problemas.length === 0 && ordenesDespues === ordenesAntes,
      `2.8 · al recargar: carpeta ${indicador}, ${ordenesDespues} de ${ordenesAntes} ordenes a la vista${problemas.length === 0 ? '' : `; ${problemas.join('; ')}`}`,
    );
  });

  it('clear limpia la consola, y la flecha arriba trae la orden anterior (4.2)', async () => {
    await escribir('git status');
    await escribir('clear');
    const renglones = await pagina.$$eval('section[aria-label="Consola"] [data-color]', (r) => r.length);
    await pagina.locator('[data-prueba="entrada-consola"]').press('ArrowUp');
    const anterior = await pagina.inputValue('[data-prueba="entrada-consola"]');
    comprobar(renglones === 0 && anterior === 'clear', `4.2 · clear deja ${renglones} renglones; flecha arriba trae «${anterior}»`);
    await pagina.fill('[data-prueba="entrada-consola"]', '');
  });

  it('al cerrar la ventana del taller, la pagina lo dice en una linea y no queda colgada (2.9)', async () => {
    taller.cerrar();
    const inicio = Date.now();
    const dijo = await pagina
      .waitForSelector('[data-prueba="taller-cerrado"]', { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const texto = dijo ? ((await pagina.textContent('[data-prueba="taller-cerrado"]')) ?? '') : '';
    const bloqueada = await pagina.evaluate(() => document.querySelector<HTMLInputElement>('[data-prueba="entrada-consola"]')?.readOnly);
    comprobar(dijo && bloqueada === true, `2.9 · taller cerrado: la pagina lo dijo en ${Date.now() - inicio} ms: «${texto.trim()}»`);
  });

  it('sin diferencias', () => {
    expect(fallas).toEqual([]);
  });
});
