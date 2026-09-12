/**
 * Recorridos sobre el grafo de confirmaciones.
 *
 * Todas las funciones son de lectura: reciben el estado y no lo modifican.
 */

import type { Confirmacion, EstadoRepositorio } from './tipos';

/** Indice por identificador, para no recorrer el arreglo en cada consulta. */
export function mapaConfirmaciones(
  estado: EstadoRepositorio,
): ReadonlyMap<string, Confirmacion> {
  const mapa = new Map<string, Confirmacion>();
  for (const confirmacion of estado.confirmaciones) {
    mapa.set(confirmacion.id, confirmacion);
  }
  return mapa;
}

/** Posicion de creacion de cada confirmacion, que define el orden del historial. */
export function indicesDeCreacion(estado: EstadoRepositorio): ReadonlyMap<string, number> {
  const indices = new Map<string, number>();
  estado.confirmaciones.forEach((confirmacion, indice) => {
    indices.set(confirmacion.id, indice);
  });
  return indices;
}

/** Conjunto de antepasados de una confirmacion, incluida ella misma. */
export function antepasados(estado: EstadoRepositorio, id: string): ReadonlySet<string> {
  const mapa = mapaConfirmaciones(estado);
  const vistos = new Set<string>();
  const pendientes: string[] = [id];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (actual === undefined || vistos.has(actual)) continue;
    const confirmacion = mapa.get(actual);
    if (confirmacion === undefined) continue;
    vistos.add(actual);
    pendientes.push(...confirmacion.padres);
  }
  return vistos;
}

/** Antepasados de un conjunto de confirmaciones. */
export function antepasadosDeVarias(
  estado: EstadoRepositorio,
  ids: readonly string[],
): ReadonlySet<string> {
  const union = new Set<string>();
  for (const id of ids) {
    for (const antepasado of antepasados(estado, id)) union.add(antepasado);
  }
  return union;
}

/** Indica si `candidato` esta contenido en la historia de `descendiente`. */
export function esAntepasado(
  estado: EstadoRepositorio,
  candidato: string,
  descendiente: string,
): boolean {
  return antepasados(estado, descendiente).has(candidato);
}

/**
 * Antepasado comun mas reciente de dos confirmaciones.
 *
 * Entre todos los antepasados compartidos se elige el creado mas tarde, que en
 * los grafos que produce el simulador equivale a la base de fusion de Git.
 */
export function baseComun(
  estado: EstadoRepositorio,
  primera: string,
  segunda: string,
): string | null {
  const deLaPrimera = antepasados(estado, primera);
  const deLaSegunda = antepasados(estado, segunda);
  const indices = indicesDeCreacion(estado);
  let mejor: string | null = null;
  let mejorIndice = -1;
  for (const id of deLaPrimera) {
    if (!deLaSegunda.has(id)) continue;
    const indice = indices.get(id) ?? -1;
    if (indice > mejorIndice) {
      mejor = id;
      mejorIndice = indice;
    }
  }
  return mejor;
}

/**
 * Confirmaciones alcanzables desde las referencias dadas, **de la mas reciente
 * a la mas antigua por fecha**, que es como las ordena `git log`.
 *
 * Antes se ordenaban por orden de creacion (decision 4.7), y la razon escrita
 * era «al no haber reloj real». El SPEC 010 le puso reloj: desde entonces cada
 * confirmacion guarda su instante en segundos y los escenarios declaran fechas
 * concretas. El supuesto caduco ahi y nadie lo miro hasta el SPEC 012.
 *
 * En una sola rama los dos ordenes coinciden y el cambio no se nota. Donde si
 * se nota es en `git log --all` sobre un escenario cuyas ramas se cruzan en el
 * tiempo: el laboratorio 07 declara primero las cuatro confirmaciones de `main`
 * y despues las cuatro de la rama de trabajo, que ocurrieron **entre medio**.
 * Con el orden de creacion el simulador mostraba las cuatro de la rama arriba
 * y las de main debajo; Git las intercala por fecha. Comprobado contra Git
 * sobre un repositorio con esa misma forma.
 *
 * Ante dos confirmaciones del mismo instante se conserva el orden de creacion
 * invertido, que es lo que el motor hacia antes: no hay nada mejor con que
 * desempatar y asi el cambio no altera lo que ya estaba bien.
 */
export function historia(
  estado: EstadoRepositorio,
  desde: readonly string[],
): readonly Confirmacion[] {
  const alcanzables = antepasadosDeVarias(estado, desde);
  const creacion = new Map(estado.confirmaciones.map((confirmacion, indice) => [confirmacion.id, indice]));
  return estado.confirmaciones
    .filter((confirmacion) => alcanzables.has(confirmacion.id))
    .sort(
      (una, otra) =>
        otra.epoca - una.epoca ||
        (creacion.get(otra.id) ?? 0) - (creacion.get(una.id) ?? 0),
    );
}

/**
 * Confirmaciones alcanzables desde `desde` que no lo son desde `excluyendo`,
 * de la mas antigua a la mas reciente. Es el conjunto que el rebase reescribe.
 */
export function exclusivasDe(
  estado: EstadoRepositorio,
  desde: string,
  excluyendo: string,
): readonly Confirmacion[] {
  const incluidas = antepasados(estado, desde);
  const descartadas = antepasados(estado, excluyendo);
  return estado.confirmaciones.filter(
    (confirmacion) => incluidas.has(confirmacion.id) && !descartadas.has(confirmacion.id),
  );
}

/** Identificadores a los que apunta alguna referencia viva. */
export function puntasVivas(estado: EstadoRepositorio): readonly string[] {
  const puntas: string[] = [];
  for (const rama of estado.ramas) puntas.push(rama.id);
  for (const etiqueta of estado.etiquetas) puntas.push(etiqueta.id);
  for (const guardado of estado.guardados) puntas.push(guardado.idBase);
  if (estado.puntero.tipo === 'confirmacion') puntas.push(estado.puntero.id);
  return puntas;
}

/**
 * Confirmaciones que ya no alcanza ninguna referencia.
 *
 * El motor nunca las borra: quedan disponibles para que el participante las
 * recupere con el registro de referencias, que es justamente lo que los puntos
 * 8.4 y 8.5 del SPEC 001 quieren mostrar.
 */
export function huerfanas(estado: EstadoRepositorio): readonly Confirmacion[] {
  const vivas = antepasadosDeVarias(estado, puntasVivas(estado));
  return estado.confirmaciones.filter((confirmacion) => !vivas.has(confirmacion.id));
}

/** Archivos que cambiaron entre una base y una punta, sin contar la base. */
export function archivosCambiados(
  estado: EstadoRepositorio,
  base: string | null,
  punta: string,
): ReadonlySet<string> {
  const cambiados = new Set<string>();
  const incluidas = antepasados(estado, punta);
  const descartadas = base === null ? new Set<string>() : antepasados(estado, base);
  for (const confirmacion of estado.confirmaciones) {
    if (!incluidas.has(confirmacion.id) || descartadas.has(confirmacion.id)) continue;
    for (const archivo of confirmacion.archivos) cambiados.add(archivo);
  }
  return cambiados;
}
