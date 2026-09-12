/**
 * El contenido de los archivos (SPEC 012).
 *
 * Hasta el SPEC 011 el motor modelaba nombres y estados, y nada de lo que los
 * archivos tenian escrito. La razon era buena mientras el simulador pretendia
 * ser un Git de proposito general: modelar contenido era modelar un sistema de
 * archivos completo. Con el guion como contrato (SPEC 010) esa razon
 * desaparecio, y nadie la habia vuelto a mirar.
 *
 * ## Las tres versiones de un archivo
 *
 * Git tiene tres, y la diferencia entre ellas es lo que el taller enseña:
 *
 * - **La confirmacion.** Vive en el arbol de cada confirmacion.
 * - **El area de preparacion.** Aqui se *deduce*: un archivo preparado tiene en
 *   el indice lo mismo que en el directorio; cualquier otro tiene lo de HEAD.
 * - **El directorio de trabajo.** Vive en `Archivo.contenido`, y cuando ese
 *   campo es `null` quiere decir «lo mismo que HEAD».
 *
 * Deducir el indice en vez de guardarlo tiene un limite conocido y declarado:
 * un archivo preparado y **vuelto a modificar** despues aparece solo como
 * preparado. Git lo mostraria en las dos secciones a la vez. Es un limite que
 * ya tenia el modelo antes de este spec, porque el estado de un archivo es un
 * unico valor de una enumeracion, y el guion no lo ejercita.
 */

import { archivoPorNombre, confirmacionPorId, idActual } from './estado';
import type { EstadoRepositorio } from './tipos';

/** Arbol vacio, para no repartir objetos nuevos por cada consulta. */
const SIN_ARBOL: Readonly<Record<string, string>> = Object.freeze({});

/**
 * Deja el texto en la forma canonica: finales de linea en `\n` y salto final.
 *
 * Windows y macOS no escriben los mismos finales de linea, y el SPEC 003 ya
 * resolvio eso para los identificadores fijando `core.autocrlf false` y
 * `core.eol lf` en el repositorio que `preparar.sh` arma. Aqui se aplica el
 * mismo criterio, de modo que la comparacion entre el simulador y el disco no
 * dependa del sistema donde se corra.
 */
export function normalizar(texto: string): string {
  const sinRetornos = texto.replace(/\r\n?/g, '\n');
  if (sinRetornos === '') return '';
  return sinRetornos.endsWith('\n') ? sinRetornos : `${sinRetornos}\n`;
}

/**
 * Las lineas de un texto, sin la vacia que deja el salto final.
 *
 * Es la unidad con la que trabajan la comparacion de diferencias y la busqueda
 * por contenido.
 */
export function lineasDe(texto: string): readonly string[] {
  const normalizado = normalizar(texto);
  if (normalizado === '') return [];
  return normalizado.slice(0, -1).split('\n');
}

/** El texto que forman esas lineas, con su salto final. */
export function textoDe(lineas: readonly string[]): string {
  return lineas.length === 0 ? '' : `${lineas.join('\n')}\n`;
}

/** El arbol completo de una confirmacion, o uno vacio si no existe. */
export function arbolDe(estado: EstadoRepositorio, id: string | null): Readonly<Record<string, string>> {
  if (id === null) return SIN_ARBOL;
  return confirmacionPorId(estado, id)?.arbol ?? SIN_ARBOL;
}

/** El arbol de la posicion actual. */
export function arbolActual(estado: EstadoRepositorio): Readonly<Record<string, string>> {
  return arbolDe(estado, idActual(estado));
}

/**
 * Arbol que resulta de reemplazar unos archivos y retirar otros.
 *
 * Es la operacion con la que cada confirmacion nueva construye el suyo a
 * partir del de su padre.
 */
export function arbolCon(
  base: Readonly<Record<string, string>>,
  reemplazos: Readonly<Record<string, string>>,
  retirados: readonly string[] = [],
): Readonly<Record<string, string>> {
  const arbol: Record<string, string> = { ...base, ...reemplazos };
  for (const nombre of retirados) delete arbol[nombre];
  return arbol;
}

/** Texto de un archivo tal como quedo en una confirmacion, o `null` si no estaba. */
export function textoEnConfirmacion(
  estado: EstadoRepositorio,
  id: string | null,
  nombre: string,
): string | null {
  return arbolDe(estado, id)[nombre] ?? null;
}

/** Texto de un archivo en la confirmacion actual, o `null` si no esta versionado ahi. */
export function textoEnCabeza(estado: EstadoRepositorio, nombre: string): string | null {
  return arbolActual(estado)[nombre] ?? null;
}

/**
 * Texto que hay en el directorio de trabajo, o `null` si el archivo no esta.
 *
 * Un archivo limpio no guarda copia: su texto es el de la confirmacion actual.
 */
export function textoDeTrabajo(estado: EstadoRepositorio, nombre: string): string | null {
  const archivo = archivoPorNombre(estado, nombre);
  if (archivo === undefined) return null;
  if (archivo.contenido !== null) return archivo.contenido;
  return textoEnCabeza(estado, nombre) ?? '';
}

/**
 * Texto anotado en el area de preparacion, o `null` si ahi no hay nada.
 *
 * Preparar un archivo copia al indice lo que hay en el directorio; todo lo
 * demas sigue siendo lo que dice la confirmacion actual. Una baja preparada
 * deja la ruta sin nada, que es lo que devuelve el `null`.
 */
export function textoPreparado(estado: EstadoRepositorio, nombre: string): string | null {
  if (estado.borrados.includes(nombre)) return null;
  const archivo = archivoPorNombre(estado, nombre);
  if (archivo !== undefined && (archivo.estado === 'preparado' || archivo.estado === 'en-conflicto')) {
    return textoDeTrabajo(estado, nombre);
  }
  return textoEnCabeza(estado, nombre);
}

/**
 * Los textos que una confirmacion nueva tiene que registrar, tomados del area
 * de preparacion.
 */
export function textosPreparados(
  estado: EstadoRepositorio,
  nombres: readonly string[],
): Readonly<Record<string, string>> {
  const textos: Record<string, string> = {};
  for (const nombre of nombres) {
    textos[nombre] = textoPreparado(estado, nombre) ?? textoDeTrabajo(estado, nombre) ?? '';
  }
  return textos;
}

/**
 * Que archivos cambiaron entre dos arboles, y como.
 *
 * `null` en `antes` es un archivo que nacio ahi; `null` en `despues`, uno que
 * se retiro. Es la forma que espera el modulo de diferencias.
 */
export function comparacionesEntre(
  estado: EstadoRepositorio,
  idAntes: string | null,
  idDespues: string | null,
): readonly { ruta: string; antes: string | null; despues: string | null }[] {
  const viejo = arbolDe(estado, idAntes);
  const nuevo = arbolDe(estado, idDespues);
  const rutas = [...new Set([...Object.keys(viejo), ...Object.keys(nuevo)])].sort();
  return rutas
    .map((ruta) => ({ ruta, antes: viejo[ruta] ?? null, despues: nuevo[ruta] ?? null }))
    .filter((comparacion) => comparacion.antes !== comparacion.despues);
}

/** Cantidad de bytes del texto, contados como los cuenta `wc -c`. */
export function bytesDe(texto: string): number {
  return new TextEncoder().encode(normalizar(texto)).length;
}
