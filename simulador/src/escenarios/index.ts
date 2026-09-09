/**
 * Estados iniciales de los laboratorios del taller (SPEC 007).
 *
 * Llevan escenario los laboratorios 01 al 10, que son los que ocurren en disco
 * y tienen grafo que mirar. Los del 11 en adelante ocurren en la plataforma o
 * en la tuberia de integracion, y no hay repositorio local que reflejar.
 */

import type { EstadoRepositorio } from '../core/tipos';
import { construirEscenario } from './construir';
import { ESCENARIOS } from './laboratorios';
import type { EscenarioDeclarado } from './tipos';

export type { EscenarioDeclarado, GuardadoDeclarado } from './tipos';
export { construirEscenario } from './construir';
export {
  ESCENARIOS,
  LAB01,
  LAB02,
  LAB03,
  LAB04,
  LAB05,
  LAB06,
  LAB07,
  LAB08,
  LAB09,
  LAB10,
} from './laboratorios';

/** El escenario por omision: el primer laboratorio del taller. */
export const ESCENARIO_INICIAL = 'lab-01';

export function declaracionPorId(id: string): EscenarioDeclarado | undefined {
  return ESCENARIOS.find((candidato) => candidato.id === id);
}

/** Estado inicial por identificador de escenario, `lab-01` y siguientes. */
export function escenarioPorId(id: string): EstadoRepositorio {
  const declaracion = declaracionPorId(id);
  if (declaracion === undefined) {
    throw new Error(`No existe el escenario ${id}.`);
  }
  return construirEscenario(declaracion);
}

/** Estado inicial del escenario de un laboratorio, por su numero. */
export function escenarioDeLaboratorio(laboratorio: number): EstadoRepositorio {
  const declaracion = ESCENARIOS.find((candidato) => candidato.laboratorio === laboratorio);
  if (declaracion === undefined) {
    throw new Error(`No hay escenario definido para el laboratorio ${laboratorio}.`);
  }
  return construirEscenario(declaracion);
}

/**
 * Traduce lo que venga en la direccion del archivo al identificador de un
 * escenario. Acepta `lab-02`, `02` y `2`, en la parte de consulta o en el
 * fragmento, porque el enunciado va a citar esa direccion y conviene que
 * cualquier forma razonable funcione.
 *
 * Devuelve `null` si no reconoce nada, y entonces manda el escenario inicial.
 */
export function escenarioDeLaDireccion(consulta: string, fragmento: string): string | null {
  const crudo =
    new URLSearchParams(consulta).get('lab') ?? fragmento.replace(/^#/, '').trim();
  if (crudo === '') return null;

  const numero = Number(crudo.replace(/^lab-?/i, ''));
  if (!Number.isInteger(numero)) return null;

  const id = `lab-${String(numero).padStart(2, '0')}`;
  return declaracionPorId(id) === undefined ? null : id;
}
