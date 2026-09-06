/**
 * Generacion de identificadores de confirmacion.
 *
 * Git usa SHA-1 sobre el contenido. Aqui no hay contenido, asi que se usa una
 * huella FNV-1a sobre una semilla textual. Interesan dos propiedades:
 *
 * - Determinismo: la misma secuencia de ordenes produce los mismos
 *   identificadores, de modo que las pruebas no dependen del reloj.
 * - Unicidad: dos confirmaciones distintas nunca comparten identificador, lo
 *   que el punto 8.4 del SPEC 001 exige para el rebase.
 */

const BASE_FNV = 0x811c9dc5;
const PRIMO_FNV = 0x01000193;

/** Huella de siete caracteres hexadecimales, como un identificador corto de Git. */
export function huella(texto: string): string {
  let acumulado = BASE_FNV;
  for (let i = 0; i < texto.length; i += 1) {
    acumulado ^= texto.charCodeAt(i);
    acumulado = Math.imul(acumulado, PRIMO_FNV) >>> 0;
  }
  return acumulado.toString(16).padStart(8, '0').slice(0, 7);
}

/**
 * Identificador nuevo garantizado distinto de todos los ya usados.
 *
 * Ante una colision se reintenta con un sufijo, de modo que el resultado sigue
 * siendo una funcion pura de la semilla y del conjunto de identificadores
 * ocupados.
 */
export function generarId(semilla: string, usados: ReadonlySet<string>): string {
  let id = huella(semilla);
  let intento = 0;
  while (usados.has(id)) {
    intento += 1;
    id = huella(`${semilla}#${intento}`);
  }
  return id;
}

const EPOCA = Date.UTC(2026, 2, 2, 12, 0, 0);
const MILISEGUNDOS_POR_HORA = 3_600_000;

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MESES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Fecha determinista derivada del contador del estado.
 *
 * Cada confirmacion nueva queda una hora despues de la anterior. Se evita el
 * reloj del sistema para que el motor siga siendo puro y las pruebas estables.
 */
export function fechaDeterminista(contador: number): string {
  const instante = new Date(EPOCA + contador * MILISEGUNDOS_POR_HORA);
  const dia = DIAS[instante.getUTCDay()] ?? 'Mon';
  const mes = MESES[instante.getUTCMonth()] ?? 'Jan';
  const numero = String(instante.getUTCDate()).padStart(2, ' ');
  const hora = String(instante.getUTCHours()).padStart(2, '0');
  const minuto = String(instante.getUTCMinutes()).padStart(2, '0');
  const segundo = String(instante.getUTCSeconds()).padStart(2, '0');
  return `${dia} ${mes} ${numero} ${hora}:${minuto}:${segundo} ${instante.getUTCFullYear()} -0300`;
}
