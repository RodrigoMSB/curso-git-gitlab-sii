/**
 * Ordenes del interprete de mandatos y `git remote`.
 *
 * Las del interprete existen para que la consola resulte creible: el
 * participante puede mirar donde esta, que archivos hay y modificar uno antes
 * de prepararlo.
 */

import { esOperador, posicionales, tieneOpcion } from '../analizador';
import { archivoPorNombre, establecerArchivo, estaSeguido } from '../estado';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** `pwd` */
export const ordenPwd: Manejador = (estado) => ok(estado, lineas(estado.directorio));

/** `clear` */
export const ordenClear: Manejador = (estado) => ok(estado, [], { limpiarConsola: true });

/**
 * `ls`, con `-a`. Muestra las entradas de primer nivel; las carpetas van con
 * barra final, como en un interprete real.
 *
 * Con `-a` aparece tambien `.git`, que el laboratorio 01 hace mirar justo
 * despues de `git init`. Se muestra la carpeta, no lo que tiene adentro: lo
 * primero es cierto y lo segundo el motor no lo modela.
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

  for (const carpeta of estado.carpetas) {
    if (!carpeta.startsWith(prefijo)) continue;
    const resto = carpeta.slice(prefijo.length);
    if (resto === '') continue;
    const corte = resto.indexOf('/');
    entradas.add(corte < 0 ? `${resto}/` : `${resto.slice(0, corte)}/`);
  }

  if (entradas.size === 0 && prefijo !== '' && !estado.carpetas.includes(prefijoPedido)) {
    return fallo(estado, `ls: ${prefijoPedido}: No such file or directory`);
  }

  if (prefijo === '' && tieneOpcion(argumentos, '-a', '--all') && estado.iniciado) {
    entradas.add('.git/');
  }

  return ok(estado, lineas(...[...entradas].sort((una, otra) => una.localeCompare(otra))));
};

/**
 * `mkdir`, con `-p`.
 *
 * Una carpeta que todavia no tiene archivos adentro se anota aparte: el motor
 * deduce las demas de los nombres de archivo. El laboratorio 03 crea dos
 * carpetas vacias antes de mover recetas a ellas, y sin esto `git mv` no
 * tendria destino.
 */
export const ordenMkdir: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'usage: mkdir [-p] <directorio>...');
  const conPadres = tieneOpcion(argumentos, '-p');

  let siguiente = estado;
  for (const cruda of rutas) {
    const ruta = cruda.replace(/\/+$/, '');
    if (existeCarpeta(siguiente, ruta)) {
      if (conPadres) continue;
      return fallo(estado, `mkdir: ${cruda}: File exists`);
    }
    const partes = ruta.split('/');
    if (!conPadres && partes.length > 1) {
      const padre = partes.slice(0, -1).join('/');
      if (!existeCarpeta(siguiente, padre)) {
        return fallo(estado, `mkdir: ${cruda}: No such file or directory`);
      }
    }
    const nuevas = conPadres
      ? partes.map((_, indice) => partes.slice(0, indice + 1).join('/'))
      : [ruta];
    siguiente = {
      ...siguiente,
      carpetas: [
        ...siguiente.carpetas,
        ...nuevas.filter((nueva) => !existeCarpeta(siguiente, nueva)),
      ],
    };
  }
  return ok(siguiente);
};

/** Si una carpeta existe, sea porque se creo o porque hay archivos dentro. */
function existeCarpeta(estado: EstadoRepositorio, ruta: string): boolean {
  if (ruta === '' || ruta === '.') return true;
  if (estado.carpetas.includes(ruta)) return true;
  return estado.archivos.some((archivo) => archivo.nombre.startsWith(`${ruta}/`));
}

/**
 * `cat`.
 *
 * Mostrar el contenido de un archivo esta declarado como no soportado en el
 * contrato, de modo que el despachador responde antes de llegar aqui y este
 * manejador solo ve el `cat` sin argumentos. El verbo se mantiene registrado a
 * proposito: si no lo estuviera, el simulador diria que la orden no existe, y
 * `cat` si existe. Lo que no existe es el contenido.
 */
export const ordenCat: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'cat: falta el nombre del archivo');
  return fallo(estado, `cat: ${rutas[0]}: No such file or directory`);
};

/**
 * `mv` del interprete, que no es `git mv`.
 *
 * El laboratorio 03 lo usa para enseñar la diferencia: renombrar por fuera
 * deja **un archivo borrado y otro sin seguimiento**, porque para Git son dos
 * hechos separados hasta que compara el contenido y deduce el renombrado.
 * Modelarlo asi es lo que permite que el paso 1.4 muestre lo que promete.
 */
export const ordenMv: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  const destino = rutas[1];
  const origen = rutas[0];
  if (origen === undefined || destino === undefined) {
    return fallo(estado, 'usage: mv <origen> <destino>');
  }
  if (archivoPorNombre(estado, origen) === undefined) {
    return fallo(estado, `mv: rename ${origen} to ${destino}: No such file or directory`);
  }

  const seguido = estaSeguido(estado, origen);
  const sinElOrigen = estado.archivos.filter((archivo) => archivo.nombre !== origen);

  // Devolver un archivo a su nombre de siempre lo deja como estaba, **si su
  // baja no estaba preparada**: vuelve a ser el archivo versionado y su borrado
  // deja de estar pendiente.
  if (estado.borradosSinPreparar.includes(destino)) {
    return ok({
      ...estado,
      archivos: [...sinElOrigen, { nombre: destino, estado: 'limpio' as const }],
      borradosSinPreparar: estado.borradosSinPreparar.filter((nombre) => nombre !== destino),
    });
  }

  // Si la baja ya estaba preparada, el archivo reaparece **sin seguimiento** y
  // la baja sigue en el area de preparacion: el indice no se entera de lo que
  // pasa en el disco. Comprobado contra Git.
  if (estado.borrados.includes(destino)) {
    return ok({
      ...estado,
      archivos: [...sinElOrigen, { nombre: destino, estado: 'sin-seguimiento' as const }],
    });
  }

  return ok({
    ...estado,
    // Si estaba versionado, su desaparicion es un borrado sin preparar y el
    // archivo nuevo nace sin seguimiento. Eso es lo que `git status` muestra
    // antes de preparar nada: para Git son dos hechos separados.
    //
    // La procedencia se anota igual. No es contenido: es saber que este
    // archivo llego aqui desde aquel. Git deduce lo mismo comparando bytes; el
    // simulador lo sabe porque lo vio ocurrir, y por eso puede decir
    // `renamed:` sin inventarse una similitud que no puede medir.
    archivos: [
      ...sinElOrigen,
      seguido
        ? { nombre: destino, estado: 'sin-seguimiento' as const, renombradoDe: origen }
        : { nombre: destino, estado: 'sin-seguimiento' as const },
    ],
    borradosSinPreparar: seguido
      ? [...estado.borradosSinPreparar, origen]
      : estado.borradosSinPreparar,
  });
};

/**
 * `rm` del interprete. Borra el archivo del directorio de trabajo y nada mas.
 *
 * Si el archivo estaba versionado, Git lo nota como un borrado sin preparar.
 * El enunciado solo lo usa sobre archivos sin seguimiento, pero distinguir los
 * dos casos cuesta lo mismo y evita enseñar algo falso a quien tantee.
 */
export const ordenRm: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'usage: rm <archivo>...');

  let siguiente = estado;
  for (const ruta of rutas) {
    if (archivoPorNombre(siguiente, ruta) === undefined) {
      return fallo(estado, `rm: ${ruta}: No such file or directory`);
    }
    const seguido = estaSeguido(siguiente, ruta);
    siguiente = {
      ...siguiente,
      archivos: siguiente.archivos.filter((archivo) => archivo.nombre !== ruta),
      borradosSinPreparar: seguido
        ? [...siguiente.borradosSinPreparar, ruta]
        : siguiente.borradosSinPreparar,
    };
  }
  return ok(siguiente);
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
