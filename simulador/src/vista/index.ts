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
  escenarioDeArranque,
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

export type { AvisosReales, EstadoConexion, ResultadoLectura, SesionReal } from './real';
export type { Carpeta } from '../real/navegador';
export { carpetaRecordada, nombreRecordado, recordarCarpeta } from '../real/recordar';
export {
  actualizarSesionReal,
  anotarOrdenReal,
  avisosReales,
  completarEnReal,
  Conexion,
  conectarRepositorio,
  construirPantallaReal,
  estadoDeConexion,
  iniciarSesionReal,
  motivoDeFalla,
  navegadorPuedeConectar,
  reconectarRepositorio,
  seleccionarEnReal,
  SIN_LA_API,
} from './real';
