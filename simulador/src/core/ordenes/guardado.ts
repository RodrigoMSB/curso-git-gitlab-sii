/**
 * `git stash`, el guardado temporal.
 *
 * Implementa el punto 8.6 del SPEC 001: la pila. La entrada mas reciente ocupa
 * el indice cero y `pop` saca la de arriba.
 */

import { tieneOpcion, valorDeOpcion } from '../analizador';
import { reservarId } from '../confirmaciones';
import { textoDeTrabajo, textoEnConfirmacion } from '../contenido';
import { type Comparacion, formatearEstadisticasDe, formatearParches } from '../diferencias';
import {
  archivosEn,
  confirmacionPorId,
  establecerArchivo,
  establecerContenido,
  idActual,
  ramaActual,
} from '../estado';
import { formatearEstadoLargo } from '../formato';
import { fallo, lineaError, lineas, ok, sinRepositorio } from '../salida';
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

  // El guardado se lleva el texto, no solo el estado: es lo que permite que al
  // devolverlo aparezca el mismo trabajo y no un archivo marcado como
  // modificado sin ninguna modificacion dentro.
  const entrada: EntradaGuardado = {
    mensaje: descriptor,
    archivos: pendientes.map((archivo) => ({
      ...archivo,
      contenido: textoDeTrabajo(estado, archivo.nombre) ?? '',
    })),
    rama,
    idBase,
    // En Git cada entrada es una confirmacion propia, distinta de aquella
    // sobre la que se guardo. Sin esto, dos entradas hechas en el mismo punto
    // informaban el mismo identificador al borrarlas.
    id: reservarId(estado, `stash:${descriptor}:${idBase}:${estado.guardados.length}`),
  };

  let siguiente: EstadoRepositorio = { ...estado, guardados: [entrada, ...estado.guardados] };
  for (const archivo of pendientes) {
    siguiente = establecerContenido(
      establecerArchivo(siguiente, archivo.nombre, 'limpio'),
      archivo.nombre,
      // El directorio queda como la confirmacion, que es lo que el `null` dice.
      null,
    );
  }

  return ok(siguiente, lineas(`Saved working directory and index state ${descriptor}`));
}

/**
 * Las comparaciones que representa una entrada: lo que la confirmacion tenia
 * contra lo que el participante habia dejado en el directorio.
 */
function cambiosDe(
  estado: EstadoRepositorio,
  entrada: EntradaGuardado,
): readonly Comparacion[] {
  return entrada.archivos.map((archivo) => ({
    ruta: archivo.nombre,
    antes: textoEnConfirmacion(estado, entrada.idBase, archivo.nombre),
    despues: archivo.contenido,
  }));
}

/** El resumen de una entrada, con las lineas contadas de verdad. */
function resumenDe(estado: EstadoRepositorio, entrada: EntradaGuardado): readonly string[] {
  return formatearEstadisticasDe(cambiosDe(estado, entrada));
}

/** El parche de una entrada, que es lo que muestra `git stash show -p`. */
function parcheDe(estado: EstadoRepositorio, entrada: EntradaGuardado): readonly string[] {
  return formatearParches(cambiosDe(estado, entrada));
}

/**
 * Archivos de la entrada que el directorio de trabajo pisaria al devolverla.
 *
 * Git se niega a recuperar sobre un archivo que tiene cambios sin confirmar y
 * que la entrada tambien toca: no intenta fusionar, se detiene antes. Es lo que
 * el punto 1.10 del laboratorio 07 hace ver, y el simulador aplicaba igual y
 * borraba la entrada, que es justo lo contrario de lo que ese paso enseña.
 */
function pisaria(estado: EstadoRepositorio, entrada: EntradaGuardado): readonly string[] {
  return entrada.archivos
    .filter((archivo) => {
      const enElDisco = textoDeTrabajo(estado, archivo.nombre);
      if (enElDisco === null) return false;
      const enLaConfirmacion = textoEnConfirmacion(estado, entrada.idBase, archivo.nombre);
      // Limpio respecto de la confirmacion: no hay nada que pisar.
      if (enElDisco === enLaConfirmacion) return false;
      // Sucio, pero con lo mismo que trae la entrada: tampoco.
      return enElDisco !== archivo.contenido;
    })
    .map((archivo) => archivo.nombre);
}

/** Devuelve al directorio de trabajo los archivos de una entrada. */
function aplicar(
  estado: EstadoRepositorio,
  indice: number,
  conIndice: boolean,
  esPop = false,
): ResultadoOrden {
  const entrada = estado.guardados[indice];
  if (entrada === undefined) return sinEntradas(estado);

  const pisados = pisaria(estado, entrada);
  if (pisados.length > 0) {
    // Git no fusiona: se detiene antes y conserva la entrada. La ultima linea
    // solo la imprime `pop`, porque `apply` no saca nada de la pila nunca.
    return {
      estado,
      salida: [
        lineaError('error: Your local changes to the following files would be overwritten by merge:'),
        ...pisados.map((ruta) => lineaError(`\t${ruta}`)),
        lineaError('Please commit your changes or stash them before you merge.'),
        lineaError('Aborting'),
        ...lineas(...formatearEstadoLargo(estado)),
        ...(esPop ? [lineaError('The stash entry is kept in case you need it again.')] : []),
      ],
      error: true,
      proyectadas: [],
      limpiarConsola: false,
    };
  }

  let siguiente = estado;
  for (const archivo of entrada.archivos) {
    siguiente = establecerArchivo(
      siguiente,
      archivo.nombre,
      conIndice ? archivo.estado : 'modificado',
    );
    siguiente = establecerContenido(siguiente, archivo.nombre, archivo.contenido);
  }
  return ok(siguiente, lineas(...formatearEstadoLargo(siguiente)));
}

function descartar(estado: EstadoRepositorio, indice: number): ResultadoOrden {
  const entrada = estado.guardados[indice];
  if (entrada === undefined) return sinEntradas(estado);
  return ok(
    { ...estado, guardados: estado.guardados.filter((_, posicion) => posicion !== indice) },
    lineas(`Dropped stash@{${indice}} (${entrada.id})`),
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
      // Git deja una linea en blanco entre cada entrada y su resumen.
      const filas = estado.guardados.flatMap((entrada, posicion) => [
        `stash@{${posicion}}: ${entrada.mensaje}`,
        ...(detallado ? ['', ...resumenDe(estado, entrada)] : []),
      ]);
      return ok(estado, lineas(...filas));
    }

    case 'show': {
      const entrada = estado.guardados[indice];
      if (entrada === undefined) return sinEntradas(estado);
      const conParche = tieneOpcion(argumentos, '-p', '--patch');
      return ok(
        estado,
        lineas(...(conParche ? parcheDe(estado, entrada) : resumenDe(estado, entrada))),
      );
    }

    case 'apply':
      return aplicar(estado, indice, tieneOpcion(argumentos, '--index'));

    case 'pop': {
      const aplicado = aplicar(estado, indice, tieneOpcion(argumentos, '--index'), true);
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
