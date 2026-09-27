/**
 * El tamaño del dibujo del grafo que elige el participante (SPEC 029, 1.3).
 *
 * Agranda o achica juntos los puntos, las etiquetas y los mensajes: es la
 * escala del SVG entero, aparte del cálculo de posiciones, que sigue haciendo
 * caber el grafo como si el tamaño fuera el normal. Se recuerda en el
 * almacenamiento del navegador, entre repositorios y al recargar; si ese
 * almacenamiento no está o falla, se parte en el tamaño normal.
 */

/** Los tamaños posibles, del más chico al más grande. El normal es 1. */
export const NIVELES_ZOOM = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;

export const ZOOM_NORMAL = 1;

/** La clave en el almacenamiento del navegador. */
export const CLAVE_ZOOM = 'taller-git.grafo.zoom';

/** Lo que se usa del almacenamiento: solo leer y escribir, y cualquiera de las dos puede fallar. */
export interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

function indice(nivel: number): number {
  const exacto = NIVELES_ZOOM.indexOf(nivel as (typeof NIVELES_ZOOM)[number]);
  if (exacto >= 0) return exacto;
  // Un valor que no es un nivel se lleva al mas cercano.
  let mejor = 0;
  NIVELES_ZOOM.forEach((n, i) => {
    if (Math.abs(n - nivel) < Math.abs((NIVELES_ZOOM[mejor] ?? 1) - nivel)) mejor = i;
  });
  return mejor;
}

export function acercar(nivel: number): number {
  return NIVELES_ZOOM[Math.min(NIVELES_ZOOM.length - 1, indice(nivel) + 1)] ?? ZOOM_NORMAL;
}

export function alejar(nivel: number): number {
  return NIVELES_ZOOM[Math.max(0, indice(nivel) - 1)] ?? ZOOM_NORMAL;
}

export function puedeAcercar(nivel: number): boolean {
  return indice(nivel) < NIVELES_ZOOM.length - 1;
}

export function puedeAlejar(nivel: number): boolean {
  return indice(nivel) > 0;
}

/** El tamaño guardado, o el normal si no hay, no es valido o el almacenamiento falla. */
export function leerZoom(almacen: () => Almacen | null): number {
  try {
    const guardado = almacen()?.getItem(CLAVE_ZOOM);
    if (guardado === null || guardado === undefined) return ZOOM_NORMAL;
    const numero = Number(guardado);
    if (!Number.isFinite(numero)) return ZOOM_NORMAL;
    return NIVELES_ZOOM[indice(numero)] ?? ZOOM_NORMAL;
  } catch {
    return ZOOM_NORMAL;
  }
}

/** Guarda el tamaño. Si el almacenamiento falla, no pasa nada: solo no se recuerda. */
export function guardarZoom(almacen: () => Almacen | null, nivel: number): void {
  try {
    almacen()?.setItem(CLAVE_ZOOM, String(nivel));
  } catch {
    // Sin almacenamiento, el tamano dura lo que dura la pagina.
  }
}

/** El almacenamiento del navegador, o nulo si ni siquiera se puede pedir. */
export function almacenDelNavegador(): Almacen | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
