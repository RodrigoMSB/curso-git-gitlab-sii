/**
 * Punto de entrada del motor.
 *
 * La capa visual del SPEC 002 solo debe importar desde aqui: mientras esta
 * superficie no cambie, la interfaz puede reemplazarse sin tocar la logica
 * (restriccion R3).
 */

export type {
  Archivo,
  Carril,
  Confirmacion,
  Configuracion,
  EntradaGuardado,
  EntradaReflog,
  EstadoArchivo,
  EstadoRepositorio,
  Etiqueta,
  FusionEnCurso,
  LineaSalida,
  Previsualizacion,
  Puntero,
  Rama,
  Remoto,
  ResultadoOrden,
  TipoEtiqueta,
  TipoLinea,
} from './tipos';

export { ejecutar, ejecutarSecuencia, previsualizar } from './motor';

export {
  archivoPorNombre,
  archivosEn,
  carrilDeRama,
  confirmacionPorId,
  estadoVacio,
  estaSeguido,
  etiquetaPorNombre,
  idActual,
  ramaActual,
  ramaPorNombre,
  valorConfig,
} from './estado';

export {
  antepasados,
  archivosCambiados,
  baseComun,
  esAntepasado,
  exclusivasDe,
  historia,
  huerfanas,
} from './grafo';

export { decoracionesDe, resolverReferencia } from './referencias';
export { analizar, tokenizar } from './analizador';
export { ORDENES_GIT, ORDENES_INTERPRETE } from './ordenes/registro';
