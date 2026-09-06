/**
 * Modelo de dominio del simulador.
 *
 * Todo lo que hay aqui es codigo puro: no importa React, no toca el documento
 * y no produce efectos de entorno (restriccion R3 del SPEC 001). El estado es
 * inmutable, de modo que cada orden recibe un estado y devuelve uno nuevo.
 *
 * No se versiona contenido de archivos (restriccion R4). Un archivo es un
 * nombre y un estado declarado, nada mas.
 */

/**
 * Estado declarado de un archivo del directorio de trabajo.
 *
 * El SPEC 001 enumera `limpio`, `modificado` y `preparado`. Se agregan
 * `sin-seguimiento`, que el escenario E1 exige, y `en-conflicto`, que el
 * escenario E4 exige. Ambos estan anotados en `docs/arquitectura.md`.
 */
export type EstadoArchivo =
  | 'limpio'
  | 'modificado'
  | 'preparado'
  | 'sin-seguimiento'
  | 'en-conflicto';

/** Archivo del directorio de trabajo. Nombre y estado, sin contenido. */
export interface Archivo {
  readonly nombre: string;
  readonly estado: EstadoArchivo;
}

/** Nodo del grafo. Dos padres significan confirmacion de union. */
export interface Confirmacion {
  /** Identificador corto de siete caracteres hexadecimales. */
  readonly id: string;
  readonly mensaje: string;
  readonly padres: readonly string[];
  /** Carril de dibujo que usara la capa visual del SPEC 002. */
  readonly carril: number;
  readonly autor: string;
  readonly correo: string;
  /** Fecha determinista, derivada del contador del estado. */
  readonly fecha: string;
  /** Nombres de los archivos que la confirmacion registro. */
  readonly archivos: readonly string[];
}

/**
 * Rama: un nombre asociado a un identificador de confirmacion. Nada mas.
 *
 * El carril de dibujo se guarda aparte, en `EstadoRepositorio.carriles`,
 * precisamente para que esta entidad no acumule nada que confunda el concepto
 * que el taller necesita transmitir.
 */
export interface Rama {
  readonly nombre: string;
  readonly id: string;
}

export type TipoEtiqueta = 'simple' | 'anotada';

/** Etiqueta: nombre asociado a una confirmacion, simple o anotada. */
export interface Etiqueta {
  readonly nombre: string;
  readonly id: string;
  readonly tipo: TipoEtiqueta;
  /** Solo las anotadas llevan mensaje. */
  readonly mensaje: string | null;
}

/**
 * Puntero de posicion. Apunta a una rama o directamente a una confirmacion.
 * El segundo caso es el estado desconectado.
 */
export type Puntero =
  | { readonly tipo: 'rama'; readonly rama: string }
  | { readonly tipo: 'confirmacion'; readonly id: string };

/** Entrada del guardado temporal. Se comporta como pila: la mas reciente va al indice cero. */
export interface EntradaGuardado {
  readonly mensaje: string;
  readonly archivos: readonly Archivo[];
  /** Rama sobre la que se guardo, para reproducir el texto de `git stash list`. */
  readonly rama: string;
  /** Confirmacion sobre la que se guardo. */
  readonly idBase: string;
}

/** Entrada del registro de referencias. */
export interface EntradaReflog {
  /** `HEAD` o el nombre de la rama cuya posicion cambio. */
  readonly ref: string;
  readonly id: string;
  readonly idAnterior: string | null;
  /** Operacion que provoco el movimiento: `commit`, `checkout`, `reset`... */
  readonly operacion: string;
  readonly descripcion: string;
}

export interface Remoto {
  readonly nombre: string;
  readonly url: string;
}

/** Configuracion local y global. La local tiene precedencia sobre la global. */
export interface Configuracion {
  readonly local: Readonly<Record<string, string>>;
  readonly global: Readonly<Record<string, string>>;
}

/**
 * Fusion con conflictos pendiente de resolver.
 *
 * `idPrevisto` es el identificador reservado para la confirmacion de union.
 * Se reserva al detectar el conflicto para que la previsualizacion pueda
 * anunciar la confirmacion que la fusion va a producir, y se usa tal cual
 * cuando el participante resuelve y confirma.
 */
export interface FusionEnCurso {
  readonly rama: string;
  readonly idOrigen: string;
  readonly idDestino: string;
  readonly idPrevisto: string;
  readonly conflictos: readonly string[];
  /** Estado de los archivos antes de la fusion, para poder abortarla. */
  readonly archivosPrevios: readonly Archivo[];
}

/** Carril de dibujo asignado a una rama. */
export interface Carril {
  readonly rama: string;
  readonly carril: number;
}

/** Estado completo del repositorio simulado. Inmutable. */
export interface EstadoRepositorio {
  readonly iniciado: boolean;
  readonly directorio: string;
  readonly confirmaciones: readonly Confirmacion[];
  readonly ramas: readonly Rama[];
  readonly etiquetas: readonly Etiqueta[];
  readonly puntero: Puntero;
  readonly archivos: readonly Archivo[];
  readonly guardados: readonly EntradaGuardado[];
  readonly reflog: readonly EntradaReflog[];
  readonly remotos: readonly Remoto[];
  readonly config: Configuracion;
  readonly fusion: FusionEnCurso | null;
  readonly carriles: readonly Carril[];
  /** Contador monotono que hace deterministas los identificadores generados. */
  readonly contador: number;
}

export type TipoLinea = 'salida' | 'error' | 'aviso' | 'exito';

export interface LineaSalida {
  readonly tipo: TipoLinea;
  readonly texto: string;
}

/** Resultado de ejecutar una orden. */
export interface ResultadoOrden {
  readonly estado: EstadoRepositorio;
  readonly salida: readonly LineaSalida[];
  readonly error: boolean;
  /**
   * Confirmaciones que la orden dejo comprometidas pero todavia no
   * materializadas en el grafo. Hoy solo la union pendiente de resolver.
   */
  readonly proyectadas: readonly string[];
  /** La consola debe borrar su historial de lineas. */
  readonly limpiarConsola: boolean;
}

/** Resultado de previsualizar una orden sin aplicarla. */
export interface Previsualizacion {
  readonly estadoResultante: EstadoRepositorio;
  readonly confirmacionesNuevas: readonly string[];
  readonly punteroMovido: boolean;
  readonly salida: readonly LineaSalida[];
  readonly error: boolean;
}
