/**
 * Calculo de posiciones del grafo de confirmaciones.
 *
 * Logica pura, fuera de los componentes, tal como pide el punto 5.2 del SPEC
 * 002: recibe el estado del motor y devuelve coordenadas. No importa React, no
 * mide el documento y no decide nada sobre Git; se limita a leer el modelo.
 *
 * Orientacion fija (punto 5.1): las confirmaciones mas recientes arriba, las
 * ramas desplegandose hacia la derecha.
 */

import { RAMA_POR_DEFECTO } from '../core/estado';
import type { Confirmacion, EstadoRepositorio } from '../core/tipos';
import {
  MEDIDAS,
  type AristaGrafo,
  type Disposicion,
  type EnlacePuntero,
  type EtiquetaGrafo,
  type NodoGrafo,
  type RotuloGrafo,
} from './tipos';

export interface OpcionesDisposicion {
  /** Cantidad maxima de confirmaciones dibujadas. */
  readonly limite: number;
  /** Confirmaciones que la orden en curso produciria, dibujadas discontinuas. */
  readonly previsualizadas: readonly string[];
  /**
   * Alto disponible, en unidades del dibujo, o `null` si no hay tope.
   *
   * Cuando el grafo no cabe, se aprieta el espacio **entre** filas hasta
   * `FILA_MINIMA` (SPEC 016). Los nodos, las lineas y la letra no se tocan: el
   * SPEC 013 los agrando para que se vean proyectados, y achicarlos para hacer
   * sitio desharia justo eso.
   */
  readonly altoMaximo: number | null;
  /**
   * Ancho disponible, en unidades del dibujo, o `null` si no hay tope.
   *
   * El relator reparte el ancho entre la consola y el grafo (SPEC 017), y con
   * la consola al maximo el grafo tiene que seguir mostrando cada rama. Se
   * aprieta primero la separacion entre carriles y despues, si hace falta, se
   * dejan de dibujar los identificadores. Los nodos, las lineas y la letra no
   * se tocan.
   */
  readonly anchoMaximo: number | null;
  /**
   * Ramas de seguimiento remoto, como `origin/main` (SPEC 020, 2.2). Solo las
   * trae un repositorio real: el motor no modela remotos, y los escenarios no
   * las tienen. Se dibujan como ramas con otra forma, y lo que alcanzan cuenta
   * como vivo.
   */
  readonly ramasRemotas: readonly { readonly nombre: string; readonly id: string }[];
}

const POR_DEFECTO: OpcionesDisposicion = {
  limite: MEDIDAS.limitePorDefecto,
  previsualizadas: [],
  altoMaximo: null,
  anchoMaximo: null,
  ramasRemotas: [],
};

/**
 * La separacion entre carriles mas apretada que se admite: el diametro de un
 * nodo mas diez. Dos carriles vecinos no comparten fila, asi que no se tocan.
 */
export const CARRIL_MINIMO = 32;

/** Con que medidas se dibuja: las de `MEDIDAS` o las apretadas para caber. */
interface Geometria {
  readonly fila: number;
  readonly carril: number;
  readonly identificadores: boolean;
}

/**
 * El espacio entre filas mas apretado que se admite: el diametro de un nodo
 * mas doce, que deja ver el tramo de linea entre dos confirmaciones y separa
 * las etiquetas de filas vecinas, que miden veinticuatro.
 */
export const FILA_MINIMA = 34;

/**
 * Por debajo de este espacio entre filas el puntero ya no cabe colgado bajo su
 * rama: chocaria con la etiqueta de la fila siguiente. Pasa al costado.
 */
export const FILA_PUNTERO_DEBAJO = MEDIDAS.altoEtiqueta + 10 + MEDIDAS.altoPuntero + 4;

function anchoDeTexto(texto: string): number {
  return Math.round(texto.length * MEDIDAS.anchoCaracter + MEDIDAS.relleno * 2);
}

/**
 * Confirmacion que la fusion dejo comprometida pero todavia no materializada.
 *
 * El motor reserva el identificador de la union al detectar el conflicto y
 * guarda en el estado de que confirmaciones cuelga. Aqui solo se leen esos
 * campos para poder dibujar el nodo; no se decide nada sobre la fusion.
 */
function confirmacionProyectada(
  estado: EstadoRepositorio,
  id: string,
): Confirmacion | null {
  const fusion = estado.fusion;
  if (fusion === null || fusion.idPrevisto !== id) return null;
  return {
    id,
    mensaje: `Merge branch '${fusion.rama}'`,
    padres: [fusion.idDestino, fusion.idOrigen],
    carril: 0,
    autor: '',
    correo: '',
    epoca: 0,
    fecha: '',
    archivos: [],
    borrados: [],
    arbol: {},
  };
}

/**
 * Asigna carriles de dibujo a un grupo de confirmaciones.
 *
 * Recorre de la mas reciente a la mas antigua manteniendo un carril reservado
 * por cada linea de descendencia abierta. El primer padre continua en el carril
 * de su hijo y los demas abren uno nuevo.
 *
 * `puntasPrioritarias` reserva carriles antes de empezar, en el orden dado.
 * Asi la rama principal se queda en la columna de la izquierda aunque sus
 * confirmaciones sean las mas antiguas, que es como se dibuja a mano y como lo
 * muestra el registro de Git.
 */
function asignarCarriles(
  confirmaciones: readonly Confirmacion[],
  puntasPrioritarias: readonly string[] = [],
): ReadonlyMap<string, number> {
  const carriles: (string | null)[] = [];
  const asignados = new Map<string, number>();
  const presentes = new Set(confirmaciones.map((confirmacion) => confirmacion.id));

  const primerLibre = (): number => {
    const libre = carriles.indexOf(null);
    if (libre >= 0) return libre;
    carriles.push(null);
    return carriles.length - 1;
  };

  const reservar = (id: string): void => {
    if (carriles.includes(id)) return;
    carriles[primerLibre()] = id;
  };

  for (const punta of puntasPrioritarias) {
    if (presentes.has(punta)) reservar(punta);
  }

  for (const confirmacion of confirmaciones) {
    let carril = carriles.indexOf(confirmacion.id);
    if (carril < 0) {
      carril = primerLibre();
      carriles[carril] = confirmacion.id;
    }
    asignados.set(confirmacion.id, carril);
    carriles[carril] = null;

    const [primerPadre, ...otrosPadres] = confirmacion.padres;
    if (primerPadre !== undefined && presentes.has(primerPadre)) {
      const yaAbierto = carriles.indexOf(primerPadre);
      if (yaAbierto < 0) {
        carriles[carril] = primerPadre;
      } else if (carril < yaAbierto) {
        // Se prefiere el carril de mas a la izquierda, como hace el registro de Git.
        carriles[yaAbierto] = null;
        carriles[carril] = primerPadre;
      }
    }
    for (const padre of otrosPadres) {
      if (presentes.has(padre)) reservar(padre);
    }
  }

  return asignados;
}

/**
 * Reparte los carriles entre las confirmaciones vivas y las huerfanas.
 *
 * Las huerfanas se llevan columnas propias, a la derecha de todo lo vivo. Sin
 * esa separacion, las copias que produce el rebase caerian en la misma columna
 * que sus originales y el dibujo daria a entender que las confirmaciones se
 * deslizaron hacia otra base, que es justo lo que el punto 6.4 prohibe sugerir.
 */
function repartirCarriles(
  visibles: readonly Confirmacion[],
  vivas: ReadonlySet<string>,
  puntasPrioritarias: readonly string[],
): ReadonlyMap<string, number> {
  const conReferencia = visibles.filter((confirmacion) => vivas.has(confirmacion.id));
  const sinReferencia = visibles.filter((confirmacion) => !vivas.has(confirmacion.id));

  const carrilesVivos = asignarCarriles(conReferencia, puntasPrioritarias);
  const reparto = new Map(carrilesVivos);

  if (sinReferencia.length === 0) return reparto;

  const primerCarrilLibre =
    conReferencia.length === 0 ? 0 : Math.max(...carrilesVivos.values()) + 1;

  for (const [id, carril] of asignarCarriles(sinReferencia)) {
    reparto.set(id, carril + primerCarrilLibre);
  }
  return reparto;
}

/**
 * Trazado entre una confirmacion y uno de sus padres.
 *
 * En el mismo carril, una recta. Entre carriles, la curva ocurre **en la
 * junta** y el resto es recto (SPEC 013, punto 2.3): una rama que se abre dobla
 * justo encima del punto de donde sale y sube derecha por su carril; una union
 * baja derecha y dobla justo debajo de la confirmacion que la cierra. Antes la
 * curva se repartia entre las dos puntas, y una rama de cinco filas se leia
 * como una diagonal que no decia ni donde se abrio ni donde se cerro.
 *
 * `enElHijo` dice en que punta esta la junta: en el hijo para una union, en el
 * padre para una rama que se abre.
 */
function trazadoEntre(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  enElHijo: boolean,
  fila: number,
): string {
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const tramo = Math.min(fila - MEDIDAS.radio * 2, y2 - y1);
  if (enElHijo) {
    const fin = y1 + tramo;
    const medio = (y1 + fin) / 2;
    const curva = `M ${x1} ${y1} C ${x1} ${medio}, ${x2} ${medio}, ${x2} ${fin}`;
    return fin >= y2 ? curva : `${curva} L ${x2} ${y2}`;
  }
  const inicio = y2 - tramo;
  const medio = (inicio + y2) / 2;
  const curva = `C ${x1} ${medio}, ${x2} ${medio}, ${x2} ${y2}`;
  return inicio <= y1 ? `M ${x1} ${y1} ${curva}` : `M ${x1} ${y1} L ${x1} ${inicio} ${curva}`;
}

/**
 * Devuelve las posiciones de todo lo que el grafo dibuja.
 *
 * Las confirmaciones huerfanas se incluyen siempre: el punto 5.6 exige que
 * permanezcan en pantalla, atenuadas, porque son lo que hace comprensible el
 * registro de referencias.
 */
export function disponer(
  estado: EstadoRepositorio,
  opciones: Partial<OpcionesDisposicion> = {},
): Disposicion {
  const completas = { ...POR_DEFECTO, ...opciones };
  let geometria: Geometria = { fila: MEDIDAS.espacioFila, carril: MEDIDAS.espacioCarril, identificadores: true };
  let actual = disponerCon(estado, completas, geometria);
  const { altoMaximo, anchoMaximo } = completas;

  // Alto: lo que no depende de la separacion entre filas se mantiene; lo que
  // si, se reparte en el alto que hay (SPEC 016).
  if (altoMaximo !== null && actual.alto > altoMaximo && actual.nodos.length > 1) {
    const filas = actual.nodos.length - 1;
    const fijo = actual.alto - filas * geometria.fila;
    geometria = { ...geometria, fila: Math.max(FILA_MINIMA, Math.floor((altoMaximo - fijo) / filas)) };
    actual = disponerCon(estado, completas, geometria);
  }

  // Ancho: primero los carriles, igual que las filas; despues, si todavia no
  // cabe, los identificadores, que son lo unico prescindible del dibujo. Las
  // ramas y el puntero se quedan siempre (SPEC 017, CA8).
  if (anchoMaximo !== null && actual.ancho > anchoMaximo) {
    const carriles = Math.max(0, ...actual.nodos.map((nodo) => nodo.carril));
    if (carriles > 0) {
      const fijo = actual.ancho - carriles * geometria.carril;
      geometria = {
        ...geometria,
        carril: Math.max(CARRIL_MINIMO, Math.min(geometria.carril, Math.floor((anchoMaximo - fijo) / carriles))),
      };
      actual = disponerCon(estado, completas, geometria);
    }
    if (actual.ancho > anchoMaximo) {
      geometria = { ...geometria, identificadores: false };
      actual = disponerCon(estado, completas, geometria);
    }
  }

  return { ...actual, fueraDeVista: fueraDeVista(actual, altoMaximo, anchoMaximo) };
}

/**
 * Las etiquetas de rama y el puntero que, aun apretando, quedan fuera del alto
 * o del ancho disponible. La pantalla las nombra: una confirmacion con
 * etiqueta nunca queda fuera de la vista sin que nada lo diga (SPEC 016, 2.3).
 */
function fueraDeVista(
  disposicion: Disposicion,
  altoMaximo: number | null,
  anchoMaximo: number | null,
): readonly string[] {
  return disposicion.etiquetas
    .filter((etiqueta) => etiqueta.forma !== 'version')
    .filter(
      (etiqueta) =>
        (altoMaximo !== null && etiqueta.y + etiqueta.alto > disposicion.origenY + altoMaximo) ||
        (anchoMaximo !== null && etiqueta.x + etiqueta.ancho > disposicion.origenX + anchoMaximo),
    )
    .map((etiqueta) => etiqueta.texto);
}

function disponerCon(
  estado: EstadoRepositorio,
  opciones: OpcionesDisposicion,
  geometria: Geometria,
): Disposicion {
  const espacioFila = geometria.fila;
  const anchoIdentificador = geometria.identificadores ? MEDIDAS.anchoIdentificador : 0;
  const { limite, previsualizadas, ramasRemotas } = opciones;
  const enPrevisualizacion = new Set(previsualizadas);

  const proyectadas = previsualizadas
    .filter((id) => !estado.confirmaciones.some((confirmacion) => confirmacion.id === id))
    .map((id) => confirmacionProyectada(estado, id))
    .filter((confirmacion): confirmacion is Confirmacion => confirmacion !== null);

  // De la mas reciente a la mas antigua: el orden de creacion es el que el
  // motor conserva en el arreglo.
  const todas = [...estado.confirmaciones, ...proyectadas].reverse();
  const visibles = todas.slice(0, limite);
  const idsVisibles = new Set(visibles.map((confirmacion) => confirmacion.id));

  const vivas = new Set(alcanzablesDesdeReferencias(estado, ramasRemotas.map((rama) => rama.id)));
  // Lo que la orden en curso produciria cuenta como vivo mientras se dibuja.
  for (const id of enPrevisualizacion) vivas.add(id);

  // Las ramas se atienden en su orden de creacion, que deja a main a la
  // izquierda y no depende de sobre cual esta parado el participante.
  const carriles = repartirCarriles(
    visibles,
    vivas,
    [...estado.ramas.map((rama) => rama.id), ...ramasRemotas.map((rama) => rama.id)],
  );

  const posicion = new Map<string, { x: number; y: number }>();
  const nodos: NodoGrafo[] = visibles.map((confirmacion, fila) => {
    const carril = carriles.get(confirmacion.id) ?? 0;
    const x = MEDIDAS.margenSuperior + carril * geometria.carril;
    const y = MEDIDAS.margenSuperior + fila * espacioFila;
    posicion.set(confirmacion.id, { x, y });
    return {
      id: confirmacion.id,
      mensaje: confirmacion.mensaje,
      x,
      y,
      carril,
      esUnion: confirmacion.padres.length > 1,
      huerfana: !vivas.has(confirmacion.id),
      previsualizada: enPrevisualizacion.has(confirmacion.id),
      padresOcultos: confirmacion.padres.some((padre) => !idsVisibles.has(padre)),
    };
  });

  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));

  const aristas: AristaGrafo[] = [];
  for (const confirmacion of visibles) {
    const hijo = posicion.get(confirmacion.id);
    if (hijo === undefined) continue;
    confirmacion.padres.forEach((padre, orden) => {
      const destino = posicion.get(padre);
      if (destino === undefined) return;
      const nodoHijo = porId.get(confirmacion.id);
      const nodoPadre = porId.get(padre);
      // El segundo padre y los siguientes son lo que la union trae: la junta
      // esta en el hijo. El primero, si cambia de carril, es una rama que se
      // abre desde el padre.
      const esUnion = orden > 0;
      const carrilDibujado = esUnion ? (nodoPadre?.carril ?? 0) : (nodoHijo?.carril ?? 0);
      aristas.push({
        clave: `${confirmacion.id}->${padre}`,
        desde: confirmacion.id,
        hasta: padre,
        trazado: trazadoEntre(
          hijo.x,
          hijo.y + MEDIDAS.radio,
          destino.x,
          destino.y - MEDIDAS.radio,
          esUnion,
          espacioFila,
        ),
        previsualizada: nodoHijo?.previsualizada === true,
        atenuada: nodoHijo?.huerfana === true && nodoPadre?.huerfana === true,
        derivada: carrilDibujado !== 0,
      });
    });
  }

  const { etiquetas, enlacePuntero } = disponerEtiquetas(
    estado,
    ramasRemotas,
    posicion,
    espacioFila >= FILA_PUNTERO_DEBAJO,
    anchoIdentificador,
  );
  const rotuloHuerfanas = rotularHuerfanas(nodos);

  // El marco se deduce de lo dibujado. Las etiquetas de version quedan a la
  // izquierda de la primera columna, de modo que el origen puede ser negativo.
  const izquierdas = [
    ...nodos.map((nodo) => nodo.x - MEDIDAS.radio - anchoIdentificador),
    ...etiquetas.map((etiqueta) => etiqueta.x),
  ];
  const derechas = [
    ...nodos.map((nodo) => nodo.x + MEDIDAS.radio),
    ...etiquetas.map((etiqueta) => etiqueta.x + etiqueta.ancho),
    ...(rotuloHuerfanas === null
      ? []
      : [rotuloHuerfanas.x + anchoDeTexto(rotuloHuerfanas.texto)]),
  ];
  const abajos = [
    ...nodos.map((nodo) => nodo.y + MEDIDAS.radio),
    ...etiquetas.map((etiqueta) => etiqueta.y + etiqueta.alto),
  ];

  // Sin identificadores el dibujo empieza en el primer nodo: el margen que
  // quedaba a la izquierda era el espacio de ellos.
  const origenX =
    Math.min(...izquierdas, geometria.identificadores ? 0 : Number.POSITIVE_INFINITY) -
    MEDIDAS.margenInferior;
  const extremoX = Math.max(...derechas, 0) + MEDIDAS.margenInferior;
  const extremoY = Math.max(...abajos, 0) + MEDIDAS.margenInferior;

  return {
    nodos,
    aristas,
    etiquetas,
    enlacePuntero,
    rotuloHuerfanas,
    origenX,
    origenY: 0,
    ancho: extremoX - origenX,
    alto: extremoY,
    ocultas: Math.max(todas.length - visibles.length, 0),
    espacioFila,
    espacioCarril: geometria.carril,
    identificadores: geometria.identificadores,
    fueraDeVista: [],
  };
}

/** Texto que nombra al grupo de confirmaciones sin ninguna referencia. */
export const TEXTO_HUERFANAS = 'sin referencia';

/**
 * Ubica el rotulo del grupo de huerfanas.
 *
 * El gris atenuado las distingue, pero no dice que son. El rotulo va a la
 * derecha del grupo, a la altura de su centro, de modo que se lea como
 * perteneciente al conjunto y no a una confirmacion en particular. Ese costado
 * siempre esta libre: una huerfana, por definicion, no tiene ninguna etiqueta
 * apuntandola.
 */
function rotularHuerfanas(nodos: readonly NodoGrafo[]): RotuloGrafo | null {
  const huerfanas = nodos.filter((nodo) => nodo.huerfana);
  if (huerfanas.length === 0) return null;

  const alturas = huerfanas.map((nodo) => nodo.y);
  return {
    texto: TEXTO_HUERFANAS,
    x: Math.max(...huerfanas.map((nodo) => nodo.x)) + MEDIDAS.radio + MEDIDAS.separacionEtiqueta,
    y: (Math.min(...alturas) + Math.max(...alturas)) / 2,
  };
}

/**
 * Confirmaciones que alguna referencia alcanza.
 *
 * Se recorre el modelo tal como esta, sin decidir nada: las puntas son las que
 * el estado ya declara, y de ahi se sube por los padres.
 */
function alcanzablesDesdeReferencias(
  estado: EstadoRepositorio,
  otrasPuntas: readonly string[] = [],
): ReadonlySet<string> {
  const padresDe = new Map(
    estado.confirmaciones.map((confirmacion) => [confirmacion.id, confirmacion.padres]),
  );

  const puntas: string[] = [
    ...estado.ramas.map((rama) => rama.id),
    ...estado.etiquetas.map((etiqueta) => etiqueta.id),
    ...estado.guardados.map((guardado) => guardado.idBase),
    ...otrasPuntas,
  ];
  if (estado.puntero.tipo === 'confirmacion') puntas.push(estado.puntero.id);

  const vistos = new Set<string>();
  const pendientes = [...puntas];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    if (actual === undefined || vistos.has(actual)) continue;
    vistos.add(actual);
    pendientes.push(...(padresDe.get(actual) ?? []));
  }
  return vistos;
}

/**
 * Coloca los nombres de rama a la derecha de su confirmacion, las etiquetas de
 * version a la izquierda y la posicion actual colgando de la rama que sigue.
 */
function disponerEtiquetas(
  estado: EstadoRepositorio,
  ramasRemotas: OpcionesDisposicion['ramasRemotas'],
  posicion: ReadonlyMap<string, { x: number; y: number }>,
  punteroDebajo: boolean,
  anchoIdentificador: number,
): {
  etiquetas: readonly EtiquetaGrafo[];
  enlacePuntero: EnlacePuntero | null;
} {
  const etiquetas: EtiquetaGrafo[] = [];

  const ramaActual = estado.puntero.tipo === 'rama' ? estado.puntero.rama : null;
  const ramasPorConfirmacion = new Map<string, { nombre: string; remota: boolean }[]>();
  // Las locales primero y despues las remotas, cada grupo por nombre.
  const todas = [
    ...[...estado.ramas].sort((una, otra) => una.nombre.localeCompare(otra.nombre)).map((rama) => ({ ...rama, remota: false })),
    ...[...ramasRemotas].sort((una, otra) => una.nombre.localeCompare(otra.nombre)).map((rama) => ({ ...rama, remota: true })),
  ];
  for (const rama of todas) {
    ramasPorConfirmacion.set(rama.id, [
      ...(ramasPorConfirmacion.get(rama.id) ?? []),
      { nombre: rama.nombre, remota: rama.remota },
    ]);
  }

  let etiquetaSeguida: EtiquetaGrafo | null = null;

  for (const [id, nombres] of ramasPorConfirmacion) {
    const punto = posicion.get(id);
    if (punto === undefined) continue;
    let desplazamiento = punto.x + MEDIDAS.radio + MEDIDAS.separacionEtiqueta;
    for (const { nombre, remota } of nombres) {
      const ancho = anchoDeTexto(nombre);
      const etiqueta: EtiquetaGrafo = {
        clave: `${remota ? 'remota' : 'rama'}:${nombre}`,
        texto: nombre,
        forma: remota ? 'remota' : 'rama',
        x: desplazamiento,
        y: punto.y - MEDIDAS.altoEtiqueta / 2,
        ancho,
        alto: MEDIDAS.altoEtiqueta,
        actual: !remota && nombre === ramaActual,
        principal: !remota && nombre === RAMA_POR_DEFECTO,
        anotada: false,
        idConfirmacion: id,
      };
      etiquetas.push(etiqueta);
      if (etiqueta.actual) etiquetaSeguida = etiqueta;
      desplazamiento += ancho + 8;
    }
  }

  const versionesPorConfirmacion = new Map<string, typeof estado.etiquetas>();
  for (const version of estado.etiquetas) {
    versionesPorConfirmacion.set(version.id, [
      ...(versionesPorConfirmacion.get(version.id) ?? []),
      version,
    ]);
  }
  for (const [id, versiones] of versionesPorConfirmacion) {
    const punto = posicion.get(id);
    if (punto === undefined) continue;
    // A la izquierda del identificador, que ocupa el espacio pegado al nodo.
    // Antes se dibujaban encima de el y lo tapaban (SPEC 013).
    let borde = punto.x - MEDIDAS.radio - Math.max(anchoIdentificador, MEDIDAS.separacionEtiqueta);
    for (const version of versiones) {
      const ancho = anchoDeTexto(version.nombre);
      etiquetas.push({
        clave: `version:${version.nombre}`,
        texto: version.nombre,
        forma: 'version',
        x: borde - ancho,
        y: punto.y - MEDIDAS.altoEtiqueta / 2,
        ancho,
        alto: MEDIDAS.altoEtiqueta,
        actual: false,
        principal: false,
        anotada: version.tipo === 'anotada',
        idConfirmacion: id,
      });
      borde -= ancho + 8;
    }
  }

  // La posicion actual es una etiqueta aparte que cuelga de la rama que sigue.
  // Al cambiar de rama, esto es lo unico que se mueve en pantalla.
  let enlacePuntero: EnlacePuntero | null = null;

  if (etiquetaSeguida !== null && !punteroDebajo) {
    // Con las filas apretadas el puntero va al costado, despues de la ultima
    // etiqueta de esa confirmacion, y un trazo lo une a su rama. Si hay otra
    // rama entre medio, el trazo pasa por detras de su pildora, que es opaca.
    const seguida = etiquetaSeguida;
    const ancho = anchoDeTexto('HEAD');
    const borde = Math.max(
      ...etiquetas
        .filter((etiqueta) => etiqueta.forma === 'rama' && etiqueta.idConfirmacion === seguida.idConfirmacion)
        .map((etiqueta) => etiqueta.x + etiqueta.ancho),
    );
    const x = borde + 12;
    const y = seguida.y + (MEDIDAS.altoEtiqueta - MEDIDAS.altoPuntero) / 2;
    const medio = seguida.y + MEDIDAS.altoEtiqueta / 2;
    etiquetas.push({
      clave: 'puntero',
      texto: 'HEAD',
      forma: 'puntero',
      x,
      y,
      ancho,
      alto: MEDIDAS.altoPuntero,
      actual: true,
      principal: false,
      anotada: false,
      idConfirmacion: seguida.idConfirmacion,
    });
    enlacePuntero = {
      trazado: `M ${x} ${medio} L ${seguida.x + seguida.ancho} ${medio}`,
      relativo: `M 0 ${medio - y} L ${seguida.x + seguida.ancho - x} ${medio - y}`,
      ancla: 'rama',
    };
  } else if (etiquetaSeguida !== null) {
    const ancho = anchoDeTexto('HEAD');
    const x = etiquetaSeguida.x;
    const y = etiquetaSeguida.y + MEDIDAS.altoEtiqueta + 10;
    etiquetas.push({
      clave: 'puntero',
      texto: 'HEAD',
      forma: 'puntero',
      x,
      y,
      ancho,
      alto: MEDIDAS.altoPuntero,
      actual: true,
      principal: false,
      anotada: false,
      idConfirmacion: etiquetaSeguida.idConfirmacion,
    });
    enlacePuntero = {
      trazado: `M ${x + ancho / 2} ${y} L ${x + ancho / 2} ${etiquetaSeguida.y + MEDIDAS.altoEtiqueta}`,
      relativo: `M ${ancho / 2} 0 L ${ancho / 2} ${etiquetaSeguida.y + MEDIDAS.altoEtiqueta - y}`,
      ancla: 'rama',
    };
  } else if (estado.puntero.tipo === 'confirmacion') {
    const punto = posicion.get(estado.puntero.id);
    if (punto !== undefined) {
      const ancho = anchoDeTexto('HEAD');
      const x = punto.x + MEDIDAS.radio + MEDIDAS.separacionEtiqueta;
      const y = punto.y - MEDIDAS.altoPuntero / 2;
      etiquetas.push({
        clave: 'puntero',
        texto: 'HEAD',
        forma: 'puntero',
        x,
        y,
        ancho,
        alto: MEDIDAS.altoPuntero,
        actual: true,
        principal: false,
        anotada: false,
        idConfirmacion: estado.puntero.id,
      });
      enlacePuntero = {
        trazado: `M ${punto.x + MEDIDAS.radio} ${punto.y} L ${x} ${punto.y}`,
        relativo: `M ${punto.x + MEDIDAS.radio - x} ${punto.y - y} L 0 ${punto.y - y}`,
        ancla: 'confirmacion',
      };
    }
  }

  return { etiquetas, enlacePuntero };
}
