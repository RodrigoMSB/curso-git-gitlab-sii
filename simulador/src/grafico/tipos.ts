/**
 * Resultado del calculo de posiciones del grafo.
 *
 * Es dato plano: coordenadas y rotulos. No contiene ninguna funcion ni ninguna
 * referencia al estado del motor, de modo que el componente que lo dibuja se
 * limita a recorrerlo.
 */

export interface NodoGrafo {
  readonly id: string;
  readonly mensaje: string;
  readonly x: number;
  readonly y: number;
  readonly carril: number;
  /** Dos padres: se dibuja distinto. */
  readonly esUnion: boolean;
  /** Ninguna referencia la alcanza. Se dibuja atenuada y no se oculta. */
  readonly huerfana: boolean;
  /** Todavia no existe: la produciria la orden que se esta escribiendo. */
  readonly previsualizada: boolean;
  /** Tiene padres que quedaron fuera del limite de dibujo. */
  readonly padresOcultos: boolean;
}

export interface AristaGrafo {
  readonly clave: string;
  readonly desde: string;
  readonly hasta: string;
  readonly trazado: string;
  readonly previsualizada: boolean;
  readonly atenuada: boolean;
}

export type FormaEtiqueta = 'rama' | 'version' | 'puntero';

export interface EtiquetaGrafo {
  readonly clave: string;
  readonly texto: string;
  readonly forma: FormaEtiqueta;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** La rama sobre la que esta parado el participante. */
  readonly actual: boolean;
  /** La rama principal del repositorio, que se distingue de las derivadas. */
  readonly principal: boolean;
  /** Etiqueta de version anotada, que se distingue de la simple. */
  readonly anotada: boolean;
  /** Identificador de la confirmacion a la que pertenece. */
  readonly idConfirmacion: string;
}

export interface EnlacePuntero {
  /** Trazado desde la etiqueta de posicion hasta aquello de lo que cuelga. */
  readonly trazado: string;
  /** De que cuelga: de una rama o directamente de una confirmacion. */
  readonly ancla: 'rama' | 'confirmacion';
}

/**
 * Rotulo suelto del dibujo, sin recuadro ni forma.
 *
 * Hoy solo se usa para nombrar el grupo de confirmaciones huerfanas: el gris
 * las distingue, pero no dice que son (punto 5.6).
 */
export interface RotuloGrafo {
  readonly texto: string;
  readonly x: number;
  readonly y: number;
}

export interface Disposicion {
  readonly nodos: readonly NodoGrafo[];
  readonly aristas: readonly AristaGrafo[];
  readonly etiquetas: readonly EtiquetaGrafo[];
  readonly enlacePuntero: EnlacePuntero | null;
  /** Nombra el grupo de huerfanas. Es nulo cuando no hay ninguna. */
  readonly rotuloHuerfanas: RotuloGrafo | null;
  /** Origen del marco de dibujo. Puede ser negativo por las etiquetas de version. */
  readonly origenX: number;
  readonly origenY: number;
  readonly ancho: number;
  readonly alto: number;
  /** Confirmaciones que quedaron fuera por el limite de dibujo. */
  readonly ocultas: number;
}

/** Medidas del dibujo. Estan aqui para que las pruebas puedan afirmar sobre ellas. */
export const MEDIDAS = {
  margenSuperior: 34,
  margenInferior: 26,
  espacioCarril: 48,
  espacioFila: 58,
  radio: 9,
  separacionEtiqueta: 16,
  altoEtiqueta: 20,
  altoPuntero: 18,
  anchoCaracter: 6.4,
  relleno: 14,
  /** Espacio que ocupa el identificador dibujado a la izquierda del nodo. */
  anchoIdentificador: 62,
  /** Sobre esta cantidad se dibujan solo las mas recientes (punto 5.8). */
  limitePorDefecto: 40,
} as const;
