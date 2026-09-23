/**
 * El archivo `.git/index`, el area de preparacion (SPEC 020, 2.3 y 2.6).
 *
 * Se leen las versiones 2, 3 y 4. De cada entrada interesa la ruta, el
 * identificador, el modo, la etapa (mayor que cero en un conflicto) y los datos
 * del disco que Git anoto al prepararla: tamaño y fecha de modificacion. Con
 * esos datos se evita volver a calcular la huella de un archivo que no cambio,
 * como hace Git.
 *
 * Dos extensiones cambian que significa el indice y no se sabe representarlas:
 * el indice partido (`link`) y el disperso (`sdir`). Si aparecen, se informa
 * en vez de dibujar un area de preparacion incompleta (punto 2.9).
 */

import { aHex } from './almacen';
import { sha1 } from './sha1';

export interface EntradaIndice {
  readonly ruta: string;
  readonly sha: string;
  readonly modo: number;
  /** 0 normal; 1 base, 2 nuestra, 3 de ellos en un conflicto. */
  readonly etapa: number;
  /** Segundos y nanosegundos de la ultima modificacion que Git vio. */
  readonly mtimeSegundos: number;
  readonly mtimeNanos: number;
  readonly tamano: number;
  /** `git add -N`: la ruta se anuncia pero todavia no se prepara nada. */
  readonly intencion: boolean;
  /** Marcada para no mirarse en el disco (sparse checkout, `update-index --skip-worktree`). */
  readonly omitirTrabajo: boolean;
  /** `git update-index --assume-unchanged`. */
  readonly suponerIgual: boolean;
}

export interface Indice {
  readonly version: number;
  readonly entradas: readonly EntradaIndice[];
  /** Lo que impide representar el indice, si algo lo impide. */
  readonly noSoportado: string | null;
}

function u32(b: Uint8Array, i: number): number {
  return (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
}

function u16(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}

const decodificador = new TextDecoder('utf-8');

export function leerIndice(bytes: Uint8Array): Indice {
  if (bytes.length < 32 || u32(bytes, 0) !== 0x44495243) throw new Error('el archivo index no tiene la firma DIRC');
  const version = u32(bytes, 4);
  if (version < 2 || version > 4) {
    return { version, entradas: [], noSoportado: `el indice esta en la version ${version}, que no se sabe leer` };
  }
  const suma = aHex(bytes, bytes.length - 20);
  if (suma !== sha1(bytes.subarray(0, bytes.length - 20))) {
    // Git lo rechaza con «index file corrupt». Puede pasar si se lee a medio escribir.
    throw new Error('la suma del indice no coincide: puede estar a medio escribir');
  }
  const cantidad = u32(bytes, 8);
  const entradas: EntradaIndice[] = [];
  let p = 12;
  let rutaAnterior: Uint8Array = new Uint8Array(0);
  for (let n = 0; n < cantidad; n += 1) {
    const inicio = p;
    const mtimeSegundos = u32(bytes, p + 8);
    const mtimeNanos = u32(bytes, p + 12);
    const modo = u32(bytes, p + 24);
    const tamano = u32(bytes, p + 36);
    const sha = aHex(bytes, p + 40);
    const banderas = u16(bytes, p + 60);
    p += 62;
    let extendidas = 0;
    if (banderas & 0x4000) {
      extendidas = u16(bytes, p);
      p += 2;
    }
    let ruta: Uint8Array;
    if (version === 4) {
      // La ruta se escribe como «cuantos bytes quitar del final de la anterior» y el resto.
      let c = bytes[p] ?? 0;
      p += 1;
      let quitar = c & 0x7f;
      while (c & 0x80) {
        c = bytes[p] ?? 0;
        p += 1;
        quitar = ((quitar + 1) << 7) | (c & 0x7f);
      }
      const nulo = bytes.indexOf(0, p);
      const resto = bytes.subarray(p, nulo);
      const comun = rutaAnterior.subarray(0, rutaAnterior.length - quitar);
      ruta = new Uint8Array(comun.length + resto.length);
      ruta.set(comun);
      ruta.set(resto, comun.length);
      p = nulo + 1;
    } else {
      const nulo = bytes.indexOf(0, p);
      ruta = bytes.subarray(p, nulo);
      // Relleno con nulos hasta un multiplo de ocho, contando desde el comienzo de la entrada.
      p = inicio + Math.floor((nulo - inicio + 8) / 8) * 8;
    }
    rutaAnterior = ruta;
    entradas.push({
      ruta: decodificador.decode(ruta),
      sha,
      modo,
      etapa: (banderas >> 12) & 3,
      mtimeSegundos,
      mtimeNanos,
      tamano,
      intencion: (extendidas & 0x2000) !== 0,
      omitirTrabajo: (extendidas & 0x4000) !== 0,
      suponerIgual: (banderas & 0x8000) !== 0,
    });
  }

  // Extensiones: firma de cuatro letras y largo. Las que empiezan en mayuscula son opcionales.
  let noSoportado: string | null = null;
  while (p + 8 <= bytes.length - 20) {
    const firma = decodificador.decode(bytes.subarray(p, p + 4));
    const largo = u32(bytes, p + 4);
    if (firma === 'link') noSoportado = 'el indice esta partido (core.splitIndex), y eso no se sabe leer';
    else if (firma === 'sdir') noSoportado = 'el indice es disperso (sparse index), y eso no se sabe leer';
    p += 8 + largo;
  }
  if (noSoportado === null && entradas.some((e) => e.omitirTrabajo)) {
    noSoportado = 'hay archivos marcados para no mirarse en el disco (sparse checkout o skip-worktree)';
  }
  return { version, entradas, noSoportado };
}
