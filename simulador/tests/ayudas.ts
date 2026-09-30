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

/**
 * El repositorio recien creado con los primeros archivos del recetario sin
 * seguimiento. Hasta el SPEC 031 el escenario del laboratorio 01 los traia
 * puestos; desde el SPEC 032 parte vacio, como el enunciado, y aqui se crean
 * con ordenes, como los crea el participante.
 */
export function repoConArchivosSueltos(): EstadoRepositorio {
  let estado = repoVacio();
  for (const orden of [
    'echo "# Recetario COMIDA CHILENA" > README.md',
    'echo "# Platos" > platos.md',
    'mkdir -p recetas',
    'echo "# Pastel de choclo" > recetas/pastel-de-choclo.md',
    'echo "# Empanadas de pino" > recetas/empanadas.md',
  ]) {
    estado = ejecutar(estado, orden).estado;
  }
  return estado;
}

/** Historia lineal de cinco confirmaciones, con un cambio suelto y otro preparado (lab 02). */
export function repoLineal(): EstadoRepositorio {
  return escenarioPorId('lab-02');
}

/**
 * Historia limpia, con carpeta de recetas para mirar (lab 03, ordenar el
 * recetario). Reemplaza al antiguo laboratorio 03, que desaparecio con el
 * SPEC 009 y cuyo contenido se incorporo al 02.
 */
export function repoLimpio(): EstadoRepositorio {
  return escenarioPorId('lab-03');
}

/**
 * Cuatro ramas con destinos distintos (lab 05), una por cada caso de fusion:
 * `tailandesa` cuelga de la punta de main y se fusiona por avance rapido,
 * `azteca` nace antes y toca otros archivos, `criolla` nace ahi mismo y toca
 * **el mismo archivo que main** en otra seccion, de modo que la fusion es
 * automatica, y `andina` toca la misma linea y choca.
 */
export function repoConRamas(): EstadoRepositorio {
  return escenarioPorId('lab-05');
}

/** Rama de trabajo con mensajes que no dicen nada y algo a medias encima (lab 08). */
export function repoConRamaDeTrabajo(): EstadoRepositorio {
  return escenarioPorId('lab-07');
}

/**
 * El laboratorio 07 mirado desde `main`: dos ramas que divergieron de verdad,
 * con la posicion en el tronco. Es la forma que necesitan las ordenes que
 * cambian de rama, fusionan sin conflicto o reordenan.
 */
export function repoConRamaDesdeMain(): EstadoRepositorio {
  // El escenario del 07 trae el curry modificado sin confirmar, y `main` lo
  // tiene distinto: Git no deja cambiar asi, y desde el SPEC 022 el simulador
  // tampoco. Se descarta el cambio antes, que es una de las dos salidas que el
  // enunciado ofrece.
  const limpio = ejecutar(escenarioPorId('lab-07'), 'git restore .').estado;
  const resultado = ejecutar(limpio, 'git switch main');
  if (resultado.error) throw new Error(resultado.salida.map((linea) => linea.texto).join('\n'));
  return resultado.estado;
}
