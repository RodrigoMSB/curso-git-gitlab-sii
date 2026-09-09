/**
 * Utilidades compartidas por las pruebas.
 */

import { ejecutar } from '../src/core/motor';
import { escenarioPorId } from '../src/escenarios';
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

/**
 * Escenarios de laboratorio usados como punto de partida de las pruebas.
 *
 * Se nombran por la forma que aportan y no por su numero, para que cada prueba
 * diga por que necesita ese escenario y no otro. Son los mismos que carga el
 * simulador: si un escenario cambia, las pruebas que dependen de esa forma se
 * enteran.
 */

/** Repositorio recien creado y vacio, como lo deja `git init` en el laboratorio 01. */
export function repoVacio(): EstadoRepositorio {
  return ejecutar(escenarioPorId('lab-01'), 'git init').estado;
}

/** Historia lineal de cinco confirmaciones, con un cambio suelto y otro preparado (lab 02). */
export function repoLineal(): EstadoRepositorio {
  return escenarioPorId('lab-02');
}

/** Historia corta y limpia, con carpeta de recetas para mirar (lab 03). */
export function repoLimpio(): EstadoRepositorio {
  return escenarioPorId('lab-03');
}

/**
 * Dos ramas con destinos distintos (lab 06): `mexicana` cuelga de la punta de
 * main y se fusiona por avance rapido; `peruana` nace antes y choca.
 */
export function repoConRamas(): EstadoRepositorio {
  return escenarioPorId('lab-06');
}

/** Rama de trabajo con mensajes que no dicen nada y algo a medias encima (lab 08). */
export function repoConRamaDeTrabajo(): EstadoRepositorio {
  return escenarioPorId('lab-08');
}

/**
 * El laboratorio 08 mirado desde `main`: dos ramas que divergieron de verdad,
 * con la posicion en el tronco. Es la forma que necesitan las ordenes que
 * cambian de rama, fusionan sin conflicto o reordenan.
 */
export function repoConRamaDesdeMain(): EstadoRepositorio {
  return ejecutar(escenarioPorId('lab-08'), 'git switch main').estado;
}
