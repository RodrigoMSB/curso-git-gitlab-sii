/**
 * Resolucion de referencias a confirmaciones.
 *
 * Acepta `HEAD`, nombres de rama, nombres de etiqueta, identificadores
 * completos o abreviados, y los sufijos `~n` y `^n` encadenados.
 */

import { confirmacionPorId, etiquetaPorNombre, idActual, ramaPorNombre } from './estado';
import type { EstadoRepositorio } from './tipos';

interface Salto {
  readonly tipo: 'primerPadre' | 'padreEnesimo';
  readonly cantidad: number;
}

function separarSufijos(referencia: string): { base: string; saltos: readonly Salto[] } {
  const corte = referencia.search(/[~^]/);
  if (corte < 0) return { base: referencia, saltos: [] };

  const base = referencia.slice(0, corte);
  const saltos: Salto[] = [];
  const sufijo = referencia.slice(corte);
  const patron = /([~^])(\d*)/g;
  let coincidencia = patron.exec(sufijo);
  while (coincidencia !== null) {
    const signo = coincidencia[1];
    const numero = coincidencia[2] ?? '';
    const cantidad = numero === '' ? 1 : Number.parseInt(numero, 10);
    saltos.push({
      tipo: signo === '~' ? 'primerPadre' : 'padreEnesimo',
      cantidad,
    });
    coincidencia = patron.exec(sufijo);
  }
  return { base, saltos };
}

/** Resuelve el nombre base, sin sufijos, a un identificador de confirmacion. */
function resolverBase(estado: EstadoRepositorio, base: string): string | null {
  if (base === '' || base === 'HEAD' || base === '@') return idActual(estado);

  const rama = ramaPorNombre(estado, base);
  if (rama !== undefined) return rama.id;

  const etiqueta = etiquetaPorNombre(estado, base);
  if (etiqueta !== undefined) return etiqueta.id;

  if (confirmacionPorId(estado, base) !== undefined) return base;

  if (/^[0-9a-f]{4,}$/i.test(base)) {
    const candidatas = estado.confirmaciones.filter((confirmacion) =>
      confirmacion.id.startsWith(base.toLowerCase()),
    );
    const unica = candidatas[0];
    if (candidatas.length === 1 && unica !== undefined) return unica.id;
  }

  return null;
}

/** Devuelve el identificador al que apunta la referencia, o `null` si no existe. */
export function resolverReferencia(
  estado: EstadoRepositorio,
  referencia: string,
): string | null {
  const { base, saltos } = separarSufijos(referencia);
  let id = resolverBase(estado, base);
  if (id === null) return null;

  for (const salto of saltos) {
    if (salto.tipo === 'primerPadre') {
      for (let paso = 0; paso < salto.cantidad; paso += 1) {
        const confirmacion = confirmacionPorId(estado, id ?? '');
        const padre = confirmacion?.padres[0];
        if (padre === undefined) return null;
        id = padre;
      }
    } else {
      const confirmacion = confirmacionPorId(estado, id ?? '');
      const padre = confirmacion?.padres[salto.cantidad - 1];
      if (padre === undefined) return null;
      id = padre;
    }
  }

  return id;
}

/** Nombres de rama y etiqueta que apuntan a una confirmacion, para las decoraciones del historial. */
export function decoracionesDe(estado: EstadoRepositorio, id: string): readonly string[] {
  const decoraciones: string[] = [];
  const rama = estado.puntero.tipo === 'rama' ? estado.puntero.rama : null;

  if (estado.puntero.tipo === 'confirmacion' && estado.puntero.id === id) {
    decoraciones.push('HEAD');
  }
  for (const candidata of estado.ramas) {
    if (candidata.id !== id) continue;
    decoraciones.push(candidata.nombre === rama ? `HEAD -> ${candidata.nombre}` : candidata.nombre);
  }
  for (const etiqueta of estado.etiquetas) {
    if (etiqueta.id === id) decoraciones.push(`tag: ${etiqueta.nombre}`);
  }
  return decoraciones;
}
