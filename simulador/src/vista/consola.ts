/**
 * Presentacion de la consola: indicador, colores, completado y navegacion del
 * historial.
 *
 * Todo lo de aqui es presentacion de texto. No decide nada sobre
 * confirmaciones, ramas ni punteros: eso lo resuelve el motor.
 */

import { ORDENES_GIT, ORDENES_INTERPRETE, ramaActual, tokenizar } from '../core';
import type { EstadoRepositorio, LineaSalida } from '../core/tipos';

export type ColorConsola =
  | 'normal'
  | 'exito'
  | 'error'
  | 'aviso'
  | 'limite'
  | 'orden'
  | 'apagado';

export interface Renglon {
  readonly clave: string;
  readonly texto: string;
  readonly color: ColorConsola;
  /**
   * El indicador con que se escribio la orden, si cambia de una orden a otra.
   * En el modo taller `cd` mueve la carpeta, y cada orden queda con la suya,
   * como en Git Bash (SPEC 026).
   */
  readonly indicador?: Indicador;
}

export interface Indicador {
  readonly usuario: string;
  readonly ruta: string;
  readonly rama: string | null;
}

/**
 * Indicador de dos lineas, como el de Git Bash sobre Windows, que es el
 * entorno donde los participantes van a trabajar (punto 4.1).
 */
export function indicadorDe(estado: EstadoRepositorio): Indicador {
  // La ruta completa del laboratorio y no solo la ultima carpeta: en el disco
  // el participante esta parado en taller-git-trabajo/lab-NN/recetario, y el
  // indicador tiene que decir lo mismo que su terminal (SPEC 007).
  const ruta = estado.directorio.replace(/^\/+/, '');
  return {
    usuario: 'participante@SII-TALLER MINGW64',
    ruta: `~/${ruta}`,
    rama: estado.iniciado ? ramaActual(estado) : null,
  };
}

/** Encabezados de `git status` que abren un bloque de archivos preparados. */
const ABRE_PREPARADO = /^Changes to be committed:/;
/** Encabezados que abren un bloque de archivos pendientes o en conflicto. */
const ABRE_PENDIENTE = /^(Changes not staged for commit:|Untracked files:|Unmerged paths:)/;

function colorDeLineaCorta(texto: string): ColorConsola | null {
  const indice = texto.slice(0, 2);
  if (indice === 'A ' || indice === 'M ') return 'exito';
  if (indice === ' M' || indice === '??' || indice === 'UU') return 'error';
  return null;
}

/**
 * Asigna colores a la salida de una orden.
 *
 * Reproduce el criterio de Git (punto 4.5): verde lo preparado, rojo lo
 * modificado sin preparar, amarillo las advertencias. La salida larga de
 * `git status` no marca cada linea, de modo que el color se deduce del bloque
 * en que la linea aparece, igual que hace Git al pintarla.
 */
export function colorearSalida(
  salida: readonly LineaSalida[],
  prefijoClave: string,
): readonly Renglon[] {
  let bloque: ColorConsola = 'normal';

  return salida.map((linea, indice) => {
    const texto = linea.texto;
    const clave = `${prefijoClave}:${indice}`;

    if (linea.tipo === 'error') return { clave, texto, color: 'error' };
    // Un limite del simulador no es un fallo del participante, asi que no se
    // pinta como un reclamo de Git (punto 6.3 del SPEC 010).
    if (linea.tipo === 'limite') return { clave, texto, color: 'limite' };
    if (linea.tipo === 'aviso') return { clave, texto, color: 'aviso' };
    if (linea.tipo === 'exito') return { clave, texto, color: 'exito' };

    if (ABRE_PREPARADO.test(texto)) {
      bloque = 'exito';
      return { clave, texto, color: 'normal' };
    }
    if (ABRE_PENDIENTE.test(texto)) {
      bloque = 'error';
      return { clave, texto, color: 'normal' };
    }
    if (texto.trim() === '') {
      bloque = 'normal';
      return { clave, texto, color: 'normal' };
    }

    if (texto.startsWith('hint:')) return { clave, texto, color: 'apagado' };
    if (texto.startsWith('CONFLICT')) return { clave, texto, color: 'error' };
    if (texto.startsWith('Auto-merging')) return { clave, texto, color: 'aviso' };
    if (texto.startsWith('+') && !texto.startsWith('+++')) return { clave, texto, color: 'exito' };
    if (texto.startsWith('-') && !texto.startsWith('---')) return { clave, texto, color: 'error' };

    const corta = colorDeLineaCorta(texto);
    if (corta !== null) return { clave, texto, color: corta };

    // Dentro de un bloque de estado, las lineas de archivo van sangradas.
    if (bloque !== 'normal' && (texto.startsWith('\t') || texto.startsWith('    '))) {
      return { clave, texto, color: bloque };
    }
    if (texto.startsWith('  (')) return { clave, texto, color: 'apagado' };

    return { clave, texto, color: 'normal' };
  });
}

export interface Completado {
  /** Linea completa ya terminada, o `null` si no hubo una unica coincidencia. */
  readonly texto: string | null;
  /** Coincidencias a listar cuando hay mas de una. */
  readonly sugerencias: readonly string[];
}

/**
 * Completa la orden con la tecla de tabulacion (punto 4.4).
 *
 * Completa cuando hay una unica coincidencia entre las ordenes conocidas, los
 * nombres de rama y los archivos presentes. Si hay varias, las lista.
 */
export function completar(entrada: string, estado: EstadoRepositorio): Completado {
  const terminaEnEspacio = /\s$/.test(entrada);
  const piezas = tokenizar(entrada);
  const parcial = terminaEnEspacio ? '' : (piezas.at(-1) ?? '');
  const anteriores = terminaEnEspacio ? piezas : piezas.slice(0, -1);

  const candidatos = candidatosPara(anteriores, estado);
  const coincidencias = candidatos.filter((candidato) => candidato.startsWith(parcial));

  if (coincidencias.length === 0) return { texto: null, sugerencias: [] };
  if (coincidencias.length > 1) return { texto: null, sugerencias: coincidencias };

  const unica = coincidencias[0] ?? '';
  return { texto: [...anteriores, unica].join(' '), sugerencias: [] };
}

function candidatosPara(
  anteriores: readonly string[],
  estado: EstadoRepositorio,
): readonly string[] {
  if (anteriores.length === 0) {
    return ['git', ...Object.keys(ORDENES_INTERPRETE)].sort();
  }
  if (anteriores.length === 1 && anteriores[0] === 'git') {
    return Object.keys(ORDENES_GIT).sort();
  }
  return [
    ...estado.ramas.map((rama) => rama.nombre),
    ...estado.etiquetas.map((etiqueta) => etiqueta.nombre),
    ...estado.archivos.map((archivo) => archivo.nombre),
  ].sort();
}

/**
 * Recorre el historial de ordenes con las flechas (punto 4.2).
 *
 * El indice cuenta desde el final: cero es la orden en curso, uno la ultima
 * escrita. Devuelve el indice nuevo y el texto que corresponde mostrar.
 */
export function navegarHistorial(
  historial: readonly string[],
  indice: number,
  direccion: 'anterior' | 'siguiente',
): { readonly indice: number; readonly texto: string } {
  const paso = direccion === 'anterior' ? 1 : -1;
  const propuesto = Math.min(Math.max(indice + paso, 0), historial.length);
  const texto = propuesto === 0 ? '' : (historial[historial.length - propuesto] ?? '');
  return { indice: propuesto, texto };
}
