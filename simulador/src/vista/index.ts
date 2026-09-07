/**
 * Superficie que consumen los componentes.
 *
 * Los componentes de `src/ui` solo deben importar desde aqui y desde
 * `src/grafico/tipos`. Es lo que mantiene la vista libre de logica de dominio
 * (restriccion R6 y criterio CA7 del SPEC 002).
 */

export type { ColorConsola, Completado, Indicador, Renglon } from './consola';
export { completar, navegarHistorial } from './consola';

export type { Paso, Sesion } from './sesion';
export {
  avanzar,
  cambiarEscenario,
  ejecutarOrden,
  estadoDe,
  iniciarSesion,
  irAPaso,
  renglonesDe,
  retroceder,
  seleccionarConfirmacion,
} from './sesion';

export type {
  AvisoPrevisualizacion,
  ColumnaArea,
  ElementoArea,
  EntradaGuardadoVista,
  OpcionEscenario,
  OpcionesPantalla,
  Paneles,
  Pantalla,
  ResumenBarra,
  SegmentoTiempo,
  TonoElemento,
} from './pantalla';
export { construirPantalla, ESCALA_RELATOR, FILAS_VISIBLES, TEXTO_MINIMO } from './pantalla';
