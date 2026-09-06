/**
 * Ordenes del interprete de mandatos y `git remote`.
 *
 * Las del interprete existen para que la consola resulte creible: el
 * participante puede mirar donde esta, que archivos hay y modificar uno antes
 * de prepararlo.
 */

import { esOperador, posicionales, tieneOpcion } from '../analizador';
import { archivoPorNombre, establecerArchivo } from '../estado';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** `pwd` */
export const ordenPwd: Manejador = (estado) => ok(estado, lineas(estado.directorio));

/** `clear` */
export const ordenClear: Manejador = (estado) => ok(estado, [], { limpiarConsola: true });

/**
 * `ls`. Muestra las entradas de primer nivel; las carpetas van con barra
 * final, como en un interprete real.
 */
export const ordenLs: Manejador = (estado, argumentos) => {
  const prefijoPedido = posicionales(argumentos)[0] ?? '';
  const prefijo =
    prefijoPedido === '' || prefijoPedido === '.'
      ? ''
      : prefijoPedido.endsWith('/')
        ? prefijoPedido
        : `${prefijoPedido}/`;

  const entradas = new Set<string>();
  for (const archivo of estado.archivos) {
    if (!archivo.nombre.startsWith(prefijo)) continue;
    const resto = archivo.nombre.slice(prefijo.length);
    const corte = resto.indexOf('/');
    entradas.add(corte < 0 ? resto : `${resto.slice(0, corte)}/`);
  }

  if (entradas.size === 0 && prefijo !== '') {
    return fallo(estado, `ls: ${prefijoPedido}: No such file or directory`);
  }

  return ok(estado, lineas(...[...entradas].sort((una, otra) => una.localeCompare(otra))));
};

/**
 * `cat`. El simulador no versiona contenido (restriccion R4), de modo que
 * declara esa limitacion en vez de inventar un texto que el participante
 * podria tomar por real.
 */
export const ordenCat: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'cat: falta el nombre del archivo');

  const filas: string[] = [];
  for (const ruta of rutas) {
    if (archivoPorNombre(estado, ruta) === undefined) {
      return fallo(estado, `cat: ${ruta}: No such file or directory`);
    }
    filas.push(`[${ruta}: el simulador registra el estado del archivo, no su contenido]`);
  }
  return ok(estado, lineas(...filas));
};

/**
 * `echo`, con redireccion de anexion sobre un archivo.
 *
 * Escribir sobre un archivo lo marca como modificado, que es la manera de
 * generar trabajo pendiente dentro del simulador.
 */
export const ordenEcho: Manejador = (estado, argumentos) => {
  const corte = argumentos.findIndex(esOperador);

  if (corte < 0) {
    return ok(estado, lineas(argumentos.join(' ')));
  }

  const destino = argumentos[corte + 1];
  if (destino === undefined) {
    return fallo(estado, 'bash: syntax error near unexpected token `newline\'');
  }

  const existente = archivoPorNombre(estado, destino);
  if (existente === undefined) {
    return ok(establecerArchivo(estado, destino, 'sin-seguimiento'));
  }
  if (existente.estado === 'limpio') {
    return ok(establecerArchivo(estado, destino, 'modificado'));
  }
  return ok(estado);
};

/** `git remote`, con `-v` y `add`. */
export const ordenRemote: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const partes = posicionales(argumentos);

  if (partes[0] === 'add') {
    const nombre = partes[1];
    const url = partes[2];
    if (nombre === undefined || url === undefined) {
      return fallo(estado, 'usage: git remote add <name> <url>');
    }
    if (estado.remotos.some((remoto) => remoto.nombre === nombre)) {
      return fallo(estado, `error: remote ${nombre} already exists.`);
    }
    return ok({ ...estado, remotos: [...estado.remotos, { nombre, url }] });
  }

  if (partes[0] === 'remove' || partes[0] === 'rm') {
    const nombre = partes[1];
    if (nombre === undefined) return fallo(estado, 'usage: git remote remove <name>');
    if (!estado.remotos.some((remoto) => remoto.nombre === nombre)) {
      return fallo(estado, `error: No such remote: '${nombre}'`);
    }
    return ok({
      ...estado,
      remotos: estado.remotos.filter((remoto) => remoto.nombre !== nombre),
    });
  }

  if (tieneOpcion(argumentos, '-v', '--verbose')) {
    return ok(
      estado,
      lineas(
        ...estado.remotos.flatMap((remoto) => [
          `${remoto.nombre}\t${remoto.url} (fetch)`,
          `${remoto.nombre}\t${remoto.url} (push)`,
        ]),
      ),
    );
  }

  return ok(estado, lineas(...estado.remotos.map((remoto) => remoto.nombre)));
};

/** Reclamo del interprete ante una orden que no existe. */
export function ordenDesconocida(
  estado: EstadoRepositorio,
  programa: string,
): ResultadoOrden {
  return fallo(estado, `bash: ${programa}: command not found`);
}
