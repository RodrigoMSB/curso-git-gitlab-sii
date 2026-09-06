/**
 * Descripcion declarativa de un escenario.
 *
 * Un escenario es un dato, no un guion: enumera las confirmaciones, las ramas,
 * las etiquetas y el estado del directorio de trabajo. El constructor lo
 * traduce a un `EstadoRepositorio`.
 */

import type { Archivo, Remoto, TipoEtiqueta } from '../core/tipos';

/** Confirmacion declarada. Los padres se nombran por clave interna, no por identificador. */
export interface ConfirmacionDeclarada {
  /** Nombre con el que las demas declaraciones se refieren a esta confirmacion. */
  readonly clave: string;
  readonly mensaje: string;
  readonly archivos: readonly string[];
  readonly padres: readonly string[];
  readonly carril: number;
}

export interface RamaDeclarada {
  readonly nombre: string;
  /** Clave de la confirmacion a la que apunta. */
  readonly en: string;
  readonly carril: number;
}

export interface EtiquetaDeclarada {
  readonly nombre: string;
  readonly en: string;
  readonly tipo: TipoEtiqueta;
  readonly mensaje: string | null;
}

export interface EscenarioDeclarado {
  readonly id: string;
  readonly sesion: number;
  readonly titulo: string;
  /** Que se practica sobre este escenario. Lo usa la interfaz del SPEC 002. */
  readonly proposito: string;
  readonly directorio: string;
  readonly configuracion: Readonly<Record<string, string>>;
  readonly confirmaciones: readonly ConfirmacionDeclarada[];
  readonly ramas: readonly RamaDeclarada[];
  readonly etiquetas: readonly EtiquetaDeclarada[];
  /** Nombre de la rama sobre la que arranca el participante. */
  readonly posicion: string;
  readonly archivos: readonly Archivo[];
  readonly remotos: readonly Remoto[];
}
