/**
 * Ordenes del interprete de mandatos y `git remote`.
 *
 * Las del interprete existen para que la consola resulte creible: el
 * participante puede mirar donde esta, que archivos hay y modificar uno antes
 * de prepararlo.
 */

import { esOperador, letrasCortas, posicionales, tieneOpcion } from '../analizador';
import { bytesDe, lineasDe, normalizar, textoDeTrabajo } from '../contenido';
import {
  archivoPorNombre,
  establecerArchivo,
  establecerContenido,
  estaSeguido,
} from '../estado';
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

  // Con `-R` no se corta en la primera barra: se enumera todo lo que cuelga.
  const recursivo = letrasCortas(argumentos).has('R');

  const entradas = new Set<string>();
  for (const archivo of estado.archivos) {
    if (!archivo.nombre.startsWith(prefijo)) continue;
    const resto = archivo.nombre.slice(prefijo.length);
    if (recursivo) {
      entradas.add(resto);
      continue;
    }
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

  // `-a` se lee por su letra, como `-R`: `ls -aR` es una sola palabra.
  const todos = letrasCortas(argumentos).has('a') || tieneOpcion(argumentos, '--all');
  if (prefijo === '' && todos && estado.iniciado) {
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
 * `cat` sobre un archivo del proyecto (punto 3.2 del SPEC 012).
 *
 * Desde que el motor modela contenido, esta orden muestra el texto de verdad.
 * `cat` sobre la carpeta oculta sigue declarado como no soportado en el
 * contrato, y el despachador responde antes de llegar aqui: ese tramo del
 * laboratorio 02 se hace en la terminal a proposito.
 */
export const ordenCat: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'cat: falta el nombre del archivo');

  const filas: string[] = [];
  for (const ruta of rutas) {
    const texto = textoDeTrabajo(estado, ruta);
    if (texto === null) return fallo(estado, `cat: ${ruta}: No such file or directory`);
    filas.push(...lineasDe(texto));
  }
  return ok(estado, lineas(...filas));
};

/**
 * `grep`, con `-n` y `-r`.
 *
 * No esta en la lista de la seccion 3 del SPEC 012, y entra igual por la regla
 * que gobierna el contrato: **la pantalla nunca dice que una orden no existe
 * cuando existe**. `grep` existe en la terminal del participante, y el
 * simulador respondia `bash: grep: command not found`, que es la tercera
 * respuesta del SPEC 010 usada donde no corresponde.
 *
 * Hasta ahora eso no se notaba, porque sin contenido el paso del enunciado que
 * la usa era inalcanzable. El laboratorio 05 la escribe dos veces —en su punto
 * 3.5 y en su Comprobacion— para asegurarse de que no quedaron marcadores de
 * conflicto dentro de un archivo, y ese paso **se volvio alcanzable con este
 * spec**, en cuanto `cat platos.md` paso a mostrar los marcadores.
 *
 * Se cubre lo que el guion usa: texto literal, la alternancia `\|` de las
 * expresiones regulares basicas, `-n` para numerar y `-r` para recorrer el
 * proyecto entero. **No se cubre el resto de la sintaxis** de expresiones
 * regulares, ni `-i`, ni `-v`, ni `-c`: lo que no se reconozca se responde como
 * no implementado, con su nombre, y no a medias.
 */
export const ordenGrep: Manejador = (estado, argumentos) => {
  const partes = posicionales(argumentos);
  const patron = partes[0];
  if (patron === undefined) return fallo(estado, 'usage: grep [-n] [-r] <patron> <archivo>...');

  // `grep -rn` es una sola palabra con dos opciones dentro, que es como el
  // enunciado las escribe.
  const cortas = letrasCortas(argumentos);
  const numerar = cortas.has('n');
  const recursivo = cortas.has('r') || cortas.has('R');
  const rutas = partes.slice(1);

  // La alternancia de las expresiones regulares basicas, que es lo unico de
  // su sintaxis que el guion usa. Lo demas se busca como texto literal.
  const agujas = patron.split('\\|').filter((aguja) => aguja !== '');

  const objetivo = recursivo
    ? estado.archivos.map((archivo) => archivo.nombre)
    : rutas;
  if (objetivo.length === 0) {
    return fallo(estado, 'usage: grep [-n] [-r] <patron> <archivo>...');
  }

  const filas: string[] = [];
  for (const ruta of objetivo) {
    const contenido = textoDeTrabajo(estado, ruta);
    if (contenido === null) {
      if (recursivo) continue;
      return fallo(estado, `grep: ${ruta}: No such file or directory`);
    }
    lineasDe(contenido).forEach((linea, indice) => {
      if (!agujas.some((aguja) => linea.includes(aguja))) return;
      // Con varios archivos, y siempre con -r, Git Bash antepone la ruta.
      const prefijo = recursivo ? `${ruta.startsWith('./') ? ruta : `./${ruta}`}:` : '';
      const numero = numerar ? `${indice + 1}:` : '';
      filas.push(`${prefijo}${numero}${linea}`);
    });
  }

  // `grep` sin coincidencias sale con codigo distinto de cero y no dice nada.
  // Aqui basta con no imprimir: la consola no muestra codigos de salida.
  return ok(estado, lineas(...filas));
};

/**
 * `wc`, con `-c`, `-l` y `-w` (punto 3.6 del SPEC 012).
 *
 * Quedo fuera del SPEC 010 por no tener consumidor: la unica aparicion en el
 * guion es `wc -c .git/refs/heads/main`, y esa cae bajo la carpeta oculta, que
 * se mira en la terminal a proposito. Con contenido si tiene sentido sobre un
 * archivo del proyecto, y sobre todo **tiene sentido que no mienta**: sin esta
 * orden el simulador respondia `bash: wc: command not found`, que era falso
 * desde el momento en que `wc` existe y lo que no habia era contenido.
 */
export const ordenWc: Manejador = (estado, argumentos) => {
  const rutas = posicionales(argumentos);
  if (rutas.length === 0) return fallo(estado, 'usage: wc [-c|-l|-w] <archivo>...');

  const cortas = letrasCortas(argumentos);
  const pedidas = {
    lineas: cortas.has('l'),
    palabras: cortas.has('w'),
    bytes: cortas.has('c'),
  };
  // Sin opciones, `wc` imprime las tres columnas, en este orden.
  const todas = !pedidas.lineas && !pedidas.palabras && !pedidas.bytes;

  const filas: string[] = [];
  for (const ruta of rutas) {
    const texto = textoDeTrabajo(estado, ruta);
    if (texto === null) return fallo(estado, `wc: ${ruta}: No such file or directory`);
    const columnas: number[] = [];
    if (todas || pedidas.lineas) columnas.push(lineasDe(texto).length);
    if (todas || pedidas.palabras) {
      columnas.push(texto.split(/\s+/).filter((palabra) => palabra !== '').length);
    }
    if (todas || pedidas.bytes) columnas.push(bytesDe(texto));
    filas.push(`${columnas.map((numero) => String(numero).padStart(7)).join('')} ${ruta}`);
  }
  return ok(estado, lineas(...filas));
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
  // El texto viaja con el archivo. En el nombre nuevo no hay confirmacion de
  // la que heredarlo, asi que deja de ser `null` y pasa a ser explicito.
  const texto = textoDeTrabajo(estado, origen) ?? '';
  const sinElOrigen = estado.archivos.filter((archivo) => archivo.nombre !== origen);

  // Devolver un archivo a su nombre de siempre lo deja como estaba, **si su
  // baja no estaba preparada**: vuelve a ser el archivo versionado y su borrado
  // deja de estar pendiente.
  if (estado.borradosSinPreparar.includes(destino)) {
    return ok({
      ...estado,
      archivos: [...sinElOrigen, { nombre: destino, estado: 'limpio' as const, contenido: null }],
      borradosSinPreparar: estado.borradosSinPreparar.filter((nombre) => nombre !== destino),
    });
  }

  // Si la baja ya estaba preparada, el archivo reaparece **sin seguimiento** y
  // la baja sigue en el area de preparacion: el indice no se entera de lo que
  // pasa en el disco. Comprobado contra Git.
  if (estado.borrados.includes(destino)) {
    return ok({
      ...estado,
      archivos: [
        ...sinElOrigen,
        { nombre: destino, estado: 'sin-seguimiento' as const, contenido: texto },
      ],
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
        ? {
            nombre: destino,
            estado: 'sin-seguimiento' as const,
            contenido: texto,
            renombradoDe: origen,
          }
        : { nombre: destino, estado: 'sin-seguimiento' as const, contenido: texto },
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
 * `echo`, con redireccion sobre un archivo, en sus dos formas.
 *
 * `>` reemplaza el texto del archivo y `>>` le agrega una linea al final. Es
 * la manera de escribir dentro del simulador, y desde el SPEC 012 escribe de
 * verdad: el texto queda en el directorio de trabajo y lo ven `cat`,
 * `git diff` y las reglas de exclusion.
 *
 * Antes esta orden llevaba un aviso pegado cuando el destino era un
 * `.gitignore`, porque el archivo quedaba creado y no filtraba nada. Ese aviso
 * se fue con la razon que lo justificaba.
 */
export const ordenEcho: Manejador = (estado, argumentos) => {
  const corte = argumentos.findIndex(esOperador);

  if (corte < 0) {
    return ok(estado, lineas(argumentos.join(' ')));
  }

  const anexa = argumentos[corte] === '>>';
  const destino = argumentos[corte + 1];
  if (destino === undefined) {
    return fallo(estado, 'bash: syntax error near unexpected token `newline\'');
  }

  // El salto va pegado antes de normalizar: `echo "" > archivo` escribe una
  // linea en blanco, no un archivo vacio, y las listas del recetario llevan
  // lineas en blanco entre sus secciones.
  const escrito = normalizar(`${argumentos.slice(0, corte).join(' ')}\n`);
  const existente = archivoPorNombre(estado, destino);
  const previo = anexa ? (textoDeTrabajo(estado, destino) ?? '') : '';
  const texto = `${previo}${escrito}`;

  if (existente === undefined) {
    return ok(
      establecerContenido(
        establecerArchivo(estado, destino, 'sin-seguimiento'),
        destino,
        texto,
      ),
    );
  }

  // Escribir lo mismo que ya habia no ensucia el archivo, igual que en Git.
  const destinoEstado =
    existente.estado === 'limpio' && texto !== (textoDeTrabajo(estado, destino) ?? '')
      ? 'modificado'
      : existente.estado;
  return ok(establecerContenido(establecerArchivo(estado, destino, destinoEstado), destino, texto));
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
