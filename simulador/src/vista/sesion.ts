/**
 * Sesion de trabajo y linea de tiempo.
 *
 * Guarda un paso por cada orden ejecutada, con el estado del repositorio y la
 * consola tal como quedaron en ese momento. Retroceder es moverse de paso, no
 * deshacer: por eso la pantalla completa vuelve al estado de entonces, incluida
 * la consola (punto 7.1).
 *
 * Es codigo puro. Nada de esto persiste entre recargas (punto 7.4).
 */

import { ejecutar, previsualizar } from '../core';
import type { EstadoRepositorio, Previsualizacion } from '../core/tipos';
import { escenarioPorId } from '../escenarios';
import { colorearSalida, type Renglon } from './consola';

export interface Paso {
  /** Orden que llevo hasta aqui. El primer paso es el estado inicial, sin orden. */
  readonly orden: string | null;
  readonly estado: EstadoRepositorio;
  readonly renglones: readonly Renglon[];
}

export interface Sesion {
  readonly escenario: string;
  readonly pasos: readonly Paso[];
  readonly indice: number;
  /** Ordenes escritas, de la mas antigua a la mas reciente. */
  readonly historial: readonly string[];
  /** Confirmacion que el participante esta inspeccionando. */
  readonly seleccion: string | null;
}

export function iniciarSesion(escenario: string): Sesion {
  return {
    escenario,
    pasos: [{ orden: null, estado: escenarioPorId(escenario), renglones: [] }],
    indice: 0,
    historial: [],
    seleccion: null,
  };
}

function pasoActual(sesion: Sesion): Paso {
  const paso = sesion.pasos[sesion.indice] ?? sesion.pasos[0];
  if (paso === undefined) throw new Error('La sesión quedó sin ningún paso.');
  return paso;
}

export function estadoDe(sesion: Sesion): EstadoRepositorio {
  return pasoActual(sesion).estado;
}

export function renglonesDe(sesion: Sesion): readonly Renglon[] {
  return pasoActual(sesion).renglones;
}

/**
 * Ejecuta una orden y agrega un paso.
 *
 * Si el participante estaba parado en un punto anterior, la historia se corta
 * desde ahi, igual que ocurre en Git (punto 7.2).
 */
export function ejecutarOrden(sesion: Sesion, linea: string): Sesion {
  const orden = linea.trim();
  if (orden === '') return sesion;

  const actual = pasoActual(sesion);
  const resultado = ejecutar(actual.estado, orden);
  const anteriores = sesion.pasos.slice(0, sesion.indice + 1);
  const numero = anteriores.length;

  const eco: Renglon = { clave: `${numero}:orden`, texto: orden, color: 'orden' };
  const renglones = resultado.limpiarConsola
    ? []
    : [...actual.renglones, eco, ...colorearSalida(resultado.salida, String(numero))];

  return {
    ...sesion,
    pasos: [...anteriores, { orden, estado: resultado.estado, renglones }],
    indice: numero,
    historial: [...sesion.historial, orden],
    seleccion: null,
  };
}

/** Mueve la sesion a un paso ya recorrido. */
export function irAPaso(sesion: Sesion, indice: number): Sesion {
  const destino = Math.min(Math.max(indice, 0), sesion.pasos.length - 1);
  return { ...sesion, indice: destino, seleccion: null };
}

export function retroceder(sesion: Sesion): Sesion {
  return irAPaso(sesion, sesion.indice - 1);
}

export function avanzar(sesion: Sesion): Sesion {
  return irAPaso(sesion, sesion.indice + 1);
}

export function seleccionarConfirmacion(sesion: Sesion, id: string | null): Sesion {
  return { ...sesion, seleccion: sesion.seleccion === id ? null : id };
}

export function cambiarEscenario(escenario: string): Sesion {
  return iniciarSesion(escenario);
}

/**
 * Que ocurriria con la orden que se esta escribiendo.
 *
 * Se apoya en la previsualizacion que ya expone el motor (punto 6.2). Devuelve
 * `null` cuando no hay nada que anticipar.
 */
export function previsualizarOrden(sesion: Sesion, linea: string): Previsualizacion | null {
  const orden = linea.trim();
  if (orden === '') return null;
  const vista = previsualizar(estadoDe(sesion), orden);
  if (vista.error) return null;
  if (vista.confirmacionesNuevas.length === 0 && !vista.punteroMovido) return null;
  return vista;
}
