/**
 * Ordenes de mirar sin tocar: `git show`, `git rev-parse`, `git merge-base` y
 * `git cat-file` (punto 4.5 del SPEC 010, ampliado por el SPEC 012).
 *
 * Ninguna cambia el estado. Todas responden preguntas sobre el grafo, y desde
 * el SPEC 012 tambien sobre el contenido: `git show` trae su parche y
 * `git cat-file -p` muestra lo que hay dentro de un objeto.
 */

import { posicionales, tieneOpcion } from '../analizador';
import { arbolDe, comparacionesEntre, lineasDe, textoEnConfirmacion } from '../contenido';
import { formatearEstadisticasDe, formatearParches } from '../diferencias';
import {
  confirmacionPorId,
  etiquetaPorNombre,
  idActual,
  ramaActual,
  ramaPorNombre,
} from '../estado';
import { baseComun } from '../grafo';
import { cadenaDeObjetos } from '../objetos';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/**
 * Referencia que nombra un archivo dentro de una confirmacion, `HEAD:ruta`.
 *
 * Es la forma con la que Git pregunta por el contenido de un archivo tal como
 * quedo en un punto de la historia, y la que `git show` y `git cat-file -p`
 * comparten.
 */
function partirRuta(referencia: string): { revision: string; ruta: string } | null {
  const corte = referencia.indexOf(':');
  if (corte <= 0) return null;
  return { revision: referencia.slice(0, corte), ruta: referencia.slice(corte + 1) };
}

/**
 * `git show` sobre una confirmacion, una etiqueta o un archivo de una
 * confirmacion.
 *
 * Muestra la cabecera y, detras, **el parche de verdad** (punto 3.4 del
 * SPEC 012). Es lo que el punto 2.6 del laboratorio 03 le pide mirar al
 * participante para que vea la credencial completa dentro de la historia: sin
 * el parche, ese paso mostraba una lista de nombres de archivo y el laboratorio
 * se quedaba sin su remate.
 *
 * Con `-s` o `--no-patch` se calla el parche, y con `--stat` se resume.
 */
export const ordenShow: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencia = posicionales(argumentos, ['--format', '--pretty'])[0] ?? 'HEAD';

  // `git show HEAD:platos.md` no muestra una confirmacion, muestra un archivo.
  const enRuta = partirRuta(referencia);
  if (enRuta !== null) {
    const idRuta = resolverReferencia(estado, enRuta.revision);
    if (idRuta === null) {
      return fallo(estado, `fatal: invalid object name '${enRuta.revision}'.`);
    }
    const texto = textoEnConfirmacion(estado, idRuta, enRuta.ruta);
    if (texto === null) {
      return fallo(
        estado,
        `fatal: path '${enRuta.ruta}' does not exist in '${enRuta.revision}'`,
      );
    }
    return ok(estado, lineas(...lineasDe(texto)));
  }

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

  const cambios = comparacionesEntre(estado, confirmacion.padres[0] ?? null, confirmacion.id);

  // **Una union no lleva parche, y si lleva resumen.** Comprobado contra Git:
  // `git show <union>` imprime la cabecera y nada mas, porque una union tiene
  // dos padres y «el cambio» no es uno solo; `git show --stat <union>` si
  // resume, que es lo que el punto 2.3 del laboratorio 05 hace mirar.
  const esUnion = confirmacion.padres.length > 1;
  if (esUnion && !tieneOpcion(argumentos, '--stat')) {
    return ok(estado, lineas(...filas));
  }

  if (tieneOpcion(argumentos, '-s', '--no-patch')) {
    // Sin parche, se enumeran los archivos: es lo que el simulador mostraba
    // antes de tener contenido y sigue siendo util para leer el grafo.
    for (const nombre of confirmacion.archivos) filas.push(`    ${nombre}`);
    for (const nombre of confirmacion.borrados) filas.push(`    ${nombre} (retirado)`);
    return ok(estado, lineas(...filas));
  }

  filas.push(
    ...(tieneOpcion(argumentos, '--stat')
      ? formatearEstadisticasDe(cambios)
      : formatearParches(cambios)),
  );

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
 * `git cat-file`, con `-t` y con `-p` (punto 3.5 del SPEC 012).
 *
 * Con `-t` dice de que tipo es un objeto, que es lo que el laboratorio 06 usa
 * para mostrar que una etiqueta simple apunta directo a la confirmacion
 * mientras que una anotada es un objeto propio.
 *
 * Con `-p` muestra lo que hay dentro. La cadena de objetos que alimenta el
 * panel de estructuras internas es la misma que se imprime aqui, de modo que
 * la pantalla y la orden no puedan contar cosas distintas.
 */
export const ordenCatFile: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  if (tieneOpcion(argumentos, '-p')) return mostrarObjeto(estado, argumentos);

  if (!tieneOpcion(argumentos, '-t')) {
    return fallo(estado, 'usage: git cat-file (-t | -p) <objeto>');
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

/**
 * `git cat-file -p`: lo que hay dentro de un objeto.
 *
 * Se aceptan las tres formas que el taller puede necesitar: la confirmacion,
 * su arbol y un archivo nombrado con `HEAD:ruta`. Los identificadores de arbol
 * y de elemento son los que el panel de estructuras internas ya mostraba, y
 * salen del mismo modulo: si difirieran, la pantalla y la orden estarian
 * describiendo dos repositorios.
 */
function mostrarObjeto(
  estado: EstadoRepositorio,
  argumentos: readonly string[],
): ResultadoOrden {
  const referencia = posicionales(argumentos)[0];
  if (referencia === undefined) return fallo(estado, 'usage: git cat-file -p <objeto>');

  const enRuta = partirRuta(referencia);
  if (enRuta !== null) {
    const id = resolverReferencia(estado, enRuta.revision);
    const texto = id === null ? null : textoEnConfirmacion(estado, id, enRuta.ruta);
    if (texto === null) {
      return fallo(estado, `fatal: Not a valid object name ${referencia}`);
    }
    return ok(estado, lineas(...lineasDe(texto)));
  }

  const etiqueta = etiquetaPorNombre(estado, referencia);
  if (etiqueta !== undefined && etiqueta.tipo === 'anotada') {
    const apuntada = etiqueta.id;
    return ok(
      estado,
      lineas(
        `object ${apuntada}`,
        'type commit',
        `tag ${etiqueta.nombre}`,
        '',
        etiqueta.mensaje ?? '',
      ),
    );
  }

  const id = resolverReferencia(estado, referencia);
  const cadena = id === null ? null : cadenaDeObjetos(estado, id);
  if (id !== null && cadena !== null) {
    return ok(
      estado,
      lineas(
        ...cadena.confirmacion.campos.map((campo) => `${campo.clave} ${campo.valor}`),
        '',
        cadena.confirmacion.nombre,
      ),
    );
  }

  // Un arbol se nombra por el identificador que la propia cadena de objetos
  // publica, que es el que el panel de estructuras internas muestra.
  for (const confirmacion of estado.confirmaciones) {
    const suya = cadenaDeObjetos(estado, confirmacion.id);
    if (suya === null) continue;
    if (suya.arbol.id === referencia) {
      const arbol = arbolDe(estado, confirmacion.id);
      return ok(
        estado,
        lineas(
          ...Object.keys(arbol)
            .sort()
            .map((ruta) => {
              const elemento = suya.elementos.find((uno) => uno.nombre === ruta);
              return `100644 blob ${elemento?.id ?? '0000000'}\t${ruta}`;
            }),
        ),
      );
    }
    const elemento = suya.elementos.find((uno) => uno.id === referencia);
    if (elemento !== undefined) {
      const texto = textoEnConfirmacion(estado, confirmacion.id, elemento.nombre);
      if (texto !== null) return ok(estado, lineas(...lineasDe(texto)));
    }
  }

  return fallo(estado, `fatal: Not a valid object name ${referencia}`);
}
