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
 */

import { ORDENES_GIT, ORDENES_INTERPRETE } from '../../src/core';
import { tokenizar } from '../../src/core/analizador';
import { formaSinSoporte, opcionesNoReconocidas } from '../../src/core/contrato';
import { ALIAS_DEL_TALLER, declaracionPorId } from '../../src/escenarios';

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
}

/**
 * Reemplaza `git lg` por la orden larga que abrevia.
 *
 * Los alias del taller son parte del guion: el participante los configura en
 * el laboratorio 01 y desde ahi los escribe en todos los demas. Clasificar
 * `git lg` sin expandirlo diria que el motor no la conoce, cuando lo que hay
 * que preguntarse es si conoce `git log` con esas opciones.
 */
export function expandirAlias(texto: string): string {
  const piezas = texto.split(/\s+/);
  if (piezas[0] !== 'git') return texto;
  const sub = piezas[1] ?? '';
  const valor = (ALIAS_DEL_TALLER as Readonly<Record<string, string>>)[sub];
  if (valor === undefined) return texto;
  return ['git', valor, ...piezas.slice(2)].join(' ');
}

/**
 * Si el motor conoce el verbo de la orden.
 *
 * Se le pregunta al propio motor en vez de mantener una lista a mano: el dia
 * que aprenda una orden nueva, la prueba la recoge sola.
 */
function verboConocido(texto: string): boolean {
  const piezas = expandirAlias(texto).split(/\s+/);
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
export function motivoDeclarado(texto: string): string | null {
  const expandida = expandirAlias(texto);
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

/** Saca los bloques cercados del enunciado, en orden, con su numero de linea. */
export function bloquesDe(enunciado: string): readonly { linea: number; contenido: string }[] {
  const bloques: { linea: number; contenido: string }[] = [];
  const lineas = enunciado.split('\n');
  let dentro = false;
  let inicio = 0;
  let acumulado: string[] = [];

  lineas.forEach((linea, indice) => {
    if (linea.trimEnd() === '```') {
      if (dentro) {
        bloques.push({ linea: inicio + 1, contenido: acumulado.join('\n') });
        acumulado = [];
      } else {
        inicio = indice + 1;
      }
      dentro = !dentro;
      return;
    }
    if (dentro) acumulado.push(linea);
  });
  return bloques;
}

/** Clasifica una linea de orden segun lo que el motor se compromete a hacer con ella. */
function clasificar(texto: string, linea: number): OrdenDelEnunciado {
  const noEjecutable = NO_EJECUTABLES.find((regla) => regla.patron.test(texto));
  if (noEjecutable !== undefined) {
    return { texto, clase: 'omitida', motivo: noEjecutable.motivo, linea };
  }

  const declarado = motivoDeclarado(texto);
  if (declarado !== null) {
    return { texto, clase: 'declarada', motivo: declarado, linea };
  }

  if (!verboConocido(texto)) {
    const verbo = texto.startsWith('git ')
      ? texto.split(/\s+/).slice(0, 2).join(' ')
      : (texto.split(/\s+/)[0] ?? texto);
    return { texto, clase: 'declarada', motivo: `el verbo «${verbo}»`, linea };
  }

  return { texto, clase: 'comparada', motivo: '', linea };
}

/** Clasifica cada linea de orden del enunciado, en el orden en que aparece. */
export function ordenesDe(enunciado: string): readonly OrdenDelEnunciado[] {
  const ordenes: OrdenDelEnunciado[] = [];

  for (const bloque of bloquesDe(enunciado)) {
    bloque.contenido.split('\n').forEach((cruda, desplazamiento) => {
      const texto = cruda.trim();
      if (texto === '' || !pareceOrden(texto)) return;
      ordenes.push(clasificar(texto, bloque.linea + desplazamiento));
    });
  }
  return ordenes;
}

/**
 * Ordenes que el enunciado nombra en prosa dentro de su seccion de rescate
 * (punto 2.3 del SPEC 010).
 *
 * Son las que escribe quien se perdio, y por eso entran al contrato aunque el
 * recorrido no las ejecute: varias solo tienen sentido sobre un repositorio en
 * un estado que el guion no produce.
 */
export function ordenesEnProsa(enunciado: string): readonly OrdenDelEnunciado[] {
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
      ordenes.push(clasificar(texto, indice + 1));
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
} {
  return {
    total: ordenes.length,
    comparadas: ordenes.filter((orden) => orden.clase === 'comparada').length,
    declaradas: ordenes.filter((orden) => orden.clase === 'declarada').length,
    omitidas: ordenes.filter((orden) => orden.clase === 'omitida').length,
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
    return clasificar(orden.texto.replace('<archivo>', sustitucion.valor), orden.linea);
  });
}
