/**
 * Lo que hay dentro de las confirmaciones, las etiquetas anotadas y los arboles
 * (SPEC 020).
 *
 * El `nucleo.js` del arquitecto decodificaba todo como UTF-8. Una confirmacion
 * hecha con `i18n.commitEncoding` en ISO-8859-1 lleva la cabecera `encoding`, y
 * el mensaje salia con caracteres rotos donde Git muestra `ñandú`. Aqui el
 * mensaje se decodifica con la codificacion que declara.
 */

import { aHex } from './almacen';

export interface ConfirmacionReal {
  readonly sha: string;
  readonly arbol: string;
  readonly padres: readonly string[];
  readonly autor: string;
  readonly correo: string;
  /** Segundos desde la epoca, de la linea del autor, que es la que muestra `git log`. */
  readonly epoca: number;
  /** El desplazamiento horario del autor, como `-0300`. */
  readonly zona: string;
  /** Segundos desde la epoca del confirmador, que es la que ordena `git log`. */
  readonly epocaConfirmador: number;
  /** La primera linea del mensaje, como la muestra `git log --oneline`. */
  readonly asunto: string;
  readonly mensaje: string;
}

export interface EtiquetaAnotada {
  readonly objeto: string;
  readonly tipo: string;
  readonly nombre: string;
  readonly mensaje: string;
}

export interface EntradaArbol {
  readonly modo: string;
  readonly nombre: string;
  readonly sha: string;
}

/** Separa cabecera y mensaje, con las lineas de continuacion unidas a su cabecera. */
function cabecerasYMensaje(bytes: Uint8Array): { cabeceras: Map<string, string[]>; mensaje: Uint8Array } {
  let corte = -1;
  for (let i = 0; i + 1 < bytes.length; i += 1) {
    if (bytes[i] === 10 && bytes[i + 1] === 10) {
      corte = i;
      break;
    }
  }
  const cabecera = new TextDecoder('utf-8').decode(corte < 0 ? bytes : bytes.subarray(0, corte));
  const mensaje = corte < 0 ? new Uint8Array(0) : bytes.subarray(corte + 2);
  const cabeceras = new Map<string, string[]>();
  let ultima = '';
  for (const linea of cabecera.split('\n')) {
    if (linea.startsWith(' ') && ultima !== '') {
      // Continuacion de la anterior, como en `gpgsig` o `mergetag`.
      const valores = cabeceras.get(ultima) ?? [];
      valores[valores.length - 1] = `${valores.at(-1) ?? ''}\n${linea.slice(1)}`;
      continue;
    }
    const espacio = linea.indexOf(' ');
    if (espacio < 0) continue;
    ultima = linea.slice(0, espacio);
    cabeceras.set(ultima, [...(cabeceras.get(ultima) ?? []), linea.slice(espacio + 1)]);
  }
  return { cabeceras, mensaje };
}

/** El mensaje en su codificacion declarada; si el navegador no la conoce, en UTF-8. */
function decodificar(mensaje: Uint8Array, codificacion: string | undefined): string {
  if (codificacion !== undefined) {
    try {
      return new TextDecoder(codificacion).decode(mensaje);
    } catch {
      // Codificacion desconocida: se cae a UTF-8, como hace Git si no la puede convertir.
    }
  }
  return new TextDecoder('utf-8').decode(mensaje);
}

/** El asunto como lo arma Git: el primer parrafo, con sus lineas unidas por un espacio. */
function asuntoDe(mensaje: string): string {
  const parrafo = mensaje.replace(/^\n+/, '').split(/\n[ \t]*\n/)[0] ?? '';
  return parrafo
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '')
    .join(' ');
}

function persona(linea: string): { nombre: string; correo: string; epoca: number; zona: string } {
  const m = /^(.*) <([^>]*)> (\d+) ([+-]\d{4})$/.exec(linea);
  return {
    nombre: m?.[1] ?? '',
    correo: m?.[2] ?? '',
    epoca: Number(m?.[3] ?? 0),
    zona: m?.[4] ?? '+0000',
  };
}

export function leerConfirmacion(sha: string, bytes: Uint8Array): ConfirmacionReal {
  const { cabeceras, mensaje: crudo } = cabecerasYMensaje(bytes);
  const mensaje = decodificar(crudo, cabeceras.get('encoding')?.[0]);
  const autor = persona(cabeceras.get('author')?.[0] ?? '');
  const confirmador = persona(cabeceras.get('committer')?.[0] ?? '');
  return {
    sha,
    arbol: cabeceras.get('tree')?.[0] ?? '',
    padres: cabeceras.get('parent') ?? [],
    autor: autor.nombre,
    correo: autor.correo,
    epoca: autor.epoca,
    zona: autor.zona,
    epocaConfirmador: confirmador.epoca,
    asunto: asuntoDe(mensaje),
    mensaje,
  };
}

export function leerEtiqueta(bytes: Uint8Array): EtiquetaAnotada {
  const { cabeceras, mensaje } = cabecerasYMensaje(bytes);
  return {
    objeto: cabeceras.get('object')?.[0] ?? '',
    tipo: cabeceras.get('type')?.[0] ?? '',
    nombre: cabeceras.get('tag')?.[0] ?? '',
    mensaje: decodificar(mensaje, cabeceras.get('encoding')?.[0]).replace(/\n+$/, ''),
  };
}

export function leerArbol(bytes: Uint8Array): readonly EntradaArbol[] {
  const entradas: EntradaArbol[] = [];
  let i = 0;
  const decodificador = new TextDecoder('utf-8');
  while (i < bytes.length) {
    const espacio = bytes.indexOf(32, i);
    const nulo = bytes.indexOf(0, espacio);
    if (espacio < 0 || nulo < 0) throw new Error('arbol mal formado');
    const modo = decodificador.decode(bytes.subarray(i, espacio));
    const nombre = decodificador.decode(bytes.subarray(espacio + 1, nulo));
    entradas.push({ modo, nombre, sha: aHex(bytes, nulo + 1) });
    i = nulo + 21;
  }
  return entradas;
}
