/**
 * Lo que la pagina del modo taller **pinta** (punto 7.4 del SPEC 026).
 *
 * Se lee del documento ya dibujado, y un elemento solo cuenta si el navegador
 * le dio tamaño y no lo escondio: un atributo presente en un nodo que mide
 * cero no es algo que el participante vea. Es la leccion del SPEC 011.
 */

import type { Page } from 'playwright';

export interface EstadoEnPantalla {
  readonly repositorio: boolean;
  readonly rama: string | null;
  readonly head: string | null;
  readonly confirmaciones: readonly string[];
  readonly huerfanas: readonly string[];
  readonly ramas: readonly string[];
  readonly etiquetas: readonly string[];
  readonly trabajo: readonly string[];
  readonly preparacion: readonly string[];
  /** La carpeta que dice el indicador de la entrada. */
  readonly carpeta: string;
  /** La barra: si dice que no hay repositorio, y si muestra rama o contador. */
  readonly barraSinRepositorio: boolean;
  readonly barraConRama: boolean;
  readonly barraConCambios: boolean;
  /** Lo que dice el area del repositorio local: «N confirmaciones», o null si esta vacia. */
  readonly confirmacionesEnArea: number | null;
  /** Las confirmaciones que el grafo dejo fuera por espacio. */
  readonly ocultas: number;
}

export function leerPantalla(pagina: Page): Promise<EstadoEnPantalla> {
  return pagina.evaluate(() => {
    const visible = (el: Element | null): boolean => {
      if (el === null) return false;
      const caja = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      return caja.width > 0 && caja.height > 0 && estilo.visibility !== 'hidden' && estilo.display !== 'none' && Number(estilo.opacity) > 0;
    };
    const nodos = [...document.querySelectorAll('g[data-confirmacion]')].filter(visible);
    const etiquetas = [...document.querySelectorAll('g[data-etiqueta]')].filter(visible);
    const deForma = (forma: string): string[] =>
      etiquetas.filter((e) => e.getAttribute('data-forma') === forma).map((e) => e.getAttribute('data-etiqueta') ?? '');
    const puntero = etiquetas.find((e) => e.getAttribute('data-forma') === 'puntero');
    const archivos = (columna: string): string[] =>
      [...document.querySelectorAll(`section[data-columna="${columna}"] li[data-archivo]`)]
        .filter(visible)
        .map((li) => li.getAttribute('data-archivo') ?? '');
    const barraRama = document.querySelector('[data-prueba="barra-rama"]');
    const ramaTexto = barraRama?.textContent ?? null;
    const indicador = document.querySelector('[aria-busy] .t-min');
    const aviso = [...document.querySelectorAll('p')].find((p) => /Se dibujan las \d+ confirmaciones/.test(p.textContent ?? ''));
    const sinRepositorio = visible(document.querySelector('[data-prueba="barra-sin-repositorio"]'));
    const desconectada = ramaTexto?.startsWith('posición desconectada · ') ?? false;
    return {
      repositorio: !sinRepositorio,
      rama: ramaTexto === null || desconectada ? null : ramaTexto,
      head: puntero?.getAttribute('data-en') ?? (desconectada ? (ramaTexto?.split(' · ')[1] ?? null) : null),
      confirmaciones: nodos.map((n) => n.getAttribute('data-confirmacion') ?? '').sort(),
      huerfanas: nodos.filter((n) => n.getAttribute('data-huerfana') === 'si').map((n) => n.getAttribute('data-confirmacion') ?? '').sort(),
      ramas: deForma('rama').sort(),
      etiquetas: deForma('version').sort(),
      trabajo: archivos('trabajo').sort(),
      preparacion: archivos('preparacion').sort(),
      carpeta: (indicador?.textContent ?? '').replace(/\s+\(.*\)\s*$/, '').trim(),
      barraSinRepositorio: sinRepositorio,
      barraConRama: visible(barraRama),
      barraConCambios: visible(document.querySelector('[data-prueba="barra-cambios"]')),
      confirmacionesEnArea: (() => {
        const texto = [...document.querySelectorAll('section[data-columna="local"] li[data-archivo]')]
          .map((li) => li.getAttribute('data-archivo') ?? '')
          .find((t) => /^\d+ confirmaciones$/.test(t));
        return texto === undefined ? null : Number(texto.split(' ')[0]);
      })(),
      ocultas: Number(aviso?.textContent?.match(/(\d+) quedaron fuera/)?.[1] ?? 0),
    };
  });
}

/** Lo que la consola mostro de la ultima orden: sus lineas de Git, sin las del programa. */
export function salidaDeLaUltimaOrden(pagina: Page): Promise<{ readonly git: string; readonly programa: readonly string[] }> {
  return pagina.evaluate(() => {
    const filas = [...document.querySelectorAll('section[aria-label="Consola"] [data-color]')];
    const ultima = filas.map((f) => f.getAttribute('data-color')).lastIndexOf('orden');
    const despues = filas.slice(ultima + 1);
    const texto = (f: Element): string => (f.textContent === ' ' ? '' : (f.textContent ?? ''));
    return {
      git: despues.filter((f) => f.getAttribute('data-color') !== 'programa').map(texto).join('\n'),
      programa: despues.filter((f) => f.getAttribute('data-color') === 'programa').map(texto),
    };
  });
}

/**
 * Espera a que terminen las animaciones. Una confirmacion nueva entra
 * creciendo desde cero, y mientras crece no mide nada: leerla en ese momento
 * es leer una pantalla a medio dibujar.
 */
export async function quieta(pagina: Page): Promise<void> {
  await pagina.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), undefined, {
    timeout: 5000,
    polling: 30,
  });
}

/** Escribe una orden en la consola y espera a que la entrada vuelva a estar disponible. */
export async function escribir(pagina: Page, orden: string, espera = 15 * 60_000): Promise<number> {
  const entrada = pagina.locator('[data-prueba="entrada-consola"]');
  await entrada.waitFor({ state: 'visible', timeout: espera });
  await entrada.fill(orden);
  const inicio = Date.now();
  await entrada.press('Enter');
  // La entrada se esconde mientras la orden corre y vuelve cuando termino y el
  // estado nuevo ya llego.
  await pagina.waitForFunction(
    () => {
      const campo = document.querySelector<HTMLInputElement>('[data-prueba="entrada-consola"]');
      return campo !== null && !campo.hidden && campo.value === '';
    },
    undefined,
    { timeout: espera, polling: 50 },
  );
  const ms = Date.now() - inicio;
  await quieta(pagina);
  return ms;
}
