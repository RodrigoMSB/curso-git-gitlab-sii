/**
 * Estados iniciales de las cuatro primeras sesiones del taller.
 */

import type { EstadoRepositorio } from '../core/tipos';
import { construirEscenario } from './construir';
import { E1, E2, E3, E4, ESCENARIOS } from './recetario';
import type { EscenarioDeclarado } from './tipos';

export type { EscenarioDeclarado } from './tipos';
export { construirEscenario } from './construir';
export { E1, E2, E3, E4, ESCENARIOS } from './recetario';

/** Estado inicial del escenario de una sesion. */
export function escenarioDeSesion(sesion: number): EstadoRepositorio {
  const declaracion = ESCENARIOS.find((candidato) => candidato.sesion === sesion);
  if (declaracion === undefined) {
    throw new Error(`No hay escenario definido para la sesion ${sesion}.`);
  }
  return construirEscenario(declaracion);
}

/** Estado inicial por identificador de escenario. */
export function escenarioPorId(id: string): EstadoRepositorio {
  const declaracion = ESCENARIOS.find((candidato) => candidato.id === id);
  if (declaracion === undefined) {
    throw new Error(`No existe el escenario ${id}.`);
  }
  return construirEscenario(declaracion);
}

export const escenarios: Readonly<Record<string, () => EstadoRepositorio>> = {
  E1: () => construirEscenario(E1),
  E2: () => construirEscenario(E2),
  E3: () => construirEscenario(E3),
  E4: () => construirEscenario(E4),
};

export const declaraciones: Readonly<Record<string, EscenarioDeclarado>> = {
  E1,
  E2,
  E3,
  E4,
};
