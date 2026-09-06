/**
 * Utilidades compartidas por las pruebas.
 */

import { ejecutar } from '../src/core/motor';
import type { EstadoRepositorio, ResultadoOrden } from '../src/core/tipos';

/** Aplica una lista de ordenes y devuelve el estado final. */
export function correr(
  estado: EstadoRepositorio,
  ...ordenes: readonly string[]
): EstadoRepositorio {
  return ordenes.reduce((acumulado, orden) => ejecutar(acumulado, orden).estado, estado);
}

/** Aplica una lista de ordenes y devuelve el resultado de la ultima. */
export function correrHasta(
  estado: EstadoRepositorio,
  ...ordenes: readonly string[]
): ResultadoOrden {
  let resultado: ResultadoOrden = { estado, salida: [], error: false, proyectadas: [], limpiarConsola: false };
  for (const orden of ordenes) {
    resultado = ejecutar(resultado.estado, orden);
  }
  return resultado;
}

/** Texto plano de la salida de una orden. */
export function texto(resultado: ResultadoOrden): string {
  return resultado.salida.map((linea) => linea.texto).join('\n');
}

/** Identificadores de las confirmaciones del estado. */
export function ids(estado: EstadoRepositorio): readonly string[] {
  return estado.confirmaciones.map((confirmacion) => confirmacion.id);
}
