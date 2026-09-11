/**
 * El guion de un laboratorio sale de su enunciado (SPEC 008, ampliado por el
 * SPEC 010).
 *
 * No hay una lista escrita aparte, a proposito: una lista aparte se
 * desincroniza del enunciado la primera vez que alguien corrige un paso, y a
 * partir de ahi la prueba valida un laboratorio que ya no existe.
 *
 * Este modulo lee el `README.md` del laboratorio y saca dos cosas:
 *
 * 1. Las ordenes de los bloques cercados, en orden. Son las que el
 *    participante escribe siguiendo el enunciado y las que el recorrido
 *    ejecuta en los dos lados.
 * 2. Las ordenes que el enunciado nombra en prosa dentro de su seccion de
 *    rescate (punto 2.3 del SPEC 010). Un participante perdido escribe
 *    justamente esas, asi que entran al contrato aunque el recorrido no las
 *    ejecute.
 *
 * **Lo que el motor no implementa no se declara aqui.** Se declara en
 * `src/core/contrato.ts`, que es el unico lugar donde vive el contrato, y este
 * modulo lo consulta. Tener dos listas fue lo que dejo al extractor creyendo
 * que `git config --list` no estaba implementado cuando si lo estaba.
 *
 * **Y el arnes no hace nada por el participante.** La configuracion de Git, los
 * alias incluidos, sale del enunciado del laboratorio 01, que es donde el
 * participante la deja puesta. El arnes la escribia a mano, o sea le resolvia
 * al recorrido algo que el participante tiene que hacer: si el laboratorio 01
 * dejara de configurar `git lg`, los cinco recorridos habrian seguido en verde
 * mientras el participante se topaba con `git: 'lg' is not a git command`. Es
 * la misma forma del defecto del SPEC 011, donde el arnes escribia la
 * direccion del simulador.
 */

import { ORDENES_GIT, ORDENES_INTERPRETE } from '../../src/core';
import { tokenizar } from '../../src/core/analizador';
import { formaSinSoporte, opcionesNoReconocidas } from '../../src/core/contrato';
import { declaracionPorId } from '../../src/escenarios';
import { bloquesDe, enTerminal, tramosDeTerminal } from './enunciado';

export {
  aliasDelTaller,
  bloquesDe,
  configuracionDelTaller,
  enTerminal,
  tramosDeTerminal,
} from './enunciado';
export type { Configuracion } from './enunciado';

/** Que hacer con una linea del enunciado. */
export type Clase =
  /** Se ejecuta en los dos lados y se comparan los estados. */
  | 'comparada'
  /** El motor la declara no soportada: se comprueba que lo diga (punto 7.3). */
  | 'declarada'
  /** No se ejecuta en ninguno de los dos lados. */
  | 'omitida';

export interface OrdenDelEnunciado {
  readonly texto: string;
  readonly clase: Clase;
  /** Por que no se compara. Vacio cuando si se compara. */
  readonly motivo: string;
  /** Numero de linea del enunciado, para que un fallo se pueda ubicar. */
  readonly linea: number;
  /**
   * El enunciado manda hacer esta orden en la terminal, no en el simulador.
   *
   * Se sigue ejecutando y comparando en los dos lados, porque en los dos hace
   * lo mismo. Lo que cambia es la cuenta: no se puede contar como cubierta por
   * el simulador una orden que el enunciado saca del simulador.
   */
  readonly terminal: boolean;
}


/**
 * Reemplaza `git lg` por la orden larga que abrevia.
 *
 * Los alias del taller son parte del guion: el participante los configura en
 * el laboratorio 01 y desde ahi los escribe en todos los demas. Clasificar
 * `git lg` sin expandirlo diria que el motor no la conoce, cuando lo que hay
 * que preguntarse es si conoce `git log` con esas opciones.
 *
 * La tabla llega desde afuera y no se lee de `ALIAS_DEL_TALLER`: si el
 * enunciado del laboratorio 01 deja de configurar uno, aqui deja de expandirse
 * y el recorrido lo nota.
 */
export function expandirAlias(texto: string, alias: Readonly<Record<string, string>>): string {
  const piezas = texto.split(/\s+/);
  if (piezas[0] !== 'git') return texto;
  const sub = piezas[1] ?? '';
  const valor = alias[sub];
  if (valor === undefined) return texto;
  return ['git', valor, ...piezas.slice(2)].join(' ');
}

/**
 * Si el motor conoce el verbo de la orden.
 *
 * Se le pregunta al propio motor en vez de mantener una lista a mano: el dia
 * que aprenda una orden nueva, la prueba la recoge sola.
 */
function verboConocido(texto: string, alias: Readonly<Record<string, string>>): boolean {
  const piezas = expandirAlias(texto, alias).split(/\s+/);
  const primera = piezas[0] ?? '';
  if (primera !== 'git') return Object.hasOwn(ORDENES_INTERPRETE, primera);
  const sub = piezas[1] ?? '';
  return Object.hasOwn(ORDENES_GIT, sub);
}

/**
 * Lo que el motor responderia a esta orden, segun su contrato.
 *
 * Devuelve el motivo cuando la declara no soportada, y `null` cuando se
 * compromete a ejecutarla entera.
 */
export function motivoDeclarado(
  texto: string,
  alias: Readonly<Record<string, string>>,
): string | null {
  const expandida = expandirAlias(texto, alias);
  const forma = formaSinSoporte(expandida);
  if (forma !== undefined) return forma.motivo;

  // Se tokeniza como lo hace el motor, respetando las comillas: si no, el
  // valor de `git config alias.lg "log --oneline ..."` pareceria una retahila
  // de opciones de `git config` que nadie implementa.
  const piezas = tokenizar(expandida).filter((pieza) => pieza !== '');
  const esGit = piezas[0] === 'git';
  const nombre = (esGit ? piezas[1] : piezas[0]) ?? '';
  const argumentos = piezas.slice(esGit ? 2 : 1);
  const fuera = opcionesNoReconocidas(nombre, argumentos);
  if (fuera.length === 0) return null;
  const como = esGit ? `git ${nombre}` : nombre;
  return `${fuera.map((opcion) => `«${opcion}»`).join(', ')} de ${como}`;
}

/** Lineas que no son ordenes ejecutables en ningun lado. */
const NO_EJECUTABLES: readonly { readonly patron: RegExp; readonly motivo: string }[] = [
  {
    patron: /<[^>]+>/,
    motivo: 'lleva un marcador de posicion que el participante reemplaza a mano',
  },
  {
    patron: /^(labs\/lab-\d+\/preparar\.sh|\.\/preparar\.sh|\.\/verificar\.sh)/,
    motivo: 'la preparacion la corre el arnes antes de empezar',
  },
];

/** Bloques que no son ordenes, sino contenido de archivos que el enunciado muestra. */
function pareceOrden(linea: string): boolean {
  const primera = linea.split(/\s+/)[0] ?? '';
  // El verbo tiene que ser la palabra entera: el enunciado del laboratorio 03
  // habla de un archivo llamado `gitignore`, que no es una orden.
  return /^(git|ls|cat|pwd|echo|cd|mkdir|wc|diff|rm|mv|labs)$/.test(primera) ||
    primera.startsWith('./');
}


/** Clasifica una linea de orden segun lo que el motor se compromete a hacer con ella. */
function clasificar(
  texto: string,
  linea: number,
  alias: Readonly<Record<string, string>>,
): OrdenDelEnunciado {
  const noEjecutable = NO_EJECUTABLES.find((regla) => regla.patron.test(texto));
  if (noEjecutable !== undefined) {
    return { texto, clase: 'omitida', motivo: noEjecutable.motivo, linea, terminal: false };
  }

  const declarado = motivoDeclarado(texto, alias);
  if (declarado !== null) {
    return { texto, clase: 'declarada', motivo: declarado, linea, terminal: false };
  }

  if (!verboConocido(texto, alias)) {
    const verbo = texto.startsWith('git ')
      ? texto.split(/\s+/).slice(0, 2).join(' ')
      : (texto.split(/\s+/)[0] ?? texto);
    return { texto, clase: 'declarada', motivo: `el verbo «${verbo}»`, linea, terminal: false };
  }

  return { texto, clase: 'comparada', motivo: '', linea, terminal: false };
}

/**
 * Los archivos que el enunciado manda crear, convertidos en ordenes.
 *
 * El enunciado dice «Crea `recetas/pad-thai.md`.» y a continuacion muestra el
 * contenido en un bloque. Ese bloque no son ordenes, asi que el extractor lo
 * descartaba entero, y con el descartaba **el archivo**. La consecuencia la
 * destaparon las capturas del SPEC 011: en el laboratorio 04 el `git add` de
 * ese archivo fallaba, el `git commit` siguiente no encontraba nada que
 * confirmar, y los dos lados coincidian en no haber hecho nada. El recorrido
 * del laboratorio que enseña a ramificar y confirmar no creo ni una sola
 * confirmacion, y el informe lo daba por cubierto.
 *
 * El paso se ejecuta con `echo`, que es como el simulador genera trabajo
 * pendiente. El contenido no se copia: ninguno de los dos lados lo compara
 * (seccion 25 de docs/arquitectura.md) y el simulador no versiona contenido.
 * Lo que importa es que el archivo exista en los dos lados con el mismo nombre.
 */
function creacionesDeArchivo(
  enunciado: string,
  alias: Readonly<Record<string, string>>,
): readonly OrdenDelEnunciado[] {
  const lineas = enunciado.split('\n');
  const bloques = bloquesDe(enunciado);
  const ordenes: OrdenDelEnunciado[] = [];

  lineas.forEach((linea, indice) => {
    const nombrado = linea.match(/Crea(?: el archivo)? `([^`]+)`/);
    const ruta = nombrado?.[1];
    // Solo un nombre de archivo: sin espacios y con punto o barra, de modo que
    // `.gitignore` y `recetas/pad-thai.md` entren y un nombre de rama no.
    if (ruta === undefined || !/^[\w./-]+$/.test(ruta) || !/[./]/.test(ruta)) return;
    // El bloque que sigue es el contenido. Sin bloque no hay archivo que crear.
    const contenido = bloques.find((bloque) => bloque.linea > indice + 1);
    if (contenido === undefined || contenido.linea > indice + 6) return;

    const carpeta = ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '';
    if (carpeta !== '') ordenes.push(clasificar(`mkdir -p ${carpeta}`, indice + 1, alias));
    // El contenido es una linea neutra y no el del enunciado, por dos razones.
    // El motor no versiona contenido (restriccion R4), asi que ningun lado lo
    // compara; y copiar el contenido de verdad encenderia efectos que el motor
    // no modela, como que un `.gitignore` con `*.tmp` filtre en Git y no en el
    // simulador. Escribir el nombre del archivo tampoco sirve: un `.gitignore`
    // que se nombra a si mismo se ignora, y Git deja de mostrarlo.
    ordenes.push(clasificar(`echo "contenido de ejemplo" > ${ruta}`, indice + 1, alias));
  });

  return ordenes;
}

/** Clasifica cada linea de orden del enunciado, en el orden en que aparece. */
export function ordenesDe(
  enunciado: string,
  alias: Readonly<Record<string, string>>,
): readonly OrdenDelEnunciado[] {
  const ordenes: OrdenDelEnunciado[] = [];

  for (const bloque of bloquesDe(enunciado)) {
    bloque.contenido.split('\n').forEach((cruda, desplazamiento) => {
      const texto = cruda.trim();
      if (texto === '' || !pareceOrden(texto)) return;
      ordenes.push(clasificar(texto, bloque.linea + desplazamiento, alias));
    });
  }

  // Los archivos que el enunciado manda crear entran en el lugar del guion
  // donde el enunciado los pide, que es antes del `git add` que los prepara.
  const tramos = tramosDeTerminal(enunciado);
  return [...ordenes, ...creacionesDeArchivo(enunciado, alias)]
    .sort((una, otra) => una.linea - otra.linea)
    .map((orden) => ({ ...orden, terminal: enTerminal(tramos, orden.linea) }));
}

/**
 * Ordenes que el enunciado nombra en prosa dentro de su seccion de rescate
 * (punto 2.3 del SPEC 010).
 *
 * Son las que escribe quien se perdio, y por eso entran al contrato aunque el
 * recorrido no las ejecute: varias solo tienen sentido sobre un repositorio en
 * un estado que el guion no produce.
 */
export function ordenesEnProsa(
  enunciado: string,
  alias: Readonly<Record<string, string>>,
): readonly OrdenDelEnunciado[] {
  const lineas = enunciado.split('\n');
  const inicio = lineas.findIndex((linea) => /^##\s+Si algo sali/.test(linea));
  if (inicio < 0) return [];
  const finRelativo = lineas.slice(inicio + 1).findIndex((linea) => /^##\s/.test(linea));
  const fin = finRelativo < 0 ? lineas.length : inicio + 1 + finRelativo;

  const ordenes: OrdenDelEnunciado[] = [];
  const vistas = new Set<string>();
  for (let indice = inicio; indice < fin; indice += 1) {
    const linea = lineas[indice] ?? '';
    for (const coincidencia of linea.matchAll(/`([^`]+)`/g)) {
      const texto = (coincidencia[1] ?? '').trim();
      if (!pareceOrden(texto) || vistas.has(texto)) continue;
      vistas.add(texto);
      ordenes.push(clasificar(texto, indice + 1, alias));
    }
  }
  return ordenes;
}

/** Resumen del guion de un laboratorio. */
export function resumen(ordenes: readonly OrdenDelEnunciado[]): {
  readonly total: number;
  readonly comparadas: number;
  readonly declaradas: number;
  readonly omitidas: number;
  /** Las que el enunciado manda hacer en la terminal y no en el simulador. */
  readonly enTerminal: number;
  /** Porcentaje del guion que el participante puede seguir en la pantalla. */
  readonly enPantalla: number;
} {
  const total = ordenes.length;
  const terminal = ordenes.filter((orden) => orden.terminal).length;
  const fuera =
    ordenes.filter((orden) => orden.clase !== 'comparada' || orden.terminal).length;
  return {
    total,
    comparadas: ordenes.filter((orden) => orden.clase === 'comparada').length,
    declaradas: ordenes.filter((orden) => orden.clase === 'declarada').length,
    omitidas: ordenes.filter((orden) => orden.clase === 'omitida').length,
    enTerminal: terminal,
    enPantalla: total === 0 ? 0 : Math.round(((total - fuera) / total) * 100),
  };
}

/**
 * Resuelve los marcadores de posicion que el enunciado deja a proposito.
 *
 * El enunciado escribe `git restore <archivo>` para que el participante mire
 * su `git status` y decida cual es. La prueba no puede decidir eso, pero
 * tampoco conviene saltarse los dos pasos centrales del laboratorio 02.
 *
 * El valor **no se escribe a mano**: sale de la declaracion del escenario, que
 * ya es la unica fuente de la forma del laboratorio (SPEC 007). Si el escenario
 * cambia de archivo, esto cambia con el.
 *
 * Los marcadores que nombran un identificador de confirmacion se quedan sin
 * resolver: los identificadores del simulador y los de Git no coinciden por
 * diseño, asi que no hay un unico valor que sirva en los dos lados. Son las
 * excepciones declaradas del punto 7.3.
 */
export function resolverMarcadores(
  ordenes: readonly OrdenDelEnunciado[],
  numeroDeLaboratorio: string,
  alias: Readonly<Record<string, string>>,
): readonly OrdenDelEnunciado[] {
  const declaracion = declaracionPorId(`lab-${numeroDeLaboratorio}`);
  if (declaracion === undefined) return ordenes;

  const conEstado = (estado: string): string | undefined =>
    declaracion.archivos.find((archivo) => archivo.estado === estado)?.nombre;

  const sustituciones: readonly { readonly patron: RegExp; readonly valor: string | undefined }[] = [
    { patron: /^git restore --staged <archivo>$/, valor: conEstado('preparado') },
    { patron: /^git restore <archivo>$/, valor: conEstado('modificado') },
  ];

  return ordenes.map((orden) => {
    if (orden.clase !== 'omitida') return orden;
    const sustitucion = sustituciones.find((candidata) => candidata.patron.test(orden.texto));
    if (sustitucion === undefined || sustitucion.valor === undefined) return orden;
    return clasificar(orden.texto.replace('<archivo>', sustitucion.valor), orden.linea, alias);
  });
}

/**
 * Direccion con la que el enunciado manda abrir el simulador.
 *
 * **La direccion no se escribe aqui.** Sale del enunciado, por la misma razon
 * que las ordenes (SPEC 008): el arnes tenia su propia copia, `?lab=NN` escrito
 * a mano en cada `cy.visit`, y con eso le daba resuelto al recorrido lo unico
 * que el participante tiene que acertar por su cuenta. Esa copia es lo que dejo
 * pasar el defecto del SPEC 011: el enunciado no decia en que escenario abrir
 * el simulador, el participante abria el que sale por doble clic, y el
 * recorrido entero ocurria sobre un repositorio que no existe.
 *
 * Devuelve `null` cuando el enunciado no nombra el escenario de **su** propio
 * laboratorio, que es un defecto del enunciado y no una categoria: el recorrido
 * falla. Se busca el numero del laboratorio y no la primera direccion que
 * aparezca, porque un enunciado puede nombrar la de otro: el del 01 cita
 * `?lab=02` al explicar que en los laboratorios siguientes hay que cambiar de
 * escenario.
 */
export function direccionDelSimulador(
  enunciado: string,
  numeroDeLaboratorio: string,
): string | null {
  const buscada = `SIMULADOR.html?lab=${numeroDeLaboratorio}`;
  return enunciado.includes(buscada) ? `/${buscada}` : null;
}
