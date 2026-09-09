/**
 * Descripcion declarativa de un escenario de laboratorio.
 *
 * Un escenario es un dato, no un guion: enumera las confirmaciones, las ramas,
 * las etiquetas y el estado del directorio de trabajo. El constructor lo
 * traduce a un `EstadoRepositorio`.
 *
 * **Esta declaracion es la unica fuente de la forma del escenario** (seccion 1
 * del SPEC 007). De ella salen dos cosas: el estado inicial que carga el
 * simulador y, por comparacion en la suite, el repositorio que `preparar.sh`
 * arma en el disco del participante. Si las dos se declararan por separado se
 * desincronizarian, y el participante veria dos repositorios distintos sin
 * entender por que.
 *
 * Lo que la declaracion NO lleva es el contenido de los archivos. El simulador
 * no modela contenido (restriccion R4 del SPEC 001) y no tendria donde
 * mostrarlo; los bytes viven en `preparar.sh`, que es quien los necesita. La
 * razon esta en la seccion 23 de docs/arquitectura.md.
 */

import type { Archivo, Remoto, TipoEtiqueta } from '../core/tipos';

/** Confirmacion declarada. Los padres se nombran por clave interna, no por identificador. */
export interface ConfirmacionDeclarada {
  /** Nombre con el que las demas declaraciones se refieren a esta confirmacion. */
  readonly clave: string;
  readonly mensaje: string;
  /** Archivos que la confirmacion registro. */
  readonly archivos: readonly string[];
  readonly padres: readonly string[];
  readonly carril: number;
  /** Quien firma. Sin declarar, la firma el participante del taller. */
  readonly autor?: string;
  readonly correo?: string;
  /**
   * Instante en segundos desde la epoca, la misma unidad que `preparar.sh`
   * usa para fijar las fechas en el disco.
   */
  readonly epoca?: number;
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

/** Entrada del guardado temporal declarada. */
export interface GuardadoDeclarado {
  readonly mensaje: string;
  readonly archivos: readonly Archivo[];
  readonly rama: string;
  /** Clave de la confirmacion sobre la que se guardo. */
  readonly sobre: string;
}

export interface EscenarioDeclarado {
  /** Identificador del escenario: `lab-01`, `lab-02`... */
  readonly id: string;
  /** Numero del laboratorio al que corresponde. */
  readonly laboratorio: number;
  /** Sesion del taller en la que se dicta ese laboratorio. */
  readonly sesion: number;
  readonly titulo: string;
  /** Que se practica sobre este escenario. Lo usa la interfaz del SPEC 002. */
  readonly proposito: string;
  readonly directorio: string;
  readonly configuracion: Readonly<Record<string, string>>;
  /**
   * Si el repositorio ya existe. Solo el laboratorio 01 arranca sin el, porque
   * ahi crear el repositorio es el ejercicio.
   */
  readonly iniciado?: boolean;
  readonly confirmaciones: readonly ConfirmacionDeclarada[];
  readonly ramas: readonly RamaDeclarada[];
  readonly etiquetas: readonly EtiquetaDeclarada[];
  /** Nombre de la rama sobre la que arranca el participante. */
  readonly posicion: string;
  readonly archivos: readonly Archivo[];
  readonly remotos: readonly Remoto[];
  readonly guardados?: readonly GuardadoDeclarado[];
  /**
   * Anotacion para el relator y para el informe: que parte del escenario no se
   * puede reflejar con el motor de hoy. Vacia cuando se refleja entero.
   */
  readonly sinReflejar?: readonly string[];
}
