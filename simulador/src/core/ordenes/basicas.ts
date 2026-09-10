/**
 * Ordenes de trabajo diario: `init`, `config`, `status`, `add`, `restore` y
 * `diff`.
 */

import { posicionales, tieneOpcion } from '../analizador';
import { archivosEn, establecerArchivo, estaSeguido } from '../estado';
import { formatearDiff, formatearEstadoCorto, formatearEstadoLargo } from '../formato';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { Archivo, EstadoRepositorio, ResultadoOrden } from '../tipos';

export type Manejador = (
  estado: EstadoRepositorio,
  argumentos: readonly string[],
) => ResultadoOrden;

/** `git init` */
export const ordenInit: Manejador = (estado) => {
  const ruta = `${estado.directorio}/.git/`;
  if (estado.iniciado) {
    return ok(estado, lineas(`Reinitialized existing Git repository in ${ruta}`));
  }
  return ok({ ...estado, iniciado: true }, lineas(`Initialized empty Git repository in ${ruta}`));
};

/** `git config`, con `user.name`, `user.email` y `--global`. */
export const ordenConfig: Manejador = (estado, argumentos) => {
  const global = tieneOpcion(argumentos, '--global');
  const ambito = global ? 'global' : 'local';
  const restantes = posicionales(argumentos);

  if (tieneOpcion(argumentos, '-l', '--list')) {
    const fuente = global
      ? estado.config.global
      : { ...estado.config.global, ...estado.config.local };
    return ok(
      estado,
      lineas(...Object.entries(fuente).map(([clave, valor]) => `${clave}=${valor}`)),
    );
  }

  const clave = restantes[0];
  if (clave === undefined) {
    return fallo(estado, 'usage: git config [--global] <name> [<value>]');
  }

  const valor = restantes[1];
  if (valor === undefined) {
    const guardado = global ? estado.config.global[clave] : estado.config.local[clave];
    const heredado = guardado ?? estado.config.global[clave];
    if (heredado === undefined) return fallo(estado);
    return ok(estado, lineas(heredado));
  }

  return ok({
    ...estado,
    config: { ...estado.config, [ambito]: { ...estado.config[ambito], [clave]: valor } },
  });
};

/** `git status`, en forma larga y con `-s`. */
export const ordenStatus: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);
  const corto = tieneOpcion(argumentos, '-s', '--short');
  return ok(estado, lineas(...(corto ? formatearEstadoCorto(estado) : formatearEstadoLargo(estado))));
};

/** Archivos que una ruta abarca: el archivo exacto o todo lo que cuelga de una carpeta. */
function coincidencias(estado: EstadoRepositorio, ruta: string): readonly Archivo[] {
  if (ruta === '.' || ruta === './') return estado.archivos;
  const carpeta = ruta.endsWith('/') ? ruta : `${ruta}/`;
  return estado.archivos.filter(
    (archivo) => archivo.nombre === ruta || archivo.nombre.startsWith(carpeta),
  );
}

/** `git add`, con archivo puntual, `.` y `-A`. */
export const ordenAdd: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const rutas = posicionales(argumentos);
  const todo = tieneOpcion(argumentos, '-A', '--all', '-a');

  if (rutas.length === 0 && !todo) {
    return ok(
      estado,
      lineas(
        'Nothing specified, nothing added.',
        'hint: Maybe you wanted to say \'git add .\'?',
      ),
    );
  }

  const objetivo: Archivo[] = [];
  if (todo || rutas.length === 0) {
    objetivo.push(...estado.archivos);
  } else {
    for (const ruta of rutas) {
      const encontrados = coincidencias(estado, ruta);
      if (encontrados.length === 0) {
        return fallo(estado, `fatal: pathspec '${ruta}' did not match any files`);
      }
      objetivo.push(...encontrados);
    }
  }

  let siguiente = estado;
  for (const archivo of objetivo) {
    if (archivo.estado === 'limpio' || archivo.estado === 'preparado') continue;
    siguiente = establecerArchivo(siguiente, archivo.nombre, 'preparado');
    // El nombre que este archivo tenia antes deja de estar pendiente: su
    // desaparicion ya esta contada como parte del renombrado.
    if (archivo.renombradoDe !== undefined) {
      siguiente = {
        ...siguiente,
        borradosSinPreparar: siguiente.borradosSinPreparar.filter(
          (nombre) => nombre !== archivo.renombradoDe,
        ),
      };
    }
  }

  // Preparar un borrado que estaba pendiente lo pasa al area de preparacion,
  // que es lo que hace `git add` sobre un archivo que ya no esta. Se mira la
  // lista ya podada: el nombre viejo de un renombrado salio de ahi arriba y
  // volver a tomarlo lo contaria dos veces, como baja y como renombrado.
  siguiente = prepararBorrados(siguiente, todo, rutas);

  // Resolver el ultimo conflicto no cierra la fusion: falta confirmar.
  return ok(siguiente);
};

/**
 * Pasa al area de preparacion los borrados pendientes que la orden alcanza.
 *
 * `git add .` y `git add -A` los toman todos; `git add <ruta>` solo el que
 * nombra, aunque el archivo ya no este en el directorio de trabajo.
 */
function prepararBorrados(
  siguiente: EstadoRepositorio,
  todo: boolean,
  rutas: readonly string[],
): EstadoRepositorio {
  const alcanza = (nombre: string): boolean => {
    if (todo || rutas.length === 0) return true;
    return rutas.some(
      (ruta) => ruta === '.' || ruta === './' || ruta === nombre || nombre.startsWith(`${ruta}/`),
    );
  };
  const alcanzados = siguiente.borradosSinPreparar.filter(alcanza);
  if (alcanzados.length === 0) return siguiente;
  return {
    ...siguiente,
    borrados: [...new Set([...siguiente.borrados, ...alcanzados])],
    borradosSinPreparar: siguiente.borradosSinPreparar.filter((nombre) => !alcanza(nombre)),
  };
}

/** `git restore`, con archivo puntual y `--staged`. */
export const ordenRestore: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const preparado = tieneOpcion(argumentos, '--staged', '--cached');
  const rutas = posicionales(argumentos);

  if (rutas.length === 0) {
    return fallo(estado, 'fatal: you must specify path(s) to restore');
  }

  let siguiente = estado;
  for (const ruta of rutas) {
    const encontrados = coincidencias(estado, ruta);
    if (encontrados.length === 0) {
      return fallo(estado, `error: pathspec '${ruta}' did not match any file(s) known to git`);
    }
    for (const archivo of encontrados) {
      if (preparado) {
        if (archivo.estado !== 'preparado') continue;
        const destino = estaSeguido(siguiente, archivo.nombre) ? 'modificado' : 'sin-seguimiento';
        siguiente = establecerArchivo(siguiente, archivo.nombre, destino);
        // El indice de Git es por ruta: sacar de la preparacion el nombre
        // nuevo de un renombrado **no** saca la baja del nombre viejo, que
        // sigue preparada. Comprobado contra Git: queda `D  platos.md` junto
        // al archivo nuevo sin seguimiento.
        if (archivo.renombradoDe !== undefined) {
          siguiente = {
            ...siguiente,
            borrados: [...new Set([...siguiente.borrados, archivo.renombradoDe])],
          };
        }
      } else {
        if (archivo.estado !== 'modificado') continue;
        siguiente = establecerArchivo(siguiente, archivo.nombre, 'limpio');
      }
    }
  }

  return ok(siguiente);
};

/** `git diff`, sin opciones y con `--staged`. */
export const ordenDiff: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);
  const preparado = tieneOpcion(argumentos, '--staged', '--cached');
  const seleccion = archivosEn(estado, preparado ? 'preparado' : 'modificado');
  return ok(estado, lineas(...formatearDiff(seleccion.map((archivo) => archivo.nombre))));
};
