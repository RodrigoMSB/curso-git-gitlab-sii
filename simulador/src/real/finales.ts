/**
 * Los finales de linea al comparar el disco con el indice (SPEC 020, 2.4).
 *
 * Con `core.autocrlf` en `true`, que es lo que deja el instalador de Git para
 * Windows, un archivo sale al disco con CRLF y entra al repositorio con LF. Si
 * la huella se calculara sobre los bytes del disco, todo archivo de texto se
 * veria modificado en un repositorio limpio. Esto reproduce la conversion que
 * Git aplica antes de calcularla (`convert_to_git` de `convert.c`), con sus
 * mismas salvedades: no se toca lo que parece binario, ni un archivo que ya
 * tiene CRLF guardado en el indice.
 *
 * De `.gitattributes` se leen `text`, `-text`, `binary`, `text=auto` y `eol`,
 * solo del archivo de la raiz. Los de las subcarpetas no se leen.
 */

import { excluida, leerReglas } from './ignorar';

export type Autocrlf = 'true' | 'input' | 'false';

/** Como trata Git un archivo segun sus atributos y la configuracion. */
type Accion = 'binario' | 'texto' | 'auto';

interface Estadistica {
  nulos: number;
  crSueltos: number;
  crlf: number;
  imprimibles: number;
  noImprimibles: number;
}

function estadistica(datos: Uint8Array): Estadistica {
  const e: Estadistica = { nulos: 0, crSueltos: 0, crlf: 0, imprimibles: 0, noImprimibles: 0 };
  for (let i = 0; i < datos.length; i += 1) {
    const c = datos[i] ?? 0;
    if (c === 13) {
      if (datos[i + 1] === 10) {
        e.crlf += 1;
        i += 1;
      } else {
        e.crSueltos += 1;
      }
      continue;
    }
    if (c === 10) continue;
    if (c === 127) e.noImprimibles += 1;
    else if (c < 32) {
      if (c === 8 || c === 9 || c === 27 || c === 12) e.imprimibles += 1;
      else {
        if (c === 0) e.nulos += 1;
        e.noImprimibles += 1;
      }
    } else e.imprimibles += 1;
  }
  // Un EOF de DOS al final no cuenta como no imprimible.
  if (datos.length > 0 && datos[datos.length - 1] === 26) e.noImprimibles -= 1;
  return e;
}

function pareceBinario(e: Estadistica): boolean {
  return e.crSueltos > 0 || e.nulos > 0 || e.imprimibles >> 7 < e.noImprimibles;
}

export interface Atributos {
  /** La accion para una ruta, o null si ningun atributo habla de ella. */
  accionDe(ruta: string): Accion | null;
}

/** Los atributos de fin de linea de un `.gitattributes`. */
export function leerAtributos(texto: string | null): Atributos {
  const reglas: { patron: string; accion: Accion | null }[] = [];
  for (const linea of (texto ?? '').split(/\r?\n/)) {
    const partes = linea.trim().split(/\s+/);
    const [patron, ...atributos] = partes;
    if (patron === undefined || patron === '' || patron.startsWith('#')) continue;
    let accion: Accion | null = null;
    for (const a of atributos) {
      if (a === '-text' || a === 'binary' || a === '-crlf') accion = 'binario';
      else if (a === 'text' || a === 'crlf' || a.startsWith('eol=')) accion = accion === 'auto' ? 'auto' : 'texto';
      else if (a === 'text=auto') accion = 'auto';
      else if (a === '!text' || a === '!eol') accion = null;
    }
    if (atributos.some((a) => /^(-|!)?(text|crlf|binary)|^eol=|^!eol/.test(a))) reglas.push({ patron, accion });
  }
  const grupos = reglas.map((r) => ({ grupo: leerReglas(r.patron, '', false), accion: r.accion }));
  return {
    accionDe(ruta) {
      // Gana la ultima linea que coincide.
      for (let k = grupos.length - 1; k >= 0; k -= 1) {
        const g = grupos[k];
        if (g !== undefined && excluida([g.grupo], ruta, false) === true) return g.accion;
      }
      return null;
    },
  };
}

function quitarCr(datos: Uint8Array): Uint8Array {
  const salida = new Uint8Array(datos.length);
  let n = 0;
  for (let i = 0; i < datos.length; i += 1) {
    const c = datos[i] ?? 0;
    if (c === 13 && datos[i + 1] === 10) continue;
    salida[n] = c;
    n += 1;
  }
  return salida.subarray(0, n);
}

/** Si el contenido guardado en el indice ya trae CRLF en un archivo de texto. */
export function tieneCrlf(datos: Uint8Array): boolean {
  if (!datos.includes(13)) return false;
  const e = estadistica(datos);
  return !pareceBinario(e) && e.crlf > 0;
}

/**
 * Lo que Git guardaria si se preparara este contenido: la conversion al
 * repositorio. `crlfEnIndice` se pide solo cuando hace falta, porque obliga a
 * leer el objeto del indice.
 */
export async function aRepositorio(
  datos: Uint8Array,
  ruta: string,
  autocrlf: Autocrlf,
  atributos: Atributos,
  crlfEnIndice: () => Promise<boolean>,
): Promise<Uint8Array> {
  const accion: Accion = atributos.accionDe(ruta) ?? (autocrlf === 'false' ? 'binario' : 'auto');
  if (accion === 'binario') return datos;
  if (!datos.includes(13)) return datos;
  const e = estadistica(datos);
  if (e.crlf === 0) return datos;
  if (accion === 'auto') {
    if (pareceBinario(e)) return datos;
    if (await crlfEnIndice()) return datos;
  }
  return quitarCr(datos);
}
