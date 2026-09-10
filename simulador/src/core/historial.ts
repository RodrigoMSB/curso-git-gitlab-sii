/**
 * Filtrado y formato del historial (punto 4.4 del SPEC 010).
 *
 * Hasta el SPEC 010 el motor recibia `--author`, `--since` y `--format`, los
 * descartaba y mostraba la historia entera. El participante veia cinco
 * confirmaciones donde Git le mostraba dos y no tenia como notarlo: es el peor
 * caso que el contrato viene a eliminar.
 *
 * El compromiso es **por forma y no por valor**. `--author` funciona con
 * cualquier nombre, no solo con el que trae el enunciado, porque hay pasos que
 * invitan a tantear y con un contrato literal el participante concluiria que
 * la orden esta mala.
 */

import { fechaCorta } from './identificadores';
import type { Confirmacion } from './tipos';

/** Lo que se le pide al historial ademas de por donde empezar. */
export interface FiltrosHistorial {
  /** Coincidencia parcial sobre el nombre o el correo, como en Git. */
  readonly autor: string | null;
  /** Instante minimo, en segundos desde la epoca. */
  readonly desde: number | null;
  /** Instante maximo. */
  readonly hasta: number | null;
  /** Ruta o carpeta que la confirmacion tiene que haber tocado. */
  readonly archivo: string | null;
}

export const SIN_FILTROS: FiltrosHistorial = {
  autor: null,
  desde: null,
  hasta: null,
  archivo: null,
};

/** Si la confirmacion registro ese archivo, o algo dentro de esa carpeta. */
function tocaElArchivo(confirmacion: Confirmacion, ruta: string): boolean {
  const carpeta = ruta.endsWith('/') ? ruta : `${ruta}/`;
  return confirmacion.archivos.some(
    (nombre) => nombre === ruta || nombre.startsWith(carpeta),
  );
}

export function aplicarFiltros(
  confirmaciones: readonly Confirmacion[],
  filtros: FiltrosHistorial,
): readonly Confirmacion[] {
  return confirmaciones.filter((confirmacion) => {
    if (filtros.autor !== null) {
      const aguja = filtros.autor.toLowerCase();
      const pajar = `${confirmacion.autor} <${confirmacion.correo}>`.toLowerCase();
      if (!pajar.includes(aguja)) return false;
    }
    if (filtros.desde !== null && confirmacion.epoca < filtros.desde) return false;
    if (filtros.hasta !== null && confirmacion.epoca > filtros.hasta) return false;
    if (filtros.archivo !== null && !tocaElArchivo(confirmacion, filtros.archivo)) return false;
    return true;
  });
}

/**
 * Interpreta la fecha de `--since` y `--until`.
 *
 * Se aceptan las formas absolutas, que son las que un enunciado escribe, y las
 * relativas en dias, semanas y meses, que son las que alguien tantea. Lo que no
 * se reconozca devuelve `null` y la orden lo dice en vez de filtrar por un
 * valor inventado.
 */
export function instanteDe(texto: string, ahora: number): number | null {
  const limpio = texto.trim();

  const relativa = /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/i.exec(limpio);
  const cantidadTexto = relativa?.[1];
  const unidad = relativa?.[2]?.toLowerCase();
  if (cantidadTexto !== undefined && unidad !== undefined) {
    const cantidad = Number.parseInt(cantidadTexto, 10);
    const dia = 86_400;
    const segundos = unidad.startsWith('day')
      ? dia
      : unidad.startsWith('week')
        ? 7 * dia
        : unidad.startsWith('month')
          ? 30 * dia
          : 365 * dia;
    return ahora - cantidad * segundos;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(limpio)) return Date.parse(`${limpio}T00:00:00Z`) / 1000;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(limpio)) {
    const conSegundos = limpio.length === 16 ? `${limpio}:00` : limpio;
    return Date.parse(`${conSegundos.replace(' ', 'T')}Z`) / 1000;
  }
  return null;
}

/**
 * Los cuatro especificadores que el guion usa (punto 4.4).
 *
 * No se implementa el resto a proposito: lo que no este aqui se responde como
 * no implementado, con el especificador nombrado, en vez de escribirlo tal cual
 * y dejar al participante creyendo que Git le devolvio eso.
 */
export const ESPECIFICADORES = ['%h', '%H', '%an', '%ad', '%s'] as const;

/** Los `%algo` que aparecen en el formato y que no estan en la lista de arriba. */
export function especificadoresFuera(formato: string): readonly string[] {
  const conocidos = new Set<string>(ESPECIFICADORES);
  const encontrados = formato.match(/%[a-zA-Z]{1,2}/g) ?? [];
  return [...new Set(encontrados.filter((uno) => !conocidos.has(uno)))];
}

/** Escribe una confirmacion con el formato pedido. `--date=short` acorta la fecha. */
export function aplicarFormato(
  confirmacion: Confirmacion,
  formato: string,
  fechaCortaPedida: boolean,
): string {
  const fecha = fechaCortaPedida ? fechaCorta(confirmacion.epoca) : confirmacion.fecha;
  return formato
    .replaceAll('%H', confirmacion.id)
    .replaceAll('%h', confirmacion.id)
    .replaceAll('%an', confirmacion.autor)
    .replaceAll('%ad', fecha)
    .replaceAll('%s', confirmacion.mensaje);
}
