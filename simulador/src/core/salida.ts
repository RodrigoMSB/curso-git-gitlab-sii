/**
 * Constructores de las lineas que la consola muestra y del resultado de una orden.
 *
 * Los textos reproducen los que entrega Git de verdad. El simulador prepara al
 * participante para la consola real, de modo que traducirlos lo dejaria peor
 * parado frente a la herramienta que va a usar despues del taller.
 */

import type { EstadoRepositorio, LineaSalida, ResultadoOrden } from './tipos';

export function linea(texto: string): LineaSalida {
  return { tipo: 'salida', texto };
}

export function lineaError(texto: string): LineaSalida {
  return { tipo: 'error', texto };
}

export function lineaAviso(texto: string): LineaSalida {
  return { tipo: 'aviso', texto };
}

export function lineaExito(texto: string): LineaSalida {
  return { tipo: 'exito', texto };
}

export function lineas(...textos: readonly string[]): readonly LineaSalida[] {
  return textos.map(linea);
}

/** Resultado correcto: estado nuevo y lineas de salida. */
export function ok(
  estado: EstadoRepositorio,
  salida: readonly LineaSalida[] = [],
  extras: {
    readonly proyectadas?: readonly string[];
    readonly limpiarConsola?: boolean;
  } = {},
): ResultadoOrden {
  return {
    estado,
    salida,
    error: false,
    proyectadas: extras.proyectadas ?? [],
    limpiarConsola: extras.limpiarConsola ?? false,
  };
}

/** Resultado fallido: el estado no cambia y se informa el motivo. */
export function fallo(
  estado: EstadoRepositorio,
  ...textos: readonly string[]
): ResultadoOrden {
  return {
    estado,
    salida: textos.map(lineaError),
    error: true,
    proyectadas: [],
    limpiarConsola: false,
  };
}

/** Reclamo estandar cuando la orden necesita un repositorio y no lo hay. */
export function sinRepositorio(estado: EstadoRepositorio): ResultadoOrden {
  return fallo(
    estado,
    'fatal: not a git repository (or any of the parent directories): .git',
  );
}
