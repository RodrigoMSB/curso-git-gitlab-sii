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

/** Instante de arranque del reloj del simulador, en segundos desde la epoca. */
const EPOCA = Date.UTC(2026, 2, 2, 12, 0, 0) / 1000;
const SEGUNDOS_POR_HORA = 3600;

/**
 * La zona en la que se escriben las fechas: Chile continental, `-0300`.
 *
 * Es la misma que `preparar.sh` le pasa a Git en `GIT_AUTHOR_DATE`, con la
 * forma `@1772453640 -0300`. Git guarda el instante y el desplazamiento, y
 * **muestra la hora en el desplazamiento guardado**, no en UTC.
 *
 * El simulador rotulaba `-0300` y escribia la hora de UTC, tres horas mas
 * adelante: el participante veia `13:25` donde su terminal decia `10:25`, y el
 * laboratorio 02 pone las dos salidas una al lado de la otra. El
 * desplazamiento es fijo a proposito, igual que en el disco: el horario de
 * verano de Chile movería las fechas de los escenarios segun el mes y
 * rompería la comparacion contra el repositorio que el participante tiene.
 */
const DESPLAZAMIENTO = '-0300';
const SEGUNDOS_DE_DESPLAZAMIENTO = -3 * SEGUNDOS_POR_HORA;

const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MESES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Instante determinista derivado del contador del estado, en segundos desde la
 * epoca.
 *
 * Cada confirmacion nueva queda una hora despues de la anterior. Se evita el
 * reloj del sistema para que el motor siga siendo puro y las pruebas estables.
 */
export function epocaDeterminista(contador: number): number {
  return EPOCA + contador * SEGUNDOS_POR_HORA;
}

/**
 * Fecha de una epoca en segundos, que es la unidad en que las confirmaciones
 * guardan su instante, en que los escenarios de laboratorio lo declaran y en
 * que `preparar.sh` lo fija en el disco. Tener una sola unidad es lo que
 * permite que las dos caras del escenario se comparen (SPEC 007), y es lo que
 * hace posible filtrar el historial por fecha.
 */
export function fechaDeEpoca(epoca: number): string {
  return fechaDeInstante(enLaZona(epoca));
}

/** La misma fecha en la forma corta que pide `git log --date=short`. */
export function fechaCorta(epoca: number): string {
  return enLaZona(epoca).toISOString().slice(0, 10);
}

/**
 * El instante desplazado a la zona en que se escribe.
 *
 * Se corre el reloj y despues se lee con los metodos UTC: es la unica forma de
 * que el resultado no dependa de la zona de la maquina donde corre el motor,
 * que es codigo puro (restriccion R3) y tiene que dar lo mismo en Santiago que
 * en cualquier otra parte.
 */
function enLaZona(epoca: number): Date {
  return new Date((epoca + SEGUNDOS_DE_DESPLAZAMIENTO) * 1000);
}

function fechaDeInstante(instante: Date): string {
  const dia = DIAS[instante.getUTCDay()] ?? 'Mon';
  const mes = MESES[instante.getUTCMonth()] ?? 'Jan';
  // El dia va sin rellenar: Git escribe «Jul 2», no «Jul  2».
  const numero = String(instante.getUTCDate());
  const hora = String(instante.getUTCHours()).padStart(2, '0');
  const minuto = String(instante.getUTCMinutes()).padStart(2, '0');
  const segundo = String(instante.getUTCSeconds()).padStart(2, '0');
  return `${dia} ${mes} ${numero} ${hora}:${minuto}:${segundo} ${instante.getUTCFullYear()} ${DESPLAZAMIENTO}`;
}
