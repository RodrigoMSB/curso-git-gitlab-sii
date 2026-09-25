/**
 * La comparacion de diferencias, con el contenido de verdad (seccion 4 del
 * SPEC 012).
 *
 * Hasta el SPEC 011 `git diff` mostraba la forma y declaraba que el detalle
 * era simulado, porque no habia contenido que comparar. Ahora lo hay.
 *
 * ## El algoritmo no es el de Git, y el resultado si
 *
 * Git usa Myers con heuristicas de histograma y de anclaje. Aqui se usa la
 * subsecuencia comun mas larga, que en una tabla de dos dimensiones es corta y
 * se revisa de un vistazo. **Los archivos del guion tienen diez lineas**: el
 * coste cuadratico no es un problema y la claridad si es una ventaja.
 *
 * Lo que tiene que coincidir es lo que el participante ve: que lineas se
 * marcan como agregadas, cuales como quitadas, y la cabecera con los numeros
 * de linea de cada trozo. Sobre los casos del guion se comparo contra Git
 * orden por orden (punto 4.3).
 *
 * Donde los dos pueden diferir es en **como reparten un empate**. Cuando hay
 * dos formas igual de cortas de explicar el mismo cambio, Myers y la
 * subsecuencia comun mas larga pueden elegir distinta, y entonces las mismas
 * lineas salen agrupadas de otra manera. Con archivos de diez lineas y cambios
 * de una o dos, el caso no aparece; queda anotado porque es la unica puerta
 * por la que este modulo podria separarse de Git.
 */

import { lineasDe } from './contenido';
import { huella } from './identificadores';

/**
 * La huella con la que Git rotula cada version en la linea `index`.
 *
 * No coincide con la de Git y no tiene por que: los identificadores del
 * simulador se generan con una huella propia y eso esta declarado desde el
 * SPEC 007. Lo que se gana escribiendola es que la **forma** de la salida sea
 * la misma que el participante tiene en su terminal, sin una linea de menos
 * que haga dudar de si la orden hizo lo mismo.
 */
function huellaDeVersion(texto: string | null): string {
  return texto === null ? '0000000' : huella(`blob:${texto}`);
}

/** Lo que le pasa a una linea al comparar dos versiones. */
export type Marca = 'igual' | 'agregada' | 'quitada';

export interface LineaComparada {
  readonly marca: Marca;
  readonly texto: string;
  /** Numero de linea en la version anterior, o `null` si la linea es nueva. */
  readonly antes: number | null;
  /** Numero de linea en la version nueva, o `null` si la linea se quito. */
  readonly despues: number | null;
}

/** Cuantas lineas iguales acompañan a cada trozo, como en Git. */
const CONTEXTO = 3;

/**
 * Compara dos listas de lineas y devuelve la union de las dos, marcada.
 *
 * La tabla guarda, para cada par de posiciones, el largo de la subsecuencia
 * comun mas larga que queda por delante. Se recorre despues de atras hacia
 * adelante, prefiriendo la linea quitada ante un empate, que es el orden en el
 * que Git las imprime.
 */
export function compararLineas(
  antes: readonly string[],
  despues: readonly string[],
): readonly LineaComparada[] {
  const alto = antes.length;
  const ancho = despues.length;

  // tabla[i][j] = largo de la subsecuencia comun de antes[i..] y despues[j..].
  const tabla: number[][] = Array.from({ length: alto + 1 }, () =>
    new Array<number>(ancho + 1).fill(0),
  );
  for (let i = alto - 1; i >= 0; i -= 1) {
    for (let j = ancho - 1; j >= 0; j -= 1) {
      const fila = tabla[i];
      const siguiente = tabla[i + 1];
      if (fila === undefined || siguiente === undefined) continue;
      fila[j] =
        antes[i] === despues[j]
          ? (siguiente[j + 1] ?? 0) + 1
          : Math.max(siguiente[j] ?? 0, fila[j + 1] ?? 0);
    }
  }

  const resultado: LineaComparada[] = [];
  let i = 0;
  let j = 0;
  while (i < alto && j < ancho) {
    if (antes[i] === despues[j]) {
      resultado.push({ marca: 'igual', texto: antes[i] ?? '', antes: i + 1, despues: j + 1 });
      i += 1;
      j += 1;
      continue;
    }
    const bajando = tabla[i + 1]?.[j] ?? 0;
    const derecha = tabla[i]?.[j + 1] ?? 0;
    if (bajando >= derecha) {
      resultado.push({ marca: 'quitada', texto: antes[i] ?? '', antes: i + 1, despues: null });
      i += 1;
    } else {
      resultado.push({ marca: 'agregada', texto: despues[j] ?? '', antes: null, despues: j + 1 });
      j += 1;
    }
  }
  while (i < alto) {
    resultado.push({ marca: 'quitada', texto: antes[i] ?? '', antes: i + 1, despues: null });
    i += 1;
  }
  while (j < ancho) {
    resultado.push({ marca: 'agregada', texto: despues[j] ?? '', antes: null, despues: j + 1 });
    j += 1;
  }
  return resultado;
}

/** Un trozo del parche: las lineas que cambian con su contexto alrededor. */
interface Trozo {
  readonly lineas: readonly LineaComparada[];
}

/** Agrupa lo comparado en trozos, con tres lineas de contexto a cada lado. */
function trozos(comparadas: readonly LineaComparada[]): readonly Trozo[] {
  const cambia = comparadas.map((linea) => linea.marca !== 'igual');
  if (!cambia.includes(true)) return [];

  // Se marca que lineas entran: las que cambian y el contexto de su alrededor.
  const entra = new Array<boolean>(comparadas.length).fill(false);
  cambia.forEach((cambiada, indice) => {
    if (!cambiada) return;
    const desde = Math.max(0, indice - CONTEXTO);
    const hasta = Math.min(comparadas.length - 1, indice + CONTEXTO);
    for (let paso = desde; paso <= hasta; paso += 1) entra[paso] = true;
  });

  const agrupados: Trozo[] = [];
  let actual: LineaComparada[] = [];
  entra.forEach((dentro, indice) => {
    const linea = comparadas[indice];
    if (dentro && linea !== undefined) {
      actual.push(linea);
      return;
    }
    if (actual.length > 0) {
      agrupados.push({ lineas: actual });
      actual = [];
    }
  });
  if (actual.length > 0) agrupados.push({ lineas: actual });
  return agrupados;
}

/** La cabecera `@@ -a,b +c,d @@` de un trozo, con el conteo que usa Git. */
function cabecera(trozo: Trozo): string {
  const viejas = trozo.lineas.filter((linea) => linea.marca !== 'agregada');
  const nuevas = trozo.lineas.filter((linea) => linea.marca !== 'quitada');

  // Git numera desde cero cuando el lado no aporta ninguna linea, que es el
  // caso de un archivo nuevo o de uno borrado entero.
  const inicioViejo = viejas[0]?.antes ?? 0;
  const inicioNuevo = nuevas[0]?.despues ?? 0;

  const rango = (inicio: number, cantidad: number): string =>
    cantidad === 1 ? String(inicio) : `${cantidad === 0 ? 0 : inicio},${cantidad}`;

  return `@@ -${rango(inicioViejo, viejas.length)} +${rango(inicioNuevo, nuevas.length)} @@`;
}

/** El signo con que Git escribe cada linea del parche. */
function signo(marca: Marca): string {
  if (marca === 'agregada') return '+';
  if (marca === 'quitada') return '-';
  return ' ';
}

export interface Comparacion {
  readonly ruta: string;
  /** Texto anterior, o `null` si el archivo no existia. */
  readonly antes: string | null;
  /** Texto nuevo, o `null` si el archivo se borro. */
  readonly despues: string | null;
}

/**
 * El parche de un archivo, con el formato de Git.
 *
 * Devuelve la lista vacia cuando los dos textos son iguales: Git no imprime
 * nada para un archivo que no cambio.
 */
export function formatearParche(comparacion: Comparacion): readonly string[] {
  const { ruta, antes, despues } = comparacion;
  if (antes === despues) return [];

  const viejas = lineasDe(antes ?? '');
  const nuevas = lineasDe(despues ?? '');
  const agrupados = trozos(compararLineas(viejas, nuevas));
  if (agrupados.length === 0) return [];

  const indice = `index ${huellaDeVersion(antes)}..${huellaDeVersion(despues)}`;

  const filas: string[] = [`diff --git a/${ruta} b/${ruta}`];
  if (antes === null) {
    filas.push('new file mode 100644');
    filas.push(`${indice}`);
    filas.push('--- /dev/null');
    filas.push(`+++ b/${ruta}`);
  } else if (despues === null) {
    filas.push('deleted file mode 100644');
    filas.push(`${indice}`);
    filas.push(`--- a/${ruta}`);
    filas.push('+++ /dev/null');
  } else {
    filas.push(`${indice} 100644`);
    filas.push(`--- a/${ruta}`);
    filas.push(`+++ b/${ruta}`);
  }

  for (const trozo of agrupados) {
    filas.push(cabecera(trozo));
    for (const linea of trozo.lineas) filas.push(`${signo(linea.marca)}${linea.texto}`);
  }
  return filas;
}

/** El parche de varios archivos, uno detras de otro, como los imprime Git. */
export function formatearParches(comparaciones: readonly Comparacion[]): readonly string[] {
  return comparaciones.flatMap(formatearParche);
}

/**
 * Resumen por archivo con el formato de `--stat`, contando lineas de verdad.
 *
 * `conModos` agrega las lineas `create mode` y `delete mode` que Git imprime
 * **solo al fusionar y al confirmar**, y no en `--stat`. Comprobado contra Git
 * sobre el escenario del laboratorio 05: `git merge` las lleva y
 * `git show --stat`, `git log --stat` y `git diff --stat` no.
 */
export function formatearEstadisticasDe(
  comparaciones: readonly Comparacion[],
  conModos = false,
): readonly string[] {
  const utiles = comparaciones.filter((una) => una.antes !== una.despues);
  const filas = utiles.map((comparacion) => {
    const comparadas = compararLineas(
      lineasDe(comparacion.antes ?? ''),
      lineasDe(comparacion.despues ?? ''),
    );
    const agregadas = comparadas.filter((linea) => linea.marca === 'agregada').length;
    const quitadas = comparadas.filter((linea) => linea.marca === 'quitada').length;
    const total = agregadas + quitadas;
    return {
      ruta: comparacion.ruta,
      total,
      marcas: `${'+'.repeat(agregadas)}${'-'.repeat(quitadas)}`,
    };
  });

  const ancho = filas.reduce((mayor, fila) => Math.max(mayor, fila.ruta.length), 0);
  const agregadas = filas.reduce(
    (suma, fila) => suma + (fila.marcas.match(/\+/g)?.length ?? 0),
    0,
  );
  const quitadas = filas.reduce((suma, fila) => suma + (fila.marcas.match(/-/g)?.length ?? 0), 0);

  const cierre = cierreDeEstadisticas(filas.length, agregadas, quitadas);

  const modos = conModos
    ? utiles.flatMap((comparacion) => {
        if (comparacion.antes === null) return [` create mode 100644 ${comparacion.ruta}`];
        if (comparacion.despues === null) return [` delete mode 100644 ${comparacion.ruta}`];
        return [];
      })
    : [];

  return [
    ...filas.map((fila) => ` ${fila.ruta.padEnd(ancho)} | ${fila.total} ${fila.marcas}`),
    cierre,
    ...modos,
  ];
}

/**
 * La fusion de tres vias que escribe los marcadores de conflicto (punto 5.5
 * del SPEC 012).
 *
 * Git no envuelve el archivo entero: marca **solo el tramo que choca** y deja
 * fuera lo que las dos ramas dejaron igual. La diferencia importa para el
 * laboratorio 05, donde el participante tiene que leer las dos versiones,
 * elegir y borrar tres lineas. Con el archivo entero entre marcadores ese paso
 * pierde el sentido: no hay nada que elegir, hay que rehacerlo todo.
 *
 * El metodo es el de siempre: se alinea cada rama contra la base comun, los
 * tramos que las dos dejaron igual quedan quietos, y de los que no:
 *
 * - si solo una rama lo toco, se toma el suyo;
 * - si las dos lo dejaron igual, se toma una vez;
 * - si las dos lo cambiaron distinto, van los marcadores.
 *
 * **Esto no cambia que archivos entran en conflicto**, que es lo que el punto
 * 5.4 pide no tocar: la deteccion sigue siendo por archivo, en `ordenMerge`.
 * Aqui solo se decide que texto queda dentro del archivo que ya se declaro en
 * conflicto.
 */

/** Donde cae cada linea de la base dentro de la otra version. */
function alineacion(base: readonly string[], otra: readonly string[]): Map<number, number> {
  const mapa = new Map<number, number>();
  for (const linea of compararLineas(base, otra)) {
    if (linea.marca !== 'igual') continue;
    if (linea.antes === null || linea.despues === null) continue;
    mapa.set(linea.antes - 1, linea.despues - 1);
  }
  return mapa;
}

function igualesLasLineas(una: readonly string[], otra: readonly string[]): boolean {
  return una.length === otra.length && una.every((linea, indice) => linea === otra[indice]);
}

export interface ResultadoFusion {
  readonly texto: string;
  /** Si quedo algun tramo con marcadores dentro. */
  readonly choco: boolean;
}

export function fusionarTresVias(
  base: string,
  aqui: string,
  alla: string,
  rotuloAqui: string,
  rotuloAlla: string,
): ResultadoFusion {
  const comun = lineasDe(base);
  const propias = lineasDe(aqui);
  const ajenas = lineasDe(alla);

  const haciaAqui = alineacion(comun, propias);
  const haciaAlla = alineacion(comun, ajenas);

  // Las lineas de la base que las dos ramas conservaron tal cual son los
  // puntos donde el texto vuelve a estar de acuerdo.
  const quietas = [...comun.keys()].filter(
    (indice) => haciaAqui.has(indice) && haciaAlla.has(indice),
  );

  const salida: string[] = [];
  let choco = false;
  let ultimaBase = -1;
  let ultimaAqui = -1;
  let ultimaAlla = -1;

  for (const corte of [...quietas, comun.length]) {
    const finAqui = corte < comun.length ? (haciaAqui.get(corte) ?? 0) : propias.length;
    const finAlla = corte < comun.length ? (haciaAlla.get(corte) ?? 0) : ajenas.length;

    const tramoBase = comun.slice(ultimaBase + 1, corte);
    const tramoAqui = propias.slice(ultimaAqui + 1, finAqui);
    const tramoAlla = ajenas.slice(ultimaAlla + 1, finAlla);

    if (igualesLasLineas(tramoAqui, tramoBase)) {
      salida.push(...tramoAlla);
    } else if (igualesLasLineas(tramoAlla, tramoBase)) {
      salida.push(...tramoAqui);
    } else if (igualesLasLineas(tramoAqui, tramoAlla)) {
      salida.push(...tramoAqui);
    } else {
      choco = true;
      salida.push(`<<<<<<< ${rotuloAqui}`);
      salida.push(...tramoAqui);
      salida.push('=======');
      salida.push(...tramoAlla);
      salida.push(`>>>>>>> ${rotuloAlla}`);
    }

    if (corte < comun.length) {
      salida.push(comun[corte] ?? '');
      ultimaBase = corte;
      ultimaAqui = finAqui;
      ultimaAlla = finAlla;
    }
  }

  return { texto: salida.length === 0 ? '' : `${salida.join('\n')}\n`, choco };
}

/**
 * La linea final de un resumen, con la regla de Git (`print_stat_summary`):
 * las inserciones se nombran si hay alguna o si no hay eliminaciones, y al
 * reves. Por eso un archivo vacio dice `0 insertions(+), 0 deletions(-)`
 * (SPEC 023).
 */
function cierreDeEstadisticas(archivos: number, agregadas: number, quitadas: number): string {
  const partes = [` ${archivos} ${archivos === 1 ? 'file' : 'files'} changed`];
  if (agregadas > 0 || quitadas === 0) partes.push(`${agregadas} ${agregadas === 1 ? 'insertion' : 'insertions'}(+)`);
  if (quitadas > 0 || agregadas === 0) partes.push(`${quitadas} ${quitadas === 1 ? 'deletion' : 'deletions'}(-)`);
  return partes.join(', ');
}

/**
 * Como nombra Git un renombrado en un resumen: lo comun al comienzo y al final
 * va una sola vez, y lo que cambia entre llaves. `recetas/a.md` a
 * `recetas/b.md` es `recetas/{a.md => b.md}`.
 */
export function rotuloDeRenombrado(antes: string, despues: string): string {
  let inicio = 0;
  for (let i = 0; i < Math.min(antes.length, despues.length) && antes[i] === despues[i]; i += 1) {
    if (antes[i] === '/') inicio = i + 1;
  }
  let fin = 0;
  for (
    let i = 1;
    i <= Math.min(antes.length, despues.length) - inicio && antes[antes.length - i] === despues[despues.length - i];
    i += 1
  ) {
    if (antes[antes.length - i] === '/') fin = i;
  }
  if (inicio === 0 && fin === 0) return `${antes} => ${despues}`;
  const prefijo = antes.slice(0, inicio);
  const sufijo = fin === 0 ? '' : antes.slice(antes.length - fin);
  return `${prefijo}{${antes.slice(inicio, antes.length - fin)} => ${despues.slice(inicio, despues.length - fin)}}${sufijo}`;
}

/**
 * El resumen que Git imprime al confirmar (SPEC 023): el total de archivos,
 * lineas agregadas y quitadas, y una linea por archivo creado, borrado o
 * renombrado, ordenadas por ruta. Sin el detalle por archivo que lleva
 * `git merge`. Texto copiado de una corrida de Git 2.54.
 *
 * Un renombrado sin cambios de contenido cuenta como un archivo y no suma
 * lineas.
 */
export function resumenDeConfirmacion(
  comparaciones: readonly Comparacion[],
  renombrados: readonly { readonly antes: string; readonly despues: string }[] = [],
): readonly string[] {
  const enRenombrado = new Set(renombrados.flatMap((r) => [r.antes, r.despues]));
  const resto = comparaciones.filter((una) => una.antes !== una.despues && !enRenombrado.has(una.ruta));
  let agregadas = 0;
  let quitadas = 0;
  for (const comparacion of resto) {
    const comparadas = compararLineas(lineasDe(comparacion.antes ?? ''), lineasDe(comparacion.despues ?? ''));
    agregadas += comparadas.filter((linea) => linea.marca === 'agregada').length;
    quitadas += comparadas.filter((linea) => linea.marca === 'quitada').length;
  }
  const modos = [
    ...resto.flatMap((comparacion) => {
      if (comparacion.antes === null) return [{ ruta: comparacion.ruta, linea: ` create mode 100644 ${comparacion.ruta}` }];
      if (comparacion.despues === null) return [{ ruta: comparacion.ruta, linea: ` delete mode 100644 ${comparacion.ruta}` }];
      return [];
    }),
    ...renombrados.map((r) => ({ ruta: r.despues, linea: ` rename ${rotuloDeRenombrado(r.antes, r.despues)} (100%)` })),
  ].sort((a, b) => (a.ruta < b.ruta ? -1 : a.ruta > b.ruta ? 1 : 0));
  return [cierreDeEstadisticas(resto.length + renombrados.length, agregadas, quitadas), ...modos.map((m) => m.linea)];
}
