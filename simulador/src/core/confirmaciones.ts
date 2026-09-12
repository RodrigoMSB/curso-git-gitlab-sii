/**
 * Fabrica de confirmaciones.
 *
 * Concentra la creacion de nodos del grafo para que el identificador, la fecha
 * y el contador se generen siempre de la misma manera, la use `git commit`, el
 * rebase, la reversion o la fusion.
 */

import { arbolCon, arbolDe, textosPreparados } from './contenido';
import { autorActual, idsUsados } from './estado';
import { epocaDeterminista, fechaDeEpoca, generarId } from './identificadores';
import type { Confirmacion, EstadoRepositorio } from './tipos';

export interface DatosConfirmacion {
  readonly mensaje: string;
  readonly padres: readonly string[];
  readonly archivos: readonly string[];
  /** Nombres que la confirmacion saca del seguimiento. */
  readonly borrados?: readonly string[];
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
  /** Instante en segundos desde la epoca. Sin declarar, lo pone el contador. */
  readonly epoca?: number;
  /**
   * Texto con el que cada archivo registrado queda en el arbol.
   *
   * Sin declarar se toma del area de preparacion, que es lo que hace
   * `git commit`. Lo declaran las ordenes que confirman algo que no esta en el
   * directorio de trabajo: la reversion, que registra el texto anterior al
   * error, y el rebase, que copia el texto de la confirmacion original.
   */
  readonly contenidos?: Readonly<Record<string, string>>;
  /**
   * Arbol del que parte esta confirmacion. Sin declarar, el del primer padre.
   * Lo declara el rebase, que apoya cada copia sobre la base nueva.
   */
  readonly arbolBase?: Readonly<Record<string, string>>;
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

  const epoca = datos.epoca ?? epocaDeterminista(estado.contador);

  // El arbol es una foto completa, como en Git: se copia el del padre y se
  // reemplaza lo que esta confirmacion cambio. Los textos que no cambiaron
  // siguen siendo la misma cadena, de modo que la foto no cuesta memoria.
  const base = datos.arbolBase ?? arbolDe(estado, datos.padres[0] ?? null);
  const contenidos = datos.contenidos ?? textosPreparados(estado, datos.archivos);
  const arbol = arbolCon(base, contenidos, datos.borrados ?? []);

  const confirmacion: Confirmacion = {
    id,
    mensaje: datos.mensaje,
    padres: datos.padres,
    carril: datos.carril,
    autor: datos.autor ?? autor.nombre,
    correo: datos.correo ?? autor.correo,
    epoca,
    fecha: fechaDeEpoca(epoca),
    archivos: datos.archivos,
    borrados: datos.borrados ?? [],
    arbol,
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
