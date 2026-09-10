/**
 * Ordenes de mirar sin tocar: `git show`, `git rev-parse`, `git merge-base` y
 * `git cat-file -t` (punto 4.5 del SPEC 010).
 *
 * Ninguna cambia el estado. Todas responden preguntas sobre el grafo, que es
 * exactamente lo que el motor modela, con una excepcion declarada: la parte de
 * parche de `git show`, que necesitaria el contenido de los archivos y por eso
 * queda fuera (punto 5.1).
 */

import { posicionales, tieneOpcion } from '../analizador';
import {
  confirmacionPorId,
  etiquetaPorNombre,
  idActual,
  ramaActual,
  ramaPorNombre,
} from '../estado';
import { baseComun } from '../grafo';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio } from '../tipos';
import type { Manejador } from './basicas';

/**
 * `git show` sobre una confirmacion o sobre una etiqueta.
 *
 * Muestra la cabecera y los archivos que la confirmacion registro. El parche
 * no se muestra: esta declarado como no soportado en el contrato, junto con
 * `--stat`, porque los dos se calculan sobre el contenido.
 */
export const ordenShow: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencia = posicionales(argumentos, ['--format', '--pretty'])[0] ?? 'HEAD';

  const etiqueta = etiquetaPorNombre(estado, referencia);
  const filas: string[] = [];

  if (etiqueta !== undefined && etiqueta.tipo === 'anotada') {
    filas.push(`tag ${etiqueta.nombre}`);
    filas.push(`Tagger: ${autorDelTaller(estado)}`);
    filas.push('');
    filas.push(etiqueta.mensaje ?? '');
    filas.push('');
  }

  const id = resolverReferencia(estado, referencia);
  if (id === null) {
    return fallo(estado, `fatal: ambiguous argument '${referencia}': unknown revision`);
  }
  const confirmacion = confirmacionPorId(estado, id);
  if (confirmacion === undefined) {
    return fallo(estado, `fatal: bad object ${referencia}`);
  }

  filas.push(`commit ${confirmacion.id}`);
  if (confirmacion.padres.length > 1) {
    filas.push(`Merge: ${confirmacion.padres.join(' ')}`);
  }
  filas.push(`Author: ${confirmacion.autor} <${confirmacion.correo}>`);
  filas.push(`Date:   ${confirmacion.fecha}`);
  filas.push('');
  filas.push(`    ${confirmacion.mensaje}`);
  filas.push('');
  for (const nombre of confirmacion.archivos) filas.push(`    ${nombre}`);
  for (const nombre of confirmacion.borrados) filas.push(`    ${nombre} (retirado)`);

  return ok(estado, lineas(...filas));
};

function autorDelTaller(estado: EstadoRepositorio): string {
  const nombre = estado.config.local['user.name'] ?? estado.config.global['user.name'] ?? '';
  const correo = estado.config.local['user.email'] ?? estado.config.global['user.email'] ?? '';
  return `${nombre} <${correo}>`;
}

/**
 * `git rev-parse`, con `--short` y `--abbrev-ref`.
 *
 * Es la orden que traduce un nombre a un identificador. Sirve para mostrar que
 * `main`, `HEAD` y un identificador son tres maneras de nombrar lo mismo.
 */
export const ordenRevParse: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) {
    if (tieneOpcion(argumentos, '--is-inside-work-tree')) {
      return fallo(
        estado,
        'fatal: not a git repository (or any of the parent directories): .git',
      );
    }
    return sinRepositorio(estado);
  }

  if (tieneOpcion(argumentos, '--is-inside-work-tree')) {
    return ok(estado, lineas('true'));
  }
  if (tieneOpcion(argumentos, '--git-dir')) {
    return ok(estado, lineas('.git'));
  }

  const referencias = posicionales(argumentos);
  if (referencias.length === 0) return fallo(estado, 'usage: git rev-parse <referencia>');

  const abreviarRef = tieneOpcion(argumentos, '--abbrev-ref');
  const filas: string[] = [];
  for (const referencia of referencias) {
    if (abreviarRef) {
      if (referencia === 'HEAD') {
        const rama = ramaActual(estado);
        filas.push(rama ?? 'HEAD');
        continue;
      }
      if (ramaPorNombre(estado, referencia) !== undefined) {
        filas.push(referencia);
        continue;
      }
    }
    const id = resolverReferencia(estado, referencia);
    if (id === null) {
      return fallo(
        estado,
        `${referencia}`,
        `fatal: ambiguous argument '${referencia}': unknown revision or path not in the working tree.`,
      );
    }
    filas.push(id);
  }
  return ok(estado, lineas(...filas));
};

/**
 * `git merge-base`.
 *
 * Devuelve la confirmacion desde la que dos ramas se separaron. Es el dato que
 * decide si una fusion sera un avance rapido o una union, y tenerlo a mano
 * permite mostrarlo en vez de contarlo.
 */
export const ordenMergeBase: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencias = posicionales(argumentos);
  const una = referencias[0];
  const otra = referencias[1];
  if (una === undefined || otra === undefined) {
    return fallo(estado, 'usage: git merge-base <referencia> <referencia>');
  }

  const idUna = resolverReferencia(estado, una);
  const idOtra = resolverReferencia(estado, otra);
  if (idUna === null) return fallo(estado, `fatal: Not a valid object name ${una}`);
  if (idOtra === null) return fallo(estado, `fatal: Not a valid object name ${otra}`);

  const base = baseComun(estado, idUna, idOtra);
  if (base === null) return fallo(estado);
  return ok(estado, lineas(base));
};

/**
 * `git cat-file -t`.
 *
 * Dice de que tipo es un objeto. Es lo que el laboratorio 06 usa para mostrar
 * que una etiqueta simple apunta directo a la confirmacion mientras que una
 * anotada es un objeto propio. Con `-p`, que muestra el contenido, el contrato
 * responde que no lo implementa.
 */
export const ordenCatFile: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  if (!tieneOpcion(argumentos, '-t')) {
    return fallo(estado, 'usage: git cat-file -t <objeto>');
  }
  const referencia = posicionales(argumentos)[0];
  if (referencia === undefined) return fallo(estado, 'usage: git cat-file -t <objeto>');

  const etiqueta = etiquetaPorNombre(estado, referencia);
  if (etiqueta !== undefined) {
    return ok(estado, lineas(etiqueta.tipo === 'anotada' ? 'tag' : 'commit'));
  }
  if (referencia === 'HEAD' && idActual(estado) === null) {
    return fallo(estado, `fatal: Not a valid object name ${referencia}`);
  }
  if (resolverReferencia(estado, referencia) !== null) {
    return ok(estado, lineas('commit'));
  }
  return fallo(estado, `fatal: Not a valid object name ${referencia}`);
};
