/**
 * `git stash`, el guardado temporal.
 *
 * Implementa el punto 8.6 del SPEC 001: la pila. La entrada mas reciente ocupa
 * el indice cero y `pop` saca la de arriba.
 */

import { tieneOpcion, valorDeOpcion } from '../analizador';
import {
  archivosEn,
  confirmacionPorId,
  establecerArchivo,
  idActual,
  ramaActual,
} from '../estado';
import { formatearEstadisticas, formatearEstadoLargo } from '../formato';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EntradaGuardado, EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** Interpreta `stash@{2}` y devuelve el indice de la pila. */
function indicePedido(argumentos: readonly string[]): number {
  for (const argumento of argumentos) {
    const coincidencia = /^stash@\{(\d+)\}$/.exec(argumento);
    const digitos = coincidencia?.[1];
    if (digitos !== undefined) return Number.parseInt(digitos, 10);
  }
  return 0;
}

function sinEntradas(estado: EstadoRepositorio): ResultadoOrden {
  return fallo(estado, 'No stash entries found.');
}

/** Guarda los cambios del directorio de trabajo y lo deja limpio. */
function guardar(estado: EstadoRepositorio, argumentos: readonly string[]): ResultadoOrden {
  const pendientes = archivosEn(estado, 'modificado', 'preparado');
  if (pendientes.length === 0) {
    return ok(estado, lineas('No local changes to save'));
  }

  const rama = ramaActual(estado) ?? 'HEAD';
  const idBase = idActual(estado) ?? '0000000';
  const explicito =
    valorDeOpcion(argumentos, '-m', '--message') ??
    argumentos.find(
      (argumento, indice) =>
        indice > 0 && !argumento.startsWith('-') && argumentos[0] === 'save',
    ) ??
    null;

  const cabeza = confirmacionPorId(estado, idBase);
  const descriptor =
    explicito === null
      ? `WIP on ${rama}: ${idBase} ${cabeza?.mensaje ?? ''}`.trimEnd()
      : `On ${rama}: ${explicito}`;

  const entrada: EntradaGuardado = {
    mensaje: descriptor,
    archivos: pendientes.map((archivo) => ({ ...archivo })),
    rama,
    idBase,
  };

  let siguiente: EstadoRepositorio = { ...estado, guardados: [entrada, ...estado.guardados] };
  for (const archivo of pendientes) {
    siguiente = establecerArchivo(siguiente, archivo.nombre, 'limpio');
  }

  return ok(siguiente, lineas(`Saved working directory and index state ${descriptor}`));
}

/** Devuelve al directorio de trabajo los archivos de una entrada. */
function aplicar(
  estado: EstadoRepositorio,
  indice: number,
  conIndice: boolean,
): ResultadoOrden {
  const entrada = estado.guardados[indice];
  if (entrada === undefined) return sinEntradas(estado);

  let siguiente = estado;
  for (const archivo of entrada.archivos) {
    siguiente = establecerArchivo(
      siguiente,
      archivo.nombre,
      conIndice ? archivo.estado : 'modificado',
    );
  }
  return ok(siguiente, lineas(...formatearEstadoLargo(siguiente)));
}

function descartar(estado: EstadoRepositorio, indice: number): ResultadoOrden {
  const entrada = estado.guardados[indice];
  if (entrada === undefined) return sinEntradas(estado);
  return ok(
    { ...estado, guardados: estado.guardados.filter((_, posicion) => posicion !== indice) },
    lineas(`Dropped stash@{${indice}} (${entrada.idBase})`),
  );
}

/** `git stash` con `push`, `save`, `list`, `show`, `apply`, `pop`, `drop` y `clear`. */
export const ordenStash: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const subcomando = argumentos[0] ?? 'push';
  const indice = indicePedido(argumentos);

  switch (subcomando) {
    case 'push':
    case 'save':
      return guardar(estado, argumentos);

    case 'list': {
      const detallado = tieneOpcion(argumentos, '--stat');
      const filas = estado.guardados.flatMap((entrada, posicion) => [
        `stash@{${posicion}}: ${entrada.mensaje}`,
        ...(detallado
          ? formatearEstadisticas(entrada.archivos.map((archivo) => archivo.nombre))
          : []),
      ]);
      return ok(estado, lineas(...filas));
    }

    case 'show': {
      const entrada = estado.guardados[indice];
      if (entrada === undefined) return sinEntradas(estado);
      return ok(
        estado,
        lineas(...formatearEstadisticas(entrada.archivos.map((archivo) => archivo.nombre))),
      );
    }

    case 'apply':
      return aplicar(estado, indice, tieneOpcion(argumentos, '--index'));

    case 'pop': {
      const aplicado = aplicar(estado, indice, tieneOpcion(argumentos, '--index'));
      if (aplicado.error) return aplicado;
      const descartado = descartar(aplicado.estado, indice);
      return ok(descartado.estado, [...aplicado.salida, ...descartado.salida]);
    }

    case 'drop':
      return descartar(estado, indice);

    case 'clear':
      return ok({ ...estado, guardados: [] });

    default:
      if (subcomando.startsWith('-')) return guardar(estado, ['push', ...argumentos]);
      return fallo(estado, `error: unknown subcommand: \`${subcomando}'`);
  }
};
