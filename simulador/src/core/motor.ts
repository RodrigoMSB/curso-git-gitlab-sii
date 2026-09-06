/**
 * Interfaz publica del motor.
 *
 * `ejecutar` aplica una orden y `previsualizar` responde que pasaria si se
 * aplicara. La previsualizacion se apoya en la misma ejecucion: como el estado
 * es inmutable y las ordenes son funciones puras, ejecutar sobre una copia no
 * altera nada. No hay una segunda implementacion de la logica, tal como exige
 * la seccion 9 del SPEC 001.
 */

import { analizar } from './analizador';
import { idActual } from './estado';
import { despachar } from './ordenes/registro';
import { ok } from './salida';
import type { EstadoRepositorio, Previsualizacion, ResultadoOrden } from './tipos';

/** Aplica una orden al estado y devuelve el estado nuevo con su salida. */
export function ejecutar(estado: EstadoRepositorio, linea: string): ResultadoOrden {
  const orden = analizar(linea);
  if (orden === null) return ok(estado);
  return despachar(estado, orden);
}

/** Aplica varias ordenes en secuencia. Util para armar escenarios y pruebas. */
export function ejecutarSecuencia(
  estado: EstadoRepositorio,
  lineas: readonly string[],
): EstadoRepositorio {
  return lineas.reduce((acumulado, linea) => ejecutar(acumulado, linea).estado, estado);
}

function punteroSeMovio(antes: EstadoRepositorio, despues: EstadoRepositorio): boolean {
  const cambioDeTipo = antes.puntero.tipo !== despues.puntero.tipo;
  if (cambioDeTipo) return true;
  if (antes.puntero.tipo === 'rama' && despues.puntero.tipo === 'rama') {
    if (antes.puntero.rama !== despues.puntero.rama) return true;
  }
  return idActual(antes) !== idActual(despues);
}

/**
 * Responde que ocurriria al ejecutar la orden, sin aplicarla.
 *
 * Devuelve el estado resultante, los identificadores de las confirmaciones que
 * serian nuevas y si el puntero de posicion se moveria. La capa visual usa
 * esto para dibujar en trazo discontinuo lo que esta por pasar.
 *
 * Entre las confirmaciones nuevas se incluye la union que una fusion con
 * conflictos deja comprometida: existe como compromiso desde que la fusion
 * empieza, aunque el nodo se materialice al resolver y confirmar.
 */
export function previsualizar(estado: EstadoRepositorio, linea: string): Previsualizacion {
  const resultado = ejecutar(estado, linea);

  const previas = new Set(estado.confirmaciones.map((confirmacion) => confirmacion.id));
  const materializadas = resultado.estado.confirmaciones
    .filter((confirmacion) => !previas.has(confirmacion.id))
    .map((confirmacion) => confirmacion.id);
  const comprometidas = resultado.proyectadas.filter(
    (id) => !previas.has(id) && !materializadas.includes(id),
  );

  return {
    estadoResultante: resultado.estado,
    confirmacionesNuevas: [...materializadas, ...comprometidas],
    punteroMovido: punteroSeMovio(estado, resultado.estado),
    salida: resultado.salida,
    error: resultado.error,
  };
}
