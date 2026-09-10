/**
 * Presentacion de los estados del repositorio: `git status`, `git log` y
 * `git diff`.
 *
 * Los textos imitan los de Git. En el caso del diff no hay contenido que
 * comparar (restriccion R4), de modo que se emite un cuerpo declarado que
 * conserva la forma del original y avisa que es una simulacion.
 */

import { estaSeguido, idActual, ramaActual } from './estado';
import { decoracionesDe } from './referencias';
import type { Confirmacion, EstadoRepositorio } from './tipos';

const SANGRIA = '\t';

/** Encabezado comun a las dos formas de `git status`. */
function encabezadoPosicion(estado: EstadoRepositorio): string {
  const rama = ramaActual(estado);
  if (rama !== null) return `On branch ${rama}`;
  const cabeza = idActual(estado);
  return `HEAD detached at ${cabeza ?? 'unknown'}`;
}

/** `git status` en su forma larga. */
export function formatearEstadoLargo(estado: EstadoRepositorio): readonly string[] {
  const filas: string[] = [encabezadoPosicion(estado)];
  const sinConfirmaciones = idActual(estado) === null;

  if (estado.fusion !== null) {
    filas.push(`You have unmerged paths.`);
    filas.push('  (fix conflicts and run "git commit")');
    filas.push('  (use "git merge --abort" to abort the merge)');
  }

  if (sinConfirmaciones) {
    filas.push('');
    filas.push('No commits yet');
  }

  const preparados = estado.archivos.filter((archivo) => archivo.estado === 'preparado');
  const enConflicto = estado.archivos.filter((archivo) => archivo.estado === 'en-conflicto');
  const modificados = estado.archivos.filter((archivo) => archivo.estado === 'modificado');
  const sinSeguimiento = estado.archivos.filter(
    (archivo) => archivo.estado === 'sin-seguimiento',
  );

  if (preparados.length > 0 || estado.borrados.length > 0) {
    filas.push('');
    filas.push('Changes to be committed:');
    filas.push(
      sinConfirmaciones
        ? '  (use "git rm --cached <file>..." to unstage)'
        : '  (use "git restore --staged <file>..." to unstage)',
    );
    for (const nombre of estado.borrados) {
      filas.push(`${SANGRIA}${'deleted:'.padEnd(12)}${nombre}`);
    }
    for (const archivo of preparados) {
      if (archivo.renombradoDe !== undefined) {
        filas.push(
          `${SANGRIA}${'renamed:'.padEnd(12)}${archivo.renombradoDe} -> ${archivo.nombre}`,
        );
        continue;
      }
      const etiqueta = estaSeguido(estado, archivo.nombre) ? 'modified:' : 'new file:';
      filas.push(`${SANGRIA}${etiqueta.padEnd(12)}${archivo.nombre}`);
    }
  }

  if (enConflicto.length > 0) {
    filas.push('');
    filas.push('Unmerged paths:');
    filas.push('  (use "git add <file>..." to mark resolution)');
    for (const archivo of enConflicto) {
      filas.push(`${SANGRIA}${'both modified:'.padEnd(12)}${archivo.nombre}`);
    }
  }

  if (modificados.length > 0 || estado.borradosSinPreparar.length > 0) {
    filas.push('');
    filas.push('Changes not staged for commit:');
    filas.push('  (use "git add/rm <file>..." to update what will be committed)');
    filas.push('  (use "git restore <file>..." to discard changes in working directory)');
    for (const nombre of estado.borradosSinPreparar) {
      filas.push(`${SANGRIA}${'deleted:'.padEnd(12)}${nombre}`);
    }
    for (const archivo of modificados) {
      filas.push(`${SANGRIA}${'modified:'.padEnd(12)}${archivo.nombre}`);
    }
  }

  if (sinSeguimiento.length > 0) {
    filas.push('');
    filas.push('Untracked files:');
    filas.push('  (use "git add <file>..." to include in what will be committed)');
    for (const archivo of sinSeguimiento) {
      filas.push(`${SANGRIA}${archivo.nombre}`);
    }
  }

  filas.push('');
  if (preparados.length > 0 || enConflicto.length > 0 || estado.borrados.length > 0) {
    // Git no imprime cierre cuando hay algo preparado.
    filas.pop();
  } else if (modificados.length > 0 || estado.borradosSinPreparar.length > 0) {
    filas.push('no changes added to commit (use "git add" and/or "git commit -a")');
  } else if (sinSeguimiento.length > 0) {
    filas.push('nothing added to commit but untracked files present (use "git add" to track)');
  } else {
    filas.push('nothing to commit, working tree clean');
  }

  return filas;
}

/** `git status -s`. */
export function formatearEstadoCorto(estado: EstadoRepositorio): readonly string[] {
  // El switch cubre la union completa de estados y TypeScript verifica esa
  // exhaustividad. Agregar un `default` para callar al linter, que no analiza
  // tipos, convertiria un error de compilacion en un caso silencioso el dia que
  // se agregue un estado nuevo.
  const borrados = [
    ...estado.borrados.map((nombre) => `D  ${nombre}`),
    ...estado.borradosSinPreparar.map((nombre) => ` D ${nombre}`),
  ];
  // biome-ignore lint/suspicious/useIterableCallbackReturn: el switch es exhaustivo por tipos
  const resto = estado.archivos.flatMap((archivo) => {
    switch (archivo.estado) {
      case 'preparado':
        if (archivo.renombradoDe !== undefined) {
          return [`R  ${archivo.renombradoDe} -> ${archivo.nombre}`];
        }
        return [`${estaSeguido(estado, archivo.nombre) ? 'M' : 'A'}  ${archivo.nombre}`];
      case 'modificado':
        return [` M ${archivo.nombre}`];
      case 'sin-seguimiento':
        return [`?? ${archivo.nombre}`];
      case 'en-conflicto':
        return [`UU ${archivo.nombre}`];
      case 'limpio':
        return [];
    }
  });
  return [...borrados, ...resto];
}

export interface OpcionesHistorial {
  readonly unaLinea: boolean;
  readonly grafo: boolean;
  readonly limite: number | null;
}

function decoracion(estado: EstadoRepositorio, id: string): string {
  const nombres = decoracionesDe(estado, id);
  return nombres.length === 0 ? '' : ` (${nombres.join(', ')})`;
}

/**
 * Prefijos del grafo.
 *
 * Es una simplificacion deliberada: se marca cada confirmacion con `*` y se
 * abre `|\` bajo las de union. Dibujar los carriles cruzados es tarea de la
 * capa visual del SPEC 002, que dispone del carril de cada confirmacion.
 */
function prefijos(confirmacion: Confirmacion, grafo: boolean): {
  primero: string;
  resto: string;
  cierre: string | null;
} {
  if (!grafo) return { primero: '', resto: '', cierre: null };
  const esUnion = confirmacion.padres.length > 1;
  return {
    primero: esUnion ? '*   ' : '* ',
    resto: '| ',
    cierre: esUnion ? '|\\  ' : null,
  };
}

/** `git log`, con sus variantes `--oneline`, `--graph` y limite de cantidad. */
export function formatearHistorial(
  estado: EstadoRepositorio,
  confirmaciones: readonly Confirmacion[],
  opciones: OpcionesHistorial,
): readonly string[] {
  const visibles =
    opciones.limite === null ? confirmaciones : confirmaciones.slice(0, opciones.limite);
  const filas: string[] = [];

  visibles.forEach((confirmacion, indice) => {
    const marcas = prefijos(confirmacion, opciones.grafo);

    if (opciones.unaLinea) {
      filas.push(
        `${marcas.primero}${confirmacion.id}${decoracion(estado, confirmacion.id)} ${confirmacion.mensaje}`,
      );
      if (marcas.cierre !== null) filas.push(marcas.cierre);
      return;
    }

    filas.push(
      `${marcas.primero}commit ${confirmacion.id}${decoracion(estado, confirmacion.id)}`,
    );
    if (confirmacion.padres.length > 1) {
      filas.push(`${marcas.resto}Merge: ${confirmacion.padres.join(' ')}`);
    }
    filas.push(`${marcas.resto}Author: ${confirmacion.autor} <${confirmacion.correo}>`);
    filas.push(`${marcas.resto}Date:   ${confirmacion.fecha}`);
    filas.push(`${marcas.resto}`);
    filas.push(`${marcas.resto}    ${confirmacion.mensaje}`);
    if (indice < visibles.length - 1) filas.push(`${marcas.resto}`);
  });

  return filas;
}

/**
 * Cuerpo de `git diff`.
 *
 * El simulador no versiona contenido, de modo que muestra la forma del diff y
 * declara explicitamente que el detalle es simulado, en vez de inventar lineas
 * que el participante podria tomar por reales.
 */
export function formatearDiff(archivos: readonly string[]): readonly string[] {
  return archivos.flatMap((nombre) => [
    `diff --git a/${nombre} b/${nombre}`,
    `--- a/${nombre}`,
    `+++ b/${nombre}`,
    `@@ simulación @@`,
    `+ ${nombre} registra cambios; el simulador no versiona el contenido`,
  ]);
}

/** Resumen por archivo con el formato de `--stat`. */
export function formatearEstadisticas(archivos: readonly string[]): readonly string[] {
  const filas = archivos.map((nombre) => ` ${nombre} | 1 +`);
  const palabra = archivos.length === 1 ? 'file' : 'files';
  return [...filas, ` ${archivos.length} ${palabra} changed`];
}
