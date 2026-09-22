/**
 * Ordenes que reescriben o deshacen historia: `reset`, `revert`, `reflog` y
 * `rebase`.
 *
 * Tres comportamientos del nucleo pedagogico viven aqui. El rebase produce
 * confirmaciones nuevas y deja huerfanas las originales (8.4). El retroceso
 * destructivo mueve el puntero pero no destruye confirmaciones (8.5). La
 * reversion no reescribe historia, crea una confirmacion mas (8.7).
 *
 * En ningun caso se elimina un nodo del grafo: el motor no hace de recolector.
 */

import { posicionales, tieneOpcion } from '../analizador';
import { agregarConfirmacion, resumenArchivos } from '../confirmaciones';
import {
  anotarMovimiento,
  archivoPorNombre,
  archivosEn,
  carrilDeRama,
  confirmacionPorId,
  establecerArchivo,
  establecerContenido,
  estaSeguido,
  idActual,
  moverPosicionActual,
  ramaActual,
  sincronizarDirectorio,
  transformarArchivos,
} from '../estado';
import { textoDeTrabajo, textoEnConfirmacion } from '../contenido';
import { archivosCambiados, esAntepasado, exclusivasDe } from '../grafo';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

type ModoReset = 'soft' | 'mixed' | 'hard';

function modoPedido(argumentos: readonly string[]): ModoReset {
  if (tieneOpcion(argumentos, '--soft')) return 'soft';
  if (tieneOpcion(argumentos, '--hard')) return 'hard';
  return 'mixed';
}

/** Deja de preparar los archivos indicados, sin mover el puntero. */
function despreparar(estado: EstadoRepositorio, rutas: readonly string[]): ResultadoOrden {
  let siguiente = estado;
  for (const ruta of rutas) {
    const archivo = archivoPorNombre(siguiente, ruta);
    if (archivo === undefined) {
      return fallo(estado, `fatal: ambiguous argument '${ruta}': unknown revision or path`);
    }
    if (archivo.estado !== 'preparado') continue;
    const destino = estaSeguido(siguiente, ruta) ? 'modificado' : 'sin-seguimiento';
    siguiente = establecerArchivo(siguiente, ruta, destino);
  }
  return ok(siguiente);
}

/** `git reset`, con `--soft`, `--mixed`, `--hard` y referencia. */
export const ordenReset: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const modo = modoPedido(argumentos);
  const referencias = posicionales(argumentos);
  const primera = referencias[0];

  if (primera === undefined) {
    const preparados = archivosEn(estado, 'preparado').map((archivo) => archivo.nombre);
    return despreparar(estado, preparados);
  }

  const destino = resolverReferencia(estado, primera);
  if (destino === null) {
    if (archivoPorNombre(estado, primera) !== undefined) return despreparar(estado, referencias);
    return fallo(estado, `fatal: ambiguous argument '${primera}': unknown revision or path`);
  }

  const cabeza = idActual(estado);
  if (cabeza === null) return fallo(estado, 'fatal: Failed to resolve HEAD as a valid ref.');

  // Archivos que las confirmaciones descartadas habian registrado.
  const afectados = [...archivosCambiados(estado, destino, cabeza)];

  // El texto que el directorio de trabajo tiene **antes** de mover la posicion.
  // `--soft` y `--mixed` no lo tocan, y sin fijarlo aqui los archivos limpios
  // lo resolverian contra la confirmacion nueva: el simulador mostraria el
  // directorio ya retrocedido y `git diff` no diria nada, cuando lo que Git
  // muestra es justamente la diferencia entre los dos.
  const textosPrevios = new Map(
    afectados.map((nombre) => [nombre, textoDeTrabajo(estado, nombre)]),
  );

  let siguiente = moverPosicionActual(estado, destino);

  if (modo === 'hard') {
    siguiente = transformarArchivos(siguiente, (archivo) =>
      archivo.estado === 'modificado' ||
      archivo.estado === 'preparado' ||
      archivo.estado === 'en-conflicto'
        ? { ...archivo, estado: 'limpio' }
        : archivo,
    );
    // `--hard` es el unico de los tres que reemplaza el directorio de trabajo:
    // lo que las confirmaciones deshechas estrenaron desaparece del disco. Sin
    // esto quedaba en la lista, limpio, como si siguiera versionado.
    siguiente = sincronizarDirectorio(siguiente);
  } else {
    if (modo === 'mixed') {
      siguiente = transformarArchivos(siguiente, (archivo) =>
        archivo.estado === 'preparado' ? { ...archivo, estado: 'modificado' } : archivo,
      );
    }
    for (const nombre of afectados) {
      if (modo === 'soft') {
        siguiente = establecerArchivo(siguiente, nombre, 'preparado');
        siguiente = establecerContenido(siguiente, nombre, textosPrevios.get(nombre) ?? null);
        continue;
      }
      // Un archivo que la confirmacion deshecha habia estrenado deja de estar
      // versionado, y entonces reaparece **sin seguimiento**, no modificado.
      // Git lo muestra con `??` y el simulador lo mostraba con ` M`: la
      // diferencia la encontro el recorrido comparado del laboratorio 06.
      const destino = estaSeguido(siguiente, nombre) ? 'modificado' : 'sin-seguimiento';
      siguiente = establecerArchivo(siguiente, nombre, destino);
      siguiente = establecerContenido(siguiente, nombre, textosPrevios.get(nombre) ?? null);
    }
  }

  // Git guarda en ORIG_HEAD donde estaba antes del salto. Es la red que el
  // enunciado enseña a usar cuando el reset se fue de mas.
  siguiente = { ...siguiente, fusion: null, origHead: cabeza };
  siguiente = anotarMovimiento(siguiente, {
    id: destino,
    idAnterior: cabeza,
    operacion: 'reset',
    descripcion: `moving to ${primera}`,
    rama: ramaActual(siguiente),
  });

  const confirmacion = confirmacionPorId(siguiente, destino);

  if (modo === 'hard') {
    return ok(
      siguiente,
      lineas(`HEAD is now at ${destino} ${confirmacion?.mensaje ?? ''}`.trimEnd()),
    );
  }
  if (modo === 'soft' || afectados.length === 0) return ok(siguiente);

  return ok(
    siguiente,
    lineas('Unstaged changes after reset:', ...afectados.map((nombre) => `M\t${nombre}`)),
  );
};

/** `git revert`, con referencia. Crea una confirmacion nueva y conserva la original. */
export const ordenRevert: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencia = posicionales(argumentos)[0];
  if (referencia === undefined) {
    return fallo(estado, 'fatal: empty commit set passed');
  }

  const id = resolverReferencia(estado, referencia);
  const objetivo = id === null ? undefined : confirmacionPorId(estado, id);
  if (id === null || objetivo === undefined) {
    return fallo(estado, `fatal: bad revision '${referencia}'`);
  }

  const cabeza = idActual(estado);
  if (cabeza === null) return fallo(estado, 'fatal: Failed to resolve HEAD as a valid ref.');

  // Revertir es devolver cada archivo al texto que tenia **antes** de la
  // confirmacion que se revierte, no al que tiene ahora. Un archivo que esa
  // confirmacion creo no tiene version anterior: revertirla lo retira.
  const previa = objetivo.padres[0] ?? null;
  const devueltos: Record<string, string> = {};
  const retirados: string[] = [];
  for (const nombre of objetivo.archivos) {
    const antes = textoEnConfirmacion(estado, previa, nombre);
    if (antes === null) retirados.push(nombre);
    else devueltos[nombre] = antes;
  }
  const registrados = objetivo.archivos.filter((nombre) => !retirados.includes(nombre));

  const mensaje = `Revert "${objetivo.mensaje}"`;
  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: [cabeza],
    archivos: registrados,
    borrados: retirados,
    contenidos: devueltos,
    carril: confirmacionPorId(estado, cabeza)?.carril ?? 0,
    matiz: `revert:${objetivo.id}`,
  });

  // El directorio de trabajo queda como la confirmacion nueva, que es lo que
  // hace Git: la reversion no deja nada pendiente.
  let siguiente = sincronizarDirectorio(
    moverPosicionActual(creado.estado, creado.confirmacion.id),
  );
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: 'revert',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(
      `[${ramaActual(siguiente) ?? 'detached HEAD'} ${creado.confirmacion.id}] ${mensaje}`,
      resumenArchivos([...registrados, ...retirados]),
    ),
  );
};

/** `git reflog`. Muestra las posiciones por las que paso `HEAD`. */
export const ordenReflog: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencia = posicionales(argumentos).find((valor) => valor !== 'show') ?? 'HEAD';
  const entradas = estado.reflog.filter((entrada) => entrada.ref === referencia);

  return ok(
    estado,
    lineas(
      ...entradas.map(
        (entrada, indice) =>
          `${entrada.id} ${referencia}@{${indice}}: ${entrada.operacion}: ${entrada.descripcion}`,
      ),
    ),
  );
};

/** `git rebase` sobre una rama. Copia las confirmaciones y deja las originales huerfanas. */
export const ordenRebase: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  // El rebase del motor nunca se detiene a medias, asi que nunca hay uno en
  // curso que abortar. Se lee aparte y no se deduce de que falte la base:
  // `git rebase --abort main` rebasaba sobre main.
  if (tieneOpcion(argumentos, '--abort')) return fallo(estado, 'fatal: No rebase in progress?');

  const referencia = posicionales(argumentos)[0];
  if (referencia === undefined) {
    return fallo(estado, 'fatal: No rebase in progress?');
  }

  const base = resolverReferencia(estado, referencia);
  if (base === null) {
    return fallo(estado, `fatal: invalid upstream '${referencia}'`);
  }

  const cabeza = idActual(estado);
  if (cabeza === null) return fallo(estado, 'fatal: Failed to resolve HEAD as a valid ref.');

  const rama = ramaActual(estado);
  const nombreRama = rama ?? 'HEAD';

  if (esAntepasado(estado, base, cabeza)) {
    return ok(estado, lineas(`Current branch ${nombreRama} is up to date.`));
  }

  if (esAntepasado(estado, cabeza, base)) {
    let siguiente = moverPosicionActual(estado, base);
    siguiente = anotarMovimiento(siguiente, {
      id: base,
      idAnterior: cabeza,
      operacion: 'rebase (finish)',
      descripcion: `returning to refs/heads/${nombreRama}`,
      rama,
    });
    return ok(siguiente, lineas(`Fast-forwarded ${nombreRama} to ${referencia}.`));
  }

  const aReescribir = exclusivasDe(estado, cabeza, base);
  const carril = rama === null ? 0 : carrilDeRama(estado, rama);

  let siguiente = estado;
  let anterior = base;
  for (const original of aReescribir) {
    const creado = agregarConfirmacion(siguiente, {
      mensaje: original.mensaje,
      padres: [anterior],
      archivos: original.archivos,
      // La copia aplica el mismo cambio sobre la base nueva: lleva el texto
      // que la confirmacion original dejo en cada archivo que toco, y lo apoya
      // sobre el arbol de donde ahora cuelga.
      contenidos: Object.fromEntries(
        original.archivos.map((nombre) => [
          nombre,
          textoEnConfirmacion(siguiente, original.id, nombre) ?? '',
        ]),
      ),
      carril,
      // El matiz garantiza que la copia no comparta identificador con el original.
      matiz: `rebase:${original.id}:${anterior}`,
    });
    siguiente = creado.estado;
    anterior = creado.confirmacion.id;
  }

  siguiente = moverPosicionActual(siguiente, anterior);
  siguiente = anotarMovimiento(siguiente, {
    id: anterior,
    idAnterior: cabeza,
    operacion: 'rebase (finish)',
    descripcion: `returning to refs/heads/${nombreRama}`,
    rama,
  });

  return ok(siguiente, lineas(`Successfully rebased and updated refs/heads/${nombreRama}.`));
};
