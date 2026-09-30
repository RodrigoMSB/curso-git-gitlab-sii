/**
 * El tamaño del dibujo del grafo (SPEC 029, 1.3): los pasos, el recuerdo en el
 * navegador y que sin almacenamiento parta en el normal sin error.
 */

import { describe, expect, it } from 'vitest';
import {
  acercar,
  alejar,
  type Almacen,
  CLAVE_ZOOM,
  guardarZoom,
  leerZoom,
  NIVELES_ZOOM,
  puedeAcercar,
  puedeAlejar,
  ZOOM_NORMAL,
} from '../src/vista/zoomGrafo';

function memoria(): Almacen & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return { datos, getItem: (c) => datos.get(c) ?? null, setItem: (c, v) => void datos.set(c, v) };
}

describe('SPEC 029, 1.3 · el tamaño del grafo', () => {
  it('agranda y achica de a un paso, sin salir de los extremos', () => {
    expect(acercar(ZOOM_NORMAL)).toBeGreaterThan(ZOOM_NORMAL);
    expect(alejar(ZOOM_NORMAL)).toBeLessThan(ZOOM_NORMAL);
    expect(alejar(acercar(ZOOM_NORMAL))).toBe(ZOOM_NORMAL);
    const mayor = NIVELES_ZOOM[NIVELES_ZOOM.length - 1] ?? 0;
    const menor = NIVELES_ZOOM[0] ?? 0;
    expect(acercar(mayor)).toBe(mayor);
    expect(alejar(menor)).toBe(menor);
    expect(puedeAcercar(mayor)).toBe(false);
    expect(puedeAlejar(menor)).toBe(false);
    expect(puedeAcercar(ZOOM_NORMAL) && puedeAlejar(ZOOM_NORMAL)).toBe(true);
  });

  it('se recuerda en el navegador', () => {
    const almacen = memoria();
    expect(leerZoom(() => almacen)).toBe(ZOOM_NORMAL);
    guardarZoom(() => almacen, 1.5);
    expect(almacen.datos.get(CLAVE_ZOOM)).toBe('1.5');
    expect(leerZoom(() => almacen)).toBe(1.5);
  });

  it('un valor guardado raro se lleva al paso mas cercano, o al normal si no es un numero', () => {
    const almacen = memoria();
    almacen.datos.set(CLAVE_ZOOM, '1.3');
    expect(leerZoom(() => almacen)).toBe(1.25);
    almacen.datos.set(CLAVE_ZOOM, 'grande');
    expect(leerZoom(() => almacen)).toBe(ZOOM_NORMAL);
  });

  it('sin almacenamiento, o si falla, parte en el normal y guardar no rompe nada', () => {
    const roto: Almacen = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(leerZoom(() => roto)).toBe(ZOOM_NORMAL);
    expect(() => guardarZoom(() => roto, 2)).not.toThrow();
    expect(leerZoom(() => null)).toBe(ZOOM_NORMAL);
    expect(
      leerZoom(() => {
        throw new Error('no hay window');
      }),
    ).toBe(ZOOM_NORMAL);
  });
});
