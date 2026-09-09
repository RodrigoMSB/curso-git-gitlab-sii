/**
 * Fabrica de confirmaciones.
 *
 * Concentra la creacion de nodos del grafo para que el identificador, la fecha
 * y el contador se generen siempre de la misma manera, la use `git commit`, el
 * rebase, la reversion o la fusion.
 */

import { autorActual, idsUsados } from './estado';
import { fechaDeterminista, generarId } from './identificadores';
import type { Confirmacion, EstadoRepositorio } from './tipos';

export interface DatosConfirmacion {
  readonly mensaje: string;
  readonly padres: readonly string[];
  readonly archivos: readonly string[];
  readonly carril: number;
  /** Identificador reservado de antemano, como el de una fusion con conflictos. */
  readonly idForzado?: string;
  /** Marca que distingue copias del rebase de sus originales. */
  readonly matiz?: string;
  /**
   * Autor y fecha declarados. Los usan los escenarios de laboratorio, que
   * reproducen una historia escrita por varias personas en fechas concretas.
   * Sin declarar, se toman del estado y del contador, como en toda orden que
   * el participante ejecuta.
   */
  readonly autor?: string;
  readonly correo?: string;
  readonly fecha?: string;
}

export function agregarConfirmacion(
  estado: EstadoRepositorio,
  datos: DatosConfirmacion,
): { readonly estado: EstadoRepositorio; readonly confirmacion: Confirmacion } {
  const autor = autorActual(estado);
  const semilla = [
    datos.mensaje,
    datos.padres.join(','),
    datos.archivos.join(','),
    datos.matiz ?? '',
    String(estado.contador),
  ].join('|');

  const id = datos.idForzado ?? generarId(semilla, idsUsados(estado));

  const confirmacion: Confirmacion = {
    id,
    mensaje: datos.mensaje,
    padres: datos.padres,
    carril: datos.carril,
    autor: datos.autor ?? autor.nombre,
    correo: datos.correo ?? autor.correo,
    fecha: datos.fecha ?? fechaDeterminista(estado.contador),
    archivos: datos.archivos,
  };

  return {
    estado: {
      ...estado,
      confirmaciones: [...estado.confirmaciones, confirmacion],
      contador: estado.contador + 1,
    },
    confirmacion,
  };
}

/** Reserva un identificador sin crear todavia la confirmacion. */
export function reservarId(estado: EstadoRepositorio, semilla: string): string {
  return generarId(`${semilla}|${estado.contador}`, idsUsados(estado));
}

/** Resumen de archivos con el formato que Git usa tras confirmar. */
export function resumenArchivos(archivos: readonly string[]): string {
  const cantidad = archivos.length;
  const palabra = cantidad === 1 ? 'file' : 'files';
  return ` ${cantidad} ${palabra} changed`;
}
