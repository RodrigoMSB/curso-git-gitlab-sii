/**
 * Ordenes que mueven, retiran y enumeran archivos: `git mv`, `git rm` y
 * `git ls-files` (puntos 4.3 y 4.5 del SPEC 010).
 *
 * Las tres son el centro del laboratorio 03, que enseña la distincion mas
 * sutil del taller: **ignorar un archivo y sacarlo del seguimiento son cosas
 * distintas**. Sin `git rm --cached` el simulador no puede mostrar esa
 * diferencia, y sin ella el laboratorio no se puede seguir en pantalla.
 */

import { posicionales, tieneOpcion } from '../analizador';
import { archivoPorNombre, archivosSeguidos, estaSeguido } from '../estado';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { Archivo, EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** Archivos que una ruta abarca: el archivo exacto o lo que cuelga de una carpeta. */
function abarcados(estado: EstadoRepositorio, ruta: string): readonly Archivo[] {
  const carpeta = ruta.endsWith('/') ? ruta : `${ruta}/`;
  return estado.archivos.filter(
    (archivo) => archivo.nombre === ruta || archivo.nombre.startsWith(carpeta),
  );
}

/** Si la ruta nombra una carpeta, sea por los archivos que tiene o por `mkdir`. */
function esCarpeta(estado: EstadoRepositorio, ruta: string): boolean {
  const limpia = ruta.replace(/\/+$/, '');
  if (estado.carpetas.includes(limpia)) return true;
  return estado.archivos.some((archivo) => archivo.nombre.startsWith(`${limpia}/`));
}

/**
 * `git rm`, con `--cached` y `-r`.
 *
 * Sin `--cached` el archivo sale del seguimiento **y** del directorio de
 * trabajo. Con `--cached` sale solo del seguimiento y se queda en el disco,
 * que es lo que el enunciado hace con `notas.tmp` y `respaldo.bak`.
 */
export const ordenRm: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const rutas = posicionales(argumentos);
  if (rutas.length === 0) {
    return fallo(estado, 'fatal: No pathspec was given. Which files should I remove?');
  }

  const soloDelIndice = tieneOpcion(argumentos, '--cached');
  const recursivo = tieneOpcion(argumentos, '-r');
  const forzado = tieneOpcion(argumentos, '-f', '--force');

  let siguiente = estado;
  for (const ruta of rutas) {
    if (esCarpeta(siguiente, ruta) && !recursivo) {
      return fallo(estado, `fatal: not removing '${ruta}' recursively without -r`);
    }

    const alcanzados = abarcados(siguiente, ruta).filter((archivo) =>
      estaSeguido(siguiente, archivo.nombre),
    );
    if (alcanzados.length === 0) {
      return fallo(estado, `fatal: pathspec '${ruta}' did not match any files`);
    }

    for (const archivo of alcanzados) {
      if (!forzado && !soloDelIndice && archivo.estado !== 'limpio') {
        return fallo(
          estado,
          `error: the following file has local modifications:\n    ${archivo.nombre}`,
          '(use --cached to keep the file, or -f to force removal)',
        );
      }
      siguiente = {
        ...siguiente,
        borrados: siguiente.borrados.includes(archivo.nombre)
          ? siguiente.borrados
          : [...siguiente.borrados, archivo.nombre],
        archivos: soloDelIndice
          ? siguiente.archivos.map((candidato) =>
              candidato.nombre === archivo.nombre
                ? { nombre: candidato.nombre, estado: 'sin-seguimiento' as const }
                : candidato,
            )
          : siguiente.archivos.filter((candidato) => candidato.nombre !== archivo.nombre),
      };
    }
  }

  const salida = siguiente.borrados
    .filter((nombre) => !estado.borrados.includes(nombre))
    .map((nombre) => `rm '${nombre}'`);
  return ok(siguiente, lineas(...salida));
};

/**
 * `git mv`.
 *
 * Es el atajo que hace el `mv` y el `add` de una vez. Lo que el enunciado hace
 * ver despues es que Git no guarda «un renombrado»: deduce que es el mismo
 * archivo comparando el contenido. Aqui el renombrado se anota igual, porque
 * es lo que `git status` necesita para decir `renamed:`.
 */
export const ordenMv: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const rutas = posicionales(argumentos);
  const destinoCrudo = rutas.at(-1);
  const origenes = rutas.slice(0, -1);
  if (destinoCrudo === undefined || origenes.length === 0) {
    return fallo(estado, 'usage: git mv <source>... <destination>');
  }

  const aCarpeta = esCarpeta(estado, destinoCrudo) || destinoCrudo.endsWith('/');
  if (origenes.length > 1 && !aCarpeta) {
    return fallo(estado, `fatal: destination '${destinoCrudo}' is not a directory`);
  }

  let siguiente = estado;
  for (const origen of origenes) {
    const archivo = archivoPorNombre(siguiente, origen);
    if (archivo === undefined) {
      return fallo(estado, `fatal: bad source, source=${origen}, destination=${destinoCrudo}`);
    }
    if (!estaSeguido(siguiente, origen)) {
      return fallo(estado, `fatal: not under version control, source=${origen}, destination=${destinoCrudo}`);
    }

    const base = origen.split('/').at(-1) ?? origen;
    const destino = aCarpeta
      ? `${destinoCrudo.replace(/\/+$/, '')}/${base}`
      : destinoCrudo;

    if (archivoPorNombre(siguiente, destino) !== undefined) {
      return fallo(estado, `fatal: destination exists, source=${origen}, destination=${destino}`);
    }

    siguiente = {
      ...siguiente,
      archivos: siguiente.archivos.map((candidato) =>
        candidato.nombre === origen
          ? {
              nombre: destino,
              estado: 'preparado' as const,
              renombradoDe: candidato.renombradoDe ?? origen,
            }
          : candidato,
      ),
    };
  }

  return ok(siguiente);
};

/**
 * `git ls-files`.
 *
 * Enumera lo que el repositorio esta versionando ahora. Es la orden con la que
 * el enunciado desmonta la ilusion del archivo de exclusiones: `git status` no
 * los menciona y sin embargo siguen ahi.
 */
export const ordenLsFiles: Manejador = (estado, argumentos): ResultadoOrden => {
  if (!estado.iniciado) return sinRepositorio(estado);

  if (tieneOpcion(argumentos, '--others', '-o')) {
    const otros = estado.archivos
      .filter((archivo) => archivo.estado === 'sin-seguimiento')
      .map((archivo) => archivo.nombre);
    return ok(estado, lineas(...[...otros].sort()));
  }

  const seguidos = new Set(archivosSeguidos(estado));
  // Lo que esta preparado y todavia no confirmado tambien esta en el indice.
  for (const archivo of estado.archivos) {
    if (archivo.estado === 'preparado') seguidos.add(archivo.nombre);
  }
  for (const nombre of estado.borrados) seguidos.delete(nombre);

  return ok(estado, lineas(...[...seguidos].sort()));
};
