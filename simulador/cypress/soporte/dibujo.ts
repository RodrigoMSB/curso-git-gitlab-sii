/**
 * Lo que el navegador **pinta**, no lo que el modelo dice (SPEC 011).
 *
 * Las pruebas de punta a punta leian el estado desde los atributos `data-` del
 * documento. Eso es mejor que leer el modelo, pero no alcanza: un atributo esta
 * igual de presente si el dibujo mide cero, si quedo fuera del panel, si esta
 * escondido o si el panel no llego a dibujarse. Las tres veces que el arnes
 * dejo pasar un defecto fue por lo mismo: comprobaba una representacion del
 * hecho y no el hecho.
 *
 * Aqui se mide con `getBoundingClientRect` y `getComputedStyle`, que es lo que
 * el navegador resolvio despues de aplicar la hoja de estilos y la disposicion.
 * Si el circulo de una confirmacion mide cero pixeles, esto lo dice; el
 * atributo `data-confirmacion` no.
 */

export interface CajaPintada {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
}

export interface NodoPintado {
  readonly id: string;
  readonly mensaje: string;
  readonly previsualizada: boolean;
  readonly huerfana: boolean;
  readonly caja: CajaPintada;
  /** `display`, `visibility`, `opacity` y medidas, ya resueltos por el navegador. */
  readonly visible: boolean;
}

export interface EtiquetaPintada {
  readonly texto: string;
  readonly forma: string;
  readonly en: string;
  readonly actual: boolean;
  readonly caja: CajaPintada;
  readonly visible: boolean;
}

/** Las siete piezas de pantalla que el punto 4.1 del SPEC 011 manda evaluar. */
export type Pieza =
  | 'nodos'
  | 'ramas'
  | 'puntero'
  | 'previsualizacion'
  | 'areas'
  | 'guardado'
  | 'tiempo';

export const PIEZAS: readonly Pieza[] = [
  'nodos',
  'ramas',
  'puntero',
  'previsualizacion',
  'areas',
  'guardado',
  'tiempo',
];

export interface DibujoGrafo {
  /** Si el SVG del grafo llego a dibujarse. */
  readonly hay: boolean;
  /** Caja del SVG tal como quedo en la pantalla. */
  readonly caja: CajaPintada | null;
  /** Caja del panel que lo contiene, para saber si el dibujo se le sale. */
  readonly panel: CajaPintada | null;
  readonly ventana: { readonly ancho: number; readonly alto: number };
  readonly nodos: readonly NodoPintado[];
  readonly etiquetas: readonly EtiquetaPintada[];
  readonly aristas: number;
  /** Lo que el panel dice cuando no hay ninguna confirmacion que dibujar. */
  readonly leyendaVacia: string | null;
  /**
   * Huella de cada pieza por separado, con las posiciones ya resueltas.
   *
   * Dos dibujos con los mismos identificadores en lugares distintos dan huellas
   * distintas, que es lo que hace falta para afirmar que algo **se movio** y no
   * solo que cambio de contenido.
   */
  readonly piezas: Readonly<Record<Pieza, string>>;
}

function medir(elemento: Element): CajaPintada {
  const caja = elemento.getBoundingClientRect();
  const redondear = (valor: number): number => Math.round(valor * 10) / 10;
  return {
    x: redondear(caja.x),
    y: redondear(caja.y),
    ancho: redondear(caja.width),
    alto: redondear(caja.height),
  };
}

function seVe(elemento: Element, ventana: Window): boolean {
  const estilo = ventana.getComputedStyle(elemento);
  if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
  if (Number(estilo.opacity) === 0) return false;
  const caja = elemento.getBoundingClientRect();
  return caja.width > 0 && caja.height > 0;
}

function leer(doc: Document): DibujoGrafo {
  const ventana = doc.defaultView;
  if (ventana === null) throw new Error('el documento no tiene ventana');

  const svg = doc.querySelector('svg[aria-label="Grafo de confirmaciones"]');
  const panel = doc.querySelector('section[aria-label="Grafo de confirmaciones"]');

  const nodos: NodoPintado[] = [...doc.querySelectorAll<SVGGElement>('g[data-confirmacion]')].map(
    (grupo) => {
      const circulo = grupo.querySelector('circle');
      return {
        id: grupo.dataset.confirmacion ?? '',
        mensaje: grupo.dataset.mensaje ?? '',
        previsualizada: grupo.dataset.previsualizada === 'si',
        huerfana: grupo.dataset.huerfana === 'si',
        caja: circulo === null ? { x: 0, y: 0, ancho: 0, alto: 0 } : medir(circulo),
        visible: circulo !== null && seVe(circulo, ventana),
      };
    },
  );

  const etiquetas: EtiquetaPintada[] = [
    ...doc.querySelectorAll<SVGGElement>('g[data-etiqueta]'),
  ].map((grupo) => {
    const figura = grupo.querySelector('rect, path');
    return {
      texto: grupo.dataset.etiqueta ?? '',
      forma: grupo.dataset.forma ?? '',
      en: grupo.dataset.en ?? '',
      actual: grupo.dataset.actual === 'si',
      caja: figura === null ? { x: 0, y: 0, ancho: 0, alto: 0 } : medir(figura),
      visible: figura !== null && seVe(figura, ventana),
    };
  });

  /**
   * Posicion dentro del dibujo, no dentro de la pantalla.
   *
   * Medida en pantalla, el grafo entero se corre unos pixeles cada vez que la
   * pagina cambia de alto y aparece o desaparece la barra de desplazamiento. Eso
   * es cierto y no es que el grafo se haya movido: la huella tiene que hablar
   * del dibujo, asi que se resta el origen del SVG.
   */
  const origen = svg === null ? { x: 0, y: 0 } : medir(svg);
  const dentro = (caja: CajaPintada): string =>
    `${Math.round(caja.x - origen.x)},${Math.round(caja.y - origen.y)}`;

  const deNodo = (nodo: NodoPintado): string =>
    `n ${nodo.id} ${dentro(nodo.caja)}${nodo.huerfana ? ' h' : ''}${
      nodo.visible ? '' : ' INVISIBLE'
    }`;
  // La etiqueta lleva de que confirmacion cuelga. Sin eso, confirmar sobre la
  // punta de la rama no cambiaria la huella: la etiqueta se queda en la misma
  // fila del dibujo y lo unico que cambia es a quien apunta, que es justamente
  // lo que el grafo tiene que contar.
  const deEtiqueta = (etiqueta: EtiquetaPintada): string =>
    `e ${etiqueta.forma}:${etiqueta.texto}@${etiqueta.en} ${dentro(etiqueta.caja)}${
      etiqueta.actual ? ' a' : ''
    }${etiqueta.visible ? '' : ' INVISIBLE'}`;

  const piezas: Record<Pieza, string> = {
    nodos: nodos
      .filter((nodo) => !nodo.previsualizada)
      .map(deNodo)
      .join('|'),
    ramas: etiquetas
      .filter((etiqueta) => etiqueta.forma === 'rama' || etiqueta.forma === 'version')
      .map(deEtiqueta)
      .join('|'),
    puntero: etiquetas
      .filter((etiqueta) => etiqueta.forma === 'puntero')
      .map(deEtiqueta)
      .join('|'),
    previsualizacion: [
      ...nodos.filter((nodo) => nodo.previsualizada).map(deNodo),
      ...[...doc.querySelectorAll('path[data-previsualizada="si"]')].map(
        (arista) => `a ${arista.getAttribute('d') ?? ''}`,
      ),
    ].join('|'),
    areas: [...doc.querySelectorAll<HTMLElement>('section[data-columna]')]
      .map(
        (seccion) =>
          `${seccion.dataset.columna ?? ''}:${(seccion.textContent ?? '').replace(/\s+/g, ' ').trim()}`,
      )
      .join('|'),
    guardado: [...doc.querySelectorAll<HTMLElement>('li[data-guardado]')]
      .map((entrada) => entrada.dataset.guardado ?? '')
      .join('|'),
    // La linea de tiempo no lleva atributos de prueba: se lee por su rotulo,
    // que es lo que anuncia el lector de pantalla y por lo tanto ya es publico.
    tiempo: [...doc.querySelectorAll('nav[aria-label] button[aria-label^="Paso "]')]
      .map(
        (boton) =>
          `${boton.getAttribute('aria-label') ?? ''}${
            boton.getAttribute('aria-current') === 'step' ? '*' : ''
          }`,
      )
      .join('|'),
  };

  const vacia = panel === null ? null : panel.querySelector('p');

  return {
    hay: svg !== null,
    caja: svg === null ? null : medir(svg),
    panel: panel === null ? null : medir(panel),
    ventana: { ancho: ventana.innerWidth, alto: ventana.innerHeight },
    nodos,
    etiquetas,
    aristas: doc.querySelectorAll('path[data-desde]').length,
    leyendaVacia: svg === null && vacia !== null ? (vacia.textContent ?? '').trim() : null,
    piezas,
  };
}

/** Mide en la pantalla lo que el grafo dibujo en este instante. */
export function dibujoDelGrafo(): Cypress.Chainable<DibujoGrafo> {
  return cy.document({ log: false }).then((doc) => leer(doc));
}

/** Confirmaciones que de verdad se pintaron, sin contar las de previsualizacion. */
export function nodosSolidosPintados(dibujo: DibujoGrafo): readonly NodoPintado[] {
  return dibujo.nodos.filter((nodo) => !nodo.previsualizada);
}

/** Si una caja cabe dentro de otra, con un pixel de holgura por el redondeo. */
export function cabeDentro(interior: CajaPintada, exterior: CajaPintada): boolean {
  return (
    interior.x >= exterior.x - 1 &&
    interior.y >= exterior.y - 1 &&
    interior.x + interior.ancho <= exterior.x + exterior.ancho + 1 &&
    interior.y + interior.alto <= exterior.y + exterior.alto + 1
  );
}
