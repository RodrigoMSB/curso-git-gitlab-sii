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
  /**
   * El mensaje en una linea, como `git log --oneline`, cortado con puntos
   * suspensivos si no cabe (SPEC 029, 1.1). El completo es `mensaje`.
   */
  readonly mensajeVisible: string;
  /** Donde empieza el mensaje: a la derecha de los carriles y de las etiquetas de su fila. */
  readonly mensajeX: number;
}

export interface AristaGrafo {
  readonly clave: string;
  readonly desde: string;
  readonly hasta: string;
  readonly trazado: string;
  readonly previsualizada: boolean;
  readonly atenuada: boolean;
  /**
   * La arista toma el color de la rama que dibuja: la de la derivada que se
   * abre o que vuelve, o la principal si no sale de su carril (SPEC 013).
   */
  readonly derivada: boolean;
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
  /**
   * El mismo trazado, medido desde la esquina de la etiqueta de posicion.
   *
   * El puntero se desliza al cambiar de rama (SPEC 013, punto 6.1), y el trazo
   * que lo une a su rama tiene que viajar con el: se dibuja dentro del mismo
   * grupo, que es lo que se mueve.
   */
  readonly relativo: string;
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
  /**
   * El ancho sin los mensajes: lo que se hace caber en el panel apretando
   * carriles e identificadores (SPEC 017). Los mensajes usan lo que sobra, y si
   * no sobra, el panel se desplaza (SPEC 029).
   */
  readonly anchoSinMensajes: number;
  /** Confirmaciones que quedaron fuera por el limite de dibujo. */
  readonly ocultas: number;
  /** Separacion entre filas con que se dibujo: menor que la de `MEDIDAS` si hubo que apretar. */
  readonly espacioFila: number;
  /** Separacion entre carriles con que se dibujo: menor que la de `MEDIDAS` si hubo que apretar. */
  readonly espacioCarril: number;
  /**
   * Si se dibujan los identificadores. Con la consola muy ancha es lo primero
   * que se deja fuera, antes que una rama (SPEC 017).
   */
  readonly identificadores: boolean;
  /**
   * Etiquetas de rama y puntero que ni apretando caben en el alto disponible.
   * La pantalla las nombra en vez de dejarlas fuera en silencio (SPEC 016).
   */
  readonly fueraDeVista: readonly string[];
}

/** Medidas del dibujo. Estan aqui para que las pruebas puedan afirmar sobre ellas. */
export const MEDIDAS = {
  margenSuperior: 38,
  margenInferior: 28,
  espacioCarril: 54,
  espacioFila: 62,
  /** Once: en proyeccion comprimida los nodos chicos desaparecen (SPEC 013, 2.1). */
  radio: 11,
  separacionEtiqueta: 14,
  altoEtiqueta: 24,
  altoPuntero: 22,
  /** Ancho de un caracter de la letra monoespaciada de doce pixeles de las etiquetas. */
  anchoCaracter: 7.3,
  relleno: 12,
  /** Espacio que ocupa el identificador dibujado a la izquierda del nodo. */
  anchoIdentificador: 70,
  /**
   * Sobre esta cantidad se dibujan solo las mas recientes (punto 5.8). Desde el
   * SPEC 029 el panel se desplaza y no hace falta cortar: es solo un tope de
   * seguridad, lejos de lo que llega a tener un laboratorio.
   */
  limitePorDefecto: 400,
  /** Separacion entre lo ultimo de la fila y su mensaje. */
  separacionMensaje: 16,
  /** Mas largo que esto, el mensaje se corta aunque haya sitio. */
  mensajeMaximo: 72,
  /** Aunque no quepa, el mensaje muestra al menos esto, y el panel se desplaza. */
  mensajeMinimo: 24,
} as const;
