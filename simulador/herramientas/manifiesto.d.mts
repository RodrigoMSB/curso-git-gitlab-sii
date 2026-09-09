/**
 * Tipos del manifiesto del simulador construido.
 *
 * La herramienta se escribe en JavaScript a proposito: la corre `npm run build`
 * con node a secas, sin pasar por TypeScript. Estas declaraciones son para que
 * la suite la use con tipos.
 */

/** Ruta de `simulador/dist/index.html`. */
export const ARTEFACTO: string;
/** Ruta de `simulador/dist/manifiesto.txt`. */
export const MANIFIESTO: string;
/** Ruta de `SIMULADOR.html`, la copia de la raiz del clon. */
export const ENTRADA: string;

/** Rutas relativas y ordenadas de todo lo que entra en la construccion. */
export function fuentes(): string[];

/** Huella de las fuentes: cambia si cambia cualquiera de ellas. */
export function huellaDeLasFuentes(): string;

/** Huella del contenido de un archivo. */
export function huellaDe(ruta: string): string;

/** Escribe `dist/manifiesto.txt` con las huellas de hoy. */
export function escribir(): string;

/** Lee las huellas anotadas, o `null` si no hay manifiesto. */
export function leer(): { fuentes?: string; artefacto?: string } | null;

/** Problemas encontrados. Lista vacia quiere decir que todo esta al dia. */
export function comprobar(): string[];

/** Deja `SIMULADOR.html` igual al artefacto. */
export function copiarALaEntrada(): void;
